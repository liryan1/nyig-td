"""Tests for health check endpoint."""

import pytest
from httpx import AsyncClient, ASGITransport

from nyig_td_api.main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.anyio
async def test_health_check(client: AsyncClient) -> None:
    """Test health endpoint returns 200 with correct response."""
    response = await client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.1.0"


@pytest.mark.anyio
async def test_root_endpoint(client: AsyncClient) -> None:
    """Test root endpoint returns API info."""
    response = await client.get("/")
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "pairing-api"
    assert data["version"] == "0.1.0"
    assert data["docs"] == "/docs"
