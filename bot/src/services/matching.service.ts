import { InlineKeyboard } from 'grammy';
import { db } from '../db';
import { findAllAvailableFreelancers } from './freelancer.service';
import { getOrderById } from './order.service';
import { notifyUser } from './notif.service';

/**
 * Broadcasts a waiting order to all currently available freelancers.
 * Returns true if freelancers exist to receive the broadcast, false otherwise.
 */
export async function matchOrder(orderId: string): Promise<boolean> {
  const order = await getOrderById(orderId);
  if (!order || order.status !== 'WAITING') return false;

  const freelancers = await findAllAvailableFreelancers();
  if (freelancers.length === 0) {
    // Notify user that no freelancer is available right now
    await notifyUser(
      order.user.telegramId,
      '⏳ Belum ada freelancer yang tersedia saat ini.\nPesananmu tetap aktif — kamu akan dinotifikasi segera setelah freelancer ditemukan.',
    );
    return false;
  }

  // Create markup button
  const orderType = { ANJEM: '🚗 Antar Jemput', JASTIP: '🛍 Jastip', JASA: '✨ Jasa Lainnya' }[order.type];
  const acceptKeyboard = new InlineKeyboard()
    .text('✅ Terima', `accept:${orderId}`)
    .text('❌ Tolak', `decline:${orderId}`);

  const priceText = order.estimatedPrice > 0
    ? `Rp${order.estimatedPrice.toLocaleString('id-ID')}`
    : 'Nego / Driver Tentukan';

  // Broadcast to all available freelancers in parallel
  const broadcastPromises = freelancers.map((freelancer) =>
    notifyUser(
      freelancer.user.telegramId,
      `🔔 <b>Pesanan Baru!</b>\n\n` +
      `📦 <b>Layanan:</b> ${orderType}\n` +
      `📍 <b>Jemput:</b> ${order.pickupLocation ?? order.jastipDetail ?? order.jasaDetail}\n` +
      `${order.dropLocation ? `📍 <b>Tujuan:</b> ${order.dropLocation}\n` : ''}` +
      `💰 <b>Tawaran User:</b> ${priceText}\n\n` +
      `<i>Klik Terima di bawah ini jika kamu bersedia mengambil pesanan.</i>`,
      { reply_markup: acceptKeyboard },
    ).catch((err) => {
      console.error(`[Broadcast] Gagal mengirim penawaran ke driver ${freelancer.user.name}:`, err);
    })
  );

  await Promise.all(broadcastPromises);

  // Notify user that the order has been broadcasted
  await notifyUser(
    order.user.telegramId,
    `🔍 <b>Mencari driver...</b>\n\nPesananmu telah disebarkan ke ${freelancers.length} driver aktif. Mohon tunggu konfirmasi...`,
  );

  return true;
}
