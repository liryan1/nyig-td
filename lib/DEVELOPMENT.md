# Development Guide

This document covers development setup, testing, and contribution guidelines for nyig-td.

## Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv) package manager

Install uv:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Development Setup

### Clone and Install

```bash
git clone https://github.com/nyig/nyig-td.git
cd nyig-td

# Install with dev dependencies
uv sync
uv pip install -e ".[dev]"
```

### Project Structure

```
nyig-td/
├── src/nyig_td/
│   ├── __init__.py      # Package exports
│   ├── ranks.py         # Go rank representation
│   ├── handicap.py      # Handicap calculator
│   ├── models.py        # Data models (Player, Tournament, etc.)
│   ├── pairing.py       # Pairing algorithms
│   └── standings.py     # Standings calculator
├── tests/
│   ├── test_ranks.py
│   ├── test_handicap.py
│   ├── test_pairing.py
│   ├── test_standings.py
│   └── test_real_tournament_scenarios.py
├── examples/
│   ├── swiss_tournament.py
│   ├── mcmahon_tournament.py
│   └── mcmahon_divisions.py
├── pyproject.toml
├── README.md
└── DEVELOPMENT.md
```

## Running Tests

### Full Test Suite

```bash
uv run pytest
```

### With Verbose Output

```bash
uv run pytest -v
```

### Specific Test File

```bash
uv run pytest tests/test_ranks.py
```

### Specific Test

```bash
uv run pytest tests/test_ranks.py::TestRank::test_from_string_kyu
```

### With Coverage Report

```bash
uv run pytest --cov=nyig_td --cov-report=term-missing
```

Coverage is automatically included via pyproject.toml settings.

## Code Quality

### Type Checking

```bash
uv run mypy src/nyig_td
```

The project uses strict mypy settings (see pyproject.toml).

### Linting

```bash
uv run ruff check src/nyig_td
```

### Auto-fix Linting Issues

```bash
uv run ruff check --fix src/nyig_td
```

### Format Code

```bash
uv run ruff format src/nyig_td
```

## Running Examples

```bash
uv run python examples/swiss_tournament.py
uv run python examples/mcmahon_tournament.py
uv run python examples/mcmahon_divisions.py
```

## Configuration

### pyproject.toml

Key configuration sections:

```toml
[project]
requires-python = ">=3.11"

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-cov>=4.1.0",
    "mypy>=1.8.0",
    "ruff>=0.2.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --cov=nyig_td --cov-report=term-missing"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.mypy]
python_version = "3.11"
strict = true
```

## Architecture

### Module Overview

#### ranks.py

Go rank representation with internal value system:
- 30k = -29, 1k = 0, 1d = 1, 9d = 9
- Natural ordering (higher rank = higher value)
- Parsing from strings ("5k", "3d")
- Arithmetic operations (difference, stones_difference)

#### handicap.py

AGA-compliant handicap calculation:
- Even game: 7.5 komi
- 1 rank difference: 0.5 komi, no stones
- 2+ ranks: handicap stones equal to difference, 0.5 komi
- Maximum 9 handicap stones

#### models.py

Data models following immutable patterns where appropriate:
- `Player` - Tournament participant with rank, club, AGA ID
- `Pairing` - Game pairing with handicap settings
- `Round` - Collection of pairings and byes
- `Tournament` - Full tournament state
- Enums for results, statuses, algorithms

#### pairing.py

Abstract base class with Swiss and McMahon implementations:
- `PairingEngine` - Abstract base with shared utilities
- `SwissPairingEngine` - Score-based pairing
- `McMahonPairingEngine` - Rank-based initial scores
- Color balancing and repeat prevention

#### standings.py

Standings calculation with configurable weights:
- Wins/losses tracking
- SOS (Sum of Opponents' Scores)
- SODOS (Sum of Defeated Opponents' Scores)
- Extended SOS (SOS of opponents)
- Tie handling with same rank for tied players

### Design Decisions

1. **Divisions as presentation concern** - Pairing happens across all players; divisions are filters applied to standings output.

2. **Immutable Rank** - `Rank` is a frozen dataclass for hashability and safety.

3. **Factory methods** - `Player.create()`, `Tournament.create()` for consistent ID generation.

4. **Separation of concerns** - Pairing logic separate from standings calculation.

5. **No external dependencies** - Core library uses only Python stdlib.

## Testing Philosophy

### Test Categories

1. **Unit tests** - Individual function/method behavior
2. **Integration tests** - Module interactions
3. **Scenario tests** - Real tournament simulations

### Coverage Goals

- Aim for >95% coverage
- Focus on edge cases:
  - Odd number of players (bye handling)
  - Repeat pairings
  - Color balancing
  - All game result types

### Test Naming

```python
class TestClassName:
    def test_specific_behavior(self):
        """Test that specific behavior works correctly."""
        pass
```

## Contributing

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with tests
4. Ensure all checks pass:
   ```bash
   uv run pytest
   uv run mypy src/nyig_td
   uv run ruff check src/nyig_td
   ```
5. Commit with descriptive message
6. Push to your fork
7. Open a Pull Request

### Commit Message Format

```
feat(module): add new feature

- Detail about the change
- Another detail
```

Prefixes:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `test` - Adding tests
- `refactor` - Code refactoring

### Code Style

- Follow existing patterns in the codebase
- Use type hints for all function signatures
- Write docstrings for public APIs
- Keep functions focused and small
- Prefer composition over inheritance

## Release Process

1. Update version in `pyproject.toml`
2. Update CHANGELOG (if maintained)
3. Create git tag: `git tag v0.1.0`
4. Push tags: `git push --tags`
5. Build: `uv build`
6. Publish: `uv publish`

## Troubleshooting

### Import Errors After Changes

```bash
uv pip install -e .
```

### mypy Cache Issues

```bash
rm -rf .mypy_cache
uv run mypy src/nyig_td
```

### Test Discovery Issues

```bash
uv run pytest --collect-only
```

## Resources

- [Go Ranks Explained](https://senseis.xmp.net/?GoRanks)
- [McMahon System](https://senseis.xmp.net/?McMahonPairing)
- [Swiss System](https://senseis.xmp.net/?SwissPairing)
- [AGA Tournament Rules](https://www.usgo.org/aga-tournament-regulations)
