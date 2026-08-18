// AFF HUB - ChatGPT page controller

const CHATGPT_SELECTORS = {
  editor: '#prompt-textarea, textarea[data-id="root"], main div[contenteditable="true"], form div[contenteditable="true"]',
  fileInput: 'input[type="file"][accept*="image"], input[type="file"]',
  attachButton: 'button[data-testid="attach-button"], button[data-testid="composer-plus-btn"], button[aria-label*="Attach" i], button[aria-label*="Upload" i], button[aria-label*="Add files" i]',
  sendButton: 'button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label*="Send" i], button[aria-label*="Gửi" i]',
  stopButton: 'button[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="Dừng" i]',
  assistantMessage: 'div[data-message-author-role="assistant"]',
};

let operationControl = { cancelled: false, paused: false };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitWhilePaused() {
  if (operationControl.cancelled) throw new Error('PIPELINE_CANCELLED');
  while (operationControl.paused) {
    await sleep(250);
    if (operationControl.cancelled) throw new Error('PIPELINE_CANCELLED');
  }
}

async function waitForElement(selector, timeout = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    await waitWhilePaused();
    const element = document.querySelector(selector);
    if (element) return element;
    await sleep(250);
  }
  throw new Error(`Không tìm thấy phần tử ChatGPT: ${selector}`);
}

async function urlToFile(urlOrBase64, filename = 'product.jpg') {
  if (urlOrBase64.startsWith('data:')) {
    const [header, encoded] = urlOrBase64.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    return new File([bytes], filename, { type: mime });
  }
  const response = await fetch(urlOrBase64, { credentials: 'omit' });
  if (!response.ok) throw new Error(`Không tải được ảnh (HTTP ${response.status}). Hãy tải ảnh từ máy thay vì dùng URL.`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('URL không trả về tệp ảnh.');
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

function findButtonByText(pattern) {
  return [...document.querySelectorAll('button, [role="menuitem"]')]
    .find((element) => pattern.test((element.innerText || element.textContent || '').trim()));
}

async function getFileInput() {
  let input = document.querySelector(CHATGPT_SELECTORS.fileInput);
  if (input) return input;
  const attachButton = document.querySelector(CHATGPT_SELECTORS.attachButton);
  if (attachButton) {
    attachButton.click();
    await sleep(600);
    input = document.querySelector(CHATGPT_SELECTORS.fileInput);
    if (input) return input;
    const uploadItem = findButtonByText(/upload|tải (ảnh|tệp)|add photos|photos and files/i);
    if (uploadItem) {
      uploadItem.click();
      await sleep(500);
      input = document.querySelector(CHATGPT_SELECTORS.fileInput);
    }
  }
  return input || waitForElement(CHATGPT_SELECTORS.fileInput, 10000);
}

async function uploadImage(imageData) {
  const fileInput = await getFileInput();
  const file = await urlToFile(imageData);
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(1800);
  await waitWhilePaused();
}

function setEditorText(text) {
  const editor = document.querySelector(CHATGPT_SELECTORS.editor);
  if (!editor) throw new Error('Không tìm thấy ô nhập ChatGPT.');
  editor.focus();
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    const prototype = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(editor, text);
    else editor.value = text;
  } else {
    editor.replaceChildren();
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    editor.appendChild(paragraph);
  }
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
}

async function clickSend() {
  for (let attempt = 0; attempt < 20; attempt++) {
    await waitWhilePaused();
    const button = document.querySelector(CHATGPT_SELECTORS.sendButton);
    if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
      button.click();
      return;
    }
    await sleep(250);
  }
  const editor = document.querySelector(CHATGPT_SELECTORS.editor);
  if (!editor) throw new Error('Không tìm thấy nút gửi ChatGPT.');
  editor.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13,
  }));
}

async function waitForCompletion(initialMessageCount, timeout = 180000) {
  const startedAt = Date.now();
  let stableText = '';
  let stableSince = 0;
  while (Date.now() - startedAt < timeout) {
    await waitWhilePaused();
    const messages = document.querySelectorAll(CHATGPT_SELECTORS.assistantMessage);
    const latest = messages[messages.length - 1];
    const text = latest?.innerText?.trim() || '';
    const generating = Boolean(document.querySelector(CHATGPT_SELECTORS.stopButton));
    if (messages.length > initialMessageCount && text && !generating) {
      if (text === stableText) {
        if (Date.now() - stableSince > 1500) return text;
      } else {
        stableText = text;
        stableSince = Date.now();
      }
    }
    await sleep(500);
  }
  throw new Error('ChatGPT phản hồi quá thời gian 3 phút.');
}

function getPageStatus() {
  const url = location.href.toLowerCase();
  if (url.includes('/auth') || url.includes('/login')) {
    return { ready: false, code: 'AUTH_REQUIRED', message: 'cần đăng nhập' };
  }
  const editor = document.querySelector(CHATGPT_SELECTORS.editor);
  if (!editor) return { ready: false, code: 'EDITOR_NOT_READY', message: 'chưa thấy ô chat' };
  return { ready: true, code: 'READY', message: 'sẵn sàng' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'AFF_PAGE_STATUS') {
    sendResponse(getPageStatus());
    return false;
  }
  if (message.action === 'AFF_CONTROL_PAUSE') {
    operationControl.paused = true;
    sendResponse({ ok: true });
    return false;
  }
  if (message.action === 'AFF_CONTROL_RESUME') {
    operationControl.paused = false;
    sendResponse({ ok: true });
    return false;
  }
  if (message.action === 'AFF_CONTROL_CANCEL') {
    operationControl.cancelled = true;
    operationControl.paused = false;
    document.querySelector(CHATGPT_SELECTORS.stopButton)?.click();
    sendResponse({ ok: true });
    return false;
  }
  if (message.action !== 'CHATGPT_ANALYZE') return false;

  operationControl = { cancelled: false, paused: false };
  (async () => {
    try {
      const status = getPageStatus();
      if (!status.ready) throw new Error(status.code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED: Cần đăng nhập ChatGPT.' : status.message);
      await waitForElement(CHATGPT_SELECTORS.editor, 15000);
      const initialMessageCount = document.querySelectorAll(CHATGPT_SELECTORS.assistantMessage).length;
      if (message.imageData) await uploadImage(message.imageData);
      setEditorText(message.prompt);
      await sleep(500);
      await clickSend();
      const responseText = await waitForCompletion(initialMessageCount);
      sendResponse({ success: true, responseText });
    } catch (error) {
      sendResponse({
        success: false,
        code: error.message.includes('AUTH_REQUIRED') ? 'AUTH_REQUIRED' : undefined,
        error: error.message === 'PIPELINE_CANCELLED' ? 'Pipeline đã bị hủy.' : error.message,
      });
    }
  })();
  return true;
});

console.log('[AFF HUB] ChatGPT controller loaded.');
