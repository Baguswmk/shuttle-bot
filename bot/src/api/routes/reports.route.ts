import { Router } from 'express';
import { db } from '../../db';
import { requireAuth } from '../middleware/auth.middleware';
import { recalculateRiskScore, escalateSanction } from '../../services/risk.service';
import { notifyUser } from '../../services/notif.service';
import { broadcastStats } from '../../services/websocket.service';

const router = Router();
router.use(requireAuth);

// GET /reports
router.get('/', async (req, res) => {
  const { status } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const where = status ? { status: status as any } : {};
  const total = await db.report.count({ where });

  const reports = await db.report.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
    include: {
      reporter:   { select: { name: true, username: true } },
      freelancer: { include: { user: { select: { name: true } } } },
      order:      { select: { orderNumber: true, type: true } },
    },
  });

  res.json({
    data: reports,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// PATCH /reports/:id/validate — mark as VALID and trigger escalation
router.patch('/:id/validate', async (req, res) => {
  const { adminNote } = req.body;

  const report = await db.report.update({
    where: { id: req.params.id },
    data:  { status: 'VALID', adminNote: adminNote ?? null, reviewedAt: new Date() },
    include: { freelancer: { include: { user: true } } },
  });

  await recalculateRiskScore(report.freelancerId);
  const sanction = await escalateSanction(report.freelancerId);

  // Notify freelancer about sanction
  if (sanction === 'SUSPEND_7D') {
    await notifyUser(
      report.freelancer.user.telegramId,
      `🚫 <b>Akun disuspend 7 hari.</b>\n\nKamu telah menerima 3+ laporan valid. Akunmu disuspend hingga ${new Date(Date.now() + 7*24*3600000).toLocaleDateString('id-ID')}.`,
    ).catch(() => {});
  } else if (sanction === 'WARNING') {
    await notifyUser(
      report.freelancer.user.telegramId,
      `⚠️ <b>Peringatan!</b>\n\nKamu menerima laporan valid dari pengguna. Harap tingkatkan kualitas layananmu. Laporan lebih lanjut dapat berakibat suspend.`,
    ).catch(() => {});
  }

  broadcastStats().catch(console.error);
  res.json({ success: true, sanction });
});

// PATCH /reports/:id/invalidate — mark as INVALID
router.patch('/:id/invalidate', async (req, res) => {
  const { adminNote } = req.body;

  await db.report.update({
    where: { id: req.params.id },
    data:  { status: 'INVALID', adminNote: adminNote ?? null, reviewedAt: new Date() },
  });

  broadcastStats().catch(console.error);
  res.json({ success: true });
});

export default router;
