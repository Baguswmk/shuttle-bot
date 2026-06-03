import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import type { BotContext } from '../bot';
import { db } from '../db';
import { botConfig } from '../bot.config';
import { createOrder, getActiveOrderByTelegramId } from '../services/order.service';
import { matchOrder } from '../services/matching.service';

// ── Price presets ─────────────────────────────────────────────────────────────
const PRICES = [5_000, 10_000, 15_000, 20_000, 25_000, 30_000];

function fmtRp(amount: number) {
  if (amount === 0) return 'Biar Driver Tentukan (Nego)';
  return `Rp${amount.toLocaleString('id-ID')}`;
}

function buildPriceKeyboard() {
  const kb = new InlineKeyboard();
  PRICES.forEach((price, i) => {
    kb.text(fmtRp(price), `anjem:price:${price}`);
    if (i % 2 === 1) kb.row();
  });
  return kb.row()
    .text('✏️ Ketik nominal lain', 'anjem:price:manual').row()
    .text('🤝 Biar Driver Tentukan (Nego)', 'anjem:price:0');
}

function buildConfirmSummary(draft: {
  pickupLocation?: string;
  dropLocation?: string;
  passengerCount?: number;
  estimatedPrice?: number;
}) {
  return (
    `📋 <b>Detail Pesanan</b>\n\n` +
    `📍 <b>Jemput:</b> ${draft.pickupLocation}\n` +
    `📍 <b>Tujuan:</b> ${draft.dropLocation}\n` +
    `👥 <b>Penumpang:</b> ${draft.passengerCount} orang\n` +
    `💰 <b>Tawaran harga:</b> ${fmtRp(draft.estimatedPrice!)}`
  );
}

export function registerAnjemHandler(bot: Bot<BotContext>) {
  // ── Entry ──────────────────────────────────────────────────────────────────
  bot.callbackQuery('menu:anjem', async (ctx) => {
    await ctx.answerCallbackQuery();

    const active = await getActiveOrderByTelegramId(BigInt(ctx.from.id));
    if (active) {
      return ctx.reply(
        `❌ <b>Kamu tidak dapat membuat pesanan baru!</b>\n\n` +
        `Kamu masih memiliki pesanan aktif (#${active.orderNumber}). Selesaikan atau batalkan terlebih dahulu.`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
      );
    }

    ctx.session.step       = 'anjem:pickup';
    ctx.session.orderDraft = { type: 'ANJEM' };

    const keyboard = new Keyboard()
      .requestLocation('📍 Kirim Lokasi GPS Saya')
      .placeholder('Atau ketik lokasi jemput...')
      .oneTime()
      .resized();

    await ctx.reply(
      `🚗 <b>Antar Jemput</b>\n\nKetik <b>lokasi jemput</b> kamu atau klik tombol di bawah untuk mengirim lokasi GPS:`,
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // ── Step 1: pickup location ────────────────────────────────────────────────
  bot.on(['message:text', 'message:location'], async (ctx, next) => {
    if (ctx.session.step !== 'anjem:pickup') return next();

    let pickup = '';
    if (ctx.message?.location) {
      const { latitude, longitude } = ctx.message.location;
      pickup = `📍 GPS (${latitude.toFixed(6)}, ${longitude.toFixed(6)}) - https://maps.google.com/?q=${latitude},${longitude}`;
    } else if (ctx.message?.text) {
      pickup = ctx.message.text;
    } else {
      return next();
    }

    ctx.session.orderDraft!.pickupLocation = pickup;
    ctx.session.step = 'anjem:drop';

    const keyboard = new Keyboard()
      .requestLocation('📍 Kirim Lokasi GPS Tujuan')
      .placeholder('Atau ketik lokasi tujuan...')
      .oneTime()
      .resized();

    await ctx.reply(
      `📍 <b>Jemput:</b> ${pickup}\n\nSekarang ketik <b>tujuan</b> kamu, atau kirim lokasi GPS tujuan:`,
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // ── Step 2: drop location ─────────────────────────────────────────────────
  bot.on(['message:text', 'message:location'], async (ctx, next) => {
    if (ctx.session.step !== 'anjem:drop') return next();

    let drop = '';
    if (ctx.message?.location) {
      const { latitude, longitude } = ctx.message.location;
      drop = `📍 GPS (${latitude.toFixed(6)}, ${longitude.toFixed(6)}) - https://maps.google.com/?q=${latitude},${longitude}`;
    } else if (ctx.message?.text) {
      drop = ctx.message.text;
    } else {
      return next();
    }

    ctx.session.orderDraft!.dropLocation = drop;
    ctx.session.step = 'anjem:passengers';

    const inlineKeyboard = new InlineKeyboard()
      .text('1 orang', 'anjem:pax:1')
      .text('2 orang', 'anjem:pax:2')
      .text('3 orang', 'anjem:pax:3');

    // Cleanly remove the reply keyboard by sending a transient status message
    const statusMsg = await ctx.reply(`🔄 Memproses lokasi tujuan...`, {
      reply_markup: { remove_keyboard: true }
    });
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

    await ctx.reply(
      `📍 <b>Tujuan:</b> ${drop}\n\n👥 <b>Berapa penumpang?</b>`,
      { parse_mode: 'HTML', reply_markup: inlineKeyboard }
    );
  });

  // ── Step 3: passenger count → show price picker ───────────────────────────
  bot.callbackQuery(/^anjem:pax:(\d)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const pax = parseInt(ctx.match[1]);
    ctx.session.orderDraft!.passengerCount = pax;
    ctx.session.step = 'anjem:price';

    await ctx.reply(
      `👥 Penumpang: <b>${pax} orang</b>\n\n` +
      `💰 <b>Berapa harga yang kamu tawarkan ke driver?</b>\n` +
      `<i>Driver akan melihat tawaran ini sebelum memutuskan untuk menerima.</i>`,
      { parse_mode: 'HTML', reply_markup: buildPriceKeyboard() },
    );
  });

  // ── Step 4a: preset price selected ────────────────────────────────────────
  bot.callbackQuery(/^anjem:price:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const price = parseInt(ctx.match[1]);
    const draft = ctx.session.orderDraft!;
    draft.estimatedPrice = price;
    ctx.session.step     = 'anjem:confirm';

    const keyboard = new InlineKeyboard()
      .text('✅ Konfirmasi & Lihat Perjanjian', 'anjem:confirm').row()
      .text('❌ Batalkan', 'menu:home');

    await ctx.reply(buildConfirmSummary(draft), { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // ── Step 4b: manual price – trigger ───────────────────────────────────────
  bot.callbackQuery('anjem:price:manual', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'anjem:price:manual';

    await ctx.reply(
      `✏️ <b>Ketik nominal harga</b>\n\n` +
      `Masukkan harga yang ingin kamu tawarkan ke driver (hanya angka, minimal Rp1.000):\n` +
      `<i>Contoh: 12000</i>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Kembali', 'anjem:price:back') },
    );
  });

  bot.callbackQuery('anjem:price:back', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'anjem:price';
    await ctx.reply(
      `💰 <b>Pilih harga yang ditawarkan ke driver:</b>`,
      { parse_mode: 'HTML', reply_markup: buildPriceKeyboard() },
    );
  });

  // ── Step 4b: manual price – text input ────────────────────────────────────
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step !== 'anjem:price:manual') return next();

    const price = parseInt(ctx.message.text.trim().replace(/\D/g, ''));

    if (isNaN(price) || price < 1_000) {
      return ctx.reply(
        `❌ <b>Nominal tidak valid!</b>\nMasukkan angka tanpa titik/koma, minimal Rp1.000.\n<i>Contoh: 12000</i>`,
        { parse_mode: 'HTML' },
      );
    }

    const draft = ctx.session.orderDraft!;
    draft.estimatedPrice = price;
    ctx.session.step     = 'anjem:confirm';

    const keyboard = new InlineKeyboard()
      .text('✅ Konfirmasi & Lihat Perjanjian', 'anjem:confirm').row()
      .text('❌ Batalkan', 'menu:home');

    await ctx.reply(buildConfirmSummary(draft), { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // ── Step 5: show contract ─────────────────────────────────────────────────
  bot.callbackQuery('anjem:confirm', async (ctx) => {
    await ctx.answerCallbackQuery();
    const draft = ctx.session.orderDraft!;

    const keyboard = new InlineKeyboard()
      .text('✅ Setuju & Buat Pesanan', 'anjem:create').row()
      .text('❌ Tolak', 'menu:home');

    await ctx.reply(
      `📄 <b>Perjanjian Digital</b>\n` +
      `──────────────────\n` +
      `<b>Layanan:</b> Antar Jemput\n` +
      `<b>Jemput:</b> ${draft.pickupLocation}\n` +
      `<b>Tujuan:</b> ${draft.dropLocation}\n` +
      `<b>Penumpang:</b> ${draft.passengerCount} orang\n` +
      `<b>Tawaran harga:</b> ${fmtRp(draft.estimatedPrice!)}\n` +
      `──────────────────\n\n` +
      `✓ Freelancer wajib mengantar ke tujuan\n` +
      `✓ Pengguna wajib membayar sesuai kesepakatan\n` +
      `✓ Transaksi tercatat sebagai bukti hukum\n` +
      `✓ Pelanggaran dapat dilaporkan & ditindak\n\n` +
      `<i>Dengan menekan Setuju, kamu menyetujui perjanjian ini.</i>`,
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // ── Step 6: create order ──────────────────────────────────────────────────
  bot.callbackQuery('anjem:create', async (ctx) => {
    await ctx.answerCallbackQuery('Membuat pesanan...');

    const draft = ctx.session.orderDraft;
    if (!draft || !draft.type || draft.estimatedPrice === undefined) {
      await ctx.editMessageReplyMarkup().catch(() => {});
      return ctx.reply(
        '❌ <b>Pesanan tidak valid atau sudah diproses.</b>',
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') }
      );
    }

    const active = await getActiveOrderByTelegramId(BigInt(ctx.from.id));
    if (active) {
      await ctx.editMessageReplyMarkup().catch(() => {});
      return ctx.reply(
        `❌ <b>Kamu tidak dapat membuat pesanan baru!</b>\n\n` +
        `Kamu masih memiliki pesanan aktif (#${active.orderNumber}). Selesaikan atau batalkan terlebih dahulu.`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
      );
    }

    const user = await db.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return;

    // Remove buttons to prevent multiple clicks
    await ctx.editMessageReplyMarkup().catch(() => {});

    const order = await createOrder({
      userId:         user.id,
      type:           'ANJEM',
      pickupLocation: draft.pickupLocation,
      dropLocation:   draft.dropLocation,
      passengerCount: draft.passengerCount,
      estimatedPrice: draft.estimatedPrice!,
    });

    ctx.session.orderDraft     = {};
    ctx.session.step           = undefined;
    ctx.session.currentOrderId = order.id;

    await ctx.reply(
      `✅ <b>Pesanan #${order.orderNumber} dibuat!</b>\n\n🔍 Mencari driver...\n<i>Kamu akan dinotifikasi saat driver ditemukan.</i>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
    );

    matchOrder(order.id).catch(console.error);
  });
}
