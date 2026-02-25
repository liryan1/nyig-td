from dataclasses import dataclass, field
from typing import Any

from .enums import MatchResult
from .participant import Participant


@dataclass
class Match:
    p1: Participant
    p2: Participant | None = None  # no p2 means bye
    round: int = 1
    result: MatchResult = MatchResult.UNFINISHED
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def is_bye(self) -> bool:
        """Returns True if this match is a bye (no p2)."""
        return self.p2 is None or self.result == MatchResult.BYE

    @property
    def winner(self) -> Participant | None:
        """Returns the winning participant, or None if it's a tie, unfinished, or bye."""
        if self.result == MatchResult.P1WIN:
            return self.p1
        if self.result == MatchResult.P2WIN:
            return self.p2
        return None
