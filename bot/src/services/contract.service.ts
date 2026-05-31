import crypto from 'crypto';
import { db } from '../db';

/**
 * Generate a digital contract for a matched order.
 * Returns the created Contract record (with SHA-256 hash for immutability).
 */
export async function generateContract(orderId: string, freelancerId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      freelancer: { include: { user: true } },
    },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);

  const freelancer = await db.freelancer.findUnique({
    where: { id: freelancerId },
    include: { user: true },
  });
  if (!freelancer) throw new Error(`Freelancer ${freelancerId} not found`);

  const content = {
    version:     '1.0',
    orderId,
    orderNumber: order.orderNumber,
    type:        order.type,
    user: {
      id:   order.userId,
      name: order.user.name,
    },
    freelancer: {
      id:   freelancerId,
      name: freelancer.user.name,
    },
    service: {
      pickupLocation: order.pickupLocation,
      dropLocation:   order.dropLocation,
      passengerCount: order.passengerCount,
      jastipCategory: order.jastipCategory,
      jastipDetail:   order.jastipDetail,
      jasaType:       order.jasaType,
      jasaDetail:     order.jasaDetail,
    },
    estimatedPrice: order.estimatedPrice,
    generatedAt:    new Date().toISOString(),
    clauses: [
      'Freelancer wajib menyelesaikan layanan sesuai kesepakatan',
      'Pengguna wajib membayar tarif yang disepakati',
      'Pembatalan tanpa alasan valid dapat mengakibatkan sanksi',
      'Pelanggaran dapat dilaporkan dan ditindak oleh admin',
      'Transaksi ini tercatat sebagai bukti hukum yang sah',
    ],
  };

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(content))
    .digest('hex');

  return db.contract.upsert({
    where: { orderId },
    update: { freelancerId, hash, content, signedAt: new Date() },
    create: { orderId, freelancerId, hash, content },
  });
}
