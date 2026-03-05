"""Standings calculation with configurable tiebreakers."""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from functools import cmp_to_key
from typing import Any, Optional

from .models import (
    Tournament, Player, GameResult, PairingAlgorithm
)
from .ranks import Rank


class TiebreakerCriteria(Enum):
    """Available tiebreaker criteria."""
    WINS = "wins"
    SOS = "sos"
    SDS = "sds"
    SOSOS = "sosos"
    HTH = "hth"


DEFAULT_TIEBREAKER_ORDER = [
    TiebreakerCriteria.WINS,
    TiebreakerCriteria.SOS,
    TiebreakerCriteria.SDS,
    TiebreakerCriteria.HTH,
]


@dataclass(frozen=True)
class TiebreakerOrder:
    """Ordered list of tiebreaker criteria (1-4 items, no duplicates)."""
    criteria: tuple[TiebreakerCriteria, ...] = field(
        default_factory=lambda: tuple(DEFAULT_TIEBREAKER_ORDER)
    )

    def __post_init__(self) -> None:
        if len(self.criteria) < 1:
            raise ValueError("Must have at least 1 tiebreaker criterion")
        if len(self.criteria) > 4:
            raise ValueError("Cannot have more than 4 tiebreaker criteria")
        if len(set(self.criteria)) != len(self.criteria):
            raise ValueError("Tiebreaker criteria must not contain duplicates")

    @classmethod
    def from_list(cls, criteria: list[TiebreakerCriteria]) -> TiebreakerOrder:
        """Create from a list of criteria."""
        return cls(criteria=tuple(criteria))


@dataclass
class PlayerStanding:
    """Standing entry for a player."""
    rank: int
    player: Player
    wins: float
    losses: float
    sos: float  # Sum of Opponents' Scores
    sds: float  # Sum of Defeated opponents' Scores
    sosos: float  # SOS of opponents (Sum of Opponents' SOS)
    score: float = 0.0  # Ranking score: MMS for McMahon, wins for Swiss

    def __str__(self) -> str:
        parts = (
            f"{self.rank}. {self.player.name} ({self.player.rank}) - "
            f"W:{self.wins} L:{self.losses} SOS:{self.sos:.2f} "
            f"SDS:{self.sds:.2f}"
        )
        if self.score != self.wins:
            parts += f" MMS:{self.score:.1f}"
        return parts


class StandingsCalculator:
    """Calculate tournament standings with configurable tiebreaker order."""

    def calculate(
        self,
        tournament: Tournament,
        through_round: Optional[int] = None,
        tiebreaker_order: Optional[TiebreakerOrder] = None,
    ) -> list[PlayerStanding]:
        """
        Calculate standings through specified round.

        Args:
            tournament: The tournament
            through_round: Calculate through this round (None = all completed)
            tiebreaker_order: Custom tiebreaker order (default: WINS, SOS, SDS, HTH)

        Returns:
            List of PlayerStanding sorted by tiebreakers
        """
        if tiebreaker_order is None:
            tiebreaker_order = TiebreakerOrder()
        if through_round is None:
            # Find last completed round
            through_round = 0
            for i, round_ in enumerate(tournament.rounds):
                if round_.status.value in ("in_progress", "completed"):
                    through_round = i + 1

        if through_round == 0:
            # No rounds played yet
            return self._initial_standings(tournament)

        # Detect McMahon and compute bar rank
        is_mcmahon = tournament.settings.pairing_algorithm == PairingAlgorithm.MCMAHON
        bar_rank: Optional[Rank] = None
        if is_mcmahon:
            bar_rank = (Rank.from_string(tournament.settings.mcmahon_bar)
                        if tournament.settings.mcmahon_bar else Rank.from_dan(3))

        # Calculate base stats for each player
        player_stats: dict[str, dict[str, Any]] = {}
        for player_id, player in tournament.players.items():
            initial_mms = player.get_initial_mcmahon_score(bar_rank) if bar_rank else 0
            player_stats[player_id] = {
                "player": player,
                "wins": 0.0,
                "losses": 0.0,
                "opponents": [],
                "defeated": [],
                "initial_mms": initial_mms,
            }

        # Process each round
        for i in range(through_round):
            round_ = tournament.rounds[i]

            # Process pairings
            for pairing in round_.pairings:
                black_id = pairing.black_player_id
                white_id = pairing.white_player_id

                if black_id in player_stats:
                    player_stats[black_id]["opponents"].append(white_id)
                if white_id in player_stats:
                    player_stats[white_id]["opponents"].append(black_id)

                if pairing.result in (GameResult.BLACK_WIN, GameResult.BLACK_WIN_FORFEIT):
                    if black_id in player_stats:
                        player_stats[black_id]["wins"] += 1.0
                        player_stats[black_id]["defeated"].append(white_id)
                    if white_id in player_stats:
                        player_stats[white_id]["losses"] += 1.0

                elif pairing.result in (GameResult.WHITE_WIN, GameResult.WHITE_WIN_FORFEIT):
                    if white_id in player_stats:
                        player_stats[white_id]["wins"] += 1.0
                        player_stats[white_id]["defeated"].append(black_id)
                    if black_id in player_stats:
                        player_stats[black_id]["losses"] += 1.0

                elif pairing.result == GameResult.DRAW:
                    if black_id in player_stats:
                        player_stats[black_id]["wins"] += 0.5
                    if white_id in player_stats:
                        player_stats[white_id]["wins"] += 0.5

                elif pairing.result == GameResult.BOTH_LOSE:
                    if black_id in player_stats:
                        player_stats[black_id]["losses"] += 1.0
                    if white_id in player_stats:
                        player_stats[white_id]["losses"] += 1.0

            # Process byes
            for bye in round_.byes:
                if bye.player_id in player_stats:
                    player_stats[bye.player_id]["wins"] += bye.points

        # Calculate SOS and SDS using wins only
        for player_id, stats in player_stats.items():
            # SOS: Sum of opponents' wins (excludes McMahon initial scores)
            sos = sum(
                player_stats[opp]["wins"]
                for opp in stats["opponents"]
                if opp in player_stats
            )
            stats["sos"] = sos

            # SDS (SODOS): Sum of defeated opponents' wins
            sds = sum(
                player_stats[opp]["wins"]
                for opp in stats["defeated"]
                if opp in player_stats
            )
            stats["sds"] = sds

        # Calculate SOSOS (SOS of opponents)
        for player_id, stats in player_stats.items():
            sosos = sum(
                player_stats[opp]["sos"]
                for opp in stats["opponents"]
                if opp in player_stats
            )
            stats["sosos"] = sosos

        # Build HTH lookup: hth_results[(a_id, b_id)] = 1 if A beat B, -1 if B beat A, 0 if split/no game
        hth_results: dict[tuple[str, str], int] = {}
        for pid, stats in player_stats.items():
            for opp_id in set(stats["opponents"]):
                if (pid, opp_id) in hth_results:
                    continue
                # Count wins of pid over opp_id and vice versa
                pid_wins_over_opp = sum(
                    1 for d in player_stats[pid]["defeated"] if d == opp_id
                )
                opp_wins_over_pid = sum(
                    1 for d in player_stats[opp_id]["defeated"] if d == pid
                ) if opp_id in player_stats else 0

                if pid_wins_over_opp > opp_wins_over_pid:
                    hth_results[(pid, opp_id)] = 1
                    hth_results[(opp_id, pid)] = -1
                elif opp_wins_over_pid > pid_wins_over_opp:
                    hth_results[(pid, opp_id)] = -1
                    hth_results[(opp_id, pid)] = 1
                else:
                    hth_results[(pid, opp_id)] = 0
                    hth_results[(opp_id, pid)] = 0

        # Build standings list
        standings = [
            PlayerStanding(
                rank=0,  # Will be assigned after sorting
                player=stats["player"],
                wins=stats["wins"],
                losses=stats["losses"],
                sos=stats["sos"],
                sds=stats["sds"],
                sosos=stats["sosos"],
                score=stats["initial_mms"] + stats["wins"],
            )
            for stats in player_stats.values()
        ]

        # Build comparator based on tiebreaker order
        # WINS criterion uses 'score' (MMS for McMahon, wins for Swiss)
        stat_getters: dict[TiebreakerCriteria, str] = {
            TiebreakerCriteria.WINS: "score",
            TiebreakerCriteria.SOS: "sos",
            TiebreakerCriteria.SDS: "sds",
            TiebreakerCriteria.SOSOS: "sosos",
        }

        def compare(a: PlayerStanding, b: PlayerStanding) -> int:
            for criterion in tiebreaker_order.criteria:
                if criterion == TiebreakerCriteria.HTH:
                    hth = hth_results.get((a.player.id, b.player.id), 0)
                    if hth != 0:
                        return -hth  # negative because sort is ascending, we want higher first
                else:
                    attr = stat_getters[criterion]
                    a_val = getattr(a, attr)
                    b_val = getattr(b, attr)
                    if a_val > b_val:
                        return -1
                    elif a_val < b_val:
                        return 1
            return 0

        standings.sort(key=cmp_to_key(compare))

        # Assign ranks using the full tiebreaker tuple for non-HTH criteria
        non_hth_criteria = [
            c for c in tiebreaker_order.criteria
            if c != TiebreakerCriteria.HTH
        ]

        def rank_key(s: PlayerStanding) -> tuple[float, ...]:
            return tuple(
                getattr(s, stat_getters[c]) for c in non_hth_criteria
            )

        current_rank = 1
        for i, standing in enumerate(standings):
            if i > 0:
                prev = standings[i - 1]
                if rank_key(standing) != rank_key(prev):
                    current_rank = i + 1
            standing.rank = current_rank

        return standings

    def _initial_standings(self, tournament: Tournament) -> list[PlayerStanding]:
        """Generate initial standings before any rounds played."""
        standings = [
            PlayerStanding(
                rank=0,
                player=player,
                wins=0,
                losses=0,
                sos=0,
                sds=0,
                sosos=0,
            )
            for player in tournament.players.values()
        ]

        # Sort by rank
        standings.sort(key=lambda s: s.player.rank.value, reverse=True)

        for i, standing in enumerate(standings):
            standing.rank = i + 1

        return standings
