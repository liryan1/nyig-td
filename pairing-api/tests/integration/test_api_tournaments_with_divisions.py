"""API integration tests for tournaments with divisions."""

from dataclasses import dataclass
from typing import Any

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


@dataclass
class Division:
    """Division for grouping players by rank for prizes."""
    name: str
    min_rank_value: int  # Internal rank value
    max_rank_value: int

    def contains_rank_value(self, value: int) -> bool:
        return self.min_rank_value <= value <= self.max_rank_value


# Dan: 1d (1) to 9d (9)
DAN_DIVISION = Division("Dan", 1, 9)
# SDK: 9k (-8) to 1k (0)
SDK_DIVISION = Division("SDK", -8, 0)
# DDK: 20k (-19) to 10k (-9)
DDK_DIVISION = Division("DDK", -19, -9)


def rank_to_value(rank: str) -> int:
    """Convert rank string to internal value."""
    if rank.endswith("d"):
        return int(rank[:-1])
    elif rank.endswith("k"):
        return 1 - int(rank[:-1])
    raise ValueError(f"Invalid rank: {rank}")


def filter_standings_by_division(
    standings: list[dict[str, Any]],
    players: list[dict[str, Any]],
    division: Division
) -> list[dict[str, Any]]:
    """Filter standings to only include players in the specified division."""
    player_ranks = {p["id"]: rank_to_value(p["rank"]) for p in players}
    filtered = [
        s for s in standings
        if division.contains_rank_value(player_ranks.get(s["player_id"], 0))
    ]
    # Re-rank within division
    for i, s in enumerate(filtered):
        s["division_rank"] = i + 1
    return filtered


# =============================================================================
# Test Data
# =============================================================================


def create_18_player_pool() -> list[dict[str, Any]]:
    """Create 18 players: 6 Dan, 6 SDK, 6 DDK."""
    return [
        # Dan (6)
        {"id": "d1", "name": "Chen", "rank": "4d"},
        {"id": "d2", "name": "Park", "rank": "3d"},
        {"id": "d3", "name": "Kim", "rank": "2d"},
        {"id": "d4", "name": "Lee", "rank": "2d"},
        {"id": "d5", "name": "Zhang", "rank": "1d"},
        {"id": "d6", "name": "Tanaka", "rank": "1d"},
        # SDK (6)
        {"id": "s1", "name": "Smith", "rank": "1k"},
        {"id": "s2", "name": "Johnson", "rank": "2k"},
        {"id": "s3", "name": "Williams", "rank": "3k"},
        {"id": "s4", "name": "Brown", "rank": "5k"},
        {"id": "s5", "name": "Davis", "rank": "6k"},
        {"id": "s6", "name": "Miller", "rank": "8k"},
        # DDK (6)
        {"id": "k1", "name": "Wilson", "rank": "10k"},
        {"id": "k2", "name": "Moore", "rank": "12k"},
        {"id": "k3", "name": "Taylor", "rank": "15k"},
        {"id": "k4", "name": "Anderson", "rank": "18k"},
        {"id": "k5", "name": "Thomas", "rank": "19k"},
        {"id": "k6", "name": "Jackson", "rank": "20k"},
    ]


# =============================================================================
# Swiss Tournament Tests
# =============================================================================


class TestSwissApiWithDivisions:
    """API tests for Swiss tournaments with divisions."""

    @pytest.mark.anyio
    async def test_swiss_full_tournament_with_divisions(
        self, client: AsyncClient
    ) -> None:
        """Test complete Swiss tournament flow via API with division standings."""
        players = create_18_player_pool()
        previous_rounds: list[dict[str, Any]] = []

        # Run 5 rounds
        for round_num in range(1, 6):
            # Generate pairings
            pairing_request = {
                "players": players,
                "previous_rounds": previous_rounds,
                "round_number": round_num,
                "algorithm": "swiss",
                "handicap_enabled": True,
            }

            response = await client.post("/pair", json=pairing_request)
            assert response.status_code == 200
            pairing_data = response.json()

            # Set results (white wins)
            round_pairings = []
            for p in pairing_data["pairings"]:
                round_pairings.append({
                    "black_player_id": p["black_player_id"],
                    "white_player_id": p["white_player_id"],
                    "result": "W+",
                })

            round_data = {
                "number": round_num,
                "pairings": round_pairings,
                "byes": pairing_data["byes"],
            }
            previous_rounds.append(round_data)

        # Calculate standings
        standings_request = {
            "players": players,
            "rounds": previous_rounds,
        }
        response = await client.post("/standings", json=standings_request)
        assert response.status_code == 200
        standings_data = response.json()

        standings = standings_data["standings"]
        assert len(standings) == 18

        # Filter by division
        dan_standings = filter_standings_by_division(standings, players, DAN_DIVISION)
        sdk_standings = filter_standings_by_division(standings, players, SDK_DIVISION)
        ddk_standings = filter_standings_by_division(standings, players, DDK_DIVISION)

        assert len(dan_standings) == 6
        assert len(sdk_standings) == 6
        assert len(ddk_standings) == 6

    @pytest.mark.anyio
    async def test_swiss_cross_division_pairing(self, client: AsyncClient) -> None:
        """Test that Swiss pairs across divisions based on score."""
        players = [
            {"id": "d1", "name": "Dan1", "rank": "1d"},
            {"id": "d2", "name": "Dan2", "rank": "2d"},
            {"id": "k1", "name": "Kyu1", "rank": "1k"},
            {"id": "k2", "name": "Kyu2", "rank": "2k"},
        ]

        # Round 1
        pairing_request = {
            "players": players,
            "previous_rounds": [],
            "round_number": 1,
            "algorithm": "swiss",
            "handicap_enabled": True,
        }

        response = await client.post("/pair", json=pairing_request)
        assert response.status_code == 200
        data = response.json()

        # Should have 2 pairings
        assert len(data["pairings"]) == 2

        # Cross-division pairing is allowed
        all_paired_ids = set()
        for p in data["pairings"]:
            all_paired_ids.add(p["black_player_id"])
            all_paired_ids.add(p["white_player_id"])

        assert all_paired_ids == {"d1", "d2", "k1", "k2"}


# =============================================================================
# McMahon Tournament Tests
# =============================================================================


class TestMcMahonApiWithDivisions:
    """API tests for McMahon tournaments with divisions."""

    @pytest.mark.anyio
    async def test_mcmahon_full_tournament_with_divisions(
        self, client: AsyncClient
    ) -> None:
        """Test complete McMahon tournament flow via API."""
        players = create_18_player_pool()
        previous_rounds: list[dict[str, Any]] = []

        # Run 5 rounds
        for round_num in range(1, 6):
            pairing_request = {
                "players": players,
                "previous_rounds": previous_rounds,
                "round_number": round_num,
                "algorithm": "mcmahon",
                "mcmahon_bar": "2d",
                "handicap_enabled": True,
            }

            response = await client.post("/pair", json=pairing_request)
            assert response.status_code == 200
            pairing_data = response.json()

            round_pairings = []
            for p in pairing_data["pairings"]:
                round_pairings.append({
                    "black_player_id": p["black_player_id"],
                    "white_player_id": p["white_player_id"],
                    "result": "W+",
                })

            round_data = {
                "number": round_num,
                "pairings": round_pairings,
                "byes": pairing_data["byes"],
            }
            previous_rounds.append(round_data)

        # Calculate standings
        standings_request = {
            "players": players,
            "rounds": previous_rounds,
        }
        response = await client.post("/standings", json=standings_request)
        assert response.status_code == 200
        standings_data = response.json()

        assert len(standings_data["standings"]) == 18

    @pytest.mark.anyio
    async def test_mcmahon_cross_division_pairing_by_score(
        self, client: AsyncClient
    ) -> None:
        """Test McMahon pairs by McMahon score across divisions."""
        players = [
            {"id": "d1", "name": "Dan1", "rank": "2d"},  # Bar, starts at 0
            {"id": "d2", "name": "Dan2", "rank": "1d"},  # -1
            {"id": "k1", "name": "Kyu1", "rank": "1k"},  # -2
            {"id": "k2", "name": "Kyu2", "rank": "2k"},  # -3
        ]

        # Round 1
        pairing_request = {
            "players": players,
            "previous_rounds": [],
            "round_number": 1,
            "algorithm": "mcmahon",
            "mcmahon_bar": "2d",
        }

        response = await client.post("/pair", json=pairing_request)
        assert response.status_code == 200
        data = response.json()

        # Should have 2 pairings (players paired by McMahon score)
        assert len(data["pairings"]) == 2


# =============================================================================
# Edge Case Tests
# =============================================================================


class TestApiEdgeCases:
    """API tests for edge cases."""

    @pytest.mark.anyio
    async def test_player_added_mid_tournament(self, client: AsyncClient) -> None:
        """Test adding a player after round 1."""
        initial_players = [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
            {"id": "4", "name": "Dave", "rank": "1k"},
        ]

        # Round 1 with 4 players
        r1_request = {
            "players": initial_players,
            "previous_rounds": [],
            "round_number": 1,
            "algorithm": "swiss",
        }
        response = await client.post("/pair", json=r1_request)
        assert response.status_code == 200
        r1_data = response.json()

        r1_pairings = [
            {
                "black_player_id": p["black_player_id"],
                "white_player_id": p["white_player_id"],
                "result": "W+",
            }
            for p in r1_data["pairings"]
        ]

        previous_rounds = [{"number": 1, "pairings": r1_pairings, "byes": []}]

        # Add new player for round 2
        all_players = initial_players + [
            {"id": "5", "name": "Eve", "rank": "2k"},
        ]

        r2_request = {
            "players": all_players,
            "previous_rounds": previous_rounds,
            "round_number": 2,
            "algorithm": "swiss",
        }
        response = await client.post("/pair", json=r2_request)
        assert response.status_code == 200
        r2_data = response.json()

        # Should have 2 pairings + 1 bye (5 players)
        assert len(r2_data["pairings"]) == 2
        assert len(r2_data["byes"]) == 1

        # New player should be included
        all_ids = set()
        for p in r2_data["pairings"]:
            all_ids.add(p["black_player_id"])
            all_ids.add(p["white_player_id"])
        for b in r2_data["byes"]:
            all_ids.add(b["player_id"])

        assert "5" in all_ids

    @pytest.mark.anyio
    async def test_forced_repeat_warning(self, client: AsyncClient) -> None:
        """Test repeat pairing warning with 2 players, 3 rounds."""
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
        r1_data = r1_response.json()

        r1_pairings = [{
            "black_player_id": r1_data["pairings"][0]["black_player_id"],
            "white_player_id": r1_data["pairings"][0]["white_player_id"],
            "result": "W+",
        }]

        # Round 2 - forced repeat
        r2_response = await client.post("/pair", json={
            "players": players,
            "previous_rounds": [{"number": 1, "pairings": r1_pairings, "byes": []}],
            "round_number": 2,
            "algorithm": "swiss",
        })
        r2_data = r2_response.json()

        # Should have warning about repeat pairing
        assert len(r2_data["warnings"]) > 0
        assert any("Repeat" in w for w in r2_data["warnings"])

    @pytest.mark.anyio
    async def test_standings_with_partial_participation(
        self, client: AsyncClient
    ) -> None:
        """Test standings when player misses a round."""
        players = [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
            {"id": "4", "name": "Dave", "rank": "1k"},
        ]

        # Round 1 with all 4
        r1_pairings = [
            {"black_player_id": "1", "white_player_id": "2", "result": "W+"},
            {"black_player_id": "3", "white_player_id": "4", "result": "W+"},
        ]

        # Round 2 - Dave withdraws (only 3 players)
        r2_pairings = [
            {"black_player_id": "1", "white_player_id": "3", "result": "B+"},
        ]
        r2_byes = [{"player_id": "2", "points": 1.0}]

        rounds = [
            {"number": 1, "pairings": r1_pairings, "byes": []},
            {"number": 2, "pairings": r2_pairings, "byes": r2_byes},
        ]

        # Include Dave in standings (he played round 1)
        standings_request = {
            "players": players,
            "rounds": rounds,
        }
        response = await client.post("/standings", json=standings_request)
        assert response.status_code == 200

        standings = response.json()["standings"]
        # All 4 players should be in standings
        assert len(standings) == 4

        # Dave should have partial record (1 game)
        # Dave was white in round 1 and white won (W+), so Dave has 1 win
        dave = next(s for s in standings if s["player_id"] == "4")
        assert dave["wins"] == 1.0

    @pytest.mark.anyio
    async def test_tiebreaker_in_standings(self, client: AsyncClient) -> None:
        """Test that SOS/SODOS tiebreakers are calculated."""
        players = [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "3d"},
            {"id": "3", "name": "Carol", "rank": "3d"},
            {"id": "4", "name": "Dave", "rank": "3d"},
        ]

        # Create scenario with ties
        rounds = [
            {
                "number": 1,
                "pairings": [
                    {"black_player_id": "1", "white_player_id": "2", "result": "B+"},
                    {"black_player_id": "3", "white_player_id": "4", "result": "B+"},
                ],
                "byes": [],
            },
            {
                "number": 2,
                "pairings": [
                    {"black_player_id": "1", "white_player_id": "3", "result": "W+"},
                    {"black_player_id": "2", "white_player_id": "4", "result": "B+"},
                ],
                "byes": [],
            },
        ]

        response = await client.post("/standings", json={
            "players": players,
            "rounds": rounds,
        })
        assert response.status_code == 200

        standings = response.json()["standings"]

        # All standings should have SOS calculated
        for s in standings:
            assert "sos" in s
            assert "sodos" in s

    @pytest.mark.anyio
    async def test_bye_distribution_fairness(self, client: AsyncClient) -> None:
        """Test that byes are distributed across rounds."""
        players = [
            {"id": "1", "name": "Alice", "rank": "3d"},
            {"id": "2", "name": "Bob", "rank": "2d"},
            {"id": "3", "name": "Carol", "rank": "1d"},
        ]

        previous_rounds: list[dict[str, Any]] = []
        bye_recipients: list[str] = []

        # Run 3 rounds
        for round_num in range(1, 4):
            response = await client.post("/pair", json={
                "players": players,
                "previous_rounds": previous_rounds,
                "round_number": round_num,
                "algorithm": "swiss",
            })
            data = response.json()

            # Each round should have exactly 1 bye (3 players = 1 pairing + 1 bye)
            assert len(data["pairings"]) == 1
            assert len(data["byes"]) == 1

            # Track bye
            for bye in data["byes"]:
                bye_recipients.append(bye["player_id"])

            # Set results
            round_pairings = [
                {
                    "black_player_id": p["black_player_id"],
                    "white_player_id": p["white_player_id"],
                    "result": "W+",
                }
                for p in data["pairings"]
            ]
            previous_rounds.append({
                "number": round_num,
                "pairings": round_pairings,
                "byes": data["byes"],
            })

        # Should have 3 total byes (1 per round)
        assert len(bye_recipients) == 3

        # The engine should try to distribute byes, but may repeat
        # At minimum, not all 3 byes should go to the same player
        from collections import Counter
        bye_counts = Counter(bye_recipients)
        max_byes_to_one_player = max(bye_counts.values())
        assert max_byes_to_one_player <= 2, "No player should get all 3 byes"
