import { Router } from 'express';
import { tournamentService } from '../services/index.js';
import {
  createTournamentSchema,
  updateTournamentSchema,
  registerPlayerSchema,
  updateRegistrationSchema,
  recordResultSchema,
  manualPairSchema,
  createDivisionSchema,
  updateDivisionSchema,
  bulkRegisterSchema,
} from '../utils/validation.js';
import type { GameResult } from '../types/index.js';

const router = Router();

// List tournaments
router.get('/', async (req, res, next) => {
  try {
    const { status, limit = '50', skip = '0' } = req.query;
    const tournaments = await tournamentService.list({
      status: typeof status === 'string' ? status : undefined,
      limit: parseInt(String(limit), 10),
      skip: parseInt(String(skip), 10),
    });
    res.json({ tournaments });
  } catch (error) {
    next(error);
  }
});

// Create tournament
router.post('/', async (req, res, next) => {
  try {
    const data = createTournamentSchema.parse(req.body);
    const tournament = await tournamentService.create(data);
    res.status(201).json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Get tournament
router.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const tournament = await tournamentService.get(id);
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Update tournament
router.patch('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const data = updateTournamentSchema.parse(req.body);
    const tournament = await tournamentService.update(id, data);
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Delete tournament
router.delete('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const deleted = await tournamentService.delete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ====== Registration ======

// Register player
router.post('/:id/registrations', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const data = registerPlayerSchema.parse(req.body);
    const tournament = await tournamentService.registerPlayer(id, data.playerId, data.roundsParticipating, data.divisionId);
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Bulk register players
router.post('/:id/registrations/bulk', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const data = bulkRegisterSchema.parse(req.body);
    const result = await tournamentService.bulkRegister(id, data.players);
    if (!result) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Withdraw player
router.delete('/:id/registrations/:playerId', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const playerId = String(req.params.playerId);
    const tournament = await tournamentService.withdrawPlayer(id, playerId);
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Update registration (rounds, division)
router.patch('/:id/registrations/:playerId', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const playerId = String(req.params.playerId);
    const data = updateRegistrationSchema.parse(req.body);
    const tournament = await tournamentService.updateRegistration(id, playerId, {
      roundsParticipating: data.roundsParticipating,
      divisionId: data.divisionId,
    });
    if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// ====== Divisions ======

// Add division
router.post('/:id/divisions', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const data = createDivisionSchema.parse(req.body);
    const division = await tournamentService.addDivision(id, data);
    if (!division) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    res.status(201).json({ division });
  } catch (error) {
    next(error);
  }
});

// Update division
router.patch('/:id/divisions/:divisionId', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const divisionId = String(req.params.divisionId);
    const data = updateDivisionSchema.parse(req.body);
    const division = await tournamentService.updateDivision(id, divisionId, data);
    if (!division) {
      res.status(404).json({ error: 'Division not found' });
      return;
    }
    res.json({ division });
  } catch (error) {
    next(error);
  }
});

// Delete division
router.delete('/:id/divisions/:divisionId', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const divisionId = String(req.params.divisionId);
    const deleted = await tournamentService.removeDivision(id, divisionId);
    if (!deleted) {
      res.status(404).json({ error: 'Division not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Get division standings
router.get('/:id/divisions/:divisionId/standings', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const divisionId = String(req.params.divisionId);
    const throughRound = req.query.throughRound ? parseInt(String(req.query.throughRound), 10) : undefined;
    const standings = await tournamentService.getStandings(id, throughRound, divisionId);
    res.json({ standings });
  } catch (error) {
    next(error);
  }
});

// ====== Rounds ======

// Unpair match
router.delete('/:id/rounds/:roundNumber/pairings/:boardNumber', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const roundNumber = parseInt(String(req.params.roundNumber), 10);
    const boardNumber = parseInt(String(req.params.boardNumber), 10);
    const round = await tournamentService.unpairMatch(id, roundNumber, boardNumber);
    res.json({ round });
  } catch (error) {
    next(error);
  }
});

// Manual pair
router.post('/:id/rounds/:roundNumber/pairings', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const roundNumber = parseInt(String(req.params.roundNumber), 10);
    const { player1Id, player2Id } = manualPairSchema.parse(req.body);
    const round = await tournamentService.manualPair(id, roundNumber, player1Id, player2Id);
    res.json({ round });
  } catch (error) {
    next(error);
  }
});

// Generate pairings
router.post('/:id/rounds/:roundNumber/pair', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const roundNumber = parseInt(String(req.params.roundNumber), 10);
    const round = await tournamentService.generatePairings(id, roundNumber);
    res.json({ round });
  } catch (error) {
    next(error);
  }
});

// Record result
router.patch('/:id/rounds/:roundNumber/boards/:boardNumber', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const roundNumber = parseInt(String(req.params.roundNumber), 10);
    const boardNumber = parseInt(String(req.params.boardNumber), 10);
    const { result } = recordResultSchema.parse(req.body);

    const tournament = await tournamentService.recordResult(id, roundNumber, boardNumber, result as GameResult);
    if (!tournament) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ tournament });
  } catch (error) {
    next(error);
  }
});

// Get standings
router.get('/:id/standings', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const throughRound = req.query.throughRound ? parseInt(String(req.query.throughRound), 10) : undefined;
    const standings = await tournamentService.getStandings(id, throughRound);
    res.json({ standings });
  } catch (error) {
    next(error);
  }
});

export default router;
