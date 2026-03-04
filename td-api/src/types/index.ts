export type PairingAlgorithm = 'swiss' | 'mcmahon';

export type GameResult = 'B+' | 'W+' | 'B+F' | 'W+F' | 'Draw' | 'NR' | 'BL';

export type TournamentStatus = 'setup' | 'registration' | 'in_progress' | 'completed';

export type RoundStatus = 'pending' | 'paired' | 'in_progress' | 'completed';

export type HandicapType = 'none' | 'rank_difference';

export type HandicapModifier = 'none' | 'minus_1' | 'minus_2';

export type TiebreakerCriteria = 'wins' | 'sos' | 'sds' | 'sosos' | 'hth';

export interface TournamentSettings {
  numRounds: number;
  pairingAlgorithm: PairingAlgorithm;
  handicapType: HandicapType;
  handicapModifier: HandicapModifier;
  mcmahonBar?: string;
  crossDivisionPairing: boolean;
  tiebreakerOrder: TiebreakerCriteria[];
}

export interface Division {
  id: string;
  name: string;
  description?: string;
}

export interface PlayerRegistration {
  playerId: string;
  divisionId?: string;
  roundsParticipating: number[];
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

export interface Player {
  id: string;
  name: string;
  rank: string;
  club?: string;
  agaId: string;
  rating?: number;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  date: Date;
  location?: string;
  status: TournamentStatus;
  settings: TournamentSettings;
  divisions: Division[];
  registrations: PlayerRegistration[];
  rounds: Round[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerStanding {
  rank: number;
  playerId: string;
  playerName: string;
  playerRank: string;
  wins: number;
  losses: number;
  sos: number;
  sds: number;
  sosos: number;
}
