from dataclasses import dataclass
from typing import Generic, TypeVar, Optional

T = TypeVar("T")


@dataclass(frozen=True)
class Participant(Generic[T]):
    id: T
    name: str
    seed: Optional[int] = None


@dataclass
class Match(Generic[T]):
    p1: Optional[Participant[T]] = None
    p2: Optional[Participant[T]] = None
    m1: Optional["Match[T]"] = None
    m2: Optional["Match[T]"] = None
    round: int = 1
