from typing import Callable

from .models import Match, Participant
from .swiss import create_swiss_pairings


def create_mcmahon_pairings(
    participants: list[Participant],
    ranks: dict[str, int],
    scores: dict[str, float],
    history: dict[str, set[str]],
    round_number: int,
    bye_history: set[str],
    top_bar: int | None = None,
    bottom_bar: int | None = None,
    constraint_fn: Callable[[Participant, Participant], bool] | None = None,
) -> list[Match]:
    """
    Creates pairings for a McMahon round.

    McMahon pairing is a variation of Swiss pairing where players start with an
    initial score based on their rank/rating. This ensures that stronger players
    are paired against each other from the first round.

    Args:
        participants: list of all participants.
        ranks: Initial ranks (McMahon scores) of participants. Higher is stronger.
        scores: Current tournament points (e.g., 1.0 for win, 0.5 for tie).
        history: Map of participant ID to set of IDs they have already played.
        round_number: The round number for the new matches.
        bye_history: set of participant IDs who have already received a bye.
        top_bar: Rank above which all players start with the same McMahon score.
        bottom_bar: Rank below which all players start with the same McMahon score.
        constraint_fn: Optional function that takes two participants and returns True if they can be paired.

    Returns:
        A list of Match objects for the round.
    """
    # Calculate effective McMahon scores: initial rank (capped by bars) + tournament points
    mcmahon_scores: dict[str, float] = {}
    for p in participants:
        rank = ranks.get(p.id, 0)

        # Apply bars to the initial rank
        effective_rank = rank
        if top_bar is not None:
            effective_rank = min(effective_rank, top_bar)
        if bottom_bar is not None:
            effective_rank = max(effective_rank, bottom_bar)

        # Total score = initial effective rank + points earned in tournament
        mcmahon_scores[p.id] = float(effective_rank) + scores.get(p.id, 0.0)

    # Use the standard Swiss pairing engine with McMahon scores
    return create_swiss_pairings(
        participants=participants,
        scores=mcmahon_scores,
        history=history,
        round_number=round_number,
        bye_history=bye_history,
        constraint_fn=constraint_fn,
    )
