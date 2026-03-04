import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { PlayerService } from '../../src/services/playerService.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = jest.Mock<any>;

// Mock prisma
const mockCreate: MockFn = jest.fn();
const mockFindUnique: MockFn = jest.fn();
const mockFindMany: MockFn = jest.fn();
const mockUpdate: MockFn = jest.fn();
const mockDelete: MockFn = jest.fn();

jest.mock('../../src/prisma/client.js', () => ({
  prisma: {
    player: {
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

// Mock nyigTdClient
const mockValidateRanks: MockFn = jest.fn();

jest.mock('../../src/services/nyigTdClient.js', () => ({
  nyigTdClient: {
    validateRanks: (...args: unknown[]) => mockValidateRanks(...args),
  },
}));

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlayerService();
  });

  describe('create', () => {
    it('should create a player with valid rank', async () => {
      mockValidateRanks.mockResolvedValue({
        results: [{ rank: '5k', valid: true, normalized: '5k' }],
        all_valid: true,
      });

      const playerData = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        rank: '5k',
        club: 'NYC Go Club',
        agaId: '10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreate.mockResolvedValue(playerData);

      const result = await service.create({
        name: 'John Doe',
        rank: '5k',
        club: 'NYC Go Club',
        agaId: '10001',
      });

      expect(mockValidateRanks).toHaveBeenCalledWith(['5k']);
      expect(mockCreate).toHaveBeenCalled();
      expect(result.name).toBe('John Doe');
    });

    it('should use original rank if normalized is not provided', async () => {
      mockValidateRanks.mockResolvedValue({
        results: [{ rank: '5K', valid: true }], // no normalized field
        all_valid: true,
      });

      const playerData = {
        id: '507f1f77bcf86cd799439011',
        name: 'Jane Doe',
        rank: '5k',
        agaId: '10002',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreate.mockResolvedValue(playerData);

      await service.create({ name: 'Jane Doe', rank: '5K', agaId: '10002' });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ rank: '5k' }),
      });
    });

    it('should throw error for invalid rank', async () => {
      mockValidateRanks.mockResolvedValue({
        results: [{ rank: 'invalid', valid: false, error: 'Invalid format' }],
        all_valid: false,
      });

      await expect(
        service.create({
          name: 'John Doe',
          rank: 'invalid',
          agaId: '10003',
        })
      ).rejects.toThrow('Invalid rank: invalid');
    });
  });

  describe('get', () => {
    it('should return player by id', async () => {
      const player = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        rank: '5k',
        agaId: '10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFindUnique.mockResolvedValue(player);

      const result = await service.get('507f1f77bcf86cd799439011');

      expect(result).toEqual(player);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: '507f1f77bcf86cd799439011' },
      });
    });

    it('should return null for non-existent player', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list players with default pagination', async () => {
      const players = [
        { id: '1', name: 'Alice', rank: '5k', agaId: '10001', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', name: 'Bob', rank: '3d', agaId: '10002', createdAt: new Date(), updatedAt: new Date() },
      ];

      mockFindMany.mockResolvedValue(players);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { name: 'asc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by search term', async () => {
      mockFindMany.mockResolvedValue([]);

      await service.list({ search: 'Alice' });

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { name: { contains: 'Alice', mode: 'insensitive' } },
        orderBy: { name: 'asc' },
        take: 50,
        skip: 0,
      });
    });
  });

  describe('update', () => {
    it('should update player without rank change', async () => {
      const updated = {
        id: '1',
        name: 'Jane Doe',
        rank: '5k',
        agaId: '10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdate.mockResolvedValue(updated);

      const result = await service.update('1', { name: 'Jane Doe' });

      expect(result?.name).toBe('Jane Doe');
      expect(mockValidateRanks).not.toHaveBeenCalled();
    });

    it('should validate rank when updating', async () => {
      mockValidateRanks.mockResolvedValue({
        results: [{ rank: '3d', valid: true, normalized: '3d' }],
        all_valid: true,
      });

      const updated = {
        id: '1',
        name: 'Jane Doe',
        rank: '3d',
        agaId: '10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdate.mockResolvedValue(updated);

      await service.update('1', { rank: '3d' });

      expect(mockValidateRanks).toHaveBeenCalledWith(['3d']);
    });

    it('should throw error for invalid rank on update', async () => {
      mockValidateRanks.mockResolvedValue({
        results: [{ rank: 'invalid', valid: false, error: 'Invalid format' }],
        all_valid: false,
      });

      await expect(service.update('1', { rank: 'invalid' })).rejects.toThrow('Invalid rank: invalid');
    });

    it('should use original rank if normalized is not provided on update', async () => {
      mockValidateRanks.mockResolvedValue({
        results: [{ rank: '4K', valid: true }], // no normalized field
        all_valid: true,
      });

      const updated = {
        id: '1',
        name: 'Test',
        rank: '4k',
        agaId: '10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdate.mockResolvedValue(updated);

      await service.update('1', { rank: '4K' });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { rank: '4k' },
      });
    });
  });

  describe('delete', () => {
    it('should delete player and return true', async () => {
      mockDelete.mockResolvedValue({});

      const result = await service.delete('1');

      expect(result).toBe(true);
    });

    it('should return false if player not found', async () => {
      mockDelete.mockRejectedValue(new Error('Not found'));

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});
