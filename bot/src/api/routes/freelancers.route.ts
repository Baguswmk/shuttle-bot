import { Router } from 'express';
import { db } from '../../db';
import { requireAuth } from '../middleware/auth.middleware';
import { approveFreelancer } from '../../services/freelancer.service';
import { banFreelancer } from '../../services/risk.service';
import { notifyUser } from '../../services/notif.service';
import { broadcastStats } from '../../services/websocket.service';
import { Prisma } from '@prisma/client';
import { botConfig } from '../../bot.config';

const router = Router();
router.use(requireAuth);

// GET /freelancers — list with filters
router.get('/', async (req, res) => {
  const { status, minRisk, maxRisk, search } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.FreelancerWhereInput = {
    ...(status && { status: status as any }),
    ...(minRisk && { riskScore: { gte: parseInt(minRisk as string) } }),
    ...(maxRisk && { riskScore: { lte: parseInt(maxRisk as string) } }),
    ...(search && {
      user: {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { username: { contains: search as string, mode: 'insensitive' } },
        ],
      },
    }),
  };

  const total = await db.freelancer.count({ where });

  const freelancers = await db.freelancer.findMany({
    where,
    include: {
      user: true,
      _count: { select: { ordersAsFreelancer: true, reports: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  res.json({
    data: freelancers,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// GET /freelancers/:id
router.get('/:id', async (req, res) => {
  const freelancer = await db.freelancer.findUnique({
    where: { id: req.params.id },
    include: {
      user: true,
      sanctions:          { orderBy: { createdAt: 'desc' } },
      reports:            { orderBy: { createdAt: 'desc' }, take: 10 },
      ordersAsFreelancer: { orderBy: { createdAt: 'desc' }, take: 20, include: { user: true } },
    },
  });

  if (!freelancer) return res.status(404).json({ error: 'Freelancer not found' });
  res.json(freelancer);
});

// PATCH /freelancers/:id/approve
router.patch('/:id/approve', async (req, res) => {
  const freelancer = await approveFreelancer(req.params.id);

  // Notify freelancer via Telegram
  await notifyUser(
    freelancer.user.telegramId,
        '✅ <b>Selamat! Pendaftaran freelancermu disetujui!</b>\n\nKamu sekarang bisa menerima pesanan dari pengguna ' + botConfig.name + '.',
  ).catch(() => {}); // Ignore notify failures for admin response

  res.json({ success: true, freelancer });
});

// PATCH /freelancers/:id/ban
router.patch('/:id/ban', async (req, res) => {
  const { reason, adminNote } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });

  await banFreelancer(req.params.id, reason, adminNote);

  const freelancer = await db.freelancer.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });

  if (freelancer) {
    await notifyUser(
      freelancer.user.telegramId,
      `⛔ <b>Akunmu telah dibanned.</b>\n\nAlasan: ${reason}\n\nHubungi admin kampus untuk informasi lebih lanjut.`,
    ).catch(() => {});
  }

  broadcastStats().catch(console.error);
  res.json({ success: true });
});

// PATCH /freelancers/:id/suspend  
router.patch('/:id/suspend', async (req, res) => {
  const { days = 7, reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });

  const suspendUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.freelancer.update({
      where: { id: req.params.id },
      data:  { status: 'SUSPENDED', suspendedUntil: suspendUntil },
    }),
    db.sanction.create({
      data: { freelancerId: req.params.id, type: 'SUSPEND_7D', reason, expiresAt: suspendUntil },
    }),
  ]);

  const freelancer = await db.freelancer.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });

  if (freelancer) {
    const untilStr = suspendUntil.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    await notifyUser(
      freelancer.user.telegramId,
      `🚫 <b>Akunmu disuspend hingga ${untilStr}.</b>\n\nAlasan: ${reason}`,
    ).catch(() => {});
  }

  broadcastStats().catch(console.error);
  res.json({ success: true });
});

// PATCH /freelancers/:id — update freelancer details
router.patch('/:id', async (req, res) => {
  let { name, phone, emergencyName, emergencyPhone, username } = req.body;

  // Validations
  if (name && !/^[a-zA-Z\s.,'-]+$/.test(name)) {
    return res.status(400).json({ error: 'Nama hanya boleh berisi huruf dan spasi.' });
  }
  if (emergencyName && !/^[a-zA-Z\s.,'-]+$/.test(emergencyName)) {
    return res.status(400).json({ error: 'Nama kontak darurat hanya boleh berisi huruf dan spasi.' });
  }
  if (phone && !/^[0-9]+$/.test(phone)) {
    return res.status(400).json({ error: 'Nomor HP hanya boleh berisi angka.' });
  }
  if (emergencyPhone && !/^[0-9]+$/.test(emergencyPhone)) {
    return res.status(400).json({ error: 'Nomor HP kontak darurat hanya boleh berisi angka.' });
  }
  if (username) {
    if (username.startsWith('@')) {
      username = username.substring(1);
    }
    if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
      return res.status(400).json({ error: 'Username Telegram tidak valid (5-32 karakter alfanumerik & underscore).' });
    }
  }

  try {
    const freelancer = await db.freelancer.update({
      where: { id: req.params.id },
      data: {
        ...(emergencyName && { emergencyName }),
        ...(emergencyPhone && { emergencyPhone }),
        user: {
          update: {
            ...(name && { name }),
            ...(phone && { phone }),
            ...(username && { username }),
          },
        },
      },
      include: { user: true },
    });

    broadcastStats().catch(console.error);
    res.json({ success: true, freelancer });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memperbarui data freelancer.' });
  }
});

export default router;
