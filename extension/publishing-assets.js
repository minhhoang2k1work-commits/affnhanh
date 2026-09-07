// DOM adapter for the business asset switcher. No private APIs or cookie access.
function inspectPublishingAssets(operation, wantedName) {
  if (location.origin !== 'https://business.facebook.com' || !location.pathname.startsWith('/latest/home')) throw new Error('Tab đồng bộ đã rời trang chủ Meta Business Suite.');
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const text = el => (el.innerText || el.textContent || '').trim();
  const rows = [...document.querySelectorAll('[role="radio"], input[type="radio"]')].map(radio => {
    let row = radio;
    for (let n = 0; n < 5 && row; n++, row = row.parentElement) {
      const value = text(row);
      if (/\bFacebook\b/.test(value) && value.length < 350 && row.querySelectorAll('[role="radio"], input[type="radio"]').length <= 1) {
        const pageName = value.split(/\n|Facebook/)[0].trim();
        if (pageName && pageName.length <= 200 && !/[.…]{3}|…/.test(pageName)) return { row, radio, pageName };
      }
    }
    return null;
  }).filter(Boolean);
  const point = el => {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    if (!top || (top !== el && !el.contains(top))) throw new Error('Danh sách Page đang bị che. Đóng hộp thoại trên Meta rồi đồng bộ lại.');
    return { x, y };
  };
  if (operation === 'list') return { names: rows.filter(item => visible(item.row)).map(item => item.pageName) };
  if (operation === 'open') {
    if (rows.some(item => visible(item.row))) return { ready: true };
    const controls = [...document.querySelectorAll('button, [role="button"]')].filter(visible);
    const explicit = controls.filter(el => /^(chọn (trang|tài sản)|chuyển (trang|tài sản)|select (page|business asset)|switch (page|business asset))/i.test(el.getAttribute('aria-label') || ''));
    const candidates = explicit.length ? explicit : controls.filter(el => {
      const rect = el.getBoundingClientRect();
      return el.querySelector('img, [role="img"]') && text(el).length > 0 && text(el).length < 220
        && (el.getAttribute('aria-haspopup') || (rect.left < 360 && rect.top < 250 && el.querySelector('svg')));
    });
    if (candidates.length !== 1) throw new Error('Chưa nhận diện duy nhất nút chọn tài sản. Mở danh sách Page trong tab Đồng bộ Meta rồi bấm đồng bộ lại.');
    return { point: point(candidates[0]) };
  }
  if (operation === 'choose') {
    const matches = rows.filter(item => item.pageName === wantedName && visible(item.row));
    if (matches.length !== 1) throw new Error(`Tên Page không duy nhất hoặc chưa hiển thị: ${wantedName}`);
    return { point: point(matches[0].row) };
  }
  if (operation === 'identity') {
    const pageId = new URL(location.href).searchParams.get('asset_id');
    const selected = rows.filter(item => visible(item.row) && item.pageName === wantedName && (item.radio.checked || item.radio.getAttribute('aria-checked') === 'true'));
    const buttons = [...document.querySelectorAll('button, [role="button"]')].filter(visible).filter(el => (el.getAttribute('aria-label') || text(el)).trim() === wantedName);
    if (!/^\d{5,30}$/.test(pageId || '') || (selected.length !== 1 && buttons.length !== 1)) return { waiting: true };
    return { pageId, pageName: wantedName };
  }
  if (operation === 'scroll') {
    let parent = rows.find(item => visible(item.row))?.row.parentElement;
    while (parent && parent !== document.body) {
      if (parent.scrollHeight > parent.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(parent).overflowY)) {
        const before = parent.scrollTop; parent.scrollTop += Math.max(100, parent.clientHeight * 0.7);
        return { moved: parent.scrollTop > before };
      }
      parent = parent.parentElement;
    }
    return { moved: false };
  }
  throw new Error('Thao tác danh sách Page không hợp lệ.');
}

async function syncPublishingAssets() {
  const identity = await publishingWorkerFetch('identity');
  const saved = await chrome.storage.session.get('affAssetScanTab');
  let tab = saved.affAssetScanTab ? await chrome.tabs.get(saved.affAssetScanTab).catch(() => null) : null;
  if (!tab?.url?.startsWith('https://business.facebook.com/latest/home')) tab = await chrome.tabs.create({ url: 'https://business.facebook.com/latest/home/', active: true });
  else await chrome.tabs.update(tab.id, { active: true });
  await chrome.storage.session.set({ affAssetScanTab: tab.id });
  const target = { tabId: tab.id };
  const inspect = async (operation, name) => {
    const result = await chrome.scripting.executeScript({ target, func: inspectPublishingAssets, args: [operation, name || ''] });
    if (!result[0]?.result) throw new Error('Không đọc được danh sách tài sản Meta.');
    return result[0].result;
  };
  for (let i = 0; i < 20; i++) {
    const current = await chrome.tabs.get(tab.id);
    if (current.status === 'complete') break;
    await publishingSleep(500);
  }
  await chrome.debugger.attach(target, '1.3');
  const pages = new Map(), visited = new Set();
  let issue = '', complete = false;
  const deadline = Date.now() + 110000;
  try {
    while (Date.now() < deadline && visited.size < 100) {
      const opened = await inspect('open');
      if (opened.point) { await publishingClick(target, opened.point); await publishingSleep(700); }
      const list = await inspect('list');
      if (!list.names.length) throw new Error('Chưa đọc được các dòng Page trong danh sách tài sản. Mở danh sách có nhãn Facebook rồi đồng bộ lại.');
      const name = list.names.find(name => !visited.has(name));
      if (!name) {
        const scroll = await inspect('scroll');
        if (!scroll.moved) { complete = true; break; }
        await publishingSleep(500); continue;
      }
      visited.add(name);
      const choice = await inspect('choose', name);
      await publishingClick(target, choice.point);
      let found, stableId, stableCount = 0;
      for (let i = 0; i < 16; i++) {
        await publishingSleep(500);
        try {
          const value = await inspect('identity', name);
          if (!value.pageId || (pages.has(value.pageId) && pages.get(value.pageId).pageName !== name)) { stableCount = 0; continue; }
          stableCount = stableId === value.pageId ? stableCount + 1 : 1; stableId = value.pageId;
          if (stableCount >= 3) { found = value; break; }
        } catch { stableCount = 0; /* Navigation in progress. */ }
      }
      if (!found) throw new Error(`Chưa xác minh ID của Page ${name}; dừng để tránh lưu nhầm.`);
      if (pages.has(found.pageId) && pages.get(found.pageId).pageName !== found.pageName) throw new Error('Meta chưa cập nhật ID khi chuyển Page. Đồng bộ lại sau khi trang tải xong.');
      // Persist each confirmed result so interrupted scans preserve progress.
      await publishingWorkerFetch('sync_pages', { pages: [found] });
      pages.set(found.pageId, found);
    }
  } catch (error) { issue = error.message; }
  finally { await chrome.debugger.detach(target).catch(() => {}); }
  return { success: true, deviceId: identity.deviceId, pages: [...pages.values()], message: `Đã đồng bộ ${pages.size} Page về AFF. ${issue || (complete ? 'Đã duyệt hết danh sách nhận diện được.' : 'Đã đến giới hạn lượt quét; có thể bấm đồng bộ lại.')} Các Page mới được lưu ở trạng thái tạm dừng.` };
}
