from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Participant:
    id: str
    name: str
    seed: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
