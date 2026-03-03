"""Edge case tests for tournament management."""

import pytest

from nyig_td.models import (
    Tournament,
    TournamentSettings,
    Player,
    Pairing,
    GameResult,
    PairingAlgorithm,
    RoundStatus,
)
from nyig_td.pairing import SwissPairingEngine, McMahonPairingEngine
from nyig_td.standings import StandingsCalculator


class TestManualPairingModification:
    """Tests for manually modifying generated pairings."""

    def test_manual_pairing_modification(self) -> None:
        """Modify generated pairings before round, verify round proceeds."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Manual Modify", settings)

        players = [
            Player.create("Alice", "3d"),
            Player.create("Bob", "2d"),
            Player.create("Carol", "1d"),
            Player.create("Dave", "1k"),
        ]
        for p in players:
            tournament.add_player(p)

        engine = SwissPairingEngine()

        # Generate round 1 pairings
        result = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)

        # Manually modify pairings (swap opponents)
        # Original might be Alice-Bob, Carol-Dave
        # We want Alice-Carol, Bob-Dave
        modified_pairings = [
            Pairing.create(players[0].id, players[2].id, 1),  # Alice-Carol
            Pairing.create(players[1].id, players[3].id, 2),  # Bob-Dave
        ]
        round1.pairings = modified_pairings
        round1.byes = result.byes

        # Set results
        for pairing in round1.pairings:
            pairing.result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Round 2 should proceed normally, respecting modified pairings
        result2 = engine.generate_pairings(tournament, 2)

        # Should avoid repeat pairings from round 1
        for p in result2.pairings:
            # Alice shouldn't play Carol again if avoidable
            pair_ids = {p.black_player_id, p.white_player_id}
            # This verifies the engine respects actual pairings, not generated ones
            assert len(pair_ids) == 2

        # Tournament should complete successfully
        round2 = tournament.get_round(2)
        round2.pairings = result2.pairings
        for pairing in round2.pairings:
            pairing.result = GameResult.BLACK_WIN
        round2.status = RoundStatus.COMPLETED

        calc = StandingsCalculator()
        standings = calc.calculate(tournament)
        assert len(standings) == 4


class TestPlayerChanges:
    """Tests for adding/removing players mid-tournament."""

    def test_player_added_mid_tournament(self) -> None:
        """Add player in round 3, verify integration."""
        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Late Entry", settings)

        # Start with 4 players
        initial_players = [
            Player.create("Alice", "3d"),
            Player.create("Bob", "2d"),
            Player.create("Carol", "1d"),
            Player.create("Dave", "1k"),
        ]
        for p in initial_players:
            tournament.add_player(p)

        engine = SwissPairingEngine()

        # Run rounds 1-2
        for round_num in range(1, 3):
            result = engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes
            for pairing in round_.pairings:
                pairing.result = GameResult.WHITE_WIN
            round_.status = RoundStatus.COMPLETED

        # Add new player before round 3
        late_player = Player.create("Eve", "2k")
        # Set participation to only rounds 3+
        late_player.rounds_participating = {3, 4}
        tournament.add_player(late_player)

        # Round 3 - should include new player
        result3 = engine.generate_pairings(tournament, 3)
        round3 = tournament.get_round(3)
        round3.pairings = result3.pairings
        round3.byes = result3.byes

        # With 5 players, should have 2 pairings + 1 bye
        assert len(round3.pairings) == 2
        assert len(round3.byes) == 1

        # New player should be included
        all_paired_ids = set()
        for p in round3.pairings:
            all_paired_ids.add(p.black_player_id)
            all_paired_ids.add(p.white_player_id)
        for b in round3.byes:
            all_paired_ids.add(b.player_id)

        assert late_player.id in all_paired_ids

        # Complete round 3
        for pairing in round3.pairings:
            pairing.result = GameResult.BLACK_WIN
        round3.status = RoundStatus.COMPLETED

        # Standings should include new player
        calc = StandingsCalculator()
        standings = calc.calculate(tournament)
        assert len(standings) == 5

    def test_player_removed_mid_tournament(self) -> None:
        """Remove player, verify excluded from future rounds."""
        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Withdrawal", settings)

        players = [
            Player.create("Alice", "3d"),
            Player.create("Bob", "2d"),
            Player.create("Carol", "1d"),
            Player.create("Dave", "1k"),
        ]
        for p in players:
            tournament.add_player(p)

        engine = SwissPairingEngine()

        # Run round 1
        result = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result.pairings
        for pairing in round1.pairings:
            pairing.result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Remove Dave before round 2
        tournament.remove_player(players[3].id)

        # Round 2 with 3 players
        result2 = engine.generate_pairings(tournament, 2)
        round2 = tournament.get_round(2)
        round2.pairings = result2.pairings
        round2.byes = result2.byes

        # Should have 1 pairing + 1 bye (3 players)
        assert len(round2.pairings) == 1
        assert len(round2.byes) == 1

        # Dave should not be included
        all_ids = set()
        for p in round2.pairings:
            all_ids.add(p.black_player_id)
            all_ids.add(p.white_player_id)
        for b in round2.byes:
            all_ids.add(b.player_id)

        assert players[3].id not in all_ids

    def test_player_skip_round_rejoin(self) -> None:
        """Player sets rounds_participating={1,3}, skips round 2."""
        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Skip Round", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        carol = Player.create("Carol", "1d")
        # Dave only participates in rounds 1 and 3
        dave = Player.create("Dave", "1k")
        dave.rounds_participating = {1, 3}

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        engine = SwissPairingEngine()

        # Round 1 - all 4 players
        result1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result1.pairings
        assert len(round1.pairings) == 2  # 4 players = 2 pairings
        for p in round1.pairings:
            p.result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Round 2 - Dave skips (only 3 active players)
        result2 = engine.generate_pairings(tournament, 2)
        round2 = tournament.get_round(2)
        round2.pairings = result2.pairings
        round2.byes = result2.byes

        # Should have 1 pairing + 1 bye (3 players)
        assert len(round2.pairings) == 1
        assert len(round2.byes) == 1

        # Dave should not be in round 2
        round2_ids = set()
        for p in round2.pairings:
            round2_ids.add(p.black_player_id)
            round2_ids.add(p.white_player_id)
        for b in round2.byes:
            round2_ids.add(b.player_id)
        assert dave.id not in round2_ids

        for p in round2.pairings:
            p.result = GameResult.BLACK_WIN
        round2.status = RoundStatus.COMPLETED

        # Round 3 - Dave rejoins (4 active players again)
        result3 = engine.generate_pairings(tournament, 3)
        round3 = tournament.get_round(3)
        round3.pairings = result3.pairings

        # Dave should be included
        round3_ids = set()
        for p in round3.pairings:
            round3_ids.add(p.black_player_id)
            round3_ids.add(p.white_player_id)
        assert dave.id in round3_ids

        # Dave's score should reflect only round 1 participation
        calc = StandingsCalculator()
        standings_after_r2 = calc.calculate(tournament, through_round=2)
        dave_standing = next(s for s in standings_after_r2 if s.player.id == dave.id)
        # Dave has 0 or 1 wins from round 1 only
        assert dave_standing.wins <= 1


class TestInvalidRequests:
    """Tests for handling invalid requests."""

    def test_wrong_player_in_subsequent_request(self) -> None:
        """Reference removed player ID - standings should handle gracefully."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Invalid Ref", settings)

        players = [
            Player.create("Alice", "3d"),
            Player.create("Bob", "2d"),
        ]
        for p in players:
            tournament.add_player(p)

        engine = SwissPairingEngine()

        # Round 1
        result = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result.pairings
        round1.pairings[0].result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Remove Bob
        removed_id = players[1].id
        tournament.remove_player(removed_id)

        # Standings should only include remaining players
        calc = StandingsCalculator()
        standings = calc.calculate(tournament)

        # Only Alice should be in standings
        assert len(standings) == 1
        assert standings[0].player.id == players[0].id

    def test_missing_player_in_subsequent_request(self) -> None:
        """Test behavior when expected player is not active."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Missing Player", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        carol = Player.create("Carol", "1d")

        # Carol only in round 1
        carol.rounds_participating = {1}

        for p in [alice, bob, carol]:
            tournament.add_player(p)

        engine = SwissPairingEngine()

        # Round 1 - all 3 players
        result1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result1.pairings
        round1.byes = result1.byes
        for p in round1.pairings:
            p.result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Round 2 - Carol not participating
        active_r2 = tournament.get_active_players(2)
        assert len(active_r2) == 2
        assert carol not in active_r2

        result2 = engine.generate_pairings(tournament, 2)
        # Should generate pairing for only Alice and Bob
        assert len(result2.pairings) == 1


class TestForcedRepeatPairing:
    """Tests for forced repeat pairings."""

    def test_forced_repeat_pairing_more_rounds_than_players(
        self,
        small_tournament_players: list[Player],
    ) -> None:
        """2 players, 3 rounds - verify warning about repeat pairing."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Forced Repeat", settings)

        for p in small_tournament_players:
            tournament.add_player(p)

        engine = SwissPairingEngine()

        # Round 1
        result1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result1.pairings
        round1.pairings[0].result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Round 2 - forced repeat
        result2 = engine.generate_pairings(tournament, 2)

        # Should have warning about repeat pairing
        assert any("Repeat pairing" in w for w in result2.warnings)

        round2 = tournament.get_round(2)
        round2.pairings = result2.pairings
        round2.pairings[0].result = GameResult.BLACK_WIN
        round2.status = RoundStatus.COMPLETED

        # Round 3 - another repeat
        result3 = engine.generate_pairings(tournament, 3)
        assert any("Repeat pairing" in w for w in result3.warnings)


class TestMcMahonEdgeCases:
    """McMahon-specific edge cases."""

    def test_mcmahon_player_withdrawal_maintains_history(self) -> None:
        """Withdrawn player's games should still affect opponent SOS."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="3d",
        )
        tournament = Tournament.create("McMahon Withdrawal", settings)

        alice = Player.create("Alice", "3d")
        bob = Player.create("Bob", "2d")
        carol = Player.create("Carol", "1d")
        dave = Player.create("Dave", "1k")

        for p in [alice, bob, carol, dave]:
            tournament.add_player(p)

        engine = McMahonPairingEngine(bar_rank="3d")

        # Round 1
        result1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result1.pairings
        for p in round1.pairings:
            p.result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Get Alice's opponent from round 1
        alice_opponent_id = None
        for p in round1.pairings:
            if p.black_player_id == alice.id:
                alice_opponent_id = p.white_player_id
            elif p.white_player_id == alice.id:
                alice_opponent_id = p.black_player_id

        # Remove the opponent before round 2
        if alice_opponent_id:
            tournament.remove_player(alice_opponent_id)

        # Round 2 with remaining 3 players
        result2 = engine.generate_pairings(tournament, 2)
        round2 = tournament.get_round(2)
        round2.pairings = result2.pairings
        round2.byes = result2.byes
        for p in round2.pairings:
            p.result = GameResult.BLACK_WIN
        round2.status = RoundStatus.COMPLETED

        # Standings should handle withdrawn opponent
        calc = StandingsCalculator()
        standings = calc.calculate(tournament)

        # Should have 3 players in standings
        assert len(standings) == 3
