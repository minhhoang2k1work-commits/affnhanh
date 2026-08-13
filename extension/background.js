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
  const tabs = await chrome.tabs.query({ url: '*://shopee.vn/*' });
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
  const { serverUrl } = await getConfig();
  const affUrl = `https://affiliate.shopee.vn/offer/product_offer`;
  const tabs = await chrome.tabs.query({ url: '*://affiliate.shopee.vn/*' });

  let tab = tabs[0];
  if (!tab) {
    tab = await chrome.tabs.create({ url: affUrl, active: true });
  }

  setTimeout(() => {
    chrome.tabs.sendMessage(tab.id, {
      action: 'GENERATE_LINK',
      jobId: job.id,
      payload: job.payload,
    });
  }, 2000);
}

// Handle Messages from Content Script or Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const { serverUrl } = await getConfig();

    if (message.action === 'PRODUCTS_BATCH') {
      const { scanJobId, shop, products } = message;
      try {
        const res = await fetch(`${serverUrl}/api/extension/scans/${scanJobId}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop, products }),
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
    }
  })();
  return true; // Keep async channel open
});

// Alarm Timers
sendHeartbeat();
ensurePaired();
setInterval(sendHeartbeat, 15000);
setInterval(pollNextJob, 3000);
