import { timingSafeEqual } from 'node:crypto';

export function telegramConfig() {
  return {
    enabled: process.env.TELEGRAM_ENABLED === 'true',
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    secret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    userId: process.env.TELEGRAM_AFF_USER_ID || '',
    allowedUsers: (process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map(v => v.trim()).filter(v => /^\d+$/.test(v)),
  };
}
export function isTelegramConfigured() {
  const c = telegramConfig();
  return c.enabled && /^\d+:[\w-]+$/.test(c.token) && /^[\w-]{32,256}$/.test(c.secret) && !!c.userId && c.allowedUsers.length > 0;
}
export function validTelegramSecret(value: string | null) {
  const expected = telegramConfig().secret;
  if (!expected || !value) return false;
  const a = Buffer.from(expected), b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function authorizedMessage(update: unknown): { updateId: string; senderId: string; chatId: string; text: string } | null {
  if (!update || typeof update !== 'object') return null;
  const u = update as any;
  const message = u.message;
  if (!Number.isSafeInteger(u.update_id) || u.update_id < 0 || !message || message.chat?.type !== 'private' || message.from?.is_bot) return null;
  if (message.forward_origin || message.sender_chat) return null;
  if (!Number.isSafeInteger(message.date) || Math.abs(Date.now() / 1000 - message.date) > 900) return null;
  if (!Number.isSafeInteger(message.from?.id) || !Number.isSafeInteger(message.chat?.id) || message.from.id !== message.chat.id) return null;
  if (!telegramConfig().allowedUsers.includes(String(message.from.id))) return null;
  if (typeof message.text !== 'string' || !message.text.trim() || message.text.length > 4096) return null;
  return { updateId: String(u.update_id), senderId: String(message.from.id), chatId: String(message.chat.id), text: message.text.trim() };
}
