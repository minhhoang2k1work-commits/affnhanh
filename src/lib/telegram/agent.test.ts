import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ records: new Map<string, any>(), jobs: vi.fn(), scans: vi.fn(), send: vi.fn() }));
vi.mock('../db', () => {
  const commands = {
    findUnique: async ({ where }: any) => state.records.get(where.id) || null,
    count: async () => 0,
    create: async ({ data }: any) => { state.records.set(data.id, { ...data }); return data; },
    update: async ({ where, data }: any) => { const next = { ...state.records.get(where.id), ...data }; state.records.set(where.id, next); return next; },
  };
  const tx = { telegramCommand: commands, scanJob: { create: state.scans }, extensionJob: { create: state.jobs } };
  return { db: { ...tx, $transaction: async (fn: any) => fn(tx) } };
});
vi.mock('./client', () => ({ sendTelegramText: state.send }));
import { handleTelegramUpdate } from './agent';
beforeEach(() => {
  state.records.clear(); vi.clearAllMocks();
  state.jobs.mockResolvedValue({ id: 'job-1' }); state.scans.mockResolvedValue({ id: 'scan-1' }); state.send.mockResolvedValue(undefined);
  vi.stubEnv('TELEGRAM_ENABLED', 'true'); vi.stubEnv('TELEGRAM_BOT_TOKEN', '123:test'); vi.stubEnv('TELEGRAM_AFF_USER_ID', 'owner'); vi.stubEnv('TELEGRAM_ALLOWED_USER_IDS', '456');
});
afterEach(() => vi.unstubAllEnvs());
const message = (text: string) => ({ update_id: 10, message: { date: Math.floor(Date.now() / 1000), from: { id: 456 }, chat: { id: 456, type: 'private' }, text } });
describe('Telegram job dispatch', () => {
  it('does not enqueue the same scan twice when Telegram retries an update', async () => {
    const update = message('/scan https://shopee.vn/shop/1');
    await handleTelegramUpdate(update); await handleTelegramUpdate(update);
    expect(state.jobs).toHaveBeenCalledTimes(1); expect(state.scans).toHaveBeenCalledTimes(1); expect(state.send).toHaveBeenCalledTimes(1);
    expect(state.records.get('123:10').jobId).toBe('job-1');
  });
  it('ignores unauthorized users before touching jobs or sending messages', async () => {
    const update = message('/scan https://shopee.vn/shop/1'); update.message.from.id = 987;
    expect(await handleTelegramUpdate(update)).toEqual({ ignored: true });
    expect(state.jobs).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
  });
  it('persists a validation error without executing the invalid URL', async () => {
    await handleTelegramUpdate(message('/scan https://shopee.vn.evil.test'));
    expect(state.jobs).not.toHaveBeenCalled(); expect(state.records.get('123:10').status).toBe('failed');
  });
});
