// Facebook Reels adapter. Only explicit requests from the paired AFF origin are accepted.
let publishingBusy = false;
const publishingSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function publishingPage(payload) {
  if (!/^\d{5,30}$/.test(payload.pageId || '') || typeof payload.pageName !== 'string' || !payload.pageName.trim() || payload.pageName.length > 200) throw new Error('Cần ID Page dạng số và tên Page chính xác.');
  return `https://business.facebook.com/latest/reels_composer/?asset_id=${payload.pageId}`;
}

function publishingVideo(url, origin) {
  const video = new URL(url);
  if (video.origin !== origin || video.username || video.password || video.search || video.hash || !/^\/generated\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.mp4$/.test(video.pathname)) throw new Error('Chỉ nhận video MP4 generated từ ứng dụng AFF đang mở.');
  return video.href;
}

// This function runs in the isolated world. Fail closed when Meta changes its UI.
function inspectReelComposer(pageId, pageName, operation, expectedText, expectedFilename) {
  const url = new URL(location.href);
  if (url.origin !== 'https://business.facebook.com' || !url.pathname.startsWith('/latest/reels_composer') || url.searchParams.get('asset_id') !== pageId) throw new Error('Tab không còn ở trình đăng Reels của Page đã chọn.');
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const label = el => (el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
  const controls = [...document.querySelectorAll('button, [role="button"]')].filter(visible);
  // Page selector must identify exactly the Page the user saved; URL alone is not evidence.
  const identity = controls.filter(el => label(el) === pageName.trim());
  if (identity.length !== 1) throw new Error('Chưa xác minh được Page đang chọn. Chọn đúng Page trong Meta Business Suite; tên Page lưu ở AFF phải khớp chính xác.');
  if (operation === 'identity') return { pageId, pageName };
  const scope = document.querySelector('[role="main"]') || document.querySelector('main');
  if (!scope) throw new Error('Chưa nhận diện được trình soạn Reels.');
  const editors = [...scope.querySelectorAll('textarea, [contenteditable="true"][role="textbox"]')].filter(visible).filter(el => !el.disabled);
  const editor = editors[0];
  const content = (editor?.value ?? editor?.innerText ?? '').replace(/\r\n/g, '\n').trim();
  if ((operation === 'empty' || operation === 'compose') && editors.some(el => (el.value || el.innerText || '').trim())) throw new Error('Trình đăng đang có bản nháp. Hãy xử lý bản nháp trước.');
  if (operation === 'verify' || operation === 'submit') {
    if (content !== expectedText.trim()) throw new Error('Nội dung Facebook khác bản đã duyệt. Chuẩn bị lại nội dung trước khi đăng.');
  }
  const fileInputs = [...scope.querySelectorAll('input[type="file"]')].filter(el => /video|mp4/.test(el.accept));
  if (operation === 'submit') {
    const selectedFile = fileInputs.some(el => [...(el.files || [])].some(file => file.name === expectedFilename));
    const preview = scope.querySelector('video') && scope.innerText.includes(expectedFilename);
    if (!expectedFilename || (!selectedFile && !preview)) throw new Error('Chưa xác minh được đúng tệp video đã chuẩn bị. Kiểm tra video trong bản nháp Facebook.');
    if ([...scope.querySelectorAll('[role="alert"]')].some(el => visible(el) && /error|failed|lỗi|thất bại/i.test(label(el)))) throw new Error('Facebook đang báo lỗi. Xử lý lỗi trong bản nháp trước khi đăng.');
  }
  const position = el => {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    if (!top || (top !== el && !el.contains(top))) throw new Error('Có cửa sổ che phần tử cần thao tác. Hãy đóng cửa sổ đó trước.');
    return { x, y };
  };
  if (operation === 'empty') {
    if (fileInputs.length !== 1) throw new Error('Chưa thấy ô tải video. Mở trình tạo Reel trống rồi thử lại.');
    if (fileInputs[0].files?.length || scope.querySelector('video')) throw new Error('Trình đăng đã có video. Dùng trình tạo Reel trống để tránh ghép nhầm video.');
    fileInputs[0].setAttribute('data-aff-reel-upload', 'true');
    return { readyToUpload: true };
  }
  if (operation === 'compose' && editors.length === 0) {
    const next = [...scope.querySelectorAll('button, [role="button"]')].filter(visible).filter(el => /^(Tiếp|Tiếp tục|Next)$/.test(label(el)));
    if (next.length === 1 && !next[0].disabled && next[0].getAttribute('aria-disabled') !== 'true') return { next: position(next[0]) };
    return { waiting: true };
  }
  if (editors.length !== 1) throw new Error('Chưa thấy duy nhất một ô mô tả Reel. Mở bước thêm mô tả trong trình đăng Reels rồi thử lại.');
  if (operation === 'submit') {
    const buttons = [...scope.querySelectorAll('button, [role="button"]')].filter(visible).filter(el => /^(Đăng|Đăng ngay|Chia sẻ ngay|Publish|Publish now|Share now)$/.test(label(el)) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
    if (buttons.length !== 1) throw new Error('Chưa thấy nút Đăng sẵn sàng. Chờ video tải/xử lý xong và kiểm tra các bước trên Facebook.');
    return { button: position(buttons[0]) };
  }
  return { editor: position(editor) };
}

async function publishingInspect(tabId, payload, operation) {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func: inspectReelComposer, args: [payload.pageId, payload.pageName, operation, payload.text || '', payload.filename || ''] });
  if (!results[0]?.result) throw new Error('Không đọc được trạng thái trình đăng Facebook.');
  return results[0].result;
}

async function publishingDownload(url) {
  const id = await chrome.downloads.download({ url, filename: `AFF-Reels/${crypto.randomUUID()}.mp4`, conflictAction: 'uniquify', saveAs: false });
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    const [item] = await chrome.downloads.search({ id });
    if (!item || item.state === 'interrupted') throw new Error('Tải video bị gián đoạn.');
    if (item.state === 'complete') {
      if (!item.exists || !item.filename || (item.mime && !/^(video\/|application\/octet-stream)/.test(item.mime))) throw new Error('Tệp tải về không phải video khả dụng.');
      return item.filename;
    }
    await publishingSleep(500);
  }
  await chrome.downloads.cancel(id).catch(() => {});
  throw new Error('Tải video quá 90 giây. Kiểm tra kết nối và tệp video.');
}

async function publishingClick(target, point) {
  for (const type of ['mousePressed', 'mouseReleased']) await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
}

async function dispatchPublishing(message, sender, fromWorker = false) {
  const origin = new URL(sender.url || '').origin;
  const stored = await chrome.storage.local.get(['serverUrl']);
  if (!stored.serverUrl || origin !== new URL(stored.serverUrl).origin || sender.frameId !== 0) throw new Error('Chỉ nhận lệnh từ ứng dụng AFF đã kết nối ở tab chính.');
  if (publishingBusy || (!fromWorker && typeof publishingWorkerBusy !== 'undefined' && publishingWorkerBusy)) throw new Error('Đang xử lý một yêu cầu khác trong hồ sơ Chrome này.');
  publishingBusy = true;
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo().catch(() => {}), 20000);
  try {
    const payload = message.payload || {};
    if (message.operation === 'IDENTITY') return { success: true, ...await publishingWorkerFetch('identity') };
    if (message.operation === 'CHECK') {
      publishingPage(payload);
      const { affReelTab } = await chrome.storage.session.get('affReelTab');
      if (!affReelTab || affReelTab.pageId !== payload.pageId) throw new Error('Mở Page đích và chọn đúng Page trong Meta Business Suite trước.');
      await publishingInspect(affReelTab.tabId, payload, 'identity');
      await publishingWorkerFetch('verify', { channelId: payload.channelId, pageId: payload.pageId, pageName: payload.pageName });
      return { success: true };
    }
    if (message.operation === 'GENERATE') return await dispatchIndustryPrompt({ ...payload, waitForResponse: true });
    if (message.operation === 'OPEN') {
      const url = publishingPage(payload);
      const previous = (await chrome.storage.session.get('affReelTab')).affReelTab;
      // Reusing a composer could destroy an unfinished draft. Reopen the existing matching tab only.
      if (previous?.pageId === payload.pageId) {
        const tab = await chrome.tabs.get(previous.tabId).catch(() => null);
        if (tab?.url?.startsWith(url)) { await chrome.tabs.update(tab.id, { active: true }); return { success: true }; }
      }
      const tab = await chrome.tabs.create({ url, active: true });
      await chrome.storage.session.set({ affReelTab: { tabId: tab.id, pageId: payload.pageId } });
      return { success: true };
    }
    if (message.operation === 'PREPARE') {
      publishingPage(payload);
      if (typeof payload.text !== 'string' || !payload.text.trim() || payload.text.length > 5000) throw new Error('Nội dung Reel trống hoặc quá dài.');
      const videoUrl = publishingVideo(payload.videoUrl, origin);
      const { affReelTab } = await chrome.storage.session.get('affReelTab');
      if (!affReelTab || affReelTab.pageId !== payload.pageId) throw new Error('Bấm Mở Page đích trước.');
      const tabId = affReelTab.tabId;
      await chrome.tabs.update(tabId, { active: true });
      await publishingInspect(tabId, payload, 'empty');
      const filename = await publishingDownload(videoUrl);
      await publishingInspect(tabId, payload, 'empty');
      const target = { tabId };
      await chrome.debugger.attach(target, '1.3');
      try {
        const { root } = await chrome.debugger.sendCommand(target, 'DOM.getDocument', {});
        const { nodeId } = await chrome.debugger.sendCommand(target, 'DOM.querySelector', { nodeId: root.nodeId, selector: 'input[data-aff-reel-upload="true"]' });
        if (!nodeId) throw new Error('Ô tải video đã thay đổi. Kiểm tra bản nháp Facebook.');
        await chrome.debugger.sendCommand(target, 'DOM.setFileInputFiles', { nodeId, files: [filename] });
        let editorReady = false;
        let nextSteps = 0;
        const deadline = Date.now() + 45000;
        while (Date.now() < deadline) {
          await publishingSleep(1500);
          const state = await publishingInspect(tabId, payload, 'compose');
          if (state.editor) {
            await publishingClick(target, state.editor);
            await chrome.debugger.sendCommand(target, 'Input.insertText', { text: payload.text });
            await publishingInspect(tabId, payload, 'verify');
            editorReady = true;
            break;
          }
          if (state.next && nextSteps < 2) { await publishingClick(target, state.next); nextSteps++; await publishingSleep(2000); }
        }
        if (!editorReady) throw new Error('Video đã được chọn nhưng chưa thấy bước mô tả sau 45 giây. Kiểm tra và hoàn tất bản nháp trên Facebook; không tải lại để tránh trùng.');
      } finally { await chrome.debugger.detach(target).catch(() => {}); }
      const token = crypto.randomUUID();
      await chrome.storage.session.set({ [`affReel:${token}`]: { tabId, payload: { ...payload, filename: filename.split(/[\\/]/).pop() }, origin, expires: Date.now() + 30 * 60000, state: 'prepared' } });
      return { success: true, token };
    }
    if (message.operation === 'SUBMIT') {
      if (typeof payload.token !== 'string') throw new Error('Thiếu phiên chuẩn bị bài.');
      const key = `affReel:${payload.token}`;
      const record = (await chrome.storage.session.get(key))[key];
      if (!record || record.origin !== origin || record.state !== 'prepared' || record.expires < Date.now()) throw new Error('Phiên chuẩn bị hết hạn hoặc đã gửi lệnh đăng. Kiểm tra Facebook trước khi thử lại.');
      const { tabId } = record;
      await chrome.tabs.update(tabId, { active: true });
      await publishingInspect(tabId, record.payload, 'submit');
      const target = { tabId };
      const before = await publishingReceiptLinks(tabId);
      await chrome.debugger.attach(target, '1.3');
      try {
        const state = await publishingInspect(tabId, record.payload, 'submit');
        // Persist before clicking: lost response / worker restart cannot post the same token twice.
        await chrome.storage.session.set({ [key]: { ...record, state: 'submitted_unknown' } });
        await publishingClick(target, state.button);
      } finally { await chrome.debugger.detach(target).catch(() => {}); }
      const receipt = await waitPublishingReceipt(tabId, before);
      if (receipt) return { success: true, status: 'published', permalink: receipt, message: 'Facebook đã thông báo xuất bản và cung cấp link Reel mới.' };
      return { success: true, status: 'submitted_unknown', message: 'Đã gửi thao tác bấm Đăng. Chưa xác nhận Facebook xuất bản thành công; kiểm tra Reel trên Page trước khi tạo lượt đăng tiếp.' };
    }
    throw new Error('Thao tác đăng bài không được hỗ trợ.');
  } finally { clearInterval(keepAlive); publishingBusy = false; }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'AFF_PUBLISH') return false;
  dispatchPublishing(message, sender).then(sendResponse).catch(error => sendResponse({ success: false, error: error.message }));
  return true;
});

function readPublishingReceipt() {
  if (location.origin !== 'https://business.facebook.com') return { links: [], published: false };
  const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  const notices = [...document.querySelectorAll('[role="alert"], [role="status"], [role="dialog"]')].filter(visible);
  const success = notices.filter(el => /reel (?:has been |was )?published|reel (?:của bạn )?đã được đăng|đã đăng (?:thành công )?reel|thước phim (?:của bạn )?đã được đăng/i.test(el.innerText || ''));
  const links = success.flatMap(el => [...el.querySelectorAll('a[href]')].filter(visible).map(a => a.href)).filter(href => {
    try { const url = new URL(href); return url.protocol === 'https:' && ['www.facebook.com', 'facebook.com'].includes(url.hostname) && /^\/(?:reel\/\d+|[^/]+\/videos\/\d+)\/?$/.test(url.pathname); } catch { return false; }
  });
  return { links: [...new Set(links)], published: success.length > 0 };
}
async function publishingReceiptLinks(tabId) {
  const result = await chrome.scripting.executeScript({ target: { tabId }, func: readPublishingReceipt });
  return result[0]?.result?.links || [];
}
async function waitPublishingReceipt(tabId, before) {
  for (let i = 0; i < 12; i++) {
    await publishingSleep(2000);
    const links = await publishingReceiptLinks(tabId).catch(() => []);
    const newLinks = links.filter(url => !before.includes(url));
    if (newLinks.length === 1) return newLinks[0];
  }
  return null;
}
