"""Tests for pairing algorithms."""

import pytest
from nyig_td.models import (
    Tournament, TournamentSettings, Player, PairingAlgorithm,
    GameResult
)
from nyig_td.pairing import (
    SwissPairingEngine, McMahonPairingEngine, get_pairing_engine
)


class TestSwissPairing:
    """Test Swiss pairing algorithm."""

    def test_pair_even_players(self):
        settings = TournamentSettings(num_rounds=4, pairing_algorithm=PairingAlgorithm.SWISS)
        tournament = Tournament.create("Test", settings)

        # Add 4 players
        for i, (name, rank) in enumerate([
            ("Alice", "3d"), ("Bob", "2d"),
            ("Carol", "1d"), ("Dave", "1k")
        ]):
            tournament.add_player(Player.create(name, rank))

        engine = SwissPairingEngine()
        result = engine.generate_pairings(tournament, 1)

        assert len(result.pairings) == 2
        assert len(result.byes) == 0

    def test_bye_for_odd_players(self):
        settings = TournamentSettings(num_rounds=4, pairing_algorithm=PairingAlgorithm.SWISS)
        tournament = Tournament.create("Test", settings)

        for name, rank in [("Alice", "3d"), ("Bob", "2d"), ("Carol", "1d")]:
            tournament.add_player(Player.create(name, rank))

        engine = SwissPairingEngine()
        result = engine.generate_pairings(tournament, 1)

        assert len(result.pairings) == 1
        assert len(result.byes) == 1


class TestMcMahonPairing:
    """Test McMahon pairing algorithm."""

    def test_initial_scores(self):
        engine = McMahonPairingEngine(bar_rank="3d")

        p1 = Player.create("Strong", "5d")
        p2 = Player.create("AtBar", "3d")
        p3 = Player.create("Weak", "1k")

        assert engine.get_initial_mcmahon_score(p1) == 0  # Above bar
        assert engine.get_initial_mcmahon_score(p2) == 0  # At bar
        assert engine.get_initial_mcmahon_score(p3) == -3  # 3 below bar (1k -> 1d -> 2d -> 3d)

    def test_pairing_generation(self):
        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d"
        )
        tournament = Tournament.create("Test", settings)

        for name, rank in [
            ("Alice", "4d"), ("Bob", "3d"),
            ("Carol", "2d"), ("Dave", "1d")
        ]:
            tournament.add_player(Player.create(name, rank))

        engine = McMahonPairingEngine(bar_rank="3d")
        result = engine.generate_pairings(tournament, 1)

        assert len(result.pairings) == 2


class TestGetPairingEngine:
    """Test factory function."""

    def test_swiss(self):
        engine = get_pairing_engine(PairingAlgorithm.SWISS)
        assert isinstance(engine, SwissPairingEngine)

    def test_mcmahon(self):
        engine = get_pairing_engine(PairingAlgorithm.MCMAHON, bar_rank="2d")
        assert isinstance(engine, McMahonPairingEngine)
