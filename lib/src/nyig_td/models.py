"""Data models for tournament management."""

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


class HandicapType(Enum):
    """Type of handicap calculation."""
    NONE = "none"
    RANK_DIFFERENCE = "rank_difference"


class HandicapModifier(Enum):
    """Modifier applied to handicap calculation."""
    NONE = "none"
    MINUS_1 = "minus_1"
    MINUS_2 = "minus_2"


@dataclass
class TournamentSettings:
    """Tournament configuration."""
    num_rounds: int
    pairing_algorithm: PairingAlgorithm = PairingAlgorithm.MCMAHON
    handicap_type: HandicapType = HandicapType.RANK_DIFFERENCE
    handicap_modifier: HandicapModifier = HandicapModifier.NONE
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
