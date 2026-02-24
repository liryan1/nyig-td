# GEMINI.md

## Project Overview

`nyig-td` is a minimal, type-safe Python library for generating tournament pairings. It supports two main pairing formats:
- **Single Elimination (Fixed Bracket):** Generates a tree-structured bracket following standard tournament seeding patterns (e.g., 1 vs 16, 8 vs 9).
- **Swiss Pairings:** Implements score-based matching with history tracking to prevent repeat matches and automatic bye handling for odd numbers of participants.

### Technologies
- **Language:** Python 3.14+
- **Dependency Management:** [uv](https://github.com/astral-sh/uv)
- **Testing:** pytest
- **Linting & Formatting:** ruff
- **Static Analysis:** mypy

---

## Architecture and Design

The project follows a clean, functional approach to pairing generation:

- **`src/nyig_td/models.py`**: Defines core data structures using Python dataclasses.
    - `Participant[T]`: A generic participant model (frozen) with an ID, name, and optional seed.
    - `Match[T]`: A recursive structure representing a pairing or a node in a bracket tree.
- **`src/nyig_td/single_elimination.py`**: Contains the `create_fixed_bracket` logic for tree-based single-elimination tournaments.
- **`src/nyig_td/swiss.py`**: Contains `create_swiss_pairings` which uses a backtracking solver to find valid pairings based on score groups and match history.

---

## Building and Running

This project uses `uv` for all development tasks.

### Environment Setup
```bash
uv sync
```

### Running Tests
```bash
uv run pytest
```

### Linting and Type Checking
```bash
# Linting with ruff
uv run ruff check .

# Type checking with mypy
uv run mypy src
```

---

## Development Conventions

1. **Type Safety:** The library is strictly typed using Python generics. Always ensure new code passes `mypy` checks.
2. **Immutable Models:** `Participant` is a `frozen` dataclass. Do not attempt to modify participant state directly; use ID-based maps for external state (like scores or history).
3. **Seeding:** Single elimination follows standard powers-of-two bracket expansion.
4. **Swiss Logic:**
    - Primary sort: Current score (descending).
    - Secondary sort: Seed (ascending).
    - Bye handling: The lowest-ranked player who hasn't had a bye receives it.
    - Backtracking: The solver attempts to avoid repeat pairings before falling back to greedy matching.

---

## Key Files

- `src/nyig_td/models.py`: Core domain models.
- `src/nyig_td/single_elimination.py`: Bracket generation logic.
- `src/nyig_td/swiss.py`: Swiss pairing algorithm.
- `tests/test_fixed_bracket.py`: Bracket logic verification.
- `tests/test_swiss.py`: Swiss pairing logic and edge case verification.
