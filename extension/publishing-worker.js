// Alarm driven persistent queue. The AFF tab may be closed; Chrome and AFF server must stay running.
let publishingWorkerBusy = false;
const PUBLISHING_ALARM = 'aff-publishing-queue';

async function publishingWorkerFetch(operation, payload = {}) {
  const config = await chrome.storage.local.get(['serverUrl', 'deviceToken', 'licenseKey']);
  if (!config.serverUrl || !config.deviceToken || !config.licenseKey) throw new Error('Kết nối AFF và kích hoạt extension trước.');
  const origin = new URL(config.serverUrl).origin;
  const response = await fetch(`${origin}/api/publishing/worker`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, operation, deviceToken: config.deviceToken, licenseKey: config.licenseKey }),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Không kết nối được lịch đăng (HTTP ${response.status}).`);
  return result;
}

function otherPublishingWorkActive() {
  return publishingBusy
    || (typeof activeScanJob !== 'undefined' && Boolean(activeScanJob))
    || (typeof videoPipelineState !== 'undefined' && videoPipelineState.status === 'running')
    || (typeof flowRunState !== 'undefined' && ['running', 'preparing', 'dispatching', 'generating', 'downloading'].includes(flowRunState.status))
    || (typeof industryPromptBusy !== 'undefined' && industryPromptBusy);
}

async function runPublishingQueue() {
  if (publishingWorkerBusy || otherPublishingWorkActive()) return;
  publishingWorkerBusy = true;
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo().catch(() => {}), 20000);
  let active;
  try {
    const config = await chrome.storage.local.get(['serverUrl', 'affPublishingActive']);
    if (!config.serverUrl) return;
    const origin = new URL(config.serverUrl).origin;
    active = config.affPublishingActive;
    if (active) {
      if (active.origin !== origin) throw new Error('Có bài dở dang của máy chủ AFF cũ. Kiểm tra lịch cũ trước khi đổi máy chủ.');
      // A restarted worker never resumes clicking. It only reconciles its durable completion report.
      await publishingWorkerFetch('report', { id: active.id, leaseToken: active.leaseToken, ...(active.report || { phase: 'failed', message: 'Extension bị khởi động lại. Kiểm tra bản nháp Facebook trước khi thử lại.' }) });
      await chrome.storage.local.remove('affPublishingActive'); active = null;
    }
    const result = await publishingWorkerFetch('claim');
    await chrome.storage.local.set({ affPublishingHealth: { lastPoll: new Date().toISOString(), error: '' } });
    if (!result.job) return;
    const job = result.job;
    active = { id: job.id, leaseToken: job.leaseToken, origin };
    await chrome.storage.local.set({ affPublishingActive: active });
    const sender = { url: origin, frameId: 0 };
    const call = (operation, payload) => dispatchPublishing({ operation, payload }, sender, true);
    const opened = await call('OPEN', job);
    if (!opened.success) throw new Error(opened.error);
    const { affReelTab } = await chrome.storage.session.get('affReelTab');
    let ready = false;
    for (let i = 0; i < 15; i++) {
      await publishingSleep(2000);
      try { await publishingInspect(affReelTab.tabId, job, 'identity'); ready = true; break; } catch { /* Bounded wait for navigation / Page selector. */ }
    }
    if (!ready) throw new Error('Chưa xác minh được đúng Page trong Meta Business Suite. Kiểm tra đăng nhập và Page đã chọn.');
    const prepared = await call('PREPARE', { ...job, videoUrl: new URL(job.videoUrl, origin).href });
    if (!prepared.success) throw new Error(prepared.error);
    // Wait for Facebook's processing and final publish button before consuming the server permission.
    const record = (await chrome.storage.session.get(`affReel:${prepared.token}`))[`affReel:${prepared.token}`];
    let canSubmit = false;
    for (let i = 0; i < 20; i++) {
      try { await publishingInspect(record.tabId, record.payload, 'submit'); canSubmit = true; break; } catch { await publishingSleep(2000); }
    }
    if (!canSubmit) throw new Error('Facebook chưa sẵn sàng đăng sau thời gian chờ. Kiểm tra video, Page và các bước còn thiếu.');
    const permission = await publishingWorkerFetch('report', { id: job.id, leaseToken: job.leaseToken, phase: 'before_submit' });
    if (!permission.allowed) throw new Error('Máy chủ chưa cho phép gửi bài.');
    const published = await call('SUBMIT', { token: prepared.token });
    active.report = published.status === 'published'
      ? { phase: 'published', permalink: published.permalink, message: published.message }
      : { phase: 'submitted', message: published.message || published.error || 'Chưa xác nhận kết quả Facebook.' };
    await chrome.storage.local.set({ affPublishingActive: active });
    await publishingWorkerFetch('report', { id: job.id, leaseToken: job.leaseToken, ...active.report });
    await chrome.storage.local.remove('affPublishingActive'); active = null;
  } catch (error) {
    const message = String(error.message || error).slice(0, 1200);
    await chrome.storage.local.set({ affPublishingHealth: { lastPoll: new Date().toISOString(), error: message } });
    if (active) {
      active.report ||= { phase: 'failed', message };
      await chrome.storage.local.set({ affPublishingActive: active });
      try {
        await publishingWorkerFetch('report', { id: active.id, leaseToken: active.leaseToken, ...active.report });
        await chrome.storage.local.remove('affPublishingActive');
      } catch { /* Keep receipt for the next alarm; do not submit again. */ }
    }
  } finally { clearInterval(keepAlive); publishingWorkerBusy = false; }
}

async function ensurePublishingAlarm() {
  if (!await chrome.alarms.get(PUBLISHING_ALARM)) await chrome.alarms.create(PUBLISHING_ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
}
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === PUBLISHING_ALARM) runPublishingQueue(); });
chrome.runtime.onStartup.addListener(ensurePublishingAlarm);
chrome.runtime.onInstalled.addListener(ensurePublishingAlarm);
ensurePublishingAlarm().catch(() => {});
