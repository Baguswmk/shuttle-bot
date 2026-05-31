import { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../bot';
import { db } from '../db';
import { botConfig } from '../bot.config';
import { getFreelancerByTelegramId, createFreelancerApplication } from '../services/freelancer.service';
import { uploadFromUrl } from '../services/storage.service';
import { config } from '../config';

export function registerFreelancerRegistrationHandler(bot: Bot<BotContext>) {
  // Entry
  bot.callbackQuery('menu:register', async (ctx) => {
    await ctx.answerCallbackQuery();

    const existing = await getFreelancerByTelegramId(BigInt(ctx.from.id));
    if (existing) {
      const statusMessages: Record<string, string> = {
        PENDING:   '⏳ Pendaftaranmu sedang diproses admin (1–24 jam). Tunggu notifikasi ya!',
        APPROVED:  '✅ Kamu sudah terdaftar sebagai freelancer!',
        SUSPENDED: '🚫 Akunmu sedang disuspend. Hubungi admin untuk info lebih lanjut.',
        BANNED:    '⛔ Akunmu tidak dapat didaftarkan ulang. Hubungi admin kampus.',
      };
      return ctx.reply(statusMessages[existing.status] ?? 'Status tidak diketahui.', {
        reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home'),
      });
    }

    ctx.session.registerDraft = { step: 'ktm' };
    await ctx.reply(
      `📝 <b>Pendaftaran Freelancer ${botConfig.name}</b>\n\n` +
      `Siapkan:\n` +
      `• Foto KTM atau KTP (jelas & tidak buram)\n` +
      `• Foto selfie sambil pegang KTM/KTP\n` +
      `• Username Telegram aktif\n` +
      `• Nama & nomor kontak darurat\n\n` +
      `<b>Step 1/5:</b> Kirim foto <b>KTM/KTP</b> kamu sekarang 📸`,
      { parse_mode: 'HTML' },
    );
  });

  // Step 1: KTM photo
  bot.on('message:photo', async (ctx, next) => {
    if (ctx.session.registerDraft?.step !== 'ktm') return next();

    const fileId = ctx.message.photo.at(-1)!.file_id;
    ctx.session.registerDraft.ktmFileId = fileId;
    ctx.session.registerDraft.step      = 'selfie';

    await ctx.reply(
      `✅ KTM diterima!\n\n<b>Step 2/5:</b> Kirim <b>foto selfie</b> sambil pegang KTM/KTP kamu 🤳`,
      { parse_mode: 'HTML' },
    );
  });

  // Step 2: Selfie photo
  bot.on('message:photo', async (ctx, next) => {
    if (ctx.session.registerDraft?.step !== 'selfie') return next();

    const fileId = ctx.message.photo.at(-1)!.file_id;
    ctx.session.registerDraft.selfieFileId = fileId;

    const telegramUsername = ctx.from?.username;

    if (telegramUsername) {
      const dbUser = await db.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
      if (dbUser) {
        await db.user.update({
          where: { id: dbUser.id },
          data: { username: telegramUsername }
        });
      }

      ctx.session.registerDraft.step = 'emergency_name';

      await ctx.reply(
        `✅ Selfie diterima!\n` +
        `✨ <b>Username Telegram terdeteksi otomatis:</b> @${telegramUsername}\n\n` +
        `<b>Step 4/5:</b> Ketik <b>nama kontak darurat</b> kamu:`,
        { parse_mode: 'HTML' },
      );
    } else {
      ctx.session.registerDraft.step = 'telegram_username';

      await ctx.reply(
        `✅ Selfie diterima!\n\n` +
        `<b>Step 3/5:</b> Masukkan <b>username Telegram</b> kamu:\n<i>Format: @username (tanpa spasi)</i>`,
        { parse_mode: 'HTML' },
      );
    }
  });

  // Step 3: Telegram username
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.registerDraft?.step !== 'telegram_username') return next();

    let usernameInput = ctx.message.text.trim();
    if (usernameInput.startsWith('@')) {
      usernameInput = usernameInput.substring(1);
    }

    if (!/^[a-zA-Z0-9_]{5,32}$/.test(usernameInput)) {
      return ctx.reply(
        '❌ <b>Username Telegram tidak valid!</b>\n' +
        'Username Telegram harus terdiri dari 5-32 karakter alfanumerik (huruf, angka, garis bawah).\n\n' +
        'Silakan masukkan kembali username Telegram kamu (contoh: @username_kamu):',
        { parse_mode: 'HTML' }
      );
    }

    const dbUser = await db.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (dbUser) {
      await db.user.update({
        where: { id: dbUser.id },
        data: { username: usernameInput }
      });
    }

    ctx.session.registerDraft.step = 'emergency_name';

    await ctx.reply(
      `✅ Username Telegram @${usernameInput} berhasil direkam!\n\n<b>Step 4/5:</b> Ketik <b>nama kontak darurat</b> kamu:`,
      { parse_mode: 'HTML' },
    );
  });

  // Step 4: Emergency name
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.registerDraft?.step !== 'emergency_name') return next();

    const name = ctx.message.text.trim();
    if (!/^[a-zA-Z\s.,'-]+$/.test(name)) {
      return ctx.reply(
        '❌ <b>Nama kontak darurat tidak valid!</b>\n' +
        'Nama hanya boleh berisi huruf dan spasi (tidak boleh mengandung angka).\n\n' +
        'Silakan ketik kembali nama kontak darurat kamu:',
        { parse_mode: 'HTML' }
      );
    }

    ctx.session.registerDraft.emergencyName = name;
    ctx.session.registerDraft.step          = 'emergency_phone';

    await ctx.reply(
      `<b>Step 5/5:</b> Ketik <b>nomor HP kontak darurat</b>:\n<i>Format: 08xxxxxxxxxxxx</i>`,
      { parse_mode: 'HTML' },
    );
  });

  // Step 5: Emergency phone → show agreement
  bot.on('message:text', async (ctx, next) => {
    if (ctx.session.registerDraft?.step !== 'emergency_phone') return next();

    const phone = ctx.message.text.trim();
    if (!/^[0-9]+$/.test(phone)) {
      return ctx.reply(
        '❌ <b>Nomor HP tidak valid!</b>\n' +
        'Nomor HP hanya boleh berisi angka (tidak boleh ada huruf atau spasi).\n\n' +
        'Silakan ketik kembali nomor HP kontak darurat:',
        { parse_mode: 'HTML' }
      );
    }

    ctx.session.registerDraft.emergencyPhone = phone;
    ctx.session.registerDraft.step           = 'agreement';

    const keyboard = new InlineKeyboard()
      .text('✅ Setuju & Daftar', 'register:submit').row()
      .text('❌ Batalkan', 'menu:home');

    await ctx.reply(
      `📋 <b>Persetujuan Penggunaan Data</b>\n\n` +
      `✓ Data identitasmu disimpan untuk keperluan verifikasi\n` +
      `✓ Setiap transaksi direkam sebagai bukti hukum\n` +
      `✓ Pelanggaran berakibat suspend atau banned\n` +
      `✓ Data dapat diteruskan ke kampus jika ada pelanggaran berat\n\n` +
      `Dengan menekan <i>Setuju & Daftar</i>, kamu menyetujui ketentuan ini.`,
      { parse_mode: 'HTML', reply_markup: keyboard },
    );
  });

  // Submit registration
  bot.callbackQuery('register:submit', async (ctx) => {
    await ctx.answerCallbackQuery('Memproses pendaftaran...');

    const draft = ctx.session.registerDraft;
    if (!draft?.ktmFileId || !draft.emergencyName || !draft.emergencyPhone) {
      return ctx.reply('❌ Data tidak lengkap. Mulai ulang pendaftaran.');
    }

    const user = await db.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user) return;

    await ctx.reply('⏳ Mengupload foto...');

    try {
      // Upload KTM
      const ktmFile    = await ctx.api.getFile(draft.ktmFileId);
      const ktmFileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${ktmFile.file_path}`;
      const ktmUrl     = await uploadFromUrl(ktmFileUrl, {
        folder:    `${botConfig.storagePrefix}/ktm`,
        public_id: `${user.id}_ktm`,
      });

      // Upload selfie (optional)
      let selfieUrl: string | undefined;
      if (draft.selfieFileId) {
        const selfieFile    = await ctx.api.getFile(draft.selfieFileId);
        const selfieFileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${selfieFile.file_path}`;
        selfieUrl           = await uploadFromUrl(selfieFileUrl, {
          folder:    `${botConfig.storagePrefix}/selfie`,
          public_id: `${user.id}_selfie`,
        });
      }

      await createFreelancerApplication({
        userId:        user.id,
        ktmUrl,
        selfieUrl,
        emergencyName:  draft.emergencyName!,
        emergencyPhone: draft.emergencyPhone!,
      });

      ctx.session.registerDraft = {};

      await ctx.reply(
        `✅ <b>Pendaftaran berhasil dikirim!</b>\n\n` +
        `Admin akan memverifikasi data kamu dalam <b>1–24 jam</b>.\n` +
        `Kamu akan mendapat notifikasi Telegram setelah disetujui.`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu Utama', 'menu:home') },
      );
    } catch (err: any) {
      console.error('[Register] Upload failed:', err.message);
      await ctx.reply(
        '❌ Gagal mengupload foto. Coba lagi atau hubungi admin.',
        { reply_markup: new InlineKeyboard().text('🔄 Coba lagi', 'menu:register') },
      );
    }
  });
}
