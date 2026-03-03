# CLAUDE.md

This file provides context about the lib package for AI assistants.

## Project Overview

**lib** is a Python library for managing Go (the board game) tournament pairings, handicaps, and standings. It implements Swiss and McMahon pairing systems with AGA-compliant handicap calculation.

## Tech Stack

- Python 3.11+
- No external runtime dependencies
- Dev tools: pytest, mypy (strict), ruff, pytest-cov
- Package manager: uv
- Build system: hatchling

## Project Structure

```
src/nyig_td/
├── __init__.py      # Package exports
├── ranks.py         # Go rank representation (kyu/dan)
├── handicap.py      # Handicap and komi calculation
├── models.py        # Data models (Player, Tournament, Pairing, Round)
├── pairing.py       # Swiss and McMahon pairing algorithms
└── standings.py     # Standings calculator with tiebreakers

tests/
├── test_ranks.py
├── test_handicap.py
├── test_pairing.py
├── test_standings.py
└── test_real_tournament_scenarios.py

examples/
├── swiss_tournament.py
├── mcmahon_tournament.py
└── mcmahon_divisions.py
```

## Key Concepts

### Go Ranks
- Kyu ranks: 30k (weakest) to 1k (strongest kyu)
- Dan ranks: 1d (weakest dan) to 9d (strongest)
- Internal value system: 30k=-29, 1k=0, 1d=1, 9d=9

### Handicap (AGA Rules)
- Even game: 7.5 komi to white
- 1 rank difference: 0.5 komi, no stones
- 2+ ranks: handicap stones = difference (max 9), 0.5 komi

### McMahon System
- Players start with initial score based on rank
- "Bar" rank (e.g., 3d) = score 0
- Below bar: negative initial score
- Pairing based on current McMahon score (initial + wins)

### Standings Tiebreakers
- SOS: Sum of Opponents' Scores
- SODOS: Sum of Defeated Opponents' Scores
- Extended SOS: Sum of opponents' SOS

## Common Commands

```bash
# Run tests
uv run pytest

# Type check
uv run mypy src/nyig_td

# Lint
uv run ruff check src/nyig_td

# Run example
uv run python examples/swiss_tournament.py
```

## Architecture Notes

1. **Immutable Rank**: `Rank` is a frozen dataclass for hashability
2. **Factory methods**: `Player.create()`, `Tournament.create()` generate UUIDs
3. **Divisions are presentation-only**: Pairing is cross-division; divisions filter standings for prizes
4. **Abstract PairingEngine**: Swiss and McMahon inherit from common base
5. **Separation of concerns**: Pairing logic is separate from standings calculation

## Module Quick Reference

| Module | Key Classes | Purpose |
|--------|-------------|---------|
| ranks.py | `Rank`, `RankType` | Rank parsing, comparison, arithmetic |
| handicap.py | `Handicap`, `HandicapCalculator` | Calculate stones and komi |
| models.py | `Player`, `Tournament`, `Pairing`, `Round` | Data structures |
| pairing.py | `SwissPairingEngine`, `McMahonPairingEngine` | Generate pairings |
| standings.py | `StandingsCalculator`, `PlayerStanding` | Calculate rankings |

## Testing

- 99 tests, 99% coverage
- Real tournament scenario tests simulate full multi-round tournaments
- Edge cases: odd players (byes), repeat pairings, color balancing, all result types

## When Modifying This Package

- Run full test suite after changes: `uv run pytest`
- Maintain strict mypy compliance
- Keep modules focused on single responsibility
- Add tests for new functionality
- Update examples if API changes
