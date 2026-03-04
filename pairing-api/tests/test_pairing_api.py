"""Tests for pairing API endpoint."""

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
# Basic Pairing Tests
# =============================================================================


@pytest.mark.anyio
async def test_generate_swiss_pairings(client: AsyncClient) -> None:
    """Test Swiss pairing generation."""
    request = {
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
            {"id": "4", "name": "Dave", "rank": "1k"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
    }

    response = await client.post("/pair", json=request)
    assert response.status_code == 200

    data = response.json()
    assert len(data["pairings"]) == 2
    assert len(data["byes"]) == 0


@pytest.mark.anyio
async def test_generate_mcmahon_pairings(client: AsyncClient) -> None:
    """Test McMahon pairing generation."""
    request = {
        "players": [
            {"id": "1", "name": "Alice", "rank": "4d"},
            {"id": "2", "name": "Bob", "rank": "3d"},
            {"id": "3", "name": "Carol", "rank": "2d"},
            {"id": "4", "name": "Dave", "rank": "1d"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "mcmahon",
        "mcmahon_bar": "3d",
        "handicap_type": "rank_difference",
    }

    response = await client.post("/pair", json=request)
    assert response.status_code == 200

    data = response.json()
    assert len(data["pairings"]) == 2


@pytest.mark.anyio
async def test_bye_for_odd_players(client: AsyncClient) -> None:
    """Test bye assignment for odd number of players."""
    request = {
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
    }

    response = await client.post("/pair", json=request)
    assert response.status_code == 200

    data = response.json()
    assert len(data["pairings"]) == 1
    assert len(data["byes"]) == 1


@pytest.mark.anyio
async def test_pairing_with_previous_rounds(client: AsyncClient) -> None:
    """Test pairing avoids repeat opponents."""
    request = {
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
            {"id": "4", "name": "Dave", "rank": "1k"},
        ],
        "previous_rounds": [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
                    {"black_player_id": "4", "white_player_id": "3", "result": "W+"},
                ],
                "byes": [],
            }
        ],
        "round_number": 2,
        "algorithm": "swiss",
    }

    response = await client.post("/pair", json=request)
    assert response.status_code == 200

    data = response.json()
    # Verify Alice doesn't play Bob again, Carol doesn't play Dave
    for pairing in data["pairings"]:
        pair = {pairing["black_player_id"], pairing["white_player_id"]}
        assert pair != {"1", "2"}
        assert pair != {"3", "4"}


@pytest.mark.anyio
async def test_invalid_rank(client: AsyncClient) -> None:
    """Test error on invalid rank."""
    request = {
        "players": [
            {"id": "1", "name": "Alice", "rank": "invalid"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
    }

    response = await client.post("/pair", json=request)
    assert response.status_code == 422  # Validation error


@pytest.mark.anyio
async def test_pairings_include_handicaps(client: AsyncClient) -> None:
    """Test that pairings include handicap information."""
    request = {
        "players": [
            {"id": "1", "name": "Alice", "rank": "5d"},
            {"id": "2", "name": "Bob", "rank": "1k"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
    }

    response = await client.post("/pair", json=request)
    assert response.status_code == 200

    data = response.json()
    assert len(data["pairings"]) == 1
    pairing = data["pairings"][0]
    # Should have handicap stones for 5d vs 1k
    assert "handicap_stones" in pairing
    assert "komi" in pairing
    assert pairing["handicap_stones"] > 0


# =============================================================================
# Real Tournament Scenarios - Multi-Round Swiss
# =============================================================================


@pytest.mark.anyio
async def test_full_3_round_swiss_tournament(client: AsyncClient) -> None:
    """Simulate a complete 3-round Swiss tournament with 8 players."""
    players = [
        {"id": "1", "name": "Alice Chen", "rank": "4d"},
        {"id": "2", "name": "Bob Smith", "rank": "3d"},
        {"id": "3", "name": "Carol Wang", "rank": "2d"},
        {"id": "4", "name": "Dave Kim", "rank": "1d"},
        {"id": "5", "name": "Eve Johnson", "rank": "1k"},
        {"id": "6", "name": "Frank Lee", "rank": "3k"},
        {"id": "7", "name": "Grace Park", "rank": "5k"},
        {"id": "8", "name": "Henry Zhao", "rank": "8k"},
    ]

    # Round 1
    r1_response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
    })
    assert r1_response.status_code == 200
    r1_data = r1_response.json()
    assert len(r1_data["pairings"]) == 4
    assert len(r1_data["byes"]) == 0

    # Build round 1 results (top board white wins, alternating)
    r1_pairings = []
    for i, p in enumerate(r1_data["pairings"]):
        result = "W+" if i % 2 == 0 else "B+"
        r1_pairings.append({
            "black_player_id": p["black_player_id"],
            "white_player_id": p["white_player_id"],
            "result": result,
        })

    # Round 2
    r2_response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [{"number": 1, "pairings": r1_pairings, "byes": []}],
        "round_number": 2,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
    })
    assert r2_response.status_code == 200
    r2_data = r2_response.json()
    assert len(r2_data["pairings"]) == 4

    # Build round 2 results
    r2_pairings = []
    for i, p in enumerate(r2_data["pairings"]):
        result = "B+" if i % 2 == 0 else "W+"
        r2_pairings.append({
            "black_player_id": p["black_player_id"],
            "white_player_id": p["white_player_id"],
            "result": result,
        })

    # Round 3
    r3_response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [
            {"number": 1, "pairings": r1_pairings, "byes": []},
            {"number": 2, "pairings": r2_pairings, "byes": []},
        ],
        "round_number": 3,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
    })
    assert r3_response.status_code == 200
    r3_data = r3_response.json()
    assert len(r3_data["pairings"]) == 4

    # Verify no repeat pairings across all rounds
    all_pairs = set()
    for round_pairings in [r1_pairings, r2_pairings]:
        for p in round_pairings:
            pair = frozenset([p["black_player_id"], p["white_player_id"]])
            all_pairs.add(pair)

    for p in r3_data["pairings"]:
        pair = frozenset([p["black_player_id"], p["white_player_id"]])
        assert pair not in all_pairs, f"Repeat pairing found: {pair}"


@pytest.mark.anyio
async def test_swiss_repeat_pairing_forced_with_2_players(client: AsyncClient) -> None:
    """With only 2 players, round 2+ must repeat pairing and generate warning."""
    players = [
        {"id": "1", "name": "Alice", "rank": "3d"},
        {"id": "2", "name": "Bob", "rank": "2d"},
    ]

    # Round 1
    r1_response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
    })
    assert r1_response.status_code == 200
    r1_data = r1_response.json()
    assert len(r1_data["pairings"]) == 1

    # Round 2 - must repeat
    r2_response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [{
            "number": 1,
            "pairings": [{
                "black_player_id": r1_data["pairings"][0]["black_player_id"],
                "white_player_id": r1_data["pairings"][0]["white_player_id"],
                "result": "W+",
            }],
            "byes": [],
        }],
        "round_number": 2,
        "algorithm": "swiss",
    })
    assert r2_response.status_code == 200
    r2_data = r2_response.json()
    assert len(r2_data["pairings"]) == 1
    # Should have warning about repeat pairing
    assert any("Repeat" in w for w in r2_data["warnings"])


@pytest.mark.anyio
async def test_swiss_bye_rotates_with_odd_players(client: AsyncClient) -> None:
    """Test that bye goes to different player each round (lowest score without bye)."""
    players = [
        {"id": "1", "name": "Alice", "rank": "3d"},
        {"id": "2", "name": "Bob", "rank": "2d"},
        {"id": "3", "name": "Carol", "rank": "1d"},
    ]

    # Round 1 - someone gets bye
    r1_response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
    })
    assert r1_response.status_code == 200
    r1_data = r1_response.json()
    assert len(r1_data["byes"]) == 1
    r1_bye_player = r1_data["byes"][0]["player_id"]

    # Build round 1 with pairing result and bye
    r1_pairing = r1_data["pairings"][0]
    previous_r1 = {
        "number": 1,
        "pairings": [{
            "black_player_id": r1_pairing["black_player_id"],
            "white_player_id": r1_pairing["white_player_id"],
            "result": "W+",
        }],
        "byes": [{"player_id": r1_bye_player, "points": 1.0}],
    }

    # Round 2 - different player should get bye
    r2_response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [previous_r1],
        "round_number": 2,
        "algorithm": "swiss",
    })
    assert r2_response.status_code == 200
    r2_data = r2_response.json()
    assert len(r2_data["byes"]) == 1
    r2_bye_player = r2_data["byes"][0]["player_id"]

    # Bye should go to a different player
    assert r2_bye_player != r1_bye_player


# =============================================================================
# Real Tournament Scenarios - McMahon System
# =============================================================================


@pytest.mark.anyio
async def test_mcmahon_pairing_by_score_groups(client: AsyncClient) -> None:
    """Test McMahon pairs players within same score group first."""
    players = [
        {"id": "1", "name": "Strong1", "rank": "5d"},  # Above bar: score 0
        {"id": "2", "name": "Strong2", "rank": "4d"},  # Above bar: score 0
        {"id": "3", "name": "AtBar", "rank": "3d"},    # At bar: score 0
        {"id": "4", "name": "Below1", "rank": "1d"},   # Below bar: score -2
        {"id": "5", "name": "Below2", "rank": "1k"},   # Below bar: score -3
        {"id": "6", "name": "Below3", "rank": "2k"},   # Below bar: score -4
    ]

    response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "mcmahon",
        "mcmahon_bar": "3d",
        "handicap_type": "rank_difference",
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["pairings"]) == 3


@pytest.mark.anyio
async def test_mcmahon_score_progression_affects_round_2(client: AsyncClient) -> None:
    """Test that McMahon scores from round 1 affect round 2 pairings."""
    players = [
        {"id": "1", "name": "Alice", "rank": "3d"},  # Score 0
        {"id": "2", "name": "Bob", "rank": "3d"},    # Score 0
        {"id": "3", "name": "Carol", "rank": "1k"},  # Score -3
        {"id": "4", "name": "Dave", "rank": "1k"},   # Score -3
    ]

    # Round 1: Assume Alice beats Bob, Carol beats Dave
    r1_pairings = [
        {"black_player_id": "2", "white_player_id": "1", "result": "W+"},  # Alice wins
        {"black_player_id": "4", "white_player_id": "3", "result": "W+"},  # Carol wins
    ]

    response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [{"number": 1, "pairings": r1_pairings, "byes": []}],
        "round_number": 2,
        "algorithm": "mcmahon",
        "mcmahon_bar": "3d",
    })
    assert response.status_code == 200
    data = response.json()

    # After R1: Alice=1, Bob=0, Carol=-2, Dave=-3
    # Winners should play winners, losers play losers
    for pairing in data["pairings"]:
        pair = {pairing["black_player_id"], pairing["white_player_id"]}
        # Alice (1) should play Carol (-2) as closest scores
        # Bob (0) should play Dave (-3)
        if "1" in pair:
            assert "3" in pair, "Alice should play Carol (closest scores)"


@pytest.mark.anyio
async def test_mcmahon_with_custom_initial_score(client: AsyncClient) -> None:
    """Test player with custom initial McMahon score override."""
    players = [
        {"id": "1", "name": "Special", "rank": "5k", "initial_mcmahon_score": 0},  # Override
        {"id": "2", "name": "Regular", "rank": "3d"},  # At bar: 0
    ]

    response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "mcmahon",
        "mcmahon_bar": "3d",
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["pairings"]) == 1


@pytest.mark.anyio
async def test_mcmahon_odd_players_bye_to_lowest(client: AsyncClient) -> None:
    """Test McMahon gives bye to lowest McMahon score player."""
    players = [
        {"id": "1", "name": "Strong", "rank": "5d"},   # Score 0
        {"id": "2", "name": "Medium", "rank": "3d"},   # Score 0
        {"id": "3", "name": "Weak", "rank": "5k"},     # Score -7 (lowest)
    ]

    response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "mcmahon",
        "mcmahon_bar": "3d",
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["byes"]) == 1
    # Weak (5k, score -7) should get bye
    assert data["byes"][0]["player_id"] == "3"


# =============================================================================
# Handicap Configuration Tests
# =============================================================================


@pytest.mark.anyio
async def test_handicap_disabled_even_games(client: AsyncClient) -> None:
    """Test all games are even when handicap is disabled."""
    request = {
        "players": [
            {"id": "1", "name": "Strong", "rank": "5d"},
            {"id": "2", "name": "Weak", "rank": "10k"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "none",
    }

    response = await client.post("/pair", json=request)
    assert response.status_code == 200

    data = response.json()
    pairing = data["pairings"][0]
    assert pairing["handicap_stones"] == 0
    assert pairing["komi"] == 7.5


@pytest.mark.anyio
async def test_handicap_reduction(client: AsyncClient) -> None:
    """Test handicap reduction reduces stones."""
    # Without modifier
    no_modifier = await client.post("/pair", json={
        "players": [
            {"id": "1", "name": "Strong", "rank": "5d"},
            {"id": "2", "name": "Weak", "rank": "1k"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
        "handicap_modifier": "none",
    })
    no_modifier_stones = no_modifier.json()["pairings"][0]["handicap_stones"]

    # With minus_2 modifier
    with_modifier = await client.post("/pair", json={
        "players": [
            {"id": "1", "name": "Strong", "rank": "5d"},
            {"id": "2", "name": "Weak", "rank": "1k"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
        "handicap_modifier": "minus_2",
    })
    with_modifier_stones = with_modifier.json()["pairings"][0]["handicap_stones"]

    # Modifier should decrease handicap stones
    assert with_modifier_stones < no_modifier_stones


@pytest.mark.anyio
async def test_color_assignment_stronger_player_white(client: AsyncClient) -> None:
    """Test stronger player gets white in handicap game."""
    response = await client.post("/pair", json={
        "players": [
            {"id": "1", "name": "Strong", "rank": "5d"},
            {"id": "2", "name": "Weak", "rank": "5k"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
    })
    assert response.status_code == 200
    data = response.json()
    pairing = data["pairings"][0]

    # Strong player (5d) should be white
    assert pairing["white_player_id"] == "1"
    assert pairing["black_player_id"] == "2"


# =============================================================================
# All Game Result Types
# =============================================================================


@pytest.mark.anyio
async def test_all_result_types_in_previous_rounds(client: AsyncClient) -> None:
    """Test handling all game result types in previous rounds."""
    players = [
        {"id": "1", "name": "P1", "rank": "3d"},
        {"id": "2", "name": "P2", "rank": "3d"},
        {"id": "3", "name": "P3", "rank": "3d"},
        {"id": "4", "name": "P4", "rank": "3d"},
        {"id": "5", "name": "P5", "rank": "3d"},
        {"id": "6", "name": "P6", "rank": "3d"},
        {"id": "7", "name": "P7", "rank": "3d"},
        {"id": "8", "name": "P8", "rank": "3d"},
    ]

    previous_rounds = [{
        "number": 1,
        "pairings": [
            {"black_player_id": "1", "white_player_id": "2", "result": "B+"},       # Black win
            {"black_player_id": "3", "white_player_id": "4", "result": "W+"},       # White win
            {"black_player_id": "5", "white_player_id": "6", "result": "B+F"},      # Black forfeit win
            {"black_player_id": "7", "white_player_id": "8", "result": "W+F"},      # White forfeit win
        ],
        "byes": [],
    }, {
        "number": 2,
        "pairings": [
            {"black_player_id": "1", "white_player_id": "4", "result": "Draw"},     # Draw
            {"black_player_id": "2", "white_player_id": "3", "result": "BL"},       # Both lose
            {"black_player_id": "5", "white_player_id": "8", "result": "NR"},       # No result
            {"black_player_id": "6", "white_player_id": "7", "result": "B+"},
        ],
        "byes": [],
    }]

    response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": previous_rounds,
        "round_number": 3,
        "algorithm": "swiss",
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["pairings"]) == 4


@pytest.mark.anyio
async def test_previous_round_with_byes(client: AsyncClient) -> None:
    """Test handling previous rounds that include byes."""
    players = [
        {"id": "1", "name": "Alice", "rank": "3d"},
        {"id": "2", "name": "Bob", "rank": "2d"},
        {"id": "3", "name": "Carol", "rank": "1d"},
    ]

    # Round 1: Alice plays Bob, Carol gets bye
    previous_rounds = [{
        "number": 1,
        "pairings": [
            {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
        ],
        "byes": [{"player_id": "3", "points": 1.0}],
    }]

    response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": previous_rounds,
        "round_number": 2,
        "algorithm": "swiss",
    })
    assert response.status_code == 200
    data = response.json()

    # Carol had bye in R1, should not get bye in R2
    if data["byes"]:
        assert data["byes"][0]["player_id"] != "3"


# =============================================================================
# Edge Cases
# =============================================================================


@pytest.mark.anyio
async def test_minimum_players_two(client: AsyncClient) -> None:
    """Test minimum tournament size with 2 players."""
    response = await client.post("/pair", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["pairings"]) == 1
    assert len(data["byes"]) == 0


@pytest.mark.anyio
async def test_all_same_rank_players(client: AsyncClient) -> None:
    """Test pairing when all players have the same rank."""
    response = await client.post("/pair", json={
        "players": [
            {"id": "1", "name": "P1", "rank": "3d"},
            {"id": "2", "name": "P2", "rank": "3d"},
            {"id": "3", "name": "P3", "rank": "3d"},
            {"id": "4", "name": "P4", "rank": "3d"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["pairings"]) == 2

    # All games should be even (same rank)
    for pairing in data["pairings"]:
        assert pairing["handicap_stones"] == 0
        assert pairing["komi"] == 7.5


@pytest.mark.anyio
async def test_wide_rank_spread(client: AsyncClient) -> None:
    """Test tournament with wide rank spread (9d to 30k)."""
    response = await client.post("/pair", json={
        "players": [
            {"id": "1", "name": "Pro", "rank": "9d"},
            {"id": "2", "name": "Beginner", "rank": "30k"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
    })
    assert response.status_code == 200
    data = response.json()
    pairing = data["pairings"][0]

    # Max handicap should be 9 stones
    assert pairing["handicap_stones"] <= 9


@pytest.mark.anyio
async def test_player_with_club_and_aga_id(client: AsyncClient) -> None:
    """Test players with optional club and AGA ID fields."""
    response = await client.post("/pair", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d", "club": "NYC Go Club", "aga_id": "12345"},
            {"id": "2", "name": "Bob", "rank": "2d", "club": "Brooklyn Go", "aga_id": "12346"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
    })
    assert response.status_code == 200


@pytest.mark.anyio
async def test_player_with_rating(client: AsyncClient) -> None:
    """Test players with optional rating field."""
    response = await client.post("/pair", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "3d", "rating": 2100.5},
            {"id": "2", "name": "Bob", "rank": "2d", "rating": 1950.0},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
    })
    assert response.status_code == 200


@pytest.mark.anyio
async def test_half_point_bye(client: AsyncClient) -> None:
    """Test bye with half point (for McMahon tournaments)."""
    players = [
        {"id": "1", "name": "Alice", "rank": "3d"},
        {"id": "2", "name": "Bob", "rank": "2d"},
        {"id": "3", "name": "Carol", "rank": "1d"},
    ]

    # Round 1 with half-point bye
    previous_rounds = [{
        "number": 1,
        "pairings": [
            {"black_player_id": "2", "white_player_id": "1", "result": "W+"},
        ],
        "byes": [{"player_id": "3", "points": 0.5}],  # Half-point bye
    }]

    response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": previous_rounds,
        "round_number": 2,
        "algorithm": "swiss",
    })
    assert response.status_code == 200


@pytest.mark.anyio
async def test_large_tournament_16_players(client: AsyncClient) -> None:
    """Test larger tournament with 16 players."""
    players = [
        {"id": str(i), "name": f"Player{i}", "rank": f"{(i % 9) + 1}{'d' if i < 8 else 'k'}"}
        for i in range(1, 17)
    ]

    response = await client.post("/pair", json={
        "players": players,
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "swiss",
        "handicap_type": "rank_difference",
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["pairings"]) == 8
    assert len(data["byes"]) == 0


@pytest.mark.anyio
async def test_mcmahon_without_bar_uses_default(client: AsyncClient) -> None:
    """Test McMahon uses default 3d bar when not specified."""
    response = await client.post("/pair", json={
        "players": [
            {"id": "1", "name": "Alice", "rank": "4d"},
            {"id": "2", "name": "Bob", "rank": "1k"},
        ],
        "previous_rounds": [],
        "round_number": 1,
        "algorithm": "mcmahon",
        # No mcmahon_bar specified
    })
    assert response.status_code == 200
