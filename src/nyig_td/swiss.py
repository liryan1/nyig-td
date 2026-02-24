from typing import TypeVar, Optional, List, Dict, Set
from .models import Participant, Match

T = TypeVar("T")


def create_swiss_pairings(
    participants: List[Participant[T]],
    scores: Dict[T, float],
    history: Dict[T, Set[T]],
    round_number: int,
    bye_history: Set[T],
) -> List[Match[T]]:
    """
    Creates pairings for a Swiss round.

    Args:
        participants: List of all participants.
        scores: Current scores of participants.
        history: Map of participant ID to set of IDs they have already played.
        round_number: The round number for the new matches.
        bye_history: Set of participant IDs who have already received a bye.

    Returns:
        A list of Match objects for the round.
    """
    if not participants:
        return []

    # Sort participants by score (desc) and then seed (asc)
    # If seed is None, treat it as very high (last)
    sorted_players = sorted(
        participants,
        key=lambda p: (
            scores.get(p.id, 0.0),
            -(p.seed if p.seed is not None else float("inf")),
        ),
        reverse=True,
    )

    pairings: List[Match[T]] = []
    to_pair = list(sorted_players)

    # Handle bye if odd number of participants
    if len(to_pair) % 2 != 0:
        # Find the lowest ranked player who hasn't had a bye
        bye_player_idx = -1
        for i in range(len(to_pair) - 1, -1, -1):
            if to_pair[i].id not in bye_history:
                bye_player_idx = i
                break

        if bye_player_idx == -1:
            # Everyone has had a bye? Just give it to the lowest player
            bye_player_idx = len(to_pair) - 1

        bye_player = to_pair.pop(bye_player_idx)
        pairings.append(Match(p1=bye_player, p2=None, round=round_number))

    def solve(players: List[Participant[T]]) -> Optional[List[Match[T]]]:
        if not players:
            return []

        p1 = players[0]
        # Try to pair p1 with someone
        for i in range(1, len(players)):
            p2 = players[i]
            if p2.id not in history.get(p1.id, set()):
                # Potential match
                remaining = players[1:i] + players[i + 1 :]
                res = solve(remaining)
                if res is not None:
                    return [Match(p1=p1, p2=p2, round=round_number)] + res
        return None

    result = solve(to_pair)
    if result is None:
        # Fallback: pair them greedily even if they played before.
        result = []
        temp_to_pair = list(to_pair)
        while temp_to_pair:
            p1 = temp_to_pair.pop(0)
            if temp_to_pair:
                p2 = temp_to_pair.pop(0)
                result.append(Match(p1=p1, p2=p2, round=round_number))
            else:
                result.append(Match(p1=p1, p2=None, round=round_number))

    return pairings + result
