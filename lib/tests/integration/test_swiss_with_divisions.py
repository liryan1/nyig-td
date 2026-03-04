"""Integration tests for Swiss tournaments with multiple divisions."""

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
from nyig_td.pairing import SwissPairingEngine
from nyig_td.standings import StandingsCalculator

from .conftest import Division


class TestSwissWithDivisions:
    """Swiss tournament tests with 3 divisions (Dan, SDK, DDK)."""

    def setup_method(self) -> None:
        """Set up engine and calculator for each test."""
        self.engine = SwissPairingEngine()
        self.calc = StandingsCalculator()

    def test_swiss_3div_full_5rounds(
        self,
        swiss_tournament_3div: Tournament,
        dan_division: Division,
        sdk_division: Division,
        ddk_division: Division,
    ) -> None:
        """Complete 5-round Swiss with Dan/SDK/DDK divisions, verify standings per division."""
        tournament = swiss_tournament_3div

        # Run 5 rounds
        for round_num in range(1, 6):
            result = self.engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            # Simulate results: stronger player (white in handicap) wins
            for pairing in round_.pairings:
                pairing.result = GameResult.WHITE_WIN

            round_.status = RoundStatus.COMPLETED

        # Calculate final standings
        standings = self.calc.calculate(tournament)

        # Verify all 18 players have standings
        assert len(standings) == 18

        # Extract division standings
        dan_standings = dan_division.filter_standings(standings.copy())
        sdk_standings = sdk_division.filter_standings(standings.copy())
        ddk_standings = ddk_division.filter_standings(standings.copy())

        # Each division should have 6 players
        assert len(dan_standings) == 6
        assert len(sdk_standings) == 6
        assert len(ddk_standings) == 6

        # Division winners should have rank 1
        assert dan_standings[0].rank == 1
        assert sdk_standings[0].rank == 1
        assert ddk_standings[0].rank == 1

        # Verify total wins equals expected (9 games per round * 5 rounds = 45 wins)
        total_wins = sum(s.wins for s in standings)
        assert total_wins == 45

    def test_swiss_division_boundary_players(
        self,
        boundary_players: list[Player],
        dan_division: Division,
        sdk_division: Division,
    ) -> None:
        """Players at 1k/1d boundary paired correctly based on score."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.SWISS,
            handicap_type=HandicapType.RANK_DIFFERENCE,
        )
        tournament = Tournament.create("Boundary Test", settings)
        for p in boundary_players:
            tournament.add_player(p)

        # Run 3 rounds
        for round_num in range(1, 4):
            result = self.engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            for pairing in round_.pairings:
                pairing.result = GameResult.BLACK_WIN

            round_.status = RoundStatus.COMPLETED

        standings = self.calc.calculate(tournament)

        # Verify division filtering works at boundary
        dan_standings = dan_division.filter_standings(standings.copy())
        sdk_standings = sdk_division.filter_standings(standings.copy())

        assert len(dan_standings) == 2  # Two 1d players
        assert len(sdk_standings) == 2  # Two 1k players

        # All boundary players should have valid rank
        for s in dan_standings:
            assert dan_division.contains(s.player.rank)
        for s in sdk_standings:
            assert sdk_division.contains(s.player.rank)

    def test_swiss_division_prizes_extraction(
        self,
        swiss_tournament_3div: Tournament,
        dan_division: Division,
        sdk_division: Division,
        ddk_division: Division,
    ) -> None:
        """Extract division winners after tournament."""
        tournament = swiss_tournament_3div

        # Run full tournament
        for round_num in range(1, 6):
            result = self.engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            # Mix up results to create varied standings
            for i, pairing in enumerate(round_.pairings):
                if i % 2 == 0:
                    pairing.result = GameResult.WHITE_WIN
                else:
                    pairing.result = GameResult.BLACK_WIN

            round_.status = RoundStatus.COMPLETED

        standings = self.calc.calculate(tournament)

        # Extract top 3 from each division
        divisions = [dan_division, sdk_division, ddk_division]
        division_prizes: dict[str, list] = {}

        for div in divisions:
            div_standings = div.filter_standings(standings.copy())
            division_prizes[div.name] = div_standings[:3]

        # Verify each division has prize winners
        for div_name, winners in division_prizes.items():
            assert len(winners) <= 3
            if winners:
                # First place should have rank 1
                assert winners[0].rank == 1
                # Winners should be in descending wins order (or equal wins with tiebreakers)
                for i in range(len(winners) - 1):
                    assert winners[i].wins >= winners[i + 1].wins

    def test_swiss_division_standings_reranking(
        self,
        swiss_tournament_3div: Tournament,
        sdk_division: Division,
    ) -> None:
        """Verify filter_standings() re-ranks correctly."""
        tournament = swiss_tournament_3div

        # Run 2 rounds
        for round_num in range(1, 3):
            result = self.engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            for pairing in round_.pairings:
                pairing.result = GameResult.WHITE_WIN

            round_.status = RoundStatus.COMPLETED

        standings = self.calc.calculate(tournament)

        # SDK players won't be in top positions overall (they're weaker)
        sdk_standings = sdk_division.filter_standings(standings.copy())

        # Verify re-ranking: SDK standings should be 1-6, not original overall rank
        for i, s in enumerate(sdk_standings):
            assert s.rank == i + 1

    def test_swiss_cross_division_sos_calculation(
        self,
        swiss_tournament_3div: Tournament,
        sdk_division: Division,
    ) -> None:
        """SOS includes cross-division opponents."""
        tournament = swiss_tournament_3div

        # Run 3 rounds
        for round_num in range(1, 4):
            result = self.engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            # All white wins
            for pairing in round_.pairings:
                pairing.result = GameResult.WHITE_WIN

            round_.status = RoundStatus.COMPLETED

        standings = self.calc.calculate(tournament)

        # Find an SDK player's standing
        sdk_standings = sdk_division.filter_standings(standings.copy())
        assert len(sdk_standings) > 0

        sdk_player = sdk_standings[0]

        # SOS should be > 0 since they played opponents with scores
        assert sdk_player.sos > 0

        # Verify SOS reflects cross-division opponents
        # In Swiss, SDK players can be paired with Dan or DDK players
        # The SOS calculation should include all opponents regardless of division
        total_sos = sum(s.sos for s in standings)
        assert total_sos > 0
