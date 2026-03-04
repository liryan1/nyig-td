import {
  createPlayerSchema,
  updatePlayerSchema,
  createTournamentSchema,
  updateTournamentSchema,
  registerPlayerSchema,
  recordResultSchema,
  rankSchema,
  createDivisionSchema,
  updateDivisionSchema,
} from '../../src/utils/validation.js';

describe('Validation Schemas', () => {
  describe('rankSchema', () => {
    it('should accept valid kyu ranks', () => {
      expect(rankSchema.safeParse('5k').success).toBe(true);
      expect(rankSchema.safeParse('30k').success).toBe(true);
      expect(rankSchema.safeParse('1K').success).toBe(true);
    });

    it('should accept valid dan ranks', () => {
      expect(rankSchema.safeParse('1d').success).toBe(true);
      expect(rankSchema.safeParse('9D').success).toBe(true);
    });

    it('should reject invalid ranks', () => {
      expect(rankSchema.safeParse('5').success).toBe(false);
      expect(rankSchema.safeParse('kyu').success).toBe(false);
      expect(rankSchema.safeParse('5kyu').success).toBe(false);
      expect(rankSchema.safeParse('').success).toBe(false);
    });
  });

  describe('createPlayerSchema', () => {
    it('should accept valid player data', () => {
      const result = createPlayerSchema.safeParse({
        name: 'John Doe',
        rank: '5k',
        club: 'NYC Go Club',
        agaId: '12345',
        email: 'john@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createPlayerSchema.safeParse({
        rank: '5k',
      });
      expect(result.success).toBe(false);
    });

    it('should require rank', () => {
      const result = createPlayerSchema.safeParse({
        name: 'John Doe',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = createPlayerSchema.safeParse({
        name: 'John Doe',
        rank: '5k',
        agaId: '12345',
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updatePlayerSchema', () => {
    it('should allow partial updates', () => {
      expect(updatePlayerSchema.safeParse({ name: 'Jane' }).success).toBe(true);
      expect(updatePlayerSchema.safeParse({ rank: '3d' }).success).toBe(true);
      expect(updatePlayerSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('createTournamentSchema', () => {
    it('should accept valid tournament data', () => {
      const result = createTournamentSchema.safeParse({
        name: 'Spring Tournament',
        date: '2026-04-15',
        settings: {
          numRounds: 4,
          pairingAlgorithm: 'mcmahon',
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
      }
    });

    it('should reject invalid numRounds', () => {
      const result = createTournamentSchema.safeParse({
        name: 'Test',
        date: '2026-04-15',
        settings: {
          numRounds: 0,
        },
      });
      expect(result.success).toBe(false);
    });

    it('should reject numRounds > 10', () => {
      const result = createTournamentSchema.safeParse({
        name: 'Test',
        date: '2026-04-15',
        settings: {
          numRounds: 15,
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateTournamentSchema', () => {
    it('should allow partial updates', () => {
      expect(updateTournamentSchema.safeParse({ name: 'New Name' }).success).toBe(true);
      expect(updateTournamentSchema.safeParse({ description: 'Description' }).success).toBe(true);
      expect(updateTournamentSchema.safeParse({}).success).toBe(true);
    });

    it('should transform date string to Date object', () => {
      const result = updateTournamentSchema.safeParse({ date: '2026-05-20' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
      }
    });

    it('should accept valid status updates', () => {
      expect(updateTournamentSchema.safeParse({ status: 'setup' }).success).toBe(true);
      expect(updateTournamentSchema.safeParse({ status: 'registration' }).success).toBe(true);
      expect(updateTournamentSchema.safeParse({ status: 'in_progress' }).success).toBe(true);
      expect(updateTournamentSchema.safeParse({ status: 'completed' }).success).toBe(true);
    });

    it('should reject invalid status', () => {
      expect(updateTournamentSchema.safeParse({ status: 'invalid' }).success).toBe(false);
    });
  });

  describe('registerPlayerSchema', () => {
    it('should accept valid registration', () => {
      const result = registerPlayerSchema.safeParse({
        playerId: '507f1f77bcf86cd799439011',
        roundsParticipating: [1, 2, 3],
      });
      expect(result.success).toBe(true);
    });

    it('should default roundsParticipating to empty array', () => {
      const result = registerPlayerSchema.safeParse({
        playerId: '507f1f77bcf86cd799439011',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.roundsParticipating).toEqual([]);
      }
    });
  });

  describe('recordResultSchema', () => {
    it('should accept valid results', () => {
      expect(recordResultSchema.safeParse({ result: 'B+' }).success).toBe(true);
      expect(recordResultSchema.safeParse({ result: 'W+' }).success).toBe(true);
      expect(recordResultSchema.safeParse({ result: 'B+F' }).success).toBe(true);
      expect(recordResultSchema.safeParse({ result: 'W+F' }).success).toBe(true);
      expect(recordResultSchema.safeParse({ result: 'Draw' }).success).toBe(true);
      expect(recordResultSchema.safeParse({ result: 'NR' }).success).toBe(true);
      expect(recordResultSchema.safeParse({ result: 'BL' }).success).toBe(true);
    });

    it('should reject invalid results', () => {
      expect(recordResultSchema.safeParse({ result: 'invalid' }).success).toBe(false);
      expect(recordResultSchema.safeParse({ result: '' }).success).toBe(false);
    });
  });

  describe('createDivisionSchema', () => {
    it('should accept valid division data', () => {
      const result = createDivisionSchema.safeParse({ name: 'Open Division', description: 'For dan players' });
      expect(result.success).toBe(true);
    });

    it('should accept division without description', () => {
      const result = createDivisionSchema.safeParse({ name: 'Kyu' });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createDivisionSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject name over 100 chars', () => {
      const result = createDivisionSchema.safeParse({ name: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('should reject description over 500 chars', () => {
      const result = createDivisionSchema.safeParse({ name: 'Open', description: 'a'.repeat(501) });
      expect(result.success).toBe(false);
    });
  });

  describe('updateDivisionSchema', () => {
    it('should allow partial updates', () => {
      expect(updateDivisionSchema.safeParse({ name: 'New Name' }).success).toBe(true);
      expect(updateDivisionSchema.safeParse({ description: 'New desc' }).success).toBe(true);
      expect(updateDivisionSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('registerPlayerSchema with divisionId', () => {
    it('should accept registration with divisionId', () => {
      const result = registerPlayerSchema.safeParse({
        playerId: '507f1f77bcf86cd799439011',
        divisionId: 'div-open',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.divisionId).toBe('div-open');
      }
    });

    it('should accept registration without divisionId', () => {
      const result = registerPlayerSchema.safeParse({
        playerId: '507f1f77bcf86cd799439011',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.divisionId).toBeUndefined();
      }
    });
  });

  describe('tournamentSettingsSchema with crossDivisionPairing', () => {
    it('should default crossDivisionPairing to true', () => {
      const result = createTournamentSchema.safeParse({
        name: 'Test',
        date: '2026-04-15',
        settings: { numRounds: 4 },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.settings.crossDivisionPairing).toBe(true);
      }
    });

    it('should accept crossDivisionPairing=false', () => {
      const result = createTournamentSchema.safeParse({
        name: 'Test',
        date: '2026-04-15',
        settings: { numRounds: 4, crossDivisionPairing: false },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.settings.crossDivisionPairing).toBe(false);
      }
    });
  });
});
