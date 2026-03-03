import { Router } from 'express';
import { playerService } from '../services/index.js';
import { createPlayerSchema, updatePlayerSchema } from '../utils/validation.js';

const router = Router();

// List players
router.get('/', async (req, res, next) => {
  try {
    const { search, limit = '50', skip = '0' } = req.query;
    const players = await playerService.list({
      search: typeof search === 'string' ? search : undefined,
      limit: parseInt(String(limit), 10),
      skip: parseInt(String(skip), 10),
    });
    res.json({ players });
  } catch (error) {
    next(error);
  }
});

// Create player
router.post('/', async (req, res, next) => {
  try {
    const data = createPlayerSchema.parse(req.body);
    const player = await playerService.create(data);
    res.status(201).json({ player });
  } catch (error) {
    next(error);
  }
});

// Get player
router.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const player = await playerService.get(id);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    res.json({ player });
  } catch (error) {
    next(error);
  }
});

// Update player
router.patch('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const data = updatePlayerSchema.parse(req.body);
    const player = await playerService.update(id, data);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    res.json({ player });
  } catch (error) {
    next(error);
  }
});

// Delete player
router.delete('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const deleted = await playerService.delete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
