# NYIG TD

A minimal Python library for tournament pairings.

## Features

- Single Elimination pairing with automatic bye handling.
- Swiss pairing with score-based matching and repeat prevention.
- Seed-based matching (1 vs N, 2 vs N-1).
- Type-safe implementation.

## Installation

```bash
pip install nyig-td
```

## Usage

```python
from nyig_td import Participant, create_single_elimination_bracket

players = [
    Participant(id=1, name="Alice", seed=1),
    Participant(id=2, name="Bob", seed=2),
    Participant(id=3, name="Charlie", seed=3),
]

matches = create_single_elimination_bracket(players)

for match in matches:
    p1_name = match.p1.name if match.p1 else "Bye"
    p2_name = match.p2.name if match.p2 else "Bye"
    print(f"{p1_name} vs {p2_name}")
```

### Swiss Pairings

```python
from nyig_td import Participant, create_swiss_pairings

players = [
    Participant(id=1, name="Alice", seed=1),
    Participant(id=2, name="Bob", seed=2),
    Participant(id=3, name="Charlie", seed=3),
    Participant(id=4, name="David", seed=4),
]

# Initial round
scores = {p.id: 0.0 for p in players}
history = {p.id: set() for p in players}
bye_history = set()

pairings = create_swiss_pairings(players, scores, history, round_number=1, bye_history=bye_history)
```

## Development

This project uses `uv` for dependency management.

```bash
uv sync
uv run pytest
```
