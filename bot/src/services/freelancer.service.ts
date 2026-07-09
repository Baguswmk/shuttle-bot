import { db } from '../db';
import { broadcastStats } from './websocket.service';

export async function getFreelancerByTelegramId(telegramId: bigint) {
  return db.freelancer.findFirst({
    where: { user: { telegramId } },
    include: { user: true },
  });
}

export async function createFreelancerApplication(data: {
  userId: string;
  ktmUrl: string;
  selfieUrl?: string;
  emergencyName: string;
  emergencyPhone: string;
}) {
  const freelancer = await db.freelancer.create({ data });
  broadcastStats().catch(console.error);
  return freelancer;
}

export async function approveFreelancer(freelancerId: string) {
  const freelancer = await db.freelancer.update({
    where: { id: freelancerId },
    data: { status: 'APPROVED', approvedAt: new Date() },
    include: { user: true },
  });
  broadcastStats().catch(console.error);
  return freelancer;
}

export async function rejectFreelancer(freelancerId: string, note: string) {
  return db.freelancer.update({
    where: { id: freelancerId },
    data: { status: 'BANNED' }, // Rejection simpan sebagai BANNED sementara untuk non-approve
  });
}

export async function getPendingFreelancers() {
  return db.freelancer.findMany({
    where: { status: 'PENDING' },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getFreelancerById(id: string) {
  return db.freelancer.findUnique({
    where: { id },
    include: { user: true, sanctions: { orderBy: { createdAt: 'desc' } } },
  });
}

export async function findAvailableFreelancer(excludeIds?: string[]) {
  return db.freelancer.findFirst({
    where: {
      status: 'APPROVED',
      ordersAsFreelancer: {
        none: { status: { in: ['MATCHED', 'RUNNING'] } },
      },
      ...(excludeIds && excludeIds.length > 0 && {
        id: { notIn: excludeIds },
      }),
    },
    include: { user: true },
    orderBy: { avgRating: 'desc' },
  });
}

export async function findAllAvailableFreelancers() {
  return db.freelancer.findMany({
    where: {
      status: 'APPROVED',
      ordersAsFreelancer: {
        none: { status: { in: ['MATCHED', 'RUNNING'] } },
      },
    },
    include: { user: true },
  });
}

export async function updateFreelancerRating(freelancerId: string) {
  const ratings = await db.order.findMany({
    where: { freelancerId, rating: { not: null } },
    select: { rating: true },
  });

  if (ratings.length === 0) return;

  const avg = ratings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratings.length;

  await db.freelancer.update({
    where: { id: freelancerId },
    data: {
      avgRating: parseFloat(avg.toFixed(2)),
      totalOrders: ratings.length,
    },
  });
}
