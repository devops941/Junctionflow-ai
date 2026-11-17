import asyncio
import logging
from datetime import datetime, timezone
import socketio

logger = logging.getLogger(__name__)

# Socket.IO Async Server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

_ticker_task: asyncio.Task | None = None
_connected_clients: set[str] = set()


@sio.event
async def connect(sid, environ):
    _connected_clients.add(sid)
    logger.info(f"Socket.IO client connected: {sid} (total: {len(_connected_clients)})")
    
    # Send immediate initial state
    try:
        from app.services.dashboard_service import get_live_congestion, get_summary, get_congestion_alerts
        live = await get_live_congestion()
        summary = await get_summary()
        alerts = await get_congestion_alerts(hours_ahead=24)
        await sio.emit("dashboard:init", {
            "live": live,
            "summary": summary,
            "alerts": alerts,
            "server_time": datetime.now(timezone.utc).isoformat(),
        }, to=sid)
    except Exception as exc:
        logger.warning(f"Failed to send init state to {sid}: {exc}")


@sio.event
async def disconnect(sid):
    _connected_clients.discard(sid)
    logger.info(f"Socket.IO client disconnected: {sid} (total: {len(_connected_clients)})")


@sio.event
async def request_dashboard_refresh(sid, data=None):
    """Client requested immediate re-sync."""
    try:
        from app.services.dashboard_service import get_live_congestion, get_summary, get_congestion_alerts
        live = await get_live_congestion()
        summary = await get_summary()
        alerts = await get_congestion_alerts(hours_ahead=24)
        await sio.emit("dashboard:update", {
            "live": live,
            "summary": summary,
            "alerts": alerts,
            "server_time": datetime.now(timezone.utc).isoformat(),
        }, to=sid)
    except Exception as exc:
        logger.warning(f"Failed to process refresh for {sid}: {exc}")


async def broadcast_refresh():
    """Notify all connected clients to invalidate caches and reload data."""
    if not _connected_clients:
        return
    try:
        from app.services.dashboard_service import get_live_congestion, get_summary, get_congestion_alerts
        live = await get_live_congestion()
        summary = await get_summary()
        alerts = await get_congestion_alerts(hours_ahead=24)
        await sio.emit("dashboard:update", {
            "live": live,
            "summary": summary,
            "alerts": alerts,
            "server_time": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.warning(f"Error broadcasting dashboard refresh: {exc}")


async def _telemetry_ticker_loop():
    """Background pulse that streams live junction telemetry every 6 seconds."""
    logger.info("Realtime Socket.IO telemetry ticker started")
    import random
    
    while True:
        try:
            await asyncio.sleep(6)
            if not _connected_clients:
                continue

            from app.services.dashboard_service import get_live_congestion
            live = await get_live_congestion()
            if not live:
                continue

            # Add subtle dynamic fluctuation (+/- 1-3 vehicles) to simulate live camera detection stream
            for item in live:
                noise = random.randint(-2, 3)
                item["predicted"] = max(0, item["predicted"] + noise)
                cap = item.get("capacity")
                if cap and cap > 0:
                    item["ratio"] = round(item["predicted"] / cap, 2)

            await sio.emit("dashboard:telemetry_pulse", {
                "live": live,
                "server_time": datetime.now(timezone.utc).isoformat(),
            })
        except asyncio.CancelledError:
            logger.info("Realtime telemetry ticker stopped")
            break
        except Exception as exc:
            logger.warning(f"Ticker loop error: {exc}")
            await asyncio.sleep(5)


def start_ticker():
    global _ticker_task
    if _ticker_task is None or _ticker_task.done():
        _ticker_task = asyncio.create_task(_telemetry_ticker_loop())


def stop_ticker():
    global _ticker_task
    if _ticker_task and not _ticker_task.done():
        _ticker_task.cancel()
        _ticker_task = None
