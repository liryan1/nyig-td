# Guide 3: TypeScript API with MongoDB

Express-based TypeScript API with MongoDB persistence, calling nyig-td-api for tournament logic.

## Prerequisites

- Node.js 20+
- npm or pnpm
- MongoDB Atlas account (or local MongoDB)
- nyig-td-api deployed (from Guide 2)
- Docker (for containerization)

## Project Setup

### Initialize Project

```bash
mkdir nyig-tournament-api
cd nyig-tournament-api
npm init -y
```

### Install Dependencies

```bash
# Production dependencies
npm install express mongoose dotenv axios zod cors helmet

# Development dependencies
npm install -D typescript @types/node @types/express @types/cors \
  ts-node-dev jest @types/jest ts-jest \
  eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  prettier
```

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Package.json Scripts

```json
{
  "name": "nyig-tournament-api",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  }
}
```

### Directory Structure

```bash
mkdir -p src/{models,routes,services,middleware,types,utils}
touch src/index.ts
touch src/app.ts
touch src/config.ts
touch src/models/index.ts
touch src/routes/index.ts
touch src/services/index.ts
```

---

## Configuration (`src/config.ts`)

```typescript
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nyig-tournament',
  nyigTdApiUrl: process.env.NYIG_TD_API_URL || 'http://localhost:8000',
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
```

---

## MongoDB Models

### Types (`src/types/index.ts`)

```typescript
export type PairingAlgorithm = 'swiss' | 'mcmahon';

export type GameResult = 'B+' | 'W+' | 'B+F' | 'W+F' | 'Draw' | 'NR' | 'BL';

export type TournamentStatus = 'setup' | 'registration' | 'in_progress' | 'completed';

export type RoundStatus = 'pending' | 'paired' | 'in_progress' | 'completed';

export interface StandingsWeights {
  wins: number;
  sos: number;
  sodos: number;
  extendedSos: number;
}

export interface TournamentSettings {
  numRounds: number;
  pairingAlgorithm: PairingAlgorithm;
  standingsWeights: StandingsWeights;
  handicapEnabled: boolean;
  handicapReduction: number;
  mcmahonBar?: string;
}

export interface PlayerRegistration {
  playerId: string;
  roundsParticipating: number[]; // Empty = all rounds
  registeredAt: Date;
  withdrawn: boolean;
}

export interface PairingResult {
  blackPlayerId: string;
  whitePlayerId: string;
  boardNumber: number;
  handicapStones: number;
  komi: number;
  result: GameResult;
}

export interface Bye {
  playerId: string;
  points: number;
}

export interface Round {
  number: number;
  status: RoundStatus;
  pairings: PairingResult[];
  byes: Bye[];
  pairedAt?: Date;
  completedAt?: Date;
}
```

### Player Model (`src/models/Player.ts`)

```typescript
import mongoose, { Document, Schema } from 'mongoose';

export interface IPlayer extends Document {
  name: string;
  rank: string;
  club?: string;
  agaId?: string;
  rating?: number;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const playerSchema = new Schema<IPlayer>(
  {
    name: { type: String, required: true, trim: true },
    rank: {
      type: String,
      required: true,
      match: /^\d+[kdKD]$/,
      lowercase: true,
    },
    club: { type: String, trim: true },
    agaId: { type: String, trim: true },
    rating: { type: Number },
    email: { type: String, trim: true, lowercase: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
playerSchema.index({ name: 'text' });
playerSchema.index({ agaId: 1 }, { sparse: true });

export const Player = mongoose.model<IPlayer>('Player', playerSchema);
```

### Tournament Model (`src/models/Tournament.ts`)

```typescript
import mongoose, { Document, Schema } from 'mongoose';
import type {
  TournamentStatus,
  TournamentSettings,
  PlayerRegistration,
  Round,
  PairingAlgorithm,
  RoundStatus,
  GameResult,
} from '../types/index.js';

export interface ITournament extends Document {
  name: string;
  description?: string;
  date: Date;
  location?: string;
  status: TournamentStatus;
  settings: TournamentSettings;
  registrations: PlayerRegistration[];
  rounds: Round[];
  createdAt: Date;
  updatedAt: Date;
}

const standingsWeightsSchema = new Schema(
  {
    wins: { type: Number, default: 1.0 },
    sos: { type: Number, default: 0.1 },
    sodos: { type: Number, default: 0.05 },
    extendedSos: { type: Number, default: 0.0 },
  },
  { _id: false }
);

const settingsSchema = new Schema(
  {
    numRounds: { type: Number, required: true, min: 1, max: 10 },
    pairingAlgorithm: {
      type: String,
      enum: ['swiss', 'mcmahon'],
      default: 'mcmahon',
    },
    standingsWeights: { type: standingsWeightsSchema, default: () => ({}) },
    handicapEnabled: { type: Boolean, default: true },
    handicapReduction: { type: Number, default: 0, min: 0, max: 5 },
    mcmahonBar: { type: String, match: /^\d+[kdKD]$/ },
  },
  { _id: false }
);

const registrationSchema = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    roundsParticipating: [{ type: Number }],
    registeredAt: { type: Date, default: Date.now },
    withdrawn: { type: Boolean, default: false },
  },
  { _id: false }
);

const pairingSchema = new Schema(
  {
    blackPlayerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    whitePlayerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    boardNumber: { type: Number, required: true },
    handicapStones: { type: Number, default: 0 },
    komi: { type: Number, default: 7.5 },
    result: {
      type: String,
      enum: ['B+', 'W+', 'B+F', 'W+F', 'Draw', 'NR', 'BL'],
      default: 'NR',
    },
  },
  { _id: false }
);

const byeSchema = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    points: { type: Number, default: 1.0 },
  },
  { _id: false }
);

const roundSchema = new Schema(
  {
    number: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'paired', 'in_progress', 'completed'],
      default: 'pending',
    },
    pairings: [pairingSchema],
    byes: [byeSchema],
    pairedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false }
);

const tournamentSchema = new Schema<ITournament>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    date: { type: Date, required: true },
    location: { type: String, trim: true },
    status: {
      type: String,
      enum: ['setup', 'registration', 'in_progress', 'completed'],
      default: 'setup',
    },
    settings: { type: settingsSchema, required: true },
    registrations: [registrationSchema],
    rounds: [roundSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes
tournamentSchema.index({ date: -1 });
tournamentSchema.index({ status: 1 });

// Initialize rounds on save
tournamentSchema.pre('save', function (next) {
  if (this.isNew && this.rounds.length === 0) {
    for (let i = 1; i <= this.settings.numRounds; i++) {
      this.rounds.push({
        number: i,
        status: 'pending',
        pairings: [],
        byes: [],
      });
    }
  }
  next();
});

export const Tournament = mongoose.model<ITournament>('Tournament', tournamentSchema);
```

### Models Index (`src/models/index.ts`)

```typescript
export { Player, type IPlayer } from './Player.js';
export { Tournament, type ITournament } from './Tournament.js';
```

---

## Services

### nyig-td-api Client (`src/services/nyigTdClient.ts`)

```typescript
import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';
import type { PairingAlgorithm, StandingsWeights, GameResult } from '../types/index.js';

// Request/Response types matching nyig-td-api
interface PlayerInput {
  id: string;
  name: string;
  rank: string;
  club?: string;
  aga_id?: string;
  rating?: number;
  rounds_participating?: number[];
  initial_mcmahon_score?: number;
}

interface PairingInput {
  black_player_id: string;
  white_player_id: string;
  result: string;
}

interface ByeInput {
  player_id: string;
  points: number;
}

interface RoundInput {
  number: number;
  pairings: PairingInput[];
  byes: ByeInput[];
}

interface PairingRequest {
  players: PlayerInput[];
  previous_rounds: RoundInput[];
  round_number: number;
  algorithm: string;
  mcmahon_bar?: string;
  handicap_enabled: boolean;
  handicap_reduction: number;
}

interface PairingOutput {
  black_player_id: string;
  white_player_id: string;
  board_number: number;
  handicap_stones: number;
  komi: number;
}

interface ByeOutput {
  player_id: string;
  points: number;
}

interface PairingResponse {
  pairings: PairingOutput[];
  byes: ByeOutput[];
  warnings: string[];
}

interface StandingsWeightsInput {
  wins: number;
  sos: number;
  sodos: number;
  extended_sos: number;
}

interface StandingsRequest {
  players: PlayerInput[];
  rounds: RoundInput[];
  weights: StandingsWeightsInput;
  through_round?: number;
}

interface PlayerStandingOutput {
  rank: number;
  player_id: string;
  player_name: string;
  player_rank: string;
  wins: number;
  losses: number;
  sos: number;
  sodos: number;
  extended_sos: number;
  total_score: number;
}

interface StandingsResponse {
  standings: PlayerStandingOutput[];
}

interface HandicapResponse {
  stones: number;
  komi: number;
  description: string;
}

export class NyigTdClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = config.nyigTdApiUrl) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async generatePairings(request: PairingRequest): Promise<PairingResponse> {
    const response = await this.client.post<PairingResponse>('/pair', request);
    return response.data;
  }

  async calculateStandings(request: StandingsRequest): Promise<StandingsResponse> {
    const response = await this.client.post<StandingsResponse>('/standings', request);
    return response.data;
  }

  async calculateHandicap(
    whiteRank: string,
    blackRank: string,
    reduction: number = 0
  ): Promise<HandicapResponse> {
    const response = await this.client.post<HandicapResponse>('/handicap', {
      white_rank: whiteRank,
      black_rank: blackRank,
      reduction,
    });
    return response.data;
  }

  async validateRanks(ranks: string[]): Promise<{ results: Array<{ rank: string; valid: boolean; normalized?: string; error?: string }>; all_valid: boolean }> {
    const response = await this.client.post('/validate/ranks', { ranks });
    return response.data;
  }
}

export const nyigTdClient = new NyigTdClient();
```

### Tournament Service (`src/services/tournamentService.ts`)

```typescript
import { Tournament, type ITournament } from '../models/index.js';
import { Player, type IPlayer } from '../models/index.js';
import { nyigTdClient } from './nyigTdClient.js';
import type { TournamentSettings, Round, GameResult } from '../types/index.js';

export class TournamentService {
  async createTournament(data: {
    name: string;
    description?: string;
    date: Date;
    location?: string;
    settings: TournamentSettings;
  }): Promise<ITournament> {
    const tournament = new Tournament(data);
    return tournament.save();
  }

  async getTournament(id: string): Promise<ITournament | null> {
    return Tournament.findById(id).exec();
  }

  async listTournaments(filters: {
    status?: string;
    limit?: number;
    skip?: number;
  } = {}): Promise<ITournament[]> {
    const query = Tournament.find();

    if (filters.status) {
      query.where('status', filters.status);
    }

    query.sort({ date: -1 });

    if (filters.skip) query.skip(filters.skip);
    if (filters.limit) query.limit(filters.limit);

    return query.exec();
  }

  async updateTournament(
    id: string,
    updates: Partial<Pick<ITournament, 'name' | 'description' | 'date' | 'location' | 'status' | 'settings'>>
  ): Promise<ITournament | null> {
    return Tournament.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async deleteTournament(id: string): Promise<boolean> {
    const result = await Tournament.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async registerPlayer(
    tournamentId: string,
    playerId: string,
    roundsParticipating: number[] = []
  ): Promise<ITournament | null> {
    const tournament = await Tournament.findById(tournamentId).exec();
    if (!tournament) return null;

    // Check if already registered
    const existing = tournament.registrations.find(
      (r) => r.playerId.toString() === playerId
    );
    if (existing) {
      existing.withdrawn = false;
      existing.roundsParticipating = roundsParticipating;
    } else {
      tournament.registrations.push({
        playerId,
        roundsParticipating,
        registeredAt: new Date(),
        withdrawn: false,
      });
    }

    return tournament.save();
  }

  async withdrawPlayer(tournamentId: string, playerId: string): Promise<ITournament | null> {
    const tournament = await Tournament.findById(tournamentId).exec();
    if (!tournament) return null;

    const registration = tournament.registrations.find(
      (r) => r.playerId.toString() === playerId
    );
    if (registration) {
      registration.withdrawn = true;
    }

    return tournament.save();
  }

  async updatePlayerRounds(
    tournamentId: string,
    playerId: string,
    roundsParticipating: number[]
  ): Promise<ITournament | null> {
    const tournament = await Tournament.findById(tournamentId).exec();
    if (!tournament) return null;

    const registration = tournament.registrations.find(
      (r) => r.playerId.toString() === playerId
    );
    if (registration) {
      registration.roundsParticipating = roundsParticipating;
    }

    return tournament.save();
  }

  async generatePairings(tournamentId: string, roundNumber: number): Promise<Round> {
    const tournament = await Tournament.findById(tournamentId)
      .populate('registrations.playerId')
      .exec();

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const round = tournament.rounds.find((r) => r.number === roundNumber);
    if (!round) {
      throw new Error(`Round ${roundNumber} not found`);
    }

    if (round.status !== 'pending') {
      throw new Error(`Round ${roundNumber} is not in pending status`);
    }

    // Get active players for this round
    const activePlayers: IPlayer[] = [];
    for (const reg of tournament.registrations) {
      if (reg.withdrawn) continue;

      const participates =
        reg.roundsParticipating.length === 0 ||
        reg.roundsParticipating.includes(roundNumber);

      if (participates && reg.playerId) {
        activePlayers.push(reg.playerId as unknown as IPlayer);
      }
    }

    // Build previous rounds data
    const previousRounds = tournament.rounds
      .filter((r) => r.number < roundNumber && r.status === 'completed')
      .map((r) => ({
        number: r.number,
        pairings: r.pairings.map((p) => ({
          black_player_id: p.blackPlayerId.toString(),
          white_player_id: p.whitePlayerId.toString(),
          result: p.result,
        })),
        byes: r.byes.map((b) => ({
          player_id: b.playerId.toString(),
          points: b.points,
        })),
      }));

    // Call nyig-td-api
    const response = await nyigTdClient.generatePairings({
      players: activePlayers.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        rank: p.rank,
        club: p.club,
        aga_id: p.agaId,
        rating: p.rating,
      })),
      previous_rounds: previousRounds,
      round_number: roundNumber,
      algorithm: tournament.settings.pairingAlgorithm,
      mcmahon_bar: tournament.settings.mcmahonBar,
      handicap_enabled: tournament.settings.handicapEnabled,
      handicap_reduction: tournament.settings.handicapReduction,
    });

    // Update round with pairings
    round.pairings = response.pairings.map((p) => ({
      blackPlayerId: p.black_player_id,
      whitePlayerId: p.white_player_id,
      boardNumber: p.board_number,
      handicapStones: p.handicap_stones,
      komi: p.komi,
      result: 'NR' as GameResult,
    }));

    round.byes = response.byes.map((b) => ({
      playerId: b.player_id,
      points: b.points,
    }));

    round.status = 'paired';
    round.pairedAt = new Date();

    await tournament.save();

    return round;
  }

  async recordResult(
    tournamentId: string,
    roundNumber: number,
    boardNumber: number,
    result: GameResult
  ): Promise<ITournament | null> {
    const tournament = await Tournament.findById(tournamentId).exec();
    if (!tournament) return null;

    const round = tournament.rounds.find((r) => r.number === roundNumber);
    if (!round) return null;

    const pairing = round.pairings.find((p) => p.boardNumber === boardNumber);
    if (!pairing) return null;

    pairing.result = result;

    // Check if all games completed
    const allCompleted = round.pairings.every((p) => p.result !== 'NR');
    if (allCompleted) {
      round.status = 'completed';
      round.completedAt = new Date();
    } else {
      round.status = 'in_progress';
    }

    return tournament.save();
  }

  async getStandings(
    tournamentId: string,
    throughRound?: number
  ): Promise<Array<{
    rank: number;
    playerId: string;
    playerName: string;
    playerRank: string;
    wins: number;
    losses: number;
    sos: number;
    sodos: number;
    extendedSos: number;
    totalScore: number;
  }>> {
    const tournament = await Tournament.findById(tournamentId)
      .populate('registrations.playerId')
      .exec();

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Get all players
    const players: IPlayer[] = tournament.registrations
      .filter((r) => !r.withdrawn && r.playerId)
      .map((r) => r.playerId as unknown as IPlayer);

    // Build rounds data
    const completedRounds = tournament.rounds
      .filter((r) => r.status === 'completed')
      .filter((r) => !throughRound || r.number <= throughRound)
      .map((r) => ({
        number: r.number,
        pairings: r.pairings.map((p) => ({
          black_player_id: p.blackPlayerId.toString(),
          white_player_id: p.whitePlayerId.toString(),
          result: p.result,
        })),
        byes: r.byes.map((b) => ({
          player_id: b.playerId.toString(),
          points: b.points,
        })),
      }));

    const response = await nyigTdClient.calculateStandings({
      players: players.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        rank: p.rank,
      })),
      rounds: completedRounds,
      weights: {
        wins: tournament.settings.standingsWeights.wins,
        sos: tournament.settings.standingsWeights.sos,
        sodos: tournament.settings.standingsWeights.sodos,
        extended_sos: tournament.settings.standingsWeights.extendedSos,
      },
      through_round: throughRound,
    });

    return response.standings.map((s) => ({
      rank: s.rank,
      playerId: s.player_id,
      playerName: s.player_name,
      playerRank: s.player_rank,
      wins: s.wins,
      losses: s.losses,
      sos: s.sos,
      sodos: s.sodos,
      extendedSos: s.extended_sos,
      totalScore: s.total_score,
    }));
  }
}

export const tournamentService = new TournamentService();
```

### Player Service (`src/services/playerService.ts`)

```typescript
import { Player, type IPlayer } from '../models/index.js';
import { nyigTdClient } from './nyigTdClient.js';

export class PlayerService {
  async createPlayer(data: {
    name: string;
    rank: string;
    club?: string;
    agaId?: string;
    rating?: number;
    email?: string;
  }): Promise<IPlayer> {
    // Validate rank
    const validation = await nyigTdClient.validateRanks([data.rank]);
    if (!validation.all_valid) {
      throw new Error(`Invalid rank: ${data.rank}`);
    }

    // Normalize rank
    data.rank = validation.results[0].normalized || data.rank;

    const player = new Player(data);
    return player.save();
  }

  async getPlayer(id: string): Promise<IPlayer | null> {
    return Player.findById(id).exec();
  }

  async listPlayers(filters: {
    search?: string;
    limit?: number;
    skip?: number;
  } = {}): Promise<IPlayer[]> {
    const query = Player.find();

    if (filters.search) {
      query.where({ $text: { $search: filters.search } });
    }

    query.sort({ name: 1 });

    if (filters.skip) query.skip(filters.skip);
    if (filters.limit) query.limit(filters.limit);

    return query.exec();
  }

  async updatePlayer(
    id: string,
    updates: Partial<Pick<IPlayer, 'name' | 'rank' | 'club' | 'agaId' | 'rating' | 'email'>>
  ): Promise<IPlayer | null> {
    if (updates.rank) {
      const validation = await nyigTdClient.validateRanks([updates.rank]);
      if (!validation.all_valid) {
        throw new Error(`Invalid rank: ${updates.rank}`);
      }
      updates.rank = validation.results[0].normalized || updates.rank;
    }

    return Player.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async deletePlayer(id: string): Promise<boolean> {
    const result = await Player.findByIdAndDelete(id).exec();
    return result !== null;
  }
}

export const playerService = new PlayerService();
```

### Services Index (`src/services/index.ts`)

```typescript
export { tournamentService, TournamentService } from './tournamentService.js';
export { playerService, PlayerService } from './playerService.js';
export { nyigTdClient, NyigTdClient } from './nyigTdClient.js';
```

---

## API Routes

### Validation Schemas (`src/utils/validation.ts`)

```typescript
import { z } from 'zod';

export const rankSchema = z.string().regex(/^\d+[kdKD]$/, 'Invalid rank format');

export const createPlayerSchema = z.object({
  name: z.string().min(1).max(100),
  rank: rankSchema,
  club: z.string().max(100).optional(),
  agaId: z.string().max(20).optional(),
  rating: z.number().optional(),
  email: z.string().email().optional(),
});

export const updatePlayerSchema = createPlayerSchema.partial();

export const standingsWeightsSchema = z.object({
  wins: z.number().min(0).default(1.0),
  sos: z.number().min(0).default(0.1),
  sodos: z.number().min(0).default(0.05),
  extendedSos: z.number().min(0).default(0.0),
});

export const tournamentSettingsSchema = z.object({
  numRounds: z.number().int().min(1).max(10),
  pairingAlgorithm: z.enum(['swiss', 'mcmahon']).default('mcmahon'),
  standingsWeights: standingsWeightsSchema.optional(),
  handicapEnabled: z.boolean().default(true),
  handicapReduction: z.number().int().min(0).max(5).default(0),
  mcmahonBar: rankSchema.optional(),
});

export const createTournamentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  date: z.string().transform((s) => new Date(s)),
  location: z.string().max(200).optional(),
  settings: tournamentSettingsSchema,
});

export const updateTournamentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  date: z.string().transform((s) => new Date(s)).optional(),
  location: z.string().max(200).optional(),
  status: z.enum(['setup', 'registration', 'in_progress', 'completed']).optional(),
  settings: tournamentSettingsSchema.partial().optional(),
});

export const registerPlayerSchema = z.object({
  playerId: z.string(),
  roundsParticipating: z.array(z.number().int().positive()).optional(),
});

export const recordResultSchema = z.object({
  result: z.enum(['B+', 'W+', 'B+F', 'W+F', 'Draw', 'NR', 'BL']),
});
```

### Player Routes (`src/routes/players.ts`)

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { playerService } from '../services/index.js';
import { createPlayerSchema, updatePlayerSchema } from '../utils/validation.js';

const router = Router();

// List players
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, limit = '50', skip = '0' } = req.query;
    const players = await playerService.listPlayers({
      search: search as string | undefined,
      limit: parseInt(limit as string, 10),
      skip: parseInt(skip as string, 10),
    });
    res.json({ players });
  } catch (error) {
    next(error);
  }
});

// Create player
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createPlayerSchema.parse(req.body);
    const player = await playerService.createPlayer(data);
    res.status(201).json({ player });
  } catch (error) {
    next(error);
  }
});

// Get player
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const player = await playerService.getPlayer(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ player });
  } catch (error) {
    next(error);
  }
});

// Update player
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updatePlayerSchema.parse(req.body);
    const player = await playerService.updatePlayer(req.params.id, data);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ player });
  } catch (error) {
    next(error);
  }
});

// Delete player
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await playerService.deletePlayer(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
```

### Tournament Routes (`src/routes/tournaments.ts`)

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { tournamentService } from '../services/index.js';
import {
  createTournamentSchema,
  updateTournamentSchema,
  registerPlayerSchema,
  recordResultSchema,
} from '../utils/validation.js';

const router = Router();

// List tournaments
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit = '50', skip = '0' } = req.query;
    const tournaments = await tournamentService.listTournaments({
      status: status as string | undefined,
      limit: parseInt(limit as string, 10),
      skip: parseInt(skip as string, 10),
    });
    res.json({ tournaments });
  } catch (error) {
    next(error);
  }
});

// Create tournament
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createTournamentSchema.parse(req.body);
    const tournament = await tournamentService.createTournament(data);
    res.status(201).json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Get tournament
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tournament = await tournamentService.getTournament(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Update tournament
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateTournamentSchema.parse(req.body);
    const tournament = await tournamentService.updateTournament(req.params.id, data);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Delete tournament
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await tournamentService.deleteTournament(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ====== Registration ======

// Register player
router.post('/:id/registrations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerPlayerSchema.parse(req.body);
    const tournament = await tournamentService.registerPlayer(
      req.params.id,
      data.playerId,
      data.roundsParticipating
    );
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Withdraw player
router.delete('/:id/registrations/:playerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tournament = await tournamentService.withdrawPlayer(
      req.params.id,
      req.params.playerId
    );
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Update player rounds
router.patch('/:id/registrations/:playerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roundsParticipating } = req.body;
    const tournament = await tournamentService.updatePlayerRounds(
      req.params.id,
      req.params.playerId,
      roundsParticipating || []
    );
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// ====== Rounds ======

// Generate pairings
router.post('/:id/rounds/:roundNumber/pair', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roundNumber = parseInt(req.params.roundNumber, 10);
    const round = await tournamentService.generatePairings(req.params.id, roundNumber);
    res.json({ round });
  } catch (error) {
    next(error);
  }
});

// Record result
router.patch('/:id/rounds/:roundNumber/boards/:boardNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roundNumber = parseInt(req.params.roundNumber, 10);
    const boardNumber = parseInt(req.params.boardNumber, 10);
    const { result } = recordResultSchema.parse(req.body);

    const tournament = await tournamentService.recordResult(
      req.params.id,
      roundNumber,
      boardNumber,
      result
    );
    if (!tournament) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Get standings
router.get('/:id/standings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const throughRound = req.query.throughRound
      ? parseInt(req.query.throughRound as string, 10)
      : undefined;
    const standings = await tournamentService.getStandings(req.params.id, throughRound);
    res.json({ standings });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### Routes Index (`src/routes/index.ts`)

```typescript
import { Router } from 'express';
import playersRouter from './players.js';
import tournamentsRouter from './tournaments.js';

const router = Router();

router.use('/players', playersRouter);
router.use('/tournaments', tournamentsRouter);

export default router;
```

---

## Error Handling Middleware (`src/middleware/errorHandler.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AxiosError } from 'axios';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    });
    return;
  }

  if (err instanceof AxiosError) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.detail || err.message;
    res.status(status).json({
      error: 'External service error',
      message,
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({ error: 'Invalid ID format' });
    return;
  }

  if (err.message.includes('not found')) {
    res.status(404).json({ error: err.message });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}
```

---

## Application Setup (`src/app.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

export default app;
```

---

## Entry Point (`src/index.ts`)

```typescript
import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config.js';

async function main() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    // Start server
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Health: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
```

---

## Environment Variables (`.env.example`)

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/nyig-tournament
NYIG_TD_API_URL=http://localhost:8000
NODE_ENV=development
```

---

## Dockerfile

```dockerfile
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build
RUN npm run build

# Run
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## MongoDB Atlas Setup

### Create Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster (M0)
3. Create a database user
4. Add IP address to whitelist (0.0.0.0/0 for Cloud Run)
5. Get connection string

### Connection String Format

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/nyig-tournament?retryWrites=true&w=majority
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start MongoDB locally (or use Atlas)
# docker run -d -p 27017:27017 mongo

# Start nyig-td-api (from Guide 2)
# cd ../nyig-td-api && uv run uvicorn nyig_td_api.main:app --port 8000

# Start development server
npm run dev
```

---

## API Endpoints Summary

### Players
- `GET /api/players` - List players
- `POST /api/players` - Create player
- `GET /api/players/:id` - Get player
- `PATCH /api/players/:id` - Update player
- `DELETE /api/players/:id` - Delete player

### Tournaments
- `GET /api/tournaments` - List tournaments
- `POST /api/tournaments` - Create tournament
- `GET /api/tournaments/:id` - Get tournament
- `PATCH /api/tournaments/:id` - Update tournament
- `DELETE /api/tournaments/:id` - Delete tournament

### Registrations
- `POST /api/tournaments/:id/registrations` - Register player
- `DELETE /api/tournaments/:id/registrations/:playerId` - Withdraw player
- `PATCH /api/tournaments/:id/registrations/:playerId` - Update rounds

### Rounds
- `POST /api/tournaments/:id/rounds/:roundNumber/pair` - Generate pairings
- `PATCH /api/tournaments/:id/rounds/:roundNumber/boards/:boardNumber` - Record result
- `GET /api/tournaments/:id/standings` - Get standings

---

## Success Criteria

1. All CRUD operations work for players and tournaments
2. Pairing generation calls nyig-td-api correctly
3. Results can be recorded and standings update
4. MongoDB persists all data correctly
5. Error handling returns appropriate status codes
6. Docker container runs successfully
7. Connects to MongoDB Atlas in production
