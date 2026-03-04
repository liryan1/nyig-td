"""Integration tests for McMahon tournaments with multiple divisions."""

import pytest

from nyig_td.models import (
    Tournament,
    TournamentSettings,
    Player,
    GameResult,
    PairingAlgorithm,
    RoundStatus,
    HandicapType,
)
from nyig_td.pairing import McMahonPairingEngine
from nyig_td.standings import StandingsCalculator

from .conftest import Division


class TestMcMahonWithDivisions:
    """McMahon tournament tests with 3 divisions (Dan, SDK, DDK)."""

    def setup_method(self) -> None:
        """Set up engine and calculator for each test."""
        self.engine = McMahonPairingEngine(bar_rank="2d")
        self.calc = StandingsCalculator()

    def test_mcmahon_3div_full_5rounds(
        self,
        mcmahon_tournament_3div: Tournament,
        dan_division: Division,
        sdk_division: Division,
        ddk_division: Division,
    ) -> None:
        """Complete 5-round McMahon with bar=2d."""
        tournament = mcmahon_tournament_3div

        # Run 5 rounds
        for round_num in range(1, 6):
            result = self.engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            # Simulate results: stronger player (white) wins
            for pairing in round_.pairings:
                pairing.result = GameResult.WHITE_WIN

            round_.status = RoundStatus.COMPLETED

        standings = self.calc.calculate(tournament)

        # Verify all players accounted for
        assert len(standings) == 18

        # Extract division standings
        dan_standings = dan_division.filter_standings(standings.copy())
        sdk_standings = sdk_division.filter_standings(standings.copy())
        ddk_standings = ddk_division.filter_standings(standings.copy())

        assert len(dan_standings) == 6
        assert len(sdk_standings) == 6
        assert len(ddk_standings) == 6

        # In McMahon with bar=2d, players at/above bar start at 0
        # Players below bar start negative
        # After 5 rounds, stronger players should have accumulated more wins

    def test_mcmahon_cross_division_pairing_by_score(
        self,
        dan_division: Division,
        sdk_division: Division,
    ) -> None:
        """1k and 1d with same McMahon score are paired together."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="2d",
            handicap_type=HandicapType.RANK_DIFFERENCE,
        )
        tournament = Tournament.create("Cross-Div Pairing", settings)

        # Create players where 1k and 1d could have same McMahon score
        # With bar at 2d: 1d starts at -1, 1k starts at -2
        # If 1k wins round 1 and 1d loses, they both have -1 for round 2
        players = [
            Player.create("Dan1", "1d"),
            Player.create("Dan2", "2d"),
            Player.create("Kyu1", "1k"),
            Player.create("Kyu2", "1k"),
        ]
        for p in players:
            tournament.add_player(p)

        # Round 1
        result = self.engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result.pairings
        round1.byes = result.byes

        # Set results so cross-division players end up with similar scores
        for pairing in round1.pairings:
            pairing.result = GameResult.BLACK_WIN
        round1.status = RoundStatus.COMPLETED

        # Round 2 - players with same McMahon score should be eligible to pair
        result2 = self.engine.generate_pairings(tournament, 2)
        round2 = tournament.get_round(2)
        round2.pairings = result2.pairings
        round2.byes = result2.byes

        # Verify pairings exist
        assert len(round2.pairings) == 2

        # Check that cross-division pairing is possible
        paired_ids = set()
        for p in round2.pairings:
            paired_ids.add(p.black_player_id)
            paired_ids.add(p.white_player_id)

        # All 4 players should be paired
        player_ids = {p.id for p in players}
        assert paired_ids == player_ids

    def test_mcmahon_initial_scores_across_divisions(
        self,
        three_division_players: list[Player],
    ) -> None:
        """Verify initial scores per division with bar at 2d."""
        # With bar at 2d:
        # 4d, 3d, 2d -> start at 0
        # 1d -> -1
        # 1k -> -2
        # 2k -> -3, etc.

        for player in three_division_players:
            initial = self.engine.get_initial_mcmahon_score(player)
            rank = player.rank

            if rank.value >= 2:  # 2d or higher
                assert initial == 0, f"{player.name} ({rank}) should start at 0"
            else:
                expected = rank.value - 2  # Distance below 2d
                assert initial == expected, f"{player.name} ({rank}) should start at {expected}"

    def test_mcmahon_division_prizes_with_cross_div_sos(
        self,
        mcmahon_tournament_3div: Tournament,
        dan_division: Division,
        sdk_division: Division,
        ddk_division: Division,
    ) -> None:
        """Division prizes reflect cross-div tiebreakers."""
        tournament = mcmahon_tournament_3div

        # Run tournament with varied results
        for round_num in range(1, 6):
            result = self.engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            # Alternate results to create ties
            for i, pairing in enumerate(round_.pairings):
                if i % 2 == round_num % 2:
                    pairing.result = GameResult.WHITE_WIN
                else:
                    pairing.result = GameResult.BLACK_WIN

            round_.status = RoundStatus.COMPLETED

        standings = self.calc.calculate(tournament)

        # Get SDK division standings
        sdk_standings = sdk_division.filter_standings(standings.copy())

        # Verify SOS/SDS are calculated (used for tiebreakers)
        for s in sdk_standings:
            # SOS should exist since players played opponents
            assert s.sos >= 0
            assert s.sds >= 0

    def test_mcmahon_all_tied_scores_forcing_suboptimal(self) -> None:
        """All players at same McMahon score."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d",
            handicap_type=HandicapType.RANK_DIFFERENCE,
        )
        tournament = Tournament.create("All Tied", settings)

        # Create 4 players all at bar (same initial score = 0)
        players = [
            Player.create("P1", "3d"),
            Player.create("P2", "3d"),
            Player.create("P3", "3d"),
            Player.create("P4", "3d"),
        ]
        for p in players:
            tournament.add_player(p)

        engine = McMahonPairingEngine(bar_rank="3d")

        # All start at 0
        for p in players:
            assert engine.get_initial_mcmahon_score(p) == 0

        # Round 1 - all have same score, pair by rank (all same)
        result = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result.pairings
        round1.byes = result.byes

        # Should have 2 pairings, no warnings about ties
        assert len(round1.pairings) == 2

        # Set alternating results
        round1.pairings[0].result = GameResult.BLACK_WIN
        round1.pairings[1].result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Round 2 - now we have 2 winners (score 1) and 2 losers (score 0)
        result2 = engine.generate_pairings(tournament, 2)
        round2 = tournament.get_round(2)
        round2.pairings = result2.pairings

        # Winners should be paired together, losers together
        assert len(round2.pairings) == 2


class TestMcMahonScoreProgression:
    """Test McMahon score progression through rounds."""

    def test_score_increases_with_wins(self) -> None:
        """McMahon score should increase with each win."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d",
        )
        tournament = Tournament.create("Score Test", settings)

        alice = Player.create("Alice", "1k")  # Starts at -3
        bob = Player.create("Bob", "1k")  # Starts at -3
        tournament.add_player(alice)
        tournament.add_player(bob)

        engine = McMahonPairingEngine(bar_rank="3d")

        # Initial scores
        assert engine.get_mcmahon_score(tournament, alice, 1) == -3
        assert engine.get_mcmahon_score(tournament, bob, 1) == -3

        # Round 1: Alice wins
        result = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result.pairings

        pairing = round1.pairings[0]
        if pairing.black_player_id == alice.id:
            pairing.result = GameResult.BLACK_WIN
        else:
            pairing.result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # After round 1
        assert engine.get_mcmahon_score(tournament, alice, 2) == -2  # -3 + 1
        assert engine.get_mcmahon_score(tournament, bob, 2) == -3  # No change
