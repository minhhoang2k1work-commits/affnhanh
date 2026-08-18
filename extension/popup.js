document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);
  const sendRuntime = (message) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response || {});
    });
  });

  const statusBadge = $('statusBadge');
  const statusText = $('statusText');
  const currentPage = $('currentPage');
  const deviceToken = $('deviceToken');
  const scanBtn = $('scanBtn');
  const serverSelect = $('serverSelect');

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isMarketplace = Boolean(activeTab?.url && (activeTab.url.includes('shopee.vn') || activeTab.url.includes('tiktok.com')));
  currentPage.textContent = isMarketplace ? 'Shopee / TikTok Shop' : 'Trang khác';
  scanBtn.disabled = !isMarketplace;
  scanBtn.style.opacity = isMarketplace ? '1' : '0.5';

  try {
    const status = await sendRuntime({ action: 'GET_STATUS' });
    statusBadge.className = `badge-status ${status.connected ? 'connected' : 'disconnected'}`;
    statusText.textContent = status.connected ? '● Connected' : '○ Not Connected';
  } catch {
    statusBadge.className = 'badge-status disconnected';
    statusText.textContent = '○ Not Connected';
  }

  const stored = await chrome.storage.local.get([
    'deviceToken', 'serverUrl', 'chatgptUrl', 'flowUrl', 'flowReferenceMode',
    'flowAspectRatio', 'flowDuration', 'videoProductUrl', 'videoPipelineState',
  ]);
  if (stored.deviceToken) deviceToken.textContent = `Device: ${stored.deviceToken.substring(0, 16)}...`;
  if (stored.serverUrl && serverSelect) serverSelect.value = stored.serverUrl;

  serverSelect?.addEventListener('change', async (event) => {
    const selectedUrl = event.target.value;
    await chrome.storage.local.set({ serverUrl: selectedUrl, userSetServer: true });
    await sendRuntime({ action: 'SYNC_SERVER_URL', serverUrl: selectedUrl }).catch(() => {});
  });

  scanBtn.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    scanBtn.textContent = 'ĐANG KHỞI TẠO QUÉT...';
    scanBtn.disabled = true;
    chrome.tabs.sendMessage(activeTab.id, {
      action: 'START_SCAN',
      scanJobId: `ext_${Date.now()}`,
    }, (response) => {
      scanBtn.textContent = response?.started ? '✓ ĐANG QUÉT VỀ AFF HUB' : 'Hãy F5 lại trang Shop!';
    });
  });

  document.querySelectorAll('.tab').forEach((tabButton) => {
    tabButton.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((item) => item.classList.remove('active'));
      tabButton.classList.add('active');
      $(tabButton.dataset.tab)?.classList.add('active');
    });
  });

  const videoImageUrl = $('videoImageUrl');
  const videoProductUrl = $('videoProductUrl');
  const uploadArea = $('uploadArea');
  const imagePreview = $('imagePreview');
  const previewImg = $('previewImg');
  const chatgptUrl = $('chatgptUrl');
  const flowUrl = $('flowUrl');
  const flowReferenceMode = $('flowReferenceMode');
  const flowAspectRatio = $('flowAspectRatio');
  const flowDuration = $('flowDuration');
  const generateVideoBtn = $('generateVideoBtn');
  const videoControls = $('videoControls');
  const pauseVideoBtn = $('pauseVideoBtn');
  const cancelVideoBtn = $('cancelVideoBtn');
  const retryVideoBtn = $('retryVideoBtn');
  const checkConnectionsBtn = $('checkConnectionsBtn');
  const chatgptConnection = $('chatgptConnection');
  const flowConnection = $('flowConnection');
  const videoProgress = $('videoProgress');
  const progressFill = $('progressFill');
  const progressText = $('progressText');
  const productDetailsInfo = $('productDetailsInfo');
  const videoResult = $('videoResult');
  const resultVideo = $('resultVideo');
  const flowResultLinks = $('flowResultLinks');
  const downloadVideoBtn = $('downloadVideoBtn');
  const newVideoBtn = $('newVideoBtn');
  let currentImageData = null;
  let currentPipelineState = stored.videoPipelineState || null;

  chatgptUrl.value = stored.chatgptUrl || 'https://chatgpt.com/';
  flowUrl.value = stored.flowUrl || 'https://labs.google/fx/tools/flow';
  flowReferenceMode.value = stored.flowReferenceMode || 'ingredient';
  flowAspectRatio.value = stored.flowAspectRatio || '9:16';
  flowDuration.value = String(stored.flowDuration || 8);
  videoProductUrl.value = isMarketplace ? activeTab.url : (stored.videoProductUrl || '');

  function validUrl(value, allowedHosts) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' && allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
    } catch {
      return false;
    }
  }

  function showPreview(src) {
    previewImg.src = src;
    imagePreview.style.display = 'block';
    uploadArea.style.display = 'none';
  }

  function hidePreview() {
    imagePreview.style.display = 'none';
    uploadArea.style.display = 'block';
    previewImg.removeAttribute('src');
  }

  function handleFile(file) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Ảnh tối đa 15 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      currentImageData = event.target.result;
      videoImageUrl.value = '';
      showPreview(currentImageData);
    };
    reader.readAsDataURL(file);
  }

  videoImageUrl.addEventListener('input', (event) => {
    const value = event.target.value.trim();
    currentImageData = value.startsWith('http') || value.startsWith('data:image') ? value : null;
    if (currentImageData) showPreview(currentImageData);
    else hidePreview();
  });

  uploadArea.addEventListener('click', () => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/jpeg,image/png,image/webp';
    picker.onchange = (event) => handleFile(event.target.files?.[0]);
    picker.click();
  });
  uploadArea.addEventListener('dragover', (event) => event.preventDefault());
  uploadArea.addEventListener('drop', (event) => {
    event.preventDefault();
    handleFile(event.dataTransfer?.files?.[0]);
  });

  function updateStep(stepId, status) {
    const element = $(stepId);
    if (!element) return;
    const label = element.dataset.label || element.textContent.replace(/^[^A-Za-zÀ-ỹ0-9]+\s*/, '');
    element.dataset.label = label;
    element.className = 'progress-step';
    const icons = { active: '🔄', done: '✅', skipped: '⚠️', error: '❌', pending: '⏳' };
    if (status === 'active') element.classList.add('active');
    if (status === 'done') element.classList.add('done');
    if (status === 'skipped') element.classList.add('error');
    if (status === 'error') element.classList.add('error');
    element.textContent = `${icons[status] || icons.pending} ${label}`;
  }

  function renderPipelineState(state) {
    if (!state) return;
    currentPipelineState = state;
    ['analyze', 'prompt', 'video1', 'video2', 'merge'].forEach((step) => {
      updateStep(`step-${step}`, state[`${step}Status`] || 'pending');
    });
    progressFill.style.width = `${state.progress || 0}%`;
    progressText.textContent = state.statusText || 'Đang khởi tạo...';
    if (state.productDetailsStatus === 'done' && state.productDetails) {
      const details = state.productDetails;
      const labels = [details.name, details.brand, details.category].filter(Boolean);
      productDetailsInfo.style.display = 'block';
      productDetailsInfo.textContent = details.warning
        ? `⚠ Không đọc được trang sàn, đang dùng dữ liệu thư viện: ${labels.join(' · ')}`
        : `✓ Đã lấy chi tiết sản phẩm: ${labels.join(' · ')}`;
    } else {
      productDetailsInfo.style.display = 'none';
      productDetailsInfo.textContent = '';
    }

    const isRunning = state.status === 'running' || state.status === 'pausing' || state.status === 'paused';
    generateVideoBtn.style.display = isRunning ? 'none' : 'flex';
    videoControls.style.display = isRunning ? 'flex' : 'none';
    const resultLinks = [...new Set((state.resultLinks || []).filter(Boolean))];
    const hasResult = Boolean(state.finalVideoUrl || resultLinks.length);
    videoProgress.style.display = isRunning || ['error', 'cancelled', 'completed_with_links'].includes(state.status) ? 'block' : 'none';
    retryVideoBtn.style.display = state.status === 'error' || state.status === 'cancelled' || state.status === 'interrupted' ? 'flex' : 'none';
    pauseVideoBtn.textContent = state.status === 'paused' || state.status === 'pausing' ? '▶ Tiếp tục' : '⏸ Tạm dừng';

    videoResult.style.display = hasResult ? 'block' : 'none';
    flowResultLinks.replaceChildren();
    resultLinks.forEach((url, index) => {
      const link = document.createElement('a');
      link.className = 'result-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `🎬 Mở video ${index + 1} trên Google Flow`;
      flowResultLinks.appendChild(link);
    });

    if (state.finalVideoUrl) {
      videoControls.style.display = 'none';
      retryVideoBtn.style.display = 'none';
      resultVideo.style.display = 'block';
      downloadVideoBtn.style.display = 'flex';
      resultVideo.src = state.finalVideoUrl;
      downloadVideoBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = state.finalVideoUrl;
        link.download = 'aff-video-ai.mp4';
        link.target = '_blank';
        link.click();
      };
    } else {
      resultVideo.pause();
      resultVideo.removeAttribute('src');
      resultVideo.load();
      resultVideo.style.display = 'none';
      downloadVideoBtn.style.display = 'none';
    }
  }

  async function startVideo() {
    const imageData = currentImageData || videoImageUrl.value.trim();
    const chatgpt = chatgptUrl.value.trim();
    const flow = flowUrl.value.trim();
    const productUrl = videoProductUrl.value.trim();
    const flowOptions = {
      referenceMode: flowReferenceMode.value,
      aspectRatio: flowAspectRatio.value,
      duration: Number(flowDuration.value),
      outputCount: 1,
    };
    if (!imageData) return alert('Vui lòng chọn ảnh sản phẩm.');
    if (!validUrl(chatgpt, ['chatgpt.com'])) return alert('Link ChatGPT không hợp lệ.');
    if (!validUrl(flow, ['flow.google', 'labs.google'])) return alert('Link Google Flow không hợp lệ.');
    if (productUrl && !validUrl(productUrl, ['shopee.vn', 'tiktok.com'])) {
      return alert('Link sản phẩm phải thuộc Shopee hoặc TikTok.');
    }

    await chrome.storage.local.set({
      chatgptUrl: chatgpt,
      flowUrl: flow,
      flowReferenceMode: flowOptions.referenceMode,
      flowAspectRatio: flowOptions.aspectRatio,
      flowDuration: flowOptions.duration,
      videoProductUrl: productUrl,
    });
    videoResult.style.display = 'none';
    videoProgress.style.display = 'block';
    retryVideoBtn.style.display = 'none';
    renderPipelineState({
      status: 'running', progress: 1, statusText: 'Đang khởi tạo...',
      analyzeStatus: 'active', promptStatus: 'pending', video1Status: 'pending', video2Status: 'pending', mergeStatus: 'pending',
    });
    try {
      const response = await sendRuntime({
        action: 'VIDEO_BROWSER_START',
        payload: {
          imageData,
          chatgptUrl: chatgpt,
          flowUrl: flow,
          flowOptions,
          productUrl,
          productContext: productUrl ? { originalUrl: productUrl } : {},
        },
      });
      if (!response.started) throw new Error(response.error || 'Không khởi động được pipeline');
    } catch (error) {
      alert(`Lỗi khởi tạo: ${error.message}`);
      generateVideoBtn.style.display = 'flex';
      videoControls.style.display = 'none';
    }
  }

  async function checkConnections() {
    checkConnectionsBtn.disabled = true;
    checkConnectionsBtn.textContent = 'ĐANG KIỂM TRA...';
    try {
      const response = await sendRuntime({
        action: 'VIDEO_BROWSER_CHECK_CONNECTIONS',
        payload: { chatgptUrl: chatgptUrl.value.trim(), flowUrl: flowUrl.value.trim() },
      });
      const paint = (element, label, state) => {
        element.className = `connection-item ${state?.ready ? 'ready' : 'login'}`;
        element.textContent = `${label}: ${state?.ready ? 'sẵn sàng' : (state?.message || 'cần đăng nhập')}`;
      };
      paint(chatgptConnection, 'ChatGPT', response.chatgpt);
      paint(flowConnection, 'Flow', response.flow);
    } catch (error) {
      alert(`Không kiểm tra được: ${error.message}`);
    } finally {
      checkConnectionsBtn.disabled = false;
      checkConnectionsBtn.textContent = 'KIỂM TRA KẾT NỐI';
    }
  }

  generateVideoBtn.addEventListener('click', startVideo);
  checkConnectionsBtn.addEventListener('click', checkConnections);
  pauseVideoBtn.addEventListener('click', async () => {
    const action = currentPipelineState?.status === 'paused' || currentPipelineState?.status === 'pausing'
      ? 'VIDEO_BROWSER_RESUME' : 'VIDEO_BROWSER_PAUSE';
    await sendRuntime({ action }).catch((error) => alert(error.message));
  });
  cancelVideoBtn.addEventListener('click', async () => {
    await sendRuntime({ action: 'VIDEO_BROWSER_CANCEL' }).catch((error) => alert(error.message));
  });
  retryVideoBtn.addEventListener('click', async () => {
    const response = await sendRuntime({ action: 'VIDEO_BROWSER_RETRY' }).catch((error) => ({ started: false, error: error.message }));
    if (!response.started) alert(response.error || 'Không thể thử lại');
  });

  newVideoBtn.addEventListener('click', async () => {
    await sendRuntime({ action: 'VIDEO_BROWSER_RESET' }).catch(() => {});
    currentImageData = null;
    videoImageUrl.value = '';
    videoProductUrl.value = '';
    hidePreview();
    videoResult.style.display = 'none';
    videoProgress.style.display = 'none';
    retryVideoBtn.style.display = 'none';
    generateVideoBtn.style.display = 'flex';
    resultVideo.removeAttribute('src');
    flowResultLinks.replaceChildren();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.videoPipelineState?.newValue) {
      renderPipelineState(changes.videoPipelineState.newValue);
    }
  });

  if (currentPipelineState) renderPipelineState(currentPipelineState);
});
