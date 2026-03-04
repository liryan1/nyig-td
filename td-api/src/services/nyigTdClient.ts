import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';

// Request types matching nyig-td-api
export interface PlayerInput {
  id: string;
  name: string;
  rank: string;
  club?: string;
  aga_id?: string;
  rating?: number;
  rounds_participating?: number[];
  initial_mcmahon_score?: number;
}

export interface PairingInput {
  black_player_id: string;
  white_player_id: string;
  result: string;
}

export interface ByeInput {
  player_id: string;
  points: number;
}

export interface RoundInput {
  number: number;
  pairings: PairingInput[];
  byes: ByeInput[];
}

export interface PairingRequest {
  players: PlayerInput[];
  previous_rounds: RoundInput[];
  round_number: number;
  algorithm: string;
  mcmahon_bar?: string;
  handicap_type: string;
  handicap_modifier: string;
}

export interface PairingOutput {
  black_player_id: string;
  white_player_id: string;
  board_number: number;
  handicap_stones: number;
  komi: number;
}

export interface ByeOutput {
  player_id: string;
  points: number;
}

export interface PairingResponse {
  pairings: PairingOutput[];
  byes: ByeOutput[];
  warnings: string[];
}

export interface StandingsRequest {
  players: PlayerInput[];
  rounds: RoundInput[];
  through_round?: number;
}

export interface PlayerStandingOutput {
  rank: number;
  player_id: string;
  player_name: string;
  player_rank: string;
  wins: number;
  losses: number;
  sos: number;
  sds: number;
  sosos: number;
}

export interface StandingsResponse {
  standings: PlayerStandingOutput[];
}

export interface HandicapResponse {
  stones: number;
  komi: number;
  description: string;
}

export interface RankValidationResult {
  rank: string;
  valid: boolean;
  normalized?: string;
  error?: string;
}

export interface RankValidationResponse {
  results: RankValidationResult[];
  all_valid: boolean;
}

export class NyigTdClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = config.nyigTdApiUrl) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async generatePairings(request: PairingRequest): Promise<PairingResponse> {
    const response = await this.client.post<PairingResponse>('/pair', request);
    return response.data;
  }

  async calculateStandings(request: StandingsRequest): Promise<StandingsResponse> {
    const response = await this.client.post<StandingsResponse>('/standings', request);
    return response.data;
  }

  async calculateHandicap(
    whiteRank: string,
    blackRank: string,
    handicapType: string = 'rank_difference',
    handicapModifier: string = 'none'
  ): Promise<HandicapResponse> {
    const response = await this.client.post<HandicapResponse>('/handicap', {
      white_rank: whiteRank,
      black_rank: blackRank,
      handicap_type: handicapType,
      handicap_modifier: handicapModifier,
    });
    return response.data;
  }

  async validateRanks(ranks: string[]): Promise<RankValidationResponse> {
    const response = await this.client.post<RankValidationResponse>('/validate/ranks', { ranks });
    return response.data;
  }
}

export const nyigTdClient = new NyigTdClient();
