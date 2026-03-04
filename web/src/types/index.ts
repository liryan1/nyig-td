// Enums and type aliases
export type PairingAlgorithm = 'swiss' | 'mcmahon' | 'round_robin';
export type GameResult = 'black_wins' | 'white_wins' | 'draw' | 'no_result' | 'black_forfeit' | 'white_forfeit' | 'double_forfeit';
export type TournamentStatus = 'upcoming' | 'in_progress' | 'completed';
export type RoundStatus = 'pending' | 'paired' | 'completed';

export type HandicapType = 'none' | 'rank_difference';
export type HandicapModifier = 'none' | 'minus_1' | 'minus_2';

export interface Division {
  id: string;
  name: string;
  description?: string;
}

export interface TournamentSettings {
  numRounds: number;
  pairingAlgorithm: PairingAlgorithm;
  handicapType: HandicapType;
  handicapModifier: HandicapModifier;
  mcmahonBar?: string;
  crossDivisionPairing: boolean;
}

export interface Player {
  _id: string;
  name: string;
  rank: string;
  club?: string;
  agaId?: string;
  rating?: number;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerRegistration {
  playerId: string | Player;
  divisionId?: string;
  roundsParticipating: number[];
  registeredAt: string;
  withdrawn: boolean;
}

export interface Pairing {
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
  pairings: Pairing[];
  byes: Bye[];
  pairedAt?: string;
  completedAt?: string;
}

export interface Tournament {
  _id: string;
  name: string;
  description?: string;
  date: string;
  location?: string;
  status: TournamentStatus;
  settings: TournamentSettings;
  divisions: Division[];
  registrations: PlayerRegistration[];
  rounds: Round[];
  createdAt: string;
  updatedAt: string;
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

// Form types
export interface CreatePlayerForm {
  name: string;
  rank: string;
  club?: string;
  agaId?: string;
  email?: string;
}

export interface CreateTournamentForm {
  name: string;
  description?: string;
  date: string;
  location?: string;
  settings: {
    numRounds: number;
    pairingAlgorithm: PairingAlgorithm;
    handicapType: HandicapType;
    handicapModifier: HandicapModifier;
    mcmahonBar?: string;
    crossDivisionPairing: boolean;
  };
}
