import crypto from 'crypto';
import { prisma } from '../prisma/client.js';
import { nyigTdClient, type PlayerInput, type RoundInput } from './nyigTdClient.js';
import type { CreateTournamentInput, UpdateTournamentInput } from '../utils/validation.js';
import type { GameResult, Round, RoundStatus, PairingResult, Bye, PlayerStanding, Division } from '../types/index.js';

export class TournamentService {
  async create(data: CreateTournamentInput) {
    // Initialize rounds array
    const rounds: Round[] = [];
    for (let i = 1; i <= data.settings.numRounds; i++) {
      rounds.push({
        number: i,
        status: 'pending',
        pairings: [],
        byes: [],
      });
    }

    return prisma.tournament.create({
      data: {
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
          crossDivisionPairing: data.settings.crossDivisionPairing,
        },
        divisions: [],
        registrations: [],
        rounds: rounds.map((r) => ({
          number: r.number,
          status: r.status,
          pairings: [],
          byes: [],
        })),
      },
    });
  }

  async get(id: string) {
    return prisma.tournament.findUnique({
      where: { id },
    });
  }

  async list(filters: { status?: string; limit?: number; skip?: number } = {}) {
    const { status, limit = 50, skip = 0 } = filters;

    return prisma.tournament.findMany({
      where: status ? { status } : undefined,
      orderBy: { date: 'desc' },
      take: limit,
      skip,
    });
  }

  async update(id: string, updates: UpdateTournamentInput) {
    const tournament = await prisma.tournament.findUnique({ where: { id } });
    if (!tournament) return null;

    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.date !== undefined) data.date = updates.date;
    if (updates.location !== undefined) data.location = updates.location;
    if (updates.status !== undefined) data.status = updates.status;

    if (updates.settings) {
      data.settings = {
        ...tournament.settings,
        ...updates.settings,
      };
    }

    return prisma.tournament.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.tournament.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // ====== Division CRUD ======

  async addDivision(
    tournamentId: string,
    data: { name: string; description?: string }
  ): Promise<Division | null> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return null;

    const division: Division = {
      id: crypto.randomBytes(12).toString('hex'),
      name: data.name,
      description: data.description,
    };

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { divisions: [...tournament.divisions, division] },
    });

    return division;
  }

  async updateDivision(
    tournamentId: string,
    divisionId: string,
    updates: { name?: string; description?: string }
  ): Promise<Division | null> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return null;

    const divisionIdx = tournament.divisions.findIndex((d) => d.id === divisionId);
    if (divisionIdx === -1) return null;

    const existing = tournament.divisions[divisionIdx];
    const updated: Division = {
      id: existing.id,
      name: updates.name ?? existing.name,
      description: updates.description ?? existing.description ?? undefined,
    };

    const divisions = tournament.divisions.map((d, i) => (i === divisionIdx ? updated : d));

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { divisions },
    });

    return updated;
  }

  async removeDivision(tournamentId: string, divisionId: string): Promise<boolean> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return false;

    const divisionExists = tournament.divisions.some((d) => d.id === divisionId);
    if (!divisionExists) return false;

    const divisions = tournament.divisions.filter((d) => d.id !== divisionId);

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { divisions },
    });

    return true;
  }

  // ====== Registration ======

  async registerPlayer(tournamentId: string, playerId: string, roundsParticipating: number[] = [], divisionId?: string) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return null;

    const existingIdx = tournament.registrations.findIndex((r) => r.playerId === playerId);

    let registrations;
    if (existingIdx >= 0) {
      // Update existing registration
      registrations = tournament.registrations.map((r, i) =>
        i === existingIdx ? { ...r, withdrawn: false, roundsParticipating, divisionId: divisionId ?? r.divisionId } : r
      );
    } else {
      // Add new registration
      registrations = [
        ...tournament.registrations,
        {
          playerId,
          divisionId,
          roundsParticipating,
          registeredAt: new Date(),
          withdrawn: false,
        },
      ];
    }

    return prisma.tournament.update({
      where: { id: tournamentId },
      data: { registrations },
    });
  }

  async withdrawPlayer(tournamentId: string, playerId: string) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return null;

    const registrations = tournament.registrations.map((r) =>
      r.playerId === playerId ? { ...r, withdrawn: true } : r
    );

    return prisma.tournament.update({
      where: { id: tournamentId },
      data: { registrations },
    });
  }

  async updateRegistration(
    tournamentId: string,
    playerId: string,
    updates: { roundsParticipating?: number[]; divisionId?: string | null }
  ) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return null;

    const registrations = tournament.registrations.map((r) => {
      if (r.playerId !== playerId) return r;
      const updated = { ...r };
      if (updates.roundsParticipating !== undefined) {
        updated.roundsParticipating = updates.roundsParticipating;
      }
      if (updates.divisionId !== undefined) {
        updated.divisionId = updates.divisionId;
      }
      return updated;
    });

    return prisma.tournament.update({
      where: { id: tournamentId },
      data: { registrations },
    });
  }

  async unpairMatch(
    tournamentId: string,
    roundNumber: number,
    boardNumber: number
  ): Promise<Round> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const roundIdx = tournament.rounds.findIndex((r) => r.number === roundNumber);
    if (roundIdx === -1) {
      throw new Error(`Round ${roundNumber} not found`);
    }

    const round = tournament.rounds[roundIdx];
    if (round.status === 'completed') {
      throw new Error(`Cannot unpair a completed round`);
    }

    const pairingIdx = round.pairings.findIndex((p) => p.boardNumber === boardNumber);
    if (pairingIdx === -1) {
      throw new Error(`Pairing on board ${boardNumber} not found`);
    }

    if (round.pairings[pairingIdx].result !== 'NR') {
      throw new Error('Cannot unpair a match with a recorded result');
    }

    // Remove the pairing
    const updatedPairings: PairingResult[] = round.pairings
      .filter((_, i) => i !== pairingIdx)
      .map((p) => ({
        blackPlayerId: p.blackPlayerId,
        whitePlayerId: p.whitePlayerId,
        boardNumber: p.boardNumber,
        handicapStones: p.handicapStones,
        komi: p.komi,
        result: p.result as GameResult,
      }));

    const updatedByes: Bye[] = round.byes.map((b) => ({
      playerId: b.playerId,
      points: b.points,
    }));

    // If no pairings remain, set round back to pending
    const updatedStatus: RoundStatus =
      updatedPairings.length === 0 && updatedByes.length === 0 ? 'pending' : (round.status as RoundStatus);

    const updatedRound: Round = {
      number: round.number,
      status: updatedStatus,
      pairings: updatedPairings,
      byes: updatedByes,
      pairedAt: round.pairedAt ?? undefined,
      completedAt: round.completedAt ?? undefined,
    };

    const updatedRounds = tournament.rounds.map((r, i) =>
      i === roundIdx ? updatedRound : r
    );

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { rounds: updatedRounds },
    });

    return updatedRound;
  }

  async manualPair(
    tournamentId: string,
    roundNumber: number,
    player1Id: string,
    player2Id: string
  ): Promise<Round> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const roundIdx = tournament.rounds.findIndex((r) => r.number === roundNumber);
    if (roundIdx === -1) {
      throw new Error(`Round ${roundNumber} not found`);
    }

    const round = tournament.rounds[roundIdx];
    if (round.status === 'completed') {
      throw new Error(`Cannot add pairings to a completed round`);
    }

    // Validate neither player is already paired in this round
    const pairedPlayerIds = new Set<string>();
    for (const p of round.pairings) {
      pairedPlayerIds.add(p.blackPlayerId);
      pairedPlayerIds.add(p.whitePlayerId);
    }
    for (const b of round.byes) {
      pairedPlayerIds.add(b.playerId);
    }

    if (pairedPlayerIds.has(player1Id)) {
      throw new Error('Player 1 is already paired in this round');
    }
    if (pairedPlayerIds.has(player2Id)) {
      throw new Error('Player 2 is already paired in this round');
    }

    // Fetch both players
    const players = await prisma.player.findMany({
      where: { id: { in: [player1Id, player2Id] } },
    });
    if (players.length !== 2) {
      throw new Error('One or both players not found');
    }

    const p1 = players.find((p) => p.id === player1Id)!;
    const p2 = players.find((p) => p.id === player2Id)!;

    // Determine colors and handicap
    let blackPlayerId: string;
    let whitePlayerId: string;
    let handicapStones = 0;
    let komi = 7.5;

    if (tournament.settings.handicapType !== 'none') {
      // Determine which player is weaker (plays black) based on rank
      // Rank format: "5k" or "3d" — kyu players are weaker than dan players
      // Among kyu, higher number = weaker; among dan, higher number = stronger
      const rankValue = (rank: string): number => {
        const num = parseInt(rank);
        const type = rank.slice(-1).toLowerCase();
        return type === 'd' ? num : -num;
      };

      const r1 = rankValue(p1.rank);
      const r2 = rankValue(p2.rank);

      if (r1 <= r2) {
        // p1 is weaker or equal, p1 plays black
        blackPlayerId = player1Id;
        whitePlayerId = player2Id;
      } else {
        blackPlayerId = player2Id;
        whitePlayerId = player1Id;
      }

      const blackPlayer = blackPlayerId === player1Id ? p1 : p2;
      const whitePlayer = blackPlayerId === player1Id ? p2 : p1;

      const handicapResult = await nyigTdClient.calculateHandicap(
        whitePlayer.rank,
        blackPlayer.rank,
        tournament.settings.handicapType,
        tournament.settings.handicapModifier
      );
      handicapStones = handicapResult.stones;
      komi = handicapResult.komi;
    } else {
      // Even game, assign colors arbitrarily
      blackPlayerId = player1Id;
      whitePlayerId = player2Id;
    }

    // Assign board number = max existing + 1
    const maxBoard = round.pairings.reduce((max, p) => Math.max(max, p.boardNumber), 0);
    const boardNumber = maxBoard + 1;

    const newPairing: PairingResult = {
      blackPlayerId,
      whitePlayerId,
      boardNumber,
      handicapStones,
      komi,
      result: 'NR' as GameResult,
    };

    const existingPairings: PairingResult[] = round.pairings.map((p) => ({
      blackPlayerId: p.blackPlayerId,
      whitePlayerId: p.whitePlayerId,
      boardNumber: p.boardNumber,
      handicapStones: p.handicapStones,
      komi: p.komi,
      result: p.result as GameResult,
    }));

    const updatedRound: Round = {
      number: round.number,
      status: round.status === 'pending' ? 'paired' : (round.status as RoundStatus),
      pairings: [...existingPairings, newPairing],
      byes: round.byes.map((b) => ({ playerId: b.playerId, points: b.points })),
      pairedAt: round.pairedAt ?? new Date(),
      completedAt: round.completedAt ?? undefined,
    };

    const updatedRounds = tournament.rounds.map((r, i) =>
      i === roundIdx ? updatedRound : r
    );

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { rounds: updatedRounds },
    });

    return updatedRound;
  }

  async generatePairings(tournamentId: string, roundNumber: number): Promise<Round> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const roundIdx = tournament.rounds.findIndex((r) => r.number === roundNumber);
    if (roundIdx === -1) {
      throw new Error(`Round ${roundNumber} not found`);
    }

    const round = tournament.rounds[roundIdx];
    if (round.status !== 'pending' && round.status !== 'paired') {
      throw new Error(`Round ${roundNumber} cannot be paired (status: ${round.status})`);
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

    // Get active registrations for this round, excluding already-paired
    const activeRegistrations: { playerId: string; divisionId?: string | null }[] = [];
    for (const reg of tournament.registrations) {
      if (reg.withdrawn) continue;
      if (alreadyPairedIds.has(reg.playerId)) continue;
      const participates =
        reg.roundsParticipating.length === 0 || reg.roundsParticipating.includes(roundNumber);
      if (participates) {
        activeRegistrations.push({ playerId: reg.playerId, divisionId: reg.divisionId });
      }
    }

    if (activeRegistrations.length === 0) {
      throw new Error('No unpaired players available');
    }

    const activePlayerIds = activeRegistrations.map((r) => r.playerId);

    // Fetch player data
    const players = await prisma.player.findMany({
      where: { id: { in: activePlayerIds } },
    });

    // Build previous rounds data
    const previousRounds: RoundInput[] = tournament.rounds
      .filter((r) => r.number < roundNumber && r.status === 'completed')
      .map((r) => ({
        number: r.number,
        pairings: r.pairings.map((p) => ({
          black_player_id: p.blackPlayerId,
          white_player_id: p.whitePlayerId,
          result: p.result,
        })),
        byes: r.byes.map((b) => ({
          player_id: b.playerId,
          points: b.points,
        })),
      }));

    let newPairings: PairingResult[] = [];
    let newByes: Bye[] = [];

    const boardOffset = round.pairings.reduce((max, p) => Math.max(max, p.boardNumber), 0);

    if (!tournament.settings.crossDivisionPairing && tournament.divisions.length > 0) {
      // Per-division pairing: run algorithm separately for each division's players
      const divisionGroups = new Map<string, string[]>();
      for (const reg of activeRegistrations) {
        const divId = reg.divisionId ?? '__none__';
        if (!divisionGroups.has(divId)) divisionGroups.set(divId, []);
        divisionGroups.get(divId)!.push(reg.playerId);
      }

      let runningBoardOffset = boardOffset;

      for (const [, divPlayerIds] of divisionGroups) {
        const divPlayers = players.filter((p) => divPlayerIds.includes(p.id));
        if (divPlayers.length === 0) continue;

        const response = await nyigTdClient.generatePairings({
          players: divPlayers.map(
            (p): PlayerInput => ({
              id: p.id,
              name: p.name,
              rank: p.rank,
              club: p.club ?? undefined,
              aga_id: p.agaId ?? undefined,
              rating: p.rating ?? undefined,
            })
          ),
          previous_rounds: previousRounds,
          round_number: roundNumber,
          algorithm: tournament.settings.pairingAlgorithm,
          mcmahon_bar: tournament.settings.mcmahonBar ?? undefined,
          handicap_type: tournament.settings.handicapType,
          handicap_modifier: tournament.settings.handicapModifier,
        });

        const divPairings: PairingResult[] = response.pairings.map((p) => ({
          blackPlayerId: p.black_player_id,
          whitePlayerId: p.white_player_id,
          boardNumber: p.board_number + runningBoardOffset,
          handicapStones: p.handicap_stones,
          komi: p.komi,
          result: 'NR' as GameResult,
        }));

        const divByes: Bye[] = response.byes.map((b) => ({
          playerId: b.player_id,
          points: b.points,
        }));

        // Update running offset for next division
        const maxNewBoard = divPairings.reduce((max, p) => Math.max(max, p.boardNumber), runningBoardOffset);
        runningBoardOffset = maxNewBoard;

        newPairings.push(...divPairings);
        newByes.push(...divByes);
      }
    } else {
      // Cross-division pairing (default): pair all players together
      const response = await nyigTdClient.generatePairings({
        players: players.map(
          (p): PlayerInput => ({
            id: p.id,
            name: p.name,
            rank: p.rank,
            club: p.club ?? undefined,
            aga_id: p.agaId ?? undefined,
            rating: p.rating ?? undefined,
          })
        ),
        previous_rounds: previousRounds,
        round_number: roundNumber,
        algorithm: tournament.settings.pairingAlgorithm,
        mcmahon_bar: tournament.settings.mcmahonBar ?? undefined,
        handicap_type: tournament.settings.handicapType,
        handicap_modifier: tournament.settings.handicapModifier,
      });

      newPairings = response.pairings.map((p) => ({
        blackPlayerId: p.black_player_id,
        whitePlayerId: p.white_player_id,
        boardNumber: p.board_number + boardOffset,
        handicapStones: p.handicap_stones,
        komi: p.komi,
        result: 'NR' as GameResult,
      }));

      newByes = response.byes.map((b) => ({
        playerId: b.player_id,
        points: b.points,
      }));
    }

    if (newPairings.length === 0 && newByes.length === 0) {
      throw new Error('No unpaired players available');
    }

    const existingPairings: PairingResult[] = round.pairings.map((p) => ({
      blackPlayerId: p.blackPlayerId,
      whitePlayerId: p.whitePlayerId,
      boardNumber: p.boardNumber,
      handicapStones: p.handicapStones,
      komi: p.komi,
      result: p.result as GameResult,
    }));

    const existingByes: Bye[] = round.byes.map((b) => ({
      playerId: b.playerId,
      points: b.points,
    }));

    const updatedRound: Round = {
      number: roundNumber,
      status: 'paired',
      pairings: [...existingPairings, ...newPairings],
      byes: [...existingByes, ...newByes],
      pairedAt: round.pairedAt ?? new Date(),
    };

    const updatedRounds = tournament.rounds.map((r, i) =>
      i === roundIdx
        ? {
            number: updatedRound.number,
            status: updatedRound.status,
            pairings: updatedRound.pairings.map((p) => ({
              blackPlayerId: p.blackPlayerId,
              whitePlayerId: p.whitePlayerId,
              boardNumber: p.boardNumber,
              handicapStones: p.handicapStones,
              komi: p.komi,
              result: p.result,
            })),
            byes: updatedRound.byes.map((b) => ({
              playerId: b.playerId,
              points: b.points,
            })),
            pairedAt: updatedRound.pairedAt,
            completedAt: null,
          }
        : r
    );

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { rounds: updatedRounds },
    });

    return updatedRound;
  }

  async recordResult(
    tournamentId: string,
    roundNumber: number,
    boardNumber: number,
    result: GameResult
  ) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) return null;

    const roundIdx = tournament.rounds.findIndex((r) => r.number === roundNumber);
    if (roundIdx === -1) return null;

    const pairingIdx = tournament.rounds[roundIdx].pairings.findIndex(
      (p) => p.boardNumber === boardNumber
    );
    if (pairingIdx === -1) return null;

    const updatedRounds = tournament.rounds.map((r, rIdx) => {
      if (rIdx !== roundIdx) return r;

      const updatedPairings = r.pairings.map((p, pIdx) =>
        pIdx === pairingIdx ? { ...p, result } : p
      );

      const allCompleted = updatedPairings.every((p) => p.result !== 'NR');

      return {
        ...r,
        pairings: updatedPairings,
        status: allCompleted ? 'completed' : 'in_progress',
        completedAt: allCompleted ? new Date() : r.completedAt,
      };
    });

    return prisma.tournament.update({
      where: { id: tournamentId },
      data: { rounds: updatedRounds },
    });
  }

  async getStandings(tournamentId: string, throughRound?: number, divisionId?: string): Promise<PlayerStanding[]> {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Get non-withdrawn player IDs, optionally filtered by division
    const playerIds = tournament.registrations
      .filter((r) => !r.withdrawn)
      .filter((r) => !divisionId || r.divisionId === divisionId)
      .map((r) => r.playerId);

    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
    });

    // Build rounds data
    const completedRounds: RoundInput[] = tournament.rounds
      .filter((r) => r.status === 'completed')
      .filter((r) => !throughRound || r.number <= throughRound)
      .map((r) => ({
        number: r.number,
        pairings: r.pairings.map((p) => ({
          black_player_id: p.blackPlayerId,
          white_player_id: p.whitePlayerId,
          result: p.result,
        })),
        byes: r.byes.map((b) => ({
          player_id: b.playerId,
          points: b.points,
        })),
      }));

    const response = await nyigTdClient.calculateStandings({
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        rank: p.rank,
      })),
      rounds: completedRounds,
      through_round: throughRound,
    });

    return response.standings.map((s) => ({
      rank: s.rank,
      playerId: s.player_id,
      playerName: s.player_name,
      playerRank: s.player_rank,
      wins: s.wins,
      losses: s.losses,
      sos: s.sos,
      sds: s.sds,
      sosos: s.sosos,
    }));
  }
}

export const tournamentService = new TournamentService();
