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

function popupContentText(element) {
  return (element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
}

function findVideoConfigButton(composer) {
  const candidates = [...composer.container.querySelectorAll('button[aria-haspopup="menu"]')].filter(isVisible);
  return candidates
    .map((button) => {
      const text = `${elementText(button)} ${popupContentText(button)}`;
      const iconText = [...button.querySelectorAll('i')].map((icon) => icon.textContent || '').join(' ');
      let score = 0;
      if (/\bvideo\b|hình ảnh|\bimage\b|nano banana|imagen/i.test(text)) score += 6;
      if (/\bx[1-4]\b/i.test(text)) score += 5;
      if (/\b(?:4|6|8|10)s\b/i.test(text)) score += 3;
      if (/crop_(?:9_16|16_9|free)/i.test(`${text} ${iconText}`)) score += 4;
      if (button.getAttribute('aria-expanded') === 'true') score += 2;
      return { button, score };
    })
    .filter((item) => item.score >= 6)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.button)[0] || null;
}

function looksLikeVideoConfigMenu(element) {
  if (!isVisible(element)) return false;
  const content = popupContentText(element);
  const hasMediaMode = /\bvideo\b/i.test(content) && /hình ảnh|\bimage\b/i.test(content);
  const hasReferenceMode = /khung hình|frames?|thành phần|components?|ingredients?/i.test(content);
  return hasMediaMode && hasReferenceMode && /9:16|16:9|crop_9_16|crop_16_9/i.test(content);
}

const CONFIG_OPTION_SELECTOR = '[role="tab"], [role="radio"], [role="option"], [role="menuitemradio"], button';

function findConfigOption(menu, pattern) {
  return [...menu.querySelectorAll(CONFIG_OPTION_SELECTOR)].find((option) => {
    if (!isVisible(option)) return false;
    const accessibleText = elementText(option);
    const contentText = popupContentText(option);
    return pattern.test(accessibleText) || pattern.test(contentText);
  }) || null;
}

function isConfigOptionSelected(option) {
  const dataState = (option?.getAttribute('data-state') || '').trim().toLowerCase();
  return option?.getAttribute('aria-selected') === 'true' ||
    option?.getAttribute('aria-checked') === 'true' ||
    option?.getAttribute('aria-pressed') === 'true' ||
    ['active', 'checked', 'selected', 'on'].includes(dataState);
}

function findVideoConfigMenu() {
  const directCandidates = [...document.querySelectorAll(
    '[role="menu"], [role="dialog"], [data-state="open"], [data-radix-popper-content-wrapper]',
  )];
  const direct = directCandidates.find(looksLikeVideoConfigMenu);
  if (direct) return direct;

  const videoTabs = [...document.querySelectorAll(CONFIG_OPTION_SELECTOR)]
    .filter((tab) => isVisible(tab) && /(?:^|\s)video(?:\s|$)/i.test(`${elementText(tab)} ${popupContentText(tab)}`.trim()));
  for (const videoTab of videoTabs) {
    let container = videoTab.parentElement;
    for (let depth = 0; container && container !== document.body && depth < 9; depth++, container = container.parentElement) {
      if (looksLikeVideoConfigMenu(container)) return container;
    }
  }
  return null;
}

function interactionClick(element) {
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  element.focus({ preventScroll: true });
  const pointerOptions = { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true };
  const mouseOptions = { bubbles: true, cancelable: true, button: 0 };
  if (typeof PointerEvent === 'function') element.dispatchEvent(new PointerEvent('pointerdown', pointerOptions));
  element.dispatchEvent(new MouseEvent('mousedown', mouseOptions));
  if (typeof PointerEvent === 'function') element.dispatchEvent(new PointerEvent('pointerup', pointerOptions));
  element.dispatchEvent(new MouseEvent('mouseup', mouseOptions));
  element.click();
}

async function openVideoConfigMenu(configButton) {
  const alreadyOpen = findVideoConfigMenu();
  if (alreadyOpen) return alreadyOpen;

  for (let attempt = 1; attempt <= 3; attempt++) {
    await waitWhilePaused();
    interactionClick(configButton);
    try {
      return await waitForElement(
        findVideoConfigMenu,
        3500,
        'FLOW_CONFIG_RETRY',
      );
    } catch (error) {
      if (error.message !== 'FLOW_CONFIG_RETRY') throw error;
      if (configButton.getAttribute('aria-expanded') === 'true') break;
      await sleep(500);
    }
  }

  const visiblePopups = [...document.querySelectorAll('[role="menu"], [role="dialog"], [data-state="open"]')]
    .filter(isVisible)
    .map((element) => popupContentText(element).slice(0, 120))
    .filter(Boolean)
    .slice(0, 3);
  const diagnostics = visiblePopups.length ? ` Popup nhìn thấy: ${visiblePopups.join(' / ')}` : '';
  throw new Error(`FLOW_CONFIG_FAILED: Không mở được menu cấu hình từ nút "${elementText(configButton)}".${diagnostics}`);
}

function currentVideoConfigMenu(fallback) {
  return findVideoConfigMenu() || fallback;
}

async function configureVideo(options = {}) {
  const settings = {
    referenceMode: options.referenceMode === 'frame' ? 'frame' : 'ingredient',
    aspectRatio: options.aspectRatio === '16:9' ? '16:9' : '9:16',
    duration: [4, 6, 8, 10].includes(Number(options.duration)) ? Number(options.duration) : DEFAULT_VIDEO_OPTIONS.duration,
    outputCount: 1,
  };
  const composer = await waitForComposer();
  const configButton = findVideoConfigButton(composer);
  if (!configButton) throw new Error('FLOW_CONFIG_FAILED: Không tìm thấy menu cấu hình model.');
  const menu = await openVideoConfigMenu(configButton);

  const videoTab = findConfigOption(menu, /(?:^|\s)video(?:\s|$)/i);
  if (!videoTab) throw new Error('FLOW_CONFIG_FAILED: Không tìm thấy chế độ Video.');
  if (!isConfigOptionSelected(videoTab)) {
    videoTab.click();
    await sleep(500);
  }

  let currentMenu = currentVideoConfigMenu(menu);
  const referencePattern = settings.referenceMode === 'frame'
    ? /khung hình|frames?/i
    : /thành phần|components?|ingredients?/i;
  const referenceTab = findConfigOption(currentMenu, referencePattern);
  if (!referenceTab) throw new Error('FLOW_CONFIG_FAILED: Không tìm thấy chế độ ảnh tham chiếu.');
  if (!isConfigOptionSelected(referenceTab)) {
    referenceTab.click();
    await sleep(300);
  }

  currentMenu = currentVideoConfigMenu(menu);
  const ratioPattern = settings.aspectRatio === '9:16' ? /(?:crop_9_16\s*)?9:16/i : /(?:crop_16_9\s*)?16:9/i;
  const ratioTab = findConfigOption(currentMenu, ratioPattern);
  if (!ratioTab) throw new Error(`FLOW_CONFIG_FAILED: Không tìm thấy tỷ lệ ${settings.aspectRatio}.`);
  if (!isConfigOptionSelected(ratioTab)) {
    ratioTab.click();
    await sleep(250);
  }

  currentMenu = currentVideoConfigMenu(menu);
  const durationTab = findConfigOption(currentMenu, new RegExp(`^${settings.duration}s$`, 'i'));
  if (!durationTab) throw new Error(`FLOW_CONFIG_FAILED: Không tìm thấy thời lượng ${settings.duration}s.`);
  if (!isConfigOptionSelected(durationTab)) {
    durationTab.click();
    await sleep(250);
  }

  currentMenu = currentVideoConfigMenu(menu);
  const countTab = findConfigOption(currentMenu, new RegExp(`^x${settings.outputCount}$`, 'i'));
  if (!countTab) throw new Error(`FLOW_CONFIG_FAILED: Không tìm thấy lựa chọn x${settings.outputCount}.`);
  if (!isConfigOptionSelected(countTab)) countTab.click();
  await sleep(300);

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
  await sleep(250);
  let summary = '';
  await waitForElement(
    () => {
      summary = `${elementText(configButton)} ${popupContentText(configButton)}`.replace(/\s+/g, ' ').trim();
      const ratioReady = settings.aspectRatio === '9:16'
        ? /9:16|crop_9_16/i.test(summary)
        : /16:9|crop_16_9/i.test(summary);
      return /\bvideo\b/i.test(summary) && ratioReady && new RegExp(`\\b${settings.duration}s\\b`, 'i').test(summary) && /\bx1\b/i.test(summary)
        ? configButton
        : null;
    },
    4000,
    `FLOW_CONFIG_FAILED: Flow chưa áp dụng đủ cấu hình Video · ${settings.duration}s · ${settings.aspectRatio} · x1.`,
  );
  return { ...settings, summary };
}

function closeVideoConfigMenu() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }));
}

async function configureVideoOrKeepCurrent(options = {}) {
  try {
    const configured = await configureVideo(options);
    return { ...configured, configurationApplied: true, usedCurrentConfiguration: false };
  } catch (error) {
    if (!error.message.includes('FLOW_CONFIG_FAILED')) throw error;

    closeVideoConfigMenu();
    await sleep(300);
    const composer = getComposerContext();
    const configButton = composer ? findVideoConfigButton(composer) : null;
    const summary = configButton
      ? `${elementText(configButton)} ${popupContentText(configButton)}`.replace(/\s+/g, ' ').trim()
      : 'Cấu hình hiện tại trên Google Flow';
    const configurationWarning = `Không áp dụng được cấu hình yêu cầu; tiếp tục bằng cấu hình hiện tại của Flow. ${error.message}`;
    console.warn('[AFF HUB]', configurationWarning);
    return {
      configurationApplied: false,
      usedCurrentConfiguration: true,
      summary,
      configurationWarning,
    };
  }
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

function selectPromptContents(input) {
  input.focus();
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    input.select();
    return;
  }
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(input);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getElementCenter(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + Math.min(rect.height / 2, 24) };
}

function readPromptText(input) {
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) return input.value || '';
  const clone = input.cloneNode(true);
  clone.querySelectorAll('[data-slate-placeholder="true"]').forEach((node) => node.remove());
  return (clone.textContent || '').replace(/\uFEFF/g, '').trim();
}

function getComposerDiagnostics() {
  const composer = getComposerContext();
  if (!composer) return { composerFound: false };
  const renderButton = findButtonBySymbol(composer.container, 'arrow_forward');
  const promptText = readPromptText(composer.input);
  return {
    composerFound: true,
    editor: composer.input.tagName.toLowerCase(),
    slate: composer.input.getAttribute('data-slate-editor') === 'true',
    promptLength: promptText.length,
    focused: document.activeElement === composer.input || composer.input.contains(document.activeElement),
    referenceCount: countComposerReferences(),
    renderFound: Boolean(renderButton),
    renderDisabled: Boolean(renderButton?.disabled),
    renderAriaDisabled: renderButton?.getAttribute('aria-disabled') || null,
    renderEnabled: Boolean(renderButton && !renderButton.disabled && renderButton.getAttribute('aria-disabled') !== 'true'),
  };
}

function diagnosticSummary(diagnostics) {
  return [
    `editor=${diagnostics.editor || 'none'}`,
    `slate=${Boolean(diagnostics.slate)}`,
    `prompt=${diagnostics.promptLength || 0}`,
    `ảnh=${diagnostics.referenceCount || 0}`,
    `focus=${Boolean(diagnostics.focused)}`,
    `nút=${diagnostics.renderFound ? (diagnostics.renderEnabled ? 'ready' : 'disabled') : 'missing'}`,
    `aria=${diagnostics.renderAriaDisabled || 'null'}`,
  ].join(', ');
}

async function trustedElementClick(element) {
  element.scrollIntoView({ block: 'center', inline: 'center' });
  await sleep(80);
  const { x, y } = getElementCenter(element);
  try {
    const result = await chrome.runtime.sendMessage({ action: 'FLOW_TRUSTED_CLICK', x, y });
    if (result?.ok) return result;
    console.warn('[AFF HUB] Trusted click unavailable, using DOM fallback:', result?.error);
  } catch (error) {
    console.warn('[AFF HUB] Trusted click failed, using DOM fallback:', error.message);
  }
  interactionClick(element);
  return { ok: true, method: 'dom-click-fallback' };
}

async function setPrompt(promptText, { requireReady = true } = {}) {
  let lastTrustedError = '';
  const initialComposer = await waitForComposer();
  const isSlateEditor = initialComposer.input.getAttribute('data-slate-editor') === 'true';
  const modes = requireReady && isSlateEditor
    ? ['paste-native', 'paste-command']
    : requireReady
      ? ['paste-native', 'character']
      : ['paste-native'];
  for (const mode of modes) {
    const composer = await waitForComposer();
    const point = getElementCenter(composer.input);
    try {
      const trustedResult = await chrome.runtime.sendMessage({
        action: mode.startsWith('paste-') ? 'FLOW_CLIPBOARD_PASTE' : 'FLOW_TRUSTED_INPUT',
        text: promptText,
        x: point.x,
        y: point.y,
        mode: mode === 'paste-command' ? 'command' : mode === 'paste-native' ? 'native' : mode,
      });
      if (!trustedResult?.ok) {
        lastTrustedError = trustedResult?.error || 'Chrome debugger không phản hồi.';
        console.warn('[AFF HUB] Trusted prompt input unavailable:', lastTrustedError);
        continue;
      }
      await sleep(mode === 'character' ? 700 : 650);
      const diagnostics = getComposerDiagnostics();
      if (diagnostics.promptLength > 0 && (!requireReady || diagnostics.renderEnabled)) {
        return { method: trustedResult.method || 'trusted-input', diagnostics };
      }
      console.warn('[AFF HUB] Flow did not accept trusted prompt state:', diagnosticSummary(diagnostics));
    } catch (error) {
      lastTrustedError = error.message;
      console.warn('[AFF HUB] Trusted prompt input failed:', error.message);
      break;
    }
  }

  const composer = getComposerContext();
  if (!composer) throw new Error('Không tìm thấy ô prompt Google Flow.');
  const input = composer.input;

  if (input.getAttribute('data-slate-editor') === 'true') {
    const selection = window.getSelection();
    if (selection?.rangeCount) selection.collapseToEnd();
    const diagnostics = getComposerDiagnostics();
    const debuggerDetail = lastTrustedError ? ` Debugger: ${lastTrustedError}` : '';
    throw new Error(
      `CLIPBOARD_PASTE_REJECTED: Flow chưa nhận thao tác dán thật (${diagnosticSummary(diagnostics)}). ` +
      `Prompt vẫn đang nằm trong clipboard; hãy click ô lệnh và nhấn Ctrl+V thủ công.${debuggerDetail}`,
    );
  }

  selectPromptContents(input);
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(input, promptText);
    else input.value = promptText;
  } else {
    const selectEditorContents = () => {
      selectPromptContents(input);
    };
    selectEditorContents();
    document.execCommand('delete', false);

    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', promptText);
    const pasteHandled = !input.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    }));

    if (!pasteHandled || !input.textContent?.includes(promptText.slice(0, 20))) {
      selectEditorContents();
      document.execCommand('delete', false);
      const inserted = document.execCommand('insertText', false, promptText);
      if (!inserted || !input.textContent?.includes(promptText.slice(0, 20))) {
        input.replaceChildren();
        const paragraph = document.createElement('p');
        paragraph.textContent = promptText;
        input.appendChild(paragraph);
      }
    }
  }
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: promptText }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(250);
  const diagnostics = getComposerDiagnostics();
  if (requireReady && !diagnostics.renderEnabled) {
    const debuggerDetail = lastTrustedError ? ` Debugger: ${lastTrustedError}` : '';
    throw new Error(`PROMPT_STATE_REJECTED: Flow hiển thị chữ nhưng chưa ghi nhận câu lệnh (${diagnosticSummary(diagnostics)}).${debuggerDetail}`);
  }
  return { method: 'dom-fallback', diagnostics };
}

function countComposerReferences() {
  const composer = getComposerContext();
  return composer ? composer.container.querySelectorAll([
    'img[src]',
    '[data-testid*="attachment" i]',
    '[aria-label*="remove image" i]',
    '[aria-label*="xóa ảnh" i]',
  ].join(',')).length : 0;
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
  const fileInput = dialog.querySelector(FLOW_SELECTORS.fileInput) || document.querySelector(FLOW_SELECTORS.fileInput);
  if (!fileInput) throw new Error('REFERENCE_UPLOAD_FAILED: Không tìm thấy input tải ảnh.');
  const file = await urlToFile(imageData);
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));

  const startedAt = Date.now();
  let attachClickedAt = 0;
  let attachClickAttempts = 0;
  const uploadedFilenamePattern = /aff-product-reference\.jpg/i;
  while (Date.now() - startedAt < 60000) {
    await waitWhilePaused();
    const visibleDialogs = [...document.querySelectorAll('[role="dialog"]')].filter(isVisible);
    const currentDialog = visibleDialogs.find((candidate) =>
      uploadedFilenamePattern.test(elementText(candidate)) ||
      Boolean(findInteractiveByText(/thêm vào câu lệnh|add to prompt/i, candidate)) ||
      Boolean(candidate.querySelector(FLOW_SELECTORS.fileInput))
    ) || null;

    if (!currentDialog) {
      if (attachClickedAt && Date.now() - attachClickedAt > 500) {
        const afterReferenceCount = countComposerReferences();
        return {
          attached: true,
          referenceCount: afterReferenceCount,
          verifiedBy: afterReferenceCount > beforeReferenceCount ? 'composer-reference' : 'dialog-closed',
        };
      }
      await sleep(400);
      continue;
    }

    const dialogText = elementText(currentDialog);
    const addButtons = [...currentDialog.querySelectorAll('button, [role="button"]')]
      .filter((button) => isVisible(button) && /thêm vào câu lệnh|add to prompt/i.test(elementText(button)) &&
        !button.disabled && button.getAttribute('aria-disabled') !== 'true');
    const newImage = [...currentDialog.querySelectorAll('img')]
      .find((image) => imageSource(image) && !beforeImageSources.has(imageSource(image)));
    let targetButton = null;
    if (newImage) {
      let mediaCard = newImage.parentElement;
      for (let depth = 0; mediaCard && mediaCard !== currentDialog && depth < 10; depth++, mediaCard = mediaCard.parentElement) {
        targetButton = [...mediaCard.querySelectorAll('button, [role="button"]')]
          .find((button) => isVisible(button) && /thêm vào câu lệnh|add to prompt/i.test(elementText(button)) &&
            !button.disabled && button.getAttribute('aria-disabled') !== 'true');
        if (targetButton) break;
      }
    }
    if (!targetButton && uploadedFilenamePattern.test(dialogText) && addButtons.length) {
      targetButton = addButtons.at(-1);
    }
    if (!targetButton && uploadedFilenamePattern.test(dialogText)) {
      const globalAddButton = findInteractiveByText(/thêm vào câu lệnh|add to prompt/i);
      if (globalAddButton && !globalAddButton.disabled && globalAddButton.getAttribute('aria-disabled') !== 'true') {
        targetButton = globalAddButton;
      }
    }

    if (targetButton && (!attachClickedAt || Date.now() - attachClickedAt > 1800) && attachClickAttempts < 3) {
      interactionClick(targetButton);
      attachClickedAt = Date.now();
      attachClickAttempts += 1;
      await sleep(700);
      continue;
    }

    if (attachClickedAt && countComposerReferences() > beforeReferenceCount) {
      return { attached: true, referenceCount: countComposerReferences(), verifiedBy: 'composer-reference' };
    }
    await sleep(500);
  }
  if (!attachClickedAt) throw new Error('REFERENCE_UPLOAD_FAILED: Flow tải ảnh quá thời gian hoặc không nhận diện được ảnh vừa tải.');

  const verifyStartedAt = Date.now();
  while (Date.now() - verifyStartedAt < 12000) {
    await waitWhilePaused();
    const afterReferenceCount = countComposerReferences();
    if (afterReferenceCount > beforeReferenceCount) {
      return { attached: true, referenceCount: afterReferenceCount, verifiedBy: 'composer-reference' };
    }
    const stillOpen = [...document.querySelectorAll('[role="dialog"]')]
      .some((candidate) => isVisible(candidate) && uploadedFilenamePattern.test(elementText(candidate)));
    if (!stillOpen) {
      return { attached: true, referenceCount: afterReferenceCount, verifiedBy: 'dialog-closed' };
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

function findPromptRequiredAlert() {
  return [...document.querySelectorAll('[role="alert"], [aria-live], [class*="toast" i], [class*="snackbar" i]')]
    .find((element) => isVisible(element) &&
      /phải cung cấp câu lệnh|vui lòng.*câu lệnh|provide (?:a )?prompt|prompt (?:is )?required|enter (?:a )?prompt/i.test(elementText(element)));
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

async function clickRenderButton(promptText) {
  let lastDiagnostics = getComposerDiagnostics();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 25000) {
      await waitWhilePaused();
      const composer = await waitForComposer();
      const renderButton = findButtonBySymbol(composer.container, 'arrow_forward');
      if (!renderButton) throw new Error('Không tìm thấy nút mũi tên Tạo video.');
      if (!renderButton.disabled && renderButton.getAttribute('aria-disabled') !== 'true') {
        const beforeClick = getComposerDiagnostics();
        await trustedElementClick(renderButton);
        const evidenceStartedAt = Date.now();
        while (Date.now() - evidenceStartedAt < 8000) {
          await sleep(350);
          const promptAlert = findPromptRequiredAlert();
          if (promptAlert) {
            findInteractiveByText(/đóng|close/i, promptAlert)?.click();
            break;
          }
          const generationError = findVisibleGenerationError();
          if (generationError) throw new Error(`Google Flow: ${generationError}`);
          const afterClick = getComposerDiagnostics();
          lastDiagnostics = afterClick;
          const promptWasConsumed = afterClick.composerFound && afterClick.promptLength < beforeClick.promptLength;
          const buttonBecameBusy = afterClick.composerFound && !afterClick.renderEnabled;
          const composerClosed = !afterClick.composerFound;
          const visibleProgress = [...document.querySelectorAll('[role="status"], [aria-live="polite"]')]
            .some((element) => isVisible(element) && /đang tạo|đang xử lý|generating|processing|queued|rendering/i.test(elementText(element)));
          if (promptWasConsumed || buttonBecameBusy || composerClosed || visibleProgress) return;
        }

        await setPrompt(promptText, { requireReady: true });
        await sleep(500);
        break;
      }
      lastDiagnostics = getComposerDiagnostics();
      await sleep(400);
    }
  }
  throw new Error(`FLOW_SUBMIT_FAILED: Flow không ghi nhận thao tác bấm Tạo sau 3 lần (${diagnosticSummary(lastDiagnostics)}).`);
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
      const videoOptions = await configureVideoOrKeepCurrent(message.options || {});
      await setPrompt(message.prompt, { requireReady: false });
      await sleep(400);
      const reference = await attachReferenceImage(message.imageData);
      await sleep(700);
      await setPrompt(message.prompt, { requireReady: true });
      await sleep(500);
      await clickRenderButton(message.prompt);
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
            : error.message.includes('PROMPT_INPUT_FAILED') || error.message.includes('PROMPT_STATE_REJECTED') || error.message.includes('CLIPBOARD_PASTE_REJECTED')
              ? 'PROMPT_INPUT_FAILED'
              : error.message.includes('FLOW_SUBMIT_FAILED')
                ? 'FLOW_SUBMIT_FAILED'
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
