# NYIG TD Web App

React frontend for managing Go (board game) tournaments. Provides tournament creation, player registration, pairing management, and standings display.

## Features

- **Tournament Management** — Create and configure Swiss or McMahon tournaments
- **Player Registry** — Maintain a player database with Go ranks and club affiliations
- **Registration** — Register players with optional division assignment and per-round participation
- **Division Support** — Create divisions, assign players, filter standings by division
- **Pairings** — Generate automatic pairings, manual pair/unpair, record game results
- **Standings** — View standings with SOS/SODOS tiebreakers, filterable by division
- **Offline Mode** — Full in-memory mock API for development without a backend

## Tech Stack

| Component     | Technology                          |
| ------------- | ----------------------------------- |
| Framework     | React 19                            |
| Build Tool    | Vite 7                              |
| Language      | TypeScript 5.9                      |
| UI Components | Shadcn/ui + Radix UI                |
| Styling       | TailwindCSS 4                       |
| Server State  | TanStack React Query 5              |
| Forms         | React Hook Form 7 + Zod 3           |
| Routing       | React Router 7                      |
| Testing       | Vitest 4 + React Testing Library 16 |

## Development

### Prerequisites

- Node.js 20+
- nyig-tournament-api running on port 3000 (or use mock API)

### Setup

```bash
npm install
```

### Running

```bash
# With real backend
npm run dev

# With mock API (no backend needed)
VITE_USE_MOCK_API=true npm run dev
```

The dev server starts at http://localhost:5173.

### Testing

99 tests across 7 suites.

```bash
# Single run
npm run test:run

# Watch mode
npm test

# Build (includes type checking)
npm run build

# Lint
npm run lint
```

## Environment Variables

| Variable            | Default                     | Description            |
| ------------------- | --------------------------- | ---------------------- |
| `VITE_API_URL`      | `http://localhost:3000/api` | Backend API base URL   |
| `VITE_USE_MOCK_API` | `false`                     | Use in-memory mock API |

## Project Structure

```
src/
├── types/index.ts              # TypeScript interfaces and enums
├── services/                   # API layer (real + mock implementations)
├── components/
│   ├── ui/                     # Shadcn/ui primitives
│   ├── tournament/             # TournamentForm, RegistrationTable, RoundManager, StandingsTable
│   └── player/                 # PlayerForm
├── pages/                      # TournamentListPage, TournamentDetailPage, PlayerListPage
├── lib/utils.ts                # TailwindCSS utilities
└── test/utils.tsx              # Test helpers (custom render with providers)
```

## Pages

- **`/`** — Tournament list with create dialog
- **`/tournaments/:id`** — Tournament detail with tabs:
  - **Registration** — Add/withdraw players, assign divisions, set round participation
  - **Rounds** — View/generate pairings, record results, manual pair/unpair
  - **Standings** — Tournament standings with optional division filter
  - **Settings** — View settings, manage divisions
- **`/players`** — Player database with search, create, edit, delete
