// AFF HUB - Google Flow controller (2026 UI)

const FLOW_SELECTORS = {
  promptInput: [
    'div[contenteditable="true"][role="textbox"][data-slate-editor="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[aria-label*="prompt" i]',
    'textarea[placeholder*="prompt" i]',
    'textarea[placeholder*="describe" i]',
  ].join(','),
  fileInput: 'input[type="file"][accept*="image"], input[type="file"]',
};

const DEFAULT_VIDEO_OPTIONS = {
  referenceMode: 'ingredient',
  aspectRatio: '9:16',
  duration: 8,
  outputCount: 1,
};

let operationControl = { cancelled: false, paused: false };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitWhilePaused() {
  if (operationControl.cancelled) throw new Error('PIPELINE_CANCELLED');
  while (operationControl.paused) {
    await sleep(300);
    if (operationControl.cancelled) throw new Error('PIPELINE_CANCELLED');
  }
}

function elementText(element) {
  return (element?.getAttribute?.('aria-label') || element?.innerText || element?.textContent || '').trim();
}

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function findByText(elements, pattern) {
  return [...elements].find((element) => isVisible(element) && pattern.test(elementText(element)));
}

function findInteractiveByText(pattern, root = document) {
  return findByText(root.querySelectorAll('button, a, [role="button"], [role="tab"], [role="menuitem"]'), pattern);
}

function findButtonBySymbol(root, symbol) {
  return [...root.querySelectorAll('button')].find((button) =>
    isVisible(button) && [...button.querySelectorAll('i')].some((icon) => icon.textContent?.trim() === symbol)
  ) || null;
}

function findPromptInput() {
  const candidates = [...document.querySelectorAll(FLOW_SELECTORS.promptInput)]
    .filter((element) => isVisible(element) && !element.id?.startsWith('g-recaptcha'));
  return candidates.find((element) => element.hasAttribute('data-slate-editor')) || candidates.at(-1) || null;
}

function getComposerContext() {
  const input = findPromptInput();
  if (!input) return null;
  let container = input.parentElement;
  for (let depth = 0; container && container !== document.body && depth < 10; depth++) {
    if (findButtonBySymbol(container, 'add_2') && findButtonBySymbol(container, 'arrow_forward')) {
      return { input, container };
    }
    container = container.parentElement;
  }
  return { input, container: input.parentElement || document.body };
}

function looksSignedIn() {
  return Boolean(
    document.querySelector('button[aria-label*="profile" i], img[alt*="profile" i], img[alt*="hồ sơ" i]') ||
    findInteractiveByText(/new project|dự án mới|tạo dự án|explore tools/i)
  );
}

function getPageStatus() {
  const url = location.href.toLowerCase();
  if (url.includes('accounts.google.com') || url.includes('/signin')) {
    return { ready: false, code: 'AUTH_REQUIRED', message: 'cần đăng nhập' };
  }
  if (getComposerContext()) return { ready: true, code: 'READY', message: 'dự án sẵn sàng' };
  if (looksSignedIn()) return { ready: true, code: 'DASHBOARD_READY', message: 'đã đăng nhập' };
  if (findInteractiveByText(/create with google flow|try in google flow/i)) {
    return { ready: false, code: 'OPEN_FLOW_REQUIRED', message: 'cần mở Flow và đăng nhập' };
  }
  return { ready: false, code: 'PROJECT_REQUIRED', message: 'chưa vào dự án Flow' };
}

async function waitForComposer(timeout = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    await waitWhilePaused();
    const composer = getComposerContext();
    if (composer) return composer;
    await sleep(400);
  }
  throw new Error('PROJECT_REQUIRED: Không tìm thấy trình tạo nội dung trong dự án Flow.');
}

async function ensureProjectReady() {
  if (getComposerContext()) return;
  let action = findInteractiveByText(/create with google flow|try in google flow/i);
  if (action) {
    action.click();
    await sleep(2500);
  }
  if (location.href.includes('accounts.google.com') || location.href.includes('/signin')) {
    throw new Error('AUTH_REQUIRED: Cần đăng nhập Google Flow.');
  }
  if (getComposerContext()) return;
  action = findInteractiveByText(/new project|dự án mới|tạo dự án/i);
  if (action) {
    action.click();
    await sleep(3000);
  }
  if (!looksSignedIn() && !getComposerContext()) {
    throw new Error('AUTH_REQUIRED: Cần đăng nhập Google Flow.');
  }
  await waitForComposer();
}

function openProjectFromDashboard() {
  if (getComposerContext()) return { success: true, alreadyReady: true };
  const action = findInteractiveByText(/create with google flow|try in google flow|new project|dự án mới|tạo dự án/i);
  if (!action) {
    return { success: false, error: 'PROJECT_REQUIRED: Không tìm thấy nút mở dự án Flow.' };
  }
  action.click();
  return { success: true, navigationStarted: true };
}

async function waitForElement(getter, timeout, errorMessage) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    await waitWhilePaused();
    const element = getter();
    if (element) return element;
    await sleep(250);
  }
  throw new Error(errorMessage);
}

async function configureVideo(options = {}) {
  const settings = {
    referenceMode: options.referenceMode === 'frame' ? 'frame' : 'ingredient',
    aspectRatio: options.aspectRatio === '16:9' ? '16:9' : '9:16',
    duration: [4, 6, 8, 10].includes(Number(options.duration)) ? Number(options.duration) : DEFAULT_VIDEO_OPTIONS.duration,
    outputCount: 1,
  };
  const composer = await waitForComposer();
  const configButton = [...composer.container.querySelectorAll('button')].find((button) =>
    button.getAttribute('aria-haspopup') === 'menu' && /video|nano banana|imagen/i.test(elementText(button))
  );
  if (!configButton) throw new Error('FLOW_CONFIG_FAILED: Không tìm thấy menu cấu hình model.');
  configButton.click();

  const menu = await waitForElement(
    () => [...document.querySelectorAll('[role="menu"]')].find(isVisible),
    10000,
    'FLOW_CONFIG_FAILED: Không mở được menu cấu hình.',
  );

  const videoTab = findByText(menu.querySelectorAll('[role="tab"]'), /(?:^|\s)video(?:\s|$)/i);
  if (!videoTab) throw new Error('FLOW_CONFIG_FAILED: Không tìm thấy chế độ Video.');
  if (videoTab.getAttribute('aria-selected') !== 'true') {
    videoTab.click();
    await sleep(500);
  }

  const currentMenu = [...document.querySelectorAll('[role="menu"]')].find(isVisible) || menu;
  const referencePattern = settings.referenceMode === 'frame'
    ? /khung hình|frames?/i
    : /thành phần|components?|ingredients?/i;
  const referenceTab = findByText(currentMenu.querySelectorAll('[role="tab"]'), referencePattern);
  if (!referenceTab) throw new Error('FLOW_CONFIG_FAILED: Không tìm thấy chế độ ảnh tham chiếu.');
  if (referenceTab.getAttribute('aria-selected') !== 'true') {
    referenceTab.click();
    await sleep(300);
  }

  const ratioPattern = settings.aspectRatio === '9:16' ? /(?:crop_9_16\s*)?9:16/i : /(?:crop_16_9\s*)?16:9/i;
  const ratioTab = findByText(currentMenu.querySelectorAll('[role="tab"]'), ratioPattern);
  if (!ratioTab) throw new Error(`FLOW_CONFIG_FAILED: Không tìm thấy tỷ lệ ${settings.aspectRatio}.`);
  if (ratioTab.getAttribute('aria-selected') !== 'true') ratioTab.click();

  const durationTab = findByText(currentMenu.querySelectorAll('[role="tab"]'), new RegExp(`^${settings.duration}s$`, 'i'));
  if (durationTab && durationTab.getAttribute('aria-selected') !== 'true') durationTab.click();

  const countTab = findByText(currentMenu.querySelectorAll('[role="tab"]'), new RegExp(`^x${settings.outputCount}$`, 'i'));
  if (!countTab) throw new Error(`FLOW_CONFIG_FAILED: Không tìm thấy lựa chọn x${settings.outputCount}.`);
  if (countTab.getAttribute('aria-selected') !== 'true') countTab.click();
  await sleep(300);

  configButton.click();
  await sleep(250);
  const summary = elementText(configButton);
  if (!/video/i.test(summary)) throw new Error('FLOW_CONFIG_FAILED: Flow chưa chuyển sang chế độ Video.');
  return { ...settings, summary };
}

async function urlToFile(urlOrBase64, filename = 'aff-product-reference.jpg') {
  if (urlOrBase64.startsWith('data:')) {
    const [header, encoded] = urlOrBase64.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    return new File([bytes], filename, { type: mime });
  }
  const response = await fetch(urlOrBase64, { credentials: 'omit' });
  if (!response.ok) throw new Error(`Không tải được ảnh (HTTP ${response.status}). Hãy chọn ảnh từ máy.`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('URL không trả về tệp ảnh.');
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

function setPrompt(promptText) {
  const composer = getComposerContext();
  if (!composer) throw new Error('Không tìm thấy ô prompt Google Flow.');
  const input = composer.input;
  input.focus();
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(input, promptText);
    else input.value = promptText;
  } else {
    document.execCommand('selectAll', false);
    const inserted = document.execCommand('insertText', false, promptText);
    if (!inserted || !input.textContent?.includes(promptText.slice(0, 20))) {
      input.replaceChildren();
      const paragraph = document.createElement('p');
      paragraph.textContent = promptText;
      input.appendChild(paragraph);
    }
  }
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: promptText }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function countComposerReferences() {
  const composer = getComposerContext();
  return composer ? composer.container.querySelectorAll('button img, [role="button"] img').length : 0;
}

async function attachReferenceImage(imageData) {
  const composer = await waitForComposer();
  const beforeReferenceCount = countComposerReferences();
  const addButton = findButtonBySymbol(composer.container, 'add_2');
  if (!addButton) throw new Error('REFERENCE_UPLOAD_FAILED: Không tìm thấy nút thêm ảnh tham chiếu.');
  addButton.click();

  const dialog = await waitForElement(
    () => [...document.querySelectorAll('[role="dialog"]')].find(isVisible),
    10000,
    'REFERENCE_UPLOAD_FAILED: Không mở được thư viện tham chiếu.',
  );
  const imageSource = (image) => image.currentSrc || image.src || image.getAttribute('src') || '';
  const beforeImageSources = new Set([...dialog.querySelectorAll('img')].map(imageSource).filter(Boolean));
  const beforeAddButtons = [...dialog.querySelectorAll('button')]
    .filter((button) => /thêm vào câu lệnh|add to prompt/i.test(elementText(button)));

  const fileInput = dialog.querySelector(FLOW_SELECTORS.fileInput) || document.querySelector(FLOW_SELECTORS.fileInput);
  if (!fileInput) throw new Error('REFERENCE_UPLOAD_FAILED: Không tìm thấy input tải ảnh.');
  const file = await urlToFile(imageData);
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));

  const startedAt = Date.now();
  let attachClicked = false;
  while (Date.now() - startedAt < 60000) {
    await waitWhilePaused();
    if (!dialog.isConnected || !isVisible(dialog)) {
      attachClicked = true;
      break;
    }
    const addButtons = [...dialog.querySelectorAll('button')]
      .filter((button) => isVisible(button) && /thêm vào câu lệnh|add to prompt/i.test(elementText(button)));
    const newImage = [...dialog.querySelectorAll('img')]
      .find((image) => imageSource(image) && !beforeImageSources.has(imageSource(image)));
    let targetButton = null;
    if (newImage) {
      let mediaCard = newImage.parentElement;
      for (let depth = 0; mediaCard && mediaCard !== dialog && depth < 8; depth++, mediaCard = mediaCard.parentElement) {
        targetButton = [...mediaCard.querySelectorAll('button')]
          .find((button) => isVisible(button) && /thêm vào câu lệnh|add to prompt/i.test(elementText(button)));
        if (targetButton) break;
      }
    }
    if (!targetButton && addButtons.length > beforeAddButtons.length) {
      targetButton = addButtons.at(-1);
    }
    if (targetButton) {
      targetButton.click();
      attachClicked = true;
      break;
    }
    await sleep(500);
  }
  if (!attachClicked) throw new Error('REFERENCE_UPLOAD_FAILED: Flow tải ảnh quá thời gian hoặc không nhận diện được ảnh vừa tải.');

  const verifyStartedAt = Date.now();
  while (Date.now() - verifyStartedAt < 12000) {
    await waitWhilePaused();
    const afterReferenceCount = countComposerReferences();
    if (afterReferenceCount > beforeReferenceCount) {
      return { attached: true, referenceCount: afterReferenceCount };
    }
    await sleep(400);
  }
  throw new Error('REFERENCE_UPLOAD_FAILED: Ảnh đã tải lên nhưng chưa được gắn vào câu lệnh Flow.');
}

function collectVideoResultLinks() {
  const results = [];
  document.querySelectorAll('a[href*="/edit/"]').forEach((anchor) => {
    let container = anchor.parentElement;
    for (let depth = 0; container && depth < 9; depth++, container = container.parentElement) {
      const text = elementText(container);
      const hasDownload = Boolean(findInteractiveByText(/download|tải xuống/i, container));
      const isVideo = /thời lượng video|video duration|resolution:\s*\d+p/i.test(text);
      if (hasDownload && isVideo) {
        results.push({
          url: new URL(anchor.getAttribute('href'), location.href).toString(),
          text: text.slice(0, 500),
        });
        break;
      }
    }
  });
  return [...new Map(results.map((result) => [result.url, result])).values()];
}

function findVisibleGenerationError() {
  return [...document.querySelectorAll('[role="alert"], [aria-live="assertive"], [class*="error"]')]
    .map(elementText)
    .find((text) => text.length > 4 && text.length < 500 && /error|failed|try again|lỗi|không thể|credits|quota|policy/i.test(text));
}

async function waitForNewVideoResult(previousUrls, timeout = 900000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    await waitWhilePaused();
    const errorMessage = findVisibleGenerationError();
    if (errorMessage) throw new Error(`Google Flow: ${errorMessage}`);
    const result = collectVideoResultLinks().find((item) => !previousUrls.has(item.url));
    if (result) return result;
    await sleep(3000);
  }
  throw new Error('Google Flow tạo video quá thời gian 15 phút.');
}

async function clickRenderButton() {
  const composer = await waitForComposer();
  const renderButton = findButtonBySymbol(composer.container, 'arrow_forward');
  if (!renderButton) throw new Error('Không tìm thấy nút mũi tên Tạo video.');
  const startedAt = Date.now();
  while (Date.now() - startedAt < 25000) {
    await waitWhilePaused();
    if (!renderButton.disabled && renderButton.getAttribute('aria-disabled') !== 'true') {
      renderButton.click();
      return;
    }
    await sleep(400);
  }
  throw new Error('Nút tạo video vẫn bị khóa. Ảnh tham chiếu chưa được gắn vào prompt hoặc cấu hình chưa hợp lệ.');
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function makePortableVideoUrl(source) {
  const response = await fetch(source, { credentials: 'include' });
  if (!response.ok) throw new Error(`Không tải được video Flow (HTTP ${response.status}).`);
  const blob = await response.blob();
  if (blob.size > 80 * 1024 * 1024) throw new Error('Video Flow lớn hơn 80 MB.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || 'video/mp4'};base64,${bytesToBase64(bytes)}`;
}

async function extractVideoFromResultPage(timeout = 60000) {
  const video = await waitForElement(
    () => [...document.querySelectorAll('video')].find((item) => item.currentSrc || item.src),
    timeout,
    'Không tìm thấy trình phát video trong trang kết quả Flow.',
  );
  const source = video.currentSrc || video.src;
  try {
    return { videoUrl: await makePortableVideoUrl(source), directVideoUrl: source, portable: true };
  } catch (error) {
    return { videoUrl: source, directVideoUrl: source, portable: false, extractionError: error.message };
  }
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
    findInteractiveByText(/cancel|stop|hủy|dừng/i)?.click();
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === 'FLOW_EXTRACT_VIDEO') {
    operationControl = { cancelled: false, paused: false };
    (async () => {
      try {
        const extracted = await extractVideoFromResultPage();
        sendResponse({ success: true, resultPageUrl: location.href, ...extracted });
      } catch (error) {
        sendResponse({ success: false, resultPageUrl: location.href, error: error.message });
      }
    })();
    return true;
  }

  if (message.action === 'FLOW_OPEN_PROJECT') {
    sendResponse(openProjectFromDashboard());
    return false;
  }

  if (message.action !== 'FLOW_GENERATE') return false;
  operationControl = { cancelled: false, paused: false };
  (async () => {
    try {
      await ensureProjectReady();
      const baselineUrls = new Set(collectVideoResultLinks().map((item) => item.url));
      const videoOptions = await configureVideo(message.options || {});
      setPrompt(message.prompt);
      await sleep(400);
      const reference = await attachReferenceImage(message.imageData);
      await sleep(700);
      await clickRenderButton();
      const result = await waitForNewVideoResult(baselineUrls);
      sendResponse({
        success: true,
        resultPageUrl: result.url,
        projectUrl: location.href,
        videoOptions,
        reference,
      });
    } catch (error) {
      const code = error.message.includes('AUTH_REQUIRED')
        ? 'AUTH_REQUIRED'
        : error.message.includes('PROJECT_REQUIRED')
          ? 'PROJECT_REQUIRED'
          : error.message.includes('FLOW_CONFIG_FAILED')
            ? 'FLOW_CONFIG_FAILED'
            : error.message.includes('REFERENCE_UPLOAD_FAILED')
              ? 'REFERENCE_UPLOAD_FAILED'
              : undefined;
      sendResponse({
        success: false,
        code,
        projectUrl: location.href,
        fallbackUrl: location.href,
        error: error.message === 'PIPELINE_CANCELLED' ? 'Pipeline đã bị hủy.' : error.message,
      });
    }
  })();
  return true;
});

console.log('[AFF HUB] Google Flow 2026 controller loaded.');
