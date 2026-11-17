import io
import math
import logging
import time
from datetime import datetime
from bson import ObjectId
import pandas as pd
import numpy as np
import joblib
from app.db.mongo import get_db, get_gridfs
from app.models.ml_model import ModelCreate, ModelStatus
from app.models.feature_set import FeatureConfig
from app.services.ml.registry import build_model
from app.services.ml.metrics import compute_all
from app.services.feature_engineering import FeatureEngineer

logger = logging.getLogger(__name__)


async def create_model(body: ModelCreate) -> dict:
    db = get_db()
    existing = await db.models.count_documents(
        {"junction_id": body.junction_id, "algorithm": body.algorithm, "dataset_id": body.dataset_id}
    )
    doc = {
        **body.model_dump(),
        "version": existing + 1,
        "metrics": None,
        "gridfs_model_id": None,
        "status": ModelStatus.training,
        "is_active": False,
        "training_duration_sec": None,
        "created_at": datetime.utcnow(),
        "error_message": None,
    }
    result = await db.models.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def train_model(model_id: str) -> None:
    db = get_db()
    fs = get_gridfs()
    model_doc = await db.models.find_one({"_id": ObjectId(model_id)})
    if not model_doc:
        return

    t0 = time.time()
    try:
        # Load all observations for this junction
        cursor = db.traffic_observations.find(
            {"dataset_id": model_doc["dataset_id"], "junction_id": model_doc["junction_id"]},
            {"_id": 0},
        )
        docs = [d async for d in cursor]
        if not docs:
            raise ValueError("No observations found for training")

        df = pd.DataFrame(docs)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp").reset_index(drop=True)

        # Load feature config
        config = FeatureConfig()
        if model_doc.get("feature_set_id"):
            fs_doc = await db.feature_sets.find_one({"_id": ObjectId(model_doc["feature_set_id"])})
            if fs_doc:
                config = FeatureConfig(**fs_doc["config"])

        # STRICT chronological 80/20 split — no random shuffling
        split_idx = int(len(df) * 0.8)
        train_df = df.iloc[:split_idx].copy()
        test_df = df.iloc[split_idx:].copy()

        # Feature engineering: fit on train, transform test
        engineer = FeatureEngineer(config)
        train_features = engineer.fit_transform(train_df)
        test_features = engineer.transform(test_df)

        # Train
        model = build_model(model_doc["algorithm"], model_doc.get("hyperparameters", {}))
        model.fit(train_features, target_col="vehicle_count", **model_doc.get("hyperparameters", {}))

        # Evaluate on held-out test set
        try:
            preds, _, _ = model.predict_with_ci(len(test_features), exog=test_features)
        except (TypeError, ValueError):
            preds = model.predict(len(test_features))

        actual = test_features["vehicle_count"].values
        preds = np.clip(preds, 0, None)
        metrics = compute_all(actual, preds)

        # Persist model + engineer as one binary
        payload = {"model": model, "engineer": engineer}
        buf = io.BytesIO()
        joblib.dump(payload, buf)
        buf.seek(0)
        gfs_id = await fs.upload_from_stream(f"model_{model_id}.pkl", buf)

        await db.models.update_one(
            {"_id": ObjectId(model_id)},
            {"$set": {
                "status": ModelStatus.ready,
                "metrics": metrics,
                "gridfs_model_id": str(gfs_id),
                "training_duration_sec": round(time.time() - t0, 2),
                "train_range": {
                    "start": train_df["timestamp"].min(),
                    "end": train_df["timestamp"].max(),
                },
                "test_range": {
                    "start": test_df["timestamp"].min(),
                    "end": test_df["timestamp"].max(),
                },
            }},
        )
        logger.info(f"Model {model_id} trained in {time.time()-t0:.1f}s — {metrics}")

    except Exception as exc:
        logger.exception(f"Training failed for model {model_id}: {exc}")
        await db.models.update_one(
            {"_id": ObjectId(model_id)},
            {"$set": {"status": ModelStatus.failed, "error_message": str(exc)}},
        )


async def list_models(junction_id, algorithm, page, page_size) -> dict:
    db = get_db()
    q: dict = {}
    if junction_id:
        q["junction_id"] = junction_id
    if algorithm:
        q["algorithm"] = algorithm
    skip = (page - 1) * page_size
    total = await db.models.count_documents(q)
    cursor = db.models.find(q).sort("created_at", -1).skip(skip).limit(page_size)
    items = [_s(d) async for d in cursor]
    return {
        "items": items, "total": total, "page": page,
        "page_size": page_size, "pages": math.ceil(total / page_size) if total else 1,
    }


async def get_model(model_id: str) -> dict | None:
    db = get_db()
    doc = await db.models.find_one({"_id": ObjectId(model_id)})
    return _s(doc)


async def activate_model(model_id: str) -> dict | None:
    db = get_db()
    doc = await db.models.find_one({"_id": ObjectId(model_id)})
    if not doc:
        return None
    await db.models.update_many(
        {"junction_id": doc["junction_id"], "algorithm": doc["algorithm"]},
        {"$set": {"is_active": False}},
    )
    result = await db.models.find_one_and_update(
        {"_id": ObjectId(model_id)},
        {"$set": {"is_active": True}},
        return_document=True,
    )
    return _s(result)


async def delete_model(model_id: str) -> bool:
    db = get_db()
    fs = get_gridfs()
    doc = await db.models.find_one({"_id": ObjectId(model_id)})
    if not doc:
        return False
    if doc.get("gridfs_model_id"):
        try:
            await fs.delete(ObjectId(doc["gridfs_model_id"]))
        except Exception:
            pass
    await db.models.delete_one({"_id": ObjectId(model_id)})
    return True


async def compare_models(junction_id: str) -> list:
    db = get_db()
    cursor = db.models.find({"junction_id": junction_id, "status": "ready"})
    return [_s(d) async for d in cursor]


async def get_feature_importance(model_id: str) -> dict | None:
    db = get_db()
    fs = get_gridfs()
    doc = await db.models.find_one({"_id": ObjectId(model_id)})
    if not doc or doc.get("algorithm") != "random_forest":
        return None
    if not doc.get("gridfs_model_id"):
        return None
    try:
        grid_out = await fs.open_download_stream(ObjectId(doc["gridfs_model_id"]))
        buf = io.BytesIO(await grid_out.read())
        payload = joblib.load(buf)
        rf_model = payload["model"] if isinstance(payload, dict) else payload
        return dict(sorted(rf_model.feature_importances_.items(), key=lambda x: x[1], reverse=True))
    except Exception:
        return None


def _s(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc
