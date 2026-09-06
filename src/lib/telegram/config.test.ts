import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authorizedMessage, isTelegramConfigured, validTelegramSecret } from './config';
beforeEach(() => {
  vi.stubEnv('TELEGRAM_ENABLED', 'true'); vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:test');
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'a'.repeat(40)); vi.stubEnv('TELEGRAM_AFF_USER_ID', 'owner'); vi.stubEnv('TELEGRAM_ALLOWED_USER_IDS', '456');
});
afterEach(() => vi.unstubAllEnvs());
const update = () => ({ update_id: 10, message: { date: Math.floor(Date.now() / 1000), text: '/status', chat: { id: 456, type: 'private' }, from: { id: 456, is_bot: false } } });
describe('Telegram authorization', () => {
  it('fails closed with missing configuration and invalid secrets', () => {
    expect(isTelegramConfigured()).toBe(true);
    expect(validTelegramSecret('a'.repeat(40))).toBe(true);
    expect(validTelegramSecret('bad')).toBe(false);
    vi.stubEnv('TELEGRAM_ALLOWED_USER_IDS', ''); expect(isTelegramConfigured()).toBe(false);
  });
  it('accepts only current private messages from allowed users', () => {
    expect(authorizedMessage(update())?.senderId).toBe('456');
    const unauthorized = update(); unauthorized.message.from.id = 987; expect(authorizedMessage(unauthorized)).toBeNull();
    const group = update(); group.message.chat.type = 'group'; expect(authorizedMessage(group)).toBeNull();
    const old = update(); old.message.date -= 3600; expect(authorizedMessage(old)).toBeNull();
    expect(authorizedMessage({ ...update(), message: { ...update().message, forward_origin: {} } })).toBeNull();
  });
});
