import { Router } from 'express';
import { db } from '../../db';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);

// GET /orders
router.get('/', async (req, res) => {
  const { status, type, date, search } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (type)   where.type   = type;
  if (date) {
    const d = new Date(date as string);
    where.createdAt = {
      gte: new Date(d.setHours(0, 0, 0, 0)),
      lte: new Date(d.setHours(23, 59, 59, 999)),
    };
  }
  if (search) {
    const searchStr = search as string;
    const isNumeric = /^\d+$/.test(searchStr);
    const orderNum = isNumeric ? parseInt(searchStr) : undefined;

    where.OR = [
      ...(orderNum !== undefined ? [{ orderNumber: orderNum }] : []),
      {
        user: {
          OR: [
            { name: { contains: searchStr, mode: 'insensitive' } },
            { username: { contains: searchStr, mode: 'insensitive' } },
          ]
        }
      },
      {
        freelancer: {
          user: {
            OR: [
              { name: { contains: searchStr, mode: 'insensitive' } },
              { username: { contains: searchStr, mode: 'insensitive' } },
            ]
          }
        }
      },
      {
        pickupLocation: { contains: searchStr, mode: 'insensitive' }
      },
      {
        dropLocation: { contains: searchStr, mode: 'insensitive' }
      }
    ];
  }

  const total = await db.order.count({ where });

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take:    limit,
    include: {
      user:       { select: { id: true, name: true, username: true } },
      freelancer: { include: { user: { select: { id: true, name: true, username: true } } } },
    },
  });

  res.json({
    data: orders,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// GET /orders/:id
router.get('/:id', async (req, res) => {
  const order = await db.order.findUnique({
    where:   { id: req.params.id },
    include: {
      user:       true,
      freelancer: { include: { user: true } },
      contract:   true,
      statusLogs: { orderBy: { createdAt: 'asc' } },
      reports:    { include: { reporter: true } },
    },
  });

  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

export default router;
