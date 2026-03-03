"""
Real-world tournament scenarios covering edge cases and full tournament flows.
These tests simulate actual Go tournament situations.
"""

import pytest
from nyig_td.models import (
    Tournament, TournamentSettings, Player, Pairing, Bye, Round,
    GameResult, PairingAlgorithm, RoundStatus, StandingsWeights
)
from nyig_td.pairing import (
    SwissPairingEngine, McMahonPairingEngine, get_pairing_engine, PairingResult
)
from nyig_td.standings import StandingsCalculator, PlayerStanding
from nyig_td.ranks import Rank


class TestFullSwissTournament:
    """Simulate a complete 4-round Swiss tournament with 8 players."""

    def setup_method(self):
        """Set up a standard tournament with 8 players of varying ranks."""
        self.settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.SWISS,
            handicap_enabled=True
        )
        self.tournament = Tournament.create("NYC Go Club Open", self.settings)

        # Create 8 players with realistic rank distribution
        self.players = [
            Player.create("Alice Chen", "4d", club="NYC Go Club", aga_id="12345"),
            Player.create("Bob Smith", "3d", club="NYC Go Club", aga_id="12346"),
            Player.create("Carol Wang", "2d", club="Brooklyn Go", aga_id="12347"),
            Player.create("Dave Kim", "1d", club="NYC Go Club", aga_id="12348"),
            Player.create("Eve Johnson", "1k", club="Queens Go", aga_id="12349"),
            Player.create("Frank Lee", "3k", club="NYC Go Club", aga_id="12350"),
            Player.create("Grace Park", "5k", club="Brooklyn Go", aga_id="12351"),
            Player.create("Henry Zhao", "8k", club="NYC Go Club", aga_id="12352"),
        ]
        for p in self.players:
            self.tournament.add_player(p)

        self.engine = SwissPairingEngine()
        self.calc = StandingsCalculator()

    def test_round_1_pairing(self):
        """Test first round pairing with rank-based sorting."""
        result = self.engine.generate_pairings(self.tournament, 1)

        assert len(result.pairings) == 4
        assert len(result.byes) == 0
        assert len(result.warnings) == 0

        # Verify board numbers are sequential
        board_numbers = [p.board_number for p in result.pairings]
        assert board_numbers == [1, 2, 3, 4]

    def test_full_4_round_tournament(self):
        """Simulate a complete 4-round tournament."""
        alice, bob, carol, dave, eve, frank, grace, henry = self.players

        # Round 1: Pair and record results
        r1_result = self.engine.generate_pairings(self.tournament, 1)
        round1 = self.tournament.get_round(1)
        round1.pairings = r1_result.pairings
        round1.status = RoundStatus.COMPLETED

        # Set round 1 results (top seeds win)
        for pairing in round1.pairings:
            pairing.result = GameResult.WHITE_WIN  # Stronger player as white wins

        # Round 2: Based on scores
        r2_result = self.engine.generate_pairings(self.tournament, 2)
        round2 = self.tournament.get_round(2)
        round2.pairings = r2_result.pairings
        round2.status = RoundStatus.COMPLETED

        for pairing in round2.pairings:
            pairing.result = GameResult.BLACK_WIN  # Mix up results

        # Round 3
        r3_result = self.engine.generate_pairings(self.tournament, 3)
        round3 = self.tournament.get_round(3)
        round3.pairings = r3_result.pairings
        round3.status = RoundStatus.COMPLETED

        for pairing in round3.pairings:
            pairing.result = GameResult.WHITE_WIN

        # Round 4
        r4_result = self.engine.generate_pairings(self.tournament, 4)
        round4 = self.tournament.get_round(4)
        round4.pairings = r4_result.pairings
        round4.status = RoundStatus.COMPLETED

        for pairing in round4.pairings:
            pairing.result = GameResult.BLACK_WIN

        # Check final standings
        standings = self.calc.calculate(self.tournament)

        assert len(standings) == 8
        # All standings should have ranks
        assert all(s.rank >= 1 for s in standings)
        # Check that wins/losses add up
        total_wins = sum(s.wins for s in standings)
        total_losses = sum(s.losses for s in standings)
        assert total_wins == 16  # 4 rounds * 4 games
        assert total_losses == 16


class TestSwissRepeatPairings:
    """Test scenarios where repeat pairings are forced."""

    def test_small_tournament_forces_repeat(self):
        """With only 2 players, round 2 must repeat the pairing."""
        settings = TournamentSettings(num_rounds=3, pairing_algorithm=PairingAlgorithm.SWISS)
        tournament = Tournament.create("Mini Tournament", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        tournament.add_player(alice)
        tournament.add_player(bob)

        engine = SwissPairingEngine()

        # Round 1
        r1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = r1.pairings
        round1.pairings[0].result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Round 2 - must repeat
        r2 = engine.generate_pairings(tournament, 2)

        assert len(r2.pairings) == 1
        assert "Repeat pairing" in r2.warnings[0]


class TestSwissWithByesAndScores:
    """Test Swiss pairing with byes and score tracking."""

    def test_bye_counts_as_win(self):
        """Player with bye should get 1 point."""
        settings = TournamentSettings(num_rounds=2, pairing_algorithm=PairingAlgorithm.SWISS)
        tournament = Tournament.create("Odd Tournament", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        carol = Player.create("Carol", "1d")  # Will get bye
        tournament.add_player(alice)
        tournament.add_player(bob)
        tournament.add_player(carol)

        engine = SwissPairingEngine()

        # Round 1 - Carol gets bye
        r1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = r1.pairings
        round1.byes = r1.byes
        round1.pairings[0].result = GameResult.WHITE_WIN  # Alice wins
        round1.status = RoundStatus.COMPLETED

        assert len(round1.byes) == 1

        # Round 2 - Carol should be paired high due to bye point
        r2 = engine.generate_pairings(tournament, 2)

        # Carol (1 win from bye) should be paired against Alice (1 win)
        assert len(r2.pairings) == 1
        assert len(r2.byes) == 1


class TestSwissColorBalancing:
    """Test that colors are balanced across rounds."""

    def test_color_balancing_after_multiple_rounds(self):
        """Player who played more black should get white."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.SWISS,
            handicap_enabled=False  # Even games to test pure color balancing
        )
        tournament = Tournament.create("Color Test", settings)

        # Create players with similar ranks
        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        carol = Player.create("Carol", "3d")
        dave = Player.create("Dave", "3d")

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        engine = SwissPairingEngine()

        # Round 1
        r1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = r1.pairings
        for p in round1.pairings:
            p.result = GameResult.BLACK_WIN
        round1.status = RoundStatus.COMPLETED

        # Track who played black in round 1
        r1_black_ids = {p.black_player_id for p in round1.pairings}

        # Round 2
        r2 = engine.generate_pairings(tournament, 2)
        round2 = tournament.get_round(2)
        round2.pairings = r2.pairings

        # Players who played black in R1 should tend to get white in R2
        # (unless handicap requirements override)
        r2_white_ids = {p.white_player_id for p in round2.pairings}

        # At least one player who was black R1 should be white R2
        assert len(r1_black_ids & r2_white_ids) > 0


class TestSwissHandicapDisabled:
    """Test Swiss pairing with handicap disabled."""

    def test_even_games_when_handicap_disabled(self):
        """All games should be even when handicap is disabled."""
        settings = TournamentSettings(
            num_rounds=2,
            pairing_algorithm=PairingAlgorithm.SWISS,
            handicap_enabled=False
        )
        tournament = Tournament.create("Even Tournament", settings)

        # Players with big rank difference
        tournament.add_player(Player.create("Strong", "5d"))
        tournament.add_player(Player.create("Weak", "10k"))

        engine = SwissPairingEngine()
        result = engine.generate_pairings(tournament, 1)

        # All games should be even (7.5 komi, 0 handicap)
        for pairing in result.pairings:
            assert pairing.handicap_stones == 0
            assert pairing.komi == 7.5


class TestMcMahonFullTournament:
    """Test McMahon pairing with various scenarios."""

    def test_mcmahon_with_custom_initial_scores(self):
        """Test that custom initial McMahon scores are respected."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d"
        )
        tournament = Tournament.create("McMahon Test", settings)

        # Player with custom initial score
        special = Player.create("Special", "1k")
        special.initial_mcmahon_score = 0  # Override to be at bar
        tournament.add_player(special)

        regular = Player.create("Regular", "1k")  # Will have -3 initial
        tournament.add_player(regular)

        strong = Player.create("Strong", "4d")  # Will have 0 initial
        tournament.add_player(strong)

        dan = Player.create("DanPlayer", "3d")  # At bar, 0 initial
        tournament.add_player(dan)

        engine = McMahonPairingEngine(bar_rank="3d")

        assert engine.get_initial_mcmahon_score(special) == 0  # Custom
        assert engine.get_initial_mcmahon_score(regular) == -3  # Calculated
        assert engine.get_initial_mcmahon_score(strong) == 0  # Above bar
        assert engine.get_initial_mcmahon_score(dan) == 0  # At bar

    def test_mcmahon_score_progression(self):
        """Test McMahon scores increase with wins."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d"
        )
        tournament = Tournament.create("McMahon Progress", settings)

        alice = Player.create("Alice", "1k")  # -3 initial
        bob = Player.create("Bob", "1k")  # -3 initial
        tournament.add_player(alice)
        tournament.add_player(bob)

        engine = McMahonPairingEngine(bar_rank="3d")

        # Round 1
        r1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = r1.pairings

        # Find which player is black in the pairing
        pairing = round1.pairings[0]
        if pairing.black_player_id == alice.id:
            pairing.result = GameResult.BLACK_WIN  # Alice wins as black
        else:
            pairing.result = GameResult.WHITE_WIN  # Alice wins as white
        round1.status = RoundStatus.COMPLETED

        # Check McMahon scores for round 2
        alice_score = engine.get_mcmahon_score(tournament, alice, 2)
        bob_score = engine.get_mcmahon_score(tournament, bob, 2)

        assert alice_score == -2  # -3 + 1 win
        assert bob_score == -3  # -3 + 0 wins

    def test_mcmahon_default_bar(self):
        """Test McMahon with default 3d bar."""
        engine = McMahonPairingEngine()  # No bar_rank specified

        p = Player.create("TestPlayer", "1d")
        assert engine.get_initial_mcmahon_score(p) == -2  # 2 below 3d


class TestMcMahonRepeatAndEdgeCases:
    """Test McMahon edge cases."""

    def test_mcmahon_repeat_pairing_warning(self):
        """Test that repeat pairings generate warnings in McMahon."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d"
        )
        tournament = Tournament.create("McMahon Repeat", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        tournament.add_player(alice)
        tournament.add_player(bob)

        engine = McMahonPairingEngine(bar_rank="3d")

        # Round 1
        r1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = r1.pairings
        round1.pairings[0].result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Round 2 - must repeat
        r2 = engine.generate_pairings(tournament, 2)

        assert "Repeat pairing" in r2.warnings[0]

    def test_mcmahon_handicap_disabled(self):
        """Test McMahon with handicap disabled."""
        settings = TournamentSettings(
            num_rounds=2,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d",
            handicap_enabled=False
        )
        tournament = Tournament.create("McMahon Even", settings)

        tournament.add_player(Player.create("Strong", "5d"))
        tournament.add_player(Player.create("Weak", "10k"))

        engine = McMahonPairingEngine(bar_rank="3d")
        result = engine.generate_pairings(tournament, 1)

        # All games should be even
        for pairing in result.pairings:
            assert pairing.handicap_stones == 0
            assert pairing.komi == 7.5

    def test_mcmahon_odd_players_bye(self):
        """Test McMahon bye handling."""
        settings = TournamentSettings(
            num_rounds=2,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d"
        )
        tournament = Tournament.create("McMahon Bye", settings)

        tournament.add_player(Player.create("A", "5d"))
        tournament.add_player(Player.create("B", "3d"))
        tournament.add_player(Player.create("C", "1k"))  # Lowest, gets bye

        engine = McMahonPairingEngine(bar_rank="3d")
        result = engine.generate_pairings(tournament, 1)

        assert len(result.pairings) == 1
        assert len(result.byes) == 1
        # Lowest McMahon score player should get bye
        assert "Bye given to C" in result.warnings[0]


class TestStandingsEdgeCases:
    """Test standings calculation edge cases."""

    def test_standings_with_draw(self):
        """Test that draws award 0.5 points to each player."""
        settings = TournamentSettings(num_rounds=2)
        tournament = Tournament.create("Draw Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        tournament.add_player(alice)
        tournament.add_player(bob)

        round1 = tournament.get_round(1)
        round1.pairings.append(Pairing.create(alice.id, bob.id, 1))
        round1.pairings[0].result = GameResult.DRAW
        round1.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()
        standings = calc.calculate(tournament, through_round=1)

        # Both should have 0.5 wins
        assert standings[0].wins == 0.5
        assert standings[1].wins == 0.5

    def test_standings_with_both_lose(self):
        """Test double forfeit (both lose) scenario."""
        settings = TournamentSettings(num_rounds=2)
        tournament = Tournament.create("Both Lose Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        tournament.add_player(alice)
        tournament.add_player(bob)

        round1 = tournament.get_round(1)
        round1.pairings.append(Pairing.create(alice.id, bob.id, 1))
        round1.pairings[0].result = GameResult.BOTH_LOSE
        round1.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()
        standings = calc.calculate(tournament, through_round=1)

        # Both should have 1 loss, 0 wins
        assert standings[0].wins == 0
        assert standings[0].losses == 1
        assert standings[1].wins == 0
        assert standings[1].losses == 1

    def test_standings_with_forfeit_wins(self):
        """Test forfeit wins are counted correctly."""
        settings = TournamentSettings(num_rounds=2)
        tournament = Tournament.create("Forfeit Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        tournament.add_player(alice)
        tournament.add_player(bob)

        round1 = tournament.get_round(1)
        round1.pairings.append(Pairing.create(alice.id, bob.id, 1))
        round1.pairings[0].result = GameResult.BLACK_WIN_FORFEIT
        round1.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()
        standings = calc.calculate(tournament, through_round=1)

        alice_standing = next(s for s in standings if s.player.id == alice.id)
        bob_standing = next(s for s in standings if s.player.id == bob.id)

        assert alice_standing.wins == 1.0
        assert bob_standing.losses == 1.0

    def test_standings_with_byes(self):
        """Test that byes count as wins in standings."""
        settings = TournamentSettings(num_rounds=2)
        tournament = Tournament.create("Bye Standings", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        carol = Player.create("Carol", "1d")
        for p in [alice, bob, carol]:
            tournament.add_player(p)

        round1 = tournament.get_round(1)
        round1.pairings.append(Pairing.create(alice.id, bob.id, 1))
        round1.pairings[0].result = GameResult.WHITE_WIN
        round1.byes.append(Bye(player_id=carol.id, points=1.0))
        round1.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()
        standings = calc.calculate(tournament, through_round=1)

        carol_standing = next(s for s in standings if s.player.id == carol.id)
        assert carol_standing.wins == 1.0

    def test_standings_ties_same_rank(self):
        """Test that players with same score get same rank."""
        settings = TournamentSettings(num_rounds=2)
        tournament = Tournament.create("Tie Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        carol = Player.create("Carol", "3d")
        dave = Player.create("Dave", "3d")
        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        round1 = tournament.get_round(1)
        # Alice beats Bob, Carol beats Dave
        round1.pairings = [
            Pairing.create(alice.id, bob.id, 1),
            Pairing.create(carol.id, dave.id, 2),
        ]
        round1.pairings[0].result = GameResult.BLACK_WIN
        round1.pairings[1].result = GameResult.BLACK_WIN
        round1.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()
        standings = calc.calculate(tournament, through_round=1)

        # Alice and Carol both have 1 win
        winners = [s for s in standings if s.wins == 1.0]
        assert len(winners) == 2
        # They should have the same rank (1)
        assert winners[0].rank == winners[1].rank == 1

    def test_standings_auto_detect_last_round(self):
        """Test that standings auto-detect last completed/in-progress round."""
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Auto Detect", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        tournament.add_player(alice)
        tournament.add_player(bob)

        # Mark round 1 as completed - Alice (white) wins
        round1 = tournament.get_round(1)
        round1.pairings.append(Pairing.create(bob.id, alice.id, 1))  # bob black, alice white
        round1.pairings[0].result = GameResult.WHITE_WIN  # Alice wins
        round1.status = RoundStatus.COMPLETED

        # Mark round 2 as in progress - Alice (white) wins again
        round2 = tournament.get_round(2)
        round2.pairings.append(Pairing.create(bob.id, alice.id, 1))  # bob black, alice white
        round2.pairings[0].result = GameResult.WHITE_WIN  # Alice wins
        round2.status = RoundStatus.IN_PROGRESS

        calc = StandingsCalculator()
        standings = calc.calculate(tournament)  # No through_round specified

        # Should include both rounds
        alice_standing = next(s for s in standings if s.player.id == alice.id)
        assert alice_standing.wins == 2.0  # Won both rounds

    def test_standings_extended_sos(self):
        """Test extended SOS calculation (SOS of opponents)."""
        weights = StandingsWeights(wins=1.0, sos=0.1, sodos=0.05, extended_sos=0.01)
        calc = StandingsCalculator(weights=weights)

        settings = TournamentSettings(num_rounds=3)
        tournament = Tournament.create("Extended SOS", settings)

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
        r1.pairings[0].result = GameResult.WHITE_WIN
        r1.pairings[1].result = GameResult.WHITE_WIN
        r1.status = RoundStatus.COMPLETED

        # Round 2: Alice beats Carol, Bob beats Dave
        r2 = tournament.get_round(2)
        r2.pairings = [
            Pairing.create(carol.id, alice.id, 1),
            Pairing.create(dave.id, bob.id, 2),
        ]
        r2.pairings[0].result = GameResult.WHITE_WIN
        r2.pairings[1].result = GameResult.WHITE_WIN
        r2.status = RoundStatus.COMPLETED

        standings = calc.calculate(tournament, through_round=2)

        # Verify extended SOS is calculated
        alice_standing = next(s for s in standings if s.player.id == alice.id)
        assert alice_standing.extended_sos > 0  # Should have some extended SOS

    def test_player_standing_str(self):
        """Test PlayerStanding string representation."""
        player = Player.create("Test Player", "3d")
        standing = PlayerStanding(
            rank=1,
            player=player,
            wins=3.0,
            losses=1.0,
            sos=5.0,
            sodos=3.0,
            extended_sos=10.0,
            total_score=3.55
        )

        str_repr = str(standing)
        assert "1. Test Player (3d)" in str_repr
        assert "W:3.0" in str_repr
        assert "L:1.0" in str_repr


class TestPairingColorAssignment:
    """Test color assignment edge cases."""

    def test_weaker_player1_gets_black(self):
        """Test that when player1 is weaker, they get black."""
        settings = TournamentSettings(
            num_rounds=2,
            pairing_algorithm=PairingAlgorithm.SWISS,
            handicap_enabled=True
        )
        tournament = Tournament.create("Color Test", settings)

        # Add only two players with significant rank difference
        # Player order matters - put weaker player first
        weak = Player.create("Weak", "10k")
        strong = Player.create("Strong", "3d")
        tournament.add_player(weak)
        tournament.add_player(strong)

        engine = SwissPairingEngine()
        result = engine.generate_pairings(tournament, 1)

        # Stronger player should be white
        pairing = result.pairings[0]
        assert pairing.white_player_id == strong.id
        assert pairing.black_player_id == weak.id

    def test_color_balance_gives_white_to_black_heavy_player(self):
        """Test that player who played more black gets white next."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.SWISS,
            handicap_enabled=False  # Even games for pure color balancing
        )
        tournament = Tournament.create("Balance Test", settings)

        # Four players of same rank
        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        carol = Player.create("Carol", "3d")
        dave = Player.create("Dave", "3d")

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        # Manually set up round 1 where alice plays black twice
        round1 = tournament.get_round(1)
        round1.pairings = [
            Pairing.create(alice.id, bob.id, 1),  # Alice black
            Pairing.create(carol.id, dave.id, 2),
        ]
        for p in round1.pairings:
            p.result = GameResult.BLACK_WIN
        round1.status = RoundStatus.COMPLETED

        # Round 2 - set Alice as black again
        round2 = tournament.get_round(2)
        round2.pairings = [
            Pairing.create(alice.id, carol.id, 1),  # Alice black again
            Pairing.create(bob.id, dave.id, 2),
        ]
        for p in round2.pairings:
            p.result = GameResult.WHITE_WIN
        round2.status = RoundStatus.COMPLETED

        engine = SwissPairingEngine()
        result = engine.generate_pairings(tournament, 3)

        # Alice has played black 2 times, white 0 times
        # She should tend to get white in round 3
        alice_pairing = None
        for p in result.pairings:
            if p.black_player_id == alice.id or p.white_player_id == alice.id:
                alice_pairing = p
                break

        # Alice should be white now (played black 2x, white 0x)
        assert alice_pairing is not None
        assert alice_pairing.white_player_id == alice.id


class TestPairingScoreTracking:
    """Test score tracking through rounds."""

    def test_draw_counts_in_scores(self):
        """Test that draws give 0.5 points for pairing purposes."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.SWISS
        )
        tournament = Tournament.create("Draw Test", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "3d")
        carol = Player.create("Carol", "3d")
        dave = Player.create("Dave", "3d")

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        # Round 1: Alice-Bob draw, Carol beats Dave
        round1 = tournament.get_round(1)
        round1.pairings = [
            Pairing.create(alice.id, bob.id, 1),
            Pairing.create(carol.id, dave.id, 2),
        ]
        round1.pairings[0].result = GameResult.DRAW  # 0.5 each
        round1.pairings[1].result = GameResult.BLACK_WIN  # Carol 1
        round1.status = RoundStatus.COMPLETED

        engine = SwissPairingEngine()

        # Check internal score calculation
        alice_score = engine._get_player_score(tournament, alice.id, 2)
        bob_score = engine._get_player_score(tournament, bob.id, 2)
        carol_score = engine._get_player_score(tournament, carol.id, 2)
        dave_score = engine._get_player_score(tournament, dave.id, 2)

        assert alice_score == 0.5
        assert bob_score == 0.5
        assert carol_score == 1.0
        assert dave_score == 0.0


class TestPairingEngineFactory:
    """Test the pairing engine factory function."""

    def test_get_swiss_engine(self):
        """Test getting Swiss engine."""
        engine = get_pairing_engine(PairingAlgorithm.SWISS)
        assert isinstance(engine, SwissPairingEngine)

    def test_get_mcmahon_engine_with_bar(self):
        """Test getting McMahon engine with custom bar."""
        engine = get_pairing_engine(PairingAlgorithm.MCMAHON, bar_rank="4d")
        assert isinstance(engine, McMahonPairingEngine)
        assert engine.bar_rank == Rank.from_string("4d")

    def test_invalid_algorithm_raises(self):
        """Test that invalid algorithm raises ValueError."""
        # Create a mock invalid algorithm
        class FakeAlgorithm:
            pass

        with pytest.raises(ValueError, match="Unknown pairing algorithm"):
            # This will fail because FakeAlgorithm is not a valid PairingAlgorithm
            get_pairing_engine(FakeAlgorithm())  # type: ignore


class TestModelEdgeCases:
    """Test model edge cases and validation."""

    def test_tournament_settings_validation_min_rounds(self):
        """Test tournament must have at least 1 round."""
        with pytest.raises(ValueError, match="at least 1 round"):
            TournamentSettings(num_rounds=0)

    def test_tournament_settings_validation_max_rounds(self):
        """Test tournament cannot have more than 10 rounds."""
        with pytest.raises(ValueError, match="more than 10 rounds"):
            TournamentSettings(num_rounds=11)

    def test_tournament_get_round_invalid(self):
        """Test getting invalid round number raises error."""
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        with pytest.raises(ValueError, match="Invalid round number"):
            tournament.get_round(0)

        with pytest.raises(ValueError, match="Invalid round number"):
            tournament.get_round(5)

    def test_tournament_remove_player(self):
        """Test removing a player from tournament."""
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Test", settings)

        player = Player.create("Test", "3d")
        tournament.add_player(player)
        assert player.id in tournament.players

        tournament.remove_player(player.id)
        assert player.id not in tournament.players

        # Removing non-existent player should not raise
        tournament.remove_player("non-existent-id")

    def test_player_partial_round_participation(self):
        """Test player participating in only some rounds."""
        settings = TournamentSettings(num_rounds=4)
        tournament = Tournament.create("Partial", settings)

        # Player only in rounds 1 and 3
        partial_player = Player.create("Partial", "3d")
        partial_player.rounds_participating = {1, 3}
        tournament.add_player(partial_player)

        # Full player
        full_player = Player.create("Full", "2d")
        tournament.add_player(full_player)

        # Check participation
        assert partial_player.is_participating_in_round(1) is True
        assert partial_player.is_participating_in_round(2) is False
        assert partial_player.is_participating_in_round(3) is True
        assert partial_player.is_participating_in_round(4) is False

        assert full_player.is_participating_in_round(1) is True
        assert full_player.is_participating_in_round(4) is True

        # Test active players for each round
        active_r1 = tournament.get_active_players(1)
        active_r2 = tournament.get_active_players(2)

        assert len(active_r1) == 2
        assert len(active_r2) == 1
        assert partial_player not in active_r2

    def test_player_hash(self):
        """Test that players can be used in sets/dicts."""
        player1 = Player.create("Test", "3d")
        player2 = Player.create("Test", "3d")  # Different ID

        player_set = {player1, player2}
        assert len(player_set) == 2  # Both should be in set (different IDs)

    def test_player_create_with_rank_object(self):
        """Test creating player with Rank object instead of string."""
        rank = Rank.from_string("5d")
        player = Player.create("Test", rank)
        assert player.rank == rank

    def test_round_get_opponent_id(self):
        """Test getting opponent ID from round."""
        round_ = Round(number=1)

        alice_id = "alice-123"
        bob_id = "bob-456"
        carol_id = "carol-789"

        round_.pairings.append(Pairing.create(alice_id, bob_id, 1))

        # Test from black's perspective
        assert round_.get_opponent_id(alice_id) == bob_id
        # Test from white's perspective
        assert round_.get_opponent_id(bob_id) == alice_id
        # Test for player not in round
        assert round_.get_opponent_id(carol_id) is None

    def test_round_has_bye(self):
        """Test checking if player has bye."""
        round_ = Round(number=1)
        alice_id = "alice-123"
        bob_id = "bob-456"

        round_.byes.append(Bye(player_id=alice_id))

        assert round_.has_bye(alice_id) is True
        assert round_.has_bye(bob_id) is False

    def test_round_get_pairing_for_player_not_found(self):
        """Test getting pairing when player not in round."""
        round_ = Round(number=1)
        round_.pairings.append(Pairing.create("alice", "bob", 1))

        assert round_.get_pairing_for_player("carol") is None
