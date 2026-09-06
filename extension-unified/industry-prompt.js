// Opens/reuses the user's chosen ChatGPT destination and submits only on an explicit request.
let industryPromptBusy = false;
async function dispatchIndustryPrompt(message) {
  if (industryPromptBusy) return { success: false, error: 'Đang gửi một prompt khác. Hãy chờ hoàn tất.' };
  industryPromptBusy = true;
    try {
      const url = new URL(message.url);
      if (url.protocol !== 'https:' || url.username || url.password || !/^(?:[\w-]+\.)*chatgpt\.com$/.test(url.hostname)) throw new Error('Link ChatGPT không hợp lệ.');
      if (typeof message.prompt !== 'string' || !message.prompt.trim() || message.prompt.length > 250000) throw new Error('Prompt phải có nội dung và tối đa 250.000 ký tự. Hãy giảm số sản phẩm/link nếu quá dài.');
      const existing = (await chrome.tabs.query({})).find(tab => tab.url?.replace(/\/$/, '') === url.href.replace(/\/$/, ''));
      const tab = existing ? await chrome.tabs.update(existing.id, { active: true }) : await chrome.tabs.create({ url: url.href, active: true });
      const deadline = Date.now() + 45000;
      let ready = false;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          const health = await chrome.tabs.sendMessage(tab.id, { action: 'AFF_PAGE_STATUS' });
          if (health?.ready) { ready = true; break; }
          if (health?.code === 'AUTH_REQUIRED') throw new Error('Cần đăng nhập ChatGPT trong tab đã mở.');
        } catch (error) { if (error.message.includes('Cần đăng nhập')) throw error; }
      }
      if (!ready) throw new Error('Chưa thấy ô nhập ChatGPT. Nếu link là trang dự án, hãy mở một cuộc trò chuyện trong dự án và lưu link cuộc trò chuyện đó.');
      // Do not retry the send: a lost response must never submit the same prompt twice.
      const result = await chrome.tabs.sendMessage(tab.id, { action: 'CHATGPT_SEND_PROMPT', prompt: message.prompt });
      return result || { success: false, error: 'Chưa xác nhận được việc gửi. Kiểm tra tab ChatGPT trước khi gửi lại.' };
    } catch (error) { return { success: false, error: error.message }; }
    finally { industryPromptBusy = false; }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'AFF_SEND_INDUSTRY_PROMPT') return false;
  dispatchIndustryPrompt(message).then(sendResponse);
  return true;
});
