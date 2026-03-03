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
