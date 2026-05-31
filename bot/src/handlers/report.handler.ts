import { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot';
import { db } from '../db';
import { recalculateRiskScore, escalateSanction } from '../services/risk.service';
import { uploadFromUrl } from '../services/storage.service';
import { config } from '../config';

export function registerReportHandler(bot: Bot<BotContext>) {
  // Entry: user taps "Laporan" dari detail order
  bot.callbackQuery(/^report:order:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const orderId = ctx.match[1];

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { freelancer: { include: { user: true } } },
    });

    if (!order || !order.freelancerId) {
      return ctx.reply('❌ Order tidak ditemukan atau belum ada freelancer.');
    }

    ctx.session.awaitingReportOrderId = orderId;
    ctx.session.step = 'report:description';

    await ctx.reply(
      `📋 <b>Form Laporan</b>\n\n` +
      `Kamu akan melaporkan <b>${order.freelancer?.user.name}</b>.\n\n` +
      `Jelaskan masalah yang kamu alami:\n<i>(Minimal 20 karakter)</i>`,
      { parse_mode: 'HTML' },
    );
  });

  // Description
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.step !== 'report:description') return next();

    if (ctx.message.text.length < 20) {
      return ctx.reply('❌ Deskripsi terlalu singkat. Minimal 20 karakter.');
    }

    ctx.session.orderDraft = ctx.session.orderDraft ?? {};
    (ctx.session as any)._reportDesc = ctx.message.text;
    ctx.session.step = 'report:evidence';

    const keyboard = new InlineKeyboard()
      .text('⏭ Lewati (tanpa bukti)', 'report:skip_evidence');

    await ctx.reply(
      '📸 Kirim <b>foto bukti</b> (opsional), atau tekan Lewati:',
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // Evidence photo (optional)
  bot.on('message:photo', async (ctx, next) => {
    if (ctx.session.step !== 'report:evidence') return next();

    const user = await db.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return;

    const fileId    = ctx.message.photo.at(-1)!.file_id;
    const file      = await ctx.api.getFile(fileId);
    const fileUrl   = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
    const evidenceUrl = await uploadFromUrl(fileUrl, {
      folder:    'shuttle-bot/reports',
      public_id: `${user.id}_report_${Date.now()}`,
    });

    await submitReport(ctx, user.id, evidenceUrl);
  });

  // Skip evidence
  bot.callbackQuery('report:skip_evidence', async (ctx) => {
    await ctx.answerCallbackQuery();
    const user = await db.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return;
    await submitReport(ctx, user.id);
  });
}

async function submitReport(ctx: any, userId: string, evidenceUrl?: string) {
  const orderId = ctx.session.awaitingReportOrderId;
  const desc    = (ctx.session as any)._reportDesc;

  if (!orderId || !desc) {
    return ctx.reply('❌ Terjadi kesalahan. Coba lagi.');
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { freelancerId: true },
  });

  if (!order?.freelancerId) return;

  await db.report.create({
    data: {
      orderId,
      reporterId:   userId,
      freelancerId: order.freelancerId,
      description:  desc,
      evidenceUrl:  evidenceUrl ?? null,
      status:       'PENDING',
    },
  });

  // Reset session
  ctx.session.awaitingReportOrderId = undefined;
  ctx.session.step = undefined;
  delete (ctx.session as any)._reportDesc;

  await ctx.reply(
    `✅ <b>Laporan dikirim!</b>\n\nAdmin akan meninjau laporan kamu dalam 1×24 jam.\nJika laporan valid, tindakan akan diambil sesuai kebijakan.`,
    { parse_mode: 'HTML', reply_markup: new (await import('grammy')).InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
  );

  // Trigger risk recalculation (async)
  recalculateRiskScore(order.freelancerId).catch(console.error);
}
