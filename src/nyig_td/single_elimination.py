from typing import List, Optional, TypeVar
import math
from .models import Participant, Match

T = TypeVar("T")


def create_fixed_bracket(participants: List[Participant[T]]) -> Match[T]:
    """
    Creates a full tree-structured fixed bracket for single elimination.
    Follows standard tournament seeding (1 vs 16, 8 vs 9, etc.).
    """
    if not participants:
        raise ValueError("Participants list cannot be empty")

    sorted_participants = sorted(
        participants,
        key=lambda x: (x.seed if x.seed is not None else float("inf"), x.name),
    )

    num_players = len(sorted_participants)
    next_pow2 = 2 ** math.ceil(math.log2(num_players)) if num_players > 1 else 1

    # Fill with participants and byes
    seeds: List[Optional[Participant[T]]] = [None] * next_pow2
    for i, p in enumerate(sorted_participants):
        seeds[i] = p

    def build_seeds(n: int) -> List[int]:
        """Returns standard seed indices for a bracket of size n."""
        if n == 1:
            return [0]
        prev = build_seeds(n // 2)
        res = []
        for x in prev:
            if x == 1:  # Seed 2 is always flipped in its pair expansion
                res.append(n - 1 - x)
                res.append(x)
            else:
                res.append(x)
                res.append(n - 1 - x)
        return res

    # Reorder seeds to standard bracket order
    order = build_seeds(next_pow2)
    ordered_participants = [seeds[i] for i in order]

    def build_tree(players: List[Optional[Participant[T]]], round_num: int) -> Match[T]:
        if len(players) == 2:
            return Match(p1=players[0], p2=players[1], round=1)

        mid = len(players) // 2
        m1 = build_tree(players[:mid], round_num - 1)
        m2 = build_tree(players[mid:], round_num - 1)
        return Match(m1=m1, m2=m2, round=round_num)

    total_rounds = int(math.log2(next_pow2)) if next_pow2 > 1 else 0
    if total_rounds == 0:
        return Match(p1=ordered_participants[0], round=1)

    return build_tree(ordered_participants, total_rounds)


# Alias for backward compatibility or as per README
create_single_elimination_bracket = create_fixed_bracket
