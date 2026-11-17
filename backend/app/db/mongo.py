import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pymongo import ASCENDING, DESCENDING, IndexModel
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("MongoDB client not initialised — call connect() first")
    return _client


def get_db():
    return get_client()[get_settings().mongo_db]


def get_gridfs() -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(get_db(), bucket_name="files")


async def connect() -> None:
    global _client
    settings = get_settings()
    logger.info("Connecting to MongoDB …")
    _client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    await _client.admin.command("ping")
    logger.info("MongoDB connected ✓")
    await _create_indexes()


async def disconnect() -> None:
    global _client
    if _client:
        _client.close()
        _client = None
        logger.info("MongoDB disconnected")


async def _create_indexes() -> None:
    db = get_db()

    await db.junctions.create_indexes([
        IndexModel([("junction_id", ASCENDING)], unique=True),
    ])

    await db.datasets.create_indexes([
        IndexModel([("created_at", DESCENDING)]),
        IndexModel([("status", ASCENDING)]),
    ])

    await db.traffic_observations.create_indexes([
        IndexModel(
            [("dataset_id", ASCENDING), ("junction_id", ASCENDING), ("timestamp", ASCENDING)],
            unique=True,
            name="obs_unique",
        ),
        IndexModel([("junction_id", ASCENDING), ("timestamp", ASCENDING)]),
    ])

    await db.feature_sets.create_indexes([
        IndexModel([("dataset_id", ASCENDING)]),
    ])

    await db.models.create_indexes([
        IndexModel([("junction_id", ASCENDING), ("algorithm", ASCENDING)]),
        IndexModel([("status", ASCENDING)]),
        IndexModel([("is_active", ASCENDING)]),
    ])

    await db.forecasts.create_indexes([
        IndexModel([("model_id", ASCENDING), ("generated_at", DESCENDING)]),
        IndexModel([("junction_id", ASCENDING), ("generated_at", DESCENDING)]),
    ])

    await db.audit_logs.create_indexes([
        IndexModel([("timestamp", DESCENDING)]),
        IndexModel([("entity", ASCENDING), ("entity_id", ASCENDING)]),
    ])

    logger.info("MongoDB indexes ensured ✓")
