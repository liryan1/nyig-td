from nyig_td import Participant, create_swiss_pairings


def test_swiss_round_1_basic():
    players = [Participant(id=i, name=f"P{i}", seed=i) for i in range(1, 5)]
    # All players have 0 points, round 1
    scores = {p.id: 0.0 for p in players}
    history = {p.id: set() for p in players}
    bye_history = set()

    pairings = create_swiss_pairings(players, scores, history, 1, bye_history)

    assert len(pairings) == 2
    # In round 1, with equal scores, they should be paired by seed
    # Sorted by score (0) and seed (1, 2, 3, 4)
    # 1 vs 2, 3 vs 4 (because of how our solve function works - it picks first and then first available)

    # Check that everyone is paired exactly once
    paired_ids = set()
    for m in pairings:
        assert m.p1 is not None
        assert m.p2 is not None
        paired_ids.add(m.p1.id)
        paired_ids.add(m.p2.id)

    assert len(paired_ids) == 4
    assert paired_ids == {1, 2, 3, 4}


def test_swiss_round_2_score_based():
    players = [Participant(id=i, name=f"P{i}", seed=i) for i in range(1, 5)]
    # After round 1: P1 and P3 won
    scores = {1: 1.0, 3: 1.0, 2: 0.0, 4: 0.0}
    history = {1: {2}, 2: {1}, 3: {4}, 4: {3}}
    bye_history = set()

    pairings = create_swiss_pairings(players, scores, history, 2, bye_history)

    assert len(pairings) == 2
    # 1 and 3 should play each other (both have 1.0)
    # 2 and 4 should play each other (both have 0.0)

    found_1_3 = False
    found_2_4 = False
    for m in pairings:
        ids = {m.p1.id, m.p2.id}
        if ids == {1, 3}:
            found_1_3 = True
        if ids == {2, 4}:
            found_2_4 = True

    assert found_1_3
    assert found_2_4


def test_swiss_odd_players_bye():
    players = [Participant(id=i, name=f"P{i}", seed=i) for i in range(1, 4)]
    scores = {1: 0.0, 2: 0.0, 3: 0.0}
    history = {1: set(), 2: set(), 3: set()}
    bye_history = set()

    pairings = create_swiss_pairings(players, scores, history, 1, bye_history)

    assert len(pairings) == 2  # One match + one bye

    bye_match = next(m for m in pairings if m.p2 is None)
    assert bye_match.p1.id == 3  # Lowest seed gets bye

    active_match = next(m for m in pairings if m.p2 is not None)
    assert {active_match.p1.id, active_match.p2.id} == {1, 2}


def test_swiss_no_repeat_pairings():
    players = [Participant(id=i, name=f"P{i}", seed=i) for i in range(1, 5)]
    # All players have 0 points
    scores = {p.id: 0.0 for p in players}
    # 1 has played 2, 3, 4
    # Wait, with 4 players, after 3 rounds, everyone has played everyone.
    # Round 1: 1-2, 3-4
    # Round 2: 1-3, 2-4
    # Round 3: 1-4, 2-3

    history = {1: {2, 3}, 2: {1, 4}, 3: {1, 4}, 4: {2, 3}}
    bye_history = set()

    # 1 MUST play 4, 2 MUST play 3
    pairings = create_swiss_pairings(players, scores, history, 3, bye_history)

    found_1_4 = False
    found_2_3 = False
    for m in pairings:
        ids = {m.p1.id, m.p2.id}
        if ids == {1, 4}:
            found_1_4 = True
        if ids == {2, 3}:
            found_2_3 = True

    assert found_1_4
    assert found_2_3
