// AFF HUB Chrome Extension - Background Service Worker

const DEFAULT_SERVER = 'http://localhost:3000';
let activeScanJob = null;

// Get stored config or defaults
async function getConfig() {
  const data = await chrome.storage.local.get(['serverUrl', 'deviceToken', 'userSetServer']);
  const serverUrl = data.userSetServer ? (data.serverUrl || DEFAULT_SERVER) : DEFAULT_SERVER;
  return {
    serverUrl,
    deviceToken: data.deviceToken || null,
  };
}

// Register / Pair extension
async function ensurePaired() {
  const { serverUrl, deviceToken } = await getConfig();
  try {
    const res = await fetch(`${serverUrl}/api/extension/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceToken, extensionVersion: '1.0.0' }),
    });
    const data = await res.json();
    if (data.deviceToken) {
      await chrome.storage.local.set({ deviceToken: data.deviceToken });
      return data.deviceToken;
    }
  } catch (err) {
    console.error('[AFF HUB Ext] Pair failed:', err.message);
  }
  return deviceToken;
}

// Heartbeat Loop (every 15s)
async function sendHeartbeat() {
  const { serverUrl, deviceToken } = await getConfig();
  if (!deviceToken) {
    await ensurePaired();
    return;
  }
  try {
    await fetch(`${serverUrl}/api/extension/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceToken }),
    });
  } catch (err) {
    console.warn('[AFF HUB Ext] Heartbeat error:', err.message);
  }
}

// Poll Next Job (every 3s)
async function pollNextJob() {
  const { serverUrl } = await getConfig();
  try {
    const res = await fetch(`${serverUrl}/api/extension/jobs/next`);
    const data = await res.json();

    if (data.hasJob && data.job) {
      const job = data.job;
      console.log('[AFF HUB Ext] Received Job:', job);

      if (job.type === 'SCAN_SHOP' && job.targetUrl) {
        activeScanJob = job;
        await startShopScanJob(job);
      } else if (job.type === 'GENERATE_AFFILIATE_LINK') {
        await startAffiliateLinkJob(job);
      }
    }
  } catch (err) {
    // Silent background poll retry
  }
}

// Launch Tab & Start Shop Scanning
async function startShopScanJob(job) {
  let targetUrl = job.targetUrl;
  if (!targetUrl.startsWith('http')) {
    targetUrl = `https://${targetUrl}`;
  }

  // Check if tab already exists
  const isTiktok = targetUrl.includes('tiktok.com');
  const queryPattern = isTiktok ? '*://*.tiktok.com/*' : '*://shopee.vn/*';
  const tabs = await chrome.tabs.query({ url: queryPattern });
  let matchedTab = tabs.find((t) => t.url && t.url.includes(new URL(targetUrl).pathname));

  if (!matchedTab) {
    matchedTab = await chrome.tabs.create({ url: targetUrl, active: true });
  } else {
    await chrome.tabs.update(matchedTab.id, { active: true });
  }

  // Notify content script to start scanning
  setTimeout(() => {
    chrome.tabs.sendMessage(matchedTab.id, {
      action: 'START_SCAN',
      scanJobId: job.scanJobId || job.id,
      scanToken: job.scanToken,
    }).catch((err) => {
      console.warn('[AFF HUB Ext] Content script ready wait:', err.message);
    });
  }, 2000);
}

// Handle Affiliate Link Job
async function startAffiliateLinkJob(job) {
  const affUrl = 'https://affiliate.shopee.vn/offer/custom_link';
  const tabs = await chrome.tabs.query({ url: '*://affiliate.shopee.vn/*' });

  let tab = tabs[0];
  if (!tab) {
    tab = await chrome.tabs.create({ url: affUrl, active: true });
  }

  const message = {
    action: 'GENERATE_LINK',
    jobId: job.id,
    payload: {
      productUrl: job.payload?.productUrl,
      productUrls: job.payload?.productUrls,
      subIds: job.payload?.subIds || [],
    }
  };

  const sendMessageWithRetry = async (tabId, msg, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await chrome.tabs.sendMessage(tabId, msg);
        console.log('[AFF HUB Ext] Message sent to content script successfully');
        return;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  };

  // Wait for tab to be ready if not complete
  if (tab.status !== 'complete') {
    await new Promise((resolve) => {
      let timeoutId;
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeoutId);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        console.log('[AFF HUB Ext] Timeout waiting for tab to complete');
        resolve();
      }, 10000);
    });
  }

  await sendMessageWithRetry(tab.id, message);
}

// Handle Messages from Content Script or Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const { serverUrl } = await getConfig();

    if (message.action === 'SYNC_SERVER_URL' && message.serverUrl) {
      await chrome.storage.local.set({ serverUrl: message.serverUrl, userSetServer: true });
      await ensurePaired();
      sendResponse({ ok: true, serverUrl: message.serverUrl });
      return;
    }

    if (message.action === 'PRODUCTS_BATCH') {
      const { scanJobId, shop, products, platform } = message;
      try {
        const res = await fetch(`${serverUrl}/api/extension/scans/${scanJobId}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop, products, platform: platform || shop?.platform || 'SHOPEE' }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          sendResponse({ success: false, error: data.error || `HTTP ${res.status}` });
        } else {
          sendResponse({ success: true, data });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    } else if (message.action === 'GET_SERVER_URL') {
      sendResponse({ serverUrl });
    } else if (message.action === 'SCAN_PROGRESS') {
      const { scanJobId, progress, processedProducts } = message;
      try {
        await fetch(`${serverUrl}/api/extension/scans/${scanJobId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress, processedProducts }),
        });
      } catch (err) {}
    } else if (message.action === 'CLOSE_TAB') {
      if (sender.tab && sender.tab.id) {
        chrome.tabs.remove(sender.tab.id).catch(() => {});
      }
    } else if (message.action === 'SCAN_COMPLETE') {
      const { scanJobId } = message;
      try {
        await fetch(`${serverUrl}/api/extension/scans/${scanJobId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        activeScanJob = null;
      } catch (err) {}
    } else if (message.action === 'SCAN_ERROR') {
      const { scanJobId, errorMessage } = message;
      try {
        await fetch(`${serverUrl}/api/extension/scans/${scanJobId}/error`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorMessage }),
        });
        activeScanJob = null;
      } catch (err) {}
    } else if (message.action === 'AFFILIATE_RESULT') {
      const { jobId, affiliateUrl, error } = message;
      try {
        await fetch(`${serverUrl}/api/extension/affiliate/${jobId}/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliateUrl, error }),
        });
      } catch (err) {}
    } else if (message.action === 'GET_STATUS') {
      const { deviceToken } = await getConfig();
      sendResponse({
        connected: Boolean(deviceToken),
        activeScanJob,
      });
    } else if (message.action === 'VIDEO_BROWSER_START') {
      // Don't block - run async orchestration
      sendResponse({ started: true });
      runVideoBrowserPipeline(message.payload);
    }
  })();
  return true; // Keep async channel open
});

// --- VIDEO BROWSER PIPELINE ORCHESTRATOR ---
async function runVideoBrowserPipeline({ imageData, chatgptUrl, flowUrl }) {
  const updateState = async (updates) => {
    const current = (await chrome.storage.local.get('videoPipelineState')).videoPipelineState || {};
    await chrome.storage.local.set({ videoPipelineState: { ...current, ...updates } });
  };

  try {
    // Reset state
    await updateState({
      analyzeStatus: 'active', promptStatus: 'pending',
      video1Status: 'pending', video2Status: 'pending', mergeStatus: 'pending',
      progress: 5, statusText: 'Đang mở ChatGPT...',
      finalVideoUrl: null, error: null
    });

    // === STEP 1: Open ChatGPT and analyze image ===
    const chatgptTab = await chrome.tabs.create({ url: chatgptUrl, active: false });
    await waitForTabComplete(chatgptTab.id);
    await sleep(3000); // Wait for ChatGPT to fully load

    await updateState({ progress: 10, statusText: 'Đang gửi ảnh lên ChatGPT...' });

    const analysisPrompt = `Hãy phân tích ảnh sản phẩm này và tạo 2 prompt video:
- Prompt 1: Video quảng cáo kiểu marketing, close-up chi tiết sản phẩm, nền studio chuyên nghiệp
- Prompt 2: Video lifestyle, sản phẩm đang được sử dụng, góc quay cinematic, ánh sáng tự nhiên

Trả lời theo format:
[PROMPT1]
(nội dung prompt 1 bằng tiếng Anh)
[/PROMPT1]
[PROMPT2]
(nội dung prompt 2 bằng tiếng Anh)
[/PROMPT2]`;

    // Send message to ChatGPT content script
    const chatgptResult = await chrome.tabs.sendMessage(chatgptTab.id, {
      action: 'CHATGPT_ANALYZE',
      imageData,
      prompt: analysisPrompt
    });

    if (!chatgptResult.success) throw new Error('ChatGPT analysis failed: ' + chatgptResult.error);
    
    await updateState({ analyzeStatus: 'done', promptStatus: 'active', progress: 25, statusText: 'Đang tách prompt...' });
    
    // Close ChatGPT tab
    chrome.tabs.remove(chatgptTab.id);

    // === STEP 2: Parse prompts from response ===
    const prompt1Match = chatgptResult.responseText.match(/\[PROMPT1\]([\s\S]*?)\[\/PROMPT1\]/i);
    const prompt2Match = chatgptResult.responseText.match(/\[PROMPT2\]([\s\S]*?)\[\/PROMPT2\]/i);
    
    const prompt1 = prompt1Match ? prompt1Match[1].trim() : 'Professional product showcase video with clean background';
    const prompt2 = prompt2Match ? prompt2Match[1].trim() : 'Lifestyle video of product being used naturally';

    await updateState({ promptStatus: 'done', progress: 30, statusText: 'Đã tách 2 prompt' });

    // === STEP 3: Generate video 1 on Google Flow ===
    await updateState({ video1Status: 'active', progress: 35, statusText: 'Đang tạo video 1 trên Google Flow...' });
    
    const flowTab1 = await chrome.tabs.create({ url: flowUrl, active: false });
    await waitForTabComplete(flowTab1.id);
    await sleep(4000); // Google Flow can be slow to fully initialize

    const video1Result = await chrome.tabs.sendMessage(flowTab1.id, {
      action: 'FLOW_GENERATE',
      imageData,
      prompt: prompt1
    });

    if (!video1Result.success) throw new Error('Google Flow video 1 failed: ' + video1Result.error);
    
    await updateState({ video1Status: 'done', progress: 55, statusText: 'Video 1 hoàn thành!' });
    chrome.tabs.remove(flowTab1.id);

    // === STEP 4: Generate video 2 on Google Flow ===
    await updateState({ video2Status: 'active', progress: 60, statusText: 'Đang tạo video 2 trên Google Flow...' });

    const flowTab2 = await chrome.tabs.create({ url: flowUrl, active: false });
    await waitForTabComplete(flowTab2.id);
    await sleep(4000);

    const video2Result = await chrome.tabs.sendMessage(flowTab2.id, {
      action: 'FLOW_GENERATE',
      imageData,
      prompt: prompt2
    });

    if (!video2Result.success) throw new Error('Google Flow video 2 failed: ' + video2Result.error);
    
    await updateState({ video2Status: 'done', progress: 80, statusText: 'Video 2 hoàn thành!' });
    chrome.tabs.remove(flowTab2.id);

    // === STEP 5: Merge videos via backend ===
    await updateState({ mergeStatus: 'active', progress: 85, statusText: 'Đang ghép 2 video...' });

    const serverUrl = (await chrome.storage.local.get('serverUrl')).serverUrl || 'http://localhost:3000';
    const mergeRes = await fetch(`${serverUrl}/api/video/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrls: [video1Result.videoUrl, video2Result.videoUrl] })
    });
    const mergeData = await mergeRes.json();

    if (!mergeData.success) throw new Error('Video merge failed: ' + mergeData.error);

    await updateState({
      mergeStatus: 'done', progress: 100,
      statusText: '✅ Video hoàn thành!',
      finalVideoUrl: `${serverUrl}${mergeData.videoUrl}`
    });

  } catch (error) {
    console.error('[AFF HUB] Pipeline error:', error);
    await updateState({ error: error.message, statusText: '❌ Lỗi: ' + error.message });
  }
}

// Helper: Wait for tab to finish loading
function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Alarm Timers
sendHeartbeat();
ensurePaired();
setInterval(sendHeartbeat, 15000);
setInterval(pollNextJob, 3000);
