# GEMINI.md

Think customer first for tournament directors in go tournaments. Prioritize simple usage. Include detailed usage docs and implementation docs. Library can be consumed with no additional logic to create a stateless API.

## Project Overview

`nyig-td` is a minimal, type-safe Python library for generating tournament pairings. It currently focuses on Swiss pairings with advanced features like score-based matching, history tracking to prevent repeat matches, and automatic bye handling for odd numbers of participants.

### Technologies

- **Language:** Python 3.14+
- **Dependency Management:** [uv](https://github.com/astral-sh/uv)
- **Testing:** pytest
- **Linting & Formatting:** ruff
- **Static Analysis:** mypy

---

## Architecture and Design

The project follows a clean, functional approach to pairing generation:

- **`src/nyig_td/models/`**: Defines core data structures using Python dataclasses.
  - `Participant`: A frozen dataclass representing a player with an ID, name, optional seed, and metadata.
  - `Match`: Represents a pairing. Includes helper properties like `is_bye` and `winner`.
  - `Tournament`: Aggregate root. Manages participants/matches. Provides `get_participant(id)` and `create_round()`.
  - `Standing`: Represents calculated results (rank, score, tie-breakers).
  - `MetricsConfig`: Configuration for standings (tie-breakers, divisions, McMahon).
- **`src/nyig_td/metrics.py`**: High-performance standings engine ($O(P+M)$).
  - Calculates SOS, SODOS, and SOSOS using efficient pre-calculated mappings.
  - Handles division-based grouping and ranking logic.
- **`src/nyig_td/swiss.py`**: Swiss pairing algorithm.
  - Recursive backtracking solver with greedy fallback.
- **`src/nyig_td/mcmahon.py`**: McMahon pairing implementation.
  - Initial McMahon Scores (MMS) based on player ranks with bar support.

---

## Building and Running

This project uses `uv` for all development tasks.

### Environment Setup

```bash
uv sync
```

### Running Tests

```bash
# Run tests with coverage report
uv run pytest --cov=src --cov-report=term-missing
```

### Linting and Type Checking

```bash
# Linting with ruff
uv run ruff check .

# Type checking with mypy
uv run mypy src
```

---

## Release Process

Automated releases are handled via GitHub Actions when pushing to the `main` branch.

1. **Version Check:** The script `scripts/check_version.py` is used to prevent pushing a version that already exists on PyPI.
2. **PyPI Publication:** The `Publish to PyPI` workflow builds the package and uses Trusted Publishing to upload to PyPI.
3. **GitHub Release:** Upon successful publication, the workflow creates a GitHub Release tagged with the version (e.g., `v0.1.1`).

### Manual Version Check

```bash
uv run scripts/check_version.py
```

---

## Development Conventions

1. **Type Safety:** The library is strictly typed. Always ensure new code passes `mypy` checks.
2. **Immutable Models:** `Participant` is a `frozen` dataclass. External state (like scores or history) should be managed using maps keyed by participant IDs.
3. **Swiss Logic:**
   - **Primary sort:** Current score (descending).
   - **Secondary sort:** Seed (ascending).
   - **Bye handling:** The lowest-ranked player who hasn't had a bye receives it.
   - **Backtracking:** The solver attempts to avoid repeat pairings and satisfy custom constraints before falling back to greedy matching.
4. **Testing:** Comprehensive scenario-based testing is preferred. Existing tests cover large multi-division tournaments, bye cycling, and realistic club-based constraints.

---

## Key Files

- `src/nyig_td/models/`: Core domain models (Participant, Match, Tournament, Standing, MetricsConfig).
- `src/nyig_td/metrics.py`: Metrics engine and standings calculation.
- `src/nyig_td/swiss.py`: Swiss pairing algorithm.
- `src/nyig_td/mcmahon.py`: McMahon pairing algorithm.
- `tests/test_metrics.py`: Tests for standings and tie-breakers.
- `tests/test_swiss_scenarios.py`: Comprehensive Swiss pairing logic and edge case verification.
- `tests/test_mcmahon.py`: Tests for McMahon pairing logic.
- `scripts/check_version.py`: PyPI version verification script.
- `pyproject.toml`: Project metadata and tool configurations.
