import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import axios from 'axios';
import { NyigTdClient } from '../../src/services/nyigTdClient.js';

jest.mock('axios');

describe('NyigTdClient', () => {
  let client: NyigTdClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPost: jest.Mock<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPost = jest.fn();
    (axios.create as jest.Mock).mockReturnValue({ post: mockPost });
    client = new NyigTdClient('http://localhost:8000');
  });

  describe('validateRanks', () => {
    it('should validate ranks successfully', async () => {
      mockPost.mockResolvedValue({
        data: {
          results: [
            { rank: '5k', valid: true, normalized: '5k' },
            { rank: '3d', valid: true, normalized: '3d' },
          ],
          all_valid: true,
        },
      });

      const result = await client.validateRanks(['5k', '3d']);

      expect(mockPost).toHaveBeenCalledWith('/validate/ranks', { ranks: ['5k', '3d'] });
      expect(result.all_valid).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('should return invalid for bad ranks', async () => {
      mockPost.mockResolvedValue({
        data: {
          results: [{ rank: 'invalid', valid: false, error: 'Invalid rank format' }],
          all_valid: false,
        },
      });

      const result = await client.validateRanks(['invalid']);

      expect(result.all_valid).toBe(false);
      expect(result.results[0].valid).toBe(false);
    });
  });

  describe('generatePairings', () => {
    it('should generate pairings', async () => {
      mockPost.mockResolvedValue({
        data: {
          pairings: [
            {
              black_player_id: 'player1',
              white_player_id: 'player2',
              board_number: 1,
              handicap_stones: 0,
              komi: 7.5,
            },
          ],
          byes: [],
          warnings: [],
        },
      });

      const result = await client.generatePairings({
        players: [
          { id: 'player1', name: 'Alice', rank: '5k' },
          { id: 'player2', name: 'Bob', rank: '5k' },
        ],
        previous_rounds: [],
        round_number: 1,
        algorithm: 'mcmahon',
        handicap_enabled: true,
        handicap_reduction: 0,
      });

      expect(result.pairings).toHaveLength(1);
      expect(result.pairings[0].black_player_id).toBe('player1');
    });

    it('should include bye for odd number of players', async () => {
      mockPost.mockResolvedValue({
        data: {
          pairings: [
            {
              black_player_id: 'player1',
              white_player_id: 'player2',
              board_number: 1,
              handicap_stones: 0,
              komi: 7.5,
            },
          ],
          byes: [{ player_id: 'player3', points: 1.0 }],
          warnings: [],
        },
      });

      const result = await client.generatePairings({
        players: [
          { id: 'player1', name: 'Alice', rank: '5k' },
          { id: 'player2', name: 'Bob', rank: '5k' },
          { id: 'player3', name: 'Charlie', rank: '5k' },
        ],
        previous_rounds: [],
        round_number: 1,
        algorithm: 'mcmahon',
        handicap_enabled: true,
        handicap_reduction: 0,
      });

      expect(result.byes).toHaveLength(1);
      expect(result.byes[0].player_id).toBe('player3');
    });
  });

  describe('calculateStandings', () => {
    it('should calculate standings', async () => {
      mockPost.mockResolvedValue({
        data: {
          standings: [
            {
              rank: 1,
              player_id: 'player1',
              player_name: 'Alice',
              player_rank: '5k',
              wins: 3,
              losses: 0,
              sos: 2.5,
              sodos: 1.5,
              extended_sos: 0,
              total_score: 3.35,
            },
          ],
        },
      });

      const result = await client.calculateStandings({
        players: [{ id: 'player1', name: 'Alice', rank: '5k' }],
        rounds: [],
        weights: { wins: 1, sos: 0.1, sodos: 0.05, extended_sos: 0 },
      });

      expect(result.standings).toHaveLength(1);
      expect(result.standings[0].wins).toBe(3);
    });
  });

  describe('calculateHandicap', () => {
    it('should calculate handicap between ranks', async () => {
      mockPost.mockResolvedValue({
        data: {
          stones: 3,
          komi: 0.5,
          description: '3 stones, 0.5 komi',
        },
      });

      const result = await client.calculateHandicap('2k', '5k', 0);

      expect(mockPost).toHaveBeenCalledWith('/handicap', {
        white_rank: '2k',
        black_rank: '5k',
        reduction: 0,
      });
      expect(result.stones).toBe(3);
      expect(result.komi).toBe(0.5);
    });

    it('should use default reduction of 0 when not provided', async () => {
      mockPost.mockResolvedValue({
        data: {
          stones: 2,
          komi: 0.5,
          description: '2 stones, 0.5 komi',
        },
      });

      const result = await client.calculateHandicap('1k', '3k');

      expect(mockPost).toHaveBeenCalledWith('/handicap', {
        white_rank: '1k',
        black_rank: '3k',
        reduction: 0,
      });
      expect(result.stones).toBe(2);
    });
  });
});
