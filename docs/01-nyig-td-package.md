# Guide 1: nyig-td Python Package

Core tournament logic package for US Go tournaments.

## Prerequisites

- Python 3.11+
- uv package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

## Project Setup

### Initialize Project

```bash
mkdir nyig-td
cd nyig-td
uv init --lib
```

### Configure pyproject.toml

```toml
[project]
name = "nyig-td"
version = "0.1.0"
description = "Tournament director tools for US Go tournaments"
readme = "README.md"
requires-python = ">=3.11"
dependencies = []

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-cov>=4.1.0",
    "mypy>=1.8.0",
    "ruff>=0.2.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --cov=nyig_td --cov-report=term-missing"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.mypy]
python_version = "3.11"
strict = true
```

### Create Directory Structure

```bash
mkdir -p src/nyig_td tests
touch src/nyig_td/__init__.py
touch src/nyig_td/ranks.py
touch src/nyig_td/handicap.py
touch src/nyig_td/models.py
touch src/nyig_td/pairing.py
touch src/nyig_td/standings.py
```

---

## Module 1: Go Ranks (`src/nyig_td/ranks.py`)

```python
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
```

---

## Module 2: Handicap Calculator (`src/nyig_td/handicap.py`)

```python
"""Handicap calculation for Go games."""

from __future__ import annotations
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
```

---

## Module 3: Data Models (`src/nyig_td/models.py`)

```python
"""Data models for tournament management."""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from uuid import uuid4

from .ranks import Rank


def generate_id() -> str:
    """Generate a unique ID."""
    return str(uuid4())


class GameResult(Enum):
    """Possible game results."""
    BLACK_WIN = "B+"
    WHITE_WIN = "W+"
    BLACK_WIN_FORFEIT = "B+F"
    WHITE_WIN_FORFEIT = "W+F"
    DRAW = "Draw"  # Rare in Go
    NO_RESULT = "NR"  # Game not played
    BOTH_LOSE = "BL"  # Double forfeit


@dataclass
class Player:
    """
    Tournament player.

    Supports partial round participation via rounds_participating.
    """
    id: str
    name: str
    rank: Rank
    club: str = ""
    aga_id: Optional[str] = None
    rating: Optional[float] = None

    # Which rounds this player is participating in (1-indexed)
    # Empty set means participating in all rounds
    rounds_participating: set[int] = field(default_factory=set)

    # McMahon-specific
    initial_mcmahon_score: Optional[int] = None

    def __hash__(self) -> int:
        return hash(self.id)

    def is_participating_in_round(self, round_number: int) -> bool:
        """Check if player is participating in a specific round."""
        if not self.rounds_participating:
            return True  # Participating in all rounds
        return round_number in self.rounds_participating

    @classmethod
    def create(
        cls,
        name: str,
        rank: str | Rank,
        club: str = "",
        aga_id: Optional[str] = None,
        rating: Optional[float] = None,
    ) -> Player:
        """Factory method to create a new player."""
        if isinstance(rank, str):
            rank = Rank.from_string(rank)
        return cls(
            id=generate_id(),
            name=name,
            rank=rank,
            club=club,
            aga_id=aga_id,
            rating=rating,
        )


@dataclass
class Pairing:
    """A pairing between two players in a round."""
    id: str
    black_player_id: str
    white_player_id: str
    board_number: int
    handicap_stones: int = 0
    komi: float = 7.5
    result: GameResult = GameResult.NO_RESULT

    @classmethod
    def create(
        cls,
        black_player_id: str,
        white_player_id: str,
        board_number: int,
        handicap_stones: int = 0,
        komi: float = 7.5,
    ) -> Pairing:
        """Factory method to create a new pairing."""
        return cls(
            id=generate_id(),
            black_player_id=black_player_id,
            white_player_id=white_player_id,
            board_number=board_number,
            handicap_stones=handicap_stones,
            komi=komi,
        )


@dataclass
class Bye:
    """Represents a player receiving a bye."""
    player_id: str
    points: float = 1.0  # Full point bye by default


class RoundStatus(Enum):
    """Status of a tournament round."""
    PENDING = "pending"
    PAIRED = "paired"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


@dataclass
class Round:
    """A tournament round."""
    number: int
    pairings: list[Pairing] = field(default_factory=list)
    byes: list[Bye] = field(default_factory=list)
    status: RoundStatus = RoundStatus.PENDING

    def get_pairing_for_player(self, player_id: str) -> Optional[Pairing]:
        """Find pairing involving a player."""
        for pairing in self.pairings:
            if player_id in (pairing.black_player_id, pairing.white_player_id):
                return pairing
        return None

    def has_bye(self, player_id: str) -> bool:
        """Check if player has a bye this round."""
        return any(bye.player_id == player_id for bye in self.byes)

    def get_opponent_id(self, player_id: str) -> Optional[str]:
        """Get opponent's ID for a player in this round."""
        pairing = self.get_pairing_for_player(player_id)
        if not pairing:
            return None
        if pairing.black_player_id == player_id:
            return pairing.white_player_id
        return pairing.black_player_id


class PairingAlgorithm(Enum):
    """Available pairing algorithms."""
    SWISS = "swiss"
    MCMAHON = "mcmahon"


@dataclass
class StandingsWeights:
    """Configurable weights for standings calculation."""
    wins: float = 1.0
    sos: float = 0.1  # Sum of Opponents' Scores
    sodos: float = 0.05  # Sum of Defeated Opponents' Scores
    extended_sos: float = 0.0  # SOS of opponents

    @classmethod
    def default(cls) -> StandingsWeights:
        return cls()


@dataclass
class TournamentSettings:
    """Tournament configuration."""
    num_rounds: int
    pairing_algorithm: PairingAlgorithm = PairingAlgorithm.MCMAHON
    standings_weights: StandingsWeights = field(default_factory=StandingsWeights.default)
    handicap_enabled: bool = True
    handicap_reduction: int = 0  # Reduce handicap by this amount
    mcmahon_bar: Optional[str] = None  # Rank string for McMahon bar (e.g., "3d")

    def __post_init__(self) -> None:
        if self.num_rounds < 1:
            raise ValueError("Tournament must have at least 1 round")
        if self.num_rounds > 10:
            raise ValueError("Tournament cannot have more than 10 rounds")


class TournamentStatus(Enum):
    """Status of a tournament."""
    SETUP = "setup"
    REGISTRATION = "registration"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


@dataclass
class Tournament:
    """Full tournament state."""
    id: str
    name: str
    settings: TournamentSettings
    players: dict[str, Player] = field(default_factory=dict)
    rounds: list[Round] = field(default_factory=list)
    status: TournamentStatus = TournamentStatus.SETUP

    @classmethod
    def create(cls, name: str, settings: TournamentSettings) -> Tournament:
        """Factory method to create a new tournament."""
        tournament = cls(
            id=generate_id(),
            name=name,
            settings=settings,
        )
        # Initialize rounds
        tournament.rounds = [
            Round(number=i + 1) for i in range(settings.num_rounds)
        ]
        return tournament

    def add_player(self, player: Player) -> None:
        """Add a player to the tournament."""
        self.players[player.id] = player

    def remove_player(self, player_id: str) -> None:
        """Remove a player from the tournament."""
        if player_id in self.players:
            del self.players[player_id]

    def get_round(self, round_number: int) -> Round:
        """Get a specific round (1-indexed)."""
        if not (1 <= round_number <= len(self.rounds)):
            raise ValueError(f"Invalid round number: {round_number}")
        return self.rounds[round_number - 1]

    def get_active_players(self, round_number: int) -> list[Player]:
        """Get players participating in a specific round."""
        return [
            p for p in self.players.values()
            if p.is_participating_in_round(round_number)
        ]
```

---

## Module 4: Pairing Algorithms (`src/nyig_td/pairing.py`)

```python
"""Pairing algorithms for Go tournaments."""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import random

from .models import (
    Player, Pairing, Bye, Round, Tournament,
    GameResult, PairingAlgorithm
)
from .handicap import HandicapCalculator, suggest_colors
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

        if abs(rank_diff) >= 2 and tournament.settings.handicap_enabled:
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
            reduction=tournament.settings.handicap_reduction
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

        # Handle odd number of players - give bye to lowest ranked unpaired
        if len(unpaired) % 2 == 1:
            bye_player = unpaired.pop()
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
            if tournament.settings.handicap_enabled:
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
        """
        Calculate initial McMahon score for a player.

        Players at the bar start at 0.
        Lower ranked players start negative (1 point per rank below bar).
        Higher ranked players also start at 0 (compressed at top).
        """
        if player.initial_mcmahon_score is not None:
            return player.initial_mcmahon_score

        diff = player.rank.difference(self.bar_rank)
        if diff >= 0:
            return 0  # At or above bar
        return diff  # Below bar (negative)

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
            reduction=tournament.settings.handicap_reduction
        )

        # Update bar from settings if provided
        if tournament.settings.mcmahon_bar:
            self.bar_rank = Rank.from_string(tournament.settings.mcmahon_bar)

        # Get active players
        active_players = tournament.get_active_players(round_number)

        # Calculate McMahon scores and sort
        players_with_mm_scores = [
            (p, self.get_mcmahon_score(tournament, p, round_number))
            for p in active_players
        ]
        # Sort by McMahon score (desc), then rank for tiebreak
        players_with_mm_scores.sort(key=lambda x: (-x[1], -x[0].rank.value))

        unpaired = [p for p, _ in players_with_mm_scores]
        pairings: list[Pairing] = []
        byes: list[Bye] = []
        board_number = 1

        # Handle bye for odd number
        if len(unpaired) % 2 == 1:
            # Give bye to lowest McMahon score player
            bye_player = unpaired.pop()
            byes.append(Bye(player_id=bye_player.id))
            warnings.append(f"Bye given to {bye_player.name}")

        # Group by McMahon score for pairing within groups
        while unpaired:
            player = unpaired.pop(0)
            player_mm = self.get_mcmahon_score(tournament, player, round_number)
            previous_opponents = self._get_previous_opponents(
                tournament, player.id, round_number
            )

            # Find opponent with same/similar McMahon score
            opponent: Optional[Player] = None
            best_score_diff = float('inf')

            for candidate in unpaired:
                if candidate.id in previous_opponents:
                    continue
                candidate_mm = self.get_mcmahon_score(
                    tournament, candidate, round_number
                )
                score_diff = abs(player_mm - candidate_mm)
                if score_diff < best_score_diff:
                    best_score_diff = score_diff
                    opponent = candidate

            if opponent is None and unpaired:
                # Accept repeat pairing
                opponent = unpaired[0]
                warnings.append(
                    f"Repeat pairing: {player.name} vs {opponent.name}"
                )

            if opponent is None:
                byes.append(Bye(player_id=player.id))
                continue

            unpaired.remove(opponent)

            # Assign colors
            black, white = self._assign_colors(
                tournament, player, opponent, round_number
            )

            # Calculate handicap
            if tournament.settings.handicap_enabled:
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
```

---

## Module 5: Standings Calculator (`src/nyig_td/standings.py`)

```python
"""Standings calculation with configurable tiebreakers."""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional

from .models import (
    Tournament, Player, GameResult, StandingsWeights
)


@dataclass
class PlayerStanding:
    """Standing entry for a player."""
    rank: int
    player: Player
    wins: float
    losses: float
    sos: float  # Sum of Opponents' Scores
    sodos: float  # Sum of Defeated Opponents' Scores
    extended_sos: float  # SOS of opponents
    total_score: float  # Weighted total

    def __str__(self) -> str:
        return (
            f"{self.rank}. {self.player.name} ({self.player.rank}) - "
            f"W:{self.wins} L:{self.losses} SOS:{self.sos:.2f} "
            f"SODOS:{self.sodos:.2f} Total:{self.total_score:.3f}"
        )


class StandingsCalculator:
    """Calculate tournament standings with configurable weights."""

    def __init__(self, weights: Optional[StandingsWeights] = None):
        self.weights = weights or StandingsWeights.default()

    def calculate(
        self,
        tournament: Tournament,
        through_round: Optional[int] = None,
    ) -> list[PlayerStanding]:
        """
        Calculate standings through specified round.

        Args:
            tournament: The tournament
            through_round: Calculate through this round (None = all completed)

        Returns:
            List of PlayerStanding sorted by total score
        """
        if through_round is None:
            # Find last completed round
            through_round = 0
            for i, round_ in enumerate(tournament.rounds):
                if round_.status.value in ("in_progress", "completed"):
                    through_round = i + 1

        if through_round == 0:
            # No rounds played yet
            return self._initial_standings(tournament)

        # Calculate base stats for each player
        player_stats: dict[str, dict] = {}
        for player_id, player in tournament.players.items():
            player_stats[player_id] = {
                "player": player,
                "wins": 0.0,
                "losses": 0.0,
                "opponents": [],
                "defeated": [],
            }

        # Process each round
        for i in range(through_round):
            round_ = tournament.rounds[i]

            # Process pairings
            for pairing in round_.pairings:
                black_id = pairing.black_player_id
                white_id = pairing.white_player_id

                if black_id in player_stats:
                    player_stats[black_id]["opponents"].append(white_id)
                if white_id in player_stats:
                    player_stats[white_id]["opponents"].append(black_id)

                if pairing.result in (GameResult.BLACK_WIN, GameResult.BLACK_WIN_FORFEIT):
                    if black_id in player_stats:
                        player_stats[black_id]["wins"] += 1.0
                        player_stats[black_id]["defeated"].append(white_id)
                    if white_id in player_stats:
                        player_stats[white_id]["losses"] += 1.0

                elif pairing.result in (GameResult.WHITE_WIN, GameResult.WHITE_WIN_FORFEIT):
                    if white_id in player_stats:
                        player_stats[white_id]["wins"] += 1.0
                        player_stats[white_id]["defeated"].append(black_id)
                    if black_id in player_stats:
                        player_stats[black_id]["losses"] += 1.0

                elif pairing.result == GameResult.DRAW:
                    if black_id in player_stats:
                        player_stats[black_id]["wins"] += 0.5
                    if white_id in player_stats:
                        player_stats[white_id]["wins"] += 0.5

                elif pairing.result == GameResult.BOTH_LOSE:
                    if black_id in player_stats:
                        player_stats[black_id]["losses"] += 1.0
                    if white_id in player_stats:
                        player_stats[white_id]["losses"] += 1.0

            # Process byes
            for bye in round_.byes:
                if bye.player_id in player_stats:
                    player_stats[bye.player_id]["wins"] += bye.points

        # Calculate SOS and SODOS
        for player_id, stats in player_stats.items():
            # SOS: Sum of opponents' scores
            sos = sum(
                player_stats[opp]["wins"]
                for opp in stats["opponents"]
                if opp in player_stats
            )
            stats["sos"] = sos

            # SODOS: Sum of defeated opponents' scores
            sodos = sum(
                player_stats[opp]["wins"]
                for opp in stats["defeated"]
                if opp in player_stats
            )
            stats["sodos"] = sodos

        # Calculate extended SOS (SOS of opponents)
        for player_id, stats in player_stats.items():
            extended_sos = sum(
                player_stats[opp]["sos"]
                for opp in stats["opponents"]
                if opp in player_stats
            )
            stats["extended_sos"] = extended_sos

        # Calculate weighted total score
        for stats in player_stats.values():
            stats["total_score"] = (
                self.weights.wins * stats["wins"] +
                self.weights.sos * stats["sos"] +
                self.weights.sodos * stats["sodos"] +
                self.weights.extended_sos * stats["extended_sos"]
            )

        # Build standings list
        standings = [
            PlayerStanding(
                rank=0,  # Will be assigned after sorting
                player=stats["player"],
                wins=stats["wins"],
                losses=stats["losses"],
                sos=stats["sos"],
                sodos=stats["sodos"],
                extended_sos=stats["extended_sos"],
                total_score=stats["total_score"],
            )
            for stats in player_stats.values()
        ]

        # Sort by total score, then wins, then SOS
        standings.sort(
            key=lambda s: (s.total_score, s.wins, s.sos),
            reverse=True
        )

        # Assign ranks (handle ties)
        current_rank = 1
        for i, standing in enumerate(standings):
            if i > 0:
                prev = standings[i - 1]
                if (standing.total_score != prev.total_score or
                    standing.wins != prev.wins):
                    current_rank = i + 1
            standing.rank = current_rank

        return standings

    def _initial_standings(self, tournament: Tournament) -> list[PlayerStanding]:
        """Generate initial standings before any rounds played."""
        standings = [
            PlayerStanding(
                rank=0,
                player=player,
                wins=0,
                losses=0,
                sos=0,
                sodos=0,
                extended_sos=0,
                total_score=0,
            )
            for player in tournament.players.values()
        ]

        # Sort by rank
        standings.sort(key=lambda s: s.player.rank.value, reverse=True)

        for i, standing in enumerate(standings):
            standing.rank = i + 1

        return standings
```

---

## Package Init (`src/nyig_td/__init__.py`)

```python
"""nyig-td: Tournament director tools for US Go tournaments."""

from .ranks import Rank, RankType, validate_rank
from .handicap import Handicap, HandicapCalculator
from .models import (
    Player,
    Pairing,
    Bye,
    Round,
    RoundStatus,
    Tournament,
    TournamentSettings,
    TournamentStatus,
    GameResult,
    PairingAlgorithm,
    StandingsWeights,
)
from .pairing import (
    PairingEngine,
    SwissPairingEngine,
    McMahonPairingEngine,
    PairingResult,
    get_pairing_engine,
)
from .standings import StandingsCalculator, PlayerStanding

__version__ = "0.1.0"

__all__ = [
    # Ranks
    "Rank",
    "RankType",
    "validate_rank",
    # Handicap
    "Handicap",
    "HandicapCalculator",
    # Models
    "Player",
    "Pairing",
    "Bye",
    "Round",
    "RoundStatus",
    "Tournament",
    "TournamentSettings",
    "TournamentStatus",
    "GameResult",
    "PairingAlgorithm",
    "StandingsWeights",
    # Pairing
    "PairingEngine",
    "SwissPairingEngine",
    "McMahonPairingEngine",
    "PairingResult",
    "get_pairing_engine",
    # Standings
    "StandingsCalculator",
    "PlayerStanding",
]
```

---

## Test Suite

### `tests/test_ranks.py`

```python
"""Tests for rank module."""

import pytest
from nyig_td import Rank, RankType, validate_rank


class TestRank:
    """Test Rank class."""

    def test_from_string_kyu(self):
        rank = Rank.from_string("5k")
        assert rank.rank_type == RankType.KYU
        assert rank.level == 5
        assert str(rank) == "5k"

    def test_from_string_dan(self):
        rank = Rank.from_string("3d")
        assert rank.rank_type == RankType.DAN
        assert rank.level == 3
        assert str(rank) == "3d"

    def test_from_string_case_insensitive(self):
        assert Rank.from_string("5K") == Rank.from_string("5k")
        assert Rank.from_string("3D") == Rank.from_string("3d")

    def test_from_string_invalid(self):
        with pytest.raises(ValueError):
            Rank.from_string("5x")
        with pytest.raises(ValueError):
            Rank.from_string("abc")
        with pytest.raises(ValueError):
            Rank.from_string("0k")
        with pytest.raises(ValueError):
            Rank.from_string("31k")
        with pytest.raises(ValueError):
            Rank.from_string("10d")

    def test_ordering(self):
        assert Rank.from_string("1d") > Rank.from_string("1k")
        assert Rank.from_string("3d") > Rank.from_string("1d")
        assert Rank.from_string("1k") > Rank.from_string("5k")
        assert Rank.from_string("5k") > Rank.from_string("10k")

    def test_difference(self):
        r3d = Rank.from_string("3d")
        r5k = Rank.from_string("5k")
        assert r3d.difference(r5k) == 7
        assert r5k.difference(r3d) == -7

    def test_stones_difference(self):
        r3d = Rank.from_string("3d")
        r5k = Rank.from_string("5k")
        assert r3d.stones_difference(r5k) == 7
        assert r5k.stones_difference(r3d) == 7


class TestValidateRank:
    """Test validate_rank function."""

    def test_valid_ranks(self):
        assert validate_rank("5k") is True
        assert validate_rank("3d") is True
        assert validate_rank("30k") is True
        assert validate_rank("9d") is True

    def test_invalid_ranks(self):
        assert validate_rank("5x") is False
        assert validate_rank("0k") is False
        assert validate_rank("31k") is False
```

### `tests/test_handicap.py`

```python
"""Tests for handicap module."""

import pytest
from nyig_td import Rank, Handicap, HandicapCalculator


class TestHandicapCalculator:
    """Test HandicapCalculator."""

    def setup_method(self):
        self.calc = HandicapCalculator()

    def test_even_game(self):
        white = Rank.from_string("3d")
        black = Rank.from_string("3d")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 0
        assert hc.komi == 7.5

    def test_one_stone_difference(self):
        white = Rank.from_string("3d")
        black = Rank.from_string("2d")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 0
        assert hc.komi == 0.5

    def test_two_stone_difference(self):
        white = Rank.from_string("3d")
        black = Rank.from_string("1d")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 2
        assert hc.komi == 0.5

    def test_large_difference_capped(self):
        white = Rank.from_string("5d")
        black = Rank.from_string("10k")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 9  # Capped at 9

    def test_weaker_white(self):
        white = Rank.from_string("5k")
        black = Rank.from_string("3d")
        hc = self.calc.calculate(white, black)
        assert hc.stones == 0
        assert hc.komi == 7.5  # Even game

    def test_reduction(self):
        calc = HandicapCalculator(reduction=1)
        white = Rank.from_string("3d")
        black = Rank.from_string("1k")
        hc = calc.calculate(white, black)
        # 4 stone diff - 1 reduction = 3 stones
        assert hc.stones == 3
```

### `tests/test_pairing.py`

```python
"""Tests for pairing algorithms."""

import pytest
from nyig_td import (
    Tournament, TournamentSettings, Player, PairingAlgorithm,
    SwissPairingEngine, McMahonPairingEngine, get_pairing_engine,
    GameResult
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
        assert engine.get_initial_mcmahon_score(p3) == -4  # 4 below bar

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


class TestGetPairingEngine:
    """Test factory function."""

    def test_swiss(self):
        engine = get_pairing_engine(PairingAlgorithm.SWISS)
        assert isinstance(engine, SwissPairingEngine)

    def test_mcmahon(self):
        engine = get_pairing_engine(PairingAlgorithm.MCMAHON, bar_rank="2d")
        assert isinstance(engine, McMahonPairingEngine)
```

### `tests/test_standings.py`

```python
"""Tests for standings calculator."""

import pytest
from nyig_td import (
    Tournament, TournamentSettings, Player, Round, Pairing,
    GameResult, StandingsWeights, StandingsCalculator, PairingAlgorithm,
    RoundStatus
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
```

---

## Running Tests

```bash
# Install dev dependencies
uv pip install -e ".[dev]"

# Run tests with coverage
uv run pytest

# Run specific test file
uv run pytest tests/test_ranks.py

# Type checking
uv run mypy src/nyig_td

# Linting
uv run ruff check src/nyig_td
```

---

## Publishing

### Build Package

```bash
uv build
```

### Publish to PyPI

```bash
# Set up credentials
export UV_PUBLISH_TOKEN=<your-pypi-token>

# Publish
uv publish
```

### Publish to Test PyPI First

```bash
uv publish --publish-url https://test.pypi.org/legacy/
```

---

## Success Criteria

1. All tests pass with >90% coverage
2. `mypy` reports no type errors
3. `ruff` reports no linting issues
4. Package installs successfully: `uv pip install nyig-td`
5. All public APIs are documented with docstrings
