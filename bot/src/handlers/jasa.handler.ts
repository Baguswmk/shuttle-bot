import { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot';
import { db } from '../db';
import { createOrder, getActiveOrderByTelegramId } from '../services/order.service';
import { matchOrder } from '../services/matching.service';

// ── Constants ─────────────────────────────────────────────────────────────────
const JASA_TYPES = [
  { label: '🐾 Buang/antar hewan', value: 'HEWAN'   },
  { label: '📦 Antar barang',      value: 'BARANG'  },
  { label: '🧹 Jasa lainnya',      value: 'LAINNYA' },
];

const PRICES = [15_000, 20_000, 25_000, 30_000, 50_000, 75_000];

function fmtRp(amount: number) {
  if (amount === 0) return 'Biar Driver Tentukan (Nego)';
  return `Rp${amount.toLocaleString('id-ID')}`;
}

function buildPriceKeyboard() {
  const kb = new InlineKeyboard();
  PRICES.forEach((price, i) => {
    kb.text(fmtRp(price), `jasa:price:${price}`);
    if (i % 2 === 1) kb.row();
  });
  return kb.row()
    .text('✏️ Ketik nominal lain', 'jasa:price:manual').row()
    .text('🤝 Biar Driver Tentukan (Nego)', 'jasa:price:0');
}

export function registerJasaHandler(bot: Bot<BotContext>) {
  // ── Entry ──────────────────────────────────────────────────────────────────
  bot.callbackQuery('menu:jasa', async (ctx) => {
    await ctx.answerCallbackQuery();

    const active = await getActiveOrderByTelegramId(BigInt(ctx.from.id));
    if (active) {
      return ctx.reply(
        `❌ <b>Kamu tidak dapat membuat pesanan baru!</b>\n\n` +
        `Kamu masih memiliki pesanan aktif (#${active.orderNumber}). Selesaikan atau batalkan terlebih dahulu.`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
      );
    }

    ctx.session.step       = 'jasa:type';
    ctx.session.orderDraft = { type: 'JASA' };

    const keyboard = new InlineKeyboard();
    JASA_TYPES.forEach((j) => keyboard.text(j.label, `jasa:type:${j.value}`).row());
    keyboard.text('⬅️ Kembali', 'menu:home');

    await ctx.reply(
      '✨ <b>Jasa Lainnya</b>\n\nPilih jenis jasa:',
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // ── Step 1: type selected ─────────────────────────────────────────────────
  bot.callbackQuery(/^jasa:type:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const val  = ctx.match[1];
    const jasa = JASA_TYPES.find((j) => j.value === val);
    ctx.session.orderDraft!.jasaType = val;
    ctx.session.step = 'jasa:detail';

    await ctx.reply(
      `${jasa?.label}\n\nDeskripsikan kebutuhanmu:\n<i>Contoh: Kucing sakit, mau diantar ke RSHP Banyumanik</i>`,
      { parse_mode: 'HTML' },
    );
  });

  // ── Step 2: detail text → show price picker ───────────────────────────────
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step !== 'jasa:detail') return next();
    const draft      = ctx.session.orderDraft!;
    draft.jasaDetail = ctx.message.text;
    ctx.session.step = 'jasa:price';

    await ctx.reply(
      `✅ Detail diterima!\n\n` +
      `💰 <b>Berapa harga yang kamu tawarkan ke driver?</b>\n` +
      `<i>Driver akan melihat tawaran ini sebelum memutuskan untuk menerima.</i>`,
      { parse_mode: 'HTML', reply_markup: buildPriceKeyboard() },
    );
  });

  // ── Step 3a: preset price selected ────────────────────────────────────────
  bot.callbackQuery(/^jasa:price:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const price = parseInt(ctx.match[1]);
    const draft = ctx.session.orderDraft!;
    draft.estimatedPrice = price;
    ctx.session.step     = 'jasa:confirm';

    const jasa = JASA_TYPES.find((j) => j.value === draft.jasaType);
    const keyboard = new InlineKeyboard()
      .text('✅ Konfirmasi & Lihat Perjanjian', 'jasa:confirm').row()
      .text('❌ Batalkan', 'menu:home');

    await ctx.reply(
      `📋 <b>Detail Jasa</b>\n\n` +
      `🔧 <b>Jenis:</b> ${jasa?.label}\n` +
      `📝 <b>Detail:</b> ${draft.jasaDetail}\n` +
      `💰 <b>Tawaran harga:</b> ${fmtRp(price)}`,
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // ── Step 3b: manual price – trigger ───────────────────────────────────────
  bot.callbackQuery('jasa:price:manual', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'jasa:price:manual';

    await ctx.reply(
      `✏️ <b>Ketik nominal harga</b>\n\n` +
      `Masukkan harga yang ingin kamu tawarkan ke driver (hanya angka, minimal Rp1.000):\n` +
      `<i>Contoh: 35000</i>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Kembali', 'jasa:price:back') },
    );
  });

  bot.callbackQuery('jasa:price:back', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'jasa:price';
    await ctx.reply(
      `💰 <b>Pilih harga yang ditawarkan ke driver:</b>`,
      { parse_mode: 'HTML', reply_markup: buildPriceKeyboard() },
    );
  });

  // ── Step 3b: manual price – text input ────────────────────────────────────
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step !== 'jasa:price:manual') return next();

    const price = parseInt(ctx.message.text.trim().replace(/\D/g, ''));

    if (isNaN(price) || price < 1_000) {
      return ctx.reply(
        `❌ <b>Nominal tidak valid!</b>\nMasukkan angka tanpa titik/koma, minimal Rp1.000.\n<i>Contoh: 35000</i>`,
        { parse_mode: 'HTML' },
      );
    }

    const draft = ctx.session.orderDraft!;
    draft.estimatedPrice = price;
    ctx.session.step     = 'jasa:confirm';

    const jasa = JASA_TYPES.find((j) => j.value === draft.jasaType);
    const keyboard = new InlineKeyboard()
      .text('✅ Konfirmasi & Lihat Perjanjian', 'jasa:confirm').row()
      .text('❌ Batalkan', 'menu:home');

    await ctx.reply(
      `📋 <b>Detail Jasa</b>\n\n` +
      `🔧 <b>Jenis:</b> ${jasa?.label}\n` +
      `📝 <b>Detail:</b> ${draft.jasaDetail}\n` +
      `💰 <b>Tawaran harga:</b> ${fmtRp(price)}`,
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // ── Step 4: contract screen ───────────────────────────────────────────────
  bot.callbackQuery('jasa:confirm', async (ctx) => {
    await ctx.answerCallbackQuery();
    const draft = ctx.session.orderDraft!;
    const jasa  = JASA_TYPES.find((j) => j.value === draft.jasaType);

    const keyboard = new InlineKeyboard()
      .text('✅ Setuju & Buat Pesanan', 'jasa:create').row()
      .text('❌ Tolak', 'menu:home');

    await ctx.reply(
      `📄 <b>Perjanjian Digital</b>\n──────────────────\n` +
      `<b>Layanan:</b> Jasa Lainnya\n` +
      `<b>Jenis:</b> ${jasa?.label}\n` +
      `<b>Detail:</b> ${draft.jasaDetail}\n` +
      `<b>Tawaran harga:</b> ${fmtRp(draft.estimatedPrice!)}\n` +
      `──────────────────\n\n` +
      `✓ Freelancer wajib menyelesaikan sesuai deskripsi\n` +
      `✓ Pengguna bertanggung jawab atas keakuratan detail\n` +
      `✓ Transaksi tercatat sebagai bukti hukum`,
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // ── Step 5: create order ──────────────────────────────────────────────────
  bot.callbackQuery('jasa:create', async (ctx) => {
    await ctx.answerCallbackQuery('Membuat pesanan...');
    const user = await db.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return;

    const draft = ctx.session.orderDraft!;
    const order = await createOrder({
      userId:         user.id,
      type:           'JASA',
      jasaType:       draft.jasaType,
      jasaDetail:     draft.jasaDetail,
      estimatedPrice: draft.estimatedPrice!,
    });

    ctx.session.orderDraft     = {};
    ctx.session.step           = undefined;
    ctx.session.currentOrderId = order.id;

    await ctx.reply(
      `✅ <b>Pesanan #${order.orderNumber} dibuat!</b>\n🔍 Mencari driver...`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
    );

    matchOrder(order.id).catch(console.error);
  });
}
