#!/usr/bin/env python3
"""
Example: McMahon Tournament with Cross-Division Play

This example demonstrates a real-world McMahon tournament scenario:
- Players are paired ACROSS divisions based on McMahon scores
- A dan player might play a kyu player if their scores align
- SOS/SODOS are calculated from ALL opponents (including cross-division)
- But prizes are awarded WITHIN divisions

Divisions are a presentation/prize concern, not a pairing concern.
This is how most major Go tournaments (US Go Congress, etc.) operate.
"""

import random
from dataclasses import dataclass
from nyig_td import (
    Tournament,
    TournamentSettings,
    Player,
    PairingAlgorithm,
    GameResult,
    RoundStatus,
    HandicapType,
    McMahonPairingEngine,
    StandingsCalculator,
    Rank,
)
from nyig_td.standings import PlayerStanding


@dataclass
class Division:
    """A prize division based on rank range."""
    name: str
    min_rank: Rank  # Weakest rank in division (e.g., 1k for "Dan+1k")
    max_rank: Rank  # Strongest rank in division (e.g., 9d for "Dan+1k")

    def contains(self, rank: Rank) -> bool:
        """Check if a rank falls within this division."""
        return self.min_rank.value <= rank.value <= self.max_rank.value

    def filter_standings(self, standings: list[PlayerStanding]) -> list[PlayerStanding]:
        """Filter standings to only include players in this division."""
        filtered = [s for s in standings if self.contains(s.player.rank)]
        # Re-rank within division
        for i, standing in enumerate(filtered):
            standing.rank = i + 1
        return filtered


def simulate_game_result(white_rank_value: int, black_rank_value: int,
                         handicap_stones: int) -> GameResult:
    """Simulate game with handicap consideration."""
    effective_diff = white_rank_value - black_rank_value - handicap_stones
    white_win_prob = 1 / (1 + 2.718 ** (-0.25 * effective_diff))
    return GameResult.WHITE_WIN if random.random() < white_win_prob else GameResult.BLACK_WIN


def main():
    print("=" * 75)
    print("McMahon Tournament with Cross-Division Play")
    print("=" * 75)
    print("""
This tournament demonstrates how McMahon pairing works in real tournaments:
- ALL players are in ONE pairing pool based on McMahon scores
- Cross-division pairings are NORMAL and EXPECTED
- A 2d at MM+1 might play a 3k at MM+1 (same McMahon score)
- SOS is calculated from ALL opponents, not just division opponents
- Prizes are awarded separately within each division
""")

    # Define divisions for prize purposes
    divisions = [
        Division("Open/Dan", Rank.from_dan(1), Rank.from_dan(9)),
        Division("SDK (1k-9k)", Rank.from_kyu(9), Rank.from_kyu(1)),
        Division("DDK (10k-20k)", Rank.from_kyu(20), Rank.from_kyu(10)),
    ]

    # Tournament setup
    settings = TournamentSettings(
        num_rounds=5,
        pairing_algorithm=PairingAlgorithm.MCMAHON,
        handicap_type=HandicapType.RANK_DIFFERENCE,
        mcmahon_bar="2d",  # Bar at 2d
    )

    tournament = Tournament.create("NYC Spring McMahon Open", settings)

    # Register players across all divisions
    # In a real tournament, players register and are placed in divisions by rank
    players_data = [
        # Dan division (at or above bar)
        ("Chen Wei", "4d", "NYC Go Club"),
        ("Park Jinho", "3d", "Brooklyn Go"),
        ("Kim Yuna", "2d", "NYC Go Club"),
        ("Lee Minho", "2d", "Queens Go"),
        ("Zhang Li", "1d", "Manhattan Go"),
        ("Tanaka Yuki", "1d", "NYC Go Club"),
        # SDK division (1k-9k, below bar)
        ("Smith John", "1k", "Westchester Go"),
        ("Johnson Emily", "2k", "NYC Go Club"),
        ("Williams David", "3k", "Brooklyn Go"),
        ("Brown Sarah", "5k", "NYC Go Club"),
        ("Davis Michael", "6k", "Queens Go"),
        ("Miller Lisa", "8k", "Manhattan Go"),
        # DDK division (10k+, well below bar)
        ("Wilson James", "10k", "NYC Go Club"),
        ("Moore Jennifer", "12k", "Brooklyn Go"),
        ("Taylor Robert", "15k", "NYC Go Club"),
        ("Anderson Mary", "18k", "Westchester Go"),
    ]

    players = []
    for name, rank, club in players_data:
        player = Player.create(name, rank, club=club)
        tournament.add_player(player)
        players.append(player)

    print(f"Tournament: {tournament.name}")
    print(f"McMahon Bar: {settings.mcmahon_bar}")
    print(f"Rounds: {settings.num_rounds}")
    print(f"Total Players: {len(players)}")

    # Show divisions
    print("\nDivisions (for prize purposes only - pairing is cross-division):")
    for div in divisions:
        div_players = [p for p in players if div.contains(p.rank)]
        print(f"  {div.name}: {len(div_players)} players")

    # Initialize engine
    engine = McMahonPairingEngine(bar_rank=settings.mcmahon_bar)

    print("\nInitial McMahon Scores:")
    print(f"  {'Name':<18} {'Rank':<5} {'Division':<12} {'MM':<5}")
    print(f"  {'-' * 45}")
    for p in sorted(players, key=lambda x: -x.rank.value):
        mm = engine.get_initial_mcmahon_score(p)
        div_name = next((d.name for d in divisions if d.contains(p.rank)), "Unknown")
        print(f"  {p.name:<18} {str(p.rank):<5} {div_name:<12} {mm:>+3}")

    calc = StandingsCalculator()

    # Simulate tournament
    cross_division_games = 0
    total_games = 0

    for round_num in range(1, settings.num_rounds + 1):
        print(f"\n{'=' * 75}")
        print(f"ROUND {round_num}")
        print("=" * 75)

        result = engine.generate_pairings(tournament, round_num)
        round_ = tournament.get_round(round_num)
        round_.pairings = result.pairings
        round_.byes = result.byes

        for warning in result.warnings:
            print(f"  Note: {warning}")

        # Analyze and print pairings
        print("\nPairings:")
        for pairing in round_.pairings:
            black = tournament.players[pairing.black_player_id]
            white = tournament.players[pairing.white_player_id]
            black_mm = engine.get_mcmahon_score(tournament, black, round_num)
            white_mm = engine.get_mcmahon_score(tournament, white, round_num)

            # Determine divisions
            black_div = next((d.name for d in divisions if d.contains(black.rank)), "?")
            white_div = next((d.name for d in divisions if d.contains(white.rank)), "?")

            # Check if cross-division
            is_cross = black_div != white_div
            cross_marker = " [CROSS-DIV]" if is_cross else ""
            if is_cross:
                cross_division_games += 1
            total_games += 1

            handicap_str = f" H{pairing.handicap_stones}" if pairing.handicap_stones > 0 else ""

            print(f"  Bd {pairing.board_number:>2}: "
                  f"{black.name} ({black.rank}, {black_div[:3]}, MM:{black_mm:+.0f}) vs "
                  f"{white.name} ({white.rank}, {white_div[:3]}, MM:{white_mm:+.0f})"
                  f"{handicap_str}{cross_marker}")

        for bye in round_.byes:
            player = tournament.players[bye.player_id]
            print(f"  Bye: {player.name} ({player.rank})")

        # Simulate results
        for pairing in round_.pairings:
            black = tournament.players[pairing.black_player_id]
            white = tournament.players[pairing.white_player_id]
            pairing.result = simulate_game_result(
                white.rank.value, black.rank.value, pairing.handicap_stones
            )

        round_.status = RoundStatus.COMPLETED

    # Final results
    print(f"\n{'=' * 75}")
    print("TOURNAMENT STATISTICS")
    print("=" * 75)
    print(f"\nCross-division games: {cross_division_games}/{total_games} "
          f"({100*cross_division_games/total_games:.1f}%)")
    print("This demonstrates that McMahon pairing is based on SCORE, not division!")

    # Calculate overall standings
    overall_standings = calc.calculate(tournament)

    print(f"\n{'=' * 75}")
    print("OVERALL STANDINGS (All Players)")
    print("=" * 75)
    print(f"\n{'Rk':<3} {'Name':<18} {'Rank':<5} {'Div':<5} {'W-L':<6} "
          f"{'MM':<5} {'SOS':<6} {'SDS':<6}")
    print("-" * 70)

    for s in overall_standings:
        mm_final = engine.get_mcmahon_score(tournament, s.player, settings.num_rounds + 1)
        div_abbr = next((d.name[:3] for d in divisions if d.contains(s.player.rank)), "?")
        print(f"{s.rank:<3} {s.player.name:<18} {str(s.player.rank):<5} {div_abbr:<5} "
              f"{s.wins:.0f}-{s.losses:.0f}  {mm_final:>+4.0f} {s.sos:>6.1f} {s.sds:<6.1f}")

    # Division standings
    print(f"\n{'=' * 75}")
    print("DIVISION STANDINGS (Prizes awarded within divisions)")
    print("=" * 75)
    print("""
Note: SOS values include ALL opponents, including cross-division games.
This is correct because:
- A win against a strong dan player should boost a kyu player's SOS
- A loss to a weak player should hurt a dan player's SOS
The cross-division games ARE counted in tiebreakers.
""")

    for div in divisions:
        div_standings = div.filter_standings(overall_standings.copy())
        if not div_standings:
            continue

        print(f"\n{div.name} Division:")
        print(f"  {'Rk':<3} {'Name':<18} {'Rank':<5} {'W-L':<6} {'SOS':<6} {'SDS':<6}")
        print(f"  {'-' * 55}")

        for s in div_standings:
            print(f"  {s.rank:<3} {s.player.name:<18} {str(s.player.rank):<5} "
                  f"{s.wins:.0f}-{s.losses:.0f}  {s.sos:>6.1f} {s.sds:<6.1f}")

    # Prize winners
    print(f"\n{'=' * 75}")
    print("PRIZE WINNERS")
    print("=" * 75)

    for div in divisions:
        div_standings = div.filter_standings(overall_standings.copy())
        if div_standings:
            winner = div_standings[0]
            print(f"\n{div.name} Division Champion:")
            print(f"  {winner.player.name} ({winner.player.rank}) - "
                  f"{winner.wins:.0f} wins, {winner.player.club}")
            print(f"  SOS: {winner.sos:.1f} (includes cross-division opponents)")


if __name__ == "__main__":
    random.seed(42)
    main()
