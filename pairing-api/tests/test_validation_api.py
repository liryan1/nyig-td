"""Tests for validation API endpoint."""

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
async def test_validate_valid_ranks(client: AsyncClient) -> None:
    """Test validation of valid ranks."""
    response = await client.post("/validate/ranks", json={
        "ranks": ["5k", "3d", "1K", "9D"],
    })
    assert response.status_code == 200

    data = response.json()
    assert data["all_valid"] is True
    assert all(r["valid"] for r in data["results"])


@pytest.mark.anyio
async def test_validate_invalid_ranks(client: AsyncClient) -> None:
    """Test validation of invalid ranks."""
    response = await client.post("/validate/ranks", json={
        "ranks": ["5k", "invalid", "0k"],
    })
    assert response.status_code == 200

    data = response.json()
    assert data["all_valid"] is False
    assert data["results"][0]["valid"] is True
    assert data["results"][1]["valid"] is False
    assert data["results"][2]["valid"] is False


@pytest.mark.anyio
async def test_rank_normalization(client: AsyncClient) -> None:
    """Test rank normalization."""
    response = await client.post("/validate/ranks", json={
        "ranks": ["5K", "3D"],
    })
    assert response.status_code == 200

    data = response.json()
    assert data["results"][0]["normalized"] == "5k"
    assert data["results"][1]["normalized"] == "3d"
