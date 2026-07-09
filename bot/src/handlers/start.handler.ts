import { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot';
import { db } from '../db';
import { botConfig } from '../bot.config';
import { getOrdersByUser, rateOrder, getOrderById, getActiveOrderByTelegramId } from '../services/order.service';
import { updateFreelancerRating } from '../services/freelancer.service';
import { updateOrderStatus } from '../services/order.service';
import { notifyUser } from '../services/notif.service';
import { matchOrder } from '../services/matching.service';
import { broadcastStats } from '../services/websocket.service';

export async function showMainMenu(ctx: BotContext) {
  const from = ctx.from;
  if (!from) return;

  const freelancer = await db.freelancer.findFirst({
    where: { user: { telegramId: BigInt(from.id) } },
    select: { status: true },
  });

  const activeOrder = await getActiveOrderByTelegramId(BigInt(from.id));

  const statusLabel: Record<string, string> = {
    WAITING: '⏳ Menunggu Freelancer',
    MATCHED: '🔍 Freelancer Ditemukan',
    RUNNING: '🚀 Sedang Berjalan',
  };

  const typeLabel: Record<string, string> = {
    ANJEM: '🚗 Antar Jemput',
    JASTIP: '🛍 Jastip',
    JASA: '✨ Jasa Lainnya',
  };

  const keyboard = new InlineKeyboard();

  if (activeOrder) {
    keyboard.text('❌ Batalkan Pesanan Aktif', `cancel_order:${activeOrder.id}`).row();
  } else {
    keyboard.text('🚗 Antar Jemput', 'menu:anjem').row()
      .text('🛍 Jastip', 'menu:jastip').row()
      .text('✨ Jasa Lainnya', 'menu:jasa').row();
  }

  keyboard.text('📋 Riwayat Pesanan', 'menu:history').row();

  if (!freelancer) {
    keyboard.text('📝 Daftar sebagai Freelancer', 'menu:register').row();
  } else if (freelancer.status === 'APPROVED') {
    keyboard.text('👤 Profil Freelancer', 'menu:profile').row();
  }

  let text = `👋 Halo, <b>${from.first_name}</b>!\n\n` +
    `Selamat datang di <b>${botConfig.name}</b> 🚀\n` +
    `Platform layanan mahasiswa ${botConfig.campusName} yang aman & terlindungi.\n\n`;

  if (activeOrder) {
    text += `⚠️ <b>Kamu memiliki pesanan aktif:</b>\n` +
      `• <b>No. Pesanan:</b> #${activeOrder.orderNumber}\n` +
      `• <b>Layanan:</b> ${typeLabel[activeOrder.type]}\n` +
      `• <b>Status:</b> ${statusLabel[activeOrder.status]}\n\n` +
      `<i>Selesaikan atau batalkan pesanan di atas terlebih dahulu untuk membuat pesanan baru.</i>`;
  } else {
    text += `Pilih layanan di bawah untuk membuat pesanan baru:`;
  }

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

export async function showOrderHistory(ctx: BotContext) {
  const from = ctx.from;
  if (!from) return;

  const orders = await getOrdersByUser(BigInt(from.id), 10);

  if (orders.length === 0) {
    return ctx.reply(
      '📋 Belum ada riwayat pesanan.',
      { reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
    );
  }

  const typeEmoji = { ANJEM: '🚗', JASTIP: '🛍', JASA: '✨' };
  const statusLabel: Record<string, string> = {
    WAITING: '⏳ Menunggu', MATCHED: '🔍 Diproses',
    RUNNING: '🚀 Berjalan', DONE: '✅ Selesai', CANCELLED: '❌ Dibatalkan',
  };

  const lines = orders.map((o, i) => {
    const emoji = typeEmoji[o.type];
    const status = statusLabel[o.status];
    const price = `Rp${o.estimatedPrice.toLocaleString('id-ID')}`;
    const rating = o.rating ? ` · ⭐${o.rating}` : '';
    const date = o.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return `${i + 1}. ${emoji} ${status} · ${price}${rating} · ${date}`;
  });

  await ctx.reply(
    `📋 <b>Riwayat Pesanan</b>\n\n${lines.join('\n')}`,
    { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
  );
}

export async function showFreelancerProfile(ctx: BotContext) {
  const from = ctx.from;
  if (!from) return;

  const freelancer = await db.freelancer.findFirst({
    where: { user: { telegramId: BigInt(from.id) } },
    include: { user: true },
  });

  if (!freelancer) {
    return ctx.reply(
      '❌ Kamu belum terdaftar sebagai Freelancer.\n\nDaftar sekarang untuk mulai menghasilkan uang!',
      { reply_markup: new InlineKeyboard().text('📝 Daftar Freelancer', 'menu:register').row().text('🏠 Menu Utama', 'menu:home') }
    );
  }

  const statusLabel: Record<string, string> = {
    PENDING: '⏳ Menunggu verifikasi', APPROVED: '✅ Aktif',
    SUSPENDED: '🚫 Disuspend', BANNED: '⛔ Dibanned',
  };

  const usernameStr = freelancer.user.username
    ? `@${freelancer.user.username}`
    : '<i>(Belum diatur)</i>';

  const phoneStr = freelancer.user.phone
    ? freelancer.user.phone
    : '<i>(Belum diatur)</i>';

  const keyboard = new InlineKeyboard();
  if (freelancer.status === 'APPROVED') {
    keyboard.text('✏️ Edit Profil', 'profile:edit').row();
  }
  keyboard.text('🏠 Menu Utama', 'menu:home');

  await ctx.reply(
    `👤 <b>Profil Freelancer</b>\n\n` +
    `• <b>Nama:</b> ${freelancer.user.name}\n` +
    `• <b>No. HP:</b> ${phoneStr}\n` +
    `• <b>Username Telegram:</b> ${usernameStr}\n` +
    `• <b>Status:</b> ${statusLabel[freelancer.status]}\n` +
    `• <b>Rating:</b> ${freelancer.avgRating.toFixed(1)} / 5.0\n` +
    `• <b>Total Order:</b> ${freelancer.totalOrders}\n` +
    `• <b>Risk Score:</b> ${freelancer.riskScore}/100\n` +
    `• <b>Kontak Darurat:</b> ${freelancer.emergencyName} (${freelancer.emergencyPhone})`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}

export async function cancelActiveOrder(ctx: BotContext) {
  const from = ctx.from;
  if (!from) return;

  const activeOrderRaw = await getActiveOrderByTelegramId(BigInt(from.id));
  if (!activeOrderRaw) {
    return ctx.reply('❌ Kamu tidak memiliki pesanan aktif yang sedang berjalan.');
  }

  const activeOrder = await getOrderById(activeOrderRaw.id);
  if (!activeOrder) {
    return ctx.reply('❌ Pesanan tidak ditemukan.');
  }

  await updateOrderStatus(activeOrder.id, 'CANCELLED', 'Dibatalkan oleh pemesan');

  // Notify freelancer if matched or running
  if (activeOrder.freelancer?.user?.telegramId) {
    await notifyUser(
      activeOrder.freelancer.user.telegramId,
      `⚠️ <b>Pesanan #${activeOrder.orderNumber} telah dibatalkan oleh pemesan.</b>`,
    ).catch(() => {});
  }

  await ctx.reply(
    `❌ <b>Pesanan #${activeOrder.orderNumber} berhasil dibatalkan.</b>`,
    { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') }
  );
}

export async function showHelp(ctx: BotContext) {
  const helpText = `📖 <b>Panduan Penggunaan ${botConfig.name}</b>\n\n` +
    `Bot ini memudahkan mahasiswa untuk memesan layanan antar-jemput, jastip, dan jasa lainnya secara internal di lingkungan kampus.\n\n` +
    `<b>Perintah yang tersedia:</b>\n` +
    `• /start atau /menu - Tampilkan menu utama\n` +
    `• /profile - Tampilkan profil freelancer Anda\n` +
    `• /riwayat - Tampilkan riwayat pesanan Anda\n` +
    `• /cancel - Batalkan pesanan aktif yang sedang berjalan\n` +
    `• /help - Tampilkan panduan penggunaan ini\n\n` +
    `Silakan pilih /menu untuk mulai menggunakan layanan!`;

  await ctx.reply(helpText, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') });
}

export function registerStartHandler(bot: Bot<BotContext>) {
  // Commands
  bot.command('start', (ctx) => showMainMenu(ctx));
  bot.command('menu', (ctx) => showMainMenu(ctx));
  bot.command('profile', (ctx) => showFreelancerProfile(ctx));
  bot.command('riwayat', (ctx) => showOrderHistory(ctx));
  bot.command('cancel', (ctx) => cancelActiveOrder(ctx));
  bot.command('help', (ctx) => showHelp(ctx));

  // Main menu callback
  bot.callbackQuery('menu:home', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showMainMenu(ctx);
  });

  // Riwayat
  bot.callbackQuery('menu:history', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showOrderHistory(ctx);
  });

  // Freelancer profile
  bot.callbackQuery('menu:profile', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showFreelancerProfile(ctx);
  });

  // Edit profile main callback
  bot.callbackQuery('profile:edit', async (ctx) => {
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard()
      .text('👤 Nama Lengkap', 'profile:edit:name').row()
      .text('📞 Nomor HP', 'profile:edit:phone').row()
      .text('💬 Username Telegram', 'profile:edit:username').row()
      .text('🚨 Nama Kontak Darurat', 'profile:edit:emg_name').row()
      .text('🚨 No HP Kontak Darurat', 'profile:edit:emg_phone').row()
      .text('⬅️ Kembali', 'menu:profile');

    await ctx.reply(
      `✏️ <b>Edit Profil Freelancer</b>\n\n` +
      `Pilih bagian data profil yang ingin Anda ubah:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  });

  bot.callbackQuery('profile:edit:name', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'profile:edit:name';
    await ctx.reply(
      `👤 <b>Edit Nama Lengkap</b>\n\n` +
      `Silakan ketik nama lengkap Anda yang baru (hanya boleh huruf dan spasi):\n\n` +
      `<i>Contoh: Asep Kuniawan</i>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
    );
  });

  bot.callbackQuery('profile:edit:phone', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'profile:edit:phone';
    await ctx.reply(
      `📞 <b>Edit Nomor HP</b>\n\n` +
      `Silakan ketik nomor HP Anda yang baru (hanya boleh angka):\n\n` +
      `<i>Contoh: 081234567890</i>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
    );
  });

  bot.callbackQuery('profile:edit:username', async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramUsername = ctx.from?.username;

    if (telegramUsername) {
      const freelancer = await db.freelancer.findFirst({
        where: { user: { telegramId: BigInt(ctx.from.id) } },
        include: { user: true },
      });

      if (freelancer) {
        await db.user.update({
          where: { id: freelancer.user.id },
          data: { username: telegramUsername },
        });

        // Trigger websocket stats broadcast
        broadcastStats().catch(console.error);

        const updatedFreelancer = await db.freelancer.findFirst({
          where: { id: freelancer.id },
          include: { user: true },
        });

        const statusLabel: Record<string, string> = {
          PENDING: '⏳ Menunggu verifikasi', APPROVED: '✅ Aktif',
          SUSPENDED: '🚫 Disuspend', BANNED: '⛔ Dibanned',
        };

        const usernameStr = updatedFreelancer?.user.username
          ? `@${updatedFreelancer.user.username}`
          : '<i>(Belum diatur)</i>';

        const phoneStr = updatedFreelancer?.user.phone
          ? updatedFreelancer.user.phone
          : '<i>(Belum diatur)</i>';

        await ctx.reply(
          `✨ <b>Username Telegram Terdeteksi Otomatis!</b>\n\n` +
          `Username Telegram Anda berhasil diperbarui menjadi: <b>@${telegramUsername}</b>\n\n` +
          `👤 <b>Profil Freelancer Baru:</b>\n` +
          `• <b>Nama:</b> ${updatedFreelancer?.user.name}\n` +
          `• <b>No. HP:</b> ${phoneStr}\n` +
          `• <b>Username Telegram:</b> ${usernameStr}\n` +
          `• <b>Status:</b> ${statusLabel[updatedFreelancer?.status || 'PENDING']}\n` +
          `• <b>Rating:</b> ${updatedFreelancer?.avgRating.toFixed(1)} / 5.0\n` +
          `• <b>Total Order:</b> ${updatedFreelancer?.totalOrders}\n` +
          `• <b>Risk Score:</b> ${updatedFreelancer?.riskScore}/100\n` +
          `• <b>Kontak Darurat:</b> ${updatedFreelancer?.emergencyName} (${updatedFreelancer?.emergencyPhone})`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text('✏️ Edit Profil Lagi', 'profile:edit').row()
              .text('🏠 Menu Utama', 'menu:home')
          }
        );
        return;
      }
    }

    ctx.session.step = 'profile:edit:username';
    await ctx.reply(
      `💬 <b>Edit Username Telegram</b>\n\n` +
      `⚠️ Akun Telegram Anda tidak memiliki username publik.\n` +
      `Silakan atur username di pengaturan Telegram Anda terlebih dahulu, atau ketik manual username baru di bawah:\n` +
      `<i>Format: @username (tanpa spasi, minimal 5 karakter)</i>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
    );
  });

  bot.callbackQuery('profile:edit:emg_name', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'profile:edit:emg_name';
    await ctx.reply(
      `🚨 <b>Edit Nama Kontak Darurat</b>\n\n` +
      `Silakan ketik nama kontak darurat Anda yang baru (hanya boleh huruf dan spasi):`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
    );
  });

  bot.callbackQuery('profile:edit:emg_phone', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'profile:edit:emg_phone';
    await ctx.reply(
      `🚨 <b>Edit No HP Kontak Darurat</b>\n\n` +
      `Silakan ketik nomor HP kontak darurat Anda yang baru (hanya boleh angka):\n\n` +
      `<i>Contoh: 081234567890</i>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
    );
  });

  bot.callbackQuery('profile:edit:cancel', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = undefined;
    const keyboard = new InlineKeyboard()
      .text('👤 Nama Lengkap', 'profile:edit:name').row()
      .text('📞 Nomor HP', 'profile:edit:phone').row()
      .text('💬 Username Telegram', 'profile:edit:username').row()
      .text('🚨 Nama Kontak Darurat', 'profile:edit:emg_name').row()
      .text('🚨 No HP Kontak Darurat', 'profile:edit:emg_phone').row()
      .text('⬅️ Kembali', 'menu:profile');

    await ctx.reply(
      `✏️ <b>Edit Profil Freelancer</b>\n\n` +
      `Pilih bagian data profil yang ingin Anda ubah:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  });

  // ── Rating callbacks ─────────────────────────────────────────────────────────
  bot.callbackQuery(/^rate:([^:]+):(\d)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const orderId = ctx.match[1];
    const rating  = parseInt(ctx.match[2]);

    const order = await getOrderById(orderId);
    if (!order || order.userId !== (await db.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } }))?.id) {
      return ctx.reply('❌ Order tidak ditemukan.');
    }

    await rateOrder(orderId, rating);

    if (order.freelancerId) {
      await updateFreelancerRating(order.freelancerId);
    }

    ctx.session.step = 'order:rating_comment';
    ctx.session.currentOrderId = orderId;

    const stars = '⭐'.repeat(rating);
    const keyboard = new InlineKeyboard().text('❌ Lewati Ulasan', `rate_comment:skip:${orderId}`);

    await ctx.reply(
      `${stars} <b>Rating ${rating} bintang disimpan!</b>\n\n` +
      `Apakah Anda bersedia memberikan ulasan atau masukan tambahan untuk driver ini?\n\n` +
      `<i>Silakan ketik ulasan Anda langsung di sini, atau klik tombol di bawah untuk melewati.</i>`,
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // Skip rating comment callback
  bot.callbackQuery(/^rate_comment:skip:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const orderId = ctx.match[1];

    if (ctx.session.currentOrderId === orderId) {
      ctx.session.step = undefined;
      ctx.session.currentOrderId = undefined;
    }

    await ctx.reply(
      '✨ <b>Terima kasih atas penilaian Anda!</b>',
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
    );
  });

  // ── Freelancer accept / decline order ────────────────────────────────────────
  bot.callbackQuery(/^accept:(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    
    const freelancer = await db.freelancer.findFirst({
      where: { user: { telegramId: BigInt(ctx.from.id) } },
      include: { user: true },
    });

    if (!freelancer) {
      await ctx.answerCallbackQuery({
        text: '❌ Anda bukan freelancer terdaftar.',
        show_alert: true,
      });
      return;
    }

    // Race-condition guard: check if driver already has a RUNNING order
    const alreadyRunning = await db.order.findFirst({
      where: {
        freelancerId: freelancer.id,
        status: 'RUNNING',
      },
    });
    if (alreadyRunning) {
      await ctx.answerCallbackQuery({
        text: `❌ Kamu sudah punya order aktif (#${alreadyRunning.orderNumber}) yang sedang berjalan!`,
        show_alert: true,
      });
      return;
    }

    // Sync driver username to DB
    if (ctx.from.username) {
      await db.user.update({
        where: { telegramId: BigInt(ctx.from.id) },
        data: { username: ctx.from.username },
      }).catch(console.error);
    }

    // Try to lock and claim the order
    try {
      const order = await db.$transaction(async (tx) => {
        const ord = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!ord || ord.status !== 'WAITING') {
          throw new Error('NOT_AVAILABLE');
        }

        // Lock and update
        return await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'RUNNING',
            freelancerId: freelancer.id,
            matchedAt: new Date(),
            startedAt: new Date(),
          },
          include: { user: true, freelancer: { include: { user: true } } },
        });
      });

      await ctx.answerCallbackQuery('✅ Pesanan diterima!');

      // Generate contract
      const { generateContract } = await import('../services/contract.service');
      await generateContract(orderId, freelancer.id);

      const driverUser     = order.freelancer?.user;
      const driverUsername = driverUser?.username ?? ctx.from.username;
      const driverPhone    = driverUser?.phone;
      const flrUsername    = driverUsername
        ? `@${driverUsername}`
        : `<i>(Username tidak diatur oleh driver)</i>`;

      // Build chat buttons
      const chatKeyboard = new InlineKeyboard();
      if (driverUsername) {
        chatKeyboard.url('💬 Chat via Telegram', `https://t.me/${driverUsername}`).row();
      }
      if (driverPhone) {
        const waNumber = driverPhone.replace(/\D/g, '').replace(/^0/, '62');
        chatKeyboard.url('📱 Chat via WhatsApp', `https://wa.me/${waNumber}`).row();
      }
      const hasButtons = driverUsername || driverPhone;

      const estimasiText = order.estimatedPrice > 0
        ? `Tawaran harga Rp${order.estimatedPrice.toLocaleString('id-ID')} & waktu tiba 5–15 menit adalah estimasi.`
        : `Tarif ditentukan langsung oleh driver (Nego) & waktu tiba 5–15 menit adalah estimasi.`;

      await notifyUser(
        order.user.telegramId,
        `🚀 <b>Driver dalam perjalanan!</b>\n\n` +
        `👤 <b>Nama Driver:</b> ${driverUser?.name ?? 'Freelancer'}\n` +
        `💬 <b>Telegram Driver:</b> ${flrUsername}\n\n` +
        `⚠️ <b>Catatan:</b>\n` +
        `• ${estimasiText}\n` +
        `• Tarif final dapat dinegosiasikan langsung dengan driver via tombol di bawah:`,
        hasButtons ? { reply_markup: chatKeyboard } : undefined,
      );

      // Edit message in this driver's DM to show locked state and Mark Done button
      await ctx.editMessageText(
        `✅ <b>Pesanan Terkunci!</b>\n` +
        `Segera menuju lokasi penjemputan/belanja.\n\n` +
        `👤 <b>Customer:</b> ${order.user.name}\n` +
        `📍 <b>Lokasi:</b> ${order.pickupLocation ?? order.jastipDetail ?? order.jasaDetail}`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('✅ Tandai Selesai', `done:${orderId}`),
        }
      ).catch(console.error);

    } catch (err: any) {
      if (err.message === 'NOT_AVAILABLE') {
        await ctx.answerCallbackQuery({
          text: '❌ Maaf, pesanan ini sudah diambil oleh driver lain.',
          show_alert: true,
        });
        try {
          await ctx.editMessageText('⚠️ <i>Pesanan ini sudah diambil oleh driver lain.</i>', { parse_mode: 'HTML' });
        } catch (_) {}
      } else {
        console.error('[Accept Callback Error]', err);
        await ctx.answerCallbackQuery({
          text: '❌ Gagal menerima pesanan.',
          show_alert: true,
        });
      }
    }
  });

  bot.callbackQuery(/^decline:(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    
    // Simply remove buttons from this driver's private chat
    try {
      await ctx.editMessageText('❌ <i>Tawaran pesanan ditolak.</i>', { parse_mode: 'HTML' });
    } catch (_) {}
    await ctx.answerCallbackQuery('❌ Tawaran ditolak');
  });

  // Freelancer marks order as done (Prompts for final price)
  bot.callbackQuery(/^done:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const orderId = ctx.match[1];
    const order = await getOrderById(orderId);
    if (!order || order.status !== 'RUNNING') return;

    ctx.session.step = 'order:final_price';
    ctx.session.currentOrderId = orderId;

    const hasEstimation = order.estimatedPrice > 0;
    const keyboard = new InlineKeyboard();
    if (hasEstimation) {
      keyboard.text(`✅ Pakai Harga Tawaran (Rp${order.estimatedPrice.toLocaleString('id-ID')})`, `done_estimasi:${orderId}`).row();
    }

    const presets = [5_000, 10_000, 15_000, 20_000, 25_000, 30_000, 50_000];
    let addedCount = 0;
    presets.forEach((price) => {
      if (hasEstimation && price === order.estimatedPrice) return;
      keyboard.text(`Rp${price.toLocaleString('id-ID')}`, `done_tarif:${orderId}:${price}`);
      addedCount++;
      if (addedCount % 2 === 0) keyboard.row();
    });

    let text = `💰 <b>Tarif Final Pesanan #${order.orderNumber}</b>\n\n`;
    if (hasEstimation) {
      text += `Tarif yang ditawarkan user: <b>Rp${order.estimatedPrice.toLocaleString('id-ID')}</b>\n\n` +
        `Apakah sudah sesuai, atau ada perubahan yang disepakati?\n\n` +
        `Ketik nominal baru (hanya angka, contoh: <code>12000</code>), atau pilih salah satu tombol tarif di bawah ini:`;
    } else {
      text += `Tarif pesanan ini disepakati untuk ditentukan langsung oleh driver (Nego).\n\n` +
        `Silakan ketik nominal tarif final yang disepakati (hanya angka, contoh: <code>15000</code>), atau pilih salah satu tombol tarif di bawah ini:`;
    }

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // Driver chooses to use the estimated price
  bot.callbackQuery(/^done_estimasi:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Menggunakan tarif estimasi...');
    const orderId = ctx.match[1];
    const order = await getOrderById(orderId);
    if (!order || order.status !== 'RUNNING') return;

    await db.order.update({
      where: { id: orderId },
      data: { finalPrice: order.estimatedPrice }
    });

    await updateOrderStatus(orderId, 'DONE');

    const ratingKeyboard = new InlineKeyboard()
      .text('⭐ 1', `rate:${orderId}:1`)
      .text('⭐⭐ 2', `rate:${orderId}:2`)
      .text('⭐⭐⭐ 3', `rate:${orderId}:3`)
      .text('⭐⭐⭐⭐ 4', `rate:${orderId}:4`)
      .text('⭐⭐⭐⭐⭐ 5', `rate:${orderId}:5`);

    await notifyUser(
      order.user.telegramId,
      `✅ <b>Layanan selesai!</b>\n\n` +
      `Terima kasih sudah menggunakan ${botConfig.name} 🙏\n` +
      `• <b>Tarif Final:</b> Rp${order.estimatedPrice.toLocaleString('id-ID')}\n\n` +
      `Beri penilaian untuk <b>${order.freelancer?.user.name}</b>:`,
      { reply_markup: ratingKeyboard },
    );

    ctx.session.step = undefined;
    ctx.session.currentOrderId = undefined;

    await ctx.reply('✅ Pesanan ditandai selesai dengan tarif estimasi. Terima kasih!');
  });

  // Driver chooses a preset reference price button
  bot.callbackQuery(/^done_tarif:(.+):(\d+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const price = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery(`Menggunakan tarif Rp${price.toLocaleString('id-ID')}...`);
    const order = await getOrderById(orderId);
    if (!order || order.status !== 'RUNNING') return;

    await db.order.update({
      where: { id: orderId },
      data: { finalPrice: price }
    });

    await updateOrderStatus(orderId, 'DONE');

    const ratingKeyboard = new InlineKeyboard()
      .text('⭐ 1', `rate:${orderId}:1`)
      .text('⭐⭐ 2', `rate:${orderId}:2`)
      .text('⭐⭐⭐ 3', `rate:${orderId}:3`)
      .text('⭐⭐⭐⭐ 4', `rate:${orderId}:4`)
      .text('⭐⭐⭐⭐⭐ 5', `rate:${orderId}:5`);

    await notifyUser(
      order.user.telegramId,
      `✅ <b>Layanan selesai!</b>\n\n` +
      `Terima kasih sudah menggunakan ${botConfig.name} 🙏\n` +
      `• <b>Tarif Final (Disepakati):</b> Rp${price.toLocaleString('id-ID')}\n\n` +
      `Beri penilaian untuk <b>${order.freelancer?.user.name}</b>:`,
      { reply_markup: ratingKeyboard },
    );

    ctx.session.step = undefined;
    ctx.session.currentOrderId = undefined;

    await ctx.reply(`✅ Pesanan ditandai selesai dengan tarif <b>Rp${price.toLocaleString('id-ID')}</b>. Terima kasih!`, { parse_mode: 'HTML' });
  });

  // Driver inputs edit profile details text
  bot.on('message:text', async (ctx, next) => {
    const step = ctx.session.step;
    if (!step || !step.startsWith('profile:edit:')) return next();

    const text = ctx.message.text.trim();
    const telegramId = BigInt(ctx.from.id);

    const freelancer = await db.freelancer.findFirst({
      where: { user: { telegramId } },
      include: { user: true },
    });

    if (!freelancer || freelancer.status !== 'APPROVED') {
      ctx.session.step = undefined;
      return ctx.reply('❌ Anda tidak memiliki akses untuk mengubah profil freelancer.');
    }

    if (step === 'profile:edit:name') {
      if (!/^[a-zA-Z\s.,'-]+$/.test(text)) {
        return ctx.reply(
          '❌ <b>Nama tidak valid!</b>\n' +
          'Nama hanya boleh berisi huruf dan spasi (tidak boleh mengandung angka).\n\n' +
          'Silakan ketik kembali nama lengkap Anda yang baru:',
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
        );
      }
      await db.user.update({
        where: { id: freelancer.user.id },
        data: { name: text },
      });
    } else if (step === 'profile:edit:phone') {
      if (!/^[0-9]+$/.test(text)) {
        return ctx.reply(
          '❌ <b>Nomor HP tidak valid!</b>\n' +
          'Nomor HP hanya boleh berisi angka (tidak boleh ada huruf atau spasi).\n\n' +
          'Silakan ketik kembali nomor HP Anda yang baru:',
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
        );
      }
      await db.user.update({
        where: { id: freelancer.user.id },
        data: { phone: text },
      });
    } else if (step === 'profile:edit:username') {
      let usernameInput = text;
      if (usernameInput.startsWith('@')) {
        usernameInput = usernameInput.substring(1);
      }
      if (!/^[a-zA-Z0-9_]{5,32}$/.test(usernameInput)) {
        return ctx.reply(
          '❌ <b>Username Telegram tidak valid!</b>\n' +
          'Username Telegram harus terdiri dari 5-32 karakter alfanumerik (huruf, angka, garis bawah).\n\n' +
          'Silakan ketik kembali username Telegram Anda yang baru:',
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
        );
      }
      await db.user.update({
        where: { id: freelancer.user.id },
        data: { username: usernameInput },
      });
    } else if (step === 'profile:edit:emg_name') {
      if (!/^[a-zA-Z\s.,'-]+$/.test(text)) {
        return ctx.reply(
          '❌ <b>Nama kontak darurat tidak valid!</b>\n' +
          'Nama hanya boleh berisi huruf dan spasi (tidak boleh mengandung angka).\n\n' +
          'Silakan ketik kembali nama kontak darurat Anda yang baru:',
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
        );
      }
      await db.freelancer.update({
        where: { id: freelancer.id },
        data: { emergencyName: text },
      });
    } else if (step === 'profile:edit:emg_phone') {
      if (!/^[0-9]+$/.test(text)) {
        return ctx.reply(
          '❌ <b>Nomor HP tidak valid!</b>\n' +
          'Nomor HP hanya boleh berisi angka (tidak boleh ada huruf atau spasi).\n\n' +
          'Silakan ketik kembali nomor HP kontak darurat Anda yang baru:',
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Batal', 'profile:edit:cancel') }
        );
      }
      await db.freelancer.update({
        where: { id: freelancer.id },
        data: { emergencyPhone: text },
      });
    }

    ctx.session.step = undefined;

    // Trigger websocket stats broadcast
    broadcastStats().catch(console.error);

    const updatedFreelancer = await db.freelancer.findFirst({
      where: { id: freelancer.id },
      include: { user: true },
    });

    const statusLabel: Record<string, string> = {
      PENDING: '⏳ Menunggu verifikasi', APPROVED: '✅ Aktif',
      SUSPENDED: '🚫 Disuspend', BANNED: '⛔ Dibanned',
    };

    const usernameStr = updatedFreelancer?.user.username
      ? `@${updatedFreelancer.user.username}`
      : '<i>(Belum diatur)</i>';

    const phoneStr = updatedFreelancer?.user.phone
      ? updatedFreelancer.user.phone
      : '<i>(Belum diatur)</i>';

    await ctx.reply(
      `✅ <b>Profil berhasil diperbarui!</b>\n\n` +
      `👤 <b>Profil Freelancer Baru:</b>\n` +
      `• <b>Nama:</b> ${updatedFreelancer?.user.name}\n` +
      `• <b>No. HP:</b> ${phoneStr}\n` +
      `• <b>Username Telegram:</b> ${usernameStr}\n` +
      `• <b>Status:</b> ${statusLabel[updatedFreelancer?.status || 'PENDING']}\n` +
      `• <b>Rating:</b> ${updatedFreelancer?.avgRating.toFixed(1)} / 5.0\n` +
      `• <b>Total Order:</b> ${updatedFreelancer?.totalOrders}\n` +
      `• <b>Risk Score:</b> ${updatedFreelancer?.riskScore}/100\n` +
      `• <b>Kontak Darurat:</b> ${updatedFreelancer?.emergencyName} (${updatedFreelancer?.emergencyPhone})`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('✏️ Edit Profil Lagi', 'profile:edit').row()
          .text('🏠 Menu Utama', 'menu:home')
      }
    );
  });

  // Driver inputs a custom final price text
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step !== 'order:final_price' || !ctx.session.currentOrderId) return next();

    const text = ctx.message.text.trim();
    const parsedPrice = parseInt(text);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return ctx.reply(
        '❌ <b>Nominal tarif tidak valid!</b>\n' +
        'Harap masukkan angka saja (misal: 15000) tanpa huruf, spasi, atau simbol mata uang.'
      );
    }

    const orderId = ctx.session.currentOrderId;
    const order = await getOrderById(orderId);
    if (!order || order.status !== 'RUNNING') {
      ctx.session.step = undefined;
      ctx.session.currentOrderId = undefined;
      return ctx.reply('❌ Pesanan tidak valid atau sudah selesai.');
    }

    await db.order.update({
      where: { id: orderId },
      data: { finalPrice: parsedPrice }
    });

    await updateOrderStatus(orderId, 'DONE');

    const ratingKeyboard = new InlineKeyboard()
      .text('⭐ 1', `rate:${orderId}:1`)
      .text('⭐⭐ 2', `rate:${orderId}:2`)
      .text('⭐⭐⭐ 3', `rate:${orderId}:3`)
      .text('⭐⭐⭐⭐ 4', `rate:${orderId}:4`)
      .text('⭐⭐⭐⭐⭐ 5', `rate:${orderId}:5`);

    await notifyUser(
      order.user.telegramId,
      `✅ <b>Layanan selesai!</b>\n\n` +
      `Terima kasih sudah menggunakan ${botConfig.name} 🙏\n` +
      `• <b>Tarif Final (Disepakati):</b> Rp${parsedPrice.toLocaleString('id-ID')}\n\n` +
      `Beri penilaian untuk <b>${order.freelancer?.user.name}</b>:`,
      { reply_markup: ratingKeyboard },
    );

    ctx.session.step = undefined;
    ctx.session.currentOrderId = undefined;

    await ctx.reply(
      `✅ Pesanan ditandai selesai dengan tarif <b>Rp${parsedPrice.toLocaleString('id-ID')}</b>. Terima kasih!`,
      { parse_mode: 'HTML' }
    );
  });

  // User cancels active order
  bot.callbackQuery(/^cancel_order:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery('Membatalkan pesanan...');
    const orderId = ctx.match[1];
    const order = await getOrderById(orderId);
    if (!order) return ctx.reply('❌ Pesanan tidak ditemukan.');

    const dbUser = await db.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!dbUser || order.userId !== dbUser.id) {
      return ctx.reply('❌ Kamu tidak berwenang membatalkan pesanan ini.');
    }

    if (order.status === 'DONE' || order.status === 'CANCELLED') {
      return ctx.reply('❌ Pesanan sudah selesai atau sudah dibatalkan sebelumnya.');
    }

    await updateOrderStatus(orderId, 'CANCELLED', 'Dibatalkan oleh pemesan');

    // Notify freelancer if matched or running
    if (order.freelancer?.user?.telegramId) {
      await notifyUser(
        order.freelancer.user.telegramId,
        `⚠️ <b>Pesanan #${order.orderNumber} telah dibatalkan oleh pemesan.</b>`,
      ).catch(() => {});
    }

    await ctx.reply(
      `❌ <b>Pesanan #${order.orderNumber} berhasil dibatalkan.</b>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') }
    );
  });

  // /skip command for rating comment
  bot.command('skip', async (ctx) => {
    if (ctx.session.step !== 'order:rating_comment' || !ctx.session.currentOrderId) {
      return ctx.reply('❌ Perintah ini hanya dapat digunakan saat memberikan ulasan pesanan.');
    }

    ctx.session.step = undefined;
    ctx.session.currentOrderId = undefined;

    await ctx.reply(
      '✨ <b>Terima kasih atas penilaian Anda!</b>',
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') }
    );
  });

  // Capture rating comment text
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step !== 'order:rating_comment' || !ctx.session.currentOrderId) return next();

    const text = ctx.message.text.trim();
    const orderId = ctx.session.currentOrderId;

    ctx.session.step = undefined;
    ctx.session.currentOrderId = undefined;

    if (text.toLowerCase() === '/skip') {
      return ctx.reply(
        '✨ <b>Terima kasih atas penilaian Anda!</b>',
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') }
      );
    }

    // Save comment to order
    await db.order.update({
      where: { id: orderId },
      data: { ratingComment: text }
    });

    await ctx.reply(
      '✨ <b>Ulasan Anda berhasil disimpan!</b>\nTerima kasih atas masukan berharga Anda.',
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') }
    );
  });
}
