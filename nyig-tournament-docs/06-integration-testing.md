# Guide 6: Integration Testing

End-to-end testing guide for the Go Tournament System.

## Overview

This guide covers:
1. API integration tests
2. Complete tournament simulation
3. Manual testing checklist
4. Performance testing

---

## Part 1: API Integration Tests

### Setup Test Environment

Create a `tests/integration` directory in the TypeScript API project.

```bash
cd nyig-tournament-api
mkdir -p tests/integration
```

### Test Configuration (`tests/integration/setup.ts`)

```typescript
import mongoose from 'mongoose';
import { config } from '../../src/config';

export const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI ||
  'mongodb://localhost:27017/nyig-tournament-test';

export async function setupTestDb(): Promise<void> {
  await mongoose.connect(TEST_MONGODB_URI);
}

export async function teardownTestDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
```

### Player API Tests (`tests/integration/players.test.ts`)

```typescript
import request from 'supertest';
import app from '../../src/app';
import { setupTestDb, teardownTestDb, clearCollections } from './setup';

describe('Player API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('POST /api/players', () => {
    it('should create a new player', async () => {
      const response = await request(app)
        .post('/api/players')
        .send({
          name: 'Test Player',
          rank: '5k',
          club: 'Test Club',
        });

      expect(response.status).toBe(201);
      expect(response.body.player).toMatchObject({
        name: 'Test Player',
        rank: '5k',
        club: 'Test Club',
      });
      expect(response.body.player._id).toBeDefined();
    });

    it('should reject invalid rank', async () => {
      const response = await request(app)
        .post('/api/players')
        .send({
          name: 'Test Player',
          rank: 'invalid',
        });

      expect(response.status).toBe(400);
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/players')
        .send({
          rank: '5k',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/players', () => {
    beforeEach(async () => {
      // Create test players
      await request(app).post('/api/players').send({ name: 'Alice', rank: '3d' });
      await request(app).post('/api/players').send({ name: 'Bob', rank: '2d' });
      await request(app).post('/api/players').send({ name: 'Carol', rank: '1d' });
    });

    it('should list all players', async () => {
      const response = await request(app).get('/api/players');

      expect(response.status).toBe(200);
      expect(response.body.players).toHaveLength(3);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/players')
        .query({ limit: 2, skip: 1 });

      expect(response.status).toBe(200);
      expect(response.body.players).toHaveLength(2);
    });
  });

  describe('GET /api/players/:id', () => {
    it('should get a player by ID', async () => {
      const createRes = await request(app)
        .post('/api/players')
        .send({ name: 'Test', rank: '5k' });

      const response = await request(app)
        .get(`/api/players/${createRes.body.player._id}`);

      expect(response.status).toBe(200);
      expect(response.body.player.name).toBe('Test');
    });

    it('should return 404 for non-existent player', async () => {
      const response = await request(app)
        .get('/api/players/000000000000000000000000');

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/players/:id', () => {
    it('should update a player', async () => {
      const createRes = await request(app)
        .post('/api/players')
        .send({ name: 'Test', rank: '5k' });

      const response = await request(app)
        .patch(`/api/players/${createRes.body.player._id}`)
        .send({ rank: '4k' });

      expect(response.status).toBe(200);
      expect(response.body.player.rank).toBe('4k');
    });
  });

  describe('DELETE /api/players/:id', () => {
    it('should delete a player', async () => {
      const createRes = await request(app)
        .post('/api/players')
        .send({ name: 'Test', rank: '5k' });

      const response = await request(app)
        .delete(`/api/players/${createRes.body.player._id}`);

      expect(response.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/players/${createRes.body.player._id}`);
      expect(getRes.status).toBe(404);
    });
  });
});
```

### Tournament API Tests (`tests/integration/tournaments.test.ts`)

```typescript
import request from 'supertest';
import app from '../../src/app';
import { setupTestDb, teardownTestDb, clearCollections } from './setup';

describe('Tournament API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('POST /api/tournaments', () => {
    it('should create a new tournament', async () => {
      const response = await request(app)
        .post('/api/tournaments')
        .send({
          name: 'Test Tournament',
          date: '2024-06-01',
          settings: {
            numRounds: 4,
            pairingAlgorithm: 'mcmahon',
            handicapEnabled: true,
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.tournament).toMatchObject({
        name: 'Test Tournament',
        status: 'setup',
      });
      expect(response.body.tournament.rounds).toHaveLength(4);
    });

    it('should reject invalid number of rounds', async () => {
      const response = await request(app)
        .post('/api/tournaments')
        .send({
          name: 'Test',
          date: '2024-06-01',
          settings: {
            numRounds: 0,
          },
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Tournament Registration', () => {
    let tournamentId: string;
    let playerId: string;

    beforeEach(async () => {
      // Create tournament
      const tournamentRes = await request(app)
        .post('/api/tournaments')
        .send({
          name: 'Test Tournament',
          date: '2024-06-01',
          settings: { numRounds: 4 },
        });
      tournamentId = tournamentRes.body.tournament._id;

      // Create player
      const playerRes = await request(app)
        .post('/api/players')
        .send({ name: 'Test Player', rank: '5k' });
      playerId = playerRes.body.player._id;
    });

    it('should register a player', async () => {
      const response = await request(app)
        .post(`/api/tournaments/${tournamentId}/registrations`)
        .send({ playerId });

      expect(response.status).toBe(200);
      expect(response.body.tournament.registrations).toHaveLength(1);
      expect(response.body.tournament.registrations[0].withdrawn).toBe(false);
    });

    it('should withdraw a player', async () => {
      await request(app)
        .post(`/api/tournaments/${tournamentId}/registrations`)
        .send({ playerId });

      const response = await request(app)
        .delete(`/api/tournaments/${tournamentId}/registrations/${playerId}`);

      expect(response.status).toBe(200);
      expect(response.body.tournament.registrations[0].withdrawn).toBe(true);
    });
  });
});
```

### Pairing Integration Tests (`tests/integration/pairing.test.ts`)

```typescript
import request from 'supertest';
import app from '../../src/app';
import { setupTestDb, teardownTestDb, clearCollections } from './setup';

describe('Pairing API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  async function createTournamentWithPlayers(playerCount: number) {
    // Create tournament
    const tournamentRes = await request(app)
      .post('/api/tournaments')
      .send({
        name: 'Pairing Test',
        date: '2024-06-01',
        settings: {
          numRounds: 4,
          pairingAlgorithm: 'mcmahon',
          mcmahonBar: '3d',
          handicapEnabled: true,
        },
      });
    const tournamentId = tournamentRes.body.tournament._id;

    // Create and register players
    const players = [];
    const ranks = ['4d', '3d', '2d', '1d', '1k', '2k', '3k', '4k', '5k', '6k'];

    for (let i = 0; i < playerCount; i++) {
      const rank = ranks[i % ranks.length];
      const playerRes = await request(app)
        .post('/api/players')
        .send({ name: `Player ${i + 1}`, rank });
      players.push(playerRes.body.player);

      await request(app)
        .post(`/api/tournaments/${tournamentId}/registrations`)
        .send({ playerId: playerRes.body.player._id });
    }

    return { tournamentId, players };
  }

  describe('POST /api/tournaments/:id/rounds/:roundNumber/pair', () => {
    it('should generate pairings for round 1', async () => {
      const { tournamentId } = await createTournamentWithPlayers(8);

      const response = await request(app)
        .post(`/api/tournaments/${tournamentId}/rounds/1/pair`);

      expect(response.status).toBe(200);
      expect(response.body.round.pairings).toHaveLength(4);
      expect(response.body.round.status).toBe('paired');
    });

    it('should handle odd number of players with bye', async () => {
      const { tournamentId } = await createTournamentWithPlayers(7);

      const response = await request(app)
        .post(`/api/tournaments/${tournamentId}/rounds/1/pair`);

      expect(response.status).toBe(200);
      expect(response.body.round.pairings).toHaveLength(3);
      expect(response.body.round.byes).toHaveLength(1);
    });

    it('should fail for already paired round', async () => {
      const { tournamentId } = await createTournamentWithPlayers(4);

      await request(app)
        .post(`/api/tournaments/${tournamentId}/rounds/1/pair`);

      const response = await request(app)
        .post(`/api/tournaments/${tournamentId}/rounds/1/pair`);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('not in pending status');
    });
  });

  describe('Result Recording', () => {
    it('should record game result', async () => {
      const { tournamentId } = await createTournamentWithPlayers(4);

      await request(app)
        .post(`/api/tournaments/${tournamentId}/rounds/1/pair`);

      const response = await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/1/boards/1`)
        .send({ result: 'B+' });

      expect(response.status).toBe(200);
      const round = response.body.tournament.rounds[0];
      expect(round.pairings[0].result).toBe('B+');
    });

    it('should complete round when all results recorded', async () => {
      const { tournamentId } = await createTournamentWithPlayers(4);

      await request(app)
        .post(`/api/tournaments/${tournamentId}/rounds/1/pair`);

      await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/1/boards/1`)
        .send({ result: 'B+' });

      const response = await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/1/boards/2`)
        .send({ result: 'W+' });

      expect(response.status).toBe(200);
      expect(response.body.tournament.rounds[0].status).toBe('completed');
    });
  });
});
```

### Standings Integration Tests (`tests/integration/standings.test.ts`)

```typescript
import request from 'supertest';
import app from '../../src/app';
import { setupTestDb, teardownTestDb, clearCollections } from './setup';

describe('Standings API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  async function setupCompletedRound() {
    // Create tournament
    const tournamentRes = await request(app)
      .post('/api/tournaments')
      .send({
        name: 'Standings Test',
        date: '2024-06-01',
        settings: { numRounds: 4, pairingAlgorithm: 'swiss' },
      });
    const tournamentId = tournamentRes.body.tournament._id;

    // Create players
    const players = [];
    for (const [name, rank] of [['Alice', '3d'], ['Bob', '2d'], ['Carol', '1d'], ['Dave', '1k']]) {
      const res = await request(app)
        .post('/api/players')
        .send({ name, rank });
      players.push(res.body.player);
      await request(app)
        .post(`/api/tournaments/${tournamentId}/registrations`)
        .send({ playerId: res.body.player._id });
    }

    // Generate pairings
    await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds/1/pair`);

    // Record results (board 1: Black wins, board 2: White wins)
    await request(app)
      .patch(`/api/tournaments/${tournamentId}/rounds/1/boards/1`)
      .send({ result: 'B+' });
    await request(app)
      .patch(`/api/tournaments/${tournamentId}/rounds/1/boards/2`)
      .send({ result: 'W+' });

    return { tournamentId, players };
  }

  describe('GET /api/tournaments/:id/standings', () => {
    it('should return standings after completed round', async () => {
      const { tournamentId } = await setupCompletedRound();

      const response = await request(app)
        .get(`/api/tournaments/${tournamentId}/standings`);

      expect(response.status).toBe(200);
      expect(response.body.standings).toHaveLength(4);

      // Check standings structure
      const first = response.body.standings[0];
      expect(first).toHaveProperty('rank');
      expect(first).toHaveProperty('playerName');
      expect(first).toHaveProperty('wins');
      expect(first).toHaveProperty('sos');
      expect(first).toHaveProperty('totalScore');
    });

    it('should return empty standings before any rounds', async () => {
      const tournamentRes = await request(app)
        .post('/api/tournaments')
        .send({
          name: 'Empty',
          date: '2024-06-01',
          settings: { numRounds: 4 },
        });

      const response = await request(app)
        .get(`/api/tournaments/${tournamentRes.body.tournament._id}/standings`);

      expect(response.status).toBe(200);
      expect(response.body.standings).toHaveLength(0);
    });
  });
});
```

---

## Part 2: Complete Tournament Simulation

### Full Tournament Test (`tests/integration/full-tournament.test.ts`)

```typescript
import request from 'supertest';
import app from '../../src/app';
import { setupTestDb, teardownTestDb, clearCollections } from './setup';

describe('Full Tournament Simulation', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it('should complete a 4-round tournament with 20 players', async () => {
    // ========== SETUP ==========

    // Create tournament
    const tournamentRes = await request(app)
      .post('/api/tournaments')
      .send({
        name: 'Full Tournament Test',
        date: '2024-06-01',
        location: 'Test Venue',
        settings: {
          numRounds: 4,
          pairingAlgorithm: 'mcmahon',
          mcmahonBar: '3d',
          handicapEnabled: true,
          handicapReduction: 0,
          standingsWeights: {
            wins: 1.0,
            sos: 0.1,
            sodos: 0.05,
            extendedSos: 0.0,
          },
        },
      });

    expect(tournamentRes.status).toBe(201);
    const tournamentId = tournamentRes.body.tournament._id;

    // Create 20 players with various ranks
    const playerRanks = [
      '5d', '4d', '3d', '3d', '2d',
      '2d', '1d', '1d', '1k', '1k',
      '2k', '2k', '3k', '3k', '4k',
      '5k', '6k', '7k', '8k', '10k',
    ];

    const playerIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const playerRes = await request(app)
        .post('/api/players')
        .send({
          name: `Player ${String(i + 1).padStart(2, '0')}`,
          rank: playerRanks[i],
          club: i < 10 ? 'Club A' : 'Club B',
        });
      playerIds.push(playerRes.body.player._id);
    }

    // Register all players
    for (const playerId of playerIds) {
      const regRes = await request(app)
        .post(`/api/tournaments/${tournamentId}/registrations`)
        .send({ playerId });
      expect(regRes.status).toBe(200);
    }

    // Verify registrations
    const tournamentBefore = await request(app)
      .get(`/api/tournaments/${tournamentId}`);
    expect(tournamentBefore.body.tournament.registrations).toHaveLength(20);

    // ========== ROUND 1 ==========
    console.log('Starting Round 1...');

    const r1PairRes = await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds/1/pair`);

    expect(r1PairRes.status).toBe(200);
    expect(r1PairRes.body.round.pairings).toHaveLength(10);
    expect(r1PairRes.body.round.status).toBe('paired');

    // Record results for round 1 (alternate wins)
    for (let board = 1; board <= 10; board++) {
      const result = board % 2 === 0 ? 'B+' : 'W+';
      await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/1/boards/${board}`)
        .send({ result });
    }

    // Verify round 1 completed
    const afterR1 = await request(app).get(`/api/tournaments/${tournamentId}`);
    expect(afterR1.body.tournament.rounds[0].status).toBe('completed');

    // ========== ROUND 2 ==========
    console.log('Starting Round 2...');

    const r2PairRes = await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds/2/pair`);

    expect(r2PairRes.status).toBe(200);
    expect(r2PairRes.body.round.pairings).toHaveLength(10);

    // Verify no repeat pairings from round 1
    const r1Pairs = new Set(
      afterR1.body.tournament.rounds[0].pairings.map((p: any) =>
        [p.blackPlayerId, p.whitePlayerId].sort().join('-')
      )
    );
    const r2Pairs = r2PairRes.body.round.pairings.map((p: any) =>
      [p.blackPlayerId, p.whitePlayerId].sort().join('-')
    );
    for (const pair of r2Pairs) {
      expect(r1Pairs.has(pair)).toBe(false);
    }

    // Record results for round 2
    for (let board = 1; board <= 10; board++) {
      const result = board % 3 === 0 ? 'B+' : 'W+';
      await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/2/boards/${board}`)
        .send({ result });
    }

    // ========== ROUND 3 ==========
    console.log('Starting Round 3...');

    const r3PairRes = await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds/3/pair`);

    expect(r3PairRes.status).toBe(200);

    for (let board = 1; board <= 10; board++) {
      const result = board <= 5 ? 'B+' : 'W+';
      await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/3/boards/${board}`)
        .send({ result });
    }

    // ========== ROUND 4 ==========
    console.log('Starting Round 4...');

    const r4PairRes = await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds/4/pair`);

    expect(r4PairRes.status).toBe(200);

    for (let board = 1; board <= 10; board++) {
      const result = board % 2 === 0 ? 'W+' : 'B+';
      await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/4/boards/${board}`)
        .send({ result });
    }

    // ========== FINAL STANDINGS ==========
    console.log('Calculating final standings...');

    const standingsRes = await request(app)
      .get(`/api/tournaments/${tournamentId}/standings`);

    expect(standingsRes.status).toBe(200);
    expect(standingsRes.body.standings).toHaveLength(20);

    // Verify standings structure
    const standings = standingsRes.body.standings;
    expect(standings[0].rank).toBe(1);
    expect(standings[0].wins).toBeGreaterThanOrEqual(0);
    expect(standings[0].totalScore).toBeGreaterThan(0);

    // Winner should have most wins
    const maxWins = Math.max(...standings.map((s: any) => s.wins));
    expect(standings[0].wins).toBe(maxWins);

    console.log('Tournament completed successfully!');
    console.log('Top 5 standings:');
    standings.slice(0, 5).forEach((s: any) => {
      console.log(`  ${s.rank}. ${s.playerName} (${s.playerRank}) - ${s.wins}W, Score: ${s.totalScore.toFixed(3)}`);
    });
  }, 60000); // 60 second timeout

  it('should handle player withdrawal mid-tournament', async () => {
    // Create tournament with 6 players
    const tournamentRes = await request(app)
      .post('/api/tournaments')
      .send({
        name: 'Withdrawal Test',
        date: '2024-06-01',
        settings: { numRounds: 3 },
      });
    const tournamentId = tournamentRes.body.tournament._id;

    // Create and register 6 players
    const playerIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const playerRes = await request(app)
        .post('/api/players')
        .send({ name: `Player ${i + 1}`, rank: `${i + 1}k` });
      playerIds.push(playerRes.body.player._id);
      await request(app)
        .post(`/api/tournaments/${tournamentId}/registrations`)
        .send({ playerId: playerRes.body.player._id });
    }

    // Complete round 1
    await request(app).post(`/api/tournaments/${tournamentId}/rounds/1/pair`);
    for (let board = 1; board <= 3; board++) {
      await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/1/boards/${board}`)
        .send({ result: 'B+' });
    }

    // Withdraw one player
    await request(app)
      .delete(`/api/tournaments/${tournamentId}/registrations/${playerIds[0]}`);

    // Round 2 should have 5 players (2 pairings + 1 bye)
    const r2Res = await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds/2/pair`);

    expect(r2Res.body.round.pairings).toHaveLength(2);
    expect(r2Res.body.round.byes).toHaveLength(1);
  });

  it('should handle partial round participation', async () => {
    // Create tournament
    const tournamentRes = await request(app)
      .post('/api/tournaments')
      .send({
        name: 'Partial Participation Test',
        date: '2024-06-01',
        settings: { numRounds: 4 },
      });
    const tournamentId = tournamentRes.body.tournament._id;

    // Create 4 players, one only plays rounds 1 and 2
    const playerIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const playerRes = await request(app)
        .post('/api/players')
        .send({ name: `Player ${i + 1}`, rank: `${i + 1}k` });
      playerIds.push(playerRes.body.player._id);

      const roundsParticipating = i === 0 ? [1, 2] : []; // Player 1 only rounds 1-2
      await request(app)
        .post(`/api/tournaments/${tournamentId}/registrations`)
        .send({ playerId: playerRes.body.player._id, roundsParticipating });
    }

    // Round 1: 4 players, 2 pairings
    const r1Res = await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds/1/pair`);
    expect(r1Res.body.round.pairings).toHaveLength(2);

    // Complete round 1
    for (let board = 1; board <= 2; board++) {
      await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/1/boards/${board}`)
        .send({ result: 'B+' });
    }

    // Round 3: only 3 players (player 1 skips)
    // Need to complete round 2 first
    await request(app).post(`/api/tournaments/${tournamentId}/rounds/2/pair`);
    for (let board = 1; board <= 2; board++) {
      await request(app)
        .patch(`/api/tournaments/${tournamentId}/rounds/2/boards/${board}`)
        .send({ result: 'B+' });
    }

    const r3Res = await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds/3/pair`);

    // 3 players = 1 pairing + 1 bye
    expect(r3Res.body.round.pairings).toHaveLength(1);
    expect(r3Res.body.round.byes).toHaveLength(1);
  });
});
```

---

## Part 3: Running Tests

### Test Script

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:integration": "jest --testPathPattern=integration --runInBand",
    "test:unit": "jest --testPathIgnorePatterns=integration"
  }
}
```

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true,
};
```

### Run Integration Tests

```bash
# Start local MongoDB
docker run -d -p 27017:27017 --name mongodb-test mongo

# Start nyig-td-api (in another terminal)
cd ../nyig-td-api && uv run uvicorn nyig_td_api.main:app --port 8000

# Run tests
npm run test:integration
```

---

## Part 4: Manual Testing Checklist

### Environment Setup

- [ ] MongoDB running (local or Atlas)
- [ ] nyig-td-api running
- [ ] nyig-tournament-api running
- [ ] React app running

### Player Management

- [ ] Create new player with valid rank
- [ ] Create player with invalid rank (should fail)
- [ ] List players
- [ ] Search players by name
- [ ] Edit player rank
- [ ] Delete player

### Tournament Creation

- [ ] Create tournament with McMahon algorithm
- [ ] Create tournament with Swiss algorithm
- [ ] Set McMahon bar
- [ ] Configure handicap settings
- [ ] Set number of rounds (1-10)

### Registration

- [ ] Register player to tournament
- [ ] View registered players
- [ ] Withdraw player
- [ ] Re-register withdrawn player
- [ ] Set partial round participation

### Pairing

- [ ] Generate round 1 pairings
- [ ] Verify handicap calculation
- [ ] Verify color assignment
- [ ] Handle odd number of players (bye)
- [ ] Generate subsequent round pairings
- [ ] Verify no repeat pairings

### Results

- [ ] Record Black win
- [ ] Record White win
- [ ] Record forfeit win
- [ ] Verify round status changes to "in_progress"
- [ ] Verify round status changes to "completed"

### Standings

- [ ] View standings after round 1
- [ ] Verify SOS calculation
- [ ] Verify SODOS calculation
- [ ] Verify ranking order
- [ ] View standings through specific round

### Edge Cases

- [ ] Tournament with 1 player (error)
- [ ] Tournament with 2 players
- [ ] Tournament with 150 players
- [ ] Player withdraws mid-tournament
- [ ] All games are forfeits
- [ ] Draw result (rare)

---

## Part 5: Performance Testing

### Load Test Script (`tests/load/tournament-load.ts`)

```typescript
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function createLargeTournament(playerCount: number) {
  console.log(`Creating tournament with ${playerCount} players...`);
  const start = Date.now();

  // Create tournament
  const tournamentRes = await axios.post(`${API_URL}/tournaments`, {
    name: `Load Test ${playerCount}`,
    date: '2024-06-01',
    settings: { numRounds: 5, pairingAlgorithm: 'mcmahon', mcmahonBar: '3d' },
  });
  const tournamentId = tournamentRes.data.tournament._id;

  // Create players in parallel batches
  const batchSize = 20;
  const playerIds: string[] = [];

  for (let i = 0; i < playerCount; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, playerCount); j++) {
      const rank = `${(j % 30) + 1}k`;
      batch.push(
        axios.post(`${API_URL}/players`, { name: `Player ${j}`, rank })
      );
    }
    const results = await Promise.all(batch);
    playerIds.push(...results.map(r => r.data.player._id));
  }

  console.log(`Created ${playerIds.length} players in ${Date.now() - start}ms`);

  // Register players
  const regStart = Date.now();
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize).map(id =>
      axios.post(`${API_URL}/tournaments/${tournamentId}/registrations`, { playerId: id })
    );
    await Promise.all(batch);
  }
  console.log(`Registered players in ${Date.now() - regStart}ms`);

  // Generate pairings
  const pairStart = Date.now();
  await axios.post(`${API_URL}/tournaments/${tournamentId}/rounds/1/pair`);
  console.log(`Generated pairings in ${Date.now() - pairStart}ms`);

  // Get standings
  const standingsStart = Date.now();
  await axios.get(`${API_URL}/tournaments/${tournamentId}/standings`);
  console.log(`Calculated standings in ${Date.now() - standingsStart}ms`);

  console.log(`Total time: ${Date.now() - start}ms`);
}

async function main() {
  try {
    await createLargeTournament(20);
    await createLargeTournament(50);
    await createLargeTournament(100);
    await createLargeTournament(150);
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
```

### Run Load Test

```bash
npx ts-node tests/load/tournament-load.ts
```

### Expected Performance

| Players | Create + Register | Pairing | Standings |
|---------|-------------------|---------|-----------|
| 20      | < 2s              | < 1s    | < 500ms   |
| 50      | < 5s              | < 2s    | < 1s      |
| 100     | < 10s             | < 3s    | < 2s      |
| 150     | < 15s             | < 5s    | < 3s      |

---

## Part 6: CI Test Pipeline

Add to GitHub Actions workflow:

```yaml
name: Integration Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: nyig-tournament-api/package-lock.json

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install nyig-td-api
        working-directory: nyig-td-api
        run: |
          pip install uv
          uv pip install --system .

      - name: Start nyig-td-api
        working-directory: nyig-td-api
        run: |
          uvicorn nyig_td_api.main:app --port 8000 &
          sleep 5

      - name: Install dependencies
        working-directory: nyig-tournament-api
        run: npm ci

      - name: Run integration tests
        working-directory: nyig-tournament-api
        run: npm run test:integration
        env:
          TEST_MONGODB_URI: mongodb://localhost:27017/nyig-tournament-test
          NYIG_TD_API_URL: http://localhost:8000
```

---

## Success Criteria

### Unit Tests
- [ ] All nyig-td package tests pass (>90% coverage)
- [ ] All nyig-td-api tests pass
- [ ] All TypeScript API tests pass

### Integration Tests
- [ ] Player CRUD operations work end-to-end
- [ ] Tournament lifecycle completes successfully
- [ ] Pairing generation works for all player counts
- [ ] Standings calculation is accurate

### Performance
- [ ] 150-player tournament completes in <30 seconds
- [ ] API response times under 2 seconds

### Manual Testing
- [ ] All checklist items verified
- [ ] UI works on desktop and mobile
- [ ] Error messages are helpful
