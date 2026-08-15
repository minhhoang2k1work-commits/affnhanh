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
      await chrome.storage.local.set({ serverUrl: selectedUrl, userSetServer: true });
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
  // --- TABS LOGIC ---
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

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
      await chrome.storage.local.set({ serverUrl: selectedUrl, userSetServer: true });
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
  // --- TABS LOGIC ---
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      tabContents.forEach(x => x.classList.remove('active'));
      
      t.classList.add('active');
      document.getElementById(t.dataset.tab).classList.add('active');
    });
  });

  // --- VIDEO AI LOGIC ---
  const videoImageUrl = document.getElementById('videoImageUrl');
  const uploadArea = document.getElementById('uploadArea');
  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  
  const chatgptUrl = document.getElementById('chatgptUrl');
  const flowUrl = document.getElementById('flowUrl');

  const generateVideoBtn = document.getElementById('generateVideoBtn');
  const videoProgress = document.getElementById('videoProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  const videoResult = document.getElementById('videoResult');
  const resultVideo = document.getElementById('resultVideo');
  const downloadVideoBtn = document.getElementById('downloadVideoBtn');
  const newVideoBtn = document.getElementById('newVideoBtn');

  let currentImageBase64 = null;

  // Load saved URLs
  chrome.storage.local.get(['chatgptUrl', 'flowUrl']).then(savedUrls => {
    if (savedUrls.chatgptUrl) chatgptUrl.value = savedUrls.chatgptUrl;
    if (savedUrls.flowUrl) flowUrl.value = savedUrls.flowUrl;
  });

  // Handle URL paste
  videoImageUrl.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url.startsWith('http') || url.startsWith('data:image')) {
      showPreview(url);
      currentImageBase64 = url;
    } else {
      hidePreview();
      currentImageBase64 = null;
    }
  });

  // Handle File Upload
  uploadArea.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png, image/webp';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    };
    input.click();
  });

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#a855f7';
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#334155';
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#334155';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentImageBase64 = e.target.result;
      videoImageUrl.value = '';
      showPreview(currentImageBase64);
    };
    reader.readAsDataURL(file);
  }

  function showPreview(src) {
    previewImg.src = src;
    imagePreview.style.display = 'block';
    uploadArea.style.display = 'none';
  }

  function hidePreview() {
    imagePreview.style.display = 'none';
    uploadArea.style.display = 'block';
    previewImg.src = '';
  }

  // Generate Video Flow
  generateVideoBtn.addEventListener('click', async () => {
    const imageData = currentImageBase64 || videoImageUrl.value.trim();
    const chatGptUrlStr = chatgptUrl.value.trim();
    const flowUrlStr = flowUrl.value.trim();

    if (!imageData) {
      alert('Vui lòng chọn hoặc nhập link ảnh sản phẩm!');
      return;
    }
    if (!chatGptUrlStr) {
      alert('Vui lòng nhập link trợ lý ChatGPT!');
      return;
    }

    // Save URLs for next time
    await chrome.storage.local.set({ chatgptUrl: chatGptUrlStr, flowUrl: flowUrlStr });

    // UI State update
    generateVideoBtn.style.display = 'none';
    videoProgress.style.display = 'block';
    resetStepIndicators();

    // Send to background
    chrome.runtime.sendMessage({
      action: 'VIDEO_BROWSER_START',
      payload: { imageData, chatgptUrl: chatGptUrlStr, flowUrl: flowUrlStr }
    }, (res) => {
      if (!res || !res.started) {
        alert('Lỗi khởi tạo: ' + (res?.error || 'Unknown error'));
        resetVideoUI();
      }
    });
  });

  // Progress monitoring via storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.videoPipelineState) {
      const state = changes.videoPipelineState.newValue;
      if (!state) return;
      
      // Update step indicators
      updateStep('step-analyze', state.analyzeStatus); // 'pending' | 'active' | 'done' | 'error'
      updateStep('step-prompt', state.promptStatus);
      updateStep('step-video1', state.video1Status);
      updateStep('step-video2', state.video2Status);
      updateStep('step-merge', state.mergeStatus);
      
      progressFill.style.width = (state.progress || 0) + '%';
      if (state.statusText) progressText.innerText = state.statusText;
      
      if (state.finalVideoUrl) {
        showResult(state.finalVideoUrl);
      }
      if (state.error) {
        alert('Lỗi: ' + state.error);
        resetVideoUI();
      }
    }
  });

  function updateStep(stepId, status) {
    const el = document.getElementById(stepId);
    if (!el) return;
    el.className = 'progress-step';
    const text = el.textContent.replace(/^[⏳🔄✅❌]\s*/, '');
    if (status === 'active') {
      el.classList.add('active');
      el.textContent = '🔄 ' + text;
    } else if (status === 'done') {
      el.classList.add('done');
      el.textContent = '✅ ' + text;
    } else if (status === 'error') {
      el.classList.add('error');
      el.textContent = '❌ ' + text;
    } else {
      el.textContent = '⏳ ' + text;
    }
  }

  function showResult(videoUrl) {
    videoProgress.style.display = 'none';
    videoResult.style.display = 'block';
    resultVideo.src = videoUrl;
    
    downloadVideoBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'aff_video_ai.mp4';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
  }

  newVideoBtn.addEventListener('click', resetVideoUI);

  function resetStepIndicators() {
    updateStep('step-analyze', 'pending');
    updateStep('step-prompt', 'pending');
    updateStep('step-video1', 'pending');
    updateStep('step-video2', 'pending');
    updateStep('step-merge', 'pending');
  }

  function resetVideoUI() {
    generateVideoBtn.style.display = 'block';
    videoProgress.style.display = 'none';
    videoResult.style.display = 'none';
    videoImageUrl.value = '';
    currentImageBase64 = null;
    hidePreview();
    resultVideo.src = '';
    resetStepIndicators();
  }
});
