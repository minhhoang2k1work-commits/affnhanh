/* Shared by both extension distributions. Only reads supported product pages. */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'AFF_COLLECT_PRODUCT') return false;
  (async () => {
    let tab;
    try {
      const url = new URL(message.url);
      if (url.protocol !== 'https:' || !/^(?:[\w-]+\.)*(?:shopee\.vn|tiktok\.com)$/.test(url.hostname)) {
        throw new Error('Chỉ hỗ trợ trang sản phẩm Shopee và TikTok Shop.');
      }
      tab = await chrome.tabs.create({ url: url.href, active: false });
      const deadline = Date.now() + 45000;
      let result;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const state = await chrome.tabs.get(tab.id);
        if (state.status !== 'complete') continue;
        try {
          result = await chrome.tabs.sendMessage(tab.id, { action: 'AFF_EXTRACT_PRODUCT_DETAILS' });
          break;
        } catch { /* Content script may still be initializing. */ }
      }
      if (!result?.success) throw new Error(result?.error || 'Hết thời gian chờ dữ liệu sản phẩm.');
      sendResponse({ success: true, details: result.details });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    } finally {
      if (tab?.id) await chrome.tabs.remove(tab.id).catch(() => {});
    }
  })();
  return true;
});
