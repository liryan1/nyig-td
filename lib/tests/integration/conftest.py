"""Shared fixtures for integration tests."""

from dataclasses import dataclass

import pytest

from nyig_td.models import (
    Tournament,
    TournamentSettings,
    Player,
    PairingAlgorithm,
)
from nyig_td.ranks import Rank
from nyig_td.standings import PlayerStanding


@dataclass
class Division:
    """Division for grouping players by rank for prizes.

    Divisions are presentation-only; pairing is always cross-division based on score.
    """
    name: str
    min_rank: Rank
    max_rank: Rank

    def contains(self, rank: Rank) -> bool:
        """Check if a rank falls within this division."""
        return self.min_rank.value <= rank.value <= self.max_rank.value

    def filter_standings(self, standings: list[PlayerStanding]) -> list[PlayerStanding]:
        """Filter standings to only include players in this division and re-rank."""
        filtered = [s for s in standings if self.contains(s.player.rank)]
        for i, standing in enumerate(filtered):
            standing.rank = i + 1
        return filtered


@pytest.fixture
def dan_division() -> Division:
    """Dan division (1d-9d)."""
    return Division("Dan", Rank.from_dan(1), Rank.from_dan(9))


@pytest.fixture
def sdk_division() -> Division:
    """Single-digit kyu division (1k-9k)."""
    return Division("SDK", Rank.from_kyu(9), Rank.from_kyu(1))


@pytest.fixture
def ddk_division() -> Division:
    """Double-digit kyu division (10k-20k)."""
    return Division("DDK", Rank.from_kyu(20), Rank.from_kyu(10))


@pytest.fixture
def three_division_players() -> list[Player]:
    """18 players: 6 Dan, 6 SDK, 6 DDK."""
    return [
        # Dan (6)
        Player.create("Chen", "4d"),
        Player.create("Park", "3d"),
        Player.create("Kim", "2d"),
        Player.create("Lee", "2d"),
        Player.create("Zhang", "1d"),
        Player.create("Tanaka", "1d"),
        # SDK (6)
        Player.create("Smith", "1k"),
        Player.create("Johnson", "2k"),
        Player.create("Williams", "3k"),
        Player.create("Brown", "5k"),
        Player.create("Davis", "6k"),
        Player.create("Miller", "8k"),
        # DDK (6)
        Player.create("Wilson", "10k"),
        Player.create("Moore", "12k"),
        Player.create("Taylor", "15k"),
        Player.create("Anderson", "18k"),
        Player.create("Thomas", "19k"),
        Player.create("Jackson", "20k"),
    ]


@pytest.fixture
def swiss_tournament_3div(three_division_players: list[Player]) -> Tournament:
    """A 5-round Swiss tournament with 18 players across 3 divisions."""
    settings = TournamentSettings(
        num_rounds=5,
        pairing_algorithm=PairingAlgorithm.SWISS,
        handicap_enabled=True,
    )
    tournament = Tournament.create("Swiss 3-Div", settings)
    for p in three_division_players:
        tournament.add_player(p)
    return tournament


@pytest.fixture
def mcmahon_tournament_3div(three_division_players: list[Player]) -> Tournament:
    """A 5-round McMahon tournament with bar at 2d, 18 players across 3 divisions."""
    settings = TournamentSettings(
        num_rounds=5,
        pairing_algorithm=PairingAlgorithm.MCMAHON,
        mcmahon_bar="2d",
        handicap_enabled=True,
    )
    tournament = Tournament.create("McMahon 3-Div", settings)
    for p in three_division_players:
        tournament.add_player(p)
    return tournament


@pytest.fixture
def boundary_players() -> list[Player]:
    """Players at division boundaries (1k/1d)."""
    return [
        Player.create("DanPlayer1", "1d"),
        Player.create("DanPlayer2", "1d"),
        Player.create("KyuPlayer1", "1k"),
        Player.create("KyuPlayer2", "1k"),
    ]


@pytest.fixture
def small_tournament_players() -> list[Player]:
    """Small set of players for edge case testing."""
    return [
        Player.create("Alice", "3d"),
        Player.create("Bob", "2d"),
    ]
