"""Go rank representation and arithmetic."""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
import re


class RankType(Enum):
    KYU = "kyu"
    DAN = "dan"


@dataclass(frozen=True, order=True)
class Rank:
    """
    Go rank representation.

    Internal value system:
    - 30k = -29
    - 1k = 0
    - 1d = 1
    - 9d = 9

    This allows natural ordering where higher rank = higher value.
    """
    value: int

    # Class constants for valid ranges
    MIN_KYU = 30
    MAX_KYU = 1
    MIN_DAN = 1
    MAX_DAN = 9

    @classmethod
    def from_string(cls, rank_str: str) -> Rank:
        """
        Parse rank from string format.

        Examples: "5k", "3d", "1D", "10K"
        """
        rank_str = rank_str.strip().lower()
        match = re.match(r"^(\d+)([kd])$", rank_str)

        if not match:
            raise ValueError(f"Invalid rank format: {rank_str}. Expected format like '5k' or '3d'")

        number = int(match.group(1))
        rank_type = match.group(2)

        if rank_type == "k":
            if not (cls.MAX_KYU <= number <= cls.MIN_KYU):
                raise ValueError(f"Kyu rank must be between {cls.MAX_KYU}k and {cls.MIN_KYU}k")
            return cls(value=-(number - 1))  # 1k=0, 30k=-29
        else:  # dan
            if not (cls.MIN_DAN <= number <= cls.MAX_DAN):
                raise ValueError(f"Dan rank must be between {cls.MIN_DAN}d and {cls.MAX_DAN}d")
            return cls(value=number)

    @classmethod
    def from_kyu(cls, kyu: int) -> Rank:
        """Create rank from kyu level (1-30)."""
        if not (cls.MAX_KYU <= kyu <= cls.MIN_KYU):
            raise ValueError(f"Kyu must be between {cls.MAX_KYU} and {cls.MIN_KYU}")
        return cls(value=-(kyu - 1))

    @classmethod
    def from_dan(cls, dan: int) -> Rank:
        """Create rank from dan level (1-9)."""
        if not (cls.MIN_DAN <= dan <= cls.MAX_DAN):
            raise ValueError(f"Dan must be between {cls.MIN_DAN} and {cls.MAX_DAN}")
        return cls(value=dan)

    @property
    def rank_type(self) -> RankType:
        """Return whether this is a kyu or dan rank."""
        return RankType.DAN if self.value > 0 else RankType.KYU

    @property
    def level(self) -> int:
        """Return the numeric level (e.g., 5 for 5k or 3 for 3d)."""
        if self.value > 0:
            return self.value
        return -(self.value - 1)

    def __str__(self) -> str:
        """Return string representation like '5k' or '3d'."""
        if self.value > 0:
            return f"{self.value}d"
        return f"{-(self.value - 1)}k"

    def __repr__(self) -> str:
        return f"Rank('{self}')"

    def difference(self, other: Rank) -> int:
        """
        Calculate rank difference (positive if self is stronger).

        Example: 3d.difference(5k) = 7
        """
        return self.value - other.value

    def stones_difference(self, other: Rank) -> int:
        """
        Calculate absolute rank difference in stones.

        This is used for handicap calculation.
        """
        return abs(self.difference(other))


def validate_rank(rank_str: str) -> bool:
    """Check if a rank string is valid."""
    try:
        Rank.from_string(rank_str)
        return True
    except ValueError:
        return False
