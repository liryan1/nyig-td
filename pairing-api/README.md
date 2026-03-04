# Pairing API

Stateless FastAPI service for Go tournament management. Wraps the lib (nyig-td) Python package to expose tournament functionality via REST endpoints.

## Overview

This API provides endpoints for:

- **Pairing Generation** - Swiss and McMahon pairing algorithms
- **Standings Calculation** - Tournament standings with configurable tiebreakers (SOS, SODOS, extended SOS)
- **Handicap Calculation** - AGA-compliant handicap stones and komi
- **Rank Validation** - Validate and normalize Go rank strings

All endpoints are stateless - provide complete tournament state in each request.

## Technical Details

### Tech Stack

- Python 3.14+
- FastAPI with Pydantic v2
- uvicorn ASGI server
- nyig-td core library

### API Endpoints

| Method | Endpoint          | Description                          |
| ------ | ----------------- | ------------------------------------ |
| GET    | `/health`         | Health check                         |
| GET    | `/`               | API info                             |
| POST   | `/pair`           | Generate pairings for a round        |
| POST   | `/standings`      | Calculate tournament standings       |
| POST   | `/handicap`       | Calculate handicap between two ranks |
| POST   | `/validate/ranks` | Validate rank strings                |

### Example Request

```bash
# Calculate handicap
curl -X POST http://localhost:8000/handicap \
  -H "Content-Type: application/json" \
  -d '{"white_rank": "3d", "black_rank": "1k"}'

# Response: {"stones": 3, "komi": 0.5, "description": "3 stones, 0.5 komi"}
```

## Development

### Setup

```bash
# Clone and install
cd pairing-api
uv sync

# Run development server
uv run uvicorn pairing_api.main:app --reload --port 8000
```

### Testing

69 tests, 94% coverage. Includes integration tests for full multi-round tournaments with divisions.

```bash
# Run tests (includes coverage report)
uv run pytest

# Linting and type checking
uv run ruff check src/
uv run mypy src/
```

### API Documentation

With the server running:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Docker

```bash
# Build
docker build -t pairing-api .

# Run
docker run -p 8080:8080 pairing-api
```

## Project Structure

```
src/pairing_api/
├── main.py          # FastAPI app, CORS, health endpoints
├── schemas.py       # Pydantic request/response models
└── routers/
    ├── handicap.py  # POST /handicap
    ├── pairing.py   # POST /pair
    ├── standings.py # POST /standings
    └── validation.py # POST /validate/ranks

tests/
├── test_health.py
├── test_handicap_api.py
├── test_pairing_api.py
├── test_standings_api.py
├── test_validation_api.py
└── integration/
    └── test_api_tournaments_with_divisions.py
```
