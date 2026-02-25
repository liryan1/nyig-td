import random
from nyig_td.models import (
    Tournament,
    Participant,
    MatchResult,
    MetricsConfig,
    TieBreaker,
    DivisionConfig,
)


def simulate_mcmahon():
    # 1. Setup: 80 players with ranks from 0 (30k) to 35 (5d)
    players = []
    for i in range(80):
        # Weighted towards 10k-5k range
        rank = int(random.gauss(15, 8))
        rank = max(0, min(35, rank))
        players.append(
            Participant(
                id=f"P{i:03d}",
                name=f"Player {i:03d}",
                seed=random.randint(1, 1000),
                metadata={"rank": rank},
            )
        )

    # 2. Tournament Config
    t = Tournament(id="MC2026", name="NYC McMahon Spring Open", participants=players)

    # We want to group by Dan and Kyu divisions in the final standings
    config = MetricsConfig(
        use_mcmahon=True,
        top_bar=30,  # 1 Dan
        bottom_bar=10,  # 20 Kyu
        tie_breakers=[
            TieBreaker.MAIN_SCORE,
            TieBreaker.SOS,
            TieBreaker.SOSOS,
        ],
        divisions=[
            DivisionConfig("Dan (1d+)", min_rank=30),
            DivisionConfig("Upper Kyu (1k-9k)", min_rank=21, max_rank=29),
            DivisionConfig("Lower Kyu (10k+)", max_rank=20),
        ],
    )

    # 3. Simulate 5 Rounds
    for r in range(1, 6):
        print(f"--- Generating Round {r} ---")
        # Passing ranks for McMahon calculation
        ranks = {p.id: p.metadata["rank"] for p in t.participants}
        pairings = t.create_round(
            type="mcmahon",
            ranks=ranks,
            top_bar=config.top_bar,
            bottom_bar=config.bottom_bar,
        )
        t.matches.extend(pairings)

        # Simulate Match Results
        for match in pairings:
            if match.p2 is None:
                match.result = MatchResult.BYE
                continue

            # Win probability based on rank difference
            p1_rank = ranks[match.p1.id]
            p2_rank = ranks[match.p2.id]
            diff = p1_rank - p2_rank
            # Simple sigmoid for win probability
            win_prob = 1 / (1 + 2.718 ** (-0.5 * diff))

            if random.random() < win_prob:
                match.result = MatchResult.P1WIN
            else:
                match.result = MatchResult.P2WIN

    # 4. Final Standings
    print("\n--- Final Standings (only showing top 10 per division) ---")
    all_standings = t.get_standings(config)

    for div_name, standings in all_standings.items():
        if not standings:
            continue
        print(f"\nDivision: {div_name}")
        print(f"{'Rank':<5} {'Name':<15} {'MMS':<6} {'SOS':<6} {'SODOS':<6} {'Record'}")
        print("-" * 55)
        for s in standings[:10]:  # Show top 10 per division
            print(
                f"{s.rank:<5} {s.participant.name:<15} {s.main_score:<6.1f} "
                f"{s.sos:<6.1f} {s.sodos:<6.1f} {s.record}"
            )


if __name__ == "__main__":
    simulate_mcmahon()
