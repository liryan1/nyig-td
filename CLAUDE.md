# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a monorepo for a Go (board game) tournament management system used for US tournaments (typically 4-5 rounds, 20-150 players). It consists of four packages that form a layered architecture:

```
web (React)  →  td-api (Express/MongoDB)  →  pairing-api (FastAPI)  →  lib (Python lib)
```

- **lib** — Python library implementing pairing, handicap, and standings logic. Zero runtime dependencies.
- **pairing-api** — Stateless FastAPI wrapper exposing lib via REST. All tournament state must be provided per request.
- **td-api** — TypeScript/Express API with MongoDB (Prisma). Persists tournaments/players and orchestrates calls to pairing-api.
- **web** — React 19 + Vite frontend with Shadcn/ui, TailwindCSS, React Query, React Hook Form.

## Common Commands

### lib (Python core library)
```bash
cd lib
uv sync                                                    # install
uv run pytest                                               # test (auto-includes coverage)
uv run pytest tests/test_pairing.py::TestClass::test_name   # single test
uv run mypy src/nyig_td                                     # type check (strict)
uv run ruff check src/nyig_td                               # lint
uv run ruff format src/nyig_td                              # format
```

### pairing-api (FastAPI wrapper)
```bash
cd pairing-api
uv sync                                                     # install
uv run pytest                                                # test
uv run pytest tests/test_pairing_api.py::test_name -v        # single test
uv run uvicorn pairing_api.main:app --reload --port 8000      # dev server (docs at /docs)
uv run mypy src/                                             # type check
uv run ruff check src/                                       # lint
```

### td-api (TypeScript API)
```bash
cd td-api
npm install                    # install
npm run dev                    # dev server (port 3000, requires MongoDB + pairing-api running)
npm test                       # jest (watch mode)
npm run test:coverage          # coverage
npm run lint                   # eslint
npm run format                 # prettier
npm run prisma:generate        # regenerate Prisma client after schema changes
npm run prisma:push            # sync schema to MongoDB
```

### web (React frontend)
```bash
cd web
npm install                    # install
npm run dev                    # vite dev server (port 5173)
npm test                       # vitest (watch mode)
npm run test:run               # vitest single run
npm run build                  # production build (tsc + vite)
npm run lint                   # eslint
```

### Environment Variables (td-api)
```
PORT=3000
DATABASE_URL=mongodb://localhost:27017/nyig-tournament
NYIG_TD_API_URL=http://localhost:8000
NODE_ENV=development
```

## Architecture

### Data Flow
The TypeScript API is the persistence layer. When pairings or standings are needed, it serializes the full tournament state and POSTs to pairing-api, which builds temporary lib domain objects, runs the algorithm, and returns results. The TypeScript API then stores results in MongoDB.

### Key Data Model (Prisma/MongoDB)
Tournament embeds all sub-documents: `settings`, `divisions[]`, `registrations[]`, and `rounds[]` (each containing `pairings[]` and `byes[]`). Players are a separate top-level collection. Registrations reference players by `playerId` and track `roundsParticipating` (array of round numbers) for partial participation.

### lib Internal Architecture
- **ranks.py** — `Rank` frozen dataclass. Internal values: 30k=-29, 1k=0, 1d=1, 9d=9.
- **handicap.py** — AGA rules: even=7.5 komi; 1 rank diff=0.5 komi; 2+ ranks=stones (max 9) + 0.5 komi. Configurable reduction.
- **models.py** — `Player`, `Tournament`, `Pairing`, `Round`, `Bye`. Factory methods (`Player.create()`, `Tournament.create()`) generate UUIDs.
- **pairing.py** — Abstract `PairingEngine` base; `SwissPairingEngine` (score-based) and `McMahonPairingEngine` (rank-based initial scores). Handles repeat prevention, color balancing, byes for odd player count.
- **standings.py** — `StandingsCalculator` with configurable `StandingsWeights` (wins, SOS, SODOS, extended SOS). Default: wins=1.0, sos=0.1, sodos=0.05, extended_sos=0.0.

### Type Mappings Between Layers
pairing-api has its own Pydantic enums (`PairingAlgorithmEnum`, `GameResultEnum`) that map to lib enums. Each router has a `game_result_from_enum()` helper. The TypeScript API uses string literal types (`'B+'`, `'W+'`, `'B+F'`, `'W+F'`, `'Draw'`, `'NR'`, `'BL'`).

## Go Tournament Domain Concepts

### Divisions and Cross-Division Pairing
Divisions group players for prize purposes. The `crossDivisionPairing` setting (default true) controls whether pairing considers all players or only within-division. Standings are always filtered by division for prizes. This is a presentation concern — the pairing algorithm itself doesn't know about divisions.

### McMahon System
Players get initial scores based on rank relative to a "bar" (e.g., 3d). At/above bar = 0, below bar = negative (1 per rank below). McMahon score = initial + wins. Pairing matches players with similar McMahon scores.

### Swiss System
Pure score-based. Top half of score group paired against bottom half. No rank-based initial scores.

### Partial Participation
Players may skip rounds. `roundsParticipating` tracks which rounds each player plays. Players not participating in a round are excluded from that round's pairing.

## Testing

All tests includes real tournament scenarios and edge cases.

- **lib**: pytest with automatic coverage. Includes real tournament scenario tests.
- **pairing-api**: pytest with `httpx.AsyncClient` + `ASGITransport` (no server needed). Uses `@pytest.mark.anyio`.
- **td-api**: Jest + Supertest. Use `npm test -- --watchAll=false` for single run.
- **web**: Vitest + React Testing Library. Use `npm run test:run` for single run.

## Known Issues
1. SOS/SODOS calculations may be incorrect — unverified with mock API
