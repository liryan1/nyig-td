# NYIG TD Backend

A TypeScript REST API for managing Go (Baduk/Weiqi) tournament operations including player registration, Swiss/McMahon pairings, and standings calculation.

## Overview

This API serves as the persistence and orchestration layer for Go tournaments. It handles:

- **Player Management**: CRUD operations for tournament players with rank validation
- **Tournament Setup**: Create and configure tournaments with customizable settings
- **Registration**: Player registration with round-by-round participation control
- **Pairings**: Generate Swiss or McMahon pairings via the external pairing-api service
- **Results**: Record game results and automatically track round completion
- **Standings**: Calculate tournament standings with configurable tiebreaker weights

The API delegates tournament logic (pairing algorithms, handicap calculations, standings) to the [pairing-api](../pairing-api) Python service, focusing on data persistence and REST interface.

## Technical Stack

| Component   | Technology                        |
| ----------- | --------------------------------- |
| Runtime     | Node.js 20+                       |
| Language    | TypeScript 5.x (ES2022, NodeNext) |
| Framework   | Express 5                         |
| Database    | MongoDB (via Prisma 6)            |
| Validation  | Zod 4                             |
| HTTP Client | Axios                             |
| Testing     | Jest + Supertest                  |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client App    │────▶│  Tournament API │────▶│   nyig-td-api   │
│  (React, etc.)  │     │   (this repo)   │     │ (pairing logic) │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    MongoDB      │
                        └─────────────────┘
```

### Project Structure

```
src/
├── config/           # Environment configuration
├── types/            # Domain types and enums
├── prisma/           # Prisma client singleton
├── services/         # Business logic
│   ├── nyigTdClient  # External API client
│   ├── playerService # Player CRUD
│   └── tournamentService # Tournament operations
├── routes/           # Express route handlers
├── middleware/       # Error handling
├── utils/            # Validation schemas
├── app.ts            # Express app setup
└── index.ts          # Entry point
```

## API Endpoints

### Players

| Method | Endpoint           | Description                                             |
| ------ | ------------------ | ------------------------------------------------------- |
| GET    | `/api/players`     | List players (supports `?search=`, `?limit=`, `?skip=`) |
| POST   | `/api/players`     | Create player                                           |
| GET    | `/api/players/:id` | Get player by ID                                        |
| PATCH  | `/api/players/:id` | Update player                                           |
| DELETE | `/api/players/:id` | Delete player                                           |

### Tournaments

| Method | Endpoint               | Description                                                 |
| ------ | ---------------------- | ----------------------------------------------------------- |
| GET    | `/api/tournaments`     | List tournaments (supports `?status=`, `?limit=`, `?skip=`) |
| POST   | `/api/tournaments`     | Create tournament                                           |
| GET    | `/api/tournaments/:id` | Get tournament by ID                                        |
| PATCH  | `/api/tournaments/:id` | Update tournament                                           |
| DELETE | `/api/tournaments/:id` | Delete tournament                                           |

### Registrations

| Method | Endpoint                                       | Description                 |
| ------ | ---------------------------------------------- | --------------------------- |
| POST   | `/api/tournaments/:id/registrations`           | Register player             |
| DELETE | `/api/tournaments/:id/registrations/:playerId` | Withdraw player             |
| PATCH  | `/api/tournaments/:id/registrations/:playerId` | Update participation rounds |

### Divisions

| Method | Endpoint                                                | Description                                              |
| ------ | ------------------------------------------------------- | -------------------------------------------------------- |
| POST   | `/api/tournaments/:id/divisions`                        | Add division                                             |
| PATCH  | `/api/tournaments/:id/divisions/:divisionId`            | Update division                                          |
| DELETE | `/api/tournaments/:id/divisions/:divisionId`            | Remove division                                          |
| GET    | `/api/tournaments/:id/divisions/:divisionId/standings`  | Division standings (supports `?throughRound=`)            |

### Rounds & Standings

| Method | Endpoint                                                          | Description                               |
| ------ | ----------------------------------------------------------------- | ----------------------------------------- |
| POST   | `/api/tournaments/:id/rounds/:roundNumber/pair`                   | Generate pairings                         |
| POST   | `/api/tournaments/:id/rounds/:roundNumber/pairings`               | Manual pair (body: player1Id, player2Id)  |
| DELETE | `/api/tournaments/:id/rounds/:roundNumber/pairings/:boardNumber`  | Unpair match                              |
| PATCH  | `/api/tournaments/:id/rounds/:roundNumber/boards/:boardNumber`    | Record result                             |
| GET    | `/api/tournaments/:id/standings`                                  | Get standings (supports `?throughRound=`) |

## Development

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- nyig-td-api running on port 8000

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Copy environment config
cp .env.example .env
```

### Environment Variables

```env
PORT=3000
DATABASE_URL=mongodb://localhost:27017/nyig-tournament
NYIG_TD_API_URL=http://localhost:8000
NODE_ENV=development
```

### Running

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start

# With Docker
docker build -t nyig-tournament-api .
docker run -p 3000:3000 --env-file .env nyig-tournament-api
```

### Testing

202 tests across 7 suites (routes, services, middleware, validation).

```bash
# Run all tests (single run)
npm test -- --watchAll=false

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Code Quality

```bash
# Lint
npm run lint

# Format
npm run format
```

## Data Models

### Player

```typescript
{
  id: string;
  name: string;
  rank: string;       // Format: \d+[kdKD] (e.g., "5k", "3d")
  club?: string;
  agaId?: string;
  rating?: number;
  email?: string;
}
```

### Tournament

```typescript
{
  id: string;
  name: string;
  description?: string;
  date: Date;
  location?: string;
  status: "setup" | "registration" | "in_progress" | "completed";
  settings: {
    numRounds: number;           // 1-10
    pairingAlgorithm: "swiss" | "mcmahon";
    handicapEnabled: boolean;
    handicapReduction: number;   // 0-5
    mcmahonBar?: string;         // e.g., "1d"
    crossDivisionPairing: boolean; // Pair across divisions (default true)
    standingsWeights: {
      wins: number;
      sos: number;
      sodos: number;
      extendedSos: number;
    };
  };
  divisions: Division[];           // { id, name, description? }
  registrations: PlayerRegistration[];
  rounds: Round[];
}
```

### Game Results

- `B+` - Black wins
- `W+` - White wins
- `B+F` - Black wins by forfeit
- `W+F` - White wins by forfeit
- `Draw` - Draw
- `NR` - No result (pending)
- `BL` - Both lose

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Validation error",
  "details": [
    { "path": "rank", "message": "Invalid rank format" }
  ],
  "path": "/api/players"
}
```

| Status | Description                     |
| ------ | ------------------------------- |
| 400    | Validation error, invalid input |
| 404    | Resource not found              |
| 409    | Duplicate entry                 |
| 500    | Internal server error           |

## License

ISC
