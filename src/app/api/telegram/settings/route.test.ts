import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), save: vi.fn(), start: vi.fn(), stop: vi.fn(), request: vi.fn(), owner: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminSessionFromCookies: mocks.auth }));
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: mocks.owner } } }));
vi.mock('@/lib/telegram/config', () => ({ telegramConfig: () => ({ token: '123:saved', secret: 'x'.repeat(40), userId: 'owner', allowedUsers: ['123'], enabled: false }) }));
vi.mock('@/lib/telegram/settings', () => ({ saveTelegramSettings: mocks.save }));
vi.mock('@/lib/telegram/worker', () => ({ botRequest: mocks.request, startTelegramWorker: mocks.start, stopTelegramWorker: mocks.stop, workerStatus: () => ({ running: false }) }));
import { POST } from './route';
const call = (body: object, origin = 'http://localhost:3000') => POST(new Request('http://localhost:3000/api/telegram/settings', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }));
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue(true); mocks.owner.mockResolvedValue({ id: 'owner' }); });
describe('Telegram settings', () => {
  it('requires administrator authentication', async () => { mocks.auth.mockResolvedValue(false); expect((await call({ action: 'save' })).status).toBe(401); expect(mocks.save).not.toHaveBeenCalled(); });
  it('rejects cross-origin changes', async () => { expect((await call({ action: 'stop' }, 'https://other.example')).status).toBe(403); expect(mocks.stop).not.toHaveBeenCalled(); });
  it('preserves saved token when left blank and stops before changing owner', async () => {
    const response = await call({ action: 'save', token: '', userId: 'owner', allowedUsers: '123,456' });
    expect(response.status).toBe(200); expect(mocks.stop).toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ token: '123:saved', enabled: false, allowedUsers: ['123', '456'] }));
    expect(JSON.stringify(await response.json())).not.toContain('123:saved');
  });
  it('rejects malformed allowlists before writing', async () => { expect((await call({ action: 'save', userId: 'owner', allowedUsers: '123,bad' })).status).toBe(400); expect(mocks.save).not.toHaveBeenCalled(); });
  it('disables the bot when startup fails', async () => { mocks.start.mockRejectedValue(new Error('Không kết nối được bot.')); expect((await call({ action: 'start' })).status).toBe(400); expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false })); });
  it('tests unsaved credentials without persisting or sending messages', async () => { mocks.request.mockResolvedValue({ username: 'test_bot' }); expect((await call({ action: 'test', token: '321:unsaved' })).status).toBe(200); expect(mocks.request).toHaveBeenCalledWith('321:unsaved', 'getMe'); expect(mocks.save).not.toHaveBeenCalled(); });
});
