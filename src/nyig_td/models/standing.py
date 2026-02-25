from dataclasses import dataclass, field
from typing import Any

from .participant import Participant


@dataclass
class Standing:
    rank: int
    participant: Participant
    main_score: float
    sos: float
    sodos: float
    sosos: float
    record: str  # e.g., "4-1-0" (W-L-T)
    byes: int
    division: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
