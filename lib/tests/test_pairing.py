"""Tests for pairing algorithms."""

import pytest
from nyig_td.models import (
    Tournament, TournamentSettings, Player, PairingAlgorithm,
    GameResult, RoundStatus,
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


class TestMcMahonRepeatAvoidance:
    """Test that McMahon avoids repeat pairings across score groups."""

    def test_avoids_repeat_across_score_groups(self):
        """When same-MMS opponent is a repeat, pair across groups instead."""
        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d",
        )
        tournament = Tournament.create("Test", settings)

        # 4 players all at bar (same initial MMS = 0)
        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        carol = Player.create("Carol", "3d")
        dave = Player.create("Dave", "3d")
        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        engine = McMahonPairingEngine(bar_rank="3d")

        # Round 1
        r1_result = engine.generate_pairings(tournament, 1)
        r1 = tournament.get_round(1)
        r1.pairings = r1_result.pairings
        r1.byes = r1_result.byes

        # Record who played whom in round 1
        r1_pairs = set()
        for p in r1.pairings:
            r1_pairs.add(frozenset([p.black_player_id, p.white_player_id]))

        # Give results: first pairing black wins, second white wins
        r1.pairings[0].result = GameResult.BLACK_WIN
        r1.pairings[1].result = GameResult.WHITE_WIN
        r1.status = RoundStatus.COMPLETED

        # Round 2 — should not repeat any round 1 pairings
        r2_result = engine.generate_pairings(tournament, 2)

        r2_pairs = set()
        for p in r2_result.pairings:
            r2_pairs.add(frozenset([p.black_player_id, p.white_player_id]))

        # No repeat pairings (4 players, round 2 — repeats are avoidable)
        assert r1_pairs.isdisjoint(r2_pairs), (
            f"Repeat pairings found: {r1_pairs & r2_pairs}"
        )
        # No repeat warnings
        repeat_warnings = [w for w in r2_result.warnings if "Repeat" in w]
        assert len(repeat_warnings) == 0

    def test_avoids_repeat_with_different_mms_groups(self):
        """Players at different MMS levels should cross groups to avoid repeats."""
        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d",
        )
        tournament = Tournament.create("Test", settings)

        # 4 players at different ranks
        alice = Player.create("Alice", "3d")  # MMS = 0
        bob = Player.create("Bob", "2d")      # MMS = -1
        carol = Player.create("Carol", "1d")  # MMS = -2
        dave = Player.create("Dave", "1k")    # MMS = -3
        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        engine = McMahonPairingEngine(bar_rank="3d")

        # Round 1
        r1_result = engine.generate_pairings(tournament, 1)
        r1 = tournament.get_round(1)
        r1.pairings = r1_result.pairings
        r1.byes = r1_result.byes
        for p in r1.pairings:
            p.result = GameResult.BLACK_WIN
        r1.status = RoundStatus.COMPLETED

        r1_pairs = {
            frozenset([p.black_player_id, p.white_player_id])
            for p in r1.pairings
        }

        # Round 2
        r2_result = engine.generate_pairings(tournament, 2)
        r2 = tournament.get_round(2)
        r2.pairings = r2_result.pairings
        r2.byes = r2_result.byes
        for p in r2.pairings:
            p.result = GameResult.WHITE_WIN
        r2.status = RoundStatus.COMPLETED

        r2_pairs = {
            frozenset([p.black_player_id, p.white_player_id])
            for p in r2.pairings
        }

        # No repeats in round 2
        assert r1_pairs.isdisjoint(r2_pairs)

        # Round 3 — with 4 players after 2 rounds, each player has played 2 others.
        # Only 1 unused opponent remains per player, so repeats still avoidable.
        r3_result = engine.generate_pairings(tournament, 3)
        r3_pairs = {
            frozenset([p.black_player_id, p.white_player_id])
            for p in r3_result.pairings
        }

        assert r1_pairs.isdisjoint(r3_pairs)
        assert r2_pairs.isdisjoint(r3_pairs)
        repeat_warnings = [w for w in r3_result.warnings if "Repeat" in w]
        assert len(repeat_warnings) == 0


class TestMcMahonBacktracking:
    """Test that backtracking avoids repeats greedy algorithm would miss."""

    def test_hogwarts_open_round4_no_repeats(self):
        """Reproduce real scenario: 10 players, bar=5d, 4 rounds.

        After 3 rounds, the top 4 (9d,8d,7d,5d) have all played each other,
        so round 4 must pair them with bottom 6. Greedy fails because it
        "uses up" bottom players that others need, forcing a repeat at the end.
        Backtracking finds the repeat-free solution.
        """
        from nyig_td.models import HandicapType

        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="5d",
            handicap_type=HandicapType.RANK_DIFFERENCE,
        )
        tournament = Tournament.create("Hogwarts Open", settings)

        # Create all 10 players
        alex = Player.create("Alex Qi", "9d")
        hermione = Player.create("Hermione Granger", "8d")
        tom = Player.create("Tom Riddle", "7d")
        luna = Player.create("Luna Lovegood", "5d")
        ron = Player.create("Ron Weasley", "1d")
        draco = Player.create("Draco Malfoy", "2k")
        minerva = Player.create("Minerva McGonagall", "2k")
        lucius = Player.create("Lucius Malfoy", "5k")
        severus = Player.create("Severus Snape", "5k")
        neville = Player.create("Neville Longbottom", "10k")

        for p in [alex, hermione, tom, luna, ron, draco, minerva, lucius, severus, neville]:
            tournament.add_player(p)

        engine = McMahonPairingEngine(bar_rank="5d")
        all_prev_pairs: set[frozenset[str]] = set()

        for round_num in range(1, 5):
            result = engine.generate_pairings(tournament, round_num)
            rnd = tournament.get_round(round_num)
            rnd.pairings = result.pairings
            rnd.byes = result.byes

            # Check no repeats in this round
            round_pairs = {
                frozenset([p.black_player_id, p.white_player_id])
                for p in result.pairings
            }
            repeats = round_pairs & all_prev_pairs
            repeat_warnings = [w for w in result.warnings if "Repeat" in w]

            assert len(repeats) == 0, (
                f"Round {round_num} has repeat pairings: {repeats}"
            )
            assert len(repeat_warnings) == 0, (
                f"Round {round_num} has repeat warnings: {repeat_warnings}"
            )

            all_prev_pairs |= round_pairs

            # Simulate results: higher-ranked player wins
            for pairing in rnd.pairings:
                black = tournament.players[pairing.black_player_id]
                white = tournament.players[pairing.white_player_id]
                if white.rank.value > black.rank.value:
                    pairing.result = GameResult.WHITE_WIN
                else:
                    pairing.result = GameResult.BLACK_WIN
            rnd.status = RoundStatus.COMPLETED


class TestGetPairingEngine:
    """Test factory function."""

    def test_swiss(self):
        engine = get_pairing_engine(PairingAlgorithm.SWISS)
        assert isinstance(engine, SwissPairingEngine)

    def test_mcmahon(self):
        engine = get_pairing_engine(PairingAlgorithm.MCMAHON, bar_rank="2d")
        assert isinstance(engine, McMahonPairingEngine)
