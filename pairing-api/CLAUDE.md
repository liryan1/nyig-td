# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pairing-api** is a stateless FastAPI service that wraps the lib Python package (nyig_td) to expose Go tournament management functionality via REST endpoints. All endpoints are stateless - clients must provide complete tournament state in each request.

## Common Commands

```bash
# Install dependencies
uv sync

# Run development server
uv run uvicorn pairing_api.main:app --reload --port 8000

# Run tests (includes coverage report)
uv run pytest

# Run single test
uv run pytest tests/test_pairing_api.py::test_generate_swiss_pairings -v

# Linting and type checking
uv run ruff check src/
uv run mypy src/
```

## Architecture

### Stateless Design
Each API request must include all tournament data (players, previous rounds, results). The service builds temporary `nyig_td` domain objects from request data, processes them, and returns results. No state is persisted between requests.

### Request Flow
1. Pydantic schema validates incoming JSON (`schemas.py`)
2. Router converts API types to `nyig_td` domain types (e.g., `GameResultEnum` → `GameResult`)
3. Router builds `Tournament` object from request data
4. `nyig_td` library processes (pairing/standings/handicap calculation)
5. Router converts domain results back to API response schemas

### Key Type Mappings
The API has its own enums that map to `nyig_td` enums:
- `PairingAlgorithmEnum` → `PairingAlgorithm`
- `GameResultEnum` → `GameResult`

Each router has a `game_result_from_enum()` helper for this conversion.

### lib Dependency
The `nyig_td` package is linked as an editable local dependency (`../lib`). Key imports used:
- `Rank`, `validate_rank` - rank parsing
- `HandicapCalculator` - stones/komi calculation
- `Tournament`, `Player`, `Pairing`, `Bye`, `Round` - domain models
- `get_pairing_engine()` - Swiss/McMahon pairing
- `StandingsCalculator` - standings with tiebreakers

## Testing

Tests use `httpx.AsyncClient` with `ASGITransport` to test the FastAPI app directly without running a server. The pattern:

```python
@pytest.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.mark.anyio
async def test_example(client: AsyncClient) -> None:
    response = await client.post("/endpoint", json={...})
```

## Test Stats

- 69 tests, 94% coverage
- Integration tests cover full multi-round tournaments with divisions

## Configuration

- Python 3.14+ required
- mypy strict mode with pydantic plugin enabled
- pytest configured with automatic coverage reporting
