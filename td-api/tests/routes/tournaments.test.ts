import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import tournamentsRouter from '../../src/routes/tournaments.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = jest.Mock<any>;

// Mock the tournament service
const mockList: MockFn = jest.fn();
const mockCreate: MockFn = jest.fn();
const mockGet: MockFn = jest.fn();
const mockUpdate: MockFn = jest.fn();
const mockDelete: MockFn = jest.fn();
const mockRegisterPlayer: MockFn = jest.fn();
const mockWithdrawPlayer: MockFn = jest.fn();
const mockUpdateRegistration: MockFn = jest.fn();
const mockGeneratePairings: MockFn = jest.fn();
const mockRecordResult: MockFn = jest.fn();
const mockGetStandings: MockFn = jest.fn();
const mockAddDivision: MockFn = jest.fn();
const mockUpdateDivision: MockFn = jest.fn();
const mockRemoveDivision: MockFn = jest.fn();

jest.mock('../../src/services/index.js', () => ({
  tournamentService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    get: (...args: unknown[]) => mockGet(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    registerPlayer: (...args: unknown[]) => mockRegisterPlayer(...args),
    withdrawPlayer: (...args: unknown[]) => mockWithdrawPlayer(...args),
    updateRegistration: (...args: unknown[]) => mockUpdateRegistration(...args),
    generatePairings: (...args: unknown[]) => mockGeneratePairings(...args),
    recordResult: (...args: unknown[]) => mockRecordResult(...args),
    getStandings: (...args: unknown[]) => mockGetStandings(...args),
    addDivision: (...args: unknown[]) => mockAddDivision(...args),
    updateDivision: (...args: unknown[]) => mockUpdateDivision(...args),
    removeDivision: (...args: unknown[]) => mockRemoveDivision(...args),
  },
}));

// Helper to create tournament data
function createTournamentData(overrides = {}) {
  return {
    id: '507f1f77bcf86cd799439011',
    name: 'Spring Tournament',
    date: new Date('2026-04-15'),
    status: 'setup',
    settings: {
      numRounds: 4,
      pairingAlgorithm: 'mcmahon',
      standingsWeights: { wins: 1, sos: 0.1, sodos: 0.05, extendedSos: 0 },
      handicapEnabled: true,
      handicapReduction: 0,
      crossDivisionPairing: true,
    },
    divisions: [],
    registrations: [],
    rounds: [],
    ...overrides,
  };
}

describe('Tournament Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/tournaments', tournamentsRouter);
    app.use(errorHandler);
  });

  // ==================== List Tournaments ====================

  describe('GET /api/tournaments', () => {
    it('should return list of tournaments', async () => {
      const tournaments = [createTournamentData()];
      mockList.mockResolvedValue(tournaments);

      const response = await request(app).get('/api/tournaments');

      expect(response.status).toBe(200);
      expect(response.body.tournaments).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockList.mockResolvedValue([]);

      await request(app).get('/api/tournaments?status=in_progress');

      expect(mockList).toHaveBeenCalledWith({
        status: 'in_progress',
        limit: 50,
        skip: 0,
      });
    });

    it('should apply pagination', async () => {
      mockList.mockResolvedValue([]);

      await request(app).get('/api/tournaments?limit=10&skip=20');

      expect(mockList).toHaveBeenCalledWith({
        status: undefined,
        limit: 10,
        skip: 20,
      });
    });

    it('should handle service errors', async () => {
      mockList.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/tournaments');

      expect(response.status).toBe(500);
    });
  });

  // ==================== Create Tournament ====================

  describe('POST /api/tournaments', () => {
    it('should create a tournament', async () => {
      const tournament = createTournamentData();
      mockCreate.mockResolvedValue(tournament);

      const response = await request(app).post('/api/tournaments').send({
        name: 'Spring Tournament',
        date: '2026-04-15',
        settings: { numRounds: 4 },
      });

      expect(response.status).toBe(201);
      expect(response.body.tournament.name).toBe('Spring Tournament');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app).post('/api/tournaments').send({ name: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 for invalid numRounds', async () => {
      const response = await request(app).post('/api/tournaments').send({
        name: 'Test',
        date: '2026-04-15',
        settings: { numRounds: 0 },
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for numRounds > 10', async () => {
      const response = await request(app).post('/api/tournaments').send({
        name: 'Test',
        date: '2026-04-15',
        settings: { numRounds: 15 },
      });

      expect(response.status).toBe(400);
    });

    it('should handle service errors', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/api/tournaments').send({
        name: 'Test',
        date: '2026-04-15',
        settings: { numRounds: 4 },
      });

      expect(response.status).toBe(500);
    });
  });

  // ==================== Get Tournament ====================

  describe('GET /api/tournaments/:id', () => {
    it('should return tournament by id', async () => {
      const tournament = createTournamentData();
      mockGet.mockResolvedValue(tournament);

      const response = await request(app).get('/api/tournaments/507f1f77bcf86cd799439011');

      expect(response.status).toBe(200);
      expect(response.body.tournament.name).toBe('Spring Tournament');
    });

    it('should return 404 for non-existent tournament', async () => {
      mockGet.mockResolvedValue(null);

      const response = await request(app).get('/api/tournaments/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Tournament not found');
    });

    it('should handle service errors', async () => {
      mockGet.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/tournaments/507f1f77bcf86cd799439011');

      expect(response.status).toBe(500);
    });
  });

  // ==================== Update Tournament ====================

  describe('PATCH /api/tournaments/:id', () => {
    it('should update tournament name', async () => {
      const tournament = createTournamentData({ name: 'Updated Name' });
      mockUpdate.mockResolvedValue(tournament);

      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.tournament.name).toBe('Updated Name');
    });

    it('should update tournament status', async () => {
      const tournament = createTournamentData({ status: 'in_progress' });
      mockUpdate.mockResolvedValue(tournament);

      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011')
        .send({ status: 'in_progress' });

      expect(response.status).toBe(200);
      expect(response.body.tournament.status).toBe('in_progress');
    });

    it('should return 404 for non-existent tournament', async () => {
      mockUpdate.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/tournaments/nonexistent')
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011')
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
    });
  });

  // ==================== Delete Tournament ====================

  describe('DELETE /api/tournaments/:id', () => {
    it('should delete tournament', async () => {
      mockDelete.mockResolvedValue(true);

      const response = await request(app).delete('/api/tournaments/507f1f77bcf86cd799439011');

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent tournament', async () => {
      mockDelete.mockResolvedValue(false);

      const response = await request(app).delete('/api/tournaments/nonexistent');

      expect(response.status).toBe(404);
    });

    it('should handle service errors', async () => {
      mockDelete.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/tournaments/507f1f77bcf86cd799439011');

      expect(response.status).toBe(500);
    });
  });

  // ==================== Registration ====================

  describe('POST /api/tournaments/:id/registrations', () => {
    it('should register a player', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockRegisterPlayer.mockResolvedValue(tournament);

      const response = await request(app)
        .post('/api/tournaments/507f1f77bcf86cd799439011/registrations')
        .send({ playerId: 'player1' });

      expect(response.status).toBe(200);
      expect(response.body.tournament.registrations).toHaveLength(1);
    });

    it('should register player with specific rounds', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [1, 2, 3], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockRegisterPlayer.mockResolvedValue(tournament);

      const response = await request(app)
        .post('/api/tournaments/507f1f77bcf86cd799439011/registrations')
        .send({ playerId: 'player1', roundsParticipating: [1, 2, 3] });

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent tournament', async () => {
      mockRegisterPlayer.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/tournaments/nonexistent/registrations')
        .send({ playerId: 'player1' });

      expect(response.status).toBe(404);
    });

    it('should return 400 for missing playerId', async () => {
      const response = await request(app)
        .post('/api/tournaments/507f1f77bcf86cd799439011/registrations')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/tournaments/:id/registrations/:playerId', () => {
    it('should withdraw a player', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [], registeredAt: new Date(), withdrawn: true },
        ],
      });
      mockWithdrawPlayer.mockResolvedValue(tournament);

      const response = await request(app).delete(
        '/api/tournaments/507f1f77bcf86cd799439011/registrations/player1'
      );

      expect(response.status).toBe(200);
      expect(response.body.tournament.registrations[0].withdrawn).toBe(true);
    });

    it('should return 404 for non-existent tournament', async () => {
      mockWithdrawPlayer.mockResolvedValue(null);

      const response = await request(app).delete(
        '/api/tournaments/nonexistent/registrations/player1'
      );

      expect(response.status).toBe(404);
    });

    it('should handle service errors', async () => {
      mockWithdrawPlayer.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete(
        '/api/tournaments/507f1f77bcf86cd799439011/registrations/player1'
      );

      expect(response.status).toBe(500);
    });
  });

  describe('PATCH /api/tournaments/:id/registrations/:playerId', () => {
    it('should update player rounds', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [1, 3], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockUpdateRegistration.mockResolvedValue(tournament);

      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011/registrations/player1')
        .send({ roundsParticipating: [1, 3] });

      expect(response.status).toBe(200);
    });

    it('should update division assignment', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', divisionId: 'div1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockUpdateRegistration.mockResolvedValue(tournament);

      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011/registrations/player1')
        .send({ divisionId: 'div1' });

      expect(response.status).toBe(200);
      expect(mockUpdateRegistration).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'player1',
        expect.objectContaining({ divisionId: 'div1' })
      );
    });

    it('should remove division assignment with null', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockUpdateRegistration.mockResolvedValue(tournament);

      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011/registrations/player1')
        .send({ divisionId: null });

      expect(response.status).toBe(200);
      expect(mockUpdateRegistration).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'player1',
        expect.objectContaining({ divisionId: null })
      );
    });

    it('should return 404 for non-existent tournament', async () => {
      mockUpdateRegistration.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/tournaments/nonexistent/registrations/player1')
        .send({ roundsParticipating: [1, 2] });

      expect(response.status).toBe(404);
    });

    it('should handle service errors', async () => {
      mockUpdateRegistration.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011/registrations/player1')
        .send({ roundsParticipating: [1, 2] });

      expect(response.status).toBe(500);
    });
  });

  // ==================== Pairings ====================

  describe('POST /api/tournaments/:id/rounds/:roundNumber/pair', () => {
    it('should generate pairings', async () => {
      const round = {
        number: 1,
        status: 'paired',
        pairings: [
          {
            blackPlayerId: 'player1',
            whitePlayerId: 'player2',
            boardNumber: 1,
            handicapStones: 0,
            komi: 7.5,
            result: 'NR',
          },
        ],
        byes: [],
        pairedAt: new Date(),
      };
      mockGeneratePairings.mockResolvedValue(round);

      const response = await request(app).post(
        '/api/tournaments/507f1f77bcf86cd799439011/rounds/1/pair'
      );

      expect(response.status).toBe(200);
      expect(response.body.round.status).toBe('paired');
      expect(response.body.round.pairings).toHaveLength(1);
    });

    it('should handle pairing with byes', async () => {
      const round = {
        number: 1,
        status: 'paired',
        pairings: [
          { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 7.5, result: 'NR' },
        ],
        byes: [{ playerId: 'p3', points: 1.0 }],
        pairedAt: new Date(),
      };
      mockGeneratePairings.mockResolvedValue(round);

      const response = await request(app).post(
        '/api/tournaments/507f1f77bcf86cd799439011/rounds/1/pair'
      );

      expect(response.status).toBe(200);
      expect(response.body.round.byes).toHaveLength(1);
    });

    it('should handle tournament not found error', async () => {
      mockGeneratePairings.mockRejectedValue(new Error('Tournament not found'));

      const response = await request(app).post(
        '/api/tournaments/nonexistent/rounds/1/pair'
      );

      expect(response.status).toBe(404);
    });

    it('should handle round not found error', async () => {
      mockGeneratePairings.mockRejectedValue(new Error('Round 99 not found'));

      const response = await request(app).post(
        '/api/tournaments/507f1f77bcf86cd799439011/rounds/99/pair'
      );

      expect(response.status).toBe(404);
    });

    it('should handle round not pending error', async () => {
      mockGeneratePairings.mockRejectedValue(new Error('Round 1 is not in pending status'));

      const response = await request(app).post(
        '/api/tournaments/507f1f77bcf86cd799439011/rounds/1/pair'
      );

      expect(response.status).toBe(500);
    });
  });

  // ==================== Record Result ====================

  describe('PATCH /api/tournaments/:id/rounds/:roundNumber/boards/:boardNumber', () => {
    it('should record result', async () => {
      const tournament = createTournamentData({
        rounds: [
          {
            number: 1,
            status: 'completed',
            pairings: [
              {
                blackPlayerId: 'player1',
                whitePlayerId: 'player2',
                boardNumber: 1,
                result: 'B+',
              },
            ],
            byes: [],
          },
        ],
      });
      mockRecordResult.mockResolvedValue(tournament);

      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011/rounds/1/boards/1')
        .send({ result: 'B+' });

      expect(response.status).toBe(200);
      expect(response.body.tournament.rounds[0].pairings[0].result).toBe('B+');
    });

    it('should accept all valid result types', async () => {
      const resultTypes = ['B+', 'W+', 'B+F', 'W+F', 'Draw', 'NR', 'BL'];

      for (const resultType of resultTypes) {
        const tournament = createTournamentData({
          rounds: [{ number: 1, status: 'paired', pairings: [{ result: resultType }], byes: [] }],
        });
        mockRecordResult.mockResolvedValue(tournament);

        const response = await request(app)
          .patch('/api/tournaments/507f1f77bcf86cd799439011/rounds/1/boards/1')
          .send({ result: resultType });

        expect(response.status).toBe(200);
      }
    });

    it('should return 400 for invalid result', async () => {
      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011/rounds/1/boards/1')
        .send({ result: 'invalid' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent tournament', async () => {
      mockRecordResult.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/tournaments/nonexistent/rounds/1/boards/1')
        .send({ result: 'B+' });

      expect(response.status).toBe(404);
    });
  });

  // ==================== Standings ====================

  describe('GET /api/tournaments/:id/standings', () => {
    it('should return standings', async () => {
      const standings = [
        {
          rank: 1,
          playerId: 'player1',
          playerName: 'Alice',
          playerRank: '5k',
          wins: 3,
          losses: 0,
          sos: 2.5,
          sodos: 1.5,
          extendedSos: 0,
          totalScore: 3.35,
        },
        {
          rank: 2,
          playerId: 'player2',
          playerName: 'Bob',
          playerRank: '4k',
          wins: 2,
          losses: 1,
          sos: 2.0,
          sodos: 1.0,
          extendedSos: 0,
          totalScore: 2.25,
        },
      ];
      mockGetStandings.mockResolvedValue(standings);

      const response = await request(app).get('/api/tournaments/507f1f77bcf86cd799439011/standings');

      expect(response.status).toBe(200);
      expect(response.body.standings).toHaveLength(2);
      expect(response.body.standings[0].playerName).toBe('Alice');
    });

    it('should pass throughRound parameter', async () => {
      mockGetStandings.mockResolvedValue([]);

      await request(app).get('/api/tournaments/507f1f77bcf86cd799439011/standings?throughRound=2');

      expect(mockGetStandings).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 2);
    });

    it('should handle tournament not found error', async () => {
      mockGetStandings.mockRejectedValue(new Error('Tournament not found'));

      const response = await request(app).get('/api/tournaments/nonexistent/standings');

      expect(response.status).toBe(404);
    });
  });

  // ==================== Divisions ====================

  describe('POST /api/tournaments/:id/divisions', () => {
    it('should add a division', async () => {
      const division = { id: 'div-1', name: 'Open', description: 'Dan players' };
      mockAddDivision.mockResolvedValue(division);

      const response = await request(app)
        .post('/api/tournaments/507f1f77bcf86cd799439011/divisions')
        .send({ name: 'Open', description: 'Dan players' });

      expect(response.status).toBe(201);
      expect(response.body.division.name).toBe('Open');
    });

    it('should return 404 for non-existent tournament', async () => {
      mockAddDivision.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/tournaments/nonexistent/divisions')
        .send({ name: 'Open' });

      expect(response.status).toBe(404);
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/tournaments/507f1f77bcf86cd799439011/divisions')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/tournaments/:id/divisions/:divisionId', () => {
    it('should update a division', async () => {
      const division = { id: 'div-1', name: 'Open Division', description: null };
      mockUpdateDivision.mockResolvedValue(division);

      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011/divisions/div-1')
        .send({ name: 'Open Division' });

      expect(response.status).toBe(200);
      expect(response.body.division.name).toBe('Open Division');
    });

    it('should return 404 for non-existent division', async () => {
      mockUpdateDivision.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/tournaments/507f1f77bcf86cd799439011/divisions/nonexistent')
        .send({ name: 'Open' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/tournaments/:id/divisions/:divisionId', () => {
    it('should delete a division', async () => {
      mockRemoveDivision.mockResolvedValue(true);

      const response = await request(app).delete(
        '/api/tournaments/507f1f77bcf86cd799439011/divisions/div-1'
      );

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent division', async () => {
      mockRemoveDivision.mockResolvedValue(false);

      const response = await request(app).delete(
        '/api/tournaments/507f1f77bcf86cd799439011/divisions/nonexistent'
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/tournaments/:id/divisions/:divisionId/standings', () => {
    it('should return division standings', async () => {
      const standings = [
        { rank: 1, playerId: 'p1', playerName: 'Alice', playerRank: '3d', wins: 2, losses: 0, sos: 1.0, sodos: 0.5, extendedSos: 0, totalScore: 2.15 },
      ];
      mockGetStandings.mockResolvedValue(standings);

      const response = await request(app).get(
        '/api/tournaments/507f1f77bcf86cd799439011/divisions/div-open/standings'
      );

      expect(response.status).toBe(200);
      expect(response.body.standings).toHaveLength(1);
      expect(mockGetStandings).toHaveBeenCalledWith('507f1f77bcf86cd799439011', undefined, 'div-open');
    });

    it('should pass throughRound parameter', async () => {
      mockGetStandings.mockResolvedValue([]);

      await request(app).get(
        '/api/tournaments/507f1f77bcf86cd799439011/divisions/div-open/standings?throughRound=2'
      );

      expect(mockGetStandings).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 2, 'div-open');
    });

    it('should handle tournament not found error', async () => {
      mockGetStandings.mockRejectedValue(new Error('Tournament not found'));

      const response = await request(app).get(
        '/api/tournaments/nonexistent/divisions/div-open/standings'
      );

      expect(response.status).toBe(404);
    });
  });
});
