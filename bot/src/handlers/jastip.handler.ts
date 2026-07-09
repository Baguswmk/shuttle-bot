import { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot';
import { db } from '../db';
import { createOrder, getActiveOrderByTelegramId } from '../services/order.service';
import { matchOrder } from '../services/matching.service';

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: '🍱 Beli makan',        value: 'MAKAN'   },
  { label: '🧃 Jajan/minuman',     value: 'MINUMAN' },
  { label: '💊 Obat/apotek',       value: 'OBAT'    },
  { label: '📦 Barang umum',       value: 'BARANG'  },
  { label: '🐾 Buang/antar hewan', value: 'HEWAN'   },
  { label: '🔧 Lainnya',           value: 'LAINNYA' },
];

const PRICES_PER_LOC = [10_000, 15_000, 20_000, 25_000, 30_000, 50_000];

/** Safety cap — prevents absurdly long orders */
const MAX_LOCATIONS = 8;

// ── Helpers ───────────────────────────────────────────────────────────────────
type Location = { detail: string; price: number };

function fmtRp(n: number) {
  if (n === 0) return 'Biar Driver Tentukan (Nego)';
  return `Rp${n.toLocaleString('id-ID')}`;
}

function getCat(value?: string) {
  return CATEGORIES.find((c) => c.value === value);
}

function buildPriceKeyboard() {
  const kb = new InlineKeyboard();
  PRICES_PER_LOC.forEach((price, i) => {
    kb.text(fmtRp(price), `jastip:price:${price}`);
    if (i % 2 === 1) kb.row();
  });
  return kb.row()
    .text('✏️ Ketik nominal lain', 'jastip:price:manual').row()
    .text('🤝 Biar Driver Tentukan (Nego)', 'jastip:price:0');
}

/** After each location is done, ask if user wants to add more */
function buildAddMoreKeyboard(count: number) {
  return new InlineKeyboard()
    .text('➕ Tambah Tempat Lagi', 'jastip:add_more').row()
    .text(`✅ Selesai — ${count} Tempat`, 'jastip:done_adding').row()
    .text('❌ Batalkan', 'menu:home');
}

/** Inline summary of locations collected so far */
function buildLocationsSummary(locs: Location[]): string {
  if (locs.length === 1) {
    return `📝 <b>Detail:</b> ${locs[0].detail}\n💰 <b>Tawaran:</b> ${fmtRp(locs[0].price)}`;
  }
  let s = '';
  locs.forEach((l, i) => {
    s += `📍 <b>Tempat ${i + 1}:</b> ${l.detail}\n    └ ${fmtRp(l.price)}\n`;
  });
  const total = locs.reduce((sum, l) => sum + l.price, 0);
  return s + `\n💰 <b>Total Tawaran: ${fmtRp(total)}</b>`;
}

/** Encode locations for DB storage in jastipDetail field */
function encodeLocations(locs: Location[]): string {
  if (locs.length === 1) return locs[0].detail;
  return locs.map((l, i) => `[Tempat ${i + 1}] ${l.detail} (${fmtRp(l.price)})`).join('\n');
}

// ── Handler registration ───────────────────────────────────────────────────────
export function registerJastipHandler(bot: Bot<BotContext>) {

  // ── Entry ──────────────────────────────────────────────────────────────────
  bot.callbackQuery('menu:jastip', async (ctx) => {
    await ctx.answerCallbackQuery();

    const active = await getActiveOrderByTelegramId(BigInt(ctx.from.id));
    if (active) {
      return ctx.reply(
        `❌ <b>Kamu tidak dapat membuat pesanan baru!</b>\n\n` +
        `Kamu masih memiliki pesanan aktif (#${active.orderNumber}). Selesaikan atau batalkan terlebih dahulu.`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
      );
    }

    ctx.session.step       = 'jastip:category';
    ctx.session.orderDraft = { type: 'JASTIP', jastipLocations: [] };

    const keyboard = new InlineKeyboard();
    CATEGORIES.forEach((c) => keyboard.text(c.label, `jastip:cat:${c.value}`).row());
    keyboard.text('⬅️ Kembali', 'menu:home');

    await ctx.reply(
      '🛍 <b>Jastip</b>\n\nMau titip apa? Pilih kategori:',
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // ── Step 1: Category selected → ask for first location detail ─────────────
  bot.callbackQuery(/^jastip:cat:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const cat = getCat(ctx.match[1]);
    ctx.session.orderDraft!.jastipCategory = ctx.match[1];
    ctx.session.step = 'jastip:detail';

    await ctx.reply(
      `${cat?.label}\n\n` +
      `📝 <b>Tulis detail Tempat 1:</b>\n` +
      `<i>Contoh: Warung Bu Sri — nasi ayam goreng + es teh, tanpa sambal</i>`,
      { parse_mode: 'HTML' },
    );
  });

  // ── Step 2: Location detail entered ──────────────────────────────────────
  // Works for ALL locations (1st, 2nd, 3rd, ...) because step is always 'jastip:detail'
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step !== 'jastip:detail') return next();

    const draft  = ctx.session.orderDraft!;
    const locs   = draft.jastipLocations!;
    const locNum = locs.length + 1;

    // Push placeholder (price = 0, will be set in next step)
    locs.push({ detail: ctx.message.text, price: 0 });
    ctx.session.step = 'jastip:price';

    await ctx.reply(
      `✅ Detail Tempat ${locNum} diterima!\n\n` +
      `💰 <b>Berapa harga untuk Tempat ${locNum}?</b>`,
      { parse_mode: 'HTML', reply_markup: buildPriceKeyboard() },
    );
  });

  // ── Step 3a: Preset price selected ────────────────────────────────────────
  bot.callbackQuery(/^jastip:price:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const price = parseInt(ctx.match[1]);
    await handlePriceSet(ctx, price);
  });

  // ── Step 3b: Manual price – trigger ───────────────────────────────────────
  bot.callbackQuery('jastip:price:manual', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'jastip:price:manual';

    await ctx.reply(
      `✏️ <b>Ketik nominal harga</b>\n\n` +
      `Masukkan harga (hanya angka, minimal Rp1.000):\n<i>Contoh: 22000</i>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Kembali', 'jastip:price:back') },
    );
  });

  bot.callbackQuery('jastip:price:back', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.step = 'jastip:price';
    await ctx.reply(
      `💰 <b>Pilih harga:</b>`,
      { parse_mode: 'HTML', reply_markup: buildPriceKeyboard() },
    );
  });

  // ── Step 3b: Manual price – text input ────────────────────────────────────
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step !== 'jastip:price:manual') return next();

    const price = parseInt(ctx.message.text.trim().replace(/\D/g, ''));
    if (isNaN(price) || price < 1_000 || price > 999_999_999) {
      return ctx.reply(
        `❌ <b>Nominal tidak valid!</b>\nMasukkan angka tanpa titik/koma, minimal Rp1.000 dan maksimal Rp999.999.999.\n<i>Contoh: 22000</i>`,
        { parse_mode: 'HTML' },
      );
    }

    await handlePriceSet(ctx, price);
  });

  // ── Step 4: Add more location ─────────────────────────────────────────────
  bot.callbackQuery('jastip:add_more', async (ctx) => {
    await ctx.answerCallbackQuery();
    const locs = ctx.session.orderDraft!.jastipLocations!;
    ctx.session.step = 'jastip:detail';

    await ctx.reply(
      `📝 <b>Tulis detail Tempat ${locs.length + 1}:</b>`,
      { parse_mode: 'HTML' },
    );
  });

  // ── Step 4 alt: Done adding → show full summary ───────────────────────────
  bot.callbackQuery('jastip:done_adding', async (ctx) => {
    await ctx.answerCallbackQuery();
    const draft = ctx.session.orderDraft!;
    draft.estimatedPrice = draft.jastipLocations!.reduce((sum, l) => sum + l.price, 0);
    ctx.session.step = 'jastip:confirm';
    await showJastipSummary(ctx, draft);
  });

  // ── Step 5: Contract screen ───────────────────────────────────────────────
  bot.callbackQuery('jastip:confirm', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showJastipContract(ctx, ctx.session.orderDraft!);
  });

  // ── Step 6: Create order ──────────────────────────────────────────────────
  bot.callbackQuery('jastip:create', async (ctx) => {
    await ctx.answerCallbackQuery('Membuat pesanan...');

    const draft = ctx.session.orderDraft;
    if (!draft || !draft.type || draft.estimatedPrice === undefined || !draft.jastipLocations) {
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

    const locs  = draft.jastipLocations;
    const order = await createOrder({
      userId:         user.id,
      type:           'JASTIP',
      jastipCategory: draft.jastipCategory,
      jastipDetail:   encodeLocations(locs),
      estimatedPrice: draft.estimatedPrice!,
    });

    ctx.session.orderDraft     = {};
    ctx.session.step           = undefined;
    ctx.session.currentOrderId = order.id;

    await ctx.reply(
      `✅ <b>Jastip #${order.orderNumber} dibuat!</b>\n🔍 Mencari driver...`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
    );

    matchOrder(order.id).catch(console.error);
  });
}

// ── Shared price-set logic ────────────────────────────────────────────────────
async function handlePriceSet(ctx: any, price: number) {
  const draft = ctx.session.orderDraft!;
  const locs  = draft.jastipLocations! as Location[];

  // Fill in price for the last (just-entered) location
  locs[locs.length - 1].price = price;

  // If max locations reached, force finish
  if (locs.length >= MAX_LOCATIONS) {
    draft.estimatedPrice = locs.reduce((sum, l) => sum + l.price, 0);
    ctx.session.step = 'jastip:confirm';
    await ctx.reply(
      `⚠️ Batas maksimum ${MAX_LOCATIONS} tempat tercapai.\n\n` +
      buildLocationsSummary(locs),
      { parse_mode: 'HTML' },
    );
    await showJastipSummary(ctx, draft);
    return;
  }

  // Show location summary so far + ask if they want more
  ctx.session.step = 'jastip:adding';

  await ctx.reply(
    `✅ <b>Tempat ${locs.length} ditambahkan!</b>\n\n` +
    `📋 <b>Ringkasan:</b>\n${buildLocationsSummary(locs)}\n\n` +
    `Mau tambah tempat lagi?`,
    { parse_mode: 'HTML', reply_markup: buildAddMoreKeyboard(locs.length) },
  );
}

// ── Pre-confirm summary ───────────────────────────────────────────────────────
async function showJastipSummary(ctx: any, draft: any) {
  const cat  = getCat(draft.jastipCategory);
  const locs = draft.jastipLocations as Location[];

  const keyboard = new InlineKeyboard()
    .text('✅ Konfirmasi & Lihat Perjanjian', 'jastip:confirm').row()
    .text('❌ Batalkan', 'menu:home');

  await ctx.reply(
    `📋 <b>Ringkasan Jastip</b>\n\n` +
    `📂 <b>Kategori:</b> ${cat?.label}\n` +
    buildLocationsSummary(locs),
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}

// ── Contract screen ───────────────────────────────────────────────────────────
async function showJastipContract(ctx: any, draft: any) {
  const cat    = getCat(draft.jastipCategory);
  const locs   = draft.jastipLocations as Location[];
  const isMulti = locs.length > 1;

  let detailBlock = '';
  if (isMulti) {
    locs.forEach((l, i) => {
      detailBlock += `<b>Tempat ${i + 1}:</b> ${l.detail} — ${fmtRp(l.price)}\n`;
    });
    detailBlock += `<b>Total:</b> ${fmtRp(locs.reduce((s, l) => s + l.price, 0))}\n`;
  } else {
    detailBlock = `<b>Detail:</b> ${locs[0].detail}\n<b>Tawaran harga:</b> ${fmtRp(locs[0].price)}\n`;
  }

  const keyboard = new InlineKeyboard()
    .text('✅ Setuju & Buat Pesanan', 'jastip:create').row()
    .text('❌ Tolak', 'menu:home');

  await ctx.reply(
    `📄 <b>Perjanjian Digital</b>\n──────────────────\n` +
    `<b>Layanan:</b> Jastip${isMulti ? ` (${locs.length} Tempat)` : ''}\n` +
    `<b>Kategori:</b> ${cat?.label}\n` +
    detailBlock +
    `──────────────────\n\n` +
    `✓ Freelancer wajib mengambil & mengantar sesuai detail\n` +
    `✓ Pengguna bertanggung jawab atas keakuratan detail\n` +
    `✓ Transaksi tercatat sebagai bukti hukum`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
}
