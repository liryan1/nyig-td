from nyig_td import Participant, create_fixed_bracket


def test_fixed_bracket_8_players():
    players = [Participant(id=i, name=f"P{i}", seed=i) for i in range(1, 9)]
    final_match = create_fixed_bracket(players)

    assert final_match.round == 3
    assert final_match.m1 is not None
    assert final_match.m2 is not None

    # Check Round 1 (bottom layer)
    # The order for 8 should be: 1, 8, 4, 5, 3, 6, 7, 2
    # m1.m1 -> 1 vs 8
    # m1.m2 -> 4 vs 5
    # m2.m1 -> 3 vs 6
    # m2.m2 -> 7 vs 2

    m1_r1_1 = final_match.m1.m1
    assert m1_r1_1.p1.seed == 1
    assert m1_r1_1.p2.seed == 8

    m1_r1_2 = final_match.m1.m2
    assert m1_r1_2.p1.seed == 4
    assert m1_r1_2.p2.seed == 5

    m2_r1_1 = final_match.m2.m1
    assert m2_r1_1.p1.seed == 3
    assert m2_r1_1.p2.seed == 6

    m2_r1_2 = final_match.m2.m2
    assert m2_r1_2.p1.seed == 7
    assert m2_r1_2.p2.seed == 2


def test_fixed_bracket_with_byes():
    # 3 players -> 4 slots. Seeds: 1, 2, 3, None
    # Order for 4: 1, 4, 3, 2 -> 1, None, 3, 2
    players = [Participant(id=i, name=f"P{i}", seed=i) for i in range(1, 4)]
    final_match = create_fixed_bracket(players)

    assert final_match.round == 2
    assert final_match.m1.p1.seed == 1
    assert final_match.m1.p2 is None  # Bye
    assert final_match.m2.p1.seed == 3
    assert final_match.m2.p2.seed == 2
