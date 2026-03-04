import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TournamentService } from '../../src/services/tournamentService.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = jest.Mock<any>;

// Mock prisma
const mockTournamentCreate: MockFn = jest.fn();
const mockTournamentFindUnique: MockFn = jest.fn();
const mockTournamentFindMany: MockFn = jest.fn();
const mockTournamentUpdate: MockFn = jest.fn();
const mockTournamentDelete: MockFn = jest.fn();
const mockPlayerFindMany: MockFn = jest.fn();

jest.mock('../../src/prisma/client.js', () => ({
  prisma: {
    tournament: {
      create: (...args: unknown[]) => mockTournamentCreate(...args),
      findUnique: (...args: unknown[]) => mockTournamentFindUnique(...args),
      findMany: (...args: unknown[]) => mockTournamentFindMany(...args),
      update: (...args: unknown[]) => mockTournamentUpdate(...args),
      delete: (...args: unknown[]) => mockTournamentDelete(...args),
    },
    player: {
      findMany: (...args: unknown[]) => mockPlayerFindMany(...args),
    },
  },
}));

// Mock nyigTdClient
const mockGeneratePairings: MockFn = jest.fn();
const mockCalculateStandings: MockFn = jest.fn();

jest.mock('../../src/services/nyigTdClient.js', () => ({
  nyigTdClient: {
    generatePairings: (...args: unknown[]) => mockGeneratePairings(...args),
    calculateStandings: (...args: unknown[]) => mockCalculateStandings(...args),
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
      handicapType: 'rank_difference',
      handicapModifier: 'none',
      mcmahonBar: null,
      crossDivisionPairing: true,
    },
    divisions: [],
    registrations: [],
    rounds: [
      { number: 1, status: 'pending', pairings: [], byes: [] },
      { number: 2, status: 'pending', pairings: [], byes: [] },
      { number: 3, status: 'pending', pairings: [], byes: [] },
      { number: 4, status: 'pending', pairings: [], byes: [] },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper to create player data
function createPlayerData(id: string, name: string, rank: string) {
  return {
    id,
    name,
    rank,
    club: null,
    agaId: null,
    rating: null,
    email: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('TournamentService', () => {
  let service: TournamentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TournamentService();
  });

  // ==================== CRUD Operations ====================

  describe('create', () => {
    it('should create tournament with initialized rounds', async () => {
      const tournamentData = createTournamentData();
      mockTournamentCreate.mockResolvedValue(tournamentData);

      const result = await service.create({
        name: 'Spring Tournament',
        date: new Date('2026-04-15'),
        settings: {
          numRounds: 4,
          pairingAlgorithm: 'mcmahon',
          handicapType: 'rank_difference',
          handicapModifier: 'none',
          crossDivisionPairing: true,
        },
      });

      expect(result.rounds).toHaveLength(4);
      expect(mockTournamentCreate).toHaveBeenCalled();
    });

    it('should create tournament with mcmahonBar setting', async () => {
      const tournamentData = createTournamentData({
        settings: {
          numRounds: 3,
          pairingAlgorithm: 'mcmahon',
          handicapType: 'rank_difference',
          handicapModifier: 'minus_1',
          mcmahonBar: '1d',
        },
      });
      mockTournamentCreate.mockResolvedValue(tournamentData);

      const result = await service.create({
        name: 'McMahon Tournament',
        date: new Date('2026-05-01'),
        settings: {
          numRounds: 3,
          pairingAlgorithm: 'mcmahon',
          handicapType: 'rank_difference',
          handicapModifier: 'minus_1',
          mcmahonBar: '1d',
          crossDivisionPairing: true,
        },
      });

      expect(result.settings.mcmahonBar).toBe('1d');
      expect(result.settings.handicapModifier).toBe('minus_1');
    });
  });

  describe('get', () => {
    it('should return tournament by id', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);

      const result = await service.get('507f1f77bcf86cd799439011');

      expect(result).toEqual(tournament);
      expect(mockTournamentFindUnique).toHaveBeenCalledWith({
        where: { id: '507f1f77bcf86cd799439011' },
      });
    });

    it('should return null for non-existent tournament', async () => {
      mockTournamentFindUnique.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list tournaments with default pagination', async () => {
      const tournaments = [createTournamentData(), createTournamentData({ id: '2', name: 'Fall Tournament' })];
      mockTournamentFindMany.mockResolvedValue(tournaments);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(mockTournamentFindMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { date: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by status', async () => {
      mockTournamentFindMany.mockResolvedValue([]);

      await service.list({ status: 'in_progress' });

      expect(mockTournamentFindMany).toHaveBeenCalledWith({
        where: { status: 'in_progress' },
        orderBy: { date: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should apply custom pagination', async () => {
      mockTournamentFindMany.mockResolvedValue([]);

      await service.list({ limit: 10, skip: 20 });

      expect(mockTournamentFindMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { date: 'desc' },
        take: 10,
        skip: 20,
      });
    });
  });

  describe('update', () => {
    it('should update tournament name', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue({ ...tournament, name: 'Updated Name' });

      const result = await service.update('507f1f77bcf86cd799439011', { name: 'Updated Name' });

      expect(result?.name).toBe('Updated Name');
    });

    it('should update tournament status', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue({ ...tournament, status: 'in_progress' });

      const result = await service.update('507f1f77bcf86cd799439011', { status: 'in_progress' });

      expect(result?.status).toBe('in_progress');
    });

    it('should update tournament settings partially', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue({
        ...tournament,
        settings: { ...tournament.settings, handicapType: 'none' },
      });

      const result = await service.update('507f1f77bcf86cd799439011', {
        settings: { handicapType: 'none' },
      });

      expect(result?.settings.handicapType).toBe('none');
    });

    it('should update handicap modifier', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue({
        ...tournament,
        settings: {
          ...tournament.settings,
          handicapModifier: 'minus_1',
        },
      });

      const result = await service.update('507f1f77bcf86cd799439011', {
        settings: { handicapModifier: 'minus_1' },
      });

      expect(result?.settings.handicapModifier).toBe('minus_1');
    });

    it('should return null for non-existent tournament', async () => {
      mockTournamentFindUnique.mockResolvedValue(null);

      const result = await service.update('nonexistent', { name: 'Test' });

      expect(result).toBeNull();
    });

    it('should update multiple fields at once', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue({
        ...tournament,
        name: 'New Name',
        description: 'New Description',
        location: 'New Location',
        date: new Date('2026-06-01'),
      });

      const result = await service.update('507f1f77bcf86cd799439011', {
        name: 'New Name',
        description: 'New Description',
        location: 'New Location',
        date: new Date('2026-06-01'),
      });

      expect(result?.name).toBe('New Name');
      expect(result?.description).toBe('New Description');
      expect(result?.location).toBe('New Location');
    });
  });

  describe('delete', () => {
    it('should delete tournament and return true', async () => {
      mockTournamentDelete.mockResolvedValue({});

      const result = await service.delete('507f1f77bcf86cd799439011');

      expect(result).toBe(true);
      expect(mockTournamentDelete).toHaveBeenCalledWith({ where: { id: '507f1f77bcf86cd799439011' } });
    });

    it('should return false if tournament not found', async () => {
      mockTournamentDelete.mockRejectedValue(new Error('Not found'));

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== Registration ====================

  describe('registerPlayer', () => {
    it('should add new registration', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue({
        ...tournament,
        registrations: [
          { playerId: 'player1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });

      const result = await service.registerPlayer('507f1f77bcf86cd799439011', 'player1', []);

      expect(result?.registrations).toHaveLength(1);
    });

    it('should use default empty array for roundsParticipating when not provided', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      // Call without third parameter to test default value
      const result = await service.registerPlayer('507f1f77bcf86cd799439011', 'player1');

      expect(result?.registrations[0].roundsParticipating).toEqual([]);
    });

    it('should register player with specific rounds', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue({
        ...tournament,
        registrations: [
          { playerId: 'player1', roundsParticipating: [1, 2], registeredAt: new Date(), withdrawn: false },
        ],
      });

      const result = await service.registerPlayer('507f1f77bcf86cd799439011', 'player1', [1, 2]);

      expect(result?.registrations[0].roundsParticipating).toEqual([1, 2]);
    });

    it('should reactivate withdrawn player', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [], registeredAt: new Date(), withdrawn: true },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      const result = await service.registerPlayer('507f1f77bcf86cd799439011', 'player1', []);

      expect(result?.registrations[0].withdrawn).toBe(false);
    });

    it('should reactivate withdrawn player while preserving other registrations', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [1], registeredAt: new Date(), withdrawn: false },
          { playerId: 'player2', roundsParticipating: [], registeredAt: new Date(), withdrawn: true },
          { playerId: 'player3', roundsParticipating: [1, 2], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      const result = await service.registerPlayer('507f1f77bcf86cd799439011', 'player2', [1, 2, 3]);

      // player2 should be reactivated with new rounds
      expect(result?.registrations[1].withdrawn).toBe(false);
      expect(result?.registrations[1].roundsParticipating).toEqual([1, 2, 3]);
      // other players should remain unchanged
      expect(result?.registrations[0].playerId).toBe('player1');
      expect(result?.registrations[2].playerId).toBe('player3');
    });

    it('should return null for non-existent tournament', async () => {
      mockTournamentFindUnique.mockResolvedValue(null);

      const result = await service.registerPlayer('nonexistent', 'player1', []);

      expect(result).toBeNull();
    });
  });

  describe('withdrawPlayer', () => {
    it('should mark player as withdrawn', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      const result = await service.withdrawPlayer('507f1f77bcf86cd799439011', 'player1');

      expect(result?.registrations[0].withdrawn).toBe(true);
    });

    it('should not affect other players when withdrawing', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
          { playerId: 'player2', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      const result = await service.withdrawPlayer('507f1f77bcf86cd799439011', 'player1');

      expect(result?.registrations[0].withdrawn).toBe(true);
      expect(result?.registrations[1].withdrawn).toBe(false);
    });

    it('should return null for non-existent tournament', async () => {
      mockTournamentFindUnique.mockResolvedValue(null);

      const result = await service.withdrawPlayer('nonexistent', 'player1');

      expect(result).toBeNull();
    });
  });

  describe('updateRegistration', () => {
    it('should update player rounds participation', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      const result = await service.updateRegistration('507f1f77bcf86cd799439011', 'player1', { roundsParticipating: [1, 3, 4] });

      expect(result?.registrations[0].roundsParticipating).toEqual([1, 3, 4]);
    });

    it('should return null for non-existent tournament', async () => {
      mockTournamentFindUnique.mockResolvedValue(null);

      const result = await service.updateRegistration('nonexistent', 'player1', { roundsParticipating: [1, 2] });

      expect(result).toBeNull();
    });

    it('should update only the target player rounds while preserving others', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [1], registeredAt: new Date(), withdrawn: false },
          { playerId: 'player2', roundsParticipating: [1, 2], registeredAt: new Date(), withdrawn: false },
          { playerId: 'player3', roundsParticipating: [1, 2, 3], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      const result = await service.updateRegistration('507f1f77bcf86cd799439011', 'player2', { roundsParticipating: [3, 4] });

      // player2 should have updated rounds
      expect(result?.registrations[1].roundsParticipating).toEqual([3, 4]);
      // other players should remain unchanged
      expect(result?.registrations[0].roundsParticipating).toEqual([1]);
      expect(result?.registrations[2].roundsParticipating).toEqual([1, 2, 3]);
    });

    it('should assign a division to a player', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      const result = await service.updateRegistration('507f1f77bcf86cd799439011', 'player1', { divisionId: 'div1' });

      expect(result?.registrations[0].divisionId).toBe('div1');
    });

    it('should change a player division', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', divisionId: 'div1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      const result = await service.updateRegistration('507f1f77bcf86cd799439011', 'player1', { divisionId: 'div2' });

      expect(result?.registrations[0].divisionId).toBe('div2');
    });

    it('should remove a player division with null', async () => {
      const tournament = createTournamentData({
        registrations: [
          { playerId: 'player1', divisionId: 'div1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        registrations: args.data.registrations,
      }));

      const result = await service.updateRegistration('507f1f77bcf86cd799439011', 'player1', { divisionId: null });

      expect(result?.registrations[0].divisionId).toBeNull();
    });
  });

  // ==================== Pairing Scenarios ====================

  describe('generatePairings', () => {
    describe('basic pairing scenarios', () => {
      it('should generate pairings for 4 players in round 1', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
            { playerId: 'p3', roundsParticipating: [], withdrawn: false },
            { playerId: 'p4', roundsParticipating: [], withdrawn: false },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '4k'),
          createPlayerData('p3', 'Charlie', '3k'),
          createPlayerData('p4', 'Diana', '2k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockGeneratePairings.mockResolvedValue({
          pairings: [
            { black_player_id: 'p1', white_player_id: 'p4', board_number: 1, handicap_stones: 3, komi: 0.5 },
            { black_player_id: 'p2', white_player_id: 'p3', board_number: 2, handicap_stones: 1, komi: 0.5 },
          ],
          byes: [],
          warnings: [],
        });
        mockTournamentUpdate.mockResolvedValue(tournament);

        const result = await service.generatePairings('507f1f77bcf86cd799439011', 1);

        expect(result.status).toBe('paired');
        expect(result.pairings).toHaveLength(2);
        expect(result.byes).toHaveLength(0);
        expect(result.pairings[0].handicapStones).toBe(3);
        expect(mockGeneratePairings).toHaveBeenCalledWith(
          expect.objectContaining({
            players: expect.arrayContaining([
              expect.objectContaining({ id: 'p1', name: 'Alice', rank: '5k' }),
            ]),
            round_number: 1,
            algorithm: 'mcmahon',
          })
        );
      });

      it('should generate pairings with bye for odd number of players (5 players)', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
            { playerId: 'p3', roundsParticipating: [], withdrawn: false },
            { playerId: 'p4', roundsParticipating: [], withdrawn: false },
            { playerId: 'p5', roundsParticipating: [], withdrawn: false },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '4k'),
          createPlayerData('p3', 'Charlie', '3k'),
          createPlayerData('p4', 'Diana', '2k'),
          createPlayerData('p5', 'Eve', '1k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockGeneratePairings.mockResolvedValue({
          pairings: [
            { black_player_id: 'p1', white_player_id: 'p5', board_number: 1, handicap_stones: 4, komi: 0.5 },
            { black_player_id: 'p2', white_player_id: 'p4', board_number: 2, handicap_stones: 2, komi: 0.5 },
          ],
          byes: [{ player_id: 'p3', points: 1.0 }],
          warnings: [],
        });
        mockTournamentUpdate.mockResolvedValue(tournament);

        const result = await service.generatePairings('507f1f77bcf86cd799439011', 1);

        expect(result.pairings).toHaveLength(2);
        expect(result.byes).toHaveLength(1);
        expect(result.byes[0].playerId).toBe('p3');
        expect(result.byes[0].points).toBe(1.0);
      });

      it('should exclude withdrawn players from pairings', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: true }, // Withdrawn
            { playerId: 'p3', roundsParticipating: [], withdrawn: false },
            { playerId: 'p4', roundsParticipating: [], withdrawn: false },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p3', 'Charlie', '3k'),
          createPlayerData('p4', 'Diana', '2k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockGeneratePairings.mockResolvedValue({
          pairings: [{ black_player_id: 'p1', white_player_id: 'p4', board_number: 1, handicap_stones: 3, komi: 0.5 }],
          byes: [{ player_id: 'p3', points: 1.0 }],
          warnings: [],
        });
        mockTournamentUpdate.mockResolvedValue(tournament);

        await service.generatePairings('507f1f77bcf86cd799439011', 1);

        // Should only query for non-withdrawn players
        expect(mockPlayerFindMany).toHaveBeenCalledWith({
          where: { id: { in: ['p1', 'p3', 'p4'] } },
        });
      });

      it('should only include players participating in specific round', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [1, 2], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [2, 3], withdrawn: false }, // Not in round 1
            { playerId: 'p3', roundsParticipating: [], withdrawn: false }, // All rounds
            { playerId: 'p4', roundsParticipating: [1], withdrawn: false },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p3', 'Charlie', '3k'),
          createPlayerData('p4', 'Diana', '2k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockGeneratePairings.mockResolvedValue({
          pairings: [{ black_player_id: 'p1', white_player_id: 'p4', board_number: 1, handicap_stones: 3, komi: 0.5 }],
          byes: [{ player_id: 'p3', points: 1.0 }],
          warnings: [],
        });
        mockTournamentUpdate.mockResolvedValue(tournament);

        await service.generatePairings('507f1f77bcf86cd799439011', 1);

        // Should exclude p2 who is not participating in round 1
        expect(mockPlayerFindMany).toHaveBeenCalledWith({
          where: { id: { in: ['p1', 'p3', 'p4'] } },
        });
      });
    });

    describe('round 2+ with history', () => {
      it('should include completed round 1 data when pairing round 2', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
            { playerId: 'p3', roundsParticipating: [], withdrawn: false },
            { playerId: 'p4', roundsParticipating: [], withdrawn: false },
          ],
          rounds: [
            {
              number: 1,
              status: 'completed',
              pairings: [
                { blackPlayerId: 'p1', whitePlayerId: 'p4', boardNumber: 1, handicapStones: 3, komi: 0.5, result: 'B+' },
                { blackPlayerId: 'p2', whitePlayerId: 'p3', boardNumber: 2, handicapStones: 1, komi: 0.5, result: 'W+' },
              ],
              byes: [],
              completedAt: new Date(),
            },
            { number: 2, status: 'pending', pairings: [], byes: [] },
            { number: 3, status: 'pending', pairings: [], byes: [] },
            { number: 4, status: 'pending', pairings: [], byes: [] },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '4k'),
          createPlayerData('p3', 'Charlie', '3k'),
          createPlayerData('p4', 'Diana', '2k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockGeneratePairings.mockResolvedValue({
          pairings: [
            { black_player_id: 'p1', white_player_id: 'p3', board_number: 1, handicap_stones: 2, komi: 0.5 },
            { black_player_id: 'p2', white_player_id: 'p4', board_number: 2, handicap_stones: 2, komi: 0.5 },
          ],
          byes: [],
          warnings: [],
        });
        mockTournamentUpdate.mockResolvedValue(tournament);

        await service.generatePairings('507f1f77bcf86cd799439011', 2);

        expect(mockGeneratePairings).toHaveBeenCalledWith(
          expect.objectContaining({
            round_number: 2,
            previous_rounds: [
              {
                number: 1,
                pairings: [
                  { black_player_id: 'p1', white_player_id: 'p4', result: 'B+' },
                  { black_player_id: 'p2', white_player_id: 'p3', result: 'W+' },
                ],
                byes: [],
              },
            ],
          })
        );
      });

      it('should include byes in previous round data', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
            { playerId: 'p3', roundsParticipating: [], withdrawn: false },
          ],
          rounds: [
            {
              number: 1,
              status: 'completed',
              pairings: [
                { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 1, komi: 0.5, result: 'B+' },
              ],
              byes: [{ playerId: 'p3', points: 1.0 }],
              completedAt: new Date(),
            },
            { number: 2, status: 'pending', pairings: [], byes: [] },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '4k'),
          createPlayerData('p3', 'Charlie', '3k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockGeneratePairings.mockResolvedValue({
          pairings: [
            { black_player_id: 'p1', white_player_id: 'p3', board_number: 1, handicap_stones: 2, komi: 0.5 },
          ],
          byes: [{ player_id: 'p2', points: 1.0 }],
          warnings: [],
        });
        mockTournamentUpdate.mockResolvedValue(tournament);

        await service.generatePairings('507f1f77bcf86cd799439011', 2);

        expect(mockGeneratePairings).toHaveBeenCalledWith(
          expect.objectContaining({
            previous_rounds: [
              expect.objectContaining({
                byes: [{ player_id: 'p3', points: 1.0 }],
              }),
            ],
          })
        );
      });
    });

    describe('McMahon and Swiss settings', () => {
      it('should pass mcmahonBar to pairing algorithm', async () => {
        const tournament = createTournamentData({
          settings: {
            numRounds: 4,
            pairingAlgorithm: 'mcmahon',
            handicapType: 'rank_difference',
            handicapModifier: 'none',
            mcmahonBar: '1d',
          },
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '2d'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockGeneratePairings.mockResolvedValue({
          pairings: [{ black_player_id: 'p1', white_player_id: 'p2', board_number: 1, handicap_stones: 6, komi: 0.5 }],
          byes: [],
          warnings: [],
        });
        mockTournamentUpdate.mockResolvedValue(tournament);

        await service.generatePairings('507f1f77bcf86cd799439011', 1);

        expect(mockGeneratePairings).toHaveBeenCalledWith(
          expect.objectContaining({
            algorithm: 'mcmahon',
            mcmahon_bar: '1d',
          })
        );
      });

      it('should use swiss algorithm when configured', async () => {
        const tournament = createTournamentData({
          settings: {
            numRounds: 4,
            pairingAlgorithm: 'swiss',
            handicapType: 'none',
            handicapModifier: 'none',
          },
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '3d'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockGeneratePairings.mockResolvedValue({
          pairings: [{ black_player_id: 'p1', white_player_id: 'p2', board_number: 1, handicap_stones: 0, komi: 7.5 }],
          byes: [],
          warnings: [],
        });
        mockTournamentUpdate.mockResolvedValue(tournament);

        await service.generatePairings('507f1f77bcf86cd799439011', 1);

        expect(mockGeneratePairings).toHaveBeenCalledWith(
          expect.objectContaining({
            algorithm: 'swiss',
            handicap_type: 'none',
          })
        );
      });
    });

    describe('error cases', () => {
      it('should throw error for non-existent tournament', async () => {
        mockTournamentFindUnique.mockResolvedValue(null);

        await expect(service.generatePairings('nonexistent', 1)).rejects.toThrow('Tournament not found');
      });

      it('should throw error for non-existent round', async () => {
        const tournament = createTournamentData();
        mockTournamentFindUnique.mockResolvedValue(tournament);

        await expect(service.generatePairings('507f1f77bcf86cd799439011', 99)).rejects.toThrow('Round 99 not found');
      });

      it('should throw error if round is not in pending status', async () => {
        const tournament = createTournamentData({
          rounds: [
            { number: 1, status: 'in_progress', pairings: [], byes: [] },
            { number: 2, status: 'pending', pairings: [], byes: [] },
          ],
        });
        mockTournamentFindUnique.mockResolvedValue(tournament);

        await expect(service.generatePairings('507f1f77bcf86cd799439011', 1)).rejects.toThrow(
          'Round 1 cannot be paired (status: in_progress)'
        );
      });

      it('should throw error if round is already completed', async () => {
        const tournament = createTournamentData({
          rounds: [
            { number: 1, status: 'completed', pairings: [], byes: [] },
            { number: 2, status: 'pending', pairings: [], byes: [] },
          ],
        });
        mockTournamentFindUnique.mockResolvedValue(tournament);

        await expect(service.generatePairings('507f1f77bcf86cd799439011', 1)).rejects.toThrow(
          'Round 1 cannot be paired (status: completed)'
        );
      });
    });
  });

  // ==================== Record Result ====================

  describe('recordResult', () => {
    it('should record game result and mark round completed when all games done', async () => {
      const tournament = createTournamentData({
        rounds: [
          {
            number: 1,
            status: 'paired',
            pairings: [
              { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 7.5, result: 'NR' },
            ],
            byes: [],
          },
        ],
      });

      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        rounds: args.data.rounds,
      }));

      const result = await service.recordResult('507f1f77bcf86cd799439011', 1, 1, 'B+');

      expect(result?.rounds[0].pairings[0].result).toBe('B+');
      expect(result?.rounds[0].status).toBe('completed');
    });

    it('should mark round as in_progress when not all games complete', async () => {
      const tournament = createTournamentData({
        rounds: [
          {
            number: 1,
            status: 'paired',
            pairings: [
              { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 7.5, result: 'NR' },
              { blackPlayerId: 'p3', whitePlayerId: 'p4', boardNumber: 2, handicapStones: 0, komi: 7.5, result: 'NR' },
            ],
            byes: [],
          },
        ],
      });

      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        rounds: args.data.rounds,
      }));

      const result = await service.recordResult('507f1f77bcf86cd799439011', 1, 1, 'B+');

      expect(result?.rounds[0].pairings[0].result).toBe('B+');
      expect(result?.rounds[0].pairings[1].result).toBe('NR');
      expect(result?.rounds[0].status).toBe('in_progress');
    });

    it('should handle all result types', async () => {
      const resultTypes = ['B+', 'W+', 'B+F', 'W+F', 'Draw', 'BL'] as const;

      for (const resultType of resultTypes) {
        const tournament = createTournamentData({
          rounds: [
            {
              number: 1,
              status: 'paired',
              pairings: [
                { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 7.5, result: 'NR' },
              ],
              byes: [],
            },
          ],
        });

        mockTournamentFindUnique.mockResolvedValue(tournament);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockTournamentUpdate.mockImplementation(async (args: any) => ({
          ...tournament,
          rounds: args.data.rounds,
        }));

        const result = await service.recordResult('507f1f77bcf86cd799439011', 1, 1, resultType);

        expect(result?.rounds[0].pairings[0].result).toBe(resultType);
      }
    });

    it('should return null for non-existent tournament', async () => {
      mockTournamentFindUnique.mockResolvedValue(null);

      const result = await service.recordResult('nonexistent', 1, 1, 'B+');

      expect(result).toBeNull();
    });

    it('should return null for non-existent round', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);

      const result = await service.recordResult('507f1f77bcf86cd799439011', 99, 1, 'B+');

      expect(result).toBeNull();
    });

    it('should return null for non-existent board', async () => {
      const tournament = createTournamentData({
        rounds: [
          {
            number: 1,
            status: 'paired',
            pairings: [
              { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 7.5, result: 'NR' },
            ],
            byes: [],
          },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);

      const result = await service.recordResult('507f1f77bcf86cd799439011', 1, 99, 'B+');

      expect(result).toBeNull();
    });

    it('should update result in specific round while preserving other rounds', async () => {
      const tournament = createTournamentData({
        rounds: [
          {
            number: 1,
            status: 'completed',
            pairings: [
              { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 7.5, result: 'B+' },
            ],
            byes: [],
          },
          {
            number: 2,
            status: 'paired',
            pairings: [
              { blackPlayerId: 'p2', whitePlayerId: 'p1', boardNumber: 1, handicapStones: 0, komi: 7.5, result: 'NR' },
            ],
            byes: [],
          },
        ],
      });

      mockTournamentFindUnique.mockResolvedValue(tournament);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTournamentUpdate.mockImplementation(async (args: any) => ({
        ...tournament,
        rounds: args.data.rounds,
      }));

      const result = await service.recordResult('507f1f77bcf86cd799439011', 2, 1, 'W+');

      // Round 1 should remain unchanged
      expect(result?.rounds[0].pairings[0].result).toBe('B+');
      expect(result?.rounds[0].status).toBe('completed');
      // Round 2 should be updated
      expect(result?.rounds[1].pairings[0].result).toBe('W+');
      expect(result?.rounds[1].status).toBe('completed');
    });
  });

  // ==================== Standings Scenarios ====================

  describe('getStandings', () => {
    describe('basic standings', () => {
      it('should calculate standings after one round', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
          ],
          rounds: [
            {
              number: 1,
              status: 'completed',
              pairings: [
                { blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, handicapStones: 0, komi: 7.5, result: 'B+' },
              ],
              byes: [],
            },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '5k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockCalculateStandings.mockResolvedValue({
          standings: [
            {
              rank: 1,
              player_id: 'p1',
              player_name: 'Alice',
              player_rank: '5k',
              wins: 1,
              losses: 0,
              sos: 0,
              sds: 0,
              sosos: 0,
            },
            {
              rank: 2,
              player_id: 'p2',
              player_name: 'Bob',
              player_rank: '5k',
              wins: 0,
              losses: 1,
              sos: 1,
              sds: 0,
              sosos: 0,
            },
          ],
        });

        const result = await service.getStandings('507f1f77bcf86cd799439011');

        expect(result).toHaveLength(2);
        expect(result[0].rank).toBe(1);
        expect(result[0].playerName).toBe('Alice');
        expect(result[0].wins).toBe(1);
        expect(result[1].rank).toBe(2);
        expect(result[1].losses).toBe(1);
      });

      it('should calculate standings after multiple rounds', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
            { playerId: 'p3', roundsParticipating: [], withdrawn: false },
            { playerId: 'p4', roundsParticipating: [], withdrawn: false },
          ],
          rounds: [
            {
              number: 1,
              status: 'completed',
              pairings: [
                { blackPlayerId: 'p1', whitePlayerId: 'p4', boardNumber: 1, result: 'B+' },
                { blackPlayerId: 'p2', whitePlayerId: 'p3', boardNumber: 2, result: 'W+' },
              ],
              byes: [],
            },
            {
              number: 2,
              status: 'completed',
              pairings: [
                { blackPlayerId: 'p1', whitePlayerId: 'p3', boardNumber: 1, result: 'B+' },
                { blackPlayerId: 'p2', whitePlayerId: 'p4', boardNumber: 2, result: 'B+' },
              ],
              byes: [],
            },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '4k'),
          createPlayerData('p3', 'Charlie', '3k'),
          createPlayerData('p4', 'Diana', '2k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockCalculateStandings.mockResolvedValue({
          standings: [
            { rank: 1, player_id: 'p1', player_name: 'Alice', player_rank: '5k', wins: 2, losses: 0, sos: 1.0, sds: 0, sosos: 0 },
            { rank: 2, player_id: 'p3', player_name: 'Charlie', player_rank: '3k', wins: 1, losses: 1, sos: 2.0, sds: 1, sosos: 0 },
            { rank: 3, player_id: 'p2', player_name: 'Bob', player_rank: '4k', wins: 1, losses: 1, sos: 1.0, sds: 0, sosos: 0 },
            { rank: 4, player_id: 'p4', player_name: 'Diana', player_rank: '2k', wins: 0, losses: 2, sos: 2.0, sds: 0, sosos: 0 },
          ],
        });

        const result = await service.getStandings('507f1f77bcf86cd799439011');

        expect(result).toHaveLength(4);
        expect(mockCalculateStandings).toHaveBeenCalledWith(
          expect.objectContaining({
            rounds: expect.arrayContaining([
              expect.objectContaining({ number: 1 }),
              expect.objectContaining({ number: 2 }),
            ]),
          })
        );
      });
    });

    describe('throughRound filter', () => {
      it('should filter standings to specific round', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
          ],
          rounds: [
            {
              number: 1,
              status: 'completed',
              pairings: [{ blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, result: 'B+' }],
              byes: [],
            },
            {
              number: 2,
              status: 'completed',
              pairings: [{ blackPlayerId: 'p2', whitePlayerId: 'p1', boardNumber: 1, result: 'B+' }],
              byes: [],
            },
            {
              number: 3,
              status: 'completed',
              pairings: [{ blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, result: 'B+' }],
              byes: [],
            },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '5k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockCalculateStandings.mockResolvedValue({
          standings: [
            { rank: 1, player_id: 'p1', player_name: 'Alice', player_rank: '5k', wins: 1, losses: 1, sos: 1.0, sds: 0, sosos: 0 },
            { rank: 2, player_id: 'p2', player_name: 'Bob', player_rank: '5k', wins: 1, losses: 1, sos: 1.0, sds: 0, sosos: 0 },
          ],
        });

        await service.getStandings('507f1f77bcf86cd799439011', 2);

        // Should only include rounds 1 and 2
        expect(mockCalculateStandings).toHaveBeenCalledWith(
          expect.objectContaining({
            rounds: [
              expect.objectContaining({ number: 1 }),
              expect.objectContaining({ number: 2 }),
            ],
            through_round: 2,
          })
        );
      });
    });

    describe('withdrawn players', () => {
      it('should exclude withdrawn players from standings', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: true }, // Withdrawn
            { playerId: 'p3', roundsParticipating: [], withdrawn: false },
          ],
          rounds: [
            {
              number: 1,
              status: 'completed',
              pairings: [{ blackPlayerId: 'p1', whitePlayerId: 'p3', boardNumber: 1, result: 'B+' }],
              byes: [],
            },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p3', 'Charlie', '3k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockCalculateStandings.mockResolvedValue({
          standings: [
            { rank: 1, player_id: 'p1', player_name: 'Alice', player_rank: '5k', wins: 1, losses: 0, sos: 0, sds: 0, sosos: 0 },
            { rank: 2, player_id: 'p3', player_name: 'Charlie', player_rank: '3k', wins: 0, losses: 1, sos: 1, sds: 0, sosos: 0 },
          ],
        });

        await service.getStandings('507f1f77bcf86cd799439011');

        expect(mockPlayerFindMany).toHaveBeenCalledWith({
          where: { id: { in: ['p1', 'p3'] } },
        });
      });
    });

    describe('standings with byes', () => {
      it('should include bye points in standings calculation', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', roundsParticipating: [], withdrawn: false },
            { playerId: 'p2', roundsParticipating: [], withdrawn: false },
            { playerId: 'p3', roundsParticipating: [], withdrawn: false },
          ],
          rounds: [
            {
              number: 1,
              status: 'completed',
              pairings: [{ blackPlayerId: 'p1', whitePlayerId: 'p2', boardNumber: 1, result: 'B+' }],
              byes: [{ playerId: 'p3', points: 0.75 }], // Partial bye
            },
          ],
        });

        const players = [
          createPlayerData('p1', 'Alice', '5k'),
          createPlayerData('p2', 'Bob', '4k'),
          createPlayerData('p3', 'Charlie', '3k'),
        ];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockCalculateStandings.mockResolvedValue({
          standings: [
            { rank: 1, player_id: 'p1', player_name: 'Alice', player_rank: '5k', wins: 1, losses: 0, sos: 0.75, sds: 0, sosos: 0 },
            { rank: 2, player_id: 'p3', player_name: 'Charlie', player_rank: '3k', wins: 0.75, losses: 0, sos: 0, sds: 0, sosos: 0 },
            { rank: 3, player_id: 'p2', player_name: 'Bob', player_rank: '4k', wins: 0, losses: 1, sos: 1, sds: 0, sosos: 0 },
          ],
        });

        await service.getStandings('507f1f77bcf86cd799439011');

        expect(mockCalculateStandings).toHaveBeenCalledWith(
          expect.objectContaining({
            rounds: [
              expect.objectContaining({
                byes: [{ player_id: 'p3', points: 0.75 }],
              }),
            ],
          })
        );
      });
    });

    describe('standings request format', () => {
      it('should call standings API without weights', async () => {
        const tournament = createTournamentData({
          registrations: [{ playerId: 'p1', roundsParticipating: [], withdrawn: false }],
          rounds: [{ number: 1, status: 'completed', pairings: [], byes: [] }],
        });

        const players = [createPlayerData('p1', 'Alice', '5k')];

        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue(players);
        mockCalculateStandings.mockResolvedValue({
          standings: [
            { rank: 1, player_id: 'p1', player_name: 'Alice', player_rank: '5k', wins: 0, losses: 0, sos: 0, sds: 0, sosos: 0 },
          ],
        });

        await service.getStandings('507f1f77bcf86cd799439011');

        expect(mockCalculateStandings).toHaveBeenCalledWith(
          expect.objectContaining({
            players: expect.any(Array),
            rounds: expect.any(Array),
          })
        );
      });
    });

    describe('error cases', () => {
      it('should throw error for non-existent tournament', async () => {
        mockTournamentFindUnique.mockResolvedValue(null);

        await expect(service.getStandings('nonexistent')).rejects.toThrow('Tournament not found');
      });
    });

    describe('division filtering', () => {
      it('should return standings for a specific division only', async () => {
        const tournament = createTournamentData({
          divisions: [
            { id: 'div-open', name: 'Open' },
            { id: 'div-kyu', name: 'Kyu' },
          ],
          registrations: [
            { playerId: 'p1', divisionId: 'div-open', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
            { playerId: 'p2', divisionId: 'div-open', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
            { playerId: 'p3', divisionId: 'div-kyu', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
          ],
          rounds: [
            {
              number: 1,
              status: 'completed',
              pairings: [
                { blackPlayerId: 'p1', whitePlayerId: 'p3', boardNumber: 1, handicapStones: 0, komi: 7.5, result: 'B+' },
              ],
              byes: [{ playerId: 'p2', points: 1.0 }],
            },
          ],
        });
        mockTournamentFindUnique.mockResolvedValue(tournament);

        // Only Open division players (p1, p2) should be passed
        mockPlayerFindMany.mockResolvedValue([
          createPlayerData('p1', 'Alice', '3d'),
          createPlayerData('p2', 'Bob', '2d'),
        ]);

        mockCalculateStandings.mockResolvedValue({
          standings: [
            { rank: 1, player_id: 'p1', player_name: 'Alice', player_rank: '3d', wins: 1, losses: 0, sos: 0, sds: 0, sosos: 0 },
            { rank: 2, player_id: 'p2', player_name: 'Bob', player_rank: '2d', wins: 0, losses: 0, sos: 0, sds: 0, sosos: 0 },
          ],
        });

        const standings = await service.getStandings('507f1f77bcf86cd799439011', undefined, 'div-open');

        expect(standings).toHaveLength(2);
        expect(mockPlayerFindMany).toHaveBeenCalledWith({
          where: { id: { in: ['p1', 'p2'] } },
        });
      });

      it('should return all players when no divisionId specified', async () => {
        const tournament = createTournamentData({
          registrations: [
            { playerId: 'p1', divisionId: 'div-open', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
            { playerId: 'p2', divisionId: 'div-kyu', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
          ],
          rounds: [],
        });
        mockTournamentFindUnique.mockResolvedValue(tournament);
        mockPlayerFindMany.mockResolvedValue([
          createPlayerData('p1', 'Alice', '3d'),
          createPlayerData('p2', 'Bob', '5k'),
        ]);
        mockCalculateStandings.mockResolvedValue({ standings: [] });

        await service.getStandings('507f1f77bcf86cd799439011');

        expect(mockPlayerFindMany).toHaveBeenCalledWith({
          where: { id: { in: ['p1', 'p2'] } },
        });
      });
    });
  });

  // ==================== Divisions ====================

  describe('addDivision', () => {
    it('should add a division to the tournament', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue(tournament);

      const division = await service.addDivision('507f1f77bcf86cd799439011', {
        name: 'Open',
        description: 'Dan players',
      });

      expect(division).not.toBeNull();
      expect(division!.name).toBe('Open');
      expect(division!.description).toBe('Dan players');
      expect(division!.id).toBeDefined();
      expect(mockTournamentUpdate).toHaveBeenCalledWith({
        where: { id: '507f1f77bcf86cd799439011' },
        data: { divisions: [expect.objectContaining({ name: 'Open', description: 'Dan players' })] },
      });
    });

    it('should return null for non-existent tournament', async () => {
      mockTournamentFindUnique.mockResolvedValue(null);

      const division = await service.addDivision('nonexistent', { name: 'Open' });

      expect(division).toBeNull();
    });
  });

  describe('updateDivision', () => {
    it('should update a division name', async () => {
      const tournament = createTournamentData({
        divisions: [{ id: 'div-1', name: 'Open', description: null }],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue(tournament);

      const division = await service.updateDivision('507f1f77bcf86cd799439011', 'div-1', { name: 'Open Division' });

      expect(division).not.toBeNull();
      expect(division!.name).toBe('Open Division');
      expect(mockTournamentUpdate).toHaveBeenCalled();
    });

    it('should return null for non-existent tournament', async () => {
      mockTournamentFindUnique.mockResolvedValue(null);

      const division = await service.updateDivision('nonexistent', 'div-1', { name: 'Open' });

      expect(division).toBeNull();
    });

    it('should return null for non-existent division', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);

      const division = await service.updateDivision('507f1f77bcf86cd799439011', 'nonexistent', { name: 'Open' });

      expect(division).toBeNull();
    });
  });

  describe('removeDivision', () => {
    it('should remove a division from the tournament', async () => {
      const tournament = createTournamentData({
        divisions: [
          { id: 'div-1', name: 'Open', description: null },
          { id: 'div-2', name: 'Kyu', description: null },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue(tournament);

      const result = await service.removeDivision('507f1f77bcf86cd799439011', 'div-1');

      expect(result).toBe(true);
      expect(mockTournamentUpdate).toHaveBeenCalledWith({
        where: { id: '507f1f77bcf86cd799439011' },
        data: { divisions: [{ id: 'div-2', name: 'Kyu', description: null }] },
      });
    });

    it('should return false for non-existent tournament', async () => {
      mockTournamentFindUnique.mockResolvedValue(null);

      const result = await service.removeDivision('nonexistent', 'div-1');

      expect(result).toBe(false);
    });

    it('should return false for non-existent division', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);

      const result = await service.removeDivision('507f1f77bcf86cd799439011', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== Per-Division Pairing ====================

  describe('generatePairings with crossDivisionPairing=false', () => {
    it('should pair each division separately', async () => {
      const tournament = createTournamentData({
        settings: {
          numRounds: 4,
          pairingAlgorithm: 'swiss',
          handicapType: 'rank_difference',
          handicapModifier: 'none',
          mcmahonBar: null,
          crossDivisionPairing: false,
        },
        divisions: [
          { id: 'div-open', name: 'Open' },
          { id: 'div-kyu', name: 'Kyu' },
        ],
        registrations: [
          { playerId: 'p1', divisionId: 'div-open', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
          { playerId: 'p2', divisionId: 'div-open', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
          { playerId: 'p3', divisionId: 'div-kyu', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
          { playerId: 'p4', divisionId: 'div-kyu', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);

      mockPlayerFindMany.mockResolvedValue([
        createPlayerData('p1', 'Alice', '3d'),
        createPlayerData('p2', 'Bob', '2d'),
        createPlayerData('p3', 'Charlie', '5k'),
        createPlayerData('p4', 'Diana', '3k'),
      ]);

      // First call for div-open players, second call for div-kyu players
      mockGeneratePairings
        .mockResolvedValueOnce({
          pairings: [{ black_player_id: 'p1', white_player_id: 'p2', board_number: 1, handicap_stones: 0, komi: 7.5 }],
          byes: [],
          warnings: [],
        })
        .mockResolvedValueOnce({
          pairings: [{ black_player_id: 'p3', white_player_id: 'p4', board_number: 1, handicap_stones: 2, komi: 0.5 }],
          byes: [],
          warnings: [],
        });

      mockTournamentUpdate.mockResolvedValue(tournament);

      const round = await service.generatePairings('507f1f77bcf86cd799439011', 1);

      // Should have called generatePairings twice (once per division)
      expect(mockGeneratePairings).toHaveBeenCalledTimes(2);

      // Pairings should be merged with offset board numbers
      expect(round.pairings).toHaveLength(2);
      expect(round.pairings[0].boardNumber).toBe(1);
      expect(round.pairings[1].boardNumber).toBe(2);
    });

    it('should use cross-division pairing when crossDivisionPairing=true (default)', async () => {
      const tournament = createTournamentData({
        divisions: [
          { id: 'div-open', name: 'Open' },
          { id: 'div-kyu', name: 'Kyu' },
        ],
        registrations: [
          { playerId: 'p1', divisionId: 'div-open', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
          { playerId: 'p2', divisionId: 'div-kyu', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });
      mockTournamentFindUnique.mockResolvedValue(tournament);

      mockPlayerFindMany.mockResolvedValue([
        createPlayerData('p1', 'Alice', '3d'),
        createPlayerData('p2', 'Bob', '5k'),
      ]);

      mockGeneratePairings.mockResolvedValue({
        pairings: [{ black_player_id: 'p2', white_player_id: 'p1', board_number: 1, handicap_stones: 8, komi: 0.5 }],
        byes: [],
        warnings: [],
      });

      mockTournamentUpdate.mockResolvedValue(tournament);

      const round = await service.generatePairings('507f1f77bcf86cd799439011', 1);

      // Should call generatePairings once with all players
      expect(mockGeneratePairings).toHaveBeenCalledTimes(1);
      expect(round.pairings).toHaveLength(1);
    });
  });

  // ==================== Register Player with Division ====================

  describe('registerPlayer with divisionId', () => {
    it('should register player with divisionId', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue({
        ...tournament,
        registrations: [
          { playerId: 'p1', divisionId: 'div-open', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });

      const result = await service.registerPlayer('507f1f77bcf86cd799439011', 'p1', [], 'div-open');

      expect(result).not.toBeNull();
      expect(mockTournamentUpdate).toHaveBeenCalledWith({
        where: { id: '507f1f77bcf86cd799439011' },
        data: {
          registrations: [
            expect.objectContaining({ playerId: 'p1', divisionId: 'div-open', withdrawn: false }),
          ],
        },
      });
    });

    it('should register player without divisionId', async () => {
      const tournament = createTournamentData();
      mockTournamentFindUnique.mockResolvedValue(tournament);
      mockTournamentUpdate.mockResolvedValue({
        ...tournament,
        registrations: [
          { playerId: 'p1', roundsParticipating: [], registeredAt: new Date(), withdrawn: false },
        ],
      });

      const result = await service.registerPlayer('507f1f77bcf86cd799439011', 'p1', []);

      expect(result).not.toBeNull();
      expect(mockTournamentUpdate).toHaveBeenCalledWith({
        where: { id: '507f1f77bcf86cd799439011' },
        data: {
          registrations: [
            expect.objectContaining({ playerId: 'p1', divisionId: undefined }),
          ],
        },
      });
    });
  });
});
