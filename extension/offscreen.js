const clipboardBuffer = document.getElementById('clipboard-buffer');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'aff-offscreen' || message.action !== 'WRITE_CLIPBOARD') return false;
  (async () => {
    try {
      clipboardBuffer.value = String(message.text || '');
      clipboardBuffer.focus();
      clipboardBuffer.select();
      await navigator.clipboard.writeText(clipboardBuffer.value);
      sendResponse({ ok: true, length: clipboardBuffer.value.length });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();
  return true;
});
