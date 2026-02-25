from dataclasses import dataclass, field
from enum import Enum, auto


class TieBreaker(Enum):
    MAIN_SCORE = auto()  # MMS for McMahon, Points for Swiss
    SOS = auto()  # Sum of Opponents' Scores
    SODOS = auto()  # Sum of Defeated Opponents' Scores
    SOSOS = auto()  # Sum of Opponents' SOS
    SEED = auto()  # Seed (usually lower is better/stronger)


@dataclass
class DivisionConfig:
    name: str
    min_rank: int | None = None
    max_rank: int | None = None


@dataclass
class MetricsConfig:
    tie_breakers: list[TieBreaker] = field(
        default_factory=lambda: [
            TieBreaker.MAIN_SCORE,
            TieBreaker.SOS,
            TieBreaker.SODOS,
            TieBreaker.SOSOS,
        ]
    )
    bye_points: float = 1.0
    divisions: list[DivisionConfig] = field(default_factory=list)
    rank_metadata_key: str = "rank"  # Where to look for rank in participant metadata
    top_bar: int | None = None
    bottom_bar: int | None = None
    use_mcmahon: bool = False
