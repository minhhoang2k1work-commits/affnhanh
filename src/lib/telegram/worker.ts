import { telegramConfig, isTelegramConfigured } from './config';
import { handleTelegramUpdate, flushTelegramNotifications } from './agent';

type Worker = { running: boolean; controller: AbortController | null; lastPoll: string | null; error: string; task?: Promise<void> };
const shared = globalThis as typeof globalThis & { affTelegramWorker?: Worker };
const worker = shared.affTelegramWorker ||= { running: false, controller: null, lastPoll: null, error: '' };
export const workerStatus = () => ({ running: worker.running, lastPoll: worker.lastPoll, error: worker.error });
export async function botRequest(token: string, method: string, data = {}, signal?: AbortSignal) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(10000),
    });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error();
    return body.result;
  } catch { throw new Error('Không kết nối được bot. Kiểm tra token, mạng hoặc tiến trình Telegram khác đang chạy.'); }
}
export async function stopTelegramWorker() {
  worker.running = false;
  worker.controller?.abort();
  await worker.task;
}
export async function startTelegramWorker() {
  if (worker.running) return;
  if (!isTelegramConfigured()) throw new Error('Lưu đầy đủ cấu hình trước khi bật bot.');
  const config = telegramConfig();
  const info = await botRequest(config.token, 'getWebhookInfo');
  if (info.url) throw new Error('Bot đang dùng webhook. Hãy dùng bot riêng cho chế độ chạy trên máy này.');
  if (worker.running) return;
  worker.running = true; worker.error = ''; worker.controller = new AbortController();
  const signal = worker.controller.signal;
  worker.task = (async () => {
    let offset = 0;
    while (!signal.aborted) {
      try {
        if (!isTelegramConfigured()) break;
        const updates = await botRequest(config.token, 'getUpdates', { offset, timeout: 20, limit: 10, allowed_updates: ['message'] }, signal);
        worker.lastPoll = new Date().toISOString(); worker.error = '';
        for (const update of updates) {
          if (signal.aborted) break;
          await handleTelegramUpdate(update);
          offset = update.update_id + 1;
        }
        if (!signal.aborted) await flushTelegramNotifications();
      } catch {
        if (signal.aborted) break;
        worker.error = 'Chưa nhận được lệnh. Kiểm tra mạng, cơ sở dữ liệu và tắt tiến trình npm run telegram nếu đang chạy.';
        await new Promise<void>(resolve => {
          const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
          const timer = setTimeout(finish, 5000);
          signal.addEventListener('abort', finish, { once: true });
        });
      }
    }
    worker.running = false;
  })();
}
