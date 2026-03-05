import axios from 'axios';
import type {
  Player,
  Tournament,
  PlayerStanding,
  CreatePlayerForm,
  CreateTournamentForm,
  GameResult,
  Round,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Backend uses Go notation ('B+', 'W+', 'NR'), frontend uses descriptive names ('black_wins', etc.)
const RESULT_TO_BACKEND: Record<GameResult, string> = {
  black_wins: 'B+',
  white_wins: 'W+',
  black_forfeit: 'B+F',
  white_forfeit: 'W+F',
  draw: 'Draw',
  no_result: 'NR',
  double_forfeit: 'BL',
};

const RESULT_FROM_BACKEND: Record<string, GameResult> = Object.fromEntries(
  Object.entries(RESULT_TO_BACKEND).map(([k, v]) => [v, k as GameResult])
) as Record<string, GameResult>;

function convertTournamentResults(tournament: Tournament): Tournament {
  return {
    ...tournament,
    rounds: tournament.rounds.map(convertRoundResults),
  };
}

function convertRoundResults(round: Round): Round {
  return {
    ...round,
    pairings: round.pairings.map((p) => ({
      ...p,
      result: (RESULT_FROM_BACKEND[p.result] ?? p.result) as GameResult,
    })),
  };
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Convert backend result format to frontend format in all responses
api.interceptors.response.use((response) => {
  const data = response.data;
  if (data?.tournament) {
    data.tournament = convertTournamentResults(data.tournament);
  }
  if (data?.tournaments) {
    data.tournaments = data.tournaments.map(convertTournamentResults);
  }
  if (data?.round) {
    data.round = convertRoundResults(data.round);
  }
  return response;
});

// ========== Players ==========

export async function listPlayers(params?: { search?: string; limit?: number }): Promise<Player[]> {
  const response = await api.get<{ players: Player[] }>('/players', { params });
  return response.data.players;
}

export async function getPlayer(id: string): Promise<Player> {
  const response = await api.get<{ player: Player }>(`/players/${id}`);
  return response.data.player;
}

export async function createPlayer(data: CreatePlayerForm): Promise<Player> {
  const response = await api.post<{ player: Player }>('/players', data);
  return response.data.player;
}

export async function updatePlayer(id: string, data: Partial<CreatePlayerForm>): Promise<Player> {
  const response = await api.patch<{ player: Player }>(`/players/${id}`, data);
  return response.data.player;
}

export async function deletePlayer(id: string): Promise<void> {
  await api.delete(`/players/${id}`);
}

// ========== Tournaments ==========

export async function listTournaments(params?: { status?: string }): Promise<Tournament[]> {
  const response = await api.get<{ tournaments: Tournament[] }>('/tournaments', { params });
  return response.data.tournaments;
}

export async function getTournament(id: string): Promise<Tournament> {
  const response = await api.get<{ tournament: Tournament }>(`/tournaments/${id}`);
  return response.data.tournament;
}

export async function createTournament(data: CreateTournamentForm): Promise<Tournament> {
  const response = await api.post<{ tournament: Tournament }>('/tournaments', data);
  return response.data.tournament;
}

export async function updateTournament(
  id: string,
  data: Partial<CreateTournamentForm & { status?: string }>
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(`/tournaments/${id}`, data);
  return response.data.tournament;
}

export async function deleteTournament(id: string): Promise<void> {
  await api.delete(`/tournaments/${id}`);
}

// ========== Registration ==========

export async function registerPlayer(
  tournamentId: string,
  playerId: string,
  roundsParticipating?: number[],
  divisionId?: string
): Promise<Tournament> {
  const response = await api.post<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/registrations`,
    { playerId, roundsParticipating, divisionId }
  );
  return response.data.tournament;
}

export async function updatePlayerRounds(
  tournamentId: string,
  playerId: string,
  roundsParticipating: number[]
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/registrations/${playerId}`,
    { roundsParticipating }
  );
  return response.data.tournament;
}

export async function updateRegistration(
  tournamentId: string,
  playerId: string,
  data: { roundsParticipating?: number[]; divisionId?: string | null }
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/registrations/${playerId}`,
    data
  );
  return response.data.tournament;
}

export async function bulkUpdateRegistrations(
  tournamentId: string,
  updates: Array<{ playerId: string; roundsParticipating?: number[]; checkedIn?: boolean; withdrawn?: boolean }>
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/registrations/bulk`,
    { updates }
  );
  return response.data.tournament;
}

export async function withdrawPlayer(tournamentId: string, playerId: string): Promise<Tournament> {
  const response = await api.delete<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/registrations/${playerId}`
  );
  return response.data.tournament;
}

export async function bulkRegisterPlayers(
  tournamentId: string,
  players: Array<{ name: string; agaId: string; rank: string; club?: string; email?: string }>
): Promise<{ tournament: Tournament; created: Player[]; alreadyRegistered: string[] }> {
  const response = await api.post<{ tournament: Tournament; created: Player[]; alreadyRegistered: string[] }>(
    `/tournaments/${tournamentId}/registrations/bulk`,
    { players }
  );
  return response.data;
}

// ========== Rounds ==========

export async function generatePairings(tournamentId: string, roundNumber: number): Promise<Round> {
  const response = await api.post<{ round: Round }>(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/pair`
  );
  return response.data.round;
}

export async function unpairMatch(
  tournamentId: string,
  roundNumber: number,
  boardNumber: number
): Promise<Round> {
  const response = await api.delete<{ round: Round }>(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/pairings/${boardNumber}`
  );
  return response.data.round;
}

export async function unpairAll(
  tournamentId: string,
  roundNumber: number
): Promise<Round> {
  const response = await api.delete<{ round: Round }>(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/pairings`
  );
  return response.data.round;
}

export async function manualPair(
  tournamentId: string,
  roundNumber: number,
  player1Id: string,
  player2Id: string
): Promise<Round> {
  const response = await api.post<{ round: Round }>(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/pairings`,
    { player1Id, player2Id }
  );
  return response.data.round;
}

export async function recordResult(
  tournamentId: string,
  roundNumber: number,
  boardNumber: number,
  result: GameResult
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/boards/${boardNumber}`,
    { result: RESULT_TO_BACKEND[result] ?? result }
  );
  return response.data.tournament;
}

export async function publishRound(
  tournamentId: string,
  roundNumber: number,
  published: boolean
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/rounds/${roundNumber}/publish`,
    { published }
  );
  return response.data.tournament;
}

export async function getPublicTournament(
  id: string
): Promise<{ tournament: Tournament; standings: PlayerStanding[] }> {
  const response = await api.get<{ tournament: Tournament; standings: PlayerStanding[] }>(
    `/tournaments/${id}/public`
  );
  return response.data;
}

// ========== Check-In ==========

export async function checkInPlayer(
  tournamentId: string,
  playerId: string,
  checkedIn: boolean
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/registrations/${playerId}/checkin`,
    { checkedIn }
  );
  return response.data.tournament;
}

export async function bulkCheckInPlayers(
  tournamentId: string,
  playerIds: string[]
): Promise<Tournament> {
  const response = await api.post<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/registrations/checkin/bulk`,
    { playerIds }
  );
  return response.data.tournament;
}

export async function selfCheckIn(
  tournamentId: string,
  playerId: string
): Promise<{ playerName: string; checkedIn: boolean }> {
  const response = await api.post<{ playerName: string; checkedIn: boolean }>(
    `/tournaments/${tournamentId}/checkin`,
    { playerId }
  );
  return response.data;
}

// ========== Divisions ==========

export async function addDivision(
  tournamentId: string,
  data: { name: string; description?: string }
): Promise<Tournament> {
  const response = await api.post<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/divisions`,
    data
  );
  return response.data.tournament;
}

export async function updateDivision(
  tournamentId: string,
  divisionId: string,
  data: { name?: string; description?: string }
): Promise<Tournament> {
  const response = await api.patch<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/divisions/${divisionId}`,
    data
  );
  return response.data.tournament;
}

export async function removeDivision(
  tournamentId: string,
  divisionId: string
): Promise<Tournament> {
  const response = await api.delete<{ tournament: Tournament }>(
    `/tournaments/${tournamentId}/divisions/${divisionId}`
  );
  return response.data.tournament;
}

// ========== Standings ==========

export async function getStandings(
  tournamentId: string,
  throughRound?: number
): Promise<PlayerStanding[]> {
  const params = throughRound ? { throughRound } : undefined;
  const response = await api.get<{ standings: PlayerStanding[] }>(
    `/tournaments/${tournamentId}/standings`,
    { params }
  );
  return response.data.standings;
}

export async function getDivisionStandings(
  tournamentId: string,
  divisionId: string,
  throughRound?: number
): Promise<PlayerStanding[]> {
  const params = throughRound ? { throughRound } : undefined;
  const response = await api.get<{ standings: PlayerStanding[] }>(
    `/tournaments/${tournamentId}/divisions/${divisionId}/standings`,
    { params }
  );
  return response.data.standings;
}
