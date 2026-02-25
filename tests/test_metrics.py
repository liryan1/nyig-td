from nyig_td.metrics import calculate_standings
from nyig_td.models import (
    DivisionConfig,
    Match,
    MatchResult,
    MetricsConfig,
    Participant,
    Tournament,
)


def test_basic_swiss_standings():
    p1 = Participant(id="P1", name="Player 1")
    p2 = Participant(id="P2", name="Player 2")
    p3 = Participant(id="P3", name="Player 3")
    p4 = Participant(id="P4", name="Player 4")

    t = Tournament(id="T1", name="Test Tournament", participants=[p1, p2, p3, p4])

    # Round 1: P1 vs P2 (P1 wins), P3 vs P4 (P3 wins)
    m1 = Match(p1=p1, p2=p2, round=1, result=MatchResult.P1WIN)
    m2 = Match(p1=p3, p2=p4, round=1, result=MatchResult.P1WIN)
    t.matches.extend([m1, m2])

    standings = calculate_standings(t)["General"]

    assert len(standings) == 4
    # P1 and P3 should be top 2 (1.0 points)
    assert standings[0].main_score == 1.0
    assert standings[1].main_score == 1.0
    # SOS for P1 is P2's score (0.0)
    # SOS for P3 is P4's score (0.0)
    assert standings[0].sos == 0.0

    # Round 2: P1 vs P3 (P1 wins), P2 vs P4 (P2 wins)
    m3 = Match(p1=p1, p2=p3, round=2, result=MatchResult.P1WIN)
    m4 = Match(p1=p2, p2=p4, round=2, result=MatchResult.P1WIN)
    t.matches.extend([m3, m4])

    standings = calculate_standings(t)["General"]
    # P1: 2.0 pts, played P2(1.0), P3(1.0) -> SOS 2.0
    # P2: 1.0 pts, played P1(2.0), P4(0.0) -> SOS 2.0
    # P3: 1.0 pts, played P4(0.0), P1(2.0) -> SOS 2.0
    # P4: 0.0 pts, played P3(1.0), P2(1.0) -> SOS 2.0

    assert standings[0].participant.id == "P1"
    assert standings[0].main_score == 2.0
    assert standings[0].sos == 2.0
    assert standings[0].record == "2-0-0"


def test_custom_bye_points():
    p1 = Participant(id="P1", name="Player 1")
    t = Tournament(id="T1", name="Test Tournament", participants=[p1])

    # P1 gets a bye
    m1 = Match(p1=p1, p2=None, round=1, result=MatchResult.BYE)
    t.matches.append(m1)

    # Default 1.0
    s1 = calculate_standings(t)["General"]
    assert s1[0].main_score == 1.0
    assert s1[0].byes == 1

    # Custom 0.5
    config = MetricsConfig(bye_points=0.5)
    s2 = calculate_standings(t, config)["General"]
    assert s2[0].main_score == 0.5


def test_divisions():
    p1 = Participant(id="P1", name="P1", metadata={"rank": 25})  # Open
    p2 = Participant(id="P2", name="P2", metadata={"rank": 24})  # Open
    p3 = Participant(id="P3", name="P3", metadata={"rank": 15})  # Novice
    p4 = Participant(id="P4", name="P4", metadata={"rank": 10})  # Novice

    t = Tournament(id="T1", name="Test Tournament", participants=[p1, p2, p3, p4])

    config = MetricsConfig(
        divisions=[
            DivisionConfig(name="Open", min_rank=20),
            DivisionConfig(name="Novice", max_rank=19),
        ]
    )

    standings = calculate_standings(t, config)
    assert "Open" in standings
    assert "Novice" in standings
    assert len(standings["Open"]) == 2
    assert len(standings["Novice"]) == 2


def test_custom_tie_breakers():
    # P1 and P2 have same score and SOS, but P1 has better SODOS
    p1 = Participant(id="P1", name="P1")
    p2 = Participant(id="P2", name="P2")
    p3 = Participant(id="P3", name="P3")  # Weak opponent
    p4 = Participant(id="P4", name="P4")  # Strong opponent
    p5 = Participant(id="P5", name="P5")  # Dummy for P3 to beat

    t = Tournament(id="T1", name="Test Tournament", participants=[p1, p2, p3, p4, p5])

    # Round 1: P1 beats P4 (strong), P2 beats P3 (weak)
    # R1 Scores: P1(1), P2(1), P3(0), P4(0), P5(0)
    t.matches.append(Match(p1=p1, p2=p4, result=MatchResult.P1WIN))
    t.matches.append(Match(p1=p2, p2=p3, result=MatchResult.P1WIN))

    # Round 2: P4 beats P5.
    # R2 Scores: P1(1), P2(1), P4(1), P3(0), P5(0)
    t.matches.append(Match(p1=p4, p2=p5, result=MatchResult.P1WIN))

    # Current Standings:
    # P1: 1.0 pt, SOS = Score(P4) = 1.0, SODOS = Score(P4) = 1.0
    # P2: 1.0 pt, SOS = Score(P3) = 0.0, SODOS = Score(P3) = 0.0

    standings = calculate_standings(t)["General"]
    assert standings[0].participant.id == "P1"
    # P2 and P4 both have 1.0 points. P4's SOS = Score(P5) = 0.0.
    # P2's SOS = Score(P3) = 0.0.
    # We don't have enough to separate them yet, but P1 is definitely #1.

    # Now make P3 win a match so P2's SOS becomes equal to P1's SOS
    # Round 3: P3 beats P5.
    # R3 Scores: P1(1), P2(1), P4(1), P3(1), P5(0)
    t.matches.append(Match(p1=p3, p2=p5, result=MatchResult.P1WIN))

    # P1: 1.0 pt, SOS = Score(P4) = 1.0, SODOS = Score(P4) = 1.0
    # P2: 1.0 pt, SOS = Score(P3) = 1.0, SODOS = Score(P3) = 1.0
    # They are tied in score, SOS, and SODOS.

    # Let's add Seed tie breaker
    p1 = Participant(id="P1", name="P1", seed=1)
    p2 = Participant(id="P2", name="P2", seed=2)
    t.participants[0] = p1
    t.participants[1] = p2


def test_mcmahon_standings():
    # P1: Rank 20, P2: Rank 19
    p1 = Participant(id="P1", name="P1", metadata={"rank": 20})
    p2 = Participant(id="P2", name="P2", metadata={"rank": 19})

    t = Tournament(id="T1", name="Test McMahon", participants=[p1, p2])

    # Round 1: P1 beats P2
    t.matches.append(Match(p1=p1, p2=p2, result=MatchResult.P1WIN))

    # With use_mcmahon=True:
    # P1: 20 (rank) + 1.0 (win) = 21.0 MMS
    # P2: 19 (rank) + 0.0 (loss) = 19.0 MMS
    config = MetricsConfig(use_mcmahon=True)
    standings = calculate_standings(t, config)["General"]

    assert standings[0].participant.id == "P1"
    assert standings[0].main_score == 21.0
    assert standings[1].participant.id == "P2"
    assert standings[1].main_score == 19.0

    # Test with bars
    # Top bar 19 means P1 starts at 19
    config_barred = MetricsConfig(use_mcmahon=True, top_bar=19)
    standings_barred = calculate_standings(t, config_barred)["General"]
    # P1: 19 (capped rank) + 1.0 (win) = 20.0 MMS
    # P2: 19 (rank) + 0.0 (loss) = 19.0 MMS
    assert standings_barred[0].main_score == 20.0
    assert standings_barred[1].main_score == 19.0


def test_tournament_get_standings():
    p1 = Participant(id="P1", name="P1")
    t = Tournament(id="T1", name="T1", participants=[p1])
    standings = t.get_standings()
    assert "General" in standings
    assert standings["General"][0].participant.id == "P1"


def test_complex_standings_with_ties():
    """
    Verifies SODOS and SOS calculations when matches end in ties.
    """
    p1 = Participant(id="P1", name="P1")
    p2 = Participant(id="P2", name="P2")
    p3 = Participant(id="P3", name="P3")

    t = Tournament(id="T1", name="T1", participants=[p1, p2, p3])

    # P1 vs P2: TIE (0.5 each)
    # P1 vs P3: P1 wins (1.0 for P1)
    # P2 vs P3: P2 wins (1.0 for P2)

    # Scores: P1=1.5, P2=1.5, P3=0
    t.matches.append(Match(p1=p1, p2=p2, result=MatchResult.TIE))
    t.matches.append(Match(p1=p1, p2=p3, result=MatchResult.P1WIN))
    t.matches.append(Match(p1=p2, p2=p3, result=MatchResult.P1WIN))

    standings = t.get_standings()["General"]

    # P1: main=1.5, SOS = Score(P2)+Score(P3) = 1.5 + 0 = 1.5
    # P2: main=1.5, SOS = Score(P1)+Score(P3) = 1.5 + 0 = 1.5
    # P1 SODOS: 0.5 * Score(P2) [tie] + 1.0 * Score(P3) [win] = 0.5 * 1.5 + 1.0 * 0 = 0.75
    # P2 SODOS: 0.5 * Score(P1) [tie] + 1.0 * Score(P3) [win] = 0.5 * 1.5 + 1.0 * 0 = 0.75

    assert standings[0].main_score == 1.5
    assert standings[0].sos == 1.5
    assert standings[0].sodos == 0.75
