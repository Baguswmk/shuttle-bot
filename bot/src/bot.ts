import { Bot, Context, SessionFlavor, session } from 'grammy';
import { config } from './config';
import { db } from './db';

// ── Session Data ──────────────────────────────────────────────────────────────

export interface OrderDraft {
  type?: 'ANJEM' | 'JASTIP' | 'JASA';
  pickupLocation?: string;
  dropLocation?: string;
  passengerCount?: number;
  jastipCategory?: string;
  jastipDetail?: string;
  jastipLocations?: { detail: string; price: number }[];  // multi-location jastip
  jasaType?: string;
  jasaDetail?: string;
  estimatedPrice?: number;
}

export interface RegisterDraft {
  step?: string;
  ktmFileId?: string;
  selfieFileId?: string;
  emergencyName?: string;
  emergencyPhone?: string;
}

export interface SessionData {
  step?: string;
  orderDraft?: OrderDraft;
  registerDraft?: RegisterDraft;
  currentOrderId?: string;
  awaitingReportOrderId?: string;
}

// ── Context Type ──────────────────────────────────────────────────────────────

export type BotContext = Context & SessionFlavor<SessionData>;

// ── Prisma-backed Session Storage ────────────────────────────────────────────

function getPrismaStorage() {
  return {
    async read(key: string): Promise<SessionData | undefined> {
      const row = await db.botSession.findUnique({ where: { id: key } });
      if (!row) return undefined;
      try {
        return JSON.parse(row.data) as SessionData;
      } catch {
        return undefined;
      }
    },
    async write(key: string, data: SessionData): Promise<void> {
      await db.botSession.upsert({
        where: { id: key },
        create: { id: key, data: JSON.stringify(data) },
        update: { data: JSON.stringify(data) },
      });
    },
    async delete(key: string): Promise<void> {
      await db.botSession.deleteMany({ where: { id: key } });
    },
  };
}

// ── Bot Factory ───────────────────────────────────────────────────────────────

export function createBot() {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  // Session middleware with Prisma storage
  bot.use(
    session({
      initial: (): SessionData => ({}),
      storage: getPrismaStorage(),
      getSessionKey: (ctx) =>
        ctx.from?.id !== undefined ? String(ctx.from.id) : undefined,
    }),
  );

  // Global callback query answer error wrapper
  bot.use(async (ctx, next) => {
    if (ctx.callbackQuery) {
      const originalAnswer = ctx.answerCallbackQuery.bind(ctx);
      ctx.answerCallbackQuery = async (...args) => {
        try {
          return await originalAnswer(...args);
        } catch (err) {
          console.warn('[Grammy] Callback query answer failed (swallowed):', err);
          return true;
        }
      };
    }
    await next();
  });

  // Auto-register / upsert user on every interaction
  bot.use(async (ctx, next) => {
    if (ctx.from && !ctx.from.is_bot) {
      await db.user.upsert({
        where: { telegramId: BigInt(ctx.from.id) },
        create: {
          telegramId: BigInt(ctx.from.id),
          name: [ctx.from.first_name, ctx.from.last_name]
            .filter(Boolean)
            .join(' '),
          username: ctx.from.username ?? null,
        },
        update: {
          name: [ctx.from.first_name, ctx.from.last_name]
            .filter(Boolean)
            .join(' '),
          ...(ctx.from.username && { username: ctx.from.username }),
        },
      });
    }
    await next();
  });

  // Global error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[Bot] Error while handling update ${ctx.update.update_id}:`);
    console.error(err.error);
  });

  return bot;
}
