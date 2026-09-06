// Local polling needs no inbound port, public domain, or tunnel.
try { process.loadEnvFile('.env'); } catch { /* Environment variables may be set by the host. */ }
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const appUrl = process.env.TELEGRAM_LOCAL_APP_URL || 'http://127.0.0.1:3000';
const notifyOnly = process.argv.includes('--notifications-only');
const configureWebhook = process.argv.includes('--set-webhook');
const identify = process.argv.includes('--identify');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

async function telegram(method, data = {}) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(30000) });
  } catch { throw new Error('Không kết nối được Telegram.'); }
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Telegram: lỗi ${response.status}; kiểm tra token và trạng thái bot.`);
  return result.result;
}
async function deliver(body) {
  try {
    const response = await fetch(new URL('/api/telegram/webhook', appUrl), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error();
  } catch { throw new Error('AFF HUB chưa nhận được lệnh. Kiểm tra web đang chạy và cấu hình Telegram.'); }
}
async function main() {
  if (identify) {
    if (!/^\d+:[\w-]+$/.test(token)) throw new Error('Điền TELEGRAM_BOT_TOKEN trong .env trước.');
    const webhook = await telegram('getWebhookInfo');
    if (webhook.url) throw new Error('Bot đang dùng webhook; lấy Telegram user ID từ quản trị webhook hiện có.');
    const updates = await telegram('getUpdates', { timeout: 0, allowed_updates: ['message'], limit: 100 });
    const ids = [...new Set(updates.filter(u => u.message?.chat?.type === 'private' && !u.message?.from?.is_bot).map(u => u.message.from.id))];
    console.log(ids.length ? 'Telegram user ID từ các tin nhắn riêng đang chờ: ' + ids.join(', ') : 'Chưa có tin nhắn. Nhắn /start cho bot rồi chạy lại lệnh này.');
    return;
  }
  if (process.env.TELEGRAM_ENABLED !== 'true' || !/^\d+:[\w-]+$/.test(token) || !/^[\w-]{32,256}$/.test(secret) || !process.env.TELEGRAM_AFF_USER_ID || !process.env.TELEGRAM_ALLOWED_USER_IDS) {
    throw new Error('Chưa cấu hình đầy đủ TELEGRAM_ENABLED, BOT_TOKEN, WEBHOOK_SECRET, AFF_USER_ID và ALLOWED_USER_IDS trong .env.');
  }
  const destination = new URL(appUrl);
  if (!['http:', 'https:'].includes(destination.protocol) || (destination.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(destination.hostname))) throw new Error('Kết nối AFF HUB qua HTTPS hoặc localhost.');
  if (configureWebhook) {
    const url = new URL('/api/telegram/webhook', process.env.APP_BASE_URL);
    if (url.protocol !== 'https:') throw new Error('Webhook cần APP_BASE_URL là HTTPS công khai.');
    await telegram('setWebhook', { url: url.href, secret_token: secret, allowed_updates: ['message'], max_connections: 1, drop_pending_updates: false });
    console.log('Đã cấu hình webhook. Chạy npm run telegram:notify để gửi thông báo hoàn tất.');
    return;
  }
  const info = await telegram('getWebhookInfo');
  if (!notifyOnly && info.url) throw new Error('Bot đang dùng webhook. Dùng telegram:notify hoặc gỡ webhook có chủ đích trước khi chuyển sang polling.');
  console.log(notifyOnly ? 'Đang theo dõi kết quả AFF HUB để trả Telegram.' : 'AFF HUB Telegram Agent đang chờ lệnh. Ctrl+C để dừng.');
  let offset = 0;
  while (!stopping) {
    try {
      if (!notifyOnly) {
        const updates = await telegram('getUpdates', { offset, timeout: 20, allowed_updates: ['message'], limit: 10 });
        for (const update of updates) {
          if (stopping) break;
          await deliver(update);
          offset = update.update_id + 1;
        }
      }
      await deliver({ flush: true });
      if (notifyOnly) await sleep(15000);
    } catch (error) { console.error(error.message); await sleep(5000); }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
