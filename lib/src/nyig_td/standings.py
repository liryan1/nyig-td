"""Standings calculation with fixed tiebreakers."""

from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Optional

from .models import (
    Tournament, Player, GameResult
)


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

    def __str__(self) -> str:
        return (
            f"{self.rank}. {self.player.name} ({self.player.rank}) - "
            f"W:{self.wins} L:{self.losses} SOS:{self.sos:.2f} "
            f"SDS:{self.sds:.2f}"
        )


class StandingsCalculator:
    """Calculate tournament standings with fixed tiebreaker order."""

    def calculate(
        self,
        tournament: Tournament,
        through_round: Optional[int] = None,
    ) -> list[PlayerStanding]:
        """
        Calculate standings through specified round.

        Sorted by: Wins -> SOS -> SDS -> SOSOS

        Args:
            tournament: The tournament
            through_round: Calculate through this round (None = all completed)

        Returns:
            List of PlayerStanding sorted by tiebreakers
        """
        if through_round is None:
            # Find last completed round
            through_round = 0
            for i, round_ in enumerate(tournament.rounds):
                if round_.status.value in ("in_progress", "completed"):
                    through_round = i + 1

        if through_round == 0:
            # No rounds played yet
            return self._initial_standings(tournament)

        # Calculate base stats for each player
        player_stats: dict[str, dict[str, Any]] = {}
        for player_id, player in tournament.players.items():
            player_stats[player_id] = {
                "player": player,
                "wins": 0.0,
                "losses": 0.0,
                "opponents": [],
                "defeated": [],
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

        # Calculate SOS and SDS
        for player_id, stats in player_stats.items():
            # SOS: Sum of opponents' scores
            sos = sum(
                player_stats[opp]["wins"]
                for opp in stats["opponents"]
                if opp in player_stats
            )
            stats["sos"] = sos

            # SDS: Sum of defeated opponents' scores
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
            )
            for stats in player_stats.values()
        ]

        # Sort by wins, then SOS, then SDS, then SOSOS
        standings.sort(
            key=lambda s: (s.wins, s.sos, s.sds, s.sosos),
            reverse=True
        )

        # Assign ranks (handle ties: same rank when wins AND sos match)
        current_rank = 1
        for i, standing in enumerate(standings):
            if i > 0:
                prev = standings[i - 1]
                if (standing.wins != prev.wins or
                    standing.sos != prev.sos):
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
