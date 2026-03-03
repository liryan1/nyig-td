"""Handicap calculation for Go games."""

from dataclasses import dataclass
from .ranks import Rank


@dataclass(frozen=True)
class Handicap:
    """Represents handicap settings for a game."""
    stones: int  # 0-9 handicap stones
    komi: float  # Points given to white

    def __str__(self) -> str:
        if self.stones == 0:
            return f"Even game, komi {self.komi}"
        return f"{self.stones} stones, komi {self.komi}"


class HandicapCalculator:
    """
    Calculate appropriate handicap for a game between two players.

    Standard AGA handicap rules:
    - Even game: 7.5 komi to white
    - 1 stone difference: No handicap, 0.5 komi
    - 2+ stones: (difference) handicap stones, 0.5 komi
    - Maximum 9 handicap stones
    """

    DEFAULT_EVEN_KOMI = 7.5
    DEFAULT_HANDICAP_KOMI = 0.5
    MAX_HANDICAP_STONES = 9

    def __init__(
        self,
        even_komi: float = DEFAULT_EVEN_KOMI,
        handicap_komi: float = DEFAULT_HANDICAP_KOMI,
        max_stones: int = MAX_HANDICAP_STONES,
        reduction: int = 0,
    ):
        """
        Initialize handicap calculator.

        Args:
            even_komi: Komi for even games (default 7.5)
            handicap_komi: Komi for handicap games (default 0.5)
            max_stones: Maximum handicap stones (default 9)
            reduction: Reduce calculated handicap by this amount (default 0)
        """
        self.even_komi = even_komi
        self.handicap_komi = handicap_komi
        self.max_stones = max_stones
        self.reduction = reduction

    def calculate(self, white_rank: Rank, black_rank: Rank) -> Handicap:
        """
        Calculate handicap for a game.

        The stronger player typically plays white.

        Args:
            white_rank: Rank of white player (typically stronger)
            black_rank: Rank of black player (typically weaker)

        Returns:
            Handicap with stones and komi
        """
        diff = white_rank.difference(black_rank)

        if diff <= 0:
            # Black is equal or stronger - even game
            return Handicap(stones=0, komi=self.even_komi)

        # Apply reduction
        effective_diff = max(0, diff - self.reduction)

        if effective_diff == 0:
            return Handicap(stones=0, komi=self.even_komi)

        if effective_diff == 1:
            # 1 rank difference: no stones, reduced komi
            return Handicap(stones=0, komi=self.handicap_komi)

        # 2+ rank difference: handicap stones
        stones = min(effective_diff, self.max_stones)
        return Handicap(stones=stones, komi=self.handicap_komi)

    def calculate_from_strings(self, white_rank: str, black_rank: str) -> Handicap:
        """Convenience method to calculate from rank strings."""
        return self.calculate(
            Rank.from_string(white_rank),
            Rank.from_string(black_rank)
        )


def suggest_colors(rank1: Rank, rank2: Rank) -> tuple[Rank, Rank]:
    """
    Suggest which player should play white (stronger) and black (weaker).

    Returns: (white_rank, black_rank)
    """
    if rank1 >= rank2:
        return (rank1, rank2)
    return (rank2, rank1)
