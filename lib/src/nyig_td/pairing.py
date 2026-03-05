"""Pairing algorithms for Go tournaments."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import random

from .models import (
    Player, Pairing, Bye, Tournament,
    GameResult, PairingAlgorithm, HandicapType
)
from .handicap import HandicapCalculator, modifier_to_reduction
from .ranks import Rank


@dataclass
class PairingResult:
    """Result of pairing generation."""
    pairings: list[Pairing]
    byes: list[Bye]
    warnings: list[str]


class PairingEngine(ABC):
    """Abstract base class for pairing algorithms."""

    @abstractmethod
    def generate_pairings(
        self,
        tournament: Tournament,
        round_number: int,
    ) -> PairingResult:
        """Generate pairings for a round."""
        pass

    def _get_previous_opponents(
        self,
        tournament: Tournament,
        player_id: str,
        up_to_round: int,
    ) -> set[str]:
        """Get all previous opponents for a player."""
        opponents = set()
        for i in range(up_to_round - 1):
            round_ = tournament.rounds[i]
            opponent_id = round_.get_opponent_id(player_id)
            if opponent_id:
                opponents.add(opponent_id)
        return opponents

    def _count_colors(
        self,
        tournament: Tournament,
        player_id: str,
        up_to_round: int,
    ) -> tuple[int, int]:
        """Count how many times player has played black and white."""
        black_count = 0
        white_count = 0
        for i in range(up_to_round - 1):
            round_ = tournament.rounds[i]
            pairing = round_.get_pairing_for_player(player_id)
            if pairing:
                if pairing.black_player_id == player_id:
                    black_count += 1
                else:
                    white_count += 1
        return black_count, white_count

    def _get_player_score(
        self,
        tournament: Tournament,
        player_id: str,
        up_to_round: int,
    ) -> float:
        """Calculate player's score through specified round."""
        score = 0.0
        for i in range(up_to_round - 1):
            round_ = tournament.rounds[i]
            pairing = round_.get_pairing_for_player(player_id)
            if pairing:
                if (pairing.black_player_id == player_id and
                    pairing.result in (GameResult.BLACK_WIN, GameResult.BLACK_WIN_FORFEIT)):
                    score += 1.0
                elif (pairing.white_player_id == player_id and
                      pairing.result in (GameResult.WHITE_WIN, GameResult.WHITE_WIN_FORFEIT)):
                    score += 1.0
                elif pairing.result == GameResult.DRAW:
                    score += 0.5
            elif round_.has_bye(player_id):
                bye = next(b for b in round_.byes if b.player_id == player_id)
                score += bye.points
        return score

    def _count_byes_received(
        self,
        tournament: Tournament,
        player_id: str,
        up_to_round: int,
    ) -> int:
        """Count how many byes a player has received in prior rounds."""
        count = 0
        for i in range(up_to_round - 1):
            if tournament.rounds[i].has_bye(player_id):
                count += 1
        return count

    def _select_bye_player(
        self,
        candidates: list[Player],
        tournament: Tournament,
        round_number: int,
    ) -> Player:
        """Select bye recipient: prefer player who hasn't had a bye, then lowest score."""
        return min(candidates, key=lambda p: (
            self._count_byes_received(tournament, p.id, round_number),
            self._get_player_score(tournament, p.id, round_number),
            p.rank.value,  # Weakest player gets bye among ties
        ))

    def _find_pairings_backtrack(
        self,
        players: list[Player],
        tournament: Tournament,
        round_number: int,
        score_fn: dict[str, float],
    ) -> tuple[list[tuple[Player, Player]], list[str]]:
        """Find pairings that minimize repeats using backtracking.

        Tries closest-score non-repeat opponents first, backtracks if a
        choice would force avoidable repeats later. Falls back to greedy
        with repeats only when no repeat-free solution exists.
        """
        # Pre-compute previous opponents for all players
        prev_opps: dict[str, set[str]] = {
            p.id: self._get_previous_opponents(tournament, p.id, round_number)
            for p in players
        }

        result: list[tuple[Player, Player]] = []

        def backtrack(remaining: list[Player]) -> bool:
            if not remaining:
                return True
            player = remaining[0]
            rest = remaining[1:]
            p_score = score_fn[player.id]

            # Try candidates sorted by score closeness
            candidates = sorted(
                rest, key=lambda c: abs(p_score - score_fn[c.id])
            )
            for candidate in candidates:
                if candidate.id not in prev_opps[player.id]:
                    new_remaining = [p for p in rest if p.id != candidate.id]
                    result.append((player, candidate))
                    if backtrack(new_remaining):
                        return True
                    result.pop()
            return False

        if backtrack(players):
            return result, []

        # Backtracking found no repeat-free solution — use greedy with repeats
        warnings: list[str] = []
        remaining = list(players)
        greedy_result: list[tuple[Player, Player]] = []

        while remaining:
            player = remaining.pop(0)
            p_score = score_fn[player.id]

            # Prefer closest-score non-repeat
            opponent: Optional[Player] = None
            best_diff = float("inf")
            for c in remaining:
                if c.id in prev_opps[player.id]:
                    continue
                diff = abs(p_score - score_fn[c.id])
                if diff < best_diff:
                    best_diff = diff
                    opponent = c

            if opponent is None and remaining:
                opponent = min(
                    remaining, key=lambda c: abs(p_score - score_fn[c.id])
                )
                warnings.append(
                    f"Repeat pairing: {player.name} vs {opponent.name}"
                )

            if opponent is None:
                break

            remaining.remove(opponent)
            greedy_result.append((player, opponent))

        return greedy_result, warnings

    def _assign_colors(
        self,
        tournament: Tournament,
        player1: Player,
        player2: Player,
        round_number: int,
    ) -> tuple[Player, Player]:
        """
        Assign colors (black, white) to two players.

        Considers:
        1. Rank difference (stronger plays white in handicap)
        2. Color history balance
        """
        # Check rank difference
        rank_diff = player1.rank.difference(player2.rank)

        if abs(rank_diff) >= 2 and tournament.settings.handicap_type != HandicapType.NONE:
            # Significant rank difference - stronger plays white
            if rank_diff > 0:
                return (player2, player1)  # player1 is stronger, plays white
            return (player1, player2)  # player2 is stronger, plays white

        # Balance colors based on history
        p1_black, p1_white = self._count_colors(tournament, player1.id, round_number)
        p2_black, p2_white = self._count_colors(tournament, player2.id, round_number)

        p1_balance = p1_black - p1_white  # Positive means played more black
        p2_balance = p2_black - p2_white

        if p1_balance > p2_balance:
            # Player 1 has played more black, give them white
            return (player2, player1)
        elif p2_balance > p1_balance:
            return (player1, player2)

        # Random if equal
        if random.random() < 0.5:
            return (player1, player2)
        return (player2, player1)


class SwissPairingEngine(PairingEngine):
    """
    Swiss pairing algorithm.

    Pairs players with similar scores, avoiding repeat pairings.
    """

    def generate_pairings(
        self,
        tournament: Tournament,
        round_number: int,
    ) -> PairingResult:
        warnings: list[str] = []
        handicap_calc = HandicapCalculator(
            reduction=modifier_to_reduction(tournament.settings.handicap_modifier)
        )

        # Get active players for this round
        active_players = tournament.get_active_players(round_number)

        # Sort by score (descending), then by rank
        players_with_scores = [
            (p, self._get_player_score(tournament, p.id, round_number))
            for p in active_players
        ]
        players_with_scores.sort(key=lambda x: (-x[1], -x[0].rank.value))

        ordered_players = [p for p, _ in players_with_scores]
        score_map: dict[str, float] = {p.id: s for p, s in players_with_scores}
        pairings: list[Pairing] = []
        byes: list[Bye] = []
        board_number = 1

        # Handle odd number of players - fair bye selection
        if len(ordered_players) % 2 == 1:
            bye_player = self._select_bye_player(ordered_players, tournament, round_number)
            ordered_players.remove(bye_player)
            byes.append(Bye(player_id=bye_player.id))
            warnings.append(f"Bye given to {bye_player.name}")

        # Find pairings with backtracking to avoid unnecessary repeats
        paired, pair_warnings = self._find_pairings_backtrack(
            ordered_players, tournament, round_number, score_map,
        )
        warnings.extend(pair_warnings)

        for player, opponent in paired:
            # Assign colors
            black, white = self._assign_colors(
                tournament, player, opponent, round_number
            )

            # Calculate handicap
            if tournament.settings.handicap_type != HandicapType.NONE:
                handicap = handicap_calc.calculate(white.rank, black.rank)
            else:
                handicap = handicap_calc.calculate(white.rank, white.rank)  # Even

            pairing = Pairing.create(
                black_player_id=black.id,
                white_player_id=white.id,
                board_number=board_number,
                handicap_stones=handicap.stones,
                komi=handicap.komi,
            )
            pairings.append(pairing)
            board_number += 1

        return PairingResult(pairings=pairings, byes=byes, warnings=warnings)


class McMahonPairingEngine(PairingEngine):
    """
    McMahon pairing algorithm.

    Players start with different scores based on rank (McMahon score).
    Pairs players with similar McMahon scores.
    """

    def __init__(self, bar_rank: Optional[str] = None):
        """
        Initialize McMahon pairing.

        Args:
            bar_rank: Rank at the "bar" (e.g., "3d"). Players at or above
                     this rank start with score 0. Others start negative.
        """
        self.bar_rank = Rank.from_string(bar_rank) if bar_rank else Rank.from_dan(3)

    def get_initial_mcmahon_score(self, player: Player) -> int:
        """Calculate initial McMahon score for a player."""
        return player.get_initial_mcmahon_score(self.bar_rank)

    def get_mcmahon_score(
        self,
        tournament: Tournament,
        player: Player,
        up_to_round: int,
    ) -> float:
        """Get current McMahon score (initial + wins)."""
        initial = self.get_initial_mcmahon_score(player)
        wins = self._get_player_score(tournament, player.id, up_to_round)
        return initial + wins

    def generate_pairings(
        self,
        tournament: Tournament,
        round_number: int,
    ) -> PairingResult:
        warnings: list[str] = []
        handicap_calc = HandicapCalculator(
            reduction=modifier_to_reduction(tournament.settings.handicap_modifier)
        )

        # Update bar from settings if provided
        if tournament.settings.mcmahon_bar:
            self.bar_rank = Rank.from_string(tournament.settings.mcmahon_bar)

        # Get active players
        active_players = tournament.get_active_players(round_number)

        # Calculate McMahon scores and sort by MMS desc, then rank desc
        players_with_mm_scores = [
            (p, self.get_mcmahon_score(tournament, p, round_number))
            for p in active_players
        ]
        players_with_mm_scores.sort(key=lambda x: (-x[1], -x[0].rank.value))

        pairings: list[Pairing] = []
        byes: list[Bye] = []
        board_number = 1

        # Handle odd total: fair bye selection
        all_players = [p for p, _ in players_with_mm_scores]
        if len(all_players) % 2 == 1:
            bye_player = self._select_bye_player(all_players, tournament, round_number)
            players_with_mm_scores = [
                (p, s) for p, s in players_with_mm_scores if p.id != bye_player.id
            ]
            byes.append(Bye(player_id=bye_player.id))
            warnings.append(f"Bye given to {bye_player.name}")

        # Build MMS lookup and player list (ordered by MMS desc, rank desc)
        mm_scores: dict[str, float] = {p.id: s for p, s in players_with_mm_scores}
        ordered_players = [p for p, _ in players_with_mm_scores]

        # Find pairings with backtracking to avoid unnecessary repeats
        paired, pair_warnings = self._find_pairings_backtrack(
            ordered_players, tournament, round_number, mm_scores,
        )
        warnings.extend(pair_warnings)

        for player, opponent in paired:
            # Assign colors
            black, white = self._assign_colors(
                tournament, player, opponent, round_number
            )

            # Calculate handicap
            if tournament.settings.handicap_type != HandicapType.NONE:
                handicap = handicap_calc.calculate(white.rank, black.rank)
            else:
                handicap = handicap_calc.calculate(white.rank, white.rank)

            pairing = Pairing.create(
                black_player_id=black.id,
                white_player_id=white.id,
                board_number=board_number,
                handicap_stones=handicap.stones,
                komi=handicap.komi,
            )
            pairings.append(pairing)
            board_number += 1

        return PairingResult(pairings=pairings, byes=byes, warnings=warnings)


def get_pairing_engine(
    algorithm: PairingAlgorithm,
    bar_rank: Optional[str] = None,
) -> PairingEngine:
    """Factory function to get appropriate pairing engine."""
    if algorithm == PairingAlgorithm.SWISS:
        return SwissPairingEngine()
    elif algorithm == PairingAlgorithm.MCMAHON:
        return McMahonPairingEngine(bar_rank=bar_rank)
    raise ValueError(f"Unknown pairing algorithm: {algorithm}")
