from datetime import datetime
from app.db.mongo import get_db
from app.models.junction import JunctionCreate, JunctionUpdate
import math


async def list_junctions(page: int, page_size: int) -> dict:
    db = get_db()
    skip = (page - 1) * page_size
    total = await db.junctions.count_documents({})
    cursor = db.junctions.find({}).skip(skip).limit(page_size)
    items = [_serialize(doc) async for doc in cursor]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 1,
    }


async def create_junction(body: JunctionCreate) -> dict:
    db = get_db()
    doc = body.model_dump()
    doc["created_at"] = datetime.utcnow()
    result = await db.junctions.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def get_junction(junction_id: str) -> dict | None:
    db = get_db()
    doc = await db.junctions.find_one({"junction_id": junction_id})
    return _serialize(doc) if doc else None


async def update_junction(junction_id: str, body: JunctionUpdate) -> dict | None:
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return await get_junction(junction_id)
    result = await db.junctions.find_one_and_update(
        {"junction_id": junction_id},
        {"$set": updates},
        return_document=True,
    )
    return _serialize(result) if result else None


async def delete_junction(junction_id: str) -> bool:
    db = get_db()
    result = await db.junctions.delete_one({"junction_id": junction_id})
    return result.deleted_count > 0


def _serialize(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc
