from nyig_td.mcmahon import create_mcmahon_pairings
from nyig_td.models import Participant


def test_mcmahon_initial_pairings():
    """
    Scenario: 4 players with different ranks.
    P1: 5 (1-dan equivalent)
    P2: 5
    P3: 4 (1-kyu equivalent)
    P4: 4

    Round 1 pairings should be P1 vs P2 and P3 vs P4.
    """
    players = [
        Participant(id="P1", name="Player 1"),
        Participant(id="P2", name="Player 2"),
        Participant(id="P3", name="Player 3"),
        Participant(id="P4", name="Player 4"),
    ]
    ranks = {"P1": 5, "P2": 5, "P3": 4, "P4": 4}
    scores = {}
    history = {}
    bye_history = set()

    pairings = create_mcmahon_pairings(
        participants=players,
        ranks=ranks,
        scores=scores,
        history=history,
        round_number=1,
        bye_history=bye_history,
    )

    assert len(pairings) == 2

    # Check that P1 and P2 are paired (both rank 5)
    # and P3 and P4 are paired (both rank 4)
    p1_opponent = None
    p3_opponent = None

    for m in pairings:
        if m.p1.id == "P1":
            p1_opponent = m.p2.id if m.p2 else None
        elif m.p2 and m.p2.id == "P1":
            p1_opponent = m.p1.id

        if m.p1.id == "P3":
            p3_opponent = m.p2.id if m.p2 else None
        elif m.p2 and m.p2.id == "P3":
            p3_opponent = m.p1.id

    assert p1_opponent == "P2"
    assert p3_opponent == "P4"


def test_mcmahon_with_bars():
    """
    Scenario: Top bar and bottom bar.
    P1: 10 (High dan) -> Top bar 5
    P2: 6 (Low dan) -> Top bar 5
    P3: 2 (Mid kyu)
    P4: 0 (Beginner) -> Bottom bar 2
    """
    players = [
        Participant(id="P1", name="Player 1"),
        Participant(id="P2", name="Player 2"),
        Participant(id="P3", name="Player 3"),
        Participant(id="P4", name="Player 4"),
    ]
    ranks = {"P1": 10, "P2": 6, "P3": 2, "P4": 0}
    scores = {}
    history = {}
    bye_history = set()

    pairings = create_mcmahon_pairings(
        participants=players,
        ranks=ranks,
        scores=scores,
        history=history,
        round_number=1,
        bye_history=bye_history,
        top_bar=5,
        bottom_bar=2,
    )

    # Effective scores should be:
    # P1: 5 (capped)
    # P2: 5 (capped)
    # P3: 2
    # P4: 2 (capped)

    # Should result in P1-P2 and P3-P4
    p1_opponent = None
    p3_opponent = None
    for m in pairings:
        if m.p1.id == "P1":
            p1_opponent = m.p2.id if m.p2 else None
        elif m.p2 and m.p2.id == "P1":
            p1_opponent = m.p1.id

        if m.p1.id == "P3":
            p3_opponent = m.p2.id if m.p2 else None
        elif m.p2 and m.p2.id == "P3":
            p3_opponent = m.p1.id

    assert p1_opponent == "P2"
    assert p3_opponent == "P4"


def test_mcmahon_tournament_progression():
    """
    Verify that McMahon score updates as tournament progresses.
    """
    players = [
        Participant(id="P1", name="P1"),  # Rank 5
        Participant(id="P2", name="P2"),  # Rank 5
        Participant(id="P3", name="P3"),  # Rank 4
        Participant(id="P4", name="P4"),  # Rank 4
    ]
    ranks = {"P1": 5, "P2": 5, "P3": 4, "P4": 4}
    scores = {"P1": 0.0, "P2": 0.0, "P3": 0.0, "P4": 0.0}
    history = {}
    bye_history = set()

    # Round 1: P1 vs P2, P3 vs P4
    create_mcmahon_pairings(players, ranks, scores, history, 1, bye_history)

    # Let P2 win (MMS 5+1=6), P1 lose (MMS 5+0=5)
    # Let P3 win (MMS 4+1=5), P4 lose (MMS 4+0=4)
    scores["P2"] = 1.0
    scores["P3"] = 1.0
    history["P1"] = {"P2"}
    history["P2"] = {"P1"}
    history["P3"] = {"P4"}
    history["P4"] = {"P3"}

    # Round 2:
    # MMS: P2=6, P1=5, P3=5, P4=4
    # Expected: P2 vs P1? No, already played.
    # Expected: P2 vs P3 (highest remaining)
    # Expected: P1 vs P4 (lowest remaining)

    r2_pairings = create_mcmahon_pairings(
        players, ranks, scores, history, 2, bye_history
    )

    p2_opponent = None
    for m in r2_pairings:
        if m.p1.id == "P2":
            p2_opponent = m.p2.id if m.p2 else None
        elif m.p2 and m.p2.id == "P2":
            p2_opponent = m.p1.id

    assert p2_opponent == "P3"
