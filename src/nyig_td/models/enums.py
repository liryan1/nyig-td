from enum import Enum, auto


class MatchResult(Enum):
    UNFINISHED = auto()
    P1WIN = auto()
    P2WIN = auto()
    TIE = auto()
    FORFEIT = auto()
    BYE = auto()
