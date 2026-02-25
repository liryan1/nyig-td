import random

from nyig_td.models import MatchResult, Participant
from nyig_td.swiss import create_swiss_pairings


def generate_players(count, start_id=1, division_prefix="P"):
    return [
        Participant(
            id=f"{division_prefix}{i}",
            name=f"Player {division_prefix}{i}",
            seed=random.randint(1, 1000),
        )
        for i in range(start_id, start_id + count)
    ]


def simulate_round(participants, scores, history, bye_history, round_num):
    pairings = create_swiss_pairings(
        participants=participants,
        scores=scores,
        history=history,
        round_number=round_num,
        bye_history=bye_history,
    )

    for match in pairings:
        if match.p2 is None:
            # Bye
            match.result = MatchResult.BYE
            scores[match.p1.id] = scores.get(match.p1.id, 0.0) + 1.0
            bye_history.add(match.p1.id)
        else:
            # Random result: P1 win (45%), P2 win (45%), Tie (10%)
            r = random.random()
            if r < 0.45:
                match.result = MatchResult.P1WIN
                scores[match.p1.id] = scores.get(match.p1.id, 0.0) + 1.0
            elif r < 0.90:
                match.result = MatchResult.P2WIN
                scores[match.p2.id] = scores.get(match.p2.id, 0.0) + 1.0
            else:
                match.result = MatchResult.TIE
                scores[match.p1.id] = scores.get(match.p1.id, 0.0) + 0.5
                scores[match.p2.id] = scores.get(match.p2.id, 0.0) + 0.5

            # Update history
            history.setdefault(match.p1.id, set()).add(match.p2.id)
            history.setdefault(match.p2.id, set()).add(match.p1.id)

    return pairings


def test_large_tournament_multi_division():
    """
    Scenario: 100 players total, divided into 3 divisions, 5 rounds.
    Division A: 40 players
    Division B: 35 players (odd number, checks byes)
    Division C: 25 players (odd number, checks byes)
    """
    divisions = {
        "Open": generate_players(40, division_prefix="A"),
        "Intermediate": generate_players(35, division_prefix="B"),
        "Novice": generate_players(25, division_prefix="C"),
    }

    all_scores = {div_name: {} for div_name in divisions}
    all_history = {div_name: {} for div_name in divisions}
    all_bye_history = {div_name: set() for div_name in divisions}

    rounds = 5
    for r in range(1, rounds + 1):
        for div_name, players in divisions.items():
            pairings = simulate_round(
                players,
                all_scores[div_name],
                all_history[div_name],
                all_bye_history[div_name],
                r,
            )

            # Verification for each round
            assert len(pairings) == (len(players) + 1) // 2

            # Ensure no one is paired twice in the same round
            paired_ids = set()
            for m in pairings:
                assert m.p1.id not in paired_ids
                paired_ids.add(m.p1.id)
                if m.p2:
                    assert m.p2.id not in paired_ids
                    paired_ids.add(m.p2.id)

            assert len(paired_ids) == len(players)

    # Final verifications
    for div_name, history in all_history.items():
        players_in_div = divisions[div_name]
        for p in players_in_div:
            opponents = history.get(p.id, set())
            has_bye = p.id in all_bye_history[div_name]

            # Total rounds participated (match or bye)
            total_activity = len(opponents) + (1 if has_bye else 0)
            assert (
                total_activity == rounds
            ), f"Player {p.id} in {div_name} has {total_activity} rounds of activity instead of {rounds}"

            # Ensure no player played themselves
            assert p.id not in opponents

            # Ensure no repeat matches in 5 rounds (since 25+ players)
            assert len(opponents) == (
                rounds - 1 if has_bye else rounds
            ), f"Player {p.id} has {len(opponents)} unique opponents but should have {(rounds - 1 if has_bye else rounds)}"


def test_bye_cycling():
    """
    Scenario: Ensure that byes are given to different players until everyone has had one.
    With 5 players and 5 rounds, EVERYONE should have exactly 1 bye.
    """
    players = generate_players(5, division_prefix="B")
    scores = {p.id: 0.0 for p in players}
    history = {p.id: set() for p in players}
    bye_history = set()

    for r in range(1, 6):
        pairings = create_swiss_pairings(
            participants=players,
            scores=scores,
            history=history,
            round_number=r,
            bye_history=bye_history,
        )

        # Identify the bye player
        bye_players = [m.p1 for m in pairings if m.p2 is None]
        assert len(bye_players) == 1
        bye_player = bye_players[0]

        # Verify they haven't had a bye before
        assert bye_player.id not in bye_history
        bye_history.add(bye_player.id)

        # Update scores and history for normal matches
        for m in pairings:
            if m.p2:
                scores[m.p1.id] += 1.0  # P1 always wins for simplicity
                history[m.p1.id].add(m.p2.id)
                history[m.p2.id].add(m.p1.id)
            else:
                scores[m.p1.id] += 1.0  # Bye gives 1 point

    assert len(bye_history) == 5


def test_realistic_us_open_scenario():
    """
    Scenario: A realistic US Go Open style tournament with 100+ players.
    - Multiple divisions.
    - 5 Rounds.
    - Constraint: Players from the same club/state shouldn't play each other in early rounds.
    """
    clubs = ["Seattle", "New York", "Boston", "San Francisco", "Chicago"]
    players = []
    for i in range(100):
        players.append(
            Participant(
                id=f"P{i:03d}",
                name=f"Player {i}",
                metadata={"club": random.choice(clubs)},
            )
        )

    scores = {p.id: 0.0 for p in players}
    history = {p.id: set() for p in players}
    bye_history = set()

    def club_constraint(p1, p2):
        return p1.metadata.get("club") != p2.metadata.get("club")

    for r in range(1, 6):
        # We only apply club constraints for the first 2 rounds
        # In later rounds, top boards might have to play clubmates.
        current_constraint = club_constraint if r <= 2 else None

        pairings = create_swiss_pairings(
            participants=players,
            scores=scores,
            history=history,
            round_number=r,
            bye_history=bye_history,
            constraint_fn=current_constraint,
        )

        # Basic round validation
        assert len(pairings) == 50

        # Check constraints if active
        if current_constraint:
            for m in pairings:
                if m.p2:
                    assert m.p1.metadata["club"] != m.p2.metadata["club"]


def test_score_group_pairing():
    """
    Scenario: Ensure that players with the same score are paired together.
    In a 4-player Swiss, after Round 1, the two winners (1-0) should play each other.
    The two losers (0-1) should play each other.
    """
    players = generate_players(4, division_prefix="G")
    scores = {p.id: 0.0 for p in players}
    history = {p.id: set() for p in players}
    bye_history = set()

    # Round 1
    r1_pairings = create_swiss_pairings(players, scores, history, 1, bye_history)
    assert len(r1_pairings) == 2

    # Simulate: P1 in each match wins
    for m in r1_pairings:
        scores[m.p1.id] = 1.0
        if m.p2:
            scores[m.p2.id] = 0.0
            history.setdefault(m.p1.id, set()).add(m.p2.id)
            history.setdefault(m.p2.id, set()).add(m.p1.id)
        else:
            bye_history.add(m.p1.id)

    winners = [p for p in players if scores[p.id] == 1.0]

    # Round 2
    r2_pairings = create_swiss_pairings(players, scores, history, 2, bye_history)

    # Verify: The two winners from R1 are paired together in R2
    found_top_board = False
    for m in r2_pairings:
        if (
            m.p2
            and (m.p1.id in [w.id for w in winners])
            and (m.p2.id in [w.id for w in winners])
        ):
            found_top_board = True

    assert found_top_board, "Top board should be between the two winners of Round 1"


def test_no_duplicate_pairings_in_small_pool():
    """
    Scenario: Ensure no duplicate pairings in a 4-player 3-round tournament.
    """
    players = generate_players(4, division_prefix="D")
    scores = {p.id: 0.0 for p in players}
    history = {p.id: set() for p in players}
    bye_history = set()

    for r in range(1, 4):
        pairings = create_swiss_pairings(players, scores, history, r, bye_history)
        for m in pairings:
            if m.p2:
                assert m.p2.id not in history.get(m.p1.id, set())
                history.setdefault(m.p1.id, set()).add(m.p2.id)
                history.setdefault(m.p2.id, set()).add(m.p1.id)
            else:
                bye_history.add(m.p1.id)
            scores[m.p1.id] += 1.0


def test_small_division_edge_case():
    """
    Scenario: 5 players, 5 rounds.
    This MUST result in repeat matches or multiple byes because 5 players can only
    have 4 unique opponents each, and 1 player is out each round.
    """
    players = generate_players(5, division_prefix="S")
    scores = {}
    history = {}
    bye_history = set()

    rounds = 5
    for r in range(1, rounds + 1):
        pairings = simulate_round(players, scores, history, bye_history, r)
        assert len(pairings) == 3  # 2 matches + 1 bye

    # Check that everyone got exactly one bye (since 5 rounds, 5 players)
    assert len(bye_history) == 5
    for p in players:
        assert p.id in bye_history


def test_tournament_with_constraints():
    """
    Scenario: Players from the same club should not play each other if possible.
    """
    # 8 players, 4 from Club X, 4 from Club Y
    players = []
    for i in range(4):
        players.append(Participant(id=f"X{i}", name=f"X{i}", metadata={"club": "X"}))
        players.append(Participant(id=f"Y{i}", name=f"Y{i}", metadata={"club": "Y"}))

    scores = {}
    history = {}
    bye_history = set()

    def club_constraint(p1, p2):
        return p1.metadata.get("club") != p2.metadata.get("club")

    # Round 1 with constraints
    pairings = create_swiss_pairings(
        participants=players,
        scores=scores,
        history=history,
        round_number=1,
        bye_history=bye_history,
        constraint_fn=club_constraint,
    )

    for m in pairings:
        if m.p2:
            assert m.p1.metadata["club"] != m.p2.metadata["club"]
