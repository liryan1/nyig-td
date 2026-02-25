from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from .enums import MatchResult
from .match import Match
from .participant import Participant
from .standing import Standing  # noqa: F401

from .metrics_config import MetricsConfig

if TYPE_CHECKING:
    from ..mcmahon import create_mcmahon_pairings  # noqa: F401
    from ..swiss import create_swiss_pairings  # noqa: F401


@dataclass
class Tournament:
    """
    Central entity representing a tournament.
    Manages participants, match history, and orchestrates pairing generation and standings.
    """

    id: str
    name: str
    participants: list[Participant] = field(default_factory=list)
    matches: list[Match] = field(default_factory=list)
    current_round: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)

    def get_scores(self, bye_points: float = 1.0) -> dict[str, float]:
        """Calculates current scores for all participants based on match results."""
        scores: dict[str, float] = {p.id: 0.0 for p in self.participants}
        for match in self.matches:
            if match.result == MatchResult.P1WIN:
                scores[match.p1.id] += 1.0
            elif match.result == MatchResult.P2WIN and match.p2:
                scores[match.p2.id] += 1.0
            elif match.result == MatchResult.TIE:
                scores[match.p1.id] += 0.5
                if match.p2:
                    scores[match.p2.id] += 0.5
            elif match.result == MatchResult.BYE:
                scores[match.p1.id] += bye_points
        return scores

    def get_history(self) -> dict[str, set[str]]:
        """Calculates match history (opponents played) for all participants."""
        history: dict[str, set[str]] = {p.id: set() for p in self.participants}
        for match in self.matches:
            if match.p1 and match.p2:
                history[match.p1.id].add(match.p2.id)
                history[match.p2.id].add(match.p1.id)
        return history

    def get_bye_history(self) -> set[str]:
        """Calculates which participants have already received a bye."""
        bye_history: set[str] = set()
        for match in self.matches:
            if match.result == MatchResult.BYE or (match.p1 and not match.p2):
                bye_history.add(match.p1.id)
        return bye_history

    def create_round(self, type: str = "swiss", **kwargs: Any) -> list[Match]:
        """
        Convenience method to generate the next round's pairings.

        Args:
            type: 'swiss' or 'mcmahon'
            **kwargs: Extra arguments for create_swiss_pairings or create_mcmahon_pairings
        """
        from ..mcmahon import create_mcmahon_pairings
        from ..swiss import create_swiss_pairings

        self.current_round += 1
        bye_points = kwargs.pop("bye_points", 1.0)

        if type == "swiss":
            return create_swiss_pairings(
                participants=self.participants,
                scores=self.get_scores(bye_points=bye_points),
                history=self.get_history(),
                round_number=self.current_round,
                bye_history=self.get_bye_history(),
                **kwargs,
            )
        elif type == "mcmahon":
            # Extract ranks from metadata if not provided explicitly in kwargs
            ranks = kwargs.pop("ranks", None)
            if ranks is None:
                rank_key = kwargs.pop("rank_metadata_key", "rank")
                ranks = {p.id: p.metadata.get(rank_key, 0) for p in self.participants}

            return create_mcmahon_pairings(
                participants=self.participants,
                ranks=ranks,
                scores=self.get_scores(bye_points=bye_points),
                history=self.get_history(),
                round_number=self.current_round,
                bye_history=self.get_bye_history(),
                **kwargs,
            )
        else:
            raise ValueError(f"Unknown pairing type: {type}")

    def get_standings(
        self, config: MetricsConfig | None = None
    ) -> dict[str, list[Standing]]:
        """Calculates tournament standings using the metrics engine."""
        from ..metrics import calculate_standings

        return calculate_standings(self, config)
