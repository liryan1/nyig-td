"""Tests for standings calculator."""

import pytest
from nyig_td.models import (
    Tournament, TournamentSettings, Player, Round, Pairing,
    GameResult, PairingAlgorithm,
    RoundStatus
)
from nyig_td.standings import (
    StandingsCalculator, PlayerStanding,
    TiebreakerCriteria, TiebreakerOrder,
)


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

        # SOS uses wins only (not McMahon initial scores)
        # Bob: 1 win, Carol: 1 win
        # Alice's SOS = Bob's wins + Carol's wins = 1 + 1 = 2
        alice_standing = next(s for s in standings if s.player.id == alice.id)
        assert alice_standing.wins == 2.0
        assert alice_standing.sos == 2.0

    def test_sds_calculation(self):
        """Test SDS (Sum of Defeated opponents' Scores)."""
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

        calc = StandingsCalculator()
        standings = calc.calculate(tournament, through_round=1)

        # SDS uses wins only: Bob has 0 wins
        # Alice beat Bob, so SDS = 0
        alice_standing = next(s for s in standings if s.player.id == alice.id)
        assert alice_standing.sds == 0.0

    def test_default_tiebreaker_order_backward_compatible(self):
        """Default tiebreaker order produces same results as before."""
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        carol = Player.create("Carol", "1d")
        dave = Player.create("Dave", "1k")

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        r1 = tournament.get_round(1)
        r1.pairings = [
            Pairing.create(bob.id, alice.id, 1),
            Pairing.create(dave.id, carol.id, 2),
        ]
        r1.pairings[0].result = GameResult.WHITE_WIN
        r1.pairings[1].result = GameResult.WHITE_WIN
        r1.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()
        # Without tiebreaker_order (default)
        standings_default = calc.calculate(tournament, through_round=1)
        # With explicit default
        standings_explicit = calc.calculate(
            tournament, through_round=1,
            tiebreaker_order=TiebreakerOrder(),
        )

        assert len(standings_default) == len(standings_explicit)
        for s1, s2 in zip(standings_default, standings_explicit):
            assert s1.player.id == s2.player.id
            assert s1.rank == s2.rank

    def test_custom_tiebreaker_order(self):
        """Custom tiebreaker order changes sorting."""
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        carol = Player.create("Carol", "1d")
        dave = Player.create("Dave", "1k")

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        # R1: Alice beats Bob, Carol beats Dave
        r1 = tournament.get_round(1)
        r1.pairings = [
            Pairing.create(bob.id, alice.id, 1),
            Pairing.create(dave.id, carol.id, 2),
        ]
        r1.pairings[0].result = GameResult.WHITE_WIN
        r1.pairings[1].result = GameResult.WHITE_WIN
        r1.status = RoundStatus.COMPLETED

        # R2: Alice beats Carol, Bob beats Dave
        r2 = tournament.get_round(2)
        r2.pairings = [
            Pairing.create(carol.id, alice.id, 1),
            Pairing.create(dave.id, bob.id, 2),
        ]
        r2.pairings[0].result = GameResult.WHITE_WIN
        r2.pairings[1].result = GameResult.WHITE_WIN
        r2.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()

        # With SDS before SOS
        order = TiebreakerOrder.from_list([
            TiebreakerCriteria.WINS,
            TiebreakerCriteria.SDS,
            TiebreakerCriteria.SOS,
        ])
        standings = calc.calculate(tournament, through_round=2, tiebreaker_order=order)

        # Alice should still be first (2 wins)
        assert standings[0].player.id == alice.id
        assert standings[0].wins == 2.0

    def test_hth_tiebreaker_a_beat_b(self):
        """HTH breaks tie when A beat B with same wins."""
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        carol = Player.create("Carol", "3d")
        dave = Player.create("Dave", "3d")

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        # R1: Alice beats Bob, Carol beats Dave
        r1 = tournament.get_round(1)
        r1.pairings = [
            Pairing.create(bob.id, alice.id, 1),
            Pairing.create(dave.id, carol.id, 2),
        ]
        r1.pairings[0].result = GameResult.WHITE_WIN
        r1.pairings[1].result = GameResult.WHITE_WIN
        r1.status = RoundStatus.COMPLETED

        # R2: Carol beats Alice, Bob beats Dave
        r2 = tournament.get_round(2)
        r2.pairings = [
            Pairing.create(alice.id, carol.id, 1),
            Pairing.create(bob.id, dave.id, 2),
        ]
        r2.pairings[0].result = GameResult.WHITE_WIN  # Carol wins
        r2.pairings[1].result = GameResult.BLACK_WIN  # Bob wins
        r2.status = RoundStatus.COMPLETED

        # Alice: 1-1, opponents Bob(1w) + Carol(2w) = SOS 3
        # Bob: 1-1, opponents Alice(1w) + Dave(0w) = SOS 1
        # Carol: 2-0, opponents Dave(0w) + Alice(1w) = SOS 1
        # So Alice and Bob are tied at 1 win each but Alice has higher SOS

        calc = StandingsCalculator()

        # Use HTH as first tiebreaker after wins
        order = TiebreakerOrder.from_list([
            TiebreakerCriteria.WINS,
            TiebreakerCriteria.HTH,
            TiebreakerCriteria.SOS,
        ])
        standings = calc.calculate(tournament, through_round=2, tiebreaker_order=order)

        # Carol is first (2 wins)
        assert standings[0].player.id == carol.id

        # Among 1-win players: Alice beat Bob, so with HTH, Alice > Bob
        one_win_standings = [s for s in standings if s.wins == 1.0]
        assert one_win_standings[0].player.id == alice.id
        assert one_win_standings[1].player.id == bob.id

    def test_hth_no_game_falls_through(self):
        """HTH falls through when players didn't play each other."""
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        carol = Player.create("Carol", "3d")
        dave = Player.create("Dave", "3d")

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        # R1: Alice beats Carol, Bob beats Dave (Alice & Bob don't play each other)
        r1 = tournament.get_round(1)
        r1.pairings = [
            Pairing.create(carol.id, alice.id, 1),
            Pairing.create(dave.id, bob.id, 2),
        ]
        r1.pairings[0].result = GameResult.WHITE_WIN
        r1.pairings[1].result = GameResult.WHITE_WIN
        r1.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()

        # Use HTH before SOS: Alice & Bob never played, so HTH returns 0, falls through to SOS
        order = TiebreakerOrder.from_list([
            TiebreakerCriteria.WINS,
            TiebreakerCriteria.HTH,
            TiebreakerCriteria.SOS,
        ])
        standings = calc.calculate(tournament, through_round=1, tiebreaker_order=order)

        # Both have 1 win, HTH doesn't break tie (didn't play each other)
        # SOS: Alice played Carol (0 wins) = 0, Bob played Dave (0 wins) = 0
        # So they share rank
        alice_standing = next(s for s in standings if s.player.id == alice.id)
        bob_standing = next(s for s in standings if s.player.id == bob.id)
        assert alice_standing.rank == bob_standing.rank

    def test_tiebreaker_order_validation(self):
        """TiebreakerOrder validates constraints."""
        # Too many criteria
        with pytest.raises(ValueError, match="Cannot have more than 4"):
            TiebreakerOrder.from_list([
                TiebreakerCriteria.WINS,
                TiebreakerCriteria.SOS,
                TiebreakerCriteria.SDS,
                TiebreakerCriteria.SOSOS,
                TiebreakerCriteria.HTH,
            ])

        # Empty
        with pytest.raises(ValueError, match="at least 1"):
            TiebreakerOrder.from_list([])

        # Duplicates
        with pytest.raises(ValueError, match="duplicates"):
            TiebreakerOrder.from_list([
                TiebreakerCriteria.WINS,
                TiebreakerCriteria.WINS,
            ])
