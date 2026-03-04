"""nyig-td: Tournament director tools for US Go tournaments."""

from .ranks import Rank, RankType, validate_rank
from .handicap import Handicap, HandicapCalculator, modifier_to_reduction
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
    HandicapType,
    HandicapModifier,
)
from .pairing import (
    PairingEngine,
    SwissPairingEngine,
    McMahonPairingEngine,
    PairingResult,
    get_pairing_engine,
)
from .standings import StandingsCalculator, PlayerStanding, TiebreakerCriteria, TiebreakerOrder

__version__ = "0.1.0"

__all__ = [
    # Ranks
    "Rank",
    "RankType",
    "validate_rank",
    # Handicap
    "Handicap",
    "HandicapCalculator",
    "modifier_to_reduction",
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
    "HandicapType",
    "HandicapModifier",
    # Pairing
    "PairingEngine",
    "SwissPairingEngine",
    "McMahonPairingEngine",
    "PairingResult",
    "get_pairing_engine",
    # Standings
    "StandingsCalculator",
    "PlayerStanding",
    "TiebreakerCriteria",
    "TiebreakerOrder",
]
