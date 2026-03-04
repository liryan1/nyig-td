#!/usr/bin/env python3
"""
Example: Swiss Tournament Simulation

Simulates a 4-round Swiss tournament with 8 players.
Demonstrates pairing generation, result recording, and standings calculation.
"""

import random
from nyig_td import (
    Tournament,
    TournamentSettings,
    Player,
    PairingAlgorithm,
    GameResult,
    RoundStatus,
    HandicapType,
    SwissPairingEngine,
    StandingsCalculator,
)


def simulate_game_result(white_rank_value: int, black_rank_value: int) -> GameResult:
    """
    Simulate a game result based on rank difference.
    Higher ranked player has better win probability.
    """
    diff = white_rank_value - black_rank_value
    # Sigmoid function for win probability
    white_win_prob = 1 / (1 + 2.718 ** (-0.3 * diff))

    if random.random() < white_win_prob:
        return GameResult.WHITE_WIN
    return GameResult.BLACK_WIN


def main():
    print("=" * 60)
    print("NYC Go Club Swiss Tournament Simulation")
    print("=" * 60)

    # Create tournament settings
    settings = TournamentSettings(
        num_rounds=4,
        pairing_algorithm=PairingAlgorithm.SWISS,
        handicap_type=HandicapType.RANK_DIFFERENCE,
    )

    # Create tournament
    tournament = Tournament.create("NYC Go Club Swiss Open", settings)

    # Register players
    players_data = [
        ("Alice Chen", "4d", "NYC Go Club"),
        ("Bob Smith", "3d", "Brooklyn Go"),
        ("Carol Wang", "2d", "NYC Go Club"),
        ("Dave Kim", "1d", "Queens Go"),
        ("Eve Johnson", "1k", "NYC Go Club"),
        ("Frank Lee", "3k", "Brooklyn Go"),
        ("Grace Park", "5k", "NYC Go Club"),
        ("Henry Zhao", "8k", "Manhattan Go"),
    ]

    players = []
    for name, rank, club in players_data:
        player = Player.create(name, rank, club=club)
        tournament.add_player(player)
        players.append(player)

    print(f"\nTournament: {tournament.name}")
    print(f"Rounds: {settings.num_rounds}")
    print(f"Players: {len(tournament.players)}")
    print("\nRegistered Players:")
    for p in sorted(players, key=lambda x: -x.rank.value):
        print(f"  {p.name} ({p.rank}) - {p.club}")

    # Initialize pairing engine and standings calculator
    engine = SwissPairingEngine()
    calc = StandingsCalculator()

    # Simulate each round
    for round_num in range(1, settings.num_rounds + 1):
        print(f"\n{'=' * 60}")
        print(f"ROUND {round_num}")
        print("=" * 60)

        # Generate pairings
        result = engine.generate_pairings(tournament, round_num)
        round_ = tournament.get_round(round_num)
        round_.pairings = result.pairings
        round_.byes = result.byes

        # Print warnings (e.g., repeat pairings)
        for warning in result.warnings:
            print(f"  Warning: {warning}")

        # Print pairings
        print("\nPairings:")
        for pairing in round_.pairings:
            black = tournament.players[pairing.black_player_id]
            white = tournament.players[pairing.white_player_id]

            handicap_str = ""
            if pairing.handicap_stones > 0:
                handicap_str = f" (H{pairing.handicap_stones})"
            elif pairing.komi != 7.5:
                handicap_str = f" (komi {pairing.komi})"

            print(f"  Board {pairing.board_number}: {black.name} ({black.rank}) vs "
                  f"{white.name} ({white.rank}){handicap_str}")

        # Print byes
        for bye in round_.byes:
            player = tournament.players[bye.player_id]
            print(f"  Bye: {player.name} ({player.rank})")

        # Simulate results
        print("\nResults:")
        for pairing in round_.pairings:
            black = tournament.players[pairing.black_player_id]
            white = tournament.players[pairing.white_player_id]

            # Simulate the game
            pairing.result = simulate_game_result(white.rank.value, black.rank.value)

            winner = black if pairing.result == GameResult.BLACK_WIN else white
            print(f"  Board {pairing.board_number}: {winner.name} wins")

        round_.status = RoundStatus.COMPLETED

        # Show current standings
        standings = calc.calculate(tournament, through_round=round_num)
        print("\nCurrent Standings:")
        print(f"  {'Rank':<5} {'Name':<15} {'W-L':<7} {'SOS':<6} {'SDS':<6}")
        print(f"  {'-' * 45}")
        for s in standings:
            print(f"  {s.rank:<5} {s.player.name:<15} "
                  f"{s.wins:.0f}-{s.losses:.0f}   {s.sos:<6.1f} {s.sds:<6.1f}")

    # Final standings
    print(f"\n{'=' * 60}")
    print("FINAL STANDINGS")
    print("=" * 60)

    final_standings = calc.calculate(tournament)
    print(f"\n{'Rank':<5} {'Name':<15} {'Club':<15} {'Grade':<6} {'W-L':<7} "
          f"{'SOS':<6} {'SDS':<6} {'SOSOS':<6}")
    print("-" * 75)
    for s in final_standings:
        print(f"{s.rank:<5} {s.player.name:<15} {s.player.club:<15} "
              f"{str(s.player.rank):<6} {s.wins:.0f}-{s.losses:.0f}   "
              f"{s.sos:<6.1f} {s.sds:<6.1f} {s.sosos:<6.1f}")


if __name__ == "__main__":
    random.seed(42)  # For reproducible results
    main()
