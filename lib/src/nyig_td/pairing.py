"""Pairing algorithms for Go tournaments."""

from abc import ABC, abstractmethod
from collections import defaultdict
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

        unpaired = [p for p, _ in players_with_scores]
        pairings: list[Pairing] = []
        byes: list[Bye] = []
        board_number = 1

        # Handle odd number of players - fair bye selection
        if len(unpaired) % 2 == 1:
            bye_player = self._select_bye_player(unpaired, tournament, round_number)
            unpaired.remove(bye_player)
            byes.append(Bye(player_id=bye_player.id))
            warnings.append(f"Bye given to {bye_player.name}")

        # Pair players
        while unpaired:
            player = unpaired.pop(0)
            previous_opponents = self._get_previous_opponents(
                tournament, player.id, round_number
            )

            # Find best opponent (similar score, not previously played)
            opponent: Optional[Player] = None
            for candidate in unpaired:
                if candidate.id not in previous_opponents:
                    opponent = candidate
                    break

            if opponent is None:
                # All remaining players were previous opponents
                if unpaired:
                    opponent = unpaired[0]
                    warnings.append(
                        f"Repeat pairing: {player.name} vs {opponent.name}"
                    )
                else:
                    # Odd player out - shouldn't happen
                    byes.append(Bye(player_id=player.id))
                    continue

            unpaired.remove(opponent)

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

        # Calculate McMahon scores
        players_with_mm_scores = [
            (p, self.get_mcmahon_score(tournament, p, round_number))
            for p in active_players
        ]

        pairings: list[Pairing] = []
        byes: list[Bye] = []
        board_number = 1

        # Group players by MMS into score groups
        score_groups: dict[float, list[Player]] = defaultdict(list)
        for player, mm_score in players_with_mm_scores:
            score_groups[mm_score].append(player)

        sorted_scores = sorted(score_groups.keys(), reverse=True)

        # Handle odd total: select bye player from all candidates
        all_players = [p for p, _ in players_with_mm_scores]
        if len(all_players) % 2 == 1:
            bye_player = self._select_bye_player(all_players, tournament, round_number)
            score_groups[self.get_mcmahon_score(tournament, bye_player, round_number)].remove(bye_player)
            byes.append(Bye(player_id=bye_player.id))
            warnings.append(f"Bye given to {bye_player.name}")
            # Remove empty score groups
            score_groups = {k: v for k, v in score_groups.items() if v}
            sorted_scores = sorted(score_groups.keys(), reverse=True)

        floater: Optional[Player] = None

        for idx, score in enumerate(sorted_scores):
            group = score_groups[score]

            if floater:
                group.insert(0, floater)  # Add floater at top (from higher group)
                floater = None

            # Sort by rank descending (strongest first within group)
            group.sort(key=lambda p: -p.rank.value)

            if len(group) % 2 == 1:
                if idx == len(sorted_scores) - 1:
                    # Last group — give bye to weakest if no bye yet, else just pop
                    if not byes:
                        bye_candidate = self._select_bye_player(group, tournament, round_number)
                        group.remove(bye_candidate)
                        byes.append(Bye(player_id=bye_candidate.id))
                        warnings.append(f"Bye given to {bye_candidate.name}")
                    else:
                        # Float to create a pair with leftover — handled after loop
                        floater = group.pop()
                else:
                    # Float weakest player down to next group
                    floater = group.pop()

            # Split and pair within group: top half vs bottom half
            mid = len(group) // 2
            top_half = group[:mid]
            bottom_half = group[mid:]

            for i in range(len(top_half)):
                player = top_half[i]
                opponent = bottom_half[i]
                previous_opponents = self._get_previous_opponents(
                    tournament, player.id, round_number
                )

                # Swap within bottom half to avoid repeats
                if opponent.id in previous_opponents:
                    swapped = False
                    for j in range(len(bottom_half)):
                        if j != i and bottom_half[j].id not in previous_opponents:
                            # Also check the player at position j isn't a repeat for top_half[j]
                            bottom_half[i], bottom_half[j] = bottom_half[j], bottom_half[i]
                            opponent = bottom_half[i]
                            swapped = True
                            break
                    if not swapped:
                        warnings.append(
                            f"Repeat pairing: {player.name} vs {opponent.name}"
                        )

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

        # Handle leftover floater after all groups processed
        if floater:
            byes.append(Bye(player_id=floater.id))
            warnings.append(f"Bye given to {floater.name}")

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
