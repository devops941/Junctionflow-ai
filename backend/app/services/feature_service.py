import logging
from datetime import datetime
from bson import ObjectId
import numpy as np
import pandas as pd
from app.db.mongo import get_db
from app.models.feature_set import FeatureSetCreate, FeatureConfig, FeatureSetStatus
from app.services.feature_engineering import FeatureEngineer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CRUD helpers
# ---------------------------------------------------------------------------

async def create_feature_set(body: FeatureSetCreate) -> dict:
    db = get_db()
    doc = {
        "dataset_id": body.dataset_id,
        "junction_id": body.junction_id,
        "config": body.config.model_dump(),
        "feature_columns": [],
        "total_features": 0,
        "train_rows": 0,
        "test_rows": 0,
        "status": FeatureSetStatus.pending,
        "error_message": None,
        "created_at": datetime.utcnow(),
    }
    result = await db.feature_sets.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def get_feature_set(feature_set_id: str) -> dict | None:
    db = get_db()
    doc = await db.feature_sets.find_one({"_id": ObjectId(feature_set_id)})
    return _s(doc)


async def list_feature_sets(dataset_id: str) -> list[dict]:
    db = get_db()
    cursor = db.feature_sets.find({"dataset_id": dataset_id}).sort("created_at", -1)
    return [_s(d) async for d in cursor]


async def delete_feature_set(feature_set_id: str) -> bool:
    db = get_db()
    result = await db.feature_sets.delete_one({"_id": ObjectId(feature_set_id)})
    return result.deleted_count > 0


# ---------------------------------------------------------------------------
# Background task: full feature engineering
# ---------------------------------------------------------------------------

async def engineer_features(feature_set_id: str) -> None:
    """
    Background task: build feature matrix for the entire dataset/junction,
    store computed feature column list and row counts.
    """
    db = get_db()
    await db.feature_sets.update_one(
        {"_id": ObjectId(feature_set_id)},
        {"$set": {"status": FeatureSetStatus.computing}},
    )
    fs_doc = await db.feature_sets.find_one({"_id": ObjectId(feature_set_id)})
    if not fs_doc:
        return
    try:
        config = FeatureConfig(**fs_doc["config"])
        q: dict = {"dataset_id": fs_doc["dataset_id"]}
        if fs_doc.get("junction_id"):
            q["junction_id"] = fs_doc["junction_id"]

        cursor = db.traffic_observations.find(q, {"_id": 0})
        docs = [d async for d in cursor]
        if not docs:
            raise ValueError("No observations found for this dataset/junction")

        df = pd.DataFrame(docs)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values(["junction_id", "timestamp"]).reset_index(drop=True)

        split_idx = int(len(df) * 0.8)
        train_df = df.iloc[:split_idx].copy()

        engineer = FeatureEngineer(config)
        engineer.fit_transform(train_df)

        await db.feature_sets.update_one(
            {"_id": ObjectId(feature_set_id)},
            {"$set": {
                "feature_columns": engineer.feature_columns,
                "total_features": len(engineer.feature_columns),
                "train_rows": split_idx,
                "test_rows": len(df) - split_idx,
                "status": FeatureSetStatus.ready,
            }},
        )
        logger.info(f"Feature set {feature_set_id} ready: {len(engineer.feature_columns)} features")
    except Exception as exc:
        logger.exception(f"Feature engineering failed for {feature_set_id}: {exc}")
        await db.feature_sets.update_one(
            {"_id": ObjectId(feature_set_id)},
            {"$set": {"status": FeatureSetStatus.failed, "error_message": str(exc)}},
        )


# ---------------------------------------------------------------------------
# Preview + correlation (on-the-fly, no background task)
# ---------------------------------------------------------------------------

async def preview_features(
    dataset_id: str,
    junction_id: str,
    config: FeatureConfig,
    sample_size: int = 500,
) -> dict:
    """
    Compute features on a sample, return preview table + target correlation.
    Uses strict chronological split — scalers fit on training portion only.
    """
    db = get_db()
    cursor = db.traffic_observations.find(
        {"dataset_id": dataset_id, "junction_id": junction_id},
        {"_id": 0},
    ).sort("timestamp", 1).limit(sample_size)
    docs = [d async for d in cursor]
    if not docs:
        return {"error": "No observations found for this dataset/junction"}

    df = pd.DataFrame(docs)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Strict chronological 80/20 split
    split_idx = max(1, int(len(df) * 0.8))
    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()

    engineer = FeatureEngineer(config)
    train_features = engineer.fit_transform(train_df)
    test_features = (
        engineer.transform(test_df)
        if len(test_df) > 0
        else pd.DataFrame(columns=train_features.columns)
    )

    # Tag split
    train_features = train_features.copy()
    test_features = test_features.copy()
    train_features["_split"] = "train"
    test_features["_split"] = "test"
    combined = pd.concat([train_features, test_features], ignore_index=True)

    feat_cols = engineer.feature_columns

    # Pearson correlation on training data only (no leakage)
    correlation: dict[str, float] = {}
    numeric_feat_cols = [
        c for c in feat_cols 
        if c in train_features.columns and pd.api.types.is_numeric_dtype(train_features[c])
    ]
    if "vehicle_count" in train_features.columns and len(numeric_feat_cols) > 0:
        cols_for_corr = numeric_feat_cols + ["vehicle_count"]
        train_clean = train_features[cols_for_corr].dropna()
        if len(train_clean) > 5:
            try:
                corr_df = train_clean.corr(numeric_only=True)
                if "vehicle_count" in corr_df.columns:
                    corr_series = corr_df["vehicle_count"].drop("vehicle_count", errors="ignore")
                    correlation = {
                        k: round(float(v), 4)
                        for k, v in corr_series.items()
                        if pd.notna(v) and not np.isinf(v)
                    }
            except Exception as e:
                logger.warning(f"Correlation calculation skipped: {e}")

    # Preview table: first 50 rows, first 15 feature cols + target
    preview_cols = ["timestamp", "junction_id", "_split"] + feat_cols[:15] + ["vehicle_count"]
    preview_cols = [c for c in preview_cols if c in combined.columns]
    preview_df = combined[preview_cols].head(50)

    def _safe(v):
        if pd.isna(v):
            return None
        if isinstance(v, (float, np.floating)):
            if np.isnan(v) or np.isinf(v):
                return None
            return round(float(v), 4)
        if isinstance(v, (int, np.integer)):
            return int(v)
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return v

    rows = [{k: _safe(row[k]) for k in preview_cols if k in row} for _, row in preview_df.iterrows()]

    return {
        "feature_columns": feat_cols,
        "total_features": len(feat_cols),
        "train_rows": split_idx,
        "test_rows": len(df) - split_idx,
        "sample_size": len(df),
        "preview_columns": preview_cols,
        "preview_rows": rows,
        "correlation": correlation,
    }


def _s(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc
