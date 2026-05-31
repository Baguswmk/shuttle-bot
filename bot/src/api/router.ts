import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import freelancersRouter from './routes/freelancers.route';
import ordersRouter      from './routes/orders.route';
import reportsRouter     from './routes/reports.route';
import statsRouter       from './routes/stats.route';
import broadcastRouter   from './routes/broadcast.route';

const router = Router();

// ── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (username !== config.ADMIN_USERNAME || password !== config.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: 'admin', username },
    config.JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.json({ token, expiresIn: '7d' });
});

// ── Resource routes ───────────────────────────────────────────────────────────
router.use('/freelancers', freelancersRouter);
router.use('/orders',      ordersRouter);
router.use('/reports',     reportsRouter);
router.use('/stats',       statsRouter);
router.use('/broadcast',   broadcastRouter);

export default router;
