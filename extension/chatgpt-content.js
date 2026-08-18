// AFF HUB - ChatGPT page controller

const CHATGPT_SELECTORS = {
  editor: [
    '#prompt-textarea',
    'textarea[data-id="root"]',
    'div[id="prompt-textarea"][contenteditable="true"]',
    'main div[contenteditable="true"]',
    'form div[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
  ].join(','),
  fileInput: 'input[type="file"][accept*="image"], input[type="file"][multiple], input[type="file"]',
  attachButton: [
    'button[data-testid="composer-attach-button"]',
    'button[data-testid="attach-button"]',
    'button[data-testid="composer-plus-btn"]',
    'button[aria-label*="Attach" i]',
    'button[aria-label*="Upload" i]',
    'button[aria-label*="Add files" i]',
    'button[aria-label*="Đính kèm" i]',
    'button[aria-label*="Tải lên" i]',
    'button[aria-label*="Thêm tệp" i]',
  ].join(','),
  uploadMenuItem: [
    '[role="menuitem"]',
    '[role="option"]',
    'button',
    'a',
  ].join(','),
  sendButton: [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-send-button"]',
    'button[data-testid="composer-submit-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Gửi" i]',
  ].join(','),
  stopButton: [
    'button[data-testid="stop-button"]',
    'button[data-testid*="stop" i]',
    'button[aria-label*="Stop" i]',
    'button[aria-label*="Dừng" i]',
  ].join(','),
  assistantMessage: '[data-turn="assistant"], [data-message-author-role="assistant"]',
  imagePreview: [
    'img[alt*="upload" i]',
    'img[alt*="product" i]',
    'img[alt*="Uploaded" i]',
    '[data-testid*="attachment" i] img',
    '[data-testid*="image" i] img',
    '[class*="attachment" i] img',
    '[class*="preview" i] img',
    '[class*="thumbnail" i] img',
  ].join(','),
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

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
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

async function urlToFile(urlOrBase64, filename = 'aff-product-reference.jpg') {
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
  return [...document.querySelectorAll('button, [role="menuitem"], [role="option"]')]
    .find((element) => isVisible(element) && pattern.test((element.innerText || element.textContent || '').trim()));
}

function countImageAttachments() {
  // Count visible image previews in the composer area
  const editor = document.querySelector(CHATGPT_SELECTORS.editor);
  if (!editor) return 0;

  // Walk up to the form/composer container
  let composerContainer = editor.parentElement;
  for (let depth = 0; composerContainer && composerContainer !== document.body && depth < 10; depth++) {
    if (composerContainer.tagName === 'FORM' || composerContainer.querySelector(CHATGPT_SELECTORS.sendButton)) break;
    composerContainer = composerContainer.parentElement;
  }
  if (!composerContainer || composerContainer === document.body) composerContainer = editor.parentElement;

  // Look for image previews/thumbnails within the composer
  const previewImages = composerContainer.querySelectorAll(CHATGPT_SELECTORS.imagePreview);
  let count = [...previewImages].filter(isVisible).length;

  // Also check for any visible remove/delete buttons near images (alternative indicator)
  if (count === 0) {
    const removeButtons = composerContainer.querySelectorAll(
      'button[aria-label*="Remove" i], button[aria-label*="Xóa" i], button[aria-label*="Delete" i]'
    );
    count = [...removeButtons].filter(isVisible).length;
  }

  // Also check for generic file attachment indicators
  if (count === 0) {
    const attachmentContainers = composerContainer.querySelectorAll(
      '[class*="attachment" i], [class*="file-item" i], [class*="uploaded" i]'
    );
    count = [...attachmentContainers].filter((el) => isVisible(el) && el.querySelector('img')).length;
  }

  return count;
}

async function getFileInput() {
  // Strategy 1: Direct file input already in DOM
  let input = document.querySelector(CHATGPT_SELECTORS.fileInput);
  if (input) return input;

  // Strategy 2: Click attach button to reveal file input
  const attachButton = document.querySelector(CHATGPT_SELECTORS.attachButton);
  if (attachButton) {
    attachButton.click();
    await sleep(800);

    input = document.querySelector(CHATGPT_SELECTORS.fileInput);
    if (input) return input;

    // Strategy 3: Look for upload menu item in dropdown
    const uploadItem = findButtonByText(
      /upload|tải (ảnh|tệp|lên)|add photos|photos and files|from computer|từ máy tính|chọn tệp/i
    );
    if (uploadItem) {
      uploadItem.click();
      await sleep(800);
      input = document.querySelector(CHATGPT_SELECTORS.fileInput);
      if (input) return input;
    }

    // Strategy 4: Try all visible menu items that could be upload options
    const menuItems = [...document.querySelectorAll(CHATGPT_SELECTORS.uploadMenuItem)]
      .filter((el) => isVisible(el) && /upload|file|photo|image|ảnh|tệp|tải/i.test(
        (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim()
      ));
    for (const item of menuItems) {
      item.click();
      await sleep(600);
      input = document.querySelector(CHATGPT_SELECTORS.fileInput);
      if (input) return input;
    }

    // Close any menu that may be open
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    await sleep(300);
  }

  // Strategy 5: Search entire DOM for hidden file inputs
  const allInputs = [...document.querySelectorAll('input[type="file"]')];
  if (allInputs.length > 0) return allInputs[0];

  return waitForElement(CHATGPT_SELECTORS.fileInput, 10000);
}

async function uploadViaFileInput(imageData) {
  const fileInput = await getFileInput();
  const file = await urlToFile(imageData);
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(2500);
  await waitWhilePaused();
  return countImageAttachments() > 0;
}

async function uploadViaClipboardPaste(imageData) {
  const editor = document.querySelector(CHATGPT_SELECTORS.editor);
  if (!editor) return false;

  const file = await urlToFile(imageData);
  editor.focus();
  await sleep(200);

  const clipboardData = new DataTransfer();
  clipboardData.items.add(file);

  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData,
  });
  editor.dispatchEvent(pasteEvent);
  await sleep(2500);
  await waitWhilePaused();
  return countImageAttachments() > 0;
}

async function uploadViaDragDrop(imageData) {
  const editor = document.querySelector(CHATGPT_SELECTORS.editor);
  if (!editor) return false;

  const file = await urlToFile(imageData);
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  const rect = editor.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const evtInit = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, dataTransfer };

  editor.dispatchEvent(new DragEvent('dragenter', evtInit));
  editor.dispatchEvent(new DragEvent('dragover', evtInit));
  await sleep(100);
  editor.dispatchEvent(new DragEvent('drop', evtInit));
  await sleep(2500);
  await waitWhilePaused();
  return countImageAttachments() > 0;
}

async function uploadImage(imageData) {
  const beforeCount = countImageAttachments();

  // Method 1: Standard file input
  console.log('[AFF HUB] Uploading image via file input...');
  let uploaded = await uploadViaFileInput(imageData);
  if (!uploaded && countImageAttachments() > beforeCount) uploaded = true;
  if (uploaded) {
    console.log('[AFF HUB] Image uploaded via file input ✓');
    return;
  }

  // Method 2: Clipboard paste
  console.log('[AFF HUB] File input failed, trying clipboard paste...');
  uploaded = await uploadViaClipboardPaste(imageData);
  if (!uploaded && countImageAttachments() > beforeCount) uploaded = true;
  if (uploaded) {
    console.log('[AFF HUB] Image uploaded via clipboard paste ✓');
    return;
  }

  // Method 3: Drag and drop
  console.log('[AFF HUB] Clipboard paste failed, trying drag-and-drop...');
  uploaded = await uploadViaDragDrop(imageData);
  if (!uploaded && countImageAttachments() > beforeCount) uploaded = true;
  if (uploaded) {
    console.log('[AFF HUB] Image uploaded via drag-and-drop ✓');
    return;
  }

  // All methods failed
  throw new Error(
    'IMAGE_UPLOAD_FAILED: Không thể gửi ảnh sản phẩm lên ChatGPT. ' +
    'Hãy kiểm tra ChatGPT có cho phép gửi ảnh hay không (cần GPT-4 hoặc Plus).'
  );
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

function visibleChatGPTError() {
  const messages = [...document.querySelectorAll('[role="alert"], [aria-live="assertive"]')]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .map((element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return messages.find((text) =>
    /something went wrong|network error|message limit|try again later|upload failed|không thành công|đã xảy ra lỗi|giới hạn tin nhắn|lỗi mạng/i.test(text)
  ) || null;
}

async function waitForCompletion(initialMessageCount, timeout = 480000) {
  const startedAt = Date.now();
  let stableText = '';
  let stableSince = 0;
  while (Date.now() - startedAt < timeout) {
    await waitWhilePaused();
    const visibleError = visibleChatGPTError();
    if (visibleError) throw new Error(`ChatGPT: ${visibleError}`);
    const messages = document.querySelectorAll(CHATGPT_SELECTORS.assistantMessage);
    const latest = messages[messages.length - 1];
    const text = latest?.innerText?.trim() || '';
    const generating = Boolean(document.querySelector(CHATGPT_SELECTORS.stopButton));
    if (messages.length > initialMessageCount && text) {
      if (text === stableText) {
        const stableFor = Date.now() - stableSince;
        if (/\[\/PROMPT2\]/i.test(text) && (!generating || stableFor > 1000)) return text;
        if (!generating && stableFor > 10000) return text;
      } else {
        stableText = text;
        stableSince = Date.now();
      }
    }
    await sleep(500);
  }
  throw new Error('ChatGPT phản hồi quá thời gian 8 phút hoặc chưa trả xong thẻ [/PROMPT2].');
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
        code: error.message.includes('AUTH_REQUIRED') ? 'AUTH_REQUIRED'
          : error.message.includes('IMAGE_UPLOAD_FAILED') ? 'IMAGE_UPLOAD_FAILED'
          : undefined,
        error: error.message === 'PIPELINE_CANCELLED' ? 'Pipeline đã bị hủy.' : error.message,
      });
    }
  })();
  return true;
});

console.log('[AFF HUB] ChatGPT controller loaded.');
