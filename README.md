# NYIG TD

A minimal Python library for tournament pairings.

## Features

- Swiss pairing with score-based matching and repeat prevention.
- Seed-based matching (1 vs N, 2 vs N-1).

## Installation

```bash
pip install nyig-td
```

## Usage

### Swiss Pairings

```python
from nyig_td import Participant, create_swiss_pairings

# ... setup players, scores, history ...
pairings = create_swiss_pairings(players, scores, history, round_number=1, bye_history=bye_history)
```

### McMahon Pairings

McMahon pairing is common in Go tournaments. Players start with an initial score based on their rank. The library can automatically extract ranks from participant metadata.

```python
# Participants with rank in metadata
players = [
    Participant(id="P1", name="Alice", metadata={"rank": 20}),
    Participant(id="P2", name="Bob", metadata={"rank": 19}),
]

t = Tournament(id="T1", name="City Open", participants=players)

# Generate round 1 using metadata ranks automatically
pairings = t.create_round(
    type="mcmahon",
    top_bar=20,
    bottom_bar=10
)

# Inspect match properties
match = pairings[0]
if not match.is_bye:
    print(f"Board 1: {match.p1.name} vs {match.p2.name}")
```

### Standings and Metrics

The library provides a powerful metrics engine to calculate standings with custom tie-breaking rules, supporting both Swiss and McMahon formats.

```python
from nyig_td.models import Tournament, MetricsConfig, TieBreaker

# 1. Setup tournament and record matches
t = Tournament(id="T1", name="City Open", participants=players)
# ... add matches and results ...

# 2. Configure standings (optional)
config = MetricsConfig(
    tie_breakers=[
        TieBreaker.MAIN_SCORE,
        TieBreaker.SOS,         # Sum of Opponents' Scores
        TieBreaker.SODOS,       # Sum of Defeated Opponents' Scores
        TieBreaker.SOSOS        # Sum of Opponents' SOS
    ],
    bye_points=1.0  # Points awarded for a bye
)

# 3. Get standings
standings = t.get_standings(config)
for entry in standings["General"]:
    print(f"{entry.rank}. {entry.participant.name} - {entry.main_score} ({entry.record})")
```

#### Tournament Divisions

You can automatically group standings by player rank:

```python
from nyig_td.models import DivisionConfig

config = MetricsConfig(
    divisions=[
        DivisionConfig(name="Open", min_rank=20),
        DivisionConfig(name="Intermediate", min_rank=10, max_rank=19),
        DivisionConfig(name="Novice", max_rank=9)
    ]
)

standings_by_div = t.get_standings(config)
# returns {"Open": [...], "Intermediate": [...], "Novice": [...]}
```

#### McMahon Standings

To use McMahon Scores (Initial Rank + Points) as the primary metric:

```python
config = MetricsConfig(
    use_mcmahon=True,
    top_bar=20,    # McMahon scores are capped at 20
    bottom_bar=5   # McMahon scores are floored at 5
)
standings = t.get_standings(config)
```

## Development

This project uses `uv` for dependency management.

```sh
uv sync
uv run mypy
uv run pytest
```
