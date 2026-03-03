import { Router } from 'express';
import playersRouter from './players.js';
import tournamentsRouter from './tournaments.js';

const router = Router();

router.use('/players', playersRouter);
router.use('/tournaments', tournamentsRouter);

export default router;
