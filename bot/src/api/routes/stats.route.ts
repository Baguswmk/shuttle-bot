import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getStatsData } from '../../services/stats.service';

const router = Router();
router.use(requireAuth);

// GET /stats — overview numbers for dashboard
router.get('/', async (_req, res) => {
  try {
    const stats = await getStatsData();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
