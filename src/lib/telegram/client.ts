import { telegramConfig } from './config';

export async function telegramCall(method: 'sendMessage' | 'sendDocument', body: Record<string, unknown> | FormData) {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${telegramConfig().token}/${method}`, {
      method: 'POST', ...(body instanceof FormData ? { body } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('Không kết nối được Telegram.'); }
  if (!response.ok) throw new Error(`Telegram trả mã ${response.status}.`);
  const result = await response.json();
  if (!result.ok) throw new Error('Telegram chưa nhận được phản hồi.');
}

export async function sendTelegramText(chatId: string, text: string) {
  // Preserve long prompts as a file rather than dropping content or flooding the chat.
  if (text.length > 3900) {
    const form = new FormData();
    form.set('chat_id', chatId);
    form.set('caption', 'AFF HUB — nội dung đầy đủ trong tệp đính kèm.');
    form.set('document', new Blob([text], { type: 'text/plain;charset=utf-8' }), 'aff-agent-result.txt');
    return telegramCall('sendDocument', form);
  }
  return telegramCall('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
}
