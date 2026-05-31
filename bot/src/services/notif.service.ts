import { Bot, Api } from 'grammy';
import type { BotContext } from '../bot';

let _bot: Bot<BotContext> | null = null;

export function setBotInstance(bot: Bot<BotContext>) {
  _bot = bot;
}

function getApi(): Api {
  if (!_bot) throw new Error('Bot not initialized — call setBotInstance first');
  return _bot.api;
}

/**
 * Send a text notification to a Telegram user by their numeric Telegram ID.
 */
export async function notifyUser(
  telegramId: bigint,
  text: string,
  options?: Parameters<Api['sendMessage']>[2],
): Promise<void> {
  try {
    await getApi().sendMessage(Number(telegramId), text, {
      parse_mode: 'HTML',
      ...options,
    });
  } catch (err: any) {
    // Log but don't throw — notification failures shouldn't crash flows
    console.error(`[NotifService] Failed to notify ${telegramId}: ${err.message}`);
  }
}

/**
 * Broadcast a message to multiple Telegram IDs (with rate limiting).
 */
export async function broadcastMessage(
  telegramIds: bigint[],
  text: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const id of telegramIds) {
    try {
      await getApi().sendMessage(Number(id), text, { parse_mode: 'HTML' });
      sent++;
      // Telegram rate limit: ~30 msgs/sec. 50ms gap is safe.
      await new Promise((r) => setTimeout(r, 50));
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}
