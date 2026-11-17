from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.mongo import connect, disconnect
from app.core.socket_manager import sio, start_ticker, stop_ticker
from app.api.routes import (
    junctions, datasets, explore, features,
    models, forecasts, dashboard, reports,
)

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    start_ticker()
    yield
    stop_ticker()
    await disconnect()


settings = get_settings()

fastapi_app = FastAPI(
    title="JunctionFlow AI",
    description="Smart Intersection Traffic Forecasting & Congestion Intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
fastapi_app.include_router(junctions.router, prefix=API_PREFIX)
fastapi_app.include_router(datasets.router, prefix=API_PREFIX)
fastapi_app.include_router(explore.router, prefix=API_PREFIX)
fastapi_app.include_router(features.router, prefix=API_PREFIX)
fastapi_app.include_router(models.router, prefix=API_PREFIX)
fastapi_app.include_router(forecasts.router, prefix=API_PREFIX)
fastapi_app.include_router(dashboard.router, prefix=API_PREFIX)
fastapi_app.include_router(reports.router, prefix=API_PREFIX)


@fastapi_app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# Mount Socket.IO on ASGI application
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")
# Proxy router for compatibility with test runners or direct references
app.router = fastapi_app.router
