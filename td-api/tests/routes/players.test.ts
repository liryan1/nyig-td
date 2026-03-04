import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import playersRouter from '../../src/routes/players.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = jest.Mock<any>;

// Mock the player service
const mockList: MockFn = jest.fn();
const mockCreate: MockFn = jest.fn();
const mockGet: MockFn = jest.fn();
const mockUpdate: MockFn = jest.fn();
const mockDelete: MockFn = jest.fn();

jest.mock('../../src/services/index.js', () => ({
  playerService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    get: (...args: unknown[]) => mockGet(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe('Player Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/players', playersRouter);
    app.use(errorHandler);
  });

  describe('GET /api/players', () => {
    it('should return list of players', async () => {
      const players = [
        { id: '1', name: 'Alice', rank: '5k', agaId: '10001', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', name: 'Bob', rank: '3d', agaId: '10002', createdAt: new Date(), updatedAt: new Date() },
      ];

      mockList.mockResolvedValue(players);

      const response = await request(app).get('/api/players');

      expect(response.status).toBe(200);
      expect(response.body.players).toHaveLength(2);
    });

    it('should pass query parameters', async () => {
      mockList.mockResolvedValue([]);

      await request(app).get('/api/players?search=Alice&limit=10&skip=5');

      expect(mockList).toHaveBeenCalledWith({
        search: 'Alice',
        limit: 10,
        skip: 5,
      });
    });

    it('should handle service errors', async () => {
      mockList.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/players');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/players', () => {
    it('should create a player', async () => {
      const player = {
        id: '1',
        name: 'Alice',
        rank: '5k',
        agaId: '10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreate.mockResolvedValue(player);

      const response = await request(app).post('/api/players').send({ name: 'Alice', rank: '5k', agaId: '10001' });

      expect(response.status).toBe(201);
      expect(response.body.player.name).toBe('Alice');
    });

    it('should return 400 for missing agaId', async () => {
      const response = await request(app).post('/api/players').send({ name: 'Alice', rank: '5k' }); // missing agaId

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 for invalid rank format', async () => {
      const response = await request(app)
        .post('/api/players')
        .send({ name: 'Alice', rank: 'invalid', agaId: '10001' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/players/:id', () => {
    it('should return player by id', async () => {
      const player = {
        id: '1',
        name: 'Alice',
        rank: '5k',
        agaId: '10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGet.mockResolvedValue(player);

      const response = await request(app).get('/api/players/1');

      expect(response.status).toBe(200);
      expect(response.body.player.name).toBe('Alice');
    });

    it('should return 404 for non-existent player', async () => {
      mockGet.mockResolvedValue(null);

      const response = await request(app).get('/api/players/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Player not found');
    });

    it('should handle service errors', async () => {
      mockGet.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/players/1');

      expect(response.status).toBe(500);
    });
  });

  describe('PATCH /api/players/:id', () => {
    it('should update player', async () => {
      const player = {
        id: '1',
        name: 'Alice Updated',
        rank: '4k',
        agaId: '10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdate.mockResolvedValue(player);

      const response = await request(app)
        .patch('/api/players/1')
        .send({ name: 'Alice Updated', rank: '4k' });

      expect(response.status).toBe(200);
      expect(response.body.player.name).toBe('Alice Updated');
    });

    it('should return 404 for non-existent player', async () => {
      mockUpdate.mockResolvedValue(null);

      const response = await request(app).patch('/api/players/nonexistent').send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should handle service errors', async () => {
      mockUpdate.mockRejectedValue(new Error('Database error'));

      const response = await request(app).patch('/api/players/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/players/:id', () => {
    it('should delete player', async () => {
      mockDelete.mockResolvedValue(true);

      const response = await request(app).delete('/api/players/1');

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent player', async () => {
      mockDelete.mockResolvedValue(false);

      const response = await request(app).delete('/api/players/nonexistent');

      expect(response.status).toBe(404);
    });

    it('should handle service errors', async () => {
      mockDelete.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/players/1');

      expect(response.status).toBe(500);
    });
  });
});
