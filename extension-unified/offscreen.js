const clipboardBuffer = document.getElementById('clipboard-buffer');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'aff-offscreen' || message.action !== 'WRITE_CLIPBOARD') return false;
  try {
    clipboardBuffer.value = String(message.text || '');
    clipboardBuffer.focus();
    clipboardBuffer.select();
    clipboardBuffer.setSelectionRange(0, clipboardBuffer.value.length);
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('Lệnh copy của extension bị Chrome từ chối.');
    sendResponse({ ok: true, length: clipboardBuffer.value.length, method: 'execCommand-copy' });
  } catch (error) {
    sendResponse({ ok: false, error: error?.message || String(error) });
  }
  return false;
});
