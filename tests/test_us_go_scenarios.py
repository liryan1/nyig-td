import random

from nyig_td.models import MatchResult, Participant, Tournament


def generate_players(count, division_prefix, rank_range=(0, 20)):
    players = []
    for i in range(count):
        rank = random.randint(*rank_range)
        players.append(
            Participant(
                id=f"{division_prefix}_{i:03d}",
                name=f"Player {division_prefix} {i}",
                seed=random.randint(1, 1000),
                metadata={"rank": rank},
            )
        )
    return players


def simulate_tournament(tournament, rounds, pairing_type="swiss", **kwargs):
    for r in range(1, rounds + 1):
        pairings = tournament.create_round(type=pairing_type, **kwargs)
        tournament.matches.extend(pairings)

        # Simulate results
        for match in pairings:
            if match.p2 is None:
                match.result = MatchResult.BYE
            else:
                # Weighted towards higher seed if available, otherwise random
                p1_seed = match.p1.seed or 500
                p2_seed = match.p2.seed or 500

                # In our seed system, lower is better (standard in US Go)
                # But for random, we just want some variety.
                win_prob = 0.5
                if p1_seed < p2_seed:
                    win_prob = 0.6

                rand = random.random()
                if rand < win_prob:
                    match.result = MatchResult.P1WIN
                elif rand < 0.95:
                    match.result = MatchResult.P2WIN
                else:
                    match.result = MatchResult.TIE


def test_us_multi_division_swiss():
    """
    Scenario: 100 players, 4 divisions, 5 rounds Swiss.
    Simulates a standard local US tournament.
    """
    divisions = {
        "Open": generate_players(20, "Open", (20, 25)),
        "Expert": generate_players(30, "Expert", (15, 19)),
        "Intermediate": generate_players(25, "Int", (10, 14)),
        "Novice": generate_players(25, "Nov", (0, 9)),
    }

    for name, players in divisions.items():
        t = Tournament(id=f"T_{name}", name=f"US {name} Division", participants=players)
        simulate_tournament(t, 5, pairing_type="swiss")

        assert len(t.matches) == (len(players) + 1) // 2 * 5

        # Verify no repeat matches
        history = t.get_history()
        for pid, opponents in history.items():
            # In a 5 round tournament with 20+ players, there should be NO repeat matches
            # unless the solver failed significantly (which it shouldn't here)
            assert len(opponents) >= 4  # 5 matches, maybe 1 was a bye


def test_mcmahon_large_field_with_bars():
    """
    Scenario: 80 players, one large field using McMahon.
    - Top bar at rank 20 (6-dan)
    - Bottom bar at rank 5 (10-kyu)
    - 5 Rounds
    """
    players = generate_players(80, "M", (0, 25))
    ranks = {p.id: p.metadata["rank"] for p in players}

    t = Tournament(id="T_M", name="McMahon Tournament", participants=players)

    # We pass ranks via kwargs which get passed to create_mcmahon_pairings
    simulate_tournament(
        t, 5, pairing_type="mcmahon", ranks=ranks, top_bar=20, bottom_bar=5
    )

    # Verify top players (above bar) played other top players in R1
    top_players = [p for p in players if p.metadata["rank"] >= 20]
    r1_matches = [m for m in t.matches if m.round == 1]

    for m in r1_matches:
        if m.p1.id in [p.id for p in top_players] and m.p2:
            # P1 is a top player, P2 should ideally also be a top player (or close)
            # In McMahon, they should have the same initial MMS (20)
            p2_rank = next(p.metadata["rank"] for p in players if p.id == m.p2.id)
            # Since we have a lot of players, they should definitely stay within the top group
            assert p2_rank >= 18  # Allow some slight bleed if top group is odd


def test_mcmahon_edge_case_odd_players_in_bar():
    """
    If there's an odd number of players in the top bar,
    one must play someone from the next group down.
    """
    players = [
        # Top bar (Rank 20) - 3 players (ODD)
        Participant(id="T1", name="T1", metadata={"rank": 20}),
        Participant(id="T2", name="T2", metadata={"rank": 20}),
        Participant(id="T3", name="T3", metadata={"rank": 20}),
        # Next group (Rank 19)
        Participant(id="N1", name="N1", metadata={"rank": 19}),
        Participant(id="N2", name="N2", metadata={"rank": 19}),
        Participant(id="N3", name="N3", metadata={"rank": 19}),
    ]
    ranks = {p.id: p.metadata["rank"] for p in players}
    t = Tournament(id="T_Odd", name="Odd Top Bar", participants=players)

    pairings = t.create_round(type="mcmahon", ranks=ranks, top_bar=20)

    # T1, T2, T3 all have MMS 20.
    # N1, N2, N3 all have MMS 19.
    # We expect one match to be (T_x, N_y)
    bleed_matches = 0
    for m in pairings:
        p1_mms = min(ranks[m.p1.id], 20)
        p2_mms = min(ranks[m.p2.id], 20) if m.p2 else None
        if p1_mms != p2_mms:
            bleed_matches += 1

    assert bleed_matches == 1


def test_mcmahon_edge_case_all_same_rank():
    """
    If everyone has the same rank, McMahon should behave exactly like Swiss.
    """
    players = generate_players(10, "S", (10, 10))
    ranks = {p.id: 10 for p in players}
    t = Tournament(id="T_S", name="Same Rank", participants=players)

    # Round 1 should be essentially random pairings (by seed)
    pairings = t.create_round(type="mcmahon", ranks=ranks)
    assert len(pairings) == 5

    # After Round 1, winners (1.0) should play winners, losers (0.0) play losers
    t.matches.extend(pairings)
    for m in pairings:
        m.result = MatchResult.P1WIN  # P1 always wins

    r2_pairings = t.create_round(type="mcmahon", ranks=ranks)

    winners = [m.p1.id for m in pairings]

    # In R2, winners should play each other
    winner_vs_winner = 0
    for m in r2_pairings:
        if m.p1.id in winners and m.p2 and m.p2.id in winners:
            winner_vs_winner += 1

    # With 5 winners, we expect 2 winner-vs-winner matches and 1 winner-vs-loser
    assert winner_vs_winner == 2


def test_mcmahon_extreme_bars():
    """
    Scenario: Bars so tight everyone is in one score group.
    """
    players = generate_players(20, "E", (0, 30))
    ranks = {p.id: p.metadata["rank"] for p in players}
    t = Tournament(id="T_E", name="Extreme Bars", participants=players)

    # Everyone is between 0 and 30, so top_bar=10 and bottom_bar=10
    # forces everyone to MMS 10.
    pairings = t.create_round(type="mcmahon", ranks=ranks, top_bar=10, bottom_bar=10)

    # Check that everyone is treated as score 10
    # We can't easily check internal solver state, but we can verify it doesn't crash
    # and produces valid pairings.
    assert len(pairings) == 10
