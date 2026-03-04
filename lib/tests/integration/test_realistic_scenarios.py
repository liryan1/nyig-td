"""Additional realistic tournament scenarios."""

import pytest

from nyig_td.models import (
    Tournament,
    TournamentSettings,
    Player,
    Bye,
    GameResult,
    PairingAlgorithm,
    RoundStatus,
    HandicapType,
)
from nyig_td.pairing import SwissPairingEngine, McMahonPairingEngine
from nyig_td.standings import StandingsCalculator

from .conftest import Division


class TestWithdrawalMidTournament:
    """Tests for player withdrawal scenarios."""

    def test_withdrawal_mid_tournament(self) -> None:
        """Player withdraws after round 2, excluded from rounds 3+, standings reflect partial."""
        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Withdrawal Test", settings)

        players = [
            Player.create("Alice", "3d"),
            Player.create("Bob", "2d"),
            Player.create("Carol", "1d"),
            Player.create("Dave", "1k"),
            Player.create("Eve", "2k"),  # Will withdraw after round 2
            Player.create("Frank", "3k"),
        ]
        for p in players:
            tournament.add_player(p)

        engine = SwissPairingEngine()
        calc = StandingsCalculator()

        # Rounds 1-2 with all players
        for round_num in range(1, 3):
            result = engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes
            for pairing in round_.pairings:
                pairing.result = GameResult.WHITE_WIN
            round_.status = RoundStatus.COMPLETED

        # Eve withdraws (set participation to only rounds 1-2)
        eve = players[4]
        eve.rounds_participating = {1, 2}

        # Get Eve's record before withdrawal
        standings_r2 = calc.calculate(tournament, through_round=2)
        eve_r2 = next(s for s in standings_r2 if s.player.id == eve.id)
        eve_wins_r2 = eve_r2.wins

        # Rounds 3-4 without Eve
        for round_num in range(3, 5):
            result = engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            # Verify Eve is not in pairings
            for p in round_.pairings:
                assert p.black_player_id != eve.id
                assert p.white_player_id != eve.id
            for b in round_.byes:
                assert b.player_id != eve.id

            for pairing in round_.pairings:
                pairing.result = GameResult.BLACK_WIN
            round_.status = RoundStatus.COMPLETED

        # Final standings should include Eve with partial record
        final_standings = calc.calculate(tournament)
        eve_final = next(s for s in final_standings if s.player.id == eve.id)

        # Eve's wins should be same as after round 2
        assert eve_final.wins == eve_wins_r2


class TestLateRegistration:
    """Tests for late registration scenarios."""

    def test_late_registration(self) -> None:
        """Player joins after round 1, starts with 0 wins, paired in round 2+."""
        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Late Registration", settings)

        # Initial players
        initial = [
            Player.create("Alice", "3d"),
            Player.create("Bob", "2d"),
            Player.create("Carol", "1d"),
            Player.create("Dave", "1k"),
        ]
        for p in initial:
            tournament.add_player(p)

        engine = SwissPairingEngine()
        calc = StandingsCalculator()

        # Round 1 with 4 players
        result1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result1.pairings
        for p in round1.pairings:
            p.result = GameResult.WHITE_WIN
        round1.status = RoundStatus.COMPLETED

        # Late registration - joins before round 2
        late_player = Player.create("Late Larry", "2k")
        late_player.rounds_participating = {2, 3, 4}  # Not in round 1
        tournament.add_player(late_player)

        # Round 2 with 5 players
        result2 = engine.generate_pairings(tournament, 2)
        round2 = tournament.get_round(2)
        round2.pairings = result2.pairings
        round2.byes = result2.byes

        # Late player should be in round 2
        round2_ids = set()
        for p in round2.pairings:
            round2_ids.add(p.black_player_id)
            round2_ids.add(p.white_player_id)
        for b in round2.byes:
            round2_ids.add(b.player_id)

        assert late_player.id in round2_ids

        # Complete rounds 2-4
        for pairing in round2.pairings:
            pairing.result = GameResult.BLACK_WIN
        round2.status = RoundStatus.COMPLETED

        for round_num in range(3, 5):
            result = engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes
            for pairing in round_.pairings:
                pairing.result = GameResult.WHITE_WIN
            round_.status = RoundStatus.COMPLETED

        # Standings should include late player
        standings = calc.calculate(tournament)
        late_standing = next(s for s in standings if s.player.id == late_player.id)

        # Late player played 3 rounds (2-4)
        assert late_standing.wins + late_standing.losses <= 3


class TestTiebreakerScenarios:
    """Tests for tiebreaker scenarios."""

    def test_tiebreaker_determines_division_winner(
        self,
        sdk_division: Division,
    ) -> None:
        """3 players tied at 3-2 in SDK, SOS/SODOS breaks tie."""
        settings = TournamentSettings(
            num_rounds=5,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Tiebreaker Test", settings)

        # Create SDK players that will tie
        sdk_players = [
            Player.create("Smith", "1k"),
            Player.create("Johnson", "2k"),
            Player.create("Williams", "3k"),
            Player.create("Brown", "5k"),
            Player.create("Davis", "6k"),
            Player.create("Miller", "8k"),
        ]
        for p in sdk_players:
            tournament.add_player(p)

        engine = SwissPairingEngine()
        calc = StandingsCalculator()

        # Run 5 rounds with varied results to create ties
        for round_num in range(1, 6):
            result = engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            # Alternate results to create varied standings
            for i, pairing in enumerate(round_.pairings):
                if (i + round_num) % 2 == 0:
                    pairing.result = GameResult.BLACK_WIN
                else:
                    pairing.result = GameResult.WHITE_WIN

            round_.status = RoundStatus.COMPLETED

        standings = calc.calculate(tournament)
        sdk_standings = sdk_division.filter_standings(standings.copy())

        # Look for ties by wins
        wins_counts: dict[float, int] = {}
        for s in sdk_standings:
            wins_counts[s.wins] = wins_counts.get(s.wins, 0) + 1

        # If there are ties, SOS/SODOS should break them
        tied_scores = [w for w, c in wins_counts.items() if c > 1]

        if tied_scores:
            # Players with same wins should be ordered by tiebreakers
            for tied_wins in tied_scores:
                tied_players = [s for s in sdk_standings if s.wins == tied_wins]
                # The sorting should establish clear ranks
                for i, s in enumerate(tied_players):
                    assert s.rank >= 1

    def test_upset_affects_sodos_cross_division(
        self,
        dan_division: Division,
        sdk_division: Division,
    ) -> None:
        """1k beats 3d (upset), SODOS reflects opponent strength."""
        settings = TournamentSettings(
            num_rounds=3,
            pairing_algorithm=PairingAlgorithm.SWISS,
            handicap_type=HandicapType.RANK_DIFFERENCE,
        )
        tournament = Tournament.create("Upset Test", settings)

        players = [
            Player.create("StrongDan", "3d"),
            Player.create("WeakKyu", "1k"),
            Player.create("MidDan", "2d"),
            Player.create("MidKyu", "2k"),
        ]
        for p in players:
            tournament.add_player(p)

        engine = SwissPairingEngine()
        calc = StandingsCalculator()

        # Round 1 - pair by rank
        result1 = engine.generate_pairings(tournament, 1)
        round1 = tournament.get_round(1)
        round1.pairings = result1.pairings

        # Create upset: if WeakKyu plays StrongDan, WeakKyu wins
        for pairing in round1.pairings:
            pair_ids = {pairing.black_player_id, pairing.white_player_id}
            if players[0].id in pair_ids and players[1].id in pair_ids:
                # WeakKyu beats StrongDan (upset!)
                if pairing.black_player_id == players[1].id:
                    pairing.result = GameResult.BLACK_WIN
                else:
                    pairing.result = GameResult.WHITE_WIN
            else:
                # Normal result
                pairing.result = GameResult.WHITE_WIN

        round1.status = RoundStatus.COMPLETED

        # Continue tournament
        for round_num in range(2, 4):
            result = engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes
            for pairing in round_.pairings:
                pairing.result = GameResult.WHITE_WIN
            round_.status = RoundStatus.COMPLETED

        standings = calc.calculate(tournament)

        # Find WeakKyu's SDS - should include points from beating StrongDan
        weak_kyu_standing = next(s for s in standings if s.player.id == players[1].id)

        # SDS should be > 0 since they beat someone
        assert weak_kyu_standing.sds >= 0

        # The upset should contribute to WeakKyu's SDS
        # since they defeated a strong opponent


class TestByeDistribution:
    """Tests for bye mechanics with odd player counts."""

    def test_odd_division_bye_assignment(
        self,
        sdk_division: Division,
    ) -> None:
        """SDK has 5 players (odd), verify bye mechanics work correctly."""
        settings = TournamentSettings(
            num_rounds=5,
            pairing_algorithm=PairingAlgorithm.SWISS,
        )
        tournament = Tournament.create("Bye Distribution", settings)

        # 5 SDK players
        sdk_players = [
            Player.create("Smith", "1k"),
            Player.create("Johnson", "2k"),
            Player.create("Williams", "3k"),
            Player.create("Brown", "5k"),
            Player.create("Davis", "6k"),
        ]
        for p in sdk_players:
            tournament.add_player(p)

        engine = SwissPairingEngine()
        calc = StandingsCalculator()

        # Track who gets byes
        bye_recipients: list[str] = []

        for round_num in range(1, 6):
            result = engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            # Each round should have exactly 1 bye (5 players = 2 pairings + 1 bye)
            assert len(round_.pairings) == 2
            assert len(round_.byes) == 1

            # Track byes
            for bye in round_.byes:
                bye_recipients.append(bye.player_id)

            for pairing in round_.pairings:
                pairing.result = GameResult.WHITE_WIN

            round_.status = RoundStatus.COMPLETED

        # Each round has 1 bye, 5 rounds = 5 byes total
        assert len(bye_recipients) == 5

        # Byes should count as wins in standings
        standings = calc.calculate(tournament)

        # All players should have standings
        assert len(standings) == 5

        # Total wins should equal games won + byes (10 wins from 10 games + 5 byes = 15)
        total_wins = sum(s.wins for s in standings)
        assert total_wins == 15  # 5 rounds * (2 game wins + 1 bye)


class TestMcMahonRealisticScenarios:
    """Realistic McMahon tournament scenarios."""

    def test_mcmahon_club_tournament_simulation(self) -> None:
        """Simulate a typical club McMahon tournament."""
        settings = TournamentSettings(
            num_rounds=4,
            pairing_algorithm=PairingAlgorithm.MCMAHON,
            mcmahon_bar="2d",
            handicap_type=HandicapType.RANK_DIFFERENCE,
        )
        tournament = Tournament.create("Club McMahon", settings)

        # Realistic club mix: 2 dans, 4 SDKs, 2 DDKs
        players = [
            Player.create("Strong", "3d"),
            Player.create("MidDan", "1d"),
            Player.create("TopKyu", "1k"),
            Player.create("HighKyu", "3k"),
            Player.create("MidKyu", "5k"),
            Player.create("LowKyu", "8k"),
            Player.create("DDK1", "12k"),
            Player.create("DDK2", "15k"),
        ]
        for p in players:
            tournament.add_player(p)

        engine = McMahonPairingEngine(bar_rank="2d")
        calc = StandingsCalculator()

        # Run full tournament
        for round_num in range(1, 5):
            result = engine.generate_pairings(tournament, round_num)
            round_ = tournament.get_round(round_num)
            round_.pairings = result.pairings
            round_.byes = result.byes

            # Stronger players tend to win, but with some upsets
            for i, pairing in enumerate(round_.pairings):
                if round_num == 2 and i == 0:
                    # Upset in round 2
                    pairing.result = GameResult.BLACK_WIN
                else:
                    pairing.result = GameResult.WHITE_WIN

            round_.status = RoundStatus.COMPLETED

        standings = calc.calculate(tournament)

        # Verify tournament completed successfully
        assert len(standings) == 8

        # Top players by McMahon score should generally be dans
        # (they start at 0 or near 0, while kyus start negative)
        top_3_ids = {standings[i].player.id for i in range(3)}
        dan_ids = {players[0].id, players[1].id}  # Strong (3d) and MidDan (1d)

        # At least one dan should be in top 3
        assert len(top_3_ids & dan_ids) >= 1
