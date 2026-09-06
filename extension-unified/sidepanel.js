"use strict";

const elements = {
  prompts: document.querySelector("#prompts"),
  promptCount: document.querySelector("#promptCount"),
  minDelay: document.querySelector("#minDelay"),
  maxDelay: document.querySelector("#maxDelay"),
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
  resetButton: document.querySelector("#resetButton"),
  clearLogsButton: document.querySelector("#clearLogsButton"),
  fmMiniLogList: document.querySelector("#fmMiniLogList"),
  fmClearMiniLog: document.querySelector("#fmClearMiniLog"),
  statusBadge: document.querySelector("#statusBadge"),
  desktopBadge: document.querySelector("#desktopBadge"),
  progressText: document.querySelector("#progressText"),
  progressNumbers: document.querySelector("#progressNumbers"),
  progressBar: document.querySelector("#progressBar"),
  currentPrompt: document.querySelector("#currentPrompt"),
  logList: document.querySelector("#logList"),
  targetCard: document.querySelector("#targetCard"),
  targetIcon: document.querySelector("#targetIcon"),
  targetTitle: document.querySelector("#targetTitle"),
  targetDescription: document.querySelector("#targetDescription"),
  openFlowButton: document.querySelector("#openFlowButton"),
  flowGate: document.querySelector("#flowGate"),
  workflowMode: document.querySelector("#workflowMode"),
  workflowTabs: document.querySelector("#workflowTabs"),
  workflowTabButtons: [...document.querySelectorAll("[data-workflow-mode]")],
  panelTabButtons: [...document.querySelectorAll("[data-panel-target]")],
  panelViews: [...document.querySelectorAll("[data-panel-view]")],
  mainTabButtons: [...document.querySelectorAll("[data-main-group]")],
  flowSubTabs: document.querySelector("#flowSubTabs"),
  workflowHelp: document.querySelector("#workflowHelp"),
  modelSelect: document.querySelector("#modelSelect"),
  aspectRatio: document.querySelector("#aspectRatio"),
  durationSelect: document.querySelector("#durationSelect"),
  outputCount: document.querySelector("#outputCount"),
  assetFields: document.querySelector("#assetFields"),
  startFrameGroup: document.querySelector("#startFrameGroup"),
  endFrameGroup: document.querySelector("#endFrameGroup"),
  referenceFilesGroup: document.querySelector("#referenceFilesGroup"),
  sourceImagesGroup: document.querySelector("#sourceImagesGroup"),
  sourceVideoGroup: document.querySelector("#sourceVideoGroup"),
  agentAssetsGroup: document.querySelector("#agentAssetsGroup"),
  startFrameInput: document.querySelector("#startFrameInput"),
  endFrameInput: document.querySelector("#endFrameInput"),
  referenceFiles: document.querySelector("#referenceFiles"),
  sourceImages: document.querySelector("#sourceImages"),
  sourceVideo: document.querySelector("#sourceVideo"),
  agentAssets: document.querySelector("#agentAssets"),
  startButtonLabel: document.querySelector("#startButtonLabel"),
  // Flow Picker
  flowPickerOverlay: document.querySelector("#flowPickerOverlay"),
  flowPickerGrid: document.querySelector("#flowPickerGrid"),
  flowPickerStatus: document.querySelector("#flowPickerStatus"),
  flowPickerClose: document.querySelector("#flowPickerClose"),
  flowPickerConfirm: document.querySelector("#flowPickerConfirm"),
  flowPickerRefresh: document.querySelector("#flowPickerRefresh"),
  flowPickerCount: document.querySelector("#flowPickerCount")
};

const RUNNING_STATUSES = new Set(["preparing", "dispatching", "generating", "downloading", "waiting"]);
const STARTABLE_TARGET_STATUSES = new Set(["ready", "flow_project_list"]);
const STATUS_LABELS = {
  idle: "Sẵn sàng",
  preparing: "Đang chuẩn bị",
  dispatching: "Đang gửi",
  generating: "Đang tạo",
  downloading: "Đang tải",
  waiting: "Đang chờ",
  completed: "Hoàn tất",
  stopped: "Đã dừng",
  error: "Có lỗi"
};

const WORKFLOW_DEFINITIONS = {
  text_to_video: {
    help: "Tạo video trực tiếp từ từng prompt văn bản.",
    modelGroup: "video",
    assetGroups: []
  },
  text_to_image: {
    help: "Tạo hình ảnh độc lập hoặc nguyên liệu cho video.",
    modelGroup: "image",
    assetGroups: []
  },
  frames_to_video: {
    help: "Tạo chuyển động từ khung hình đầu và khung hình cuối tùy chọn.",
    modelGroup: "video",
    assetGroups: ["startFrameGroup", "endFrameGroup"]
  },
  ingredients_to_video: {
    help: "Giữ nhân vật, vật thể hoặc phong cách bằng tệp tham chiếu.",
    modelGroup: "video",
    assetGroups: ["referenceFilesGroup"]
  },
  image_edit: {
    help: "Chỉnh một hoặc nhiều hình ảnh bằng prompt tự nhiên.",
    modelGroup: "image",
    assetGroups: ["sourceImagesGroup"]
  },
  video_edit: {
    help: "Chỉnh video bằng Gemini Omni Flash; tệp lớn nên tải trực tiếp lên Flow.",
    modelGroup: "video_edit",
    assetGroups: ["sourceVideoGroup"]
  },
  extend_video: {
    help: "Mở một video Veo trong Flow trước, extension sẽ chọn Extend và chạy các prompt nối tiếp.",
    modelGroup: "extend",
    assetGroups: []
  },
  agent: {
    help: "Dùng Flow Agent để chọn model, tạo biến thể hàng loạt hoặc tổ chức yêu cầu phức tạp.",
    modelGroup: "agent",
    assetGroups: ["agentAssetsGroup"]
  }
};

const MODEL_OPTIONS = {
  video: [
    ["auto", "Giữ model hiện tại"],
    ["veo_3_1_fast", "Veo 3.1 Fast"],
    ["veo_3_1_quality", "Veo 3.1 Quality"],
    ["veo_3_1_lite", "Veo 3.1 Lite"],
    ["omni_flash", "Gemini Omni Flash"]
  ],
  image: [
    ["auto", "Giữ model hiện tại"],
    ["nano_banana_pro", "Nano Banana Pro"],
    ["nano_banana_2", "Nano Banana 2"],
    ["nano_banana_2_lite", "Nano Banana 2 Lite"]
  ],
  video_edit: [
    ["auto", "Tự chọn Omni Flash"],
    ["omni_flash", "Gemini Omni Flash"]
  ],
  extend: [
    ["auto", "Model tương thích hiện tại"],
    ["veo_3_1_lite", "Veo 3.1 Lite"]
  ],
  agent: [["auto", "Flow Agent tự chọn"]]
};

const MAX_ASSET_BYTES = 24 * 1024 * 1024;

let backgroundPort = null;
let reconnectTimer = null;
let saveTimer = null;
let currentState = null;
let currentTarget = { status: "checking" };
let preparingStart = false;
let activePanel = "control";
let lastFlowPanel = "control"; // nhớ lại sub-tab Flow cuối cùng

// Flow Picker state
const flowPickerState = {
  isOpen: false,
  items: [],            // { url, kind, width, height }
  selected: new Set(),  // selected urls
  multiple: false,
  kindFilter: null,     // "image" | "video" | null = any
  targetInputId: null,  // which file input to populate
  flowAssets: new Map(), // url -> { blob, file } for fetched assets
  nativeItemNames: new Map(), // input id -> Flow library item names
  onConfirm: null        // optional callback(files[]) for custom handling
};

function parsePrompts() {
  return elements.prompts.value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function updatePromptCount() {
  const count = parsePrompts().length;
  elements.promptCount.textContent = `${count} prompt`;
}

function scheduleSettingsSave() {
  if (!globalThis.chrome?.storage?.local) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void chrome.storage.local.set({
      autoFlowUiSettings: {
        promptText: elements.prompts.value,
        minDelaySeconds: elements.minDelay.value,
        maxDelaySeconds: elements.maxDelay.value,
        workflowMode: elements.workflowMode.value,
        model: elements.modelSelect.value,
        aspectRatio: elements.aspectRatio.value,
        duration: elements.durationSelect.value,
        outputCount: elements.outputCount.value,
        activePanel
      }
    });
  }, 250);
}

function postToBackground(message) {
  if (!backgroundPort) {
    showLocalError("Mất kết nối với service worker. Đang thử kết nối lại…");
    return false;
  }

  try {
    backgroundPort.postMessage(message);
    return true;
  } catch (error) {
    showLocalError(`Không gửi được lệnh: ${error.message}`);
    return false;
  }
}

function connectToBackground() {
  clearTimeout(reconnectTimer);

  try {
    const port = chrome.runtime.connect({ name: "autoflow-sidepanel" });
    backgroundPort = port;

    port.onMessage.addListener(handleBackgroundMessage);
    port.onDisconnect.addListener(() => {
      if (backgroundPort === port) {
        backgroundPort = null;
        reconnectTimer = setTimeout(connectToBackground, 1000);
      }
    });

    port.postMessage({ type: "GET_SNAPSHOT" });
  } catch (error) {
    backgroundPort = null;
    showLocalError(`Không kết nối được service worker: ${error.message}`);
    reconnectTimer = setTimeout(connectToBackground, 1000);
  }
}

function handleBackgroundMessage(message) {
  switch (message?.type) {
    case "FLOW_IMAGES_RESULT":
      handleFlowImagesResult(message.items || [], message.error || null);
      break;

    case "FLOW_PICKER_ASSETS_RESULT":
      handleFlowPickerAssetsResult(message.items || [], message.error || null);
      break;


    case "SNAPSHOT":
      renderState(message.state);
      renderLogs(message.logs || []);
      renderTargetStatus(message.target || { status: "checking" });
      renderDesktopConnection(message.desktop);
      break;

    case "STATE":
      preparingStart = false;
      renderState(message.state);
      break;

    case "LOG":
      appendLog(message.entry);
      break;

    case "TARGET_STATUS":
      renderTargetStatus(message.target);
      break;

    case "DESKTOP_CONNECTION":
      renderDesktopConnection(message.desktop);
      break;

    case "CHATGPT_BATCH_START":
      void (async () => {
        activatePanel("chatgpt");
        await renderChatGPTGate();
        if (window.AutoChatGPT) {
          window.AutoChatGPT.startBatch(message.config || {});
        }
      })();
      break;

    case "CHATGPT_BATCH_STOP":
      if (window.AutoChatGPT) void window.AutoChatGPT.stopBatch();
      break;

    case "COMMAND_ERROR":
      preparingStart = false;
      if (currentState) renderState(currentState);
      showLocalError(message.message || "Lệnh không thực hiện được.");
      break;

    default:
      break;
  }
}

function renderDesktopConnection(desktop) {
  if (!elements.desktopBadge || !desktop) return;
  const status = desktop.connected ? "connected" : desktop.status === "connecting" ? "connecting" : "disconnected";
  const label = {
    connected: "App: Đã nối",
    connecting: "App: Đang nối",
    disconnected: "App: Mất nối"
  }[status];

  elements.desktopBadge.dataset.status = status;
  elements.desktopBadge.textContent = label;
  elements.desktopBadge.title = status === "connected"
    ? `Đã kết nối ${desktop.url || "ws://localhost:8765"}`
    : `Chưa kết nối ${desktop.url || "ws://localhost:8765"}; extension sẽ tự thử lại.`;
}

function renderState(state) {
  if (!state) return;
  const previousStatus = currentState?.status;
  currentState = state;

  const isRunning = RUNNING_STATUSES.has(state.status);
  const total = Number(state.total) || 0;
  const completed = Math.min(Number(state.currentIndex) || 0, total);
  const shownIndex = isRunning && total > 0 ? Math.min(completed + 1, total) : completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  elements.statusBadge.textContent = STATUS_LABELS[state.status] || state.status || "Sẵn sàng";
  elements.statusBadge.dataset.status = isRunning ? (state.status === "waiting" ? "waiting" : "running") : state.status;
  elements.statusBadge.title = state.status === "error" ? state.lastError || "Tác vụ gặp lỗi" : "";
  elements.progressNumbers.textContent = `${shownIndex} / ${total}`;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressText.textContent = progressLabel(state);
  elements.currentPrompt.textContent = state.status === "error"
    ? fallbackPromptMessage(state.status)
    : state.currentPrompt || fallbackPromptMessage(state.status);
  elements.currentPrompt.title = state.status === "error" ? state.lastError || "" : state.currentPrompt || "";

  elements.startButton.disabled = isRunning || !STARTABLE_TARGET_STATUSES.has(currentTarget.status) || preparingStart;
  elements.stopButton.disabled = !isRunning;
  elements.prompts.disabled = isRunning;
  elements.minDelay.disabled = isRunning;
  elements.maxDelay.disabled = isRunning;
  document.querySelectorAll("[data-run-control]").forEach((control) => {
    control.disabled = isRunning;
  });
  if (!isRunning) applyWorkflowControlAvailability();
  elements.startButtonLabel.textContent = preparingStart
    ? currentTarget.status === "project_creating" ? "Đang tạo dự án…" : "Đang chuẩn bị tệp…"
    : currentTarget.status === "flow_project_list" ? "Tạo dự án & bắt đầu" : "Bắt đầu";

  if (state.status === "error" && previousStatus !== "error") {
    // Don't auto-switch tabs — show error in mini-log instead
    const mini = elements.fmMiniLogList;
    if (mini) mini.scrollTop = mini.scrollHeight;
  }

  // Keep filmmaker tab progress in sync
  if (typeof window.__fmApplyState === "function") window.__fmApplyState(state);
}

function renderTargetStatus(target) {
  if (!target) return;
  currentTarget = target;
  elements.targetCard.dataset.status = target.status || "checking";

  // flowGate chỉ hiện khi đang ở tab điều khiển Google Flow
  // Tab chatgpt có gate riêng — không dùng flowGate
  if (activePanel === "chatgpt") {
    elements.flowGate.hidden = true;
    return;
  }

  elements.flowGate.hidden = target.status === "ready";
  elements.openFlowButton.hidden = false;
  elements.openFlowButton.disabled = false;

  switch (target.status) {
    case "ready":
      elements.targetIcon.textContent = "✓";
      elements.targetTitle.textContent = "Google Flow đã sẵn sàng";
      elements.targetDescription.textContent = "Đã tìm thấy ô prompt trong tab hiện tại.";
      elements.openFlowButton.hidden = true;
      break;

    case "flow_no_editor":
      elements.targetIcon.textContent = "!";
      elements.targetTitle.textContent = "Chưa ở trình tạo Flow";
      elements.targetDescription.textContent = "Hãy mở một dự án có ô prompt để AutoFlow có thể gửi yêu cầu.";
      elements.openFlowButton.textContent = "↻ Kiểm tra lại";
      break;

    case "flow_project_list":
      elements.targetIcon.textContent = "+";
      elements.targetTitle.textContent = "Chưa mở dự án Flow";
      elements.targetDescription.textContent = "Bạn đang ở danh sách dự án. Hãy tạo dự án mới để bắt đầu tự động hóa.";
      elements.openFlowButton.textContent = "+ Tạo dự án mới";
      break;

    case "project_creating":
      elements.targetIcon.textContent = "…";
      elements.targetTitle.textContent = "Đang tạo dự án Google Flow";
      elements.targetDescription.textContent = "Đang chờ trình chỉnh sửa và ô prompt tải xong.";
      elements.openFlowButton.textContent = "Đang tạo…";
      elements.openFlowButton.disabled = true;
      break;

    case "opening":
    case "flow_loading":
      elements.targetIcon.textContent = "…";
      elements.targetTitle.textContent = "Đang kết nối Google Flow";
      elements.targetDescription.textContent = "Chờ trang tải xong và xác nhận trình chỉnh sửa dự án.";
      elements.openFlowButton.textContent = "Đang kiểm tra…";
      elements.openFlowButton.disabled = true;
      break;

    case "not_flow":
      elements.targetIcon.textContent = "!";
      elements.targetTitle.textContent = "Không ở trang dự án Flow";
      elements.targetDescription.textContent = "Công cụ Flow Automation chỉ hoạt động khi bạn đang ở trang dự án Flow.";
      elements.openFlowButton.textContent = "↗ Đi tới Flow";
      break;

    default:
      elements.targetIcon.textContent = "…";
      elements.targetTitle.textContent = "Đang kiểm tra Google Flow";
      elements.targetDescription.textContent = "Đang kiểm tra tab hiện tại và ô nhập prompt.";
      elements.openFlowButton.textContent = "Đang kiểm tra…";
      elements.openFlowButton.disabled = true;
      break;
  }

  if (currentState) renderState(currentState);
  else elements.startButton.disabled = !STARTABLE_TARGET_STATUSES.has(target.status) || preparingStart;
}

function progressLabel(state) {
  switch (state.status) {
    case "preparing":
      return "Đang mở và chuẩn bị Google Flow";
    case "dispatching":
      return "Đang gửi prompt vào Flow";
    case "generating":
      return "Google Flow đang xử lý";
    case "downloading":
      return "Đang tải kết quả";
    case "waiting": {
      const remaining = Math.max(0, Math.ceil(((state.nextRunAt || Date.now()) - Date.now()) / 1000));
      return `Chờ ${remaining} giây trước prompt tiếp theo`;
    }
    case "completed":
      return "Đã xử lý toàn bộ hàng đợi";
    case "stopped":
      return "Tác vụ đã được dừng";
    case "error":
      return "Tác vụ dừng do lỗi";
    default:
      return "Chưa có tác vụ";
  }
}

function fallbackPromptMessage(status) {
  if (status === "completed") return "Tất cả kết quả đã được tải xuống.";
  if (status === "stopped") return "Bạn có thể chỉnh danh sách và chạy lại.";
  if (status === "error") return currentState?.lastError || "Hãy xem nhật ký để biết chi tiết.";
  if (currentTarget.status === "flow_project_list") return "Bấm Tạo dự án & bắt đầu; extension sẽ tự mở trình chỉnh sửa.";
  if (currentTarget.status === "project_creating") return "Đang chờ dự án mới sẵn sàng…";
  return "Mở Google Flow rồi bấm Bắt đầu.";
}

function renderLogs(logs) {
  elements.logList.replaceChildren();

  if (!logs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-log";
    empty.textContent = "Chưa có nhật ký.";
    elements.logList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  logs.forEach((entry) => fragment.append(createLogElement(entry)));
  elements.logList.append(fragment);
  elements.logList.scrollTop = elements.logList.scrollHeight;
}

function appendLog(entry) {
  if (!entry) return;

  // --- Main log panel (Nhật ký tab) ---
  const empty = elements.logList.querySelector(".empty-log");
  empty?.remove();

  const nearBottom = elements.logList.scrollHeight - elements.logList.scrollTop - elements.logList.clientHeight < 36;
  elements.logList.append(createLogElement(entry));

  while (elements.logList.childElementCount > 200) {
    elements.logList.firstElementChild?.remove();
  }

  if (nearBottom) elements.logList.scrollTop = elements.logList.scrollHeight;

  // --- Mini-log mirror (Làm phim tab) ---
  const mini = elements.fmMiniLogList;
  if (mini) {
    mini.querySelector(".empty-log")?.remove();
    mini.append(createLogElement(entry));
    // Keep only last 20 entries
    while (mini.childElementCount > 20) mini.firstElementChild?.remove();
    mini.scrollTop = mini.scrollHeight;
  }
}


function createLogElement(entry) {
  const row = document.createElement("div");
  row.className = "log-entry";
  row.dataset.level = entry.level || "info";

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = formatTime(entry.time);

  const dot = document.createElement("span");
  dot.className = "log-dot";
  dot.setAttribute("aria-hidden", "true");

  const message = document.createElement("span");
  message.className = "log-message";
  message.textContent = entry.message || "";

  row.append(time, dot, message);
  return row;
}

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function showLocalError(message) {
  appendLog({ time: new Date().toISOString(), level: "error", message });
  activatePanel("logs", { save: false });
}

function activatePanel(panelName, { save = true } = {}) {
  const FLOW_PANELS = new Set(["control", "settings", "logs"]);
  const targetExists = elements.panelViews.some((view) => view.dataset.panelView === panelName);
  activePanel = targetExists ? panelName : "control";

  // Ghi nhớ sub-tab Flow cuối cùng
  if (FLOW_PANELS.has(activePanel)) lastFlowPanel = activePanel;

  // ── Cập nhật main-tab (tầng 1) ─────────────────────────────────
  const isFlowPanel = FLOW_PANELS.has(activePanel);
  elements.mainTabButtons.forEach((btn) => {
    const selected = btn.dataset.mainGroup === (isFlowPanel ? "flow" : "chatgpt");
    btn.classList.toggle("is-active", selected);
    btn.setAttribute("aria-selected", String(selected));
  });

  // ── Hiện / ẩn sub-tabs Flow (tầng 2) ──────────────────────────
  if (elements.flowSubTabs) elements.flowSubTabs.hidden = !isFlowPanel;

  // ── Cập nhật panel sub-tab active ────────────────────────────
  elements.panelTabButtons.forEach((button) => {
    const selected = button.dataset.panelTarget === activePanel;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  elements.panelViews.forEach((view) => {
    view.hidden = view.dataset.panelView !== activePanel;
  });

  // ── Gate logic ───────────────────────────────────────────────
  if (activePanel === "chatgpt") {
    elements.flowGate.hidden = true;
    void renderChatGPTGate();
  } else {
    // Khi rời tab ChatGPT: ẩn chatgpt gate, restore flow gate
    const cgptGate = document.getElementById("chatgptGate");
    if (cgptGate) cgptGate.hidden = true;
    // Re-evaluate flow gate
    renderTargetStatus(currentTarget);
  }

  if (save) scheduleSettingsSave();
}

function syncWorkflowTabs() {
  elements.workflowTabButtons.forEach((button) => {
    const selected = button.dataset.workflowMode === elements.workflowMode.value;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
}

function updateWorkflowUi({ preserveModel = true } = {}) {
  const definition = WORKFLOW_DEFINITIONS[elements.workflowMode.value] || WORKFLOW_DEFINITIONS.text_to_video;
  const previousModel = preserveModel ? elements.modelSelect.value : "auto";
  const modelOptions = MODEL_OPTIONS[definition.modelGroup] || MODEL_OPTIONS.video;

  elements.workflowHelp.textContent = definition.help;
  syncWorkflowTabs();
  elements.modelSelect.replaceChildren();
  modelOptions.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    elements.modelSelect.append(option);
  });
  elements.modelSelect.value = modelOptions.some(([value]) => value === previousModel) ? previousModel : modelOptions[0][0];

  const groupNames = [
    "startFrameGroup",
    "endFrameGroup",
    "referenceFilesGroup",
    "sourceImagesGroup",
    "sourceVideoGroup",
    "agentAssetsGroup"
  ];
  groupNames.forEach((name) => {
    elements[name].hidden = !definition.assetGroups.includes(name);
  });
  elements.assetFields.hidden = definition.assetGroups.length === 0;

  applyWorkflowControlAvailability();
  updatePromptPlaceholder();
}

function applyWorkflowControlAvailability() {
  const mode = elements.workflowMode.value;
  const isImageMode = mode === "text_to_image" || mode === "image_edit";
  const isAgent = mode === "agent";
  elements.durationSelect.disabled = isImageMode || isAgent;
}

function updatePromptPlaceholder() {
  const placeholders = {
    text_to_video: "Cảnh điện ảnh về một thành phố nổi trên mây...",
    text_to_image: "Ảnh chân dung điện ảnh với ánh sáng hoàng hôn...",
    frames_to_video: "Máy quay tiến chậm, chủ thể chuyển động tự nhiên...",
    ingredients_to_video: "Dùng các thành phần tham chiếu trong một cảnh đường phố về đêm...",
    image_edit: "Đổi ánh sáng thành hoàng hôn điện ảnh...",
    video_edit: "Thêm sương mù nhẹ và thay ánh sáng thành màu xanh điện ảnh...",
    extend_video: "Tiếp tục chuyển động máy quay và hành động của nhân vật...",
    agent: "Tạo 4 biến thể video với phong cách và ánh sáng khác nhau..."
  };
  elements.prompts.placeholder = `${placeholders[elements.workflowMode.value]}\nMỗi dòng là một tác vụ riêng.`;
}

function workflowPayload() {
  return {
    mode: elements.workflowMode.value,
    model: elements.modelSelect.value,
    aspectRatio: elements.aspectRatio.value,
    duration: elements.durationSelect.value,
    outputCount: Number(elements.outputCount.value)
  };
}

async function _collectWorkflowAssetsBase(mode) {
  const selected = [];
  const addFiles = (input, role, required = false) => {
    const files = Array.from(input.files || []);
    if (required && files.length === 0) {
      throw new Error(`Thiếu tệp bắt buộc: ${input.closest(".asset-group")?.querySelector("label")?.textContent?.trim() || role}.`);
    }
    files.forEach((file) => selected.push({ file, role }));
  };

  if (mode === "frames_to_video") {
    addFiles(elements.startFrameInput, "start_frame", true);
    addFiles(elements.endFrameInput, "end_frame");
  } else if (mode === "ingredients_to_video") {
    addFiles(elements.referenceFiles, "ingredient", true);
  } else if (mode === "image_edit") {
    addFiles(elements.sourceImages, "source_image", true);
  } else if (mode === "video_edit") {
    addFiles(elements.sourceVideo, "source_video", true);
  } else if (mode === "agent") {
    addFiles(elements.agentAssets, "agent_reference");
  }

  const totalBytes = selected.reduce((sum, item) => sum + item.file.size, 0);
  if (totalBytes > MAX_ASSET_BYTES) {
    throw new Error(`Tổng tệp là ${(totalBytes / 1024 / 1024).toFixed(1)} MB, vượt giới hạn tự động 24 MB. Hãy tải tệp lớn trực tiếp lên Flow.`);
  }

  return Promise.all(selected.map(async ({ file, role }) => ({
    role,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    dataUrl: await readFileAsDataUrl(file)
  })));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Không đọc được tệp ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function restoreUiSettings() {
  const { autoFlowUiSettings } = await chrome.storage.local.get("autoFlowUiSettings");
  if (autoFlowUiSettings) {
    elements.prompts.value = autoFlowUiSettings.promptText || "";
    elements.minDelay.value = autoFlowUiSettings.minDelaySeconds ?? "20";
    elements.maxDelay.value = autoFlowUiSettings.maxDelaySeconds ?? "30";
    elements.workflowMode.value = autoFlowUiSettings.workflowMode || "text_to_video";
    updateWorkflowUi({ preserveModel: false });
    elements.modelSelect.value = autoFlowUiSettings.model || "auto";
    elements.aspectRatio.value = autoFlowUiSettings.aspectRatio || "auto";
    elements.durationSelect.value = autoFlowUiSettings.duration || "auto";
    elements.outputCount.value = String(autoFlowUiSettings.outputCount || "2");
    activatePanel(autoFlowUiSettings.activePanel || "control", { save: false });
  } else {
    updateWorkflowUi({ preserveModel: false });
    activatePanel("control", { save: false });
  }
  updatePromptCount();
}

elements.prompts.addEventListener("input", () => {
  updatePromptCount();
  scheduleSettingsSave();
});
elements.minDelay.addEventListener("input", scheduleSettingsSave);
elements.maxDelay.addEventListener("input", scheduleSettingsSave);
elements.workflowMode.addEventListener("change", () => {
  updateWorkflowUi({ preserveModel: false });
  scheduleSettingsSave();
});
elements.workflowTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled || button.dataset.workflowMode === elements.workflowMode.value) return;
    elements.workflowMode.value = button.dataset.workflowMode;
    elements.workflowMode.dispatchEvent(new Event("change", { bubbles: true }));
  });
});
elements.panelTabButtons.forEach((button) => {
  button.addEventListener("click", () => activatePanel(button.dataset.panelTarget));
});
// Main tab (Flow / Auto ChatGPT)
elements.mainTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.mainGroup === "chatgpt") {
      activatePanel("chatgpt");
    } else {
      // Quay về sub-tab Flow cuối cùng (hoặc Điều khiển mặc định)
      activatePanel(lastFlowPanel || "control");
    }
  });
});
[elements.modelSelect, elements.aspectRatio, elements.durationSelect, elements.outputCount].forEach((control) => {
  control.addEventListener("change", scheduleSettingsSave);
});

elements.startButton.addEventListener("click", async () => {
  const prompts = parsePrompts();
  const minDelaySeconds = Number(elements.minDelay.value);
  const maxDelaySeconds = Number(elements.maxDelay.value);

  if (!prompts.length) {
    showLocalError("Hãy nhập ít nhất một prompt.");
    elements.prompts.focus();
    return;
  }

  if (!Number.isFinite(minDelaySeconds) || !Number.isFinite(maxDelaySeconds) || minDelaySeconds < 0) {
    showLocalError("Thời gian chờ phải là số không âm.");
    return;
  }

  if (maxDelaySeconds < minDelaySeconds) {
    showLocalError("Thời gian lớn nhất phải bằng hoặc lớn hơn thời gian nhỏ nhất.");
    return;
  }

  try {
    preparingStart = true;
    elements.startButton.disabled = true;
    elements.startButtonLabel.textContent = "Đang chuẩn bị tệp…";
    const workflow = workflowPayload();
    const assets = await collectWorkflowAssets(workflow.mode);

    scheduleSettingsSave();
    if (!postToBackground({
      type: "START",
      payload: { prompts, minDelaySeconds, maxDelaySeconds, workflow, assets }
    })) {
      preparingStart = false;
      if (currentState) renderState(currentState);
    }
  } catch (error) {
    preparingStart = false;
    if (currentState) renderState(currentState);
    showLocalError(error instanceof Error ? error.message : String(error));
  }
});

elements.stopButton.addEventListener("click", () => {
  if (postToBackground({ type: "STOP" })) {
    elements.stopButton.disabled = true;
  }
});

elements.resetButton.addEventListener("click", () => {
  postToBackground({ type: "FORCE_RESET" });
});

elements.clearLogsButton.addEventListener("click", () => {
  postToBackground({ type: "CLEAR_LOGS" });
});

elements.fmClearMiniLog?.addEventListener("click", () => {
  const mini = elements.fmMiniLogList;
  if (mini) { mini.replaceChildren(); mini.innerHTML = '<p class="empty-log" style="font-size:10px;">Chưa có nhật ký.</p>'; }
  postToBackground({ type: "CLEAR_LOGS" });
});


elements.openFlowButton.addEventListener("click", () => {
  if (currentTarget.status === "not_flow") {
    renderTargetStatus({ status: "opening" });
    postToBackground({ type: "OPEN_FLOW" });
  } else if (currentTarget.status === "flow_project_list") {
    renderTargetStatus({ status: "project_creating", tabId: currentTarget.tabId, url: currentTarget.url });
    postToBackground({ type: "CREATE_FLOW_PROJECT" });
  } else {
    elements.openFlowButton.disabled = true;
    elements.openFlowButton.textContent = "Đang kiểm tra…";
    postToBackground({ type: "CHECK_TARGET" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// FILMMAKER TAB — logic
// ══════════════════════════════════════════════════════════════════════════════
(function initFilmmakerTab() {
  // ── State ─────────────────────────────────────────────────────────────────
  const fm = {
    workflowMode: "image_edit",
    characters: [{ id: crypto.randomUUID(), name: "", files: [] }]
  };

  // ── Populate Model Select ─────────────────────────────────────────────────
  function fmPopulateModels() {
    const def = WORKFLOW_DEFINITIONS[fm.workflowMode];
    const group = def?.modelGroup || "image";
    const opts = MODEL_OPTIONS[group] || MODEL_OPTIONS.image;
    const sel = document.getElementById("fmModelSelect");
    if (!sel) return;
    sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  }

  // ── Workflow tabs ──────────────────────────────────────────────────────────
  document.querySelectorAll("[data-fm-workflow]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-fm-workflow]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      fm.workflowMode = btn.dataset.fmWorkflow;
      fmPopulateModels();
    });
  });
  fmPopulateModels();

  // ── Prompt counter ─────────────────────────────────────────────────────────
  const fmPromptsEl = document.getElementById("fmPrompts");
  const fmPromptCountEl = document.getElementById("fmPromptCount");
  function fmUpdateCount() {
    const n = (fmPromptsEl?.value || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean).length;
    if (fmPromptCountEl) fmPromptCountEl.textContent = `${n} prompt`;
  }
  fmPromptsEl?.addEventListener("input", fmUpdateCount);
  fmUpdateCount();

  // ── Drop Zones (file pick + Flow pick + Paste + Drag-drop) ───────────────
  // Default placeholder HTML for a zone
  function zoneDefaultHTML(icon, label) {
    return `
      <span class="material-symbols-outlined" style="font-size:22px;opacity:0.5;">${icon}</span>
      <span style="font-size:10px;opacity:0.6;">${label}</span>
      <span style="font-size:9px;opacity:0.35;margin-top:2px;">Click • Dán ảnh (Ctrl+V)</span>`;
  }

  // Shared: apply clipboard image to a showImage callback
  function applyClipboardImage(e, showImageFn) {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return false;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (!blob) continue;
        const name = `pasted_${Date.now()}.${item.type.split("/")[1] || "png"}`;
        const file = new File([blob], name, { type: item.type });
        showImageFn(URL.createObjectURL(file), name, file);
        return true;
      }
    }
    return false;
  }

  function setupDropZone(zoneId, inputId, flowBtnId, icon = "add_photo_alternate", label = "Chọn ảnh") {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    zone.style.position = "relative";
    zone.style.overflow = "hidden";
    zone.setAttribute("tabindex", "0"); // focusable for paste

    const defaultHTML = zoneDefaultHTML(icon, label);

    // Internal file state (includes pasted files)
    let _currentFile = null;
    let _flowUrl = null;

    function showImage(url, name, fileObj) {
      _currentFile = fileObj || null;
      _flowUrl = null;
      flowPickerState.nativeItemNames.delete(inputId);
      zone.innerHTML = `
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:block;" />
        <button type="button" title="Xóa, chọn lại"
          style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;
                 background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.3);
                 color:#fff;font-size:11px;line-height:1;cursor:pointer;
                 display:flex;align-items:center;justify-content:center;z-index:10;"
          class="fm-zone-clear-btn">✕</button>`;
      zone.title = name || "";
      zone.querySelector(".fm-zone-clear-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        input.value = "";
        _currentFile = null;
        _flowUrl = null;
        flowPickerState.flowAssets.delete(inputId);
        flowPickerState.nativeItemNames.delete(inputId);
        zone.innerHTML = defaultHTML;
        zone.title = "";
      });
      zone.querySelector("img").addEventListener("click", (e) => e.stopPropagation());
    }

    function showNativeAsset(name) {
      _currentFile = null;
      _flowUrl = null;
      input.value = "";
      flowPickerState.flowAssets.delete(inputId);
      flowPickerState.nativeItemNames.set(inputId, [name]);

      const iconEl = document.createElement("span");
      iconEl.className = "material-symbols-outlined";
      iconEl.style.fontSize = "22px";
      iconEl.textContent = "photo_library";

      const labelEl = document.createElement("span");
      labelEl.style.cssText = "font-size:10px;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      labelEl.textContent = name;

      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "fm-zone-clear-btn";
      clearButton.title = "Xóa, chọn lại";
      clearButton.textContent = "✕";
      clearButton.style.cssText = "position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.3);color:#fff;font-size:11px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;";
      clearButton.addEventListener("click", (event) => {
        event.stopPropagation();
        flowPickerState.nativeItemNames.delete(inputId);
        zone.innerHTML = defaultHTML;
        zone.title = "";
      });

      zone.replaceChildren(iconEl, labelEl, clearButton);
      zone.title = name;
    }

    // Expose getters so fmCollectReferenceAssets can read pasted files / flow url
    zone._getFile = () => _currentFile || input.files?.[0] || null;
    zone._getFlowUrl = () => _flowUrl || null;

    // Click empty zone → open file picker
    zone.addEventListener("click", () => {
      if (!zone.querySelector("img")) input.click();
    });

    // File input change
    input.addEventListener("change", () => {
      const f = input.files[0];
      if (!f) return;
      showImage(URL.createObjectURL(f), f.name, f);
    });

    // ── Ctrl+V paste ─────────────────────────────────────────────
    zone.addEventListener("paste", (e) => {
      e.preventDefault();
      applyClipboardImage(e, showImage);
    });
    // Also listen on document when this zone is focused
    zone.addEventListener("focus", () => {
      zone.style.outline = "2px solid var(--accent)";
    });
    zone.addEventListener("blur", () => {
      zone.style.outline = "";
    });
    // Global paste when zone was last-focused
    zone.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        navigator.clipboard.read().then(items => {
          for (const item of items) {
            const imgType = item.types.find(t => t.startsWith("image/"));
            if (!imgType) continue;
            item.getType(imgType).then(blob => {
              const name = `pasted_${Date.now()}.${imgType.split("/")[1] || "png"}`;
              const file = new File([blob], name, { type: imgType });
              showImage(URL.createObjectURL(file), name, file);
            });
            break;
          }
        }).catch(() => { /* user denied clipboard */ });
      }
    });

    // ── Drag & Drop ──────────────────────────────────────────────
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.style.borderColor = "var(--accent)";
    });
    zone.addEventListener("dragleave", () => {
      zone.style.borderColor = "";
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.style.borderColor = "";
      const file = e.dataTransfer?.files?.[0];
      if (file?.type.startsWith("image/")) {
        showImage(URL.createObjectURL(file), file.name, file);
      }
    });

    // Flow picker button
    const flowBtn = document.getElementById(flowBtnId);
    if (flowBtn) {
      flowBtn.addEventListener("click", () => {
        openFlowPicker(inputId, false, "image", (files, flowUrls, flowItemNames) => {
          const nativeName = flowItemNames?.[0] || null;
          if (nativeName) {
            showNativeAsset(nativeName);
            return;
          }
          if (files[0]) {
            showImage(URL.createObjectURL(files[0]), files[0].name, files[0]);
            _flowUrl = flowUrls?.[0] || null;
          }
        });
      });
    }

    // Support Flow picker setting a preview via flowAssets (legacy path)
    const _origSet = flowPickerState.flowAssets.set.bind(flowPickerState.flowAssets);
    flowPickerState.flowAssets.set = function(key, value) {
      _origSet(key, value);
      if (key === inputId && value?.[0]) {
        showImage(URL.createObjectURL(value[0]), value[0].name, value[0]);
      }
      return flowPickerState.flowAssets;
    };
  }


  setupDropZone("fmStyleZone",   "fmStyleFiles",   "fmPickStyle",   "palette",      "Style");
  setupDropZone("fmProductZone", "fmProductFiles", "fmPickProduct", "shopping_bag", "Product");
  setupDropZone("fmEnvZone",     "fmEnvFiles",     "fmPickEnv",     "landscape",    "Bối cảnh");


  // Toggle reference sections
  document.getElementById("fmUseStyle")?.addEventListener("change", e => {
    document.getElementById("fmStyleGroup").style.opacity = e.target.checked ? "1" : "0.35";
  });
  document.getElementById("fmUseEnv")?.addEventListener("change", e => {
    document.getElementById("fmEnvGroup").style.opacity = e.target.checked ? "1" : "0.35";
  });

  // ── Character management ──────────────────────────────────────────────────
  function fmRenderChars() {
    const list = document.getElementById("fmCharList");
    if (!list) return;
    list.innerHTML = "";
    fm.characters.forEach(char => {
      const row = document.createElement("div");
      row.style.cssText = "display:grid;grid-template-columns:48px 1fr auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);";

      // Thumb
      const thumb = document.createElement("div");
      thumb.style.cssText = "width:48px;height:48px;border-radius:8px;border:1.5px dashed rgba(100,180,255,0.3);background:rgba(100,180,255,0.04);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;flex-shrink:0;";
      if (char.previewUrl || char.files[0]) {
        const img = document.createElement("img");
        img.src = char.previewUrl || URL.createObjectURL(char.files[0]);
        img.style.cssText = "width:100%;height:100%;object-fit:cover;";
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;color:rgba(100,180,255,0.4);">person</span>`;
      }
      const fileInput = document.createElement("input");
      fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.hidden = true;
      fileInput.addEventListener("change", () => {
        char.files = fileInput.files ? [fileInput.files[0]] : [];
        fmRenderChars();
      });
      thumb.addEventListener("click", () => {
        // Open Flow picker with a callback to set char.files AND char.flowItemName, then re-render
        openFlowPicker(`_char_${char.id}`, false, "image", (files, flowUrls, flowItemNames) => {
          char.files = files;
          char.flowUrl = flowUrls?.[0] || null;
          char.flowItemName = flowItemNames?.[0] || null;  // key for native picker automation
          char.previewUrl = files[0] ? URL.createObjectURL(files[0]) : null;
          fmRenderChars();
        });
      });

      // Name input
      const nameInput = document.createElement("input");
      nameInput.type = "text"; nameInput.value = char.name;
      nameInput.placeholder = "Tên nhân vật (dùng trong prompt)";
      nameInput.style.cssText = "flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;font-size:11px;color:inherit;outline:none;width:100%;";
      nameInput.addEventListener("input", () => { char.name = nameInput.value; });

      // Remove btn
      const removeBtn = document.createElement("button");
      removeBtn.className = "text-button danger-text"; removeBtn.type = "button"; removeBtn.textContent = "✕";
      removeBtn.style.fontSize = "12px";
      removeBtn.addEventListener("click", () => {
        fm.characters = fm.characters.filter(c => c.id !== char.id);
        if (!fm.characters.length) fm.characters = [{ id: crypto.randomUUID(), name: "", files: [] }];
        fmRenderChars();
      });

      row.append(thumb, nameInput, removeBtn);
      list.append(row, fileInput);
    });
  }

  document.getElementById("fmAddChar")?.addEventListener("click", () => {
    fm.characters.push({ id: crypto.randomUUID(), name: "", files: [] });
    fmRenderChars();
  });
  fmRenderChars();

  // ── Build enriched prompts ────────────────────────────────────────────────
  function fmBuildPrompts() {
    const raw = (fmPromptsEl?.value || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const useStyle = document.getElementById("fmUseStyle")?.checked;
    const useEnv = document.getElementById("fmUseEnv")?.checked;
    const styleText = document.getElementById("fmStylePrompt")?.value?.trim();
    const envText = document.getElementById("fmEnvPrompt")?.value?.trim();

    return raw.map(line => {
      let parts = [];
      if (useStyle && styleText) parts.push(styleText);
      if (useEnv && envText) parts.push(`Background/Environment: ${envText}`);
      parts.push(line);
      return parts.join(". ");
    });
  }

  // ── Collect reference assets for ingredients_to_video ────────────────────
  async function fmCollectReferenceAssets() {
    const assets = [];

    // Read asset from zone — checks (in order):
    // 1. flowItemName from Flow's native + picker (most reliable)
    // 2. flowUrl from downloaded picker image
    // 3. File from file picker / paste / drag
    const addAsset = async (zoneId, inputId, role) => {
      const zone = document.getElementById(zoneId);

      // Priority 1: flowItemName (from Flow's native + picker via SCRAPE_FLOW_PICKER)
      const nativeNames = flowPickerState.nativeItemNames?.get(inputId) || [];
      if (nativeNames.length > 0) {
        nativeNames.forEach(name => {
          assets.push({ role, source: "flow-library", flowItemName: name, name });
        });
        return;
      }

      // Priority 2: flowUrl stored from downloaded picker image
      const flowUrl = zone?._getFlowUrl?.();
      if (flowUrl) {
        assets.push({ role, source: "flow-library", flowUrl, name: flowUrl.split("/").pop().split("?")[0] || "asset" });
        return;
      }

      // Priority 3: File (from file picker / paste / drag)
      const file = zone?._getFile?.()
        || document.getElementById(inputId)?.files?.[0]
        || flowPickerState.flowAssets.get(inputId)?.[0]
        || null;
      if (!file) return;
      assets.push({ role, name: file.name, type: file.type || "image/jpeg",
        size: file.size, dataUrl: await readFileAsDataUrl(file) });
    };

    const useStyle = document.getElementById("fmUseStyle")?.checked;
    const useEnv = document.getElementById("fmUseEnv")?.checked;

    if (useStyle) {
      await addAsset("fmStyleZone",   "fmStyleFiles",   "ingredient");
      await addAsset("fmProductZone", "fmProductFiles", "ingredient");
    }
    if (useEnv) await addAsset("fmEnvZone", "fmEnvFiles", "ingredient");

    // Character files / flowItemNames / flowUrls
    for (const char of fm.characters) {
      if (char.flowItemName) {
        // Native picker: reference by name (most reliable)
        assets.push({ role: "ingredient", source: "flow-library", flowItemName: char.flowItemName, name: char.name || char.flowItemName });
      } else if (char.flowUrl) {
        assets.push({ role: "ingredient", source: "flow-library", flowUrl: char.flowUrl, name: char.name || "character" });
      } else if (char.files[0]) {
        const f = char.files[0];
        assets.push({ role: "ingredient", name: f.name, type: f.type || "image/jpeg",
          size: f.size, dataUrl: await readFileAsDataUrl(f) });
      }
    }
    return assets;
  }


  // ── renderState mirror for filmmaker progress ─────────────────────────────
  function fmApplyState(state) {
    if (!state) return;
    const isRunning = RUNNING_STATUSES.has(state.status);
    const startBtn = document.getElementById("fmStartButton");
    const stopBtn = document.getElementById("fmStopButton");
    const startLbl = document.getElementById("fmStartLabel");
    if (startBtn) startBtn.disabled = isRunning || preparingStart;
    if (stopBtn) stopBtn.disabled = !isRunning;
    if (startLbl) startLbl.textContent = preparingStart ? "Đang chuẩn bị…" : "Bắt đầu làm phim";

    const pText = document.getElementById("fmProgressText");
    const pNums = document.getElementById("fmProgressNumbers");
    const pBar = document.getElementById("fmProgressBar");
    const pPrompt = document.getElementById("fmCurrentPrompt");
    if (pText) pText.textContent = STATUS_LABELS[state.status] || state.status;
    const completed = Math.min(Number(state.currentIndex) || 0, Number(state.total) || 0);
    if (pNums && state.total != null) pNums.textContent = `${completed} / ${state.total}`;
    if (pBar && state.total) pBar.style.width = `${Math.round((completed / state.total) * 100)}%`;
    if (pPrompt && state.currentPrompt) pPrompt.textContent = state.currentPrompt;
  }

  // Expose so the main renderState can call it
  window.__fmApplyState = fmApplyState;

  // ── Start ─────────────────────────────────────────────────────────────────
  document.getElementById("fmStartButton")?.addEventListener("click", async () => {
    const prompts = fmBuildPrompts();
    if (!prompts.length) { showLocalError("Hãy nhập ít nhất một prompt trong tab Làm phim."); return; }

    const minDelay = Number(document.getElementById("fmMinDelay")?.value ?? 20);
    const maxDelay = Number(document.getElementById("fmMaxDelay")?.value ?? 30);

    try {
      preparingStart = true;
      const startBtn = document.getElementById("fmStartButton");
      if (startBtn) { startBtn.disabled = true; document.getElementById("fmStartLabel").textContent = "Đang chuẩn bị…"; }

      // Determine mode and gather assets
      let mode = fm.workflowMode;
      let assets = await fmCollectReferenceAssets();
      
      const wantsVideo = ["text_to_video", "frames_to_video", "video_edit", "extend_video"].includes(mode);

      if (assets.length > 0) {
        if (wantsVideo) {
          if (assets.length === 1) {
            // Video model doesn't support ingredients, but supports a Start Frame
            assets[0].role = "start_frame";
            mode = "frames_to_video";
          } else {
            throw new Error("Mô hình Video của Google Flow (Veo) không hỗ trợ ghép nhiều ảnh tham chiếu cùng lúc.\n\nVui lòng chuyển chế độ (phía trên) sang 'Hình ảnh' để tạo ảnh nhân vật tĩnh trước, HOẶC chỉ dùng duy nhất 1 ảnh để làm Khung hình bắt đầu (Start Frame) cho video.");
          }
        }
        // If image mode, assets stay as 'ingredient' (supported by Imagen)
      }

      const workflow = {
        mode,
        model: document.getElementById("fmModelSelect")?.value || "auto",
        aspectRatio: document.getElementById("fmAspectRatio")?.value || "auto",
        duration: document.getElementById("fmDuration")?.value || "auto",
        outputCount: Number(document.getElementById("fmOutputCount")?.value || 2)
      };

      postToBackground({ type: "START", payload: { prompts, minDelaySeconds: minDelay, maxDelaySeconds: maxDelay, workflow, assets } });
    } catch (err) {
      showLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      preparingStart = false;
    }
  });

  document.getElementById("fmStopButton")?.addEventListener("click", () => {
    if (postToBackground({ type: "STOP" })) document.getElementById("fmStopButton").disabled = true;
  });

  document.getElementById("fmResetButton")?.addEventListener("click", () => {
    postToBackground({ type: "FORCE_RESET" });
  });

})();

// Cập nhật bộ đếm trên UI mỗi giây mà không gửi message thừa tới service worker.
setInterval(() => {
  if (currentState?.status === "waiting") {
    renderState(currentState);
  }
}, 1000);

// Chrome 114+ chỉ gia hạn vòng đời worker khi Port thực sự truyền message.
setInterval(() => {
  if (!backgroundPort) return;
  try {
    backgroundPort.postMessage({ type: "KEEP_ALIVE" });
  } catch {
    // onDisconnect sẽ chịu trách nhiệm kết nối lại.
  }
}, 15_000);

// Khi người dùng đang ở landing page hoặc vừa mở project, tự kiểm tra lại nhẹ nhàng.
setInterval(() => {
  if (["checking", "opening", "flow_loading", "flow_no_editor", "flow_project_list", "project_creating"].includes(currentTarget.status)) {
    postToBackground({ type: "CHECK_TARGET" });
  }
}, 3000);

updatePromptCount();
if (globalThis.chrome?.runtime?.id) {
  void restoreUiSettings();
  connectToBackground();
} else {
  // Chỉ dùng khi mở sidepanel.html trực tiếp để kiểm tra giao diện tĩnh.
  updateWorkflowUi({ preserveModel: false });
  activatePanel("control", { save: false });
  const previewStatus = new URLSearchParams(location.search).get("preview") === "ready" ? "ready" : "not_flow";
  renderTargetStatus({ status: previewStatus });
}

// ══════════════════════════════════════════════════════════════════════════════
// FLOW PICKER — chọn ảnh/video từ trang Flow
// ══════════════════════════════════════════════════════════════════════════════

/** Mở picker cho một asset group cụ thể */
function openFlowPicker(targetInputId, multiple, kindFilter, onConfirm) {
  flowPickerState.targetInputId = targetInputId;
  flowPickerState.multiple = multiple;
  flowPickerState.kindFilter = kindFilter || null;
  flowPickerState.onConfirm = onConfirm || null;
  flowPickerState.selected.clear();
  flowPickerState.selectedItems = new Map();
  flowPickerState.items = [];

  elements.flowPickerOverlay.hidden = false;
  elements.flowPickerGrid.replaceChildren();
  elements.flowPickerStatus.hidden = false;
  elements.flowPickerStatus.textContent = "Đang mở danh sách tài nguyên dự án Flow…";
  elements.flowPickerConfirm.disabled = true;
  elements.flowPickerCount.textContent = "0 được chọn";

  // Use SCRAPE_FLOW_PICKER: opens Flow's native + dialog, reads items, closes it
  postToBackground({ type: "SCRAPE_FLOW_PICKER" });
}

function closeFlowPicker() {
  elements.flowPickerOverlay.hidden = true;
}

/** Nhận kết quả từ background sau khi relay GET_FLOW_IMAGES */
function handleFlowImagesResult(items, error) {
  if (error) {
    elements.flowPickerStatus.hidden = false;
    elements.flowPickerStatus.textContent = `\u26a0 ${error}`;
    return;
  }

  // Lọc theo loại (image/video) nếu cần
  const filtered = flowPickerState.kindFilter
    ? items.filter((item) => item.kind === flowPickerState.kindFilter)
    : items;

  flowPickerState.items = filtered;

  if (filtered.length === 0) {
    elements.flowPickerStatus.hidden = false;
    elements.flowPickerStatus.textContent = "Chưa có ảnh/video nào trong kết quả Flow. Hãy tạo ít nhất một ảnh trên trang Flow rồi thử lại.";
    return;
  }

  elements.flowPickerStatus.hidden = true;
  renderPickerGrid(filtered);
}

/**
 * Handles the result of SCRAPE_FLOW_PICKER — items scraped from Flow's + picker dialog.
 * Each item has { idx, name, type, kind, thumbUrl, label }
 */
function handleFlowPickerAssetsResult(items, error) {
  if (error) {
    elements.flowPickerStatus.hidden = false;
    elements.flowPickerStatus.textContent = `⚠ ${error}`;
    return;
  }

  if (items.length === 0) {
    elements.flowPickerStatus.hidden = false;
    elements.flowPickerStatus.textContent = "Không tìm thấy tài nguyên nào trong dự án Flow. Hãy mở dự án có ảnh/video rồi thử lại.";
    return;
  }

  // Normalize to the same shape as handleFlowImagesResult items
  // Use thumbUrl as url (for display), add flowItemName for automation
  const normalized = items.map(item => ({
    url: item.thumbUrl || "",           // thumbnail src (for preview in picker grid)
    kind: item.kind || "image",
    label: item.name || item.label || "",
    source: "flow-picker",
    flowItemName: item.name || item.label || "", // key for automation matching
    type: item.type || ""
  }));

  const filtered = flowPickerState.kindFilter
    ? normalized.filter(item => item.kind === flowPickerState.kindFilter)
    : normalized;

  flowPickerState.items = filtered;
  elements.flowPickerStatus.hidden = true;

  renderPickerGrid(filtered);
}


function renderPickerGrid(items) {
  const fragment = document.createDocumentFragment();

  // Sort: native picker items first, then library, then output results
  const sorted = [...items].sort((a, b) => {
    const rank = s => s === "flow-picker" ? 0 : (s === "library" || s === "labeled" ? 1 : 2);
    return rank(a.source) - rank(b.source);
  });

  sorted.forEach((item) => {
    const cell = document.createElement("div");
    cell.className = "flow-picker-item";
    cell.setAttribute("role", "option");
    cell.setAttribute("aria-selected", "false");
    cell.dataset.url = item.url || "";
    cell.dataset.kind = item.kind;
    // Store flowItemName so automation can find this item by name in Flow's picker
    if (item.flowItemName) cell.dataset.flowItemName = item.flowItemName;
    if (item.label) cell.title = item.label;

    if (item.kind === "video") {
      const vid = document.createElement("video");
      vid.src = item.url;
      vid.muted = true;
      vid.preload = "metadata";
      vid.style.pointerEvents = "none";
      cell.append(vid);
    } else {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.label || "";
      img.loading = "lazy";
      cell.append(img);
    }

    // Nhãn loại (IMG/VID) + nguồn (Thư viện / Kết quả)
    const kindBadge = document.createElement("span");
    kindBadge.className = "flow-picker-item-kind";
    kindBadge.textContent = item.kind === "video" ? "VID" : "IMG";
    cell.append(kindBadge);

    // Source badge for library / native picker items
    if (item.source === "flow-picker") {
      const srcBadge = document.createElement("span");
      srcBadge.className = "flow-picker-item-kind";
      srcBadge.style.cssText = "bottom:22px;top:auto;background:rgba(80,200,120,0.9);font-size:8px;";
      srcBadge.textContent = "PRJ";
      cell.append(srcBadge);
    } else if (item.source === "library" || item.source === "labeled") {
      const srcBadge = document.createElement("span");
      srcBadge.className = "flow-picker-item-kind";
      srcBadge.style.cssText = "bottom:22px;top:auto;background:rgba(100,160,255,0.85);font-size:8px;";
      srcBadge.textContent = "LIB";
      cell.append(srcBadge);
    }

    // Label overlay at bottom
    if (item.label) {
      const lbl = document.createElement("span");
      lbl.style.cssText = `
        position:absolute;bottom:0;left:0;right:0;
        padding:2px 4px;
        background:rgba(0,0,0,0.6);
        font-size:8px;color:#fff;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        pointer-events:none;
      `;
      lbl.textContent = item.label;
      cell.append(lbl);
    }

    // Checkmark
    const check = document.createElement("span");
    check.className = "flow-picker-item-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "\u2713";
    cell.append(check);

    cell.addEventListener("click", () => togglePickerItem(cell, item));
    fragment.append(cell);
  });

  elements.flowPickerGrid.replaceChildren(fragment);
}

function togglePickerItem(cell, item) {
  // Use flowItemName as key for native picker items, fall back to url
  const key = item.flowItemName || item.url || "";
  const isSelected = flowPickerState.selected.has(key);

  // Also maintain a map of key → full item (for flowItemName retrieval later)
  if (!flowPickerState.selectedItems) flowPickerState.selectedItems = new Map();

  if (isSelected) {
    flowPickerState.selected.delete(key);
    flowPickerState.selectedItems.delete(key);
    cell.setAttribute("aria-selected", "false");
  } else {
    if (!flowPickerState.multiple) {
      // Single select: deselect all others
      flowPickerState.selected.clear();
      flowPickerState.selectedItems.clear();
      elements.flowPickerGrid.querySelectorAll(".flow-picker-item").forEach((c) => {
        c.setAttribute("aria-selected", "false");
      });
    }
    flowPickerState.selected.add(key);
    flowPickerState.selectedItems.set(key, item);
    cell.setAttribute("aria-selected", "true");
  }

  const count = flowPickerState.selected.size;
  elements.flowPickerCount.textContent = `${count} được chọn`;
  elements.flowPickerConfirm.disabled = count === 0;
  elements.flowPickerConfirm.textContent = count > 1 ? `Dùng ${count} ảnh` : "Dùng ảnh này";
}

/** Khi người dùng xác nhận chọn: fetch các URL đã chọn → lưu vào flowAssets → hiện preview */
async function confirmFlowPicker() {
  const keys = [...flowPickerState.selected];
  if (!keys.length) return;

  const targetId = flowPickerState.targetInputId;
  const previewEl = document.querySelector(`#${targetId}Preview`);

  elements.flowPickerConfirm.disabled = true;
  elements.flowPickerConfirm.textContent = "Đang xử lý…";

  try {
    // Separate native picker items (no URL, just flowItemName) from regular URL items
    const selectedItems = flowPickerState.selectedItems || new Map();
    const nativeItems = keys.filter(k => {
      const item = selectedItems.get(k);
      return item?.source === "flow-picker" || !item?.url;
    });
    const urlItems = keys.filter(k => !nativeItems.includes(k));

    const flowItemNames = nativeItems.map(k => {
      const item = selectedItems.get(k);
      return item?.flowItemName || k;
    });

    // Download regular URL items
    const files = urlItems.length
      ? await Promise.all(urlItems.map(url => fetchUrlAsFile(url)))
      : [];
    const flowUrls = [...urlItems];

    // If a custom onConfirm callback was provided (e.g. for character slots in Filmmaker tab)
    if (typeof flowPickerState.onConfirm === "function") {
      flowPickerState.onConfirm(files, flowUrls, flowItemNames);
      flowPickerState.onConfirm = null;
      closeFlowPicker();
      return;
    }

    if (!flowPickerState.multiple) {
      flowPickerState.flowAssets.delete(targetId);
      flowPickerState.nativeItemNames.delete(targetId);
      if (previewEl) previewEl.replaceChildren();
    }

    if (nativeItems.length > 0) {
      const existingNames = flowPickerState.multiple
        ? flowPickerState.nativeItemNames.get(targetId) || []
        : [];
      flowPickerState.nativeItemNames.set(targetId, [...new Set([...existingNames, ...flowItemNames])]);
    }

    if (nativeItems.length > 0 && previewEl) {
      flowItemNames.forEach(name => {
        const thumb = document.createElement("div");
        thumb.className = "asset-thumb";
        thumb.style.cssText = "display:flex;align-items:center;justify-content:center;background:rgba(80,200,120,0.1);border:1px solid rgba(80,200,120,0.4);border-radius:8px;padding:4px 8px;font-size:9px;color:rgba(80,200,120,0.9);gap:4px;min-height:48px;text-align:center;";

        const iconEl = document.createElement("span");
        iconEl.className = "material-symbols-outlined";
        iconEl.style.fontSize = "16px";
        iconEl.textContent = "photo_library";

        const nameEl = document.createElement("span");
        nameEl.textContent = name.length > 20 ? `${name.substring(0, 18)}…` : name;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "asset-thumb-remove";
        removeButton.setAttribute("aria-label", `Xóa ${name}`);
        removeButton.textContent = "×";
        removeButton.addEventListener("click", () => {
          const names = flowPickerState.nativeItemNames.get(targetId) || [];
          const nextNames = names.filter((item) => item !== name);
          if (nextNames.length) flowPickerState.nativeItemNames.set(targetId, nextNames);
          else flowPickerState.nativeItemNames.delete(targetId);
          thumb.remove();
        });

        thumb.append(iconEl, nameEl, removeButton);
        previewEl.append(thumb);
      });
    }

    // For URL items: show image thumbnails
    if (files.length > 0) {
      if (!flowPickerState.multiple) {
        flowPickerState.flowAssets.set(targetId, [...files]);
      } else {
        const existing = flowPickerState.flowAssets.get(targetId) || [];
        flowPickerState.flowAssets.set(targetId, [...existing, ...files]);
      }

      if (previewEl) {
        files.forEach((file) => {
          const thumb = createAssetThumb(file, () => {
            const arr = flowPickerState.flowAssets.get(targetId) || [];
            const idx = arr.indexOf(file);
            if (idx !== -1) arr.splice(idx, 1);
            if (!arr.length) flowPickerState.flowAssets.delete(targetId);
            thumb.remove();
          });
          previewEl.append(thumb);
        });
      }
    }

    closeFlowPicker();
  } catch (err) {
    elements.flowPickerConfirm.disabled = false;
    elements.flowPickerConfirm.textContent = "Thử lại";
    elements.flowPickerStatus.hidden = false;
    elements.flowPickerStatus.textContent = `⚠ Lỗi: ${err.message}`;
  }
}

/** Fetch một URL (có thể là https hoặc blob) về dạng File */
async function fetchUrlAsFile(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const fileName = `flow_asset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  return new File([blob], fileName, { type: blob.type });
}

/** Tạo thumbnail element có nút xóa */
function createAssetThumb(file, onRemove) {
  const thumb = document.createElement("div");
  thumb.className = "asset-thumb";

  const objectUrl = URL.createObjectURL(file);
  if (file.type.startsWith("video/")) {
    const vid = document.createElement("video");
    vid.src = objectUrl;
    vid.muted = true;
    vid.preload = "metadata";
    thumb.append(vid);
  } else {
    const img = document.createElement("img");
    img.src = objectUrl;
    img.alt = file.name;
    thumb.append(img);
  }

  const removeBtn = document.createElement("button");
  removeBtn.className = "asset-thumb-remove";
  removeBtn.type = "button";
  removeBtn.setAttribute("aria-label", "Xóa ảnh này");
  removeBtn.textContent = "\u00d7";
  removeBtn.addEventListener("click", () => {
    URL.revokeObjectURL(objectUrl);
    onRemove();
  });
  thumb.append(removeBtn);

  return thumb;
}

// Gắn sự kiện cho các nút "Chọn từ Flow"
document.querySelectorAll(".pick-from-flow-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const multiple = btn.dataset.multiple !== "false";
    const kind = btn.dataset.kind || null;
    openFlowPicker(targetId, multiple, kind);
  });
});

elements.flowPickerClose.addEventListener("click", closeFlowPicker);
elements.flowPickerOverlay.addEventListener("click", (e) => {
  if (e.target === elements.flowPickerOverlay) closeFlowPicker();
});
elements.flowPickerConfirm.addEventListener("click", () => void confirmFlowPicker());
elements.flowPickerRefresh.addEventListener("click", () => {
  elements.flowPickerGrid.replaceChildren();
  elements.flowPickerStatus.hidden = false;
  elements.flowPickerStatus.textContent = "Đang tải lại\u2026";
  flowPickerState.selected.clear();
  elements.flowPickerCount.textContent = "0 được chọn";
  elements.flowPickerConfirm.disabled = true;
  postToBackground({ type: "GET_FLOW_IMAGES" });
});

// Đóng picker khi nhấn Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !elements.flowPickerOverlay.hidden) closeFlowPicker();
});

// ══════════════════════════════════════════════════════════════════════════════
// Patch collectWorkflowAssets để đọc flowAssets khi file input trống
// ══════════════════════════════════════════════════════════════════════════════
const _baseCollectWorkflowAssets = _collectWorkflowAssetsBase;

// collectWorkflowAssets là phiên bản merged (file input + flow picker)
async function collectWorkflowAssets(mode) {
  // Gọi hàm gốc — nhưng bắt lỗi "thiếu tệp bắt buộc" nếu flow assets đang bù
  let fileAssets = [];
  let caughtRequiredError = null;
  try {
    fileAssets = await _baseCollectWorkflowAssets(mode);
  } catch (err) {
    caughtRequiredError = err;
  }

  // Tổng hợp flow picker assets cho mode này
  const ROLE_MAP = {
    frames_to_video: [
      { inputId: "startFrameInput", role: "start_frame", required: true },
      { inputId: "endFrameInput", role: "end_frame", required: false }
    ],
    ingredients_to_video: [{ inputId: "referenceFiles", role: "ingredient", required: true }],
    image_edit: [{ inputId: "sourceImages", role: "source_image", required: true }],
    video_edit: [{ inputId: "sourceVideo", role: "source_video", required: true }],
    agent: [{ inputId: "agentAssets", role: "agent_reference", required: false }]
  };

  const mappings = ROLE_MAP[mode] || [];
  const extraAssets = [];

  for (const { inputId, role } of mappings) {
    const flowFiles = flowPickerState.flowAssets.get(inputId) || [];
    for (const file of flowFiles) {
      extraAssets.push({
        role,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: await readFileAsDataUrl(file)
      });
    }

    const nativeNames = flowPickerState.nativeItemNames.get(inputId) || [];
    for (const name of nativeNames) {
      extraAssets.push({
        role,
        source: "flow-library",
        flowItemName: name,
        name,
        type: "",
        size: 0,
        dataUrl: ""
      });
    }
  }

  // Nếu gốc báo thiếu tệp bắt buộc nhưng flow assets bù đủ → OK
  if (caughtRequiredError) {
    // Kiểm tra xem required inputs có flow assets không
    const hasFlowForRequired = mappings
      .filter((m) => m.required)
      .every((m) =>
        (flowPickerState.flowAssets.get(m.inputId) || []).length > 0 ||
        (flowPickerState.nativeItemNames.get(m.inputId) || []).length > 0
      );

    if (!hasFlowForRequired || extraAssets.length === 0) {
      throw caughtRequiredError;
    }
    // OK — flow assets bù cho file input trống
  }

  const merged = [...fileAssets, ...extraAssets];

  const MAX_ASSET_BYTES = 24 * 1024 * 1024;
  const totalBytes = merged.reduce((sum, a) => sum + (a.size || 0), 0);
  if (totalBytes > MAX_ASSET_BYTES) {
    throw new Error(`Tổng tệp là ${(totalBytes / 1024 / 1024).toFixed(1)} MB, vượt giới hạn tự động 24 MB. Hãy tải tệp lớn trực tiếp lên Flow.`);
  }

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
const chatgptGateEl   = document.getElementById("chatgptGate");

const openChatGPTBtn  = document.getElementById("openChatGPTButton");

async function renderChatGPTGate() {
  if (!chatgptGateEl) return;
  if (activePanel !== "chatgpt") {
    chatgptGateEl.hidden = true;
    return;
  }

  if (!globalThis.chrome?.tabs) {
    // Không có quyền tabs (preview tĩnh) → ẩn gate
    chatgptGateEl.hidden = true;
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
    const hasChatGPT = tabs.length > 0;
    // Chỉ ẩn nếu đang ở tab chatgpt và chatgpt đã mở
    chatgptGateEl.hidden = hasChatGPT;
  } catch {
    chatgptGateEl.hidden = true;
  }
}

// Nút "Mở ChatGPT" trong gate
openChatGPTBtn?.addEventListener("click", async () => {
  if (globalThis.chrome?.tabs) {
    await chrome.tabs.create({ url: "https://chatgpt.com/", active: true });
    // Chờ tab load rồi check lại
    setTimeout(() => void renderChatGPTGate(), 3500);
  } else {
    window.open("https://chatgpt.com/", "_blank");
  }
});

// Polling: kiểm tra lại trạng thái ChatGPT tab mỗi 3s khi đang ở tab chatgpt
setInterval(() => {
  if (activePanel === "chatgpt") {
    void renderChatGPTGate();
  }
}, 3000);

// ═══════════════════════════════════════════════════════════════════════════
// AUTO CHATGPT MODULE
// Thu thập kịch bản / dữ liệu từ ChatGPT theo danh sách chủ đề
// ═══════════════════════════════════════════════════════════════════════════
"use strict";

window.AutoChatGPT = (function () {

  const CHATGPT_URL = "https://chatgpt.com/";
  const CHATGPT_URL_PATTERN = /^https:\/\/chatgpt\.com\//;

  // ── Template mặc định theo chế độ ────────────────────────────────────────
  const DEFAULT_TEMPLATES = {
    scenario: `Viết kịch bản video YouTube 90 giây về chủ đề: {topic}
Yêu cầu:
- Hook mở đầu hấp dẫn (10 giây đầu)
- 3 điểm chính có thực tế và ví dụ cụ thể
- Call-to-action cuối video rõ ràng
- Phong cách kể chuyện, ngắn gọn, dễ hiểu
- Ngôn ngữ: Tiếng Việt tự nhiên`,

    research: `Nghiên cứu và phân tích chủ đề: {topic}
Cung cấp:
1. Tổng quan ngắn gọn (50 từ)
2. 5 điểm quan trọng nhất
3. Số liệu thống kê nổi bật (nếu có)
4. Xu hướng hiện tại
5. Cơ hội nội dung cho YouTube
Định dạng: danh sách rõ ràng, có đánh số.`,

    outline: `Tạo outline chi tiết cho video YouTube về: {topic}
Cấu trúc:
- Tiêu đề video (3 phương án A/B/C)
- Thumbnail concept
- Hook (0–10s)
- Intro (10–30s)
- Nội dung chính (3–5 phần, mỗi phần có tiêu đề)
- Outro + CTA
- Tags đề xuất (10 tags)`,

    custom: `{topic}`
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const cgpt = {
    mode:        "scenario",
    isRunning:   false,
    topics:      [],
    currentIdx:  0,
    results:     [],          // [{topic, text, timestamp}]
    chatTabId:   null,
    stopFlag:    false,
    runTimer:    null,
    requestId:   null,
    completedCount: 0
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const el = {
    statusDot:    document.querySelector("#cgptStatusDot"),
    statusLabel:  document.querySelector("#cgptStatusLabel"),
    counter:      document.querySelector("#cgptCounter"),
    template:     document.querySelector("#cgptTemplate"),
    topics:       document.querySelector("#cgptTopics"),
    topicCount:   document.querySelector("#cgptTopicCount"),
    waitSec:      document.querySelector("#cgptWaitSec"),
    delaySec:     document.querySelector("#cgptDelaySec"),
    autoOpen:     document.querySelector("#cgptAutoOpen"),
    sendToApp:    document.querySelector("#cgptSendToApp"),
    progressText: document.querySelector("#cgptProgressText"),
    progressNums: document.querySelector("#cgptProgressNums"),
    progressBar:  document.querySelector("#cgptProgressBar"),
    currentTopic: document.querySelector("#cgptCurrentTopic"),
    resultsList:  document.querySelector("#cgptResultsList"),
    resultCount:  document.querySelector("#cgptResultCount"),
    copyAll:      document.querySelector("#cgptCopyAll"),
    clearResults: document.querySelector("#cgptClearResults"),
    startBtn:     document.querySelector("#cgptStartBtn"),
    startLabel:   document.querySelector("#cgptStartLabel"),
    stopBtn:      document.querySelector("#cgptStopBtn"),
    loadTemplate: document.querySelector("#cgptLoadTemplate"),
    modeTabs:     document.querySelectorAll("[data-cgpt-mode]")
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  function parseTopics() {
    return (el.topics?.value || "")
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
  }

  function buildPrompt(topic) {
    const tmpl = (el.template?.value || "").trim() || DEFAULT_TEMPLATES[cgpt.mode] || "{topic}";
    return tmpl.replaceAll("{topic}", topic);
  }

  function updateTopicCount() {
    const n = parseTopics().length;
    if (el.topicCount) el.topicCount.textContent = `${n} chủ đề`;
  }

  function setStatus(status, label) {
    if (el.statusDot)   el.statusDot.dataset.status = status;
    if (el.statusLabel) el.statusLabel.textContent   = label;
  }

  function setProgress(current, total, topicText) {
    if (el.progressNums) el.progressNums.textContent = `${current} / ${total}`;
    if (el.progressText) el.progressText.textContent = current === 0 ? "Đang bắt đầu…" : `Đã xong ${current} / ${total}`;
    if (el.progressBar)  el.progressBar.style.width  = total > 0 ? `${Math.round((current / total) * 100)}%` : "0%";
    if (el.currentTopic && topicText !== undefined) el.currentTopic.textContent = topicText;
    if (el.counter) el.counter.textContent = `${current} / ${total}`;
  }

  function setRunning(running) {
    cgpt.isRunning = running;
    if (el.startBtn)  el.startBtn.disabled  = running;
    if (el.stopBtn)   el.stopBtn.disabled   = !running;
    if (el.startLabel) el.startLabel.textContent = running ? "Đang chạy…" : "Bắt đầu ChatGPT";
  }

  // ── Render results ────────────────────────────────────────────────────────
  function renderResults() {
    if (!el.resultsList) return;
    if (cgpt.results.length === 0) {
      el.resultsList.innerHTML = '<p class="empty-log">Chưa có kết quả.</p>';
      if (el.copyAll)    el.copyAll.disabled    = true;
      if (el.resultCount) el.resultCount.textContent = "0 kết quả";
      return;
    }

    if (el.resultCount) el.resultCount.textContent = `${cgpt.results.length} kết quả`;
    if (el.copyAll)     el.copyAll.disabled = false;

    el.resultsList.innerHTML = cgpt.results.map((r, i) => `
      <div class="cgpt-result-item">
        <div class="cgpt-result-topic">
          <span class="cgpt-result-num">${i + 1}</span>
          ${escapeHtml(r.topic)}
        </div>
        <div class="cgpt-result-text">${escapeHtml(r.text)}</div>
        <div class="cgpt-result-meta">
          <span>${r.timestamp}</span>
          <span>${r.mode || cgpt.mode}</span>
        </div>
      </div>
    `).join("");

    // scroll to newest
    el.resultsList.scrollTop = el.resultsList.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Save / restore settings ───────────────────────────────────────────────
  function saveCgptSettings() {
    if (!globalThis.chrome?.storage) return;
    void chrome.storage.local.set({
      cgptSettings: {
        mode:     cgpt.mode,
        template: el.template?.value || "",
        topics:   el.topics?.value   || "",
        waitSec:  el.waitSec?.value  || "25",
        delaySec: el.delaySec?.value || "8",
        autoOpen: el.autoOpen?.checked ?? true,
        sendToApp: el.sendToApp?.checked ?? true
      },
      cgptResults: cgpt.results
    });
  }

  function restoreCgptSettings() {
    if (!globalThis.chrome?.storage) return;
    chrome.storage.local.get(["cgptSettings", "cgptResults"], (stored) => {
      const s = stored.cgptSettings;
      if (s) {
        cgpt.mode = s.mode || "scenario";
        if (el.template)  el.template.value   = s.template || "";
        if (el.topics)    el.topics.value     = s.topics   || "";
        if (el.waitSec)   el.waitSec.value    = s.waitSec  || "25";
        if (el.delaySec)  el.delaySec.value   = s.delaySec || "8";
        if (el.autoOpen)  el.autoOpen.checked  = s.autoOpen  !== false;
        if (el.sendToApp) el.sendToApp.checked = s.sendToApp !== false;
        // restore mode tab
        el.modeTabs.forEach(btn => {
          btn.classList.toggle("is-active", btn.dataset.cgptMode === cgpt.mode);
          btn.setAttribute("aria-selected", String(btn.dataset.cgptMode === cgpt.mode));
        });
      }
      if (Array.isArray(stored.cgptResults) && stored.cgptResults.length > 0) {
        cgpt.results = stored.cgptResults;
        renderResults();
      }
      updateTopicCount();
    });
  }

  // ── Find / open ChatGPT tab ───────────────────────────────────────────────
  async function ensureChatGPTTab() {
    if (!globalThis.chrome?.tabs) return null;

    // Try to reuse existing open ChatGPT tab
    const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
    if (tabs.length > 0) {
      cgpt.chatTabId = tabs[0].id;
      await chrome.tabs.update(cgpt.chatTabId, { active: true });
      return cgpt.chatTabId;
    }

    if (!el.autoOpen?.checked) return null;

    // Open new tab
    const tab = await chrome.tabs.create({ url: CHATGPT_URL, active: true });
    cgpt.chatTabId = tab.id;
    // Wait for tab to load
    await new Promise((resolve) => {
      function onUpdated(tabId, info) {
        if (tabId === cgpt.chatTabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(onUpdated);
      setTimeout(resolve, 10000); // fallback 10s
    });
    return cgpt.chatTabId;
  }

  // ── Inject prompt into ChatGPT and wait for response ─────────────────────
  async function sendPromptToChatGPT(tabId, prompt, waitSeconds) {
    if (!globalThis.chrome?.scripting) {
      // Fallback nếu không có scripting permission: dùng clipboard + alert
      await navigator.clipboard.writeText(prompt);
      return `[Đã copy prompt vào clipboard. Dán vào ChatGPT và copy kết quả thủ công]\nPrompt: ${prompt}`;
    }

    const [baselineSnapshot] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const collectAssistantTexts = () => {
          const roleTurns = [...document.querySelectorAll("[data-message-author-role='assistant']")];
          if (roleTurns.length) {
            return roleTurns.map((turn) => {
              const content = turn.querySelector(".markdown, [data-message-content], .prose") || turn;
              return (content.innerText || content.textContent || "").trim();
            }).filter(Boolean);
          }
          return [...document.querySelectorAll(".agent-turn .markdown, article .markdown, .prose.dark\\:prose-invert")]
            .map((node) => (node.innerText || node.textContent || "").trim())
            .filter(Boolean);
        };
        const texts = collectAssistantTexts();
        return { count: texts.length, lastText: texts.at(-1) || "" };
      }
    });
    const baseline = baselineSnapshot?.result || { count: 0, lastText: "" };

    // Step 1: Type and submit the prompt. Returning a Promise keeps this
    // injection alive until the click/keyboard submission has actually run.
    const [submission] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (promptText) => {
        // Find the main input textarea
        const selectors = [
          "#prompt-textarea",
          "div[contenteditable='true'][data-virtuoso-scroller]",
          "div#prompt-textarea[contenteditable='true']",
          ".ProseMirror[contenteditable='true']",
          "[contenteditable='true'].ProseMirror",
          "[data-id='root'] textarea",
          "form textarea",
          "[contenteditable='true'][data-testid]",
          "[contenteditable='true']"
        ];
        let input = null;
        for (const sel of selectors) {
          input = document.querySelector(sel);
          if (input) break;
        }
        if (!input) {
          throw new Error("Không tìm thấy ô nhập ChatGPT");
        }

        // Focus and set value
        input.focus();
        if (input.tagName === "TEXTAREA") {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          nativeInputValueSetter.call(input, promptText);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          // contenteditable div (ProseMirror) — phải dùng execCommand hoặc clipboard
          // Xóa nội dung cũ
          input.focus();
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, promptText);
          // Fallback nếu execCommand không hoạt động
          if (!input.textContent.includes(promptText.slice(0, 20))) {
            input.textContent = "";
            const dt = new DataTransfer();
            dt.setData("text/plain", promptText);
            input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
          }
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }

        await new Promise((resolve) => setTimeout(resolve, 600));
        const sendBtn = document.querySelector(
          "button[data-testid='send-button'], " +
          "button[aria-label='Send prompt'], " +
          "button[aria-label*='Send'], " +
          "button.send-button, " +
          "button[aria-label='Gửi lời nhắc']"
        );
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
          return { submitted: true, method: "button" };
        }

        const keyboardOptions = {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        };
        input.dispatchEvent(new KeyboardEvent("keydown", keyboardOptions));
        input.dispatchEvent(new KeyboardEvent("keyup", keyboardOptions));
        return { submitted: true, method: "keyboard" };
      },
      args: [prompt]
    });
    if (!submission?.result?.submitted) {
      throw new Error("Không gửi được prompt vào ChatGPT.");
    }

    // Step 2: Wait for a NEW assistant turn, then require its text to remain
    // stable after streaming stops. This prevents returning an older response.
    const maxWait = Math.max(5, Number(waitSeconds) || 25) * 1000;
    const pollInterval = 1000;
    const started = Date.now();
    let lastObservedText = "";
    let stablePolls = 0;

    while (Date.now() - started < maxWait) {
      if (cgpt.stopFlag) return null;
      await new Promise(r => setTimeout(r, pollInterval));

      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (previous) => {
          const collectAssistantTexts = () => {
            const roleTurns = [...document.querySelectorAll("[data-message-author-role='assistant']")];
            if (roleTurns.length) {
              return roleTurns.map((turn) => {
                const content = turn.querySelector(".markdown, [data-message-content], .prose") || turn;
                return (content.innerText || content.textContent || "").trim();
              }).filter(Boolean);
            }
            return [...document.querySelectorAll(".agent-turn .markdown, article .markdown, .prose.dark\\:prose-invert")]
              .map((node) => (node.innerText || node.textContent || "").trim())
              .filter(Boolean);
          };
          const texts = collectAssistantTexts();
          const text = texts.at(-1) || "";
          const isStreaming = !![
            "[data-testid='stop-button']",
            ".result-streaming",
            "[aria-label='Stop generating']",
            "button[aria-label*='Stop']"
          ].find(sel => document.querySelector(sel));
          const hasNewMessage = texts.length > previous.count || Boolean(text && text !== previous.lastText);
          return { hasNewMessage, isStreaming, text };
        },
        args: [baseline]
      });
      const responseState = result?.result;
      if (!responseState?.hasNewMessage || !responseState.text) {
        stablePolls = 0;
        continue;
      }

      if (responseState.isStreaming) {
        lastObservedText = responseState.text;
        stablePolls = 0;
        continue;
      }

      if (responseState.text === lastObservedText) {
        stablePolls += 1;
        if (stablePolls >= 2) return responseState.text;
      } else {
        lastObservedText = responseState.text;
        stablePolls = 0;
      }
    }

    throw new Error(
      `ChatGPT chưa trả về phản hồi mới sau ${Math.round(maxWait / 1000)} giây. ` +
      "Hãy tăng thời gian chờ hoặc kiểm tra tab ChatGPT."
    );
  }

  // ── Main batch loop ───────────────────────────────────────────────────────
  async function runBatch() {
    cgpt.topics  = parseTopics();
    cgpt.stopFlag = false;
    cgpt.completedCount = 0;
    cgpt.results = [];
    renderResults();

    if (cgpt.topics.length === 0) {
      setStatus("error", "Chưa có chủ đề nào");
      postToBackground({
        type: "CHATGPT_BATCH_FAILED",
        message: "Chưa có chủ đề nào.",
        request_id: cgpt.requestId
      });
      return;
    }

    setRunning(true);
    setStatus("running", "Đang chạy…");
    setProgress(0, cgpt.topics.length, `Chuẩn bị…`);

    let tabId;
    try {
      tabId = await ensureChatGPTTab();
      if (!tabId) {
        throw new Error("Không mở được tab ChatGPT. Bật tuỳ chọn 'Tự mở ChatGPT' hoặc mở tab thủ công.");
      }
    } catch (err) {
      setStatus("error", err.message);
      setRunning(false);
      postToBackground({
        type: "CHATGPT_BATCH_FAILED",
        message: err.message,
        request_id: cgpt.requestId
      });
      return;
    }

    const waitSec  = parseInt(el.waitSec?.value  || "25", 10);
    const delaySec = parseInt(el.delaySec?.value || "8",  10);

    for (let i = 0; i < cgpt.topics.length; i++) {
      if (cgpt.stopFlag) break;

      const topic  = cgpt.topics[i];
      const prompt = buildPrompt(topic);
      cgpt.currentIdx = i;

      setProgress(i, cgpt.topics.length, `📝 ${topic}`);
      setStatus("running", `Xử lý ${i + 1}/${cgpt.topics.length}`);

      try {
        // Wait a bit between topics
        if (i > 0) {
          setStatus("running", `Chờ ${delaySec}s trước chủ đề tiếp theo…`);
          await waitUntilStoppedOrElapsed(delaySec * 1000);
        }
        if (cgpt.stopFlag) break;

        // Send to ChatGPT and get response
        const responseText = await sendPromptToChatGPT(tabId, prompt, waitSec);
        if (cgpt.stopFlag) break;

        const now = new Date().toLocaleTimeString("vi-VN");
        const resultItem = {
          topic,
          text:      responseText || "(Không lấy được phản hồi)",
          timestamp: now,
          mode:      cgpt.mode,
          prompt
        };
        cgpt.results.push(resultItem);
        cgpt.completedCount += 1;
        renderResults();
        saveCgptSettings();

        // Forward to desktop app via background
        if (el.sendToApp?.checked) {
          postToBackground({
            type: "CHATGPT_RESULT",
            data: resultItem,
            index: i,
            total: cgpt.topics.length,
            request_id: cgpt.requestId
          });
        }

        setProgress(i + 1, cgpt.topics.length, `✅ ${topic}`);
      } catch (err) {
        const errItem = {
          topic,
          text:      `[LỖI] ${err.message}`,
          timestamp: new Date().toLocaleTimeString("vi-VN"),
          mode:      cgpt.mode,
          prompt
        };
        cgpt.results.push(errItem);
        cgpt.completedCount += 1;
        renderResults();
        setProgress(i + 1, cgpt.topics.length, `❌ Lỗi: ${topic}`);
      }
    }

    const done = cgpt.stopFlag ? "Đã dừng" : "Hoàn tất";
    setStatus(cgpt.stopFlag ? "idle" : "done", `${done} — ${cgpt.results.length} kết quả`);
    const completedCount = cgpt.stopFlag ? cgpt.completedCount : cgpt.topics.length;
    setProgress(completedCount, cgpt.topics.length, cgpt.stopFlag ? "Đã dừng bởi người dùng." : `🎉 Xong ${cgpt.topics.length} chủ đề!`);
    setRunning(false);
    saveCgptSettings();

    // Notify background: batch complete
    if (cgpt.stopFlag) {
      postToBackground({
        type: "CHATGPT_BATCH_STOPPED",
        message: "ChatGPT batch đã dừng.",
        request_id: cgpt.requestId
      });
    } else {
      postToBackground({
        type:    "CHATGPT_BATCH_DONE",
        results: cgpt.results,
        total:   cgpt.topics.length,
        request_id: cgpt.requestId
      });
    }
  }

  async function waitUntilStoppedOrElapsed(milliseconds) {
    const deadline = Date.now() + Math.max(0, milliseconds);
    while (!cgpt.stopFlag && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, Math.min(250, deadline - Date.now())));
    }
  }

  async function stopBatch() {
    if (!cgpt.isRunning) return;
    cgpt.stopFlag = true;
    setStatus("idle", "Đang dừng…");
    if (el.stopBtn) el.stopBtn.disabled = true;
    if (!cgpt.chatTabId || !globalThis.chrome?.scripting) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: cgpt.chatTabId },
        func: () => {
          const stopButton = document.querySelector(
            "[data-testid='stop-button'], [aria-label='Stop generating'], button[aria-label*='Stop']"
          );
          if (stopButton) stopButton.click();
        }
      });
    } catch {
      // Tab có thể đã đóng; vòng lặp vẫn dừng nhờ stopFlag.
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  el.startBtn?.addEventListener("click", () => {
    if (!cgpt.isRunning) void runBatch();
  });

  el.stopBtn?.addEventListener("click", () => {
    void stopBatch();
  });

  el.clearResults?.addEventListener("click", () => {
    cgpt.results = [];
    renderResults();
    saveCgptSettings();
    setProgress(0, 0, "Nhập chủ đề và nhấn Bắt đầu.");
    setStatus("idle", "Chờ lệnh");
  });

  el.copyAll?.addEventListener("click", () => {
    const allText = cgpt.results.map((r, i) =>
      `=== ${i + 1}. ${r.topic} ===\n${r.text}\n`
    ).join("\n\n");
    navigator.clipboard.writeText(allText).then(() => {
      const orig = el.copyAll.textContent;
      el.copyAll.textContent = "✅ Đã sao chép!";
      setTimeout(() => { if (el.copyAll) el.copyAll.textContent = orig; }, 2000);
    });
  });

  el.loadTemplate?.addEventListener("click", () => {
    if (el.template) {
      el.template.value = DEFAULT_TEMPLATES[cgpt.mode] || DEFAULT_TEMPLATES.scenario;
      saveCgptSettings();
    }
  });

  el.topics?.addEventListener("input", () => {
    updateTopicCount();
    saveCgptSettings();
  });

  el.template?.addEventListener("input", () => saveCgptSettings());
  el.waitSec?.addEventListener("change",  () => saveCgptSettings());
  el.delaySec?.addEventListener("change", () => saveCgptSettings());
  el.autoOpen?.addEventListener("change", () => saveCgptSettings());
  el.sendToApp?.addEventListener("change",() => saveCgptSettings());

  // Mode tab switching
  el.modeTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      cgpt.mode = btn.dataset.cgptMode;
      el.modeTabs.forEach(b => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", String(b === btn));
      });
      // Auto-load default template if textarea is empty
      if (!el.template?.value.trim()) {
        if (el.template) el.template.value = DEFAULT_TEMPLATES[cgpt.mode] || "";
      }
      saveCgptSettings();
    });
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  restoreCgptSettings();

  // Set default template on first load
  setTimeout(() => {
    if (el.template && !el.template.value.trim()) {
      el.template.value = DEFAULT_TEMPLATES[cgpt.mode] || "";
    }
  }, 300);

  // ── Public API (dùng bởi CHATGPT_BATCH_START từ App) ─────────────────────
  /**
   * applyDesktopConfig(cfg) — Nhận config từ Desktop App và populate UI:
   *   cfg.mode, cfg.template, cfg.topics (array), cfg.wait_sec, cfg.delay_sec
   */
  function applyDesktopConfig(cfg) {
    if (!cfg) return;
    cgpt.requestId = cfg.request_id || null;

    // Mode
    if (cfg.mode && DEFAULT_TEMPLATES[cfg.mode]) {
      cgpt.mode = cfg.mode;
      el.modeTabs.forEach(btn => {
        btn.classList.toggle("is-active", btn.dataset.cgptMode === cfg.mode);
        btn.setAttribute("aria-selected", String(btn.dataset.cgptMode === cfg.mode));
      });
    }

    // Template
    if (cfg.template && el.template) {
      el.template.value = cfg.template;
    }

    // Topics (array → textarea)
    if (Array.isArray(cfg.topics) && cfg.topics.length > 0 && el.topics) {
      el.topics.value = cfg.topics.join("\n");
      updateTopicCount();
    }

    // Timing
    if (cfg.wait_sec  && el.waitSec)  el.waitSec.value  = String(cfg.wait_sec);
    if (cfg.delay_sec && el.delaySec) el.delaySec.value = String(cfg.delay_sec);

    saveCgptSettings();
  }

  /** startBatch() — Bắt đầu chạy batch (giống nhấn nút Bắt đầu) */
  function startBatch(config = null) {
    if (cgpt.isRunning) {
      postToBackground({
        type: "CHATGPT_BATCH_FAILED",
        message: "ChatGPT đang chạy một batch khác.",
        request_id: config?.request_id || null
      });
      return false;
    }
    if (config) applyDesktopConfig(config);
    void runBatch();
    return true;
  }

  return { applyDesktopConfig, startBatch, stopBatch };

})(); // end AutoChatGPT
