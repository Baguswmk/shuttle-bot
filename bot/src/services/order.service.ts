import { db } from '../db';
import type { OrderStatus, OrderType } from '@prisma/client';
import { broadcastStats } from './websocket.service';

// ── Create ────────────────────────────────────────────────────────────────────

export async function createOrder(data: {
  userId: string;
  type: OrderType;
  pickupLocation?: string;
  dropLocation?: string;
  passengerCount?: number;
  jastipCategory?: string;
  jastipDetail?: string;
  jasaType?: string;
  jasaDetail?: string;
  estimatedPrice: number;
}) {
  const order = await db.order.create({
    data: { ...data, status: 'WAITING' },
    include: { user: true },
  });
  broadcastStats().catch(console.error);
  return order;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getOrderById(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      user: true,
      freelancer: { include: { user: true } },
      contract: true,
    },
  });
}

export async function getOrdersByUser(telegramId: bigint, limit = 10) {
  return db.order.findMany({
    where: { user: { telegramId } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { freelancer: { include: { user: true } } },
  });
}

export async function getActiveOrderByTelegramId(telegramId: bigint) {
  return db.order.findFirst({
    where: {
      user: { telegramId },
      status: { in: ['WAITING', 'MATCHED', 'RUNNING'] },
    },
  });
}

export async function getWaitingOrders() {
  return db.order.findMany({
    where: { status: 'WAITING' },
    orderBy: { createdAt: 'asc' },
    include: { user: true },
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string,
) {
  const now = new Date();
  const order = await db.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(status === 'MATCHED'   && { matchedAt: now }),
      ...(status === 'RUNNING'   && { startedAt: now }),
      ...(status === 'DONE'      && { completedAt: now }),
      ...(status === 'CANCELLED' && { cancelledAt: now, cancelReason: note }),
    },
  });

  await db.orderStatusLog.create({
    data: { orderId, status, note: note ?? null },
  });

  broadcastStats().catch(console.error);
  return order;
}

export async function rateOrder(
  orderId: string,
  rating: number,
  comment?: string,
) {
  const order = await db.order.update({
    where: { id: orderId },
    data: { rating, ratingComment: comment ?? null },
  });
  broadcastStats().catch(console.error);
  return order;
}

export async function assignFreelancer(orderId: string, freelancerId: string) {
  const order = await db.order.update({
    where: { id: orderId },
    data: { freelancerId, status: 'MATCHED', matchedAt: new Date() },
  });
  broadcastStats().catch(console.error);
  return order;
}
