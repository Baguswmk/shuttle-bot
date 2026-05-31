import { InlineKeyboard } from 'grammy';
import { db } from '../db';
import { findAvailableFreelancer } from './freelancer.service';
import { assignFreelancer, getOrderById } from './order.service';
import { generateContract } from './contract.service';
import { notifyUser } from './notif.service';

/**
 * Try to match a waiting order to an available freelancer.
 * Sends notifications to both parties if matched.
 * Returns true if matched, false if no freelancer available.
 */
export async function matchOrder(orderId: string): Promise<boolean> {
  const order = await getOrderById(orderId);
  if (!order || order.status !== 'WAITING') return false;

  const freelancer = await findAvailableFreelancer();
  if (!freelancer) {
    // Notify user that no freelancer is available right now
    await notifyUser(
      order.user.telegramId,
      '⏳ Belum ada freelancer yang tersedia saat ini.\nPesananmu tetap aktif — kamu akan dinotifikasi segera setelah freelancer ditemukan.',
    );
    return false;
  }

  // Match: update order + generate contract
  await assignFreelancer(orderId, freelancer.id);
  await generateContract(orderId, freelancer.id);

  // Notify user
  const orderType = { ANJEM: '🚗 Antar Jemput', JASTIP: '🛍 Jastip', JASA: '✨ Jasa Lainnya' }[order.type];
  const acceptKeyboard = new InlineKeyboard()
    .text('✅ Terima', `accept:${orderId}`)
    .text('❌ Tolak', `decline:${orderId}`);

  const priceText = order.estimatedPrice > 0
    ? `Rp${order.estimatedPrice.toLocaleString('id-ID')}`
    : 'Nego / Driver Tentukan';

  // Notify freelancer to accept/decline within 60s
  await notifyUser(
    freelancer.user.telegramId,
    `🔔 <b>Pesanan Baru!</b>\n\n` +
    `📦 <b>Layanan:</b> ${orderType}\n` +
    `📍 <b>Jemput:</b> ${order.pickupLocation ?? order.jastipDetail ?? order.jasaDetail}\n` +
    `${order.dropLocation ? `📍 <b>Tujuan:</b> ${order.dropLocation}\n` : ''}` +
    `💰 <b>Tawaran User:</b> ${priceText}\n\n` +
    `<i>Kamu punya <b>60 detik</b> untuk menerima atau menolak.</i>`,
    { reply_markup: acceptKeyboard },
  );

  // Notify user that a freelancer was found
  await notifyUser(
    order.user.telegramId,
    `✅ <b>Freelancer ditemukan!</b>\n\n` +
    `👤 <b>${freelancer.user.name}</b>\n` +
    `⭐ Rating: ${freelancer.avgRating.toFixed(1)} · ${freelancer.totalOrders} order\n\n` +
    `Menunggu freelancer mengkonfirmasi... (maks 60 detik)`,
  );

  // Auto-cancel freelancer slot after 60s if no response
  setTimeout(async () => {
    const refreshed = await getOrderById(orderId);
    if (refreshed?.status === 'MATCHED') {
      // Still MATCHED but freelancer never accepted → re-queue
      await db.order.update({
        where: { id: orderId },
        data: {
          status: 'WAITING',
          freelancerId: null,
          matchedAt: null,
        },
      });
      await notifyUser(
        order.user.telegramId,
        '⚠️ Freelancer tidak merespons.\nKami sedang mencari freelancer lain...',
      );
      // Try matching again
      await matchOrder(orderId);
    }
  }, 60_000);

  return true;
}
