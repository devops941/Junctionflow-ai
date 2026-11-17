import pytest
from httpx import AsyncClient, ASGITransport
from contextlib import asynccontextmanager


@pytest.mark.asyncio
async def test_health_endpoint(monkeypatch):
    from app.main import app

    @asynccontextmanager
    async def empty_lifespan(app):
        yield

    monkeypatch.setattr(app.router, "lifespan_context", empty_lifespan)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
