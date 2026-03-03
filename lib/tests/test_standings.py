"""Tests for standings calculator."""

import pytest
from nyig_td.models import (
    Tournament, TournamentSettings, Player, Round, Pairing,
    GameResult, StandingsWeights, PairingAlgorithm,
    RoundStatus
)
from nyig_td.standings import StandingsCalculator, PlayerStanding


class TestStandingsCalculator:
    """Test StandingsCalculator."""

    def test_initial_standings(self):
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        tournament.add_player(Player.create("Alice", "3d"))
        tournament.add_player(Player.create("Bob", "5k"))

        calc = StandingsCalculator()
        standings = calc.calculate(tournament)

        assert len(standings) == 2
        assert standings[0].player.name == "Alice"  # Higher rank
        assert standings[1].player.name == "Bob"

    def test_standings_after_round(self):
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        tournament.add_player(alice)
        tournament.add_player(bob)

        # Simulate round 1
        round1 = tournament.get_round(1)
        round1.pairings.append(Pairing.create(
            black_player_id=bob.id,
            white_player_id=alice.id,
            board_number=1
        ))
        round1.pairings[0].result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()
        standings = calc.calculate(tournament, through_round=1)

        # Alice won, should be first
        assert standings[0].player.id == alice.id
        assert standings[0].wins == 1.0
        assert standings[1].player.id == bob.id
        assert standings[1].wins == 0.0

    def test_sos_calculation(self):
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        carol = Player.create("Carol", "1d")
        dave = Player.create("Dave", "1k")

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        # Round 1: Alice beats Bob, Carol beats Dave
        r1 = tournament.get_round(1)
        r1.pairings = [
            Pairing.create(bob.id, alice.id, 1),
            Pairing.create(dave.id, carol.id, 2),
        ]
        r1.pairings[0].result = GameResult.WHITE_WIN  # Alice wins
        r1.pairings[1].result = GameResult.WHITE_WIN  # Carol wins
        r1.status = RoundStatus.COMPLETED

        # Round 2: Alice beats Carol
        r2 = tournament.get_round(2)
        r2.pairings = [
            Pairing.create(carol.id, alice.id, 1),
            Pairing.create(dave.id, bob.id, 2),
        ]
        r2.pairings[0].result = GameResult.WHITE_WIN  # Alice wins
        r2.pairings[1].result = GameResult.WHITE_WIN  # Bob wins
        r2.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()
        standings = calc.calculate(tournament, through_round=2)

        # Alice: 2 wins, played Bob (1 win) and Carol (1 win), SOS = 2
        alice_standing = next(s for s in standings if s.player.id == alice.id)
        assert alice_standing.wins == 2.0
        assert alice_standing.sos == 2.0  # Bob has 1, Carol has 1

    def test_custom_weights(self):
        weights = StandingsWeights(wins=1.0, sos=0.5, sodos=0.0, extended_sos=0.0)
        calc = StandingsCalculator(weights=weights)

        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        tournament.add_player(alice)
        tournament.add_player(bob)

        r1 = tournament.get_round(1)
        r1.pairings = [Pairing.create(bob.id, alice.id, 1)]
        r1.pairings[0].result = GameResult.WHITE_WIN
        r1.status = RoundStatus.COMPLETED

        standings = calc.calculate(tournament, through_round=1)

        # Alice: 1 win, SOS = 0 (bob has 0 wins)
        # Total = 1.0 * 1 + 0.5 * 0 = 1.0
        alice_standing = next(s for s in standings if s.player.id == alice.id)
        assert alice_standing.total_score == 1.0
