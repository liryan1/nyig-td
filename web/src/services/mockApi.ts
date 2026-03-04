import type {
  Player,
  Tournament,
  Division,
  PlayerStanding,
  CreatePlayerForm,
  CreateTournamentForm,
  GameResult,
  Round,
} from '@/types';
import { mockPlayers, mockTournaments, mockStandings } from './mockData';

// In-memory data store (mutable copies)
let players = [...mockPlayers];
let tournaments = structuredClone(mockTournaments);
let standings = structuredClone(mockStandings);

// Simulate network delay
const delay = (ms: number = 200) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// ========== Players ==========

export async function listPlayers(params?: { search?: string; limit?: number }): Promise<Player[]> {
  await delay();
  let result = [...players];

  if (params?.search) {
    const search = params.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.rank.toLowerCase().includes(search) ||
        p.club?.toLowerCase().includes(search)
    );
  }

  if (params?.limit) {
    result = result.slice(0, params.limit);
  }

  return result;
}

export async function getPlayer(id: string): Promise<Player> {
  await delay();
  const player = players.find((p) => p.id === id);
  if (!player) throw new Error('Player not found');
  return player;
}

export async function createPlayer(data: CreatePlayerForm): Promise<Player> {
  await delay(300);
  const newPlayer: Player = {
    id: `p${generateId()}`,
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  players.push(newPlayer);
  return newPlayer;
}

export async function updatePlayer(id: string, data: Partial<CreatePlayerForm>): Promise<Player> {
  await delay(300);
  const index = players.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Player not found');

  players[index] = {
    ...players[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  return players[index];
}

export async function deletePlayer(id: string): Promise<void> {
  await delay(300);
  const index = players.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Player not found');
  players.splice(index, 1);
}

// ========== Tournaments ==========

export async function listTournaments(params?: { status?: string }): Promise<Tournament[]> {
  await delay();
  let result = [...tournaments];

  if (params?.status) {
    result = result.filter((t) => t.status === params.status);
  }

  return result;
}

export async function getTournament(id: string): Promise<Tournament> {
  await delay();
  const tournament = tournaments.find((t) => t.id === id);
  if (!tournament) throw new Error('Tournament not found');
  return structuredClone(tournament);
}

export async function createTournament(data: CreateTournamentForm): Promise<Tournament> {
  await delay(300);
  const newTournament: Tournament = {
    id: `t${generateId()}`,
    name: data.name,
    description: data.description,
    date: data.date,
    location: data.location,
    status: 'setup',
    settings: {
      numRounds: data.settings.numRounds,
      pairingAlgorithm: data.settings.pairingAlgorithm,
      handicapType: data.settings.handicapType,
      handicapModifier: data.settings.handicapModifier,
      mcmahonBar: data.settings.mcmahonBar,
      crossDivisionPairing: data.settings.crossDivisionPairing ?? true,
      tiebreakerOrder: data.settings.tiebreakerOrder ?? ['wins', 'sos', 'sds', 'hth'],
    },
    divisions: [],
    registrations: [],
    rounds: Array.from({ length: data.settings.numRounds }, (_, i) => ({
      number: i + 1,
      status: 'pending' as const,
      pairings: [],
      byes: [],
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tournaments.push(newTournament);
  standings[newTournament.id] = [];
  return newTournament;
}

export async function updateTournament(
  id: string,
  data: Partial<CreateTournamentForm & { status?: string }>
): Promise<Tournament> {
  await delay(300);
  const index = tournaments.findIndex((t) => t.id === id);
  if (index === -1) throw new Error('Tournament not found');

  const tournament = tournaments[index];

  if (data.status) {
    tournament.status = data.status as Tournament['status'];
  }
  if (data.name) tournament.name = data.name;
  if (data.description !== undefined) tournament.description = data.description;
  if (data.date) tournament.date = data.date;
  if (data.location !== undefined) tournament.location = data.location;

  tournament.updatedAt = new Date().toISOString();
  return structuredClone(tournament);
}

export async function deleteTournament(id: string): Promise<void> {
  await delay(300);
  const index = tournaments.findIndex((t) => t.id === id);
  if (index === -1) throw new Error('Tournament not found');
  tournaments.splice(index, 1);
  delete standings[id];
}

// ========== Registration ==========

export async function registerPlayer(
  tournamentId: string,
  playerId: string,
  roundsParticipating?: number[],
  divisionId?: string
): Promise<Tournament> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const player = players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found');

  // Check if already registered
  const existing = tournament.registrations.find((r) => {
    const id = typeof r.playerId === 'string' ? r.playerId : r.playerId.id;
    return id === playerId;
  });

  if (existing && !existing.withdrawn) {
    throw new Error('Player already registered');
  }

  if (existing) {
    existing.withdrawn = false;
    existing.roundsParticipating = roundsParticipating ?? [];
    existing.divisionId = divisionId;
  } else {
    tournament.registrations.push({
      playerId: player,
      divisionId,
      roundsParticipating: roundsParticipating ?? [],
      registeredAt: new Date().toISOString(),
      withdrawn: false,
    });
  }

  tournament.updatedAt = new Date().toISOString();
  return structuredClone(tournament);
}

export async function bulkRegisterPlayers(
  tournamentId: string,
  playerList: Array<{ name: string; agaId: string; rank: string; club?: string; email?: string }>
): Promise<{ tournament: Tournament; created: Player[]; alreadyRegistered: string[] }> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const created: Player[] = [];
  const alreadyRegistered: string[] = [];

  for (const p of playerList) {
    let player = players.find((pl) => pl.agaId === p.agaId);
    if (!player) {
      player = {
        id: `player-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: p.name,
        rank: p.rank,
        club: p.club,
        agaId: p.agaId,
        email: p.email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      players.push(player);
      created.push(player);
    }

    const existing = tournament.registrations.find((r) => {
      const id = typeof r.playerId === 'string' ? r.playerId : r.playerId.id;
      return id === player!.id;
    });

    if (existing && !existing.withdrawn) {
      alreadyRegistered.push(p.agaId);
      continue;
    }

    tournament.registrations.push({
      playerId: player,
      roundsParticipating: [],
      registeredAt: new Date().toISOString(),
      withdrawn: false,
    });
  }

  tournament.updatedAt = new Date().toISOString();
  return { tournament: structuredClone(tournament), created, alreadyRegistered };
}

export async function withdrawPlayer(tournamentId: string, playerId: string): Promise<Tournament> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const registration = tournament.registrations.find((r) => {
    const id = typeof r.playerId === 'string' ? r.playerId : r.playerId.id;
    return id === playerId;
  });

  if (!registration) throw new Error('Player not registered');

  registration.withdrawn = true;
  tournament.updatedAt = new Date().toISOString();
  return structuredClone(tournament);
}

export async function updatePlayerRounds(
  tournamentId: string,
  playerId: string,
  roundsParticipating: number[]
): Promise<Tournament> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const registration = tournament.registrations.find((r) => {
    const id = typeof r.playerId === 'string' ? r.playerId : r.playerId.id;
    return id === playerId;
  });

  if (!registration) throw new Error('Player not registered');

  registration.roundsParticipating = roundsParticipating;
  tournament.updatedAt = new Date().toISOString();
  return structuredClone(tournament);
}

export async function updateRegistration(
  tournamentId: string,
  playerId: string,
  data: { roundsParticipating?: number[]; divisionId?: string | null }
): Promise<Tournament> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const registration = tournament.registrations.find((r) => {
    const id = typeof r.playerId === 'string' ? r.playerId : r.playerId.id;
    return id === playerId;
  });

  if (!registration) throw new Error('Player not registered');

  if (data.roundsParticipating !== undefined) {
    registration.roundsParticipating = data.roundsParticipating;
  }
  if (data.divisionId !== undefined) {
    registration.divisionId = data.divisionId ?? undefined;
  }
  tournament.updatedAt = new Date().toISOString();
  return structuredClone(tournament);
}

// ========== Divisions ==========

export async function addDivision(
  tournamentId: string,
  data: { name: string; description?: string }
): Promise<Tournament> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const division: Division = {
    id: `div${generateId()}`,
    name: data.name,
    description: data.description,
  };
  tournament.divisions.push(division);
  tournament.updatedAt = new Date().toISOString();
  return structuredClone(tournament);
}

export async function updateDivision(
  tournamentId: string,
  divisionId: string,
  data: { name?: string; description?: string }
): Promise<Tournament> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const division = tournament.divisions.find((d) => d.id === divisionId);
  if (!division) throw new Error('Division not found');

  if (data.name !== undefined) division.name = data.name;
  if (data.description !== undefined) division.description = data.description;
  tournament.updatedAt = new Date().toISOString();
  return structuredClone(tournament);
}

export async function removeDivision(
  tournamentId: string,
  divisionId: string
): Promise<Tournament> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const index = tournament.divisions.findIndex((d) => d.id === divisionId);
  if (index === -1) throw new Error('Division not found');
  tournament.divisions.splice(index, 1);

  // Remove divisionId from registrations in this division
  for (const reg of tournament.registrations) {
    if (reg.divisionId === divisionId) {
      reg.divisionId = undefined;
    }
  }

  tournament.updatedAt = new Date().toISOString();
  return structuredClone(tournament);
}

// ========== Rounds ==========

export async function unpairMatch(
  tournamentId: string,
  roundNumber: number,
  boardNumber: number
): Promise<Round> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const round = tournament.rounds.find((r) => r.number === roundNumber);
  if (!round) throw new Error('Round not found');

  if (round.status === 'completed') {
    throw new Error('Cannot unpair a completed round');
  }

  const pairingIdx = round.pairings.findIndex((p) => p.boardNumber === boardNumber);
  if (pairingIdx === -1) throw new Error('Pairing not found');

  if (round.pairings[pairingIdx].result !== 'no_result') {
    throw new Error('Cannot unpair a match with a recorded result');
  }

  round.pairings.splice(pairingIdx, 1);

  if (round.pairings.length === 0 && round.byes.length === 0) {
    round.status = 'pending';
  }

  tournament.updatedAt = new Date().toISOString();
  return structuredClone(round);
}

export async function manualPair(
  tournamentId: string,
  roundNumber: number,
  player1Id: string,
  player2Id: string
): Promise<Round> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const round = tournament.rounds.find((r) => r.number === roundNumber);
  if (!round) throw new Error('Round not found');

  if (round.status === 'completed') {
    throw new Error('Cannot add pairings to a completed round');
  }

  // Check neither player is already paired
  const pairedIds = new Set<string>();
  for (const p of round.pairings) {
    pairedIds.add(p.blackPlayerId);
    pairedIds.add(p.whitePlayerId);
  }
  for (const b of round.byes) {
    pairedIds.add(b.playerId);
  }

  if (pairedIds.has(player1Id)) throw new Error('Player 1 is already paired');
  if (pairedIds.has(player2Id)) throw new Error('Player 2 is already paired');

  const maxBoard = round.pairings.reduce((max, p) => Math.max(max, p.boardNumber), 0);

  round.pairings.push({
    blackPlayerId: player1Id,
    whitePlayerId: player2Id,
    boardNumber: maxBoard + 1,
    handicapStones: 0,
    komi: 6.5,
    result: 'no_result' as const,
  });

  if (round.status === 'pending') {
    round.status = 'paired';
    round.pairedAt = new Date().toISOString();
  }

  tournament.updatedAt = new Date().toISOString();
  return structuredClone(round);
}

export async function generatePairings(tournamentId: string, roundNumber: number): Promise<Round> {
  await delay(500);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const round = tournament.rounds.find((r) => r.number === roundNumber);
  if (!round) throw new Error('Round not found');

  if (round.status !== 'pending' && round.status !== 'paired') {
    throw new Error('Round cannot be paired');
  }

  // Get already-paired player IDs
  const alreadyPairedIds = new Set<string>();
  for (const p of round.pairings) {
    alreadyPairedIds.add(p.blackPlayerId);
    alreadyPairedIds.add(p.whitePlayerId);
  }
  for (const b of round.byes) {
    alreadyPairedIds.add(b.playerId);
  }

  // Get active players, excluding already-paired
  const activePlayers = tournament.registrations
    .filter((r) => !r.withdrawn)
    .map((r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id))
    .filter((id) => !alreadyPairedIds.has(id));

  if (activePlayers.length === 0) {
    throw new Error('No unpaired players available');
  }

  // Simple pairing algorithm (just pair sequentially for demo)
  const boardOffset = round.pairings.reduce((max, p) => Math.max(max, p.boardNumber), 0);
  const newPairings = [];
  const newByes = [];

  for (let i = 0; i < activePlayers.length - 1; i += 2) {
    newPairings.push({
      blackPlayerId: activePlayers[i],
      whitePlayerId: activePlayers[i + 1],
      boardNumber: boardOffset + Math.floor(i / 2) + 1,
      handicapStones: 0,
      komi: 6.5,
      result: 'no_result' as const,
    });
  }

  // If odd number of players, last one gets a bye
  if (activePlayers.length % 2 === 1) {
    newByes.push({
      playerId: activePlayers[activePlayers.length - 1],
      points: 1,
    });
  }

  round.pairings = [...round.pairings, ...newPairings];
  round.byes = [...round.byes, ...newByes];
  round.status = 'paired';
  if (!round.pairedAt) round.pairedAt = new Date().toISOString();

  tournament.updatedAt = new Date().toISOString();
  return structuredClone(round);
}

export async function recordResult(
  tournamentId: string,
  roundNumber: number,
  boardNumber: number,
  result: GameResult
): Promise<Tournament> {
  await delay(300);
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error('Tournament not found');

  const round = tournament.rounds.find((r) => r.number === roundNumber);
  if (!round) throw new Error('Round not found');

  const pairing = round.pairings.find((p) => p.boardNumber === boardNumber);
  if (!pairing) throw new Error('Pairing not found');

  pairing.result = result;

  // Check if all results are in
  const allResultsIn = round.pairings.every((p) => p.result !== 'no_result');
  if (allResultsIn) {
    round.status = 'completed';
    round.completedAt = new Date().toISOString();

    // Update standings
    updateStandings(tournament);
  }

  tournament.updatedAt = new Date().toISOString();
  return structuredClone(tournament);
}

// Helper to update standings
function updateStandings(tournament: Tournament) {
  const playerStats: Record<string, { wins: number; losses: number; opponents: string[] }> = {};

  // Initialize stats for all registered players
  for (const reg of tournament.registrations) {
    if (reg.withdrawn) continue;
    const playerId = typeof reg.playerId === 'string' ? reg.playerId : reg.playerId.id;
    playerStats[playerId] = { wins: 0, losses: 0, opponents: [] };
  }

  // Process completed rounds
  for (const round of tournament.rounds) {
    if (round.status !== 'completed') continue;

    for (const pairing of round.pairings) {
      const black = pairing.blackPlayerId;
      const white = pairing.whitePlayerId;

      if (playerStats[black]) playerStats[black].opponents.push(white);
      if (playerStats[white]) playerStats[white].opponents.push(black);

      if (pairing.result === 'black_wins' || pairing.result === 'white_forfeit') {
        if (playerStats[black]) playerStats[black].wins++;
        if (playerStats[white]) playerStats[white].losses++;
      } else if (pairing.result === 'white_wins' || pairing.result === 'black_forfeit') {
        if (playerStats[white]) playerStats[white].wins++;
        if (playerStats[black]) playerStats[black].losses++;
      }
    }

    for (const bye of round.byes) {
      if (playerStats[bye.playerId]) {
        playerStats[bye.playerId].wins += bye.points;
      }
    }
  }

  // Calculate SOS
  const sos: Record<string, number> = {};
  for (const [playerId, stats] of Object.entries(playerStats)) {
    sos[playerId] = stats.opponents.reduce((sum, oppId) => {
      return sum + (playerStats[oppId]?.wins ?? 0);
    }, 0);
  }

  // Build standings
  const standingsList: PlayerStanding[] = [];
  for (const [playerId, stats] of Object.entries(playerStats)) {
    const player = players.find((p) => p.id === playerId);
    const sosValue = sos[playerId] ?? 0;
    standingsList.push({
      rank: 0,
      playerId,
      playerName: player?.name ?? 'Unknown',
      playerRank: player?.rank ?? '?',
      wins: stats.wins,
      losses: stats.losses,
      sos: sosValue,
      sds: 0,
      sosos: 0,
    });
  }

  // Sort using tournament's tiebreaker order
  const order = tournament.settings.tiebreakerOrder ?? ['wins', 'sos', 'sds', 'hth'];
  const statKeys: Record<string, keyof PlayerStanding> = {
    wins: 'wins', sos: 'sos', sds: 'sds', sosos: 'sosos',
  };
  standingsList.sort((a, b) => {
    for (const criterion of order) {
      if (criterion === 'hth') continue; // Skip HTH in mock (pairwise comparison)
      const key = statKeys[criterion];
      if (key && (a[key] as number) !== (b[key] as number)) {
        return (b[key] as number) - (a[key] as number);
      }
    }
    return 0;
  });
  standingsList.forEach((s, i) => (s.rank = i + 1));

  standings[tournament.id] = standingsList;
}

// ========== Standings ==========

export async function getStandings(
  tournamentId: string,
): Promise<PlayerStanding[]> {
  await delay();
  return standings[tournamentId] ?? [];
}

export async function getDivisionStandings(
  tournamentId: string,
  divisionId: string,
): Promise<PlayerStanding[]> {
  await delay();
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) return [];

  // Get player IDs in this division
  const divisionPlayerIds = new Set(
    tournament.registrations
      .filter((r) => !r.withdrawn && r.divisionId === divisionId)
      .map((r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id))
  );

  const allStandings = standings[tournamentId] ?? [];
  const filtered = allStandings
    .filter((s) => divisionPlayerIds.has(s.playerId))
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return filtered;
}

// ========== Reset Data (for testing) ==========

export function resetMockData() {
  players = [...mockPlayers];
  tournaments = structuredClone(mockTournaments);
  standings = structuredClone(mockStandings);
}
