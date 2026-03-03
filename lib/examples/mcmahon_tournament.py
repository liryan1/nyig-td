#!/usr/bin/env python3
"""
Example: McMahon Tournament Simulation

Simulates a 5-round McMahon tournament with 16 players.
Demonstrates McMahon scoring, handicap games, and standings.
"""

import random
from nyig_td import (
    Tournament,
    TournamentSettings,
    Player,
    PairingAlgorithm,
    GameResult,
    RoundStatus,
    StandingsWeights,
    McMahonPairingEngine,
    StandingsCalculator,
)


def simulate_game_result(white_rank_value: int, black_rank_value: int,
                         handicap_stones: int) -> GameResult:
    """
    Simulate a game result considering handicap.
    Handicap stones reduce the effective rank difference.
    """
    # Effective difference after handicap
    effective_diff = white_rank_value - black_rank_value - handicap_stones
    # Sigmoid for win probability
    white_win_prob = 1 / (1 + 2.718 ** (-0.25 * effective_diff))

    if random.random() < white_win_prob:
        return GameResult.WHITE_WIN
    return GameResult.BLACK_WIN


def main():
    print("=" * 70)
    print("US Go Congress McMahon Tournament Simulation")
    print("=" * 70)

    # Create tournament settings with McMahon
    settings = TournamentSettings(
        num_rounds=5,
        pairing_algorithm=PairingAlgorithm.MCMAHON,
        handicap_enabled=True,
        handicap_reduction=0,
        mcmahon_bar="3d",  # Players at 3d and above start at score 0
        standings_weights=StandingsWeights(
            wins=1.0,
            sos=0.1,
            sodos=0.05,
            extended_sos=0.01,
        ),
    )

    # Create tournament
    tournament = Tournament.create("US Go Congress Open", settings)

    # Register players with diverse ranks
    players_data = [
        # Dan players (at or above bar)
        ("Michael Lee", "5d", "SF Go Club"),
        ("Sarah Chen", "4d", "Seattle Go"),
        ("James Park", "3d", "NYC Go Club"),
        ("Linda Wu", "3d", "Chicago Go"),
        # Strong kyu players
        ("David Kim", "1d", "Boston Go"),
        ("Emma Zhang", "1k", "NYC Go Club"),
        ("Kevin Liu", "2k", "LA Go Club"),
        ("Amy Wang", "3k", "Denver Go"),
        # Mid-level kyu
        ("Ryan Tanaka", "5k", "Portland Go"),
        ("Julia Chen", "6k", "Austin Go"),
        ("Chris Brown", "7k", "DC Go Club"),
        ("Michelle Lee", "8k", "Miami Go"),
        # Beginner kyu
        ("Alex Johnson", "10k", "NYC Go Club"),
        ("Nicole Smith", "12k", "SF Go Club"),
        ("Brian Davis", "15k", "Seattle Go"),
        ("Sophia Wilson", "18k", "Chicago Go"),
    ]

    players = []
    for name, rank, club in players_data:
        player = Player.create(name, rank, club=club)
        tournament.add_player(player)
        players.append(player)

    print(f"\nTournament: {tournament.name}")
    print(f"Rounds: {settings.num_rounds}")
    print(f"McMahon Bar: {settings.mcmahon_bar}")
    print(f"Players: {len(tournament.players)}")

    # Initialize McMahon engine
    engine = McMahonPairingEngine(bar_rank=settings.mcmahon_bar)

    print("\nInitial McMahon Scores:")
    print(f"  {'Name':<18} {'Rank':<6} {'Initial MM':<10}")
    print(f"  {'-' * 40}")
    for p in sorted(players, key=lambda x: -x.rank.value):
        mm_score = engine.get_initial_mcmahon_score(p)
        print(f"  {p.name:<18} {str(p.rank):<6} {mm_score:>5}")

    calc = StandingsCalculator(weights=settings.standings_weights)

    # Simulate each round
    for round_num in range(1, settings.num_rounds + 1):
        print(f"\n{'=' * 70}")
        print(f"ROUND {round_num}")
        print("=" * 70)

        # Generate pairings
        result = engine.generate_pairings(tournament, round_num)
        round_ = tournament.get_round(round_num)
        round_.pairings = result.pairings
        round_.byes = result.byes

        # Print warnings
        for warning in result.warnings:
            print(f"  Note: {warning}")

        # Print pairings with McMahon scores
        print("\nPairings (McMahon scores shown):")
        for pairing in round_.pairings:
            black = tournament.players[pairing.black_player_id]
            white = tournament.players[pairing.white_player_id]
            black_mm = engine.get_mcmahon_score(tournament, black, round_num)
            white_mm = engine.get_mcmahon_score(tournament, white, round_num)

            handicap_str = ""
            if pairing.handicap_stones > 0:
                handicap_str = f" H{pairing.handicap_stones}"

            print(f"  Bd {pairing.board_number:>2}: "
                  f"{black.name} ({black.rank}, MM:{black_mm:+.0f}) vs "
                  f"{white.name} ({white.rank}, MM:{white_mm:+.0f}){handicap_str}")

        # Print byes
        for bye in round_.byes:
            player = tournament.players[bye.player_id]
            print(f"  Bye: {player.name} ({player.rank})")

        # Simulate results
        print("\nResults:")
        for pairing in round_.pairings:
            black = tournament.players[pairing.black_player_id]
            white = tournament.players[pairing.white_player_id]

            pairing.result = simulate_game_result(
                white.rank.value,
                black.rank.value,
                pairing.handicap_stones
            )

            winner = black if pairing.result == GameResult.BLACK_WIN else white
            loser = white if pairing.result == GameResult.BLACK_WIN else black
            print(f"  Bd {pairing.board_number:>2}: {winner.name} defeats {loser.name}")

        round_.status = RoundStatus.COMPLETED

    # Final standings
    print(f"\n{'=' * 70}")
    print("FINAL STANDINGS")
    print("=" * 70)

    final_standings = calc.calculate(tournament)

    print(f"\n{'Rk':<3} {'Name':<18} {'Club':<14} {'Grade':<5} {'W-L':<6} "
          f"{'MM':<5} {'SOS':<5} {'Score':<7}")
    print("-" * 75)

    for s in final_standings:
        mm_final = engine.get_mcmahon_score(
            tournament, s.player, settings.num_rounds + 1
        )
        print(f"{s.rank:<3} {s.player.name:<18} {s.player.club:<14} "
              f"{str(s.player.rank):<5} {s.wins:.0f}-{s.losses:.0f}  "
              f"{mm_final:>+4.0f} {s.sos:>5.1f} {s.total_score:<7.3f}")

    # Show winners by section
    print("\n" + "=" * 70)
    print("PRIZE WINNERS")
    print("=" * 70)

    # Top overall
    print("\nOpen Section (Top 3):")
    for s in final_standings[:3]:
        print(f"  {s.rank}. {s.player.name} ({s.player.rank}) - "
              f"{s.wins:.0f} wins, {s.player.club}")

    # Top among players who started below bar
    print("\nKyu Section (Top 3 starting below bar):")
    kyu_standings = [
        s for s in final_standings
        if engine.get_initial_mcmahon_score(s.player) < 0
    ]
    for i, s in enumerate(kyu_standings[:3], 1):
        print(f"  {i}. {s.player.name} ({s.player.rank}) - "
              f"{s.wins:.0f} wins, {s.player.club}")


if __name__ == "__main__":
    random.seed(42)  # For reproducible results
    main()
