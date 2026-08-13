document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const currentPage = document.getElementById('currentPage');
  const deviceToken = document.getElementById('deviceToken');
  const scanBtn = document.getElementById('scanBtn');

  // Fetch current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    if (tab.url.includes('shopee.vn')) {
      currentPage.innerText = 'Shopee Shop / Product';
    } else {
      currentPage.innerText = 'Không phải trang Shopee';
      scanBtn.disabled = true;
      scanBtn.style.opacity = '0.5';
    }
  }

  // Get status from background
  chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (res) => {
    if (res && res.connected) {
      statusBadge.className = 'badge-status connected';
      statusText.innerText = '● Connected';
    } else {
      statusBadge.className = 'badge-status disconnected';
      statusText.innerText = '○ Not Connected';
    }
  });

  // Get stored deviceToken & serverUrl
  const serverSelect = document.getElementById('serverSelect');
  const stored = await chrome.storage.local.get(['deviceToken', 'serverUrl']);
  if (stored.deviceToken) {
    deviceToken.innerText = `Device: ${stored.deviceToken.substring(0, 16)}...`;
  }
  if (stored.serverUrl && serverSelect) {
    serverSelect.value = stored.serverUrl;
  }
  if (serverSelect) {
    serverSelect.addEventListener('change', async (e) => {
      const selectedUrl = e.target.value;
      await chrome.storage.local.set({ serverUrl: selectedUrl });
      chrome.runtime.sendMessage({ action: 'GET_STATUS' });
    });
  }

  // Click Scan Shop Button
  scanBtn.addEventListener('click', async () => {
    if (!tab || !tab.id) return;
    scanBtn.innerText = 'ĐANG KHỞI TẠO QUÉT...';
    scanBtn.disabled = true;

    chrome.tabs.sendMessage(tab.id, {
      action: 'START_SCAN',
      scanJobId: `ext_${Date.now()}`,
    }, (response) => {
      if (response && response.started) {
        scanBtn.innerText = '✓ ĐANG QUÉT VỀ AFF HUB';
      } else {
        scanBtn.innerText = 'Hãy F5 lại trang Shopee!';
      }
    });
  });
});
