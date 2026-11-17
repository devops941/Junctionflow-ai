import io
import math
import logging
from datetime import datetime
from bson import ObjectId
from fastapi import UploadFile
from app.db.mongo import get_db, get_gridfs
from app.models.dataset import ColumnMapping, DatasetStatus
from app.services.validation import validate_dataframe
import pandas as pd

logger = logging.getLogger(__name__)


async def list_datasets(page: int, page_size: int) -> dict:
    db = get_db()
    skip = (page - 1) * page_size
    total = await db.datasets.count_documents({})
    cursor = db.datasets.find({}, {"gridfs_file_id": 0}).skip(skip).limit(page_size).sort("created_at", -1)
    items = [_s(doc) async for doc in cursor]
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": math.ceil(total / page_size) if total else 1}


async def upload_dataset(file: UploadFile, name: str) -> dict:
    db = get_db()
    fs = get_gridfs()
    content = await file.read()
    file_id = await fs.upload_from_stream(file.filename, io.BytesIO(content),
                                           metadata={"content_type": file.content_type})
    doc = {
        "name": name,
        "original_filename": file.filename,
        "gridfs_file_id": str(file_id),
        "row_count": 0,
        "column_mapping": None,
        "date_range": None,
        "junction_ids": [],
        "status": DatasetStatus.uploaded,
        "validation_report": None,
        "created_at": datetime.utcnow(),
    }
    result = await db.datasets.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def get_dataset(dataset_id: str) -> dict | None:
    db = get_db()
    doc = await db.datasets.find_one({"_id": ObjectId(dataset_id)})
    return _s(doc) if doc else None


async def validate_dataset(dataset_id: str, column_mapping: ColumnMapping) -> None:
    db = get_db()
    fs = get_gridfs()
    doc = await db.datasets.find_one({"_id": ObjectId(dataset_id)})
    if not doc:
        return

    try:
        grid_out = await fs.open_download_stream(ObjectId(doc["gridfs_file_id"]))
        content = await grid_out.read()
        fname = doc["original_filename"].lower()
        df = pd.read_excel(io.BytesIO(content)) if fname.endswith((".xlsx", ".xls")) else pd.read_csv(io.BytesIO(content))

        report, cleaned_df = validate_dataframe(df, column_mapping)

        updates = {
            "column_mapping": column_mapping.model_dump(),
            "validation_report": report.model_dump(),
            "row_count": len(cleaned_df),
            "status": DatasetStatus.validated if not report.errors else DatasetStatus.failed,
        }

        if not report.errors and len(cleaned_df):
            updates["date_range"] = {
                "start": cleaned_df[column_mapping.timestamp].min(),
                "end": cleaned_df[column_mapping.timestamp].max(),
            }
            updates["junction_ids"] = cleaned_df[column_mapping.junction_id].astype(str).unique().tolist()
            await _ingest_observations(dataset_id, cleaned_df, column_mapping)

        await db.datasets.update_one({"_id": ObjectId(dataset_id)}, {"$set": updates})
        logger.info(f"Dataset {dataset_id} validation complete: {updates['status']}")
    except Exception as exc:
        logger.exception(f"Validation failed for dataset {dataset_id}: {exc}")
        await db.datasets.update_one(
            {"_id": ObjectId(dataset_id)},
            {"$set": {"status": DatasetStatus.failed,
                      "validation_report": {"errors": [str(exc)], "total_rows": 0,
                                            "valid_rows": 0, "invalid_rows": 0}}},
        )


async def _ingest_observations(dataset_id: str, df: pd.DataFrame, cm: ColumnMapping) -> None:
    db = get_db()
    docs = []
    for _, row in df.iterrows():
        weather = {}
        for field in ["temperature_c", "rainfall_mm", "humidity_pct", "wind_speed_kmh", "weather_condition"]:
            col = getattr(cm, field)
            if col and col in row.index:
                weather[field] = row[col] if pd.notna(row[col]) else None

        doc = {
            "dataset_id": dataset_id,
            "junction_id": str(row[cm.junction_id]),
            "timestamp": row[cm.timestamp],
            "vehicle_count": int(row[cm.vehicle_count]),
            "weather": weather,
            "is_holiday": bool(row[cm.is_holiday]) if cm.is_holiday and cm.is_holiday in row.index else False,
            "event_flag": bool(row[cm.event_flag]) if cm.event_flag and cm.event_flag in row.index else False,
        }
        docs.append(doc)

    if docs:
        try:
            await db.traffic_observations.insert_many(docs, ordered=False)
        except Exception:
            pass  # duplicate key errors are acceptable on re-ingest


async def preview_dataset(dataset_id: str, rows: int) -> dict:
    db = get_db()
    fs = get_gridfs()
    doc = await db.datasets.find_one({"_id": ObjectId(dataset_id)})
    if not doc:
        return {}
    grid_out = await fs.open_download_stream(ObjectId(doc["gridfs_file_id"]))
    content = await grid_out.read()
    fname = doc["original_filename"].lower()
    df = pd.read_excel(io.BytesIO(content)) if fname.endswith((".xlsx", ".xls")) else pd.read_csv(io.BytesIO(content))
    return {"columns": df.columns.tolist(), "rows": df.head(rows).to_dict(orient="records")}


async def delete_dataset(dataset_id: str) -> bool:
    db = get_db()
    doc = await db.datasets.find_one({"_id": ObjectId(dataset_id)})
    if not doc:
        return False
    fs = get_gridfs()
    if doc.get("gridfs_file_id"):
        try:
            await fs.delete(ObjectId(doc["gridfs_file_id"]))
        except Exception:
            pass
    await db.traffic_observations.delete_many({"dataset_id": dataset_id})
    await db.datasets.delete_one({"_id": ObjectId(dataset_id)})
    return True


def _s(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc
