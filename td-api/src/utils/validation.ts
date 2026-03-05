import { z } from 'zod';

export const rankSchema = z.string().regex(/^\d+[kdKD]$/, 'Invalid rank format (e.g., 5k, 3d)');

export const createPlayerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  rank: rankSchema,
  club: z.string().max(100).optional(),
  agaId: z.string().min(1).max(20),
  rating: z.number().int().optional(),
  email: z.string().email().optional(),
});

export const updatePlayerSchema = createPlayerSchema.partial();

const tiebreakerCriteriaEnum = z.enum(['wins', 'sos', 'sds', 'sosos', 'hth']);

export const tournamentSettingsSchema = z.object({
  numRounds: z.number().int().min(1).max(10),
  pairingAlgorithm: z.enum(['swiss', 'mcmahon']).default('mcmahon'),
  handicapType: z.enum(['none', 'rank_difference']).default('rank_difference'),
  handicapModifier: z.enum(['none', 'minus_1', 'minus_2']).default('none'),
  mcmahonBar: rankSchema.optional(),
  crossDivisionPairing: z.boolean().default(true),
  tiebreakerOrder: z.array(tiebreakerCriteriaEnum).min(1).max(4).default(['wins', 'sos', 'sds', 'hth']),
});

export const createTournamentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  date: z.string().transform((s) => new Date(s)),
  location: z.string().max(200).optional(),
  settings: tournamentSettingsSchema,
});

export const updateTournamentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  date: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  location: z.string().max(200).optional(),
  status: z.enum(['setup', 'registration', 'in_progress', 'completed']).optional(),
  settings: tournamentSettingsSchema.partial().optional(),
});

export const registerPlayerSchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
  divisionId: z.string().optional(),
  roundsParticipating: z.array(z.number().int().positive()).optional().default([]),
});

export const updateRegistrationSchema = z.object({
  roundsParticipating: z.array(z.number().int().positive()).optional().default([]),
  divisionId: z.string().nullable().optional(),
});

export const recordResultSchema = z.object({
  result: z.enum(['B+', 'W+', 'B+F', 'W+F', 'Draw', 'NR', 'BL']),
});

export const bulkRegisterSchema = z.object({
  players: z.array(
    z.object({
      name: z.string().min(1, 'Name is required').max(100),
      agaId: z.string().min(1).max(20),
      rank: rankSchema,
      club: z.string().max(100).optional(),
      email: z.string().email().optional(),
    })
  ).min(1, 'At least one player is required'),
});

export const publishRoundSchema = z.object({
  published: z.boolean(),
});

export const manualPairSchema = z.object({
  player1Id: z.string().min(1),
  player2Id: z.string().min(1),
});

export const createDivisionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
});

export const updateDivisionSchema = createDivisionSchema.partial();

export const checkInSchema = z.object({
  checkedIn: z.boolean(),
});

export const selfCheckInSchema = z.object({
  playerId: z.string().min(1),
});

export const bulkCheckInSchema = z.object({
  playerIds: z.array(z.string().min(1)).min(1),
});

export const bulkUpdateRegistrationsSchema = z.object({
  updates: z.array(
    z.object({
      playerId: z.string().min(1),
      roundsParticipating: z.array(z.number().int().positive()).optional(),
      checkedIn: z.boolean().optional(),
      withdrawn: z.boolean().optional(),
    })
  ).min(1),
});

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type RegisterPlayerInput = z.infer<typeof registerPlayerSchema>;
export type RecordResultInput = z.infer<typeof recordResultSchema>;
export type BulkRegisterInput = z.infer<typeof bulkRegisterSchema>;
