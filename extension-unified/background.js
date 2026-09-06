importScripts('product-collector.js', 'industry-prompt.js');
// =============================================================================
// AutoFlow Hub — Unified Background Service Worker (v2.3.0)
//
// Hợp nhất:
//   1. AutoCut:  WebSocket client (:8765), prompt queue, download management, Side Panel
//   2. AFF HUB:  REST polling, license, CDP debugger, offscreen clipboard, video pipeline
//
// Kiến trúc module:
//   - [CONFIG]      Cấu hình chung & constants
//   - [STATE]       State management cho cả 2 hệ thống
//   - [DESKTOP WS]  WebSocket client kết nối AutoCut Desktop (:8765)
//   - [AFF SERVER]  REST polling kết nối AFF Web App (:3000 / Vercel)
//   - [LICENSE]     Hệ thống bản quyền & heartbeat
//   - [SIDE PANEL]  Side Panel communication (Port-based)
//   - [FLOW QUEUE]  AutoCut prompt queue & dispatch
//   - [CDP]         Chrome Debugger Protocol helpers (AFF)
//   - [CLIPBOARD]   Offscreen document & clipboard
//   - [VIDEO PIPE]  AFF video browser pipeline
//   - [SCANNER]     E-commerce scan job dispatcher
//   - [DOWNLOADS]   Chrome Downloads management
//   - [ROUTER]      Unified message router
// =============================================================================

"use strict";

// ═══════════════════════════════════════════════════════════
// [CONFIG] Constants & Configuration
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // AutoCut Desktop connections
  DESKTOP_WS_URL: "ws://localhost:8765",
  DESKTOP_HTTP_URL: "http://localhost:8766",
  DESKTOP_HEARTBEAT_MS: 20_000,
  DESKTOP_RECONNECT_MS: 5_000,

  // AFF Web App connections
  AFF_DEFAULT_SERVER: "https://affnhanh.vercel.app",
  AFF_HEARTBEAT_MS: 15_000,
  AFF_POLL_INTERVAL_MS: 3_000,

  // Extension
  VERSION: "2.3.0",
  REQUIRED_DESKTOP_VERSION: "1.4.1",

  // Google Flow
  FLOW_HOME_URL: "https://labs.google/fx/vi/tools/flow",
  FLOW_URL_PATTERN: /^https:\/\/labs\.google\/fx\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?tools\/flow(?:[/?#]|$)/u,

  // Downloads
  OUTPUT_DIRECTORY: "AutoFlow_Output",

  // Storage keys
  STATE_KEY: "autoFlowRunState",
  LOGS_KEY: "autoFlowLogs",
  VIDEO_STATE_KEY: "videoPipelineState",

  // Alarms
  DESKTOP_RECONNECT_ALARM: "autoflow-desktop-reconnect",
  NEXT_PROMPT_ALARM: "autoflow-next-prompt",
  AFF_HEARTBEAT_ALARM: "aff-heartbeat",
  AFF_POLL_ALARM: "aff-poll-jobs",

  // Limits
  MAX_LOG_ENTRIES: 200,

  // Workflow modes
  WORKFLOW_MODES: new Set([
    "text_to_video", "text_to_image", "frames_to_video",
    "ingredients_to_video", "image_edit", "video_edit",
    "extend_video", "agent"
  ]),
};

// ═══════════════════════════════════════════════════════════
// [STATE] Unified State Management
// ═══════════════════════════════════════════════════════════

/** State cho AutoCut Flow prompt queue */
let flowRunState = {
  status: "idle",        // idle | preparing | dispatching | generating | downloading | waiting | completed | error | cancelled
  runId: null,
  prompts: [],
  total: 0,
  currentIndex: 0,
  currentPrompt: null,
  minDelayMs: 20_000,
  maxDelayMs: 30_000,
  targetTabId: null,
  source: "sidepanel",   // sidepanel | desktop | aff
  desktopRequestId: null,
  workflow: { mode: "text_to_video" },
  startedAt: null,
  finishedAt: null,
  lastError: null,
};

/** State cho AFF video browser pipeline */
let videoPipelineState = {
  status: "idle",        // idle | running | paused | completed | error | cancelled
  currentStep: null,
  progress: 0,
  error: null,
};

/** Connection states */
let desktopConnectionStatus = "disconnected";  // connecting | connected | disconnected
let affServerConnected = false;

/** Runtime refs */
let desktopSocket = null;
let desktopHeartbeatTimer = null;
let desktopReconnectTimer = null;
let affHeartbeatTimer = null;
let affPollTimer = null;
let logEntries = [];
let activeScanJob = null;

const sidePanelPorts = new Set();

// ═══════════════════════════════════════════════════════════
// [DESKTOP WS] WebSocket Client → AutoCut Desktop (:8765)
// Nguồn gốc: AutoCut background.js
// ═══════════════════════════════════════════════════════════

function connectDesktopApp() {
  if (desktopSocket?.readyState === WebSocket.OPEN ||
      desktopSocket?.readyState === WebSocket.CONNECTING) return;

  clearTimeout(desktopReconnectTimer);
  desktopReconnectTimer = null;
  desktopConnectionStatus = "connecting";
  broadcastToSidePanel({ type: "DESKTOP_CONNECTION", status: desktopConnectionStatus });

  let socket;
  try {
    socket = new WebSocket(CONFIG.DESKTOP_WS_URL);
  } catch (error) {
    console.error("[Hub] Desktop WS create failed:", error);
    desktopConnectionStatus = "disconnected";
    scheduleDesktopReconnect();
    return;
  }
  desktopSocket = socket;

  socket.onopen = () => {
    if (desktopSocket !== socket) { socket.close(); return; }
    desktopConnectionStatus = "connected";

    clearInterval(desktopHeartbeatTimer);
    desktopHeartbeatTimer = setInterval(() => {
      sendDesktopMessage({
        type: "heartbeat",
        status: flowRunState.status,
        timestamp: new Date().toISOString(),
      });
    }, CONFIG.DESKTOP_HEARTBEAT_MS);

    sendDesktopMessage({
      type: "hello",
      message: "Extension đã kết nối",
      extension: "AutoFlow Hub (Unified)",
      version: CONFIG.VERSION,
      status: flowRunState.status,
    });

    broadcastToSidePanel({ type: "DESKTOP_CONNECTION", status: "connected" });
    emitLog("success", `Đã kết nối Desktop App tại ${CONFIG.DESKTOP_WS_URL}.`);
  };

  socket.onmessage = (event) => {
    handleDesktopMessage(event.data);
  };

  socket.onclose = () => {
    if (desktopSocket !== socket) return;
    desktopSocket = null;
    desktopConnectionStatus = "disconnected";
    clearInterval(desktopHeartbeatTimer);
    desktopHeartbeatTimer = null;
    broadcastToSidePanel({ type: "DESKTOP_CONNECTION", status: "disconnected" });
    scheduleDesktopReconnect();
  };

  socket.onerror = (error) => {
    console.error("[Hub] Desktop WS error:", error);
    if (desktopSocket === socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
  };
}

function sendDesktopMessage(payload) {
  if (desktopSocket?.readyState !== WebSocket.OPEN) return false;
  try {
    desktopSocket.send(JSON.stringify(payload));
    return true;
  } catch { return false; }
}

function scheduleDesktopReconnect() {
  clearTimeout(desktopReconnectTimer);
  desktopReconnectTimer = setTimeout(connectDesktopApp, CONFIG.DESKTOP_RECONNECT_MS);
  chrome.alarms.create(CONFIG.DESKTOP_RECONNECT_ALARM, { periodInMinutes: 1 });
}

async function handleDesktopMessage(rawMessage) {
  let message;
  try { message = JSON.parse(rawMessage); } catch { return; }

  const action = message.action || message.type;

  switch (action) {
    case "hello_ack":
      emitLog("info", `Desktop App đã xác nhận kết nối (v${message.required_version || "?"}).`);
      break;

    case "run_prompt":
      // Desktop yêu cầu chạy prompt trên Google Flow
      await handleDesktopRunPrompt(message);
      break;

    case "chatgpt_batch":
      // Desktop yêu cầu batch ChatGPT
      await handleDesktopChatGPTBatch(message);
      break;

    case "stop_batch":
      await stopFlowRun("Desktop yêu cầu dừng.");
      break;

    default:
      console.log("[Hub] Unknown desktop message:", action);
  }
}

async function handleDesktopRunPrompt(message) {
  // Forward prompt tới content script trên tab Google Flow
  // (Logic tương tự AutoCut background.js dispatchCurrentPrompt)
  const tabs = await chrome.tabs.query({ url: "*://labs.google/fx/*" });
  if (!tabs.length) {
    sendDesktopMessage({
      type: "error",
      message: "Không tìm thấy tab Google Flow đang mở.",
      request_id: message.request_id,
    });
    return;
  }
  // Gửi prompt tới content script
  try {
    await chrome.tabs.sendMessage(tabs[0].id, {
      action: "RUN_PROMPT",
      prompt: message.text,
      request_id: message.request_id,
      workflow: message.workflow,
      assets: message.assets,
    });
  } catch (error) {
    sendDesktopMessage({
      type: "error",
      message: `Không gửi được prompt: ${error.message}`,
      request_id: message.request_id,
    });
  }
}

async function handleDesktopChatGPTBatch(message) {
  // Forward cấu hình ChatGPT batch tới Side Panel
  broadcastToSidePanel({
    type: "CHATGPT_BATCH_START",
    config: message,
  });
}

// ═══════════════════════════════════════════════════════════
// [AFF SERVER] REST Polling → AFF Web App
// Nguồn gốc: AFF background.js
// ═══════════════════════════════════════════════════════════

async function getAffConfig() {
  const data = await chrome.storage.local.get(["serverUrl", "deviceToken", "userSetServer"]);
  return {
    serverUrl: data.userSetServer ? (data.serverUrl || CONFIG.AFF_DEFAULT_SERVER) : CONFIG.AFF_DEFAULT_SERVER,
    deviceToken: data.deviceToken || null,
  };
}

async function affFetch(path, options = {}) {
  const { serverUrl } = await getAffConfig();
  const url = `${serverUrl}${path}`;
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    return await response.json();
  } catch (error) {
    console.warn(`[Hub] AFF fetch failed: ${path}`, error.message);
    return null;
  }
}

async function sendAffHeartbeat() {
  const { deviceToken } = await getAffConfig();
  if (!deviceToken) return;
  const { licenseKey } = await chrome.storage.local.get("licenseKey");
  await affFetch("/api/extension/heartbeat", {
    method: "POST",
    body: JSON.stringify({ deviceToken, licenseKey }),
  });
}

async function pollAffJobs() {
  if (activeScanJob || videoPipelineState.status === "running") return;

  const license = await checkAffLicense();
  if (!license?.valid) return;

  const { deviceToken } = await getAffConfig();
  const { licenseKey } = await chrome.storage.local.get("licenseKey");
  const params = new URLSearchParams();
  if (deviceToken) params.append("deviceToken", deviceToken);
  if (licenseKey) params.append("licenseKey", licenseKey);

  const data = await affFetch(`/api/extension/jobs/next?${params}`);
  if (!data?.hasJob || !data.job) return;

  const job = data.job;
  console.log("[Hub] AFF job received:", job.type, job.id);

  switch (job.type) {
    case "SEND_CHATGPT_PROMPT": {
      const result = await dispatchIndustryPrompt(job.payload || {});
      await affFetch('/api/extension/jobs/' + job.id + '/result', { method: 'POST', body: JSON.stringify(result.success ? { result: { chatgptUrl: result.url } } : { error: result.error }) });
      break;
    }
    case "SCAN_SHOP":
      activeScanJob = job;
      await startShopScan(job);
      break;
    case "GENERATE_AFFILIATE_LINK":
      await startAffiliateLinkJob(job);
      break;
    case "GENERATE_VIDEO":
    case "CREATE_VIDEO":
      if (job.payload?.source === 'telegram') {
        await affFetch('/api/extension/jobs/' + job.id + '/result', { method: 'POST', body: JSON.stringify({ error: 'Dùng AFF HUB Extension bản gốc để chạy pipeline video đầy đủ.' }) });
      } else await startVideoBrowserPipeline({ ...(job.payload || {}), extensionJobId: job.id });
      break;
    case "COMMISSION_LOOKUP":
      await startCommissionLookup(job);
      break;
  }
}

// ═══════════════════════════════════════════════════════════
// [LICENSE] License Management & Verification
// Nguồn gốc: AFF background.js
// ═══════════════════════════════════════════════════════════

let lastLicenseCheck = 0;
let lastLicenseResult = { valid: false };

async function checkAffLicense() {
  const data = await chrome.storage.local.get(["licenseKey", "deviceToken"]);
  if (!data.licenseKey) return { valid: false };

  // Cache 5 phút
  if (Date.now() - lastLicenseCheck < 5 * 60 * 1000) return lastLicenseResult;

  const result = await affFetch("/api/extension/auth/verify", {
    method: "POST",
    body: JSON.stringify({ licenseKey: data.licenseKey, deviceToken: data.deviceToken || "temp" }),
  });

  lastLicenseCheck = Date.now();
  lastLicenseResult = result || { valid: false };
  return lastLicenseResult;
}

async function ensurePaired() {
  const { serverUrl, deviceToken } = await getAffConfig();
  try {
    const response = await fetch(`${serverUrl}/api/extension/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceToken, extensionVersion: CONFIG.VERSION }),
    });
    const data = await response.json();
    if (data.deviceToken) {
      await chrome.storage.local.set({ deviceToken: data.deviceToken });
      return data.deviceToken;
    }
  } catch (error) {
    console.warn("[Hub] Pair failed:", error.message);
  }
  return deviceToken;
}

// ═══════════════════════════════════════════════════════════
// [CDP] Chrome Debugger Protocol Helpers
// Nguồn gốc: AFF background.js
// ═══════════════════════════════════════════════════════════

async function withTrustedInput(tabId, operation) {
  if (!tabId) return { ok: false, error: "Tab ID missing" };
  const target = { tabId };
  let attached = false;
  try {
    await chrome.debugger.attach(target, "1.3");
    attached = true;
    return await operation(target);
  } catch (error) {
    const msg = error?.message || String(error);
    const hint = /already attached|another debugger/i.test(msg)
      ? " Đóng DevTools và tắt extension Flow khác." : "";
    return { ok: false, error: `${msg}${hint}` };
  } finally {
    if (attached) await chrome.debugger.detach(target).catch(() => {});
  }
}

async function dispatchTrustedClick(target, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseMoved", x, y, button: "none", buttons: 0,
  });
  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1,
  });
  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1,
  });
}

// ═══════════════════════════════════════════════════════════
// [CLIPBOARD] Offscreen Document & Clipboard API
// Nguồn gốc: AFF background.js
// ═══════════════════════════════════════════════════════════

let offscreenDocumentPromise = null;

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  if (offscreenDocumentPromise) return offscreenDocumentPromise;
  offscreenDocumentPromise = chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["CLIPBOARD"],
    justification: "Copy prompt text to clipboard for pasting into Google Flow Slate editor",
  });
  await offscreenDocumentPromise;
  offscreenDocumentPromise = null;
}

async function writeToClipboard(text) {
  await ensureOffscreenDocument();
  await chrome.runtime.sendMessage({ action: "OFFSCREEN_COPY", text });
}

// ═══════════════════════════════════════════════════════════
// [SIDE PANEL] Side Panel Port Communication
// Nguồn gốc: AutoCut background.js
// ═══════════════════════════════════════════════════════════

function broadcastToSidePanel(message) {
  for (const port of sidePanelPorts) {
    try { port.postMessage(message); } catch { sidePanelPorts.delete(port); }
  }
}

// ═══════════════════════════════════════════════════════════
// [SCANNER] E-Commerce Scan Job Dispatcher
// Nguồn gốc: AFF background.js (simplified stubs)
// ═══════════════════════════════════════════════════════════

async function startShopScan(job) {
  let targetUrl = job.targetUrl;
  if (!targetUrl.startsWith("http")) targetUrl = `https://${targetUrl}`;
  const tab = await chrome.tabs.create({ url: targetUrl, active: true });
  await waitForTabComplete(tab.id, 30_000).catch(() => {});
  await sendTabMessage(tab.id, {
    action: "START_SCAN",
    scanJobId: job.scanJobId || job.id,
    scanToken: job.scanToken,
  });
}

async function startAffiliateLinkJob(job) {
  const url = "https://affiliate.shopee.vn/offer/custom_link";
  const tabs = await chrome.tabs.query({ url: "*://affiliate.shopee.vn/*" });
  const tab = tabs[0] || await chrome.tabs.create({ url, active: true });
  await waitForTabComplete(tab.id, 30_000).catch(() => {});
  await sendTabMessage(tab.id, {
    action: "GENERATE_LINK",
    jobId: job.id,
    payload: job.payload,
  });
}

async function startCommissionLookup(job) {
  const url = "https://affiliate.shopee.vn/offer/product_offer";
  const tabs = await chrome.tabs.query({ url: "*://affiliate.shopee.vn/*" });
  const tab = tabs[0] || await chrome.tabs.create({ url, active: false });
  await waitForTabComplete(tab.id, 30_000).catch(() => {});
  await sendTabMessage(tab.id, {
    action: "COMMISSION_LOOKUP",
    lookupId: job.id,
    payload: job.payload,
  });
}

// ═══════════════════════════════════════════════════════════
// [VIDEO PIPE] AFF Video Browser Pipeline (stub)
// Nguồn gốc: AFF background.js (full implementation pending merge)
// ═══════════════════════════════════════════════════════════

async function startVideoBrowserPipeline(payload) {
  videoPipelineState = { status: "running", currentStep: "init", progress: 0, error: null };
  await chrome.storage.local.set({ [CONFIG.VIDEO_STATE_KEY]: videoPipelineState });
  // TODO: Port full pipeline from AFF background.js runVideoBrowserPipeline()
  console.log("[Hub] Video pipeline started (stub):", payload);
}

function isVideoPipelineBusy() {
  return videoPipelineState.status === "running" || videoPipelineState.status === "paused";
}

// ═══════════════════════════════════════════════════════════
// [FLOW QUEUE] AutoCut Flow Prompt Queue (stub)
// Nguồn gốc: AutoCut background.js (full implementation pending merge)
// ═══════════════════════════════════════════════════════════

async function stopFlowRun(reason) {
  flowRunState.status = "cancelled";
  flowRunState.lastError = reason;
  flowRunState.finishedAt = new Date().toISOString();
  broadcastToSidePanel({ type: "STATE_UPDATE", state: flowRunState });
  emitLog("warn", `Dừng: ${reason}`);
}

// ═══════════════════════════════════════════════════════════
// [UTILS] Shared Utilities
// ═══════════════════════════════════════════════════════════

async function waitForTabComplete(tabId, timeout = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error("Tab load timeout")); }, timeout);
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendTabMessage(tabId, message, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 500));
      else throw error;
    }
  }
}

function emitLog(level, message) {
  const entry = { level, message, timestamp: new Date().toISOString() };
  logEntries.push(entry);
  if (logEntries.length > CONFIG.MAX_LOG_ENTRIES) logEntries = logEntries.slice(-CONFIG.MAX_LOG_ENTRIES);
  broadcastToSidePanel({ type: "LOG", ...entry });
  chrome.storage.local.set({ [CONFIG.LOGS_KEY]: logEntries });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════
// [ROUTER] Unified Message Router
// ═══════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message.action || message.type;

  switch (action) {
    // ---- CDP / Trusted Input (từ AFF flow-content.js) ----
    case "FLOW_CLIPBOARD_PASTE":
      (async () => {
        const result = await withTrustedInput(sender.tab?.id, async (target) => {
          await writeToClipboard(message.text);
          await sleep(100);
          // Focus click
          if (message.x && message.y) {
            await dispatchTrustedClick(target, message.x, message.y);
            await sleep(80);
          }
          // Ctrl+A then Ctrl+V
          await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
            type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2,
          });
          await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
            type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2,
          });
          await sleep(50);
          await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
            type: "keyDown", key: "v", code: "KeyV", windowsVirtualKeyCode: 86, modifiers: 2,
          });
          await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
            type: "keyUp", key: "v", code: "KeyV", windowsVirtualKeyCode: 86, modifiers: 2,
          });
          return { ok: true, method: "clipboard-paste" };
        });
        sendResponse(result);
      })();
      return true;

    case "FLOW_TRUSTED_CLICK":
      (async () => {
        const result = await withTrustedInput(sender.tab?.id, async (target) => {
          await dispatchTrustedClick(target, message.x, message.y);
          return { ok: true };
        });
        sendResponse(result);
      })();
      return true;

    case "FLOW_TRUSTED_INPUT":
      (async () => {
        const result = await withTrustedInput(sender.tab?.id, async (target) => {
          // Dispatch key events for each character
          for (const char of message.text) {
            await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
              type: "keyDown", key: char, text: char,
            });
            await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
              type: "keyUp", key: char,
            });
            await sleep(10);
          }
          return { ok: true, method: "trusted-input" };
        });
        sendResponse(result);
      })();
      return true;

    // ---- AFF Web App Sync (từ AFF content.js) ----
    case "SYNC_SERVER_URL":
      chrome.storage.local.set({ serverUrl: message.serverUrl, userSetServer: true });
      sendResponse({ ok: true });
      return false;

    case "GET_SERVER_URL":
      getAffConfig().then(sendResponse);
      return true;

    case "CHECK_LICENSE":
      checkAffLicense().then(sendResponse);
      return true;

    case "GET_STATUS":
      sendResponse({
        flowRunState,
        videoPipelineState,
        desktopConnected: desktopConnectionStatus === "connected",
        affServerConnected,
        version: CONFIG.VERSION,
      });
      return false;

    // ---- Scanner & Affiliate (từ AFF content.js) ----
    case "PRODUCTS_BATCH":
      (async () => {
        try {
          const data = await affFetch('/api/extension/scans/' + encodeURIComponent(message.scanJobId) + '/products', {
            method: 'POST', body: JSON.stringify({ shop: message.shop, products: message.products, platform: message.platform || message.shop?.platform }),
          });
          sendResponse({ success: !data.error, data, error: data.error });
        } catch (error) { sendResponse({ success: false, error: error.message }); }
      })();
      return true;
    case "SCAN_PROGRESS":
    case "SCAN_COMPLETE":
    case "SCAN_ERROR":
    case "AFFILIATE_RESULT":
    case "COMMISSION_LOOKUP_RESULT":
      // Forward trực tiếp tới AFF server
      (async () => {
        const result = await affFetch(message.endpoint || "/api/extension/jobs/result", {
          method: "POST",
          body: JSON.stringify(message.data || message),
        });
        sendResponse(result);
      })();
      return true;

    // ---- Content Script Results (từ AutoCut content.js) ----
    case "CONTENT_RESULT":
      handleFlowContentResult(message, sender);
      sendResponse({ ok: true });
      return false;

    case "CONTENT_ERROR":
      handleFlowContentError(message, sender);
      sendResponse({ ok: true });
      return false;

    // ---- Video Pipeline Control ----
    case "VIDEO_BROWSER_START":
      startVideoBrowserPipeline(message.payload).then(() => sendResponse({ started: true }));
      return true;

    case "VIDEO_BROWSER_PAUSE":
    case "VIDEO_BROWSER_RESUME":
    case "VIDEO_BROWSER_CANCEL":
    case "VIDEO_BROWSER_RETRY":
    case "VIDEO_BROWSER_RESET":
      // TODO: Implement pipeline control
      sendResponse({ ok: true, action });
      return false;

    default:
      return false;
  }
});

// ---- Stub handlers for flow content results ----
function handleFlowContentResult(message, sender) {
  // Forward to Desktop App if the prompt came from there
  if (flowRunState.desktopRequestId) {
    sendDesktopMessage({
      type: "success",
      files: message.files || [],
      request_id: flowRunState.desktopRequestId,
    });
  }
  broadcastToSidePanel({ type: "CONTENT_RESULT", data: message });
}

function handleFlowContentError(message, sender) {
  if (flowRunState.desktopRequestId) {
    sendDesktopMessage({
      type: "error",
      message: message.error || "Unknown error",
      request_id: flowRunState.desktopRequestId,
    });
  }
  broadcastToSidePanel({ type: "CONTENT_ERROR", data: message });
}

// ═══════════════════════════════════════════════════════════
// [LIFECYCLE] Extension Lifecycle Events
// ═══════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[Hub] Extension installed/updated v" + CONFIG.VERSION);

  // Configure Side Panel
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } catch {}

  // Start connections
  connectDesktopApp();
  ensurePaired();

  // Setup polling alarms
  chrome.alarms.create(CONFIG.AFF_HEARTBEAT_ALARM, { periodInMinutes: 0.25 });  // ~15s
  chrome.alarms.create(CONFIG.AFF_POLL_ALARM, { delayInMinutes: 0.05, periodInMinutes: 0.05 }); // ~3s
});

chrome.runtime.onStartup.addListener(() => {
  connectDesktopApp();
  ensurePaired();
});

// Side Panel port management
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "autoflow-sidepanel") {
    sidePanelPorts.add(port);
    port.onDisconnect.addListener(() => sidePanelPorts.delete(port));
    port.onMessage.addListener((message) => handleSidePanelMessage(port, message));

    // Send initial state
    port.postMessage({ type: "INIT_STATE", flowRunState, desktopConnectionStatus, logs: logEntries });
  }
});

function handleSidePanelMessage(port, message) {
  // TODO: Full implementation from AutoCut sidepanel.js message handling
  console.log("[Hub] Side Panel message:", message);
}

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  switch (alarm.name) {
    case CONFIG.DESKTOP_RECONNECT_ALARM:
      if (desktopConnectionStatus !== "connected") connectDesktopApp();
      break;
    case CONFIG.AFF_HEARTBEAT_ALARM:
      sendAffHeartbeat();
      break;
    case CONFIG.AFF_POLL_ALARM:
      pollAffJobs();
      break;
    case CONFIG.NEXT_PROMPT_ALARM:
      // TODO: dispatch next prompt in queue
      break;
  }
});

// Tab events
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Auto-open side panel when navigating to Google Flow
  if (changeInfo.status === "complete" && tab.url && CONFIG.FLOW_URL_PATTERN.test(tab.url)) {
    chrome.sidePanel.open({ tabId }).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════
// [BOOT] Initialize on load
// ═══════════════════════════════════════════════════════════

(async function boot() {
  // Restore persisted state
  const stored = await chrome.storage.local.get([CONFIG.STATE_KEY, CONFIG.LOGS_KEY, CONFIG.VIDEO_STATE_KEY]);
  logEntries = Array.isArray(stored[CONFIG.LOGS_KEY]) ? stored[CONFIG.LOGS_KEY].slice(-CONFIG.MAX_LOG_ENTRIES) : [];
  if (stored[CONFIG.STATE_KEY]) {
    flowRunState = { ...flowRunState, ...stored[CONFIG.STATE_KEY] };
  }
  if (stored[CONFIG.VIDEO_STATE_KEY]) {
    videoPipelineState = { ...videoPipelineState, ...stored[CONFIG.VIDEO_STATE_KEY] };
  }

  // Connect to both backends
  connectDesktopApp();
  sendAffHeartbeat();

  console.log("[Hub] AutoFlow Hub v" + CONFIG.VERSION + " initialized.");
})();
