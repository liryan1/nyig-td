"""Tests for standings API endpoint."""

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


# =============================================================================
# Basic Standings Tests
# =============================================================================


@pytest.mark.anyio
async def test_calculate_standings(client: AsyncClient) -> None:
    """Test standings calculation."""
    request = {
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                ],
                "byes": [],
            }
        ],
    }

    response = await client.post("/standings", json=request)
    assert response.status_code == 200

    data = response.json()
    assert len(data["standings"]) == 2
    # Alice won, should be rank 1
    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    assert alice["rank"] == 1
    assert alice["wins"] == 1.0


@pytest.mark.anyio
async def test_custom_weights(client: AsyncClient) -> None:
    """Test standings with custom weights."""
    request = {
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                ],
            }
        ],
        "weights": {
            "wins": 2.0,
            "sos": 0.5,
            "sodos": 0.0,
            "extended_sos": 0.0,
        },
    }

    response = await client.post("/standings", json=request)
    assert response.status_code == 200

    data = response.json()
    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    # 2.0 * 1 win = 2.0 base score
    assert alice["total_score"] >= 2.0


@pytest.mark.anyio
async def test_standings_with_byes(client: AsyncClient) -> None:
    """Test standings with bye assignments."""
    request = {
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                ],
                "byes": [{"player_id": "3", "points": 1.0}],
            }
        ],
    }

    response = await client.post("/standings", json=request)
    assert response.status_code == 200

    data = response.json()
    assert len(data["standings"]) == 3
    # Carol has a bye, should have 1 win
    carol = next(s for s in data["standings"] if s["player_id"] == "3")
    assert carol["wins"] == 1.0


# =============================================================================
# All Game Result Types
# =============================================================================


@pytest.mark.anyio
async def test_black_win_result(client: AsyncClient) -> None:
    """Test black win result."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": [{
            "number": 1,
            "pairings": [
                {"black_player_id": "1", "white_player_id": "2", "result": "B+"},
            ],
        }],
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    bob = next(s for s in data["standings"] if s["player_id"] == "2")

    assert alice["wins"] == 1.0
    assert alice["losses"] == 0.0
    assert bob["wins"] == 0.0
    assert bob["losses"] == 1.0


@pytest.mark.anyio
async def test_white_win_result(client: AsyncClient) -> None:
    """Test white win result."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": [{
            "number": 1,
            "pairings": [
                {"black_player_id": "1", "white_player_id": "2", "result": "W+"},
            ],
        }],
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    bob = next(s for s in data["standings"] if s["player_id"] == "2")

    assert alice["wins"] == 0.0
    assert alice["losses"] == 1.0
    assert bob["wins"] == 1.0
    assert bob["losses"] == 0.0


@pytest.mark.anyio
async def test_draw_result(client: AsyncClient) -> None:
    """Test draw awards 0.5 points to each player."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "3d"},
        ],
        "rounds": [{
            "number": 1,
            "pairings": [
                {"black_player_id": "1", "white_player_id": "2", "result": "Draw"},
            ],
        }],
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    bob = next(s for s in data["standings"] if s["player_id"] == "2")

    # Draw gives 0.5 wins but no loss counted
    assert alice["wins"] == 0.5
    assert alice["losses"] == 0.0
    assert bob["wins"] == 0.5
    assert bob["losses"] == 0.0


@pytest.mark.anyio
async def test_both_lose_result(client: AsyncClient) -> None:
    """Test both-lose (double forfeit) awards 0 points to each."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "3d"},
        ],
        "rounds": [{
            "number": 1,
            "pairings": [
                {"black_player_id": "1", "white_player_id": "2", "result": "BL"},
            ],
        }],
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    bob = next(s for s in data["standings"] if s["player_id"] == "2")

    assert alice["wins"] == 0.0
    assert alice["losses"] == 1.0
    assert bob["wins"] == 0.0
    assert bob["losses"] == 1.0


@pytest.mark.anyio
async def test_black_forfeit_win(client: AsyncClient) -> None:
    """Test black forfeit win result."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": [{
            "number": 1,
            "pairings": [
                {"black_player_id": "1", "white_player_id": "2", "result": "B+F"},
            ],
        }],
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    bob = next(s for s in data["standings"] if s["player_id"] == "2")

    assert alice["wins"] == 1.0
    assert bob["losses"] == 1.0


@pytest.mark.anyio
async def test_white_forfeit_win(client: AsyncClient) -> None:
    """Test white forfeit win result."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": [{
            "number": 1,
            "pairings": [
                {"black_player_id": "1", "white_player_id": "2", "result": "W+F"},
            ],
        }],
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    bob = next(s for s in data["standings"] if s["player_id"] == "2")

    assert alice["losses"] == 1.0
    assert bob["wins"] == 1.0


@pytest.mark.anyio
async def test_no_result(client: AsyncClient) -> None:
    """Test no-result game awards no points."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "3d"},
        ],
        "rounds": [{
            "number": 1,
            "pairings": [
                {"black_player_id": "1", "white_player_id": "2", "result": "NR"},
            ],
        }],
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    bob = next(s for s in data["standings"] if s["player_id"] == "2")

    # No result should give 0 wins, 0 losses
    assert alice["wins"] == 0.0
    assert bob["wins"] == 0.0


# =============================================================================
# Multi-Round Tournament Scenarios
# =============================================================================


@pytest.mark.anyio
async def test_multi_round_standings(client: AsyncClient) -> None:
    """Test standings across multiple rounds."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
            {"id": "4", "name": "Dave", "rank": "1k"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},  # Alice wins
                    {"black_player_id": "4", "white_player_id": "3", "result": "W+"},  # Carol wins
                ],
            },
            {
                "number": 2,
                "pairings": [
                    {"black_player_id": "3", "white_player_id": "1", "result": "W+"},  # Alice wins
                    {"black_player_id": "4", "white_player_id": "2", "result": "B+"},  # Dave wins
                ],
            },
        ],
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    carol = next(s for s in data["standings"] if s["player_id"] == "3")
    dave = next(s for s in data["standings"] if s["player_id"] == "4")

    # Alice: 2 wins, 0 losses
    assert alice["wins"] == 2.0
    assert alice["losses"] == 0.0
    assert alice["rank"] == 1

    # Carol and Dave: 1 win, 1 loss each
    assert carol["wins"] == 1.0
    assert dave["wins"] == 1.0


@pytest.mark.anyio
async def test_full_tournament_standings_8_players_3_rounds(client: AsyncClient) -> None:
    """Test standings for a full 8-player, 3-round tournament."""
    players = [
        {"id": "1", "name": "Alice", "rank": "4d"},
        {"id": "2", "name": "Bob", "rank": "3d"},
        {"id": "3", "name": "Carol", "rank": "2d"},
        {"id": "4", "name": "Dave", "rank": "1d"},
        {"id": "5", "name": "Eve", "rank": "1k"},
        {"id": "6", "name": "Frank", "rank": "2k"},
        {"id": "7", "name": "Grace", "rank": "3k"},
        {"id": "8", "name": "Henry", "rank": "5k"},
    ]

    rounds = [
        {
            "number": 1,
            "pairings": [
                {"black_player_id": "2", "white_player_id": "1", "result": "W+"},  # Alice wins
                {"black_player_id": "4", "white_player_id": "3", "result": "W+"},  # Carol wins
                {"black_player_id": "6", "white_player_id": "5", "result": "W+"},  # Eve wins
                {"black_player_id": "8", "white_player_id": "7", "result": "W+"},  # Grace wins
            ],
        },
        {
            "number": 2,
            "pairings": [
                {"black_player_id": "3", "white_player_id": "1", "result": "W+"},  # Alice wins
                {"black_player_id": "7", "white_player_id": "5", "result": "W+"},  # Eve wins
                {"black_player_id": "4", "white_player_id": "2", "result": "B+"},  # Dave wins
                {"black_player_id": "8", "white_player_id": "6", "result": "B+"},  # Henry wins
            ],
        },
        {
            "number": 3,
            "pairings": [
                {"black_player_id": "5", "white_player_id": "1", "result": "W+"},  # Alice 3-0
                {"black_player_id": "3", "white_player_id": "4", "result": "B+"},  # Carol wins
                {"black_player_id": "7", "white_player_id": "2", "result": "W+"},  # Bob wins
                {"black_player_id": "6", "white_player_id": "8", "result": "B+"},  # Frank wins
            ],
        },
    ]

    response = await client.post("/standings", json={
        "players": players,
        "rounds": rounds,
    })
    assert response.status_code == 200
    data = response.json()

    # Verify all 8 players in standings
    assert len(data["standings"]) == 8

    # Alice should be #1 with 3-0
    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    assert alice["wins"] == 3.0
    assert alice["losses"] == 0.0
    assert alice["rank"] == 1

    # Total wins should equal total losses (12 games = 12 wins, 12 losses)
    total_wins = sum(s["wins"] for s in data["standings"])
    total_losses = sum(s["losses"] for s in data["standings"])
    assert total_wins == 12.0
    assert total_losses == 12.0


# =============================================================================
# Tiebreaker Tests
# =============================================================================


@pytest.mark.anyio
async def test_sos_tiebreaker(client: AsyncClient) -> None:
    """Test SOS (Sum of Opponents' Scores) tiebreaker."""
    # Scenario: Alice and Carol both 2-0, but Alice's opponents did better
    players = [
        {"id": "1", "name": "Alice", "rank": "3d"},
        {"id": "2", "name": "Bob", "rank": "3d"},
        {"id": "3", "name": "Carol", "rank": "3d"},
        {"id": "4", "name": "Dave", "rank": "3d"},
    ]

    rounds = [
        {
            "number": 1,
            "pairings": [
                {"black_player_id": "2", "white_player_id": "1", "result": "W+"},  # Alice beats Bob
                {"black_player_id": "4", "white_player_id": "3", "result": "W+"},  # Carol beats Dave
            ],
        },
        {
            "number": 2,
            "pairings": [
                {"black_player_id": "3", "white_player_id": "1", "result": "W+"},  # Alice beats Carol
                {"black_player_id": "4", "white_player_id": "2", "result": "W+"},  # Bob beats Dave
            ],
        },
    ]

    response = await client.post("/standings", json={
        "players": players,
        "rounds": rounds,
        "weights": {"wins": 1.0, "sos": 0.1, "sodos": 0.0, "extended_sos": 0.0},
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    carol = next(s for s in data["standings"] if s["player_id"] == "3")

    # Alice 2-0, Carol 1-1
    assert alice["wins"] == 2.0
    assert carol["wins"] == 1.0
    assert alice["rank"] == 1


@pytest.mark.anyio
async def test_sodos_tiebreaker(client: AsyncClient) -> None:
    """Test SODOS (Sum of Defeated Opponents' Scores) tiebreaker."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "3d"},
            {"id": "3", "name": "Carol", "rank": "3d"},
            {"id": "4", "name": "Dave", "rank": "3d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                    {"black_player_id": "4", "white_player_id": "3", "result": "W+"},
                ],
            },
        ],
        "weights": {"wins": 1.0, "sos": 0.1, "sodos": 0.05, "extended_sos": 0.0},
    })
    assert response.status_code == 200
    data = response.json()

    # Check that SODOS is calculated
    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    assert "sodos" in alice


@pytest.mark.anyio
async def test_extended_sos_tiebreaker(client: AsyncClient) -> None:
    """Test extended SOS (sum of opponents' SOS) tiebreaker."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "3d"},
            {"id": "3", "name": "Carol", "rank": "3d"},
            {"id": "4", "name": "Dave", "rank": "3d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                    {"black_player_id": "4", "white_player_id": "3", "result": "W+"},
                ],
            },
            {
                "number": 2,
                "pairings": [
                    {"black_player_id": "3", "white_player_id": "1", "result": "W+"},
                    {"black_player_id": "4", "white_player_id": "2", "result": "W+"},
                ],
            },
        ],
        "weights": {"wins": 1.0, "sos": 0.1, "sodos": 0.05, "extended_sos": 0.01},
    })
    assert response.status_code == 200
    data = response.json()

    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    assert "extended_sos" in alice
    assert alice["extended_sos"] >= 0


@pytest.mark.anyio
async def test_ties_share_same_rank(client: AsyncClient) -> None:
    """Test that players with identical scores share the same rank."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "3d"},
            {"id": "3", "name": "Carol", "rank": "3d"},
            {"id": "4", "name": "Dave", "rank": "3d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "1", "white_player_id": "2", "result": "B+"},  # Alice wins
                    {"black_player_id": "3", "white_player_id": "4", "result": "B+"},  # Carol wins
                ],
            },
        ],
        # Use only wins weight for cleaner tie test
        "weights": {"wins": 1.0, "sos": 0.0, "sodos": 0.0, "extended_sos": 0.0},
    })
    assert response.status_code == 200
    data = response.json()

    winners = [s for s in data["standings"] if s["wins"] == 1.0]
    assert len(winners) == 2

    # Both winners should have rank 1
    assert all(w["rank"] == 1 for w in winners)


# =============================================================================
# Through-Round Filtering
# =============================================================================


@pytest.mark.anyio
async def test_through_round_filtering(client: AsyncClient) -> None:
    """Test standings calculation through specific round."""
    rounds = [
        {
            "number": 1,
            "pairings": [
                {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
            ],
        },
        {
            "number": 2,
            "pairings": [
                {"black_player_id": "1", "white_player_id": "2", "result": "B+"},
            ],
        },
    ]

    # Through round 1 only
    r1_response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": rounds,
        "through_round": 1,
    })
    assert r1_response.status_code == 200
    r1_data = r1_response.json()

    alice_r1 = next(s for s in r1_data["standings"] if s["player_id"] == "1")
    assert alice_r1["wins"] == 1.0  # Only round 1

    # Through round 2 (all rounds)
    r2_response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": rounds,
        "through_round": 2,
    })
    assert r2_response.status_code == 200
    r2_data = r2_response.json()

    alice_r2 = next(s for s in r2_data["standings"] if s["player_id"] == "1")
    assert alice_r2["wins"] == 2.0  # Both rounds


# =============================================================================
# Bye Handling
# =============================================================================


@pytest.mark.anyio
async def test_bye_full_point(client: AsyncClient) -> None:
    """Test full-point bye counts as 1 win."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                ],
                "byes": [{"player_id": "3", "points": 1.0}],
            },
        ],
    })
    assert response.status_code == 200
    data = response.json()

    carol = next(s for s in data["standings"] if s["player_id"] == "3")
    assert carol["wins"] == 1.0


@pytest.mark.anyio
async def test_bye_half_point(client: AsyncClient) -> None:
    """Test half-point bye counts as 0.5 wins."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                ],
                "byes": [{"player_id": "3", "points": 0.5}],
            },
        ],
    })
    assert response.status_code == 200
    data = response.json()

    carol = next(s for s in data["standings"] if s["player_id"] == "3")
    assert carol["wins"] == 0.5


@pytest.mark.anyio
async def test_bye_zero_point(client: AsyncClient) -> None:
    """Test zero-point bye (withdrawal) counts as 0 wins."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                ],
                "byes": [{"player_id": "3", "points": 0.0}],
            },
        ],
    })
    assert response.status_code == 200
    data = response.json()

    carol = next(s for s in data["standings"] if s["player_id"] == "3")
    assert carol["wins"] == 0.0


# =============================================================================
# Edge Cases
# =============================================================================


@pytest.mark.anyio
async def test_empty_rounds_list(client: AsyncClient) -> None:
    """Test standings with empty rounds list."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": [],
    })
    assert response.status_code == 200
    data = response.json()

    # All players should have 0 wins/losses
    for standing in data["standings"]:
        assert standing["wins"] == 0.0
        assert standing["losses"] == 0.0


@pytest.mark.anyio
async def test_two_player_standings(client: AsyncClient) -> None:
    """Test minimum tournament with 2 players."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                ],
            },
        ],
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["standings"]) == 2


@pytest.mark.anyio
async def test_large_tournament_standings(client: AsyncClient) -> None:
    """Test standings for large tournament (16 players)."""
    players = [
        {"id": str(i), "name": f"Player{i}", "rank": f"{(i % 9) + 1}k"}
        for i in range(1, 17)
    ]

    # Generate round 1 pairings (8 games)
    round1_pairings = [
        {"black_player_id": str(i * 2), "white_player_id": str(i * 2 - 1), "result": "W+"}
        for i in range(1, 9)
    ]

    response = await client.post("/standings", json={
        "players": players,
        "rounds": [{"number": 1, "pairings": round1_pairings}],
    })
    assert response.status_code == 200
    data = response.json()

    assert len(data["standings"]) == 16
    # 8 winners, 8 losers
    winners = [s for s in data["standings"] if s["wins"] == 1.0]
    losers = [s for s in data["standings"] if s["losses"] == 1.0]
    assert len(winners) == 8
    assert len(losers) == 8


@pytest.mark.anyio
async def test_standings_response_includes_all_fields(client: AsyncClient) -> None:
    """Test that standings response includes all expected fields."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "Alice Chen", "rank": "3d"},
            {"id": "2", "name": "Bob Smith", "rank": "2d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                ],
            },
        ],
    })
    assert response.status_code == 200
    data = response.json()

    standing = data["standings"][0]

    # Verify all required fields
    assert "rank" in standing
    assert "player_id" in standing
    assert "player_name" in standing
    assert "player_rank" in standing
    assert "wins" in standing
    assert "losses" in standing
    assert "sos" in standing
    assert "sodos" in standing
    assert "extended_sos" in standing
    assert "total_score" in standing

    # Verify player info
    alice = next(s for s in data["standings"] if s["player_id"] == "1")
    assert alice["player_name"] == "Alice Chen"
    assert alice["player_rank"] == "3d"


@pytest.mark.anyio
async def test_mixed_results_comprehensive(client: AsyncClient) -> None:
    """Test standings with all result types in same tournament."""
    response = await client.post("/standings", json={
        "players": [
            {"id": "1", "name": "P1", "rank": "3d"},
            {"id": "2", "name": "P2", "rank": "3d"},
            {"id": "3", "name": "P3", "rank": "3d"},
            {"id": "4", "name": "P4", "rank": "3d"},
            {"id": "5", "name": "P5", "rank": "3d"},
            {"id": "6", "name": "P6", "rank": "3d"},
        ],
        "rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "1", "white_player_id": "2", "result": "B+"},    # P1 wins
                    {"black_player_id": "3", "white_player_id": "4", "result": "Draw"},  # 0.5 each
                    {"black_player_id": "5", "white_player_id": "6", "result": "BL"},    # Both lose
                ],
            },
        ],
    })
    assert response.status_code == 200
    data = response.json()

    p1 = next(s for s in data["standings"] if s["player_id"] == "1")
    p2 = next(s for s in data["standings"] if s["player_id"] == "2")
    p3 = next(s for s in data["standings"] if s["player_id"] == "3")
    p4 = next(s for s in data["standings"] if s["player_id"] == "4")
    p5 = next(s for s in data["standings"] if s["player_id"] == "5")
    p6 = next(s for s in data["standings"] if s["player_id"] == "6")

    assert p1["wins"] == 1.0
    assert p2["wins"] == 0.0
    assert p3["wins"] == 0.5
    assert p4["wins"] == 0.5
    assert p5["wins"] == 0.0
    assert p6["wins"] == 0.0
    assert p5["losses"] == 1.0
    assert p6["losses"] == 1.0
