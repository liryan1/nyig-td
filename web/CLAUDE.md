# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**web** is a React 19 + Vite frontend for managing Go tournaments. It talks to td-api (or uses an in-memory mock API for offline development).

## Common Commands

```bash
npm install                    # install
npm run dev                    # vite dev server (port 5173)
npm test                       # vitest watch mode
npm run test:run               # vitest single run (102 tests)
npm run build                  # production build (tsc + vite)
npm run lint                   # eslint
```

## Environment Variables

```
VITE_API_URL=http://localhost:3000/api   # API base URL
VITE_USE_MOCK_API=true                   # Use in-memory mock API (no backend needed)
```

## Architecture

### Tech Stack

- React 19 + TypeScript
- Vite 7 (build tool)
- Shadcn/ui + TailwindCSS 4 (UI)
- React Query / TanStack Query (server state)
- React Hook Form + Zod (forms & validation)
- React Router 7 (routing)

### Project Structure

```
src/
├── types/index.ts             # All TypeScript interfaces and enums
├── services/
│   ├── api.ts                 # Real axios-based API client
│   ├── mockApi.ts             # In-memory mock API (200-300ms simulated delay)
│   ├── mockData.ts            # Sample data for mock API
│   └── index.ts               # Exports (switches real/mock via VITE_USE_MOCK_API)
├── components/
│   ├── ui/                    # Shadcn/ui primitives (button, card, dialog, etc.)
│   ├── Layout.tsx             # Navigation bar + route outlet
│   ├── Spinner.tsx            # Loading indicator
│   ├── tournament/
│   │   ├── TournamentForm.tsx # Create tournament form (Zod validation)
│   │   ├── RegistrationTable.tsx # Registered players table with division column
│   │   ├── RoundManager.tsx   # Round tabs, pairings, results, manual pair/unpair
│   │   └── StandingsTable.tsx # Standings display
│   └── player/
│       └── PlayerForm.tsx     # Create/edit player form (Zod validation)
├── pages/
│   ├── TournamentListPage.tsx # Tournament list + create dialog
│   ├── TournamentDetailPage.tsx # Tabs: Registration, Rounds, Standings, Settings
│   └── PlayerListPage.tsx     # Player list + CRUD
├── lib/utils.ts               # TailwindCSS cn() utility
tests/                         # All test files (separate from src)
├── utils.tsx              # Custom render with providers for testing
```

### Key Patterns

- **API layer abstraction**: `services/index.ts` exports the same interface from either `api.ts` or `mockApi.ts` based on the `VITE_USE_MOCK_API` env var.
- **React Query**: All data fetching via `useQuery`/`useMutation` with `queryClient.invalidateQueries` for cache updates.
- **Forms**: React Hook Form + Zod schema validation. Forms are in dedicated components (`TournamentForm`, `PlayerForm`).
- **Division support**: Division CRUD in Settings tab, division assignment during registration, division filter on Standings tab.

### Routes

- `/` — Tournament list
- `/tournaments/:id` — Tournament detail (tabbed: Registration, Rounds, Standings, Settings)
- `/players` — Player list

## Testing

- 102 tests across 7 suites
- Vitest + React Testing Library + jsdom
- `vitest.setup.ts` imports `@testing-library/jest-dom` and polyfills `ResizeObserver` for Radix UI
- Custom `render()` in `tests/utils.tsx` wraps components with QueryClient + BrowserRouter
- Test files are in the `tests/` directory, mirroring the `src/` structure

### Test Coverage

| Suite | Tests | What's covered |
|-------|-------|----------------|
| mockApi.test.ts | 56 | All mock API CRUD, registration, divisions, rounds, standings |
| RoundManager.test.tsx | 12 | Round tabs, pairings, byes, manual pair, generate pairings |
| RegistrationTable.test.tsx | 12 | Players, clubs, rounds, divisions column, withdraw, division dropdown |
| TournamentForm.test.tsx | 8 | Field rendering, validation, defaults, submit |
| PlayerForm.test.tsx | 8 | Field rendering, rank validation, submit, defaults |
| StandingsTable.test.tsx | 4 | Column headers, player data, score formatting |
| Spinner.test.tsx | 2 | Render, size variants |
