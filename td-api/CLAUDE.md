# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**td-api** is a TypeScript/Express REST API that persists Go tournament data in MongoDB (via Prisma) and orchestrates calls to pairing-api for pairing/standings logic.

## Common Commands

```bash
npm install                    # install
npm run dev                    # dev server (port 3000, requires MongoDB + pairing-api)
npm test -- --watchAll=false   # jest single run (207 tests)
npm run test:watch             # jest watch mode
npm run test:coverage          # coverage
npm run lint                   # eslint
npm run format                 # prettier
npm run prisma:generate        # regenerate Prisma client after schema changes
npm run prisma:push            # sync schema to MongoDB
```

## Environment Variables

```
PORT=3000
DATABASE_URL=mongodb://localhost:27017/nyig-tournament
NYIG_TD_API_URL=http://localhost:8000
NODE_ENV=development
```

## Architecture

### Project Structure

```
src/
├── index.ts              # Entry point, MongoDB connection, server startup
├── app.ts                # Express app setup (helmet, CORS, error handler)
├── config/index.ts       # Environment configuration
├── types/index.ts        # TypeScript type definitions and enums
├── prisma/client.ts      # Prisma MongoDB client singleton
├── middleware/
│   └── errorHandler.ts   # Centralized error handling
├── routes/
│   ├── index.ts          # Router aggregation (/api/players, /api/tournaments)
│   ├── players.ts        # Player CRUD endpoints
│   └── tournaments.ts    # Tournament, registration, division, round endpoints
├── services/
│   ├── index.ts          # Service exports
│   ├── playerService.ts  # Player business logic
│   ├── tournamentService.ts # Tournament orchestration
│   └── nyigTdClient.ts   # HTTP client to pairing-api
└── utils/
    └── validation.ts     # Zod validation schemas
```

### Data Model (Prisma/MongoDB)

Tournament embeds all sub-documents: `settings` (includes `crossDivisionPairing`), `divisions[]`, `registrations[]` (includes `divisionId`), and `rounds[]` (each containing `pairings[]` and `byes[]`). Players are a separate top-level collection.

### External Dependency

The API delegates pairing generation, handicap calculation, and standings computation to pairing-api via HTTP. The client is in `services/nyigTdClient.ts`.

### Game Result Types

String literal types: `'B+'`, `'W+'`, `'B+F'`, `'W+F'`, `'Draw'`, `'NR'`, `'BL'`.

## Testing

- 207 tests across 7 suites
- Tests use Jest + Supertest
- Test files mirror source structure under `tests/`
- Prisma is mocked in tests — no database required
- pairing-api calls are mocked via axios mocking
