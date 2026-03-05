import { describe, it, expect, beforeEach } from 'vitest';
import {
  listPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  listTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  registerPlayer,
  withdrawPlayer,
  updatePlayerRounds,
  bulkUpdateRegistrations,
  addDivision,
  updateDivision,
  removeDivision,
  generatePairings,
  unpairMatch,
  unpairAll,
  manualPair,
  recordResult,
  getStandings,
  getDivisionStandings,
  resetMockData,
} from '@/services/mockApi';

beforeEach(() => {
  resetMockData();
});

// ========== Players ==========

describe('listPlayers', () => {
  it('returns all mock players', async () => {
    const players = await listPlayers();
    expect(players.length).toBe(35);
  });

  it('filters by search term (name)', async () => {
    const players = await listPlayers({ search: 'alice' });
    expect(players.length).toBe(1);
    expect(players[0].name).toBe('Alice Chen');
  });

  it('filters by search term (rank)', async () => {
    const players = await listPlayers({ search: '5d' });
    expect(players.length).toBe(2);
    expect(players.map(p => p.name)).toContain('Alice Chen');
  });

  it('filters by search term (club)', async () => {
    const players = await listPlayers({ search: 'Brooklyn' });
    expect(players.length).toBe(4);
  });

  it('limits results', async () => {
    const players = await listPlayers({ limit: 3 });
    expect(players.length).toBe(3);
  });
});

describe('getPlayer', () => {
  it('returns a player by id', async () => {
    const player = await getPlayer('p1');
    expect(player.name).toBe('Alice Chen');
    expect(player.rank).toBe('5d');
  });

  it('throws for unknown id', async () => {
    await expect(getPlayer('unknown')).rejects.toThrow('Player not found');
  });
});

describe('createPlayer', () => {
  it('creates and returns a new player', async () => {
    const player = await createPlayer({ name: 'Test Player', rank: '1k', agaId: '99999' });
    expect(player.name).toBe('Test Player');
    expect(player.rank).toBe('1k');
    expect(player.id).toBeTruthy();

    const all = await listPlayers();
    expect(all.length).toBe(36);
  });
});

describe('updatePlayer', () => {
  it('updates player fields', async () => {
    const updated = await updatePlayer('p1', { club: 'New Club' });
    expect(updated.club).toBe('New Club');
    expect(updated.name).toBe('Alice Chen');
  });

  it('throws for unknown id', async () => {
    await expect(updatePlayer('unknown', { name: 'X' })).rejects.toThrow('Player not found');
  });
});

describe('deletePlayer', () => {
  it('removes a player', async () => {
    await deletePlayer('p1');
    const all = await listPlayers();
    expect(all.length).toBe(34);
    expect(all.find((p) => p.id === 'p1')).toBeUndefined();
  });

  it('throws for unknown id', async () => {
    await expect(deletePlayer('unknown')).rejects.toThrow('Player not found');
  });
});

// ========== Tournaments ==========

describe('listTournaments', () => {
  it('returns all tournaments', async () => {
    const tournaments = await listTournaments();
    expect(tournaments.length).toBe(4);
  });

  it('filters by status', async () => {
    const setup = await listTournaments({ status: 'setup' });
    expect(setup.length).toBe(1);
    expect(setup[0].name).toBe('Brooklyn Open 2024');
  });
});

describe('getTournament', () => {
  it('returns tournament by id', async () => {
    const t = await getTournament('t1');
    expect(t.name).toBe('NYIG Winter Championship 2024');
    expect(t.settings.pairingAlgorithm).toBe('mcmahon');
  });

  it('returns a deep clone', async () => {
    const t1 = await getTournament('t1');
    const t2 = await getTournament('t1');
    expect(t1).toEqual(t2);
    expect(t1).not.toBe(t2);
  });

  it('throws for unknown id', async () => {
    await expect(getTournament('unknown')).rejects.toThrow('Tournament not found');
  });
});

describe('createTournament', () => {
  it('creates a tournament with correct defaults', async () => {
    const t = await createTournament({
      name: 'New Tourney',
      date: '2024-06-01',
      settings: {
        numRounds: 3,
        pairingAlgorithm: 'swiss',
        handicapType: 'none',
        handicapModifier: 'none',
        crossDivisionPairing: true,
      },
    });

    expect(t.name).toBe('New Tourney');
    expect(t.status).toBe('setup');
    expect(t.rounds.length).toBe(3);
    expect(t.rounds[0].status).toBe('pending');
    expect(t.divisions).toEqual([]);
    expect(t.registrations).toEqual([]);
    expect(t.settings.crossDivisionPairing).toBe(true);
  });

  it('defaults crossDivisionPairing to true when not provided', async () => {
    const t = await createTournament({
      name: 'Test',
      date: '2024-06-01',
      settings: {
        numRounds: 2,
        pairingAlgorithm: 'swiss',
        handicapType: 'none',
        handicapModifier: 'none',
        crossDivisionPairing: undefined as unknown as boolean,
      },
    });
    expect(t.settings.crossDivisionPairing).toBe(true);
  });
});

describe('updateTournament', () => {
  it('updates tournament status', async () => {
    const t = await updateTournament('t2', { status: 'in_progress' });
    expect(t.status).toBe('in_progress');
  });

  it('throws for unknown id', async () => {
    await expect(updateTournament('unknown', {})).rejects.toThrow('Tournament not found');
  });
});

describe('deleteTournament', () => {
  it('removes a tournament', async () => {
    await deleteTournament('t1');
    const all = await listTournaments();
    expect(all.length).toBe(3);
  });
});

// ========== Registration ==========

describe('registerPlayer', () => {
  it('registers a player to a tournament', async () => {
    const t = await registerPlayer('t2', 'p1');
    expect(t.registrations.length).toBe(7);
    const reg = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p1'
    );
    expect(reg).toBeTruthy();
    expect(reg!.withdrawn).toBe(false);
  });

  it('registers with divisionId', async () => {
    const t1 = await getTournament('t2');
    const divId = t1.divisions[0].id;

    const t = await registerPlayer('t2', 'p1', undefined, divId);
    const reg = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p1'
    );
    expect(reg!.divisionId).toBe(divId);
  });

  it('registers with specific rounds', async () => {
    const t = await registerPlayer('t2', 'p1', [1, 3]);
    const reg = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p1'
    );
    expect(reg!.roundsParticipating).toEqual([1, 3]);
  });

  it('throws if player already registered', async () => {
    // p7 is already registered in t2 (index 6 = mockPlayers[6])
    await expect(registerPlayer('t2', 'p7')).rejects.toThrow('Player already registered');
  });

  it('re-registers a withdrawn player', async () => {
    await withdrawPlayer('t2', 'p7');
    const t = await registerPlayer('t2', 'p7');
    const reg = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p7'
    );
    expect(reg!.withdrawn).toBe(false);
  });

  it('throws for unknown tournament', async () => {
    await expect(registerPlayer('unknown', 'p1')).rejects.toThrow('Tournament not found');
  });

  it('throws for unknown player', async () => {
    await expect(registerPlayer('t2', 'unknown')).rejects.toThrow('Player not found');
  });
});

describe('withdrawPlayer', () => {
  it('marks registration as withdrawn', async () => {
    const t = await withdrawPlayer('t2', 'p7');
    const reg = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p7'
    );
    expect(reg!.withdrawn).toBe(true);
  });

  it('throws for paired player', async () => {
    await expect(withdrawPlayer('t1', 'p1')).rejects.toThrow('already been paired');
  });

  it('throws for unregistered player', async () => {
    await expect(withdrawPlayer('t1', 'p15')).rejects.toThrow('Player not registered');
  });
});

describe('updatePlayerRounds', () => {
  it('updates rounds participating', async () => {
    const t = await updatePlayerRounds('t1', 'p1', [1, 3]);
    const reg = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p1'
    );
    expect(reg!.roundsParticipating).toEqual([1, 3]);
  });

  it('throws for unregistered player', async () => {
    await expect(updatePlayerRounds('t1', 'p15', [1])).rejects.toThrow('Player not registered');
  });
});

// ========== Bulk Update Registrations ==========

describe('bulkUpdateRegistrations', () => {
  it('updates roundsParticipating', async () => {
    const t = await bulkUpdateRegistrations('t1', [
      { playerId: 'p1', roundsParticipating: [1, 3] },
    ]);
    const reg = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p1'
    );
    expect(reg!.roundsParticipating).toEqual([1, 3]);
  });

  it('updates checkedIn', async () => {
    const t = await bulkUpdateRegistrations('t1', [
      { playerId: 'p1', checkedIn: true },
    ]);
    const reg = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p1'
    );
    expect(reg!.checkedIn).toBe(true);
  });

  it('updates withdrawn', async () => {
    const t = await bulkUpdateRegistrations('t2', [
      { playerId: 'p7', withdrawn: true },
    ]);
    const reg = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p7'
    );
    expect(reg!.withdrawn).toBe(true);
  });

  it('throws when withdrawing paired player', async () => {
    await expect(
      bulkUpdateRegistrations('t1', [{ playerId: 'p1', withdrawn: true }])
    ).rejects.toThrow('already been paired');
  });

  it('updates multiple fields at once', async () => {
    const t = await bulkUpdateRegistrations('t2', [
      { playerId: 'p7', checkedIn: true, roundsParticipating: [1, 2] },
      { playerId: 'p8', withdrawn: true },
    ]);
    const reg1 = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p7'
    );
    expect(reg1!.checkedIn).toBe(true);
    expect(reg1!.roundsParticipating).toEqual([1, 2]);

    const reg2 = t.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p8'
    );
    expect(reg2!.withdrawn).toBe(true);
  });

  it('throws for unknown tournament', async () => {
    await expect(bulkUpdateRegistrations('unknown', [{ playerId: 'p1', checkedIn: true }])).rejects.toThrow('Tournament not found');
  });
});

// ========== Divisions ==========

describe('addDivision', () => {
  it('adds a division to a tournament', async () => {
    const t = await addDivision('t3', { name: 'Open', description: 'Dan players' });
    expect(t.divisions.length).toBe(1);
    expect(t.divisions[0].name).toBe('Open');
    expect(t.divisions[0].description).toBe('Dan players');
    expect(t.divisions[0].id).toBeTruthy();
  });

  it('throws for unknown tournament', async () => {
    await expect(addDivision('unknown', { name: 'X' })).rejects.toThrow('Tournament not found');
  });
});

describe('updateDivision', () => {
  it('updates a division name', async () => {
    const t1 = await getTournament('t1');
    const divId = t1.divisions[0].id;

    const t2 = await updateDivision('t1', divId, { name: 'Dan Elite' });
    expect(t2.divisions[0].name).toBe('Dan Elite');
  });

  it('throws for unknown division', async () => {
    await expect(updateDivision('t1', 'unknown', { name: 'X' })).rejects.toThrow(
      'Division not found'
    );
  });
});

describe('removeDivision', () => {
  it('removes a division', async () => {
    const t1 = await getTournament('t1');
    const divId = t1.divisions[0].id;

    const t2 = await removeDivision('t1', divId);
    expect(t2.divisions.length).toBe(1);
  });

  it('clears divisionId from registrations when division removed', async () => {
    const t1 = await addDivision('t3', { name: 'Temp' });
    const divId = t1.divisions[0].id;

    // Register a player with that division
    await registerPlayer('t3', 'p1', undefined, divId);

    // Remove the division
    const t2 = await removeDivision('t3', divId);
    const reg = t2.registrations.find(
      (r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id) === 'p1'
    );
    expect(reg!.divisionId).toBeUndefined();
  });

  it('throws for unknown division', async () => {
    await expect(removeDivision('t1', 'unknown')).rejects.toThrow('Division not found');
  });
});

// ========== Rounds ==========

describe('generatePairings', () => {
  it('generates pairings for even number of players', async () => {
    const round = await generatePairings('t1', 3);
    expect(round.status).toBe('paired');
    expect(round.pairings.length).toBe(7);
    expect(round.byes.length).toBe(0);
  });

  it('assigns bye for odd number of players', async () => {
    // t2 has 6 players; register one more to get 7 (odd)
    await registerPlayer('t2', 'p1');
    const round = await generatePairings('t2', 1);
    expect(round.pairings.length).toBe(3);
    expect(round.byes.length).toBe(1);
  });

  it('throws for completed round', async () => {
    // Round 1 of t1 is completed
    await expect(generatePairings('t1', 1)).rejects.toThrow('Round cannot be paired');
  });

  it('throws for unknown tournament', async () => {
    await expect(generatePairings('unknown', 1)).rejects.toThrow('Tournament not found');
  });
});

describe('manualPair', () => {
  it('creates a manual pairing', async () => {
    const round = await manualPair('t1', 3, 'p1', 'p2');
    expect(round.pairings.length).toBe(1);
    expect(round.pairings[0].blackPlayerId).toBe('p1');
    expect(round.pairings[0].whitePlayerId).toBe('p2');
    expect(round.status).toBe('paired');
  });

  it('throws if player already paired', async () => {
    await manualPair('t1', 3, 'p1', 'p2');
    await expect(manualPair('t1', 3, 'p1', 'p3')).rejects.toThrow('Player 1 is already paired');
  });

  it('throws for completed round', async () => {
    await expect(manualPair('t1', 1, 'p1', 'p2')).rejects.toThrow(
      'Cannot add pairings to a completed round'
    );
  });
});

describe('unpairMatch', () => {
  it('removes a pairing', async () => {
    // Round 2 of t1 has 7 pairings with no results
    const round = await unpairMatch('t1', 2, 1);
    expect(round.pairings.length).toBe(6);
  });

  it('reverts to pending when last pairing removed', async () => {
    for (let board = 1; board <= 6; board++) {
      await unpairMatch('t1', 2, board);
    }
    const round = await unpairMatch('t1', 2, 7);
    expect(round.status).toBe('pending');
    expect(round.pairings.length).toBe(0);
  });

  it('throws for completed round', async () => {
    await expect(unpairMatch('t1', 1, 1)).rejects.toThrow('Cannot unpair a completed round');
  });
});

describe('unpairAll', () => {
  it('removes all pairings and byes from a round', async () => {
    const round = await unpairAll('t1', 2);
    expect(round.pairings).toHaveLength(0);
    expect(round.byes).toHaveLength(0);
    expect(round.status).toBe('pending');
  });

  it('throws for completed round', async () => {
    await expect(unpairAll('t1', 1)).rejects.toThrow('Cannot unpair a completed round');
  });
});

describe('recordResult', () => {
  it('records a result', async () => {
    const t = await recordResult('t1', 2, 1, 'black_wins');
    const round = t.rounds.find((r) => r.number === 2)!;
    const pairing = round.pairings.find((p) => p.boardNumber === 1)!;
    expect(pairing.result).toBe('black_wins');
  });

  it('completes round when all results recorded', async () => {
    for (let board = 1; board <= 6; board++) {
      await recordResult('t1', 2, board, 'black_wins');
    }
    const t = await recordResult('t1', 2, 7, 'white_wins');
    const round = t.rounds.find((r) => r.number === 2)!;
    expect(round.status).toBe('completed');
    expect(round.completedAt).toBeTruthy();
  });
});

// ========== Standings ==========

describe('getStandings', () => {
  it('returns standings for a tournament', async () => {
    const s = await getStandings('t1');
    expect(s.length).toBe(14);
    expect(s[0].rank).toBe(1);
  });

  it('returns empty array for unknown tournament', async () => {
    const s = await getStandings('unknown');
    expect(s).toEqual([]);
  });
});

describe('getDivisionStandings', () => {
  it('filters standings by division', async () => {
    // t1 already has divisions and registrations with divisionId
    const t = await getTournament('t1');
    const danDivId = t.divisions.find((d) => d.name === 'Dan Section')!.id;

    const s = await getDivisionStandings('t1', danDivId);
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].rank).toBe(1);
    // All results should be from dan division players
    const danPlayerIds = t.registrations
      .filter((r) => r.divisionId === danDivId && !r.withdrawn)
      .map((r) => (typeof r.playerId === 'string' ? r.playerId : r.playerId.id));
    for (const standing of s) {
      expect(danPlayerIds).toContain(standing.playerId);
    }
  });

  it('returns empty for unknown tournament', async () => {
    const s = await getDivisionStandings('unknown', 'div1');
    expect(s).toEqual([]);
  });
});
