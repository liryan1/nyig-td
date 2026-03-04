"""Tests for handicap API endpoint."""

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
async def test_even_game(client: AsyncClient) -> None:
    """Test handicap for equal ranks."""
    response = await client.post("/handicap", json={
        "white_rank": "3d",
        "black_rank": "3d",
    })
    assert response.status_code == 200

    data = response.json()
    assert data["stones"] == 0
    assert data["komi"] == 7.5


@pytest.mark.anyio
async def test_handicap_game(client: AsyncClient) -> None:
    """Test handicap for different ranks."""
    response = await client.post("/handicap", json={
        "white_rank": "3d",
        "black_rank": "1k",
    })
    assert response.status_code == 200

    data = response.json()
    assert data["stones"] == 3  # 3d vs 1k = 3 stones
    assert data["komi"] == 0.5


@pytest.mark.anyio
async def test_handicap_with_modifier(client: AsyncClient) -> None:
    """Test handicap modifier."""
    response = await client.post("/handicap", json={
        "white_rank": "3d",
        "black_rank": "1k",
        "handicap_type": "rank_difference",
        "handicap_modifier": "minus_2",
    })
    assert response.status_code == 200

    data = response.json()
    assert data["stones"] == 0  # 3 - 2 = 1, but 1 stone becomes reverse komi


@pytest.mark.anyio
async def test_invalid_rank_format(client: AsyncClient) -> None:
    """Test validation error for invalid rank format."""
    response = await client.post("/handicap", json={
        "white_rank": "invalid",
        "black_rank": "3d",
    })
    assert response.status_code == 422  # Pydantic validation error
