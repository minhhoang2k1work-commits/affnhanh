"use strict";

// Bọc trong IIFE và đặt cờ để chrome.scripting.executeScript không đăng ký listener hai lần.
(() => {
  if (globalThis.__autoFlowContentScriptLoaded) return;
  globalThis.__autoFlowContentScriptLoaded = true;

  /**
   * ===========================================================================
   * KHU VỰC CẦN CHỈNH KHI GOOGLE FLOW THAY ĐỔI DOM
   * ===========================================================================
   * Selector được xếp từ cụ thể/ổn định đến selector dự phòng. Khi Inspect (F12),
   * hãy thêm selector mới lên ĐẦU mảng tương ứng. Tránh class ngẫu nhiên kiểu
   * ".css-1a2b3c" vì chúng thường đổi sau mỗi lần Google deploy.
   */
  const SELECTORS = {
    promptInputs: [
      // Ví dụ nên ưu tiên nếu bạn tìm thấy data-testid thật trên trang:
      // '[data-testid="flow-prompt-input"]',
      'textarea[aria-label*="prompt" i]',
      'textarea[placeholder*="prompt" i]',
      '[contenteditable="true"][aria-label*="prompt" i]',
      '[contenteditable="true"][data-slate-editor="true"]',
      '[contenteditable="true"][role="textbox"]',
      'textarea'
    ],

    generateButtons: [
      // Ví dụ: '[data-testid="generate-button"]',
      '[data-testid*="generate" i]',
      '[data-testid*="submit" i]',
      '[data-testid*="send" i]',
      'button[aria-label*="Generate" i]',
      'button[aria-label*="Create" i]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="Submit" i]',
      'button[aria-label*="Tạo" i]',
      'button[title*="Generate" i]',
      'button[title*="Send" i]',
      'button[type="submit"]',
      '[role="button"][aria-label*="Generate" i]',
      '[role="button"][aria-label*="Send" i]'
    ],

    loadingIndicators: [
      // Thay bằng selector spinner/loading thực tế nếu Flow đổi giao diện.
      '[aria-busy="true"]',
      '[role="progressbar"]',
      '[data-loading="true"]',
      '[class*="loading" i]',
      '[class*="spinner" i]',
      'mat-spinner'
    ],

    resultMedia: [
      // Có thể thêm selector container kết quả cụ thể, ví dụ:
      // '[data-testid="generation-result"] video',
      // '[data-testid="generation-result"] img',
      'video[src]',
      'video source[src]',
      'img[src]',
      'a[href*=".mp4" i]',
      'a[href*=".webm" i]',
      'a[href*=".png" i]',
      'a[href*=".jpg" i]',
      'a[href*=".webp" i]'
    ],

    // Nút mở bảng cài đặt model/generation. Thêm data-testid thật lên đầu mảng nếu có.
    settingsTriggers: [
      'button[aria-label*="model" i]',
      'button[aria-label*="generation" i]',
      'button[aria-label*="settings" i]',
      'button[title*="model" i]',
      '[role="button"][aria-haspopup="menu"]',
      '[role="button"][aria-haspopup="listbox"]',
      'button[aria-haspopup="menu"]',
      'button[aria-haspopup="listbox"]'
    ],

    // Input tải tệp thường bị ẩn; không dùng isVisible() khi tìm nhóm này.
    fileInputs: [
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept*="video"]',
      'input[type="file"]'
    ],

    agentToggles: [
      'button[aria-label="Agent" i]',
      'button[aria-label*="Flow Agent" i]',
      '[role="button"][aria-label*="Agent" i]'
    ],

    // Màn hình đầu của Flow là danh sách dự án. Nếu Google đổi DOM, hãy thêm
    // data-testid/aria-label của thẻ "+ Dự án mới" lên đầu mảng này.
    newProjectControls: [
      '[data-testid*="new-project" i]',
      '[data-testid*="create-project" i]',
      'button[aria-label*="new project" i]',
      'button[aria-label*="dự án mới" i]',
      'a[aria-label*="new project" i]',
      'a[aria-label*="dự án mới" i]',
      '[role="button"][aria-label*="new project" i]',
      '[role="button"][aria-label*="dự án mới" i]'
    ]
  };

  const GENERATE_WORDS = ["generate", "create", "tạo", "tao", "send", "gửi", "gui"];
  const SUBMIT_ICON_WORDS = ["arrow_forward", "arrow_upward", "north", "send", "play_arrow", "forward"];
  const MODE_LABELS = {
    text_to_video: ["Video"],
    text_to_image: ["Image", "Hình ảnh"],
    frames_to_video: ["Frames", "Frames to Video", "Khung hình"],
    ingredients_to_video: ["Ingredients", "References", "Thành phần"],
    image_edit: ["Image", "Hình ảnh"],
    video_edit: ["Video", "Edit video", "Chỉnh sửa video"],
    extend_video: ["Extend", "Mở rộng", "Nối dài"]
  };
  const MODEL_LABELS = {
    veo_3_1_fast: ["Veo 3.1 Fast"],
    veo_3_1_quality: ["Veo 3.1 Quality"],
    veo_3_1_lite: ["Veo 3.1 Lite"],
    omni_flash: ["Gemini Omni Flash", "Omni Flash"],
    nano_banana_pro: ["Nano Banana Pro"],
    nano_banana_2: ["Nano Banana 2"],
    nano_banana_2_lite: ["Nano Banana 2 Lite"]
  };
  const NEW_PROJECT_LABELS = [
    "dự án mới",
    "tạo dự án mới",
    "tạo dự án",
    "new project",
    "create new project",
    "create a new project",
    "new flow project",
    "create a new flow project",
    "create project"
  ];
  const MAX_RESULT_WAIT_MS = 12 * 60 * 1000;
  const RESULT_QUIET_WINDOW_MS = 3500;
  let activeJob = null;
  const runAssetCache = new Map();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "PING") {
      const pageContext = detectPageContext();
      sendResponse({
        ok: true,
        url: location.href,
        inputFound: pageContext === "editor",
        pageContext,
        canCreateProject: pageContext === "project_list",
        activeRunId: activeJob?.runId || null,
        activeIndex: activeJob?.index ?? null
      });
      return false;
    }

    if (message?.type === "CREATE_PROJECT") {
      try {
        if (findPromptInput()) {
          sendResponse({ ok: true, clicked: false, inputFound: true });
          return false;
        }

        const newProjectControl = findNewProjectControl();
        if (!newProjectControl) {
          sendResponse({
            ok: false,
            error: "Không tìm thấy thẻ + Dự án mới trên màn hình danh sách dự án."
          });
          return false;
        }

        newProjectControl.scrollIntoView({ block: "center", inline: "center" });
        newProjectControl.click();
        sendResponse({ ok: true, clicked: true, inputFound: false });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
      return false;
    }

    if (message?.type === "GET_FLOW_IMAGES") {
      try {
        const items = collectFlowAssets();
        sendResponse({ ok: true, items });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
      return false;
    }

    if (message?.type === "SCRAPE_FLOW_PICKER") {
      // Open the + dialog, scrape items, close dialog, return structured list
      scrapeFlowPickerDialog()
        .then(items => sendResponse({ ok: true, items }))
        .catch(err => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }));
      return true; // async
    }

    if (message?.type === "CANCEL_PROMPT") {
      if (activeJob && (!message.runId || message.runId === activeJob.runId)) {
        activeJob.cancel();
      }
      if (message.runId) runAssetCache.delete(message.runId);
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "RUN_PROMPT") {
      if (!message.prompt || typeof message.prompt !== "string") {
        sendResponse({ ok: false, error: "Prompt không hợp lệ." });
        return false;
      }

      activeJob?.cancel();
      for (const cachedRunId of runAssetCache.keys()) {
        if (cachedRunId !== message.runId) runAssetCache.delete(cachedRunId);
      }
      if (Array.isArray(message.assets) && message.assets.length) {
        runAssetCache.set(message.runId, message.assets);
      }
      const job = createJob(message);
      activeJob = job;
      sendResponse({ ok: true });
      void runPromptJob(job);
      return false;
    }

    return false;
  });

  function createJob(message) {
    const cancelHandlers = new Set();
    const job = {
      runId: message.runId,
      index: Number(message.index),
      prompt: message.prompt,
      workflow: normalizeWorkflow(message.workflow),
      assets: runAssetCache.get(message.runId) || [],
      cancelled: false,
      onCancel(handler) {
        cancelHandlers.add(handler);
        return () => cancelHandlers.delete(handler);
      },
      cancel() {
        if (job.cancelled) return;
        job.cancelled = true;
        for (const handler of cancelHandlers) handler();
        cancelHandlers.clear();
      }
    };
    return job;
  }

  async function runPromptJob(job) {
    const heartbeat = setInterval(() => {
      sendMessage({ type: "CONTENT_HEARTBEAT", runId: job.runId, index: job.index });
    }, 20_000);

    try {
      log(job, "info", "Đang tìm ô nhập prompt trên Google Flow…");
      let input = await waitForElement(findPromptInput, 30_000, job);
      throwIfCancelled(job);

      input = await configureWorkflow(input, job);
      await attachWorkflowAssets(input, job);
      throwIfCancelled(job);

      input = await setFlowPrompt(input, job.prompt, job);
      log(job, "success", "Flow đã nhận prompt vào model nội bộ. Đang gửi yêu cầu tạo…");

      // Chụp danh sách media trước khi click để không nhầm ảnh/video cũ là kết quả mới.
      const baselineUrls = new Set(collectMedia().map((item) => item.url));
      await submitFlowPrompt(input, job);
      log(job, "info", "Đã kích hoạt Generate/Send. Đang chờ Google Flow xử lý…");

      if (job.workflow.mode === "agent") {
        void confirmAgentGeneration(job);
      }

      const media = await observeNewResults(baselineUrls, job);
      throwIfCancelled(job);

      sendMessage({
        type: "CONTENT_RESULT",
        runId: job.runId,
        index: job.index,
        media
      });
    } catch (error) {
      if (!job.cancelled) {
        sendMessage({
          type: "CONTENT_ERROR",
          runId: job.runId,
          index: job.index,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } finally {
      clearInterval(heartbeat);
      if (activeJob === job) activeJob = null;
    }
  }

  function findPromptInput() {
    const candidates = [];

    SELECTORS.promptInputs.forEach((selector, selectorIndex) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!isVisible(element) || element.matches(":disabled") || candidates.some((item) => item.element === element)) {
          return;
        }

        const rect = element.getBoundingClientRect();
        const searchableText = normalizeText([
          element.getAttribute("aria-label"),
          element.getAttribute("placeholder"),
          element.getAttribute("data-testid")
        ].filter(Boolean).join(" "));

        let score = 100 - selectorIndex * 8;
        if (element.tagName === "TEXTAREA") score += 18;
        if (element.getAttribute("data-slate-editor") === "true") score += 22;
        if (/prompt|describe|mô tả|mo ta/u.test(searchableText)) score += 35;
        if (rect.bottom > window.innerHeight * 0.5) score += 12;
        score += Math.min(20, Math.round((rect.width * rect.height) / 18_000));
        candidates.push({ element, score });
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.element || null;
  }

  function detectPageContext() {
    if (findPromptInput()) return "editor";
    if (findNewProjectControl()) return "project_list";
    return document.readyState === "loading" ? "loading" : "unknown";
  }

  function findNewProjectControl() {
    const candidates = [];

    SELECTORS.newProjectControls.forEach((selector, selectorIndex) => {
      document.querySelectorAll(selector).forEach((element) => {
        addProjectCandidate(candidates, element, 220 - selectorIndex * 8);
      });
    });

    // Dự phòng cho card React/Angular không có aria-label ổn định. Giới hạn
    // độ dài nhãn để không bao giờ chọn nhầm container chứa toàn bộ trang.
    document.querySelectorAll('button, a[href], [role="button"], [tabindex="0"]').forEach((element) => {
      const label = getButtonLabel(element);
      if (!label || label.length > 160 || !matchesNewProjectLabel(label)) return;

      let score = 120;
      if (NEW_PROJECT_LABELS.includes(label)) score += 80;
      if (label.startsWith("+") || label.startsWith("add")) score += 20;
      if (element.tagName === "BUTTON" || element.getAttribute("role") === "button") score += 15;
      addProjectCandidate(candidates, element, score);
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.element || null;
  }

  function addProjectCandidate(list, element, score) {
    if (!isVisible(element) || isDisabled(element) || list.some((item) => item.element === element)) return;
    const label = getButtonLabel(element);
    if (label.length > 160 || !matchesNewProjectLabel(label)) return;
    list.push({ element, score });
  }

  function matchesNewProjectLabel(label) {
    const normalized = normalizeText(label).replace(/^\+\s*/u, "");
    const exactSemanticMatch = NEW_PROJECT_LABELS.some((target) =>
      normalized === target || normalized.startsWith(`${target} `) || normalized.endsWith(` ${target}`)
    );
    const vietnameseMatch = normalized.includes("dự án") && normalized.includes("mới");
    const englishMatch = normalized.includes("project") && normalized.includes("new");
    return exactSemanticMatch || vietnameseMatch || englishMatch;
  }

  function findGenerateButton(input) {
    const scopes = buildSearchScopes(input);
    const scored = [];

    scopes.forEach((scope, scopeIndex) => {
      SELECTORS.generateButtons.forEach((selector, selectorIndex) => {
        scope.querySelectorAll(selector).forEach((element) => {
          addButtonCandidate(scored, element, 180 - scopeIndex * 12 - selectorIndex * 5);
        });
      });

      // Dự phòng theo text/aria-label. Có chú ý loại nút "Create with Google Flow"
      // ở landing page để tránh click nhầm khi chưa mở project.
      scope.querySelectorAll('button, [role="button"]').forEach((element) => {
        const label = getButtonLabel(element);
        const semanticMatch = GENERATE_WORDS.some((word) => label === word || label.startsWith(`${word} `));
        const iconMatch = SUBMIT_ICON_WORDS.some((word) => label === word || label.includes(word));
        if (semanticMatch || iconMatch) {
          if (!label.includes("with google flow")) {
            addButtonCandidate(scored, element, 120 - scopeIndex * 10 + (iconMatch ? 30 : 0));
          }
        }
      });
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.element || findPositionalSubmitButton(input, scopes);
  }

  function addButtonCandidate(list, element, score) {
    if (!isVisible(element) || isDisabled(element) || list.some((item) => item.element === element)) return;

    const label = getButtonLabel(element);
    if (label.includes("with google flow")) return;
    if (GENERATE_WORDS.some((word) => label.includes(word))) score += 35;
    if (SUBMIT_ICON_WORDS.some((word) => label.includes(word))) score += 45;
    if (element.getAttribute("type") === "submit") score += 12;
    list.push({ element, score });
  }

  function findPositionalSubmitButton(input, scopes = buildSearchScopes(input)) {
    const inputRect = input.getBoundingClientRect();
    const seen = new Set();
    const candidates = [];

    scopes.slice(0, 6).forEach((scope, scopeIndex) => {
      scope.querySelectorAll('button, [role="button"]').forEach((element) => {
        if (seen.has(element) || !isVisible(element) || isDisabled(element)) return;
        seen.add(element);

        const rect = element.getBoundingClientRect();
        const label = getButtonLabel(element);
        const isCompact = rect.width >= 20 && rect.height >= 20 && rect.width <= 88 && rect.height <= 88;
        const nearComposer = rect.top <= inputRect.bottom + 110 && rect.bottom >= inputRect.top - 55;
        const onRightSide = rect.left >= inputRect.left + inputRect.width * 0.55;
        if (!isCompact || !nearComposer || !onRightSide) return;
        if (/attach|upload|add|plus|agent|video|image|10s|settings|menu|more|mic|voice|close|cancel/u.test(label)) return;

        let score = 160 - scopeIndex * 16;
        score += Math.max(0, 80 - Math.abs(inputRect.right - rect.right) / 2);
        score += Math.max(0, 50 - Math.abs(inputRect.bottom - rect.bottom) / 2);
        if (Math.abs(rect.width - rect.height) <= 8) score += 25;
        if (SUBMIT_ICON_WORDS.some((word) => label.includes(word))) score += 80;
        candidates.push({ element, score });
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.element || null;
  }

  function buildSearchScopes(input) {
    const scopes = [];
    const form = input.closest("form");
    if (form) scopes.push(form);

    let parent = input.parentElement;
    for (let depth = 0; parent && depth < 6; depth += 1) {
      if (!scopes.includes(parent)) scopes.push(parent);
      parent = parent.parentElement;
    }

    scopes.push(document);
    return scopes;
  }

  function setInputValue(element, value) {
    element.focus();

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (setter) setter.call(element, value);
      else element.value = value;

      element.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: value
      }));
      element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      return;
    }

    if (element.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);

      const inserted = document.execCommand("insertText", false, value);
      if (!inserted || normalizeText(element.textContent) !== normalizeText(value)) {
        element.textContent = value;
      }

      element.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: value
      }));
      element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      selection?.removeAllRanges();
      return;
    }

    throw new Error("Đã tìm thấy phần tử nhưng không thể điền text. Hãy cập nhật SELECTORS.promptInputs.");
  }

  async function setFlowPrompt(input, prompt, job) {
    if (isSlateInput(input)) {
      try {
        const bridgeResult = await callFlowBridge("setText", { text: prompt }, job);
        const modelText = String(bridgeResult.modelText || "");
        const sample = prompt.slice(0, Math.min(40, prompt.length));
        if (sample && !modelText.includes(sample)) {
          throw new Error("Bridge trả về thành công nhưng model Slate chưa chứa prompt.");
        }
        log(job, "success", `Đã điền prompt qua React/Slate bridge (${bridgeResult.tier || "model"}).`);
        await delay(400);
        return findPromptInput() || input;
      } catch (error) {
        throwIfCancelled(job);
        log(job, "warning", `React/Slate bridge chưa dùng được: ${error instanceof Error ? error.message : String(error)}. Đang thử DOM fallback…`);
      }
    }

    setInputValue(input, prompt);
    await delay(350);
    const visibleText = input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
      ? input.value
      : input.textContent || "";
    const sample = normalizeText(prompt.slice(0, Math.min(40, prompt.length)));
    if (sample && !normalizeText(visibleText).includes(sample)) {
      throw new Error("Đã gửi sự kiện nhập nhưng ô prompt không giữ lại nội dung.");
    }
    log(job, "warning", "Đã điền prompt bằng DOM fallback; Flow có thể không cập nhật model React nếu giao diện vừa thay đổi.");
    return findPromptInput() || input;
  }

  async function submitFlowPrompt(input, job) {
    throwIfCancelled(job);
    let generateButton = await waitForSubmitButton(input, job, 5000);

    if (isSlateInput(input)) {
      try {
        const bridgeResult = await callFlowBridge("submit", {}, job);
        const candidate = bridgeResult.buttonLabel ? `, nút: ${bridgeResult.buttonLabel}` : "";
        log(job, "success", `Đã gửi prompt qua React/Slate bridge (${bridgeResult.tier || "submit"}${candidate}).`);
        await delay(500);
        return;
      } catch (error) {
        throwIfCancelled(job);
        log(job, "warning", `Bridge không gửi được: ${error instanceof Error ? error.message : String(error)}. Đang thử click DOM…`);
      }
    }

    generateButton ||= await waitForElement(() => findGenerateButton(input), 15_000, job);
    throwIfCancelled(job);
    const buttonLabel = getButtonLabel(generateButton) || "nút mũi tên bên phải composer";
    log(job, "info", `Đã nhận diện nút gửi DOM: ${truncateText(buttonLabel, 80)}.`);
    generateButton.scrollIntoView({ block: "center", inline: "nearest" });
    generateButton.click();
    await delay(400);
  }

  async function waitForSubmitButton(input, job, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      throwIfCancelled(job);
      const button = findGenerateButton(input);
      if (button) return button;
      await delay(250);
    }
    return null;
  }

  function isSlateInput(element) {
    return Boolean(
      element?.matches?.('[data-slate-editor="true"]') ||
      element?.closest?.('[data-slate-editor="true"]') ||
      element?.querySelector?.('[data-slate-editor="true"]')
    );
  }

  function callFlowBridge(action, detail, job) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        window.removeEventListener("message", handler);
        unregisterCancel?.();
      };
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      const handler = (event) => {
        if (
          event.source !== window ||
          event.data?.source !== "autoflow-flow-bridge-result" ||
          event.data.requestId !== requestId
        ) return;

        if (event.data.success) finish(() => resolve(event.data));
        else finish(() => reject(new Error(event.data.error || `Flow bridge lỗi khi chạy ${action}.`)));
      };

      window.addEventListener("message", handler);
      const timeoutTimer = setTimeout(() => {
        finish(() => reject(new Error(`Flow bridge không phản hồi lệnh ${action} sau 8 giây.`)));
      }, 8000);
      const unregisterCancel = job?.onCancel(() => {
        finish(() => reject(new Error("Tác vụ đã bị hủy.")));
      });

      window.postMessage({
        source: "autoflow-flow-bridge",
        requestId,
        action,
        ...detail
      }, "*");
    });
  }

  function normalizeWorkflow(value = {}) {
    return {
      mode: typeof value.mode === "string" ? value.mode : "text_to_video",
      model: typeof value.model === "string" ? value.model : "auto",
      aspectRatio: typeof value.aspectRatio === "string" ? value.aspectRatio : "auto",
      duration: typeof value.duration === "string" ? value.duration : "auto",
      outputCount: Math.min(4, Math.max(1, Number(value.outputCount) || 1))
    };
  }

  async function configureWorkflow(input, job) {
    const { mode, model, aspectRatio, duration, outputCount } = job.workflow;

    if (mode === "agent") {
      await setAgentEnabled(input, true, job);
      log(job, "info", "Đã chọn workflow Flow Agent.");
      return findPromptInput() || input;
    }

    await setAgentEnabled(input, false, job);

    if (mode === "extend_video") {
      const extendButton = findNamedControl(MODE_LABELS.extend_video, document, { exact: false });
      if (!extendButton) {
        throw new Error("Không tìm thấy nút Extend/Mở rộng. Hãy mở một video Veo trong Flow trước khi chạy.");
      }
      extendButton.click();
      await delay(500);
      log(job, "success", "Đã mở chế độ nối dài video.");
      return findPromptInput() || input;
    }

    const wantsVideo = ["text_to_video", "frames_to_video", "ingredients_to_video", "video_edit"].includes(mode);
    const baseLabels = wantsVideo ? ["Video"] : ["Image", "Hình ảnh"];
    const baseApplied = await chooseNamedOption(input, baseLabels);
    if (!baseApplied) {
      log(job, "warning", `Không xác nhận được chế độ ${wantsVideo ? "Video" : "Image"}; giữ cài đặt hiện tại của Flow.`);
    }

    if (mode === "frames_to_video" || mode === "ingredients_to_video") {
      const specialized = await chooseNamedOption(input, MODE_LABELS[mode]);
      if (!specialized) {
        log(job, "warning", `Chưa tìm thấy lựa chọn ${mode === "frames_to_video" ? "Frames" : "Ingredients"}; sẽ thử gắn tệp trực tiếp.`);
      }
    }

    const requestedModel = mode === "video_edit" && model === "auto" ? "omni_flash" : model;
    if (requestedModel !== "auto") {
      const modelApplied = await chooseNamedOption(input, MODEL_LABELS[requestedModel] || []);
      if (!modelApplied) log(job, "warning", `Không tự chọn được model ${requestedModel}; giữ model hiện tại của Flow.`);
    }

    if (aspectRatio !== "auto") {
      await applyPreference(input, ["aspect", "ratio", "tỷ lệ"], aspectRatio, job, "tỷ lệ");
    }
    if (duration !== "auto" && wantsVideo) {
      await applyPreference(input, ["duration", "length", "thời lượng"], duration, job, "thời lượng");
    }
    if (outputCount > 0) {
      await applyPreference(input, ["output", "results", "kết quả"], String(outputCount), job, "số kết quả");
    }

    return findPromptInput() || input;
  }

  async function setAgentEnabled(input, enabled, job) {
    const scopes = buildSearchScopes(input);
    let toggle = null;
    for (const scope of scopes) {
      for (const selector of SELECTORS.agentToggles) {
        toggle = [...scope.querySelectorAll(selector)].find((element) => isVisible(element) && !isDisabled(element));
        if (toggle) break;
      }
      if (toggle) break;
    }

    if (!toggle) {
      if (enabled) log(job, "warning", "Không tìm thấy nút Agent; giữ trạng thái Agent hiện tại của Flow.");
      return false;
    }

    const pressed = toggle.getAttribute("aria-pressed") === "true" || toggle.getAttribute("data-state") === "on";
    if (pressed !== enabled) {
      toggle.click();
      await delay(350);
    }
    return true;
  }

  async function chooseNamedOption(input, labels) {
    if (!labels?.length) return false;

    const scopes = buildSearchScopes(input);
    const alreadySelected = scopes
      .map((scope) => findNamedControl(labels, scope, { selectedOnly: true }))
      .find(Boolean);
    if (alreadySelected) return true;

    const settingsTrigger = findSettingsTrigger(input);
    if (settingsTrigger) {
      const triggerLabel = getButtonLabel(settingsTrigger);
      const normalizedLabels = labels.map(normalizeText);
      const alreadyShownBySummary = normalizedLabels.some((target) =>
        triggerLabel === target || triggerLabel.startsWith(`${target} `) || triggerLabel.startsWith(`${target} ·`)
      );
      if (alreadyShownBySummary) return true;

      settingsTrigger.click();
      await delay(350);
      const menuOption = findNamedControl(labels, document, { exact: true }) ||
        findNamedControl(labels, document, { exact: false });
      if (menuOption && menuOption !== settingsTrigger) {
        menuOption.click();
        await delay(450);
        return true;
      }
    }

    for (const scope of scopes) {
      const direct = findNamedControl(labels, scope, { exact: true });
      if (direct && direct !== settingsTrigger) {
        direct.click();
        await delay(300);
        return true;
      }
    }
    return false;
  }

  function findSettingsTrigger(input) {
    const scopes = buildSearchScopes(input);
    const inputRect = input.getBoundingClientRect();
    const seen = new Set();
    const scored = [];

    scopes.forEach((scope, scopeIndex) => {
      for (const selector of SELECTORS.settingsTriggers) {
        scope.querySelectorAll(selector).forEach((element) => addSettingsTriggerCandidate(element, scopeIndex));
      }
      scope.querySelectorAll('button, [role="button"]').forEach((element) => addSettingsTriggerCandidate(element, scopeIndex));
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.element || null;

    function addSettingsTriggerCandidate(element, scopeIndex) {
      if (seen.has(element) || !isVisible(element) || isDisabled(element)) return;
      seen.add(element);

      const label = getButtonLabel(element);
      const rect = element.getBoundingClientRect();
      const hasModeSummary = /(^|\s|·)(video|image|hình ảnh)(\s|·|$)/u.test(label);
      const hasModelSummary = /veo|nano|omni|model|generation/u.test(label);
      const hasGenerationValues = /(^|\s|·)\d+(?:s|x)(\s|·|$)|\d+\s*:\s*\d+/u.test(label);
      const hasPopup = ["menu", "listbox", "dialog"].includes(element.getAttribute("aria-haspopup"));
      if (!hasModeSummary && !hasModelSummary && !hasGenerationValues && !hasPopup) return;
      if (/generate|send|submit|arrow|create|tạo|gửi/u.test(label) && !hasModeSummary) return;

      let score = 120 - scopeIndex * 14;
      if (hasModeSummary) score += 110;
      if (hasModelSummary) score += 75;
      if (hasGenerationValues) score += 85;
      if (hasPopup) score += 25;
      if (rect.top <= inputRect.bottom + 120 && rect.bottom >= inputRect.top - 80) score += 55;
      scored.push({ element, score });
    }
  }

  function findNamedControl(labels, scope = document, options = {}) {
    const normalizedLabels = labels.map(normalizeText);
    const candidates = [...scope.querySelectorAll('button, [role="button"], [role="menuitem"], [role="option"], [role="radio"]')]
      .filter((element) => isVisible(element) && !isDisabled(element))
      .filter((element) => {
        if (!options.selectedOnly) return true;
        return element.getAttribute("aria-pressed") === "true" ||
          element.getAttribute("aria-selected") === "true" ||
          element.getAttribute("aria-checked") === "true" ||
          ["on", "selected", "checked"].includes(element.getAttribute("data-state"));
      });

    return candidates.find((element) => {
      const label = getButtonLabel(element);
      return normalizedLabels.some((target) => options.exact === false ? label.includes(target) : label === target || label.startsWith(`${target} `));
    }) || null;
  }

  async function applyPreference(input, tokens, value, job, displayName) {
    const scopes = buildSearchScopes(input);

    for (const scope of scopes) {
      const select = [...scope.querySelectorAll("select")].find((element) => {
        const context = normalizeText(`${element.getAttribute("aria-label") || ""} ${element.getAttribute("name") || ""} ${element.closest("label")?.textContent || ""}`);
        return tokens.some((token) => context.includes(normalizeText(token)));
      });
      if (!select) continue;

      const option = [...select.options].find((item) => item.value === value || normalizeText(item.textContent).startsWith(normalizeText(value)));
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        return true;
      }
    }

    const semanticTrigger = scopes
      .flatMap((scope) => [...scope.querySelectorAll('button, [role="button"]')])
      .find((element) => {
        if (!isVisible(element) || isDisabled(element)) return false;
        const label = getButtonLabel(element);
        return tokens.some((token) => label.includes(normalizeText(token)));
      });

    const trigger = semanticTrigger || findSettingsTrigger(input);
    if (trigger) {
      trigger.click();
      await delay(300);
      const optionLabels = displayName === "số kết quả"
        ? [`${value}x`, `${value} output`, `${value} outputs`, `${value} kết quả`, value]
        : [value, `${value}s`, `${value} seconds`, `${value} giây`];
      const option = findNamedControl(optionLabels, document, { exact: true });
      if (option) {
        option.click();
        await delay(200);
        return true;
      }
    }

    log(job, "warning", `Không tự đặt được ${displayName} ${value}; giữ cài đặt Flow hiện tại.`);
    return false;
  }

  async function attachWorkflowAssets(input, job) {
    if (!job.assets.length) return;

    // Split: flow-library assets (use Flow's native + picker) vs upload (dataUrl)
    const nativeAssets = job.assets.filter(a =>
      a.source === "flow-library" && (a.flowItemName || a.flowUrl)
    );
    const uploadAssets = job.assets.filter(a =>
      a.source !== "flow-library" && a.dataUrl
    );

    if (nativeAssets.length > 0) {
      // Pass full asset objects so attachAssetsViaFlowPicker can read flowItemName
      const attached = await attachAssetsViaFlowPicker(nativeAssets, job);
      if (!attached) {
        log(job, "warning", "Không chọn được ảnh qua nút + của Flow. Kiểm tra tên ảnh trong log.");
      }
    }

    if (uploadAssets.length > 0) {
      const uploadJob = { ...job, assets: uploadAssets };
      if (areAssetsAlreadyAttached(input, uploadAssets)) {
        log(job, "info", "Tệp tham chiếu đã có trong prompt, không tải trùng.");
      } else {
        const roleOrder = ["start_frame", "end_frame", "ingredient", "source_image", "source_video", "agent_reference"];
        for (const role of roleOrder) {
          const assets = uploadAssets.filter((asset) => asset.role === role);
          if (!assets.length) continue;
          await uploadAssetGroup(input, role, assets, uploadJob);
        }
      }
    }
  }

  /**
   * Use Flow's native + button to select existing project assets by name.
   * Matches items in the picker by their display name (more reliable than URL matching).
   * @param {Array<{flowItemName:string, flowUrl?:string}>} assets
   */
  async function attachAssetsViaFlowPicker(assets, job) {
    const names = assets.map(a => a.flowItemName || a.name || "").filter(Boolean);
    log(job, "info", `Đang chọn ${names.length} tài nguyên từ thư viện Flow qua nút +…`);

    // Find the + button (aria-haspopup="dialog")
    const addBtn = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
      .find(btn => {
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

    if (!addBtn) {
      log(job, "warning", "Không tìm thấy nút + (aria-haspopup=dialog) trong giao diện Flow.");
      return false;
    }

    // Open picker if not already open
    if (addBtn.getAttribute("aria-expanded") !== "true") {
      addBtn.click();
      await delay(700);
    }

    // Find the dialog/panel
    const dialogId = addBtn.getAttribute("aria-controls");
    let dialog = dialogId ? document.getElementById(dialogId) : null;
    if (!dialog) {
      dialog = document.querySelector('[role="listbox"]:not([hidden]), [role="dialog"]:not([hidden])');
    }

    if (!dialog) {
      log(job, "warning", "Picker của Flow không mở được sau khi click +.");
      return false;
    }

    await delay(400); // wait for items to render

    const options = [...dialog.querySelectorAll('[role="option"]')];
    if (!options.length) {
      log(job, "warning", `Picker mở nhưng không có mục nào (${dialog.id || dialog.className}).`);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    log(job, "info", `Picker mở với ${options.length} mục. Đang khớp tên…`);

    let selectedCount = 0;
    for (const targetName of names) {
      const norm = targetName.toLowerCase().trim();

      // Match by text content of the option
      const match = options.find(opt => {
        const spans = [...opt.querySelectorAll("p, span")].filter(el => el.textContent.trim());
        const optName = (spans[0]?.textContent || opt.textContent || "").trim().toLowerCase();
        return optName === norm || optName.startsWith(norm.substring(0, 20));
      });

      if (match) {
        if (match.getAttribute("aria-selected") !== "true") {
          match.click();
          await delay(300);
        }
        selectedCount++;
        log(job, "info", `Đã chọn: "${targetName}"`);
      } else {
        log(job, "warning", `Không tìm thấy mục "${targetName}" trong picker Flow.`);
      }
    }

    if (selectedCount === 0) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    // Click confirm — Flow uses "Thêm vào câu lệnh" (Add to prompt)
    await delay(200);
    const confirmBtn =
      findNamedControl(
        ["Thêm vào câu lệnh", "Add to prompt", "Thêm", "Add", "Done", "Xong", "Confirm", "Xác nhận"],
        dialog, { exact: false }
      ) ||
      [...dialog.querySelectorAll("button")].find(b => {
        const lbl = (b.textContent || "").trim().toLowerCase();
        return lbl && !["cancel", "hủy", "close", "đóng"].some(w => lbl.includes(w));
      });

    if (confirmBtn && !confirmBtn.disabled) {
      confirmBtn.scrollIntoView({ block: "nearest" });
      confirmBtn.click();
      await delay(500);
      log(job, "success", `Đã thêm ${selectedCount} tài nguyên từ thư viện Flow vào câu lệnh.`);
    } else {
      log(job, "info", `Đã chọn ${selectedCount} mục (không cần nút xác nhận).`);
    }

    return selectedCount > 0;
  }


  async function uploadAssetGroup(input, role, assets, job) {
    const buttonLabels = {
      start_frame: ["Add start frame", "Start frame", "Thêm khung hình đầu"],
      end_frame: ["Add end frame", "End frame", "Thêm khung hình cuối"],
      ingredient: ["Add image", "Add media", "Ingredients", "References", "Thêm hình ảnh"],
      source_image: ["Add image", "Upload image", "Thêm hình ảnh", "Tải ảnh lên"],
      source_video: ["Add video", "Upload video", "Thêm video", "Tải video lên"],
      agent_reference: ["Add media", "Add image", "Upload", "Thêm tệp"]
    }[role] || ["Upload"];

    const control = findNamedControl(buttonLabels, buildSearchScopes(input).at(-2) || document, { exact: false }) ||
      findNamedControl(buttonLabels, document, { exact: false });
    if (control) {
      control.click();
      await delay(250);
    }

    const fileInput = findBestFileInput(role, buttonLabels);
    if (!fileInput) {
      throw new Error(`Không tìm thấy input tải tệp cho ${buttonLabels[0]}. Hãy cập nhật SELECTORS.fileInputs trong content.js.`);
    }

    const files = assets.map(dataUrlAssetToFile);
    if (files.length > 1 && !fileInput.multiple) {
      for (const file of files) {
        setFilesOnInput(fileInput, [file]);
        await delay(900);
      }
    } else {
      setFilesOnInput(fileInput, files);
      await delay(1200);
    }
    log(job, "success", `Đã gắn ${files.length} tệp: ${files.map((file) => file.name).join(", ")}`);
  }

  function findBestFileInput(role, labels) {
    const unique = new Set();
    SELECTORS.fileInputs.forEach((selector) => document.querySelectorAll(selector).forEach((element) => unique.add(element)));
    const wantsVideo = role === "source_video";
    const wantsImage = ["start_frame", "end_frame", "source_image"].includes(role);

    const scored = [...unique]
      .filter((element) => !isDisabled(element))
      .map((element, index) => {
        const accept = normalizeText(element.getAttribute("accept"));
        const context = normalizeText(element.parentElement?.textContent || "");
        let score = index;
        if (wantsVideo && accept.includes("video")) score += 100;
        if (wantsImage && accept.includes("image")) score += 100;
        if (!wantsVideo && !wantsImage && (accept.includes("image") || accept.includes("video"))) score += 40;
        if (labels.some((label) => context.includes(normalizeText(label)))) score += 80;
        return { element, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.element || null;
  }

  function dataUrlAssetToFile(asset) {
    const [header, encoded = ""] = asset.dataUrl.split(",", 2);
    const mime = header.match(/^data:([^;]+)/u)?.[1] || asset.type || "application/octet-stream";
    const binary = header.includes(";base64") ? atob(encoded) : decodeURIComponent(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new File([bytes], asset.name, { type: mime, lastModified: Date.now() });
  }

  function setFilesOnInput(input, files) {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function areAssetsAlreadyAttached(input, assets) {
    const composerText = normalizeText(buildSearchScopes(input).slice(0, 6).map((scope) => scope.textContent || "").join(" "));
    return assets.every((asset) => composerText.includes(normalizeText(asset.name)));
  }

  async function confirmAgentGeneration(job) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && !job.cancelled) {
      const confirmation = findNamedControl(["Confirm", "Xác nhận", "Continue", "Tiếp tục"], document, { exact: true });
      if (confirmation) {
        confirmation.click();
        log(job, "info", "Đã xác nhận yêu cầu tạo media của Flow Agent.");
        return;
      }
      await delay(500);
    }
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function observeNewResults(baselineUrls, job) {
    return new Promise((resolve, reject) => {
      const found = new Map();
      const startedAt = Date.now();
      let lastNewResultAt = 0;
      let firstResultAt = 0;
      let loadingSeen = hasVisibleLoadingIndicator();
      let settled = false;

      const cleanup = () => {
        observer.disconnect();
        clearInterval(checkTimer);
        clearTimeout(timeoutTimer);
        unregisterCancel();
      };

      const finish = (callback) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const scan = () => {
        if (job.cancelled) {
          finish(() => reject(new Error("Tác vụ đã bị hủy.")));
          return;
        }

        const loadingNow = hasVisibleLoadingIndicator();
        loadingSeen ||= loadingNow;

        for (const item of collectMedia()) {
          if (baselineUrls.has(item.url) || found.has(item.url)) continue;
          found.set(item.url, item);
          lastNewResultAt = Date.now();
          firstResultAt ||= lastNewResultAt;
        }

        if (!found.size) return;

        const quietLongEnough = Date.now() - lastNewResultAt >= RESULT_QUIET_WINDOW_MS;
        const loaderFinished = loadingSeen && !loadingNow;
        const noLoaderFallback = !loadingSeen && Date.now() - startedAt >= 5000;
        const loaderTimeoutFallback = firstResultAt && Date.now() - firstResultAt >= 15_000;

        if (quietLongEnough && (loaderFinished || noLoaderFallback || loaderTimeoutFallback)) {
          finish(() => resolve([...found.values()]));
        }
      };

      const observer = new MutationObserver(scan);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["src", "href", "class", "aria-busy"]
      });

      const checkTimer = setInterval(scan, 1000);
      const timeoutTimer = setTimeout(() => {
        finish(() => reject(new Error(
          `Quá ${Math.round(MAX_RESULT_WAIT_MS / 60_000)} phút nhưng chưa phát hiện ảnh/video mới. ` +
          "Hãy cập nhật SELECTORS.loadingIndicators và SELECTORS.resultMedia trong content.js."
        )));
      }, MAX_RESULT_WAIT_MS);
      const unregisterCancel = job.onCancel(() => {
        finish(() => reject(new Error("Tác vụ đã bị hủy.")));
      });

      scan();
    });
  }

  function collectMedia() {
    const results = new Map();

    for (const selector of SELECTORS.resultMedia) {
      document.querySelectorAll(selector).forEach((element) => {
        const descriptor = mediaDescriptor(element);
        if (descriptor && !results.has(descriptor.url)) {
          results.set(descriptor.url, descriptor);
        }
      });
    }

    return [...results.values()];
  }

  /**
   * Thu thập ảnh/video kết quả của Flow để hiển thị trong picker.
   * Chỉ lấy ảnh đủ lớn (min 400px × 200px) và nằm trong vùng nội dung
   * chính, không phải sidebar/nav/icon.
   */
  function collectFlowAssets() {
    const seen = new Set();
    const items = [];

    // Các container cần bỏ qua (nav top, browser chrome)
    const SKIP_SELECTORS = [
      "header", "footer",
      "[role='banner']",
      "[aria-label*='toolbar' i]"
    ];

    function isInSkipContainer(el) {
      return SKIP_SELECTORS.some((sel) => {
        try { return el.closest(sel) !== null; } catch { return false; }
      });
    }

    // ── PASS 1: Ảnh kết quả lớn trong grid output ─────────────────
    document.querySelectorAll("img[src]").forEach((el) => {
      if (isInSkipContainer(el)) return;

      const url = el.currentSrc || el.src || "";
      if (!url || seen.has(url)) return;
      if (/^(chrome-extension:|data:)/iu.test(url)) return;

      const w = el.naturalWidth || el.getBoundingClientRect().width || el.width || 0;
      const h = el.naturalHeight || el.getBoundingClientRect().height || el.height || 0;

      const maxDim = Math.max(w, h);
      const minDim = Math.min(w, h);
      if (maxDim < 400 || minDim < 200) return;

      const label = `${el.alt || ""} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("class") || ""}`.toLowerCase();
      if (/avatar|logo|icon|profile|emoji|thumbnail|thumb|favicon/u.test(label)) return;

      seen.add(url);
      // Try to get a display label from surrounding text
      const caption = el.closest("[aria-label]")?.getAttribute("aria-label")
        || el.alt
        || "";
      items.push({ url, kind: "image", width: w, height: h, label: caption || "Ảnh kết quả" });
    });

    // ── PASS 2: Video kết quả ──────────────────────────────────────
    document.querySelectorAll("video").forEach((el) => {
      if (isInSkipContainer(el)) return;
      const url = el.currentSrc || el.src || "";
      if (!url || seen.has(url) || /^chrome-extension:/iu.test(url)) return;
      // Find nearby label (aria-label on container, or title text)
      const caption = el.closest("[aria-label]")?.getAttribute("aria-label")
        || el.getAttribute("aria-label")
        || el.title
        || "";
      seen.add(url);
      items.push({ url, kind: "video", width: el.videoWidth || 0, height: el.videoHeight || 0, label: caption || "Video kết quả" });
    });

    // ── PASS 3: Thư viện nhân vật / ảnh / video trong panel bên trái ──
    // Flow's asset library items are typically <li> or card elements containing
    // a small thumbnail img and a text label. We look for list-item containers
    // that have both an img and sibling text, anywhere in a scrollable panel/aside/dialog.
    const LIBRARY_CONTAINER_SELECTORS = [
      "[role='listbox']",
      "[role='list']",
      "[role='dialog']",
      "aside",
      "[class*='library' i]",
      "[class*='panel' i]",
      "[class*='drawer' i]",
      "[class*='sidebar' i]",
      "[class*='asset' i]",
      "[class*='component' i]",
      "[class*='picker' i]"
    ];

    const LIBRARY_ITEM_SELECTORS = [
      "[role='listitem']",
      "[role='option']",
      "li",
      "[class*='item' i]",
      "[class*='card' i]",
      "[class*='thumbnail' i]",
      "[class*='chip' i]"
    ];

    // Find all candidate library containers (not in skip containers)
    const libraryContainers = new Set();
    LIBRARY_CONTAINER_SELECTORS.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (!isInSkipContainer(el)) libraryContainers.add(el);
        });
      } catch { /* ignore invalid selectors */ }
    });

    libraryContainers.forEach(container => {
      // Find items within this container
      LIBRARY_ITEM_SELECTORS.forEach(itemSel => {
        try {
          container.querySelectorAll(itemSel).forEach(item => {
            // Each item should have an img with a usable src
            const img = item.querySelector("img[src]");
            if (!img) return;
            const url = img.currentSrc || img.src || "";
            if (!url || seen.has(url)) return;
            if (/^(chrome-extension:|data:)/iu.test(url)) return;

            // Size check: library thumbnails can be small (≥32px) but must exist
            const w = img.naturalWidth || img.getBoundingClientRect().width || img.width || 0;
            const h = img.naturalHeight || img.getBoundingClientRect().height || img.height || 0;
            if (Math.max(w, h) < 32) return; // definitely just an icon

            // Extract a meaningful label from the item's text content
            const textContent = (item.textContent || "").trim().replace(/\s+/g, " ");
            // Prefer aria-label on img or container, then text
            const label = img.getAttribute("aria-label")
              || item.getAttribute("aria-label")
              || item.querySelector("[class*='name' i], [class*='title' i], [class*='label' i]")?.textContent?.trim()
              || textContent.slice(0, 60)
              || "Thư viện";

            // Skip generic icons based on label
            const lbl = label.toLowerCase();
            if (/^(avatar|logo|icon|emoji|favicon)$/u.test(lbl)) return;

            seen.add(url);
            items.push({ url, kind: "image", width: w, height: h, label, source: "library" });
          });
        } catch { /* ignore */ }
      });
    });

    // ── PASS 4: Scrape src từ <img> nhỏ có data-* hoặc aria-* gợi ý asset ──
    // Những ảnh tham chiếu nhân vật thường có aria-label hoặc data attribute
    document.querySelectorAll("img[aria-label], img[data-name], img[data-label], img[title]").forEach(img => {
      if (isInSkipContainer(img)) return;
      const url = img.currentSrc || img.src || "";
      if (!url || seen.has(url)) return;
      if (/^(chrome-extension:|data:)/iu.test(url)) return;

      const w = img.naturalWidth || img.getBoundingClientRect().width || img.width || 0;
      const h = img.naturalHeight || img.getBoundingClientRect().height || img.height || 0;
      if (Math.max(w, h) < 32) return;

      const label = img.getAttribute("aria-label")
        || img.getAttribute("data-name")
        || img.getAttribute("data-label")
        || img.title
        || "";
      if (!label) return; // only include if it has an explicit label (meaningful asset)

      seen.add(url);
      items.push({ url, kind: "image", width: w, height: h, label, source: "labeled" });
    });

    return items;
  }

  /**
   * Opens Flow's native + button picker dialog, scrapes all available assets
   * (name, type, thumbnail URL), closes the dialog, and returns the list.
   * These items can then be shown in the sidepanel picker for the user to select.
   */
  async function scrapeFlowPickerDialog() {
    // Find the + button (aria-haspopup="dialog", small button near chat bar)
    const addBtn = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
      .find(btn => {
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

    if (!addBtn) throw new Error("Không tìm thấy nút + trong giao diện Flow. Hãy mở một dự án Flow.");

    // Open the picker
    const wasExpanded = addBtn.getAttribute("aria-expanded") === "true";
    if (!wasExpanded) {
      addBtn.click();
      await new Promise(r => setTimeout(r, 700));
    }

    // Find the opened dialog/panel (aria-controls points to its ID)
    const dialogId = addBtn.getAttribute("aria-controls");
    let dialog = dialogId ? document.getElementById(dialogId) : null;
    if (!dialog) {
      // Fallback: find any recently-opened listbox/dialog
      dialog = document.querySelector('[role="listbox"]:not([hidden]), [role="dialog"]:not([hidden])');
    }

    if (!dialog) {
      throw new Error("Picker của Flow không mở được.");
    }

    await new Promise(r => setTimeout(r, 300));

    // Scrape all option items
    const items = [];
    const seen = new Set();

    dialog.querySelectorAll('[role="option"]').forEach((opt, idx) => {
      // Thumbnail image
      const img = opt.querySelector("img");
      const thumbUrl = img?.currentSrc || img?.src || null;

      // Name: try multiple selectors common in Flow's UI
      const nameEl = opt.querySelector(
        "p, span:not([class*='icon' i]):not([class*='badge' i]), [class*='name' i], [class*='title' i], [class*='label' i]"
      );
      // Type label (usually second text node)
      const allSpans = [...opt.querySelectorAll("p, span")].filter(el => el.textContent.trim());
      const nameText = allSpans[0]?.textContent?.trim() || `Mục ${idx + 1}`;
      const typeText = allSpans[1]?.textContent?.trim() || "";

      const isVideo = typeText.toLowerCase().includes("video") || opt.querySelector("video") !== null;
      const uniqueKey = `${nameText}_${idx}`;

      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      items.push({
        idx,
        name: nameText,
        type: typeText || (isVideo ? "Video" : "Hình ảnh"),
        kind: isVideo ? "video" : "image",
        thumbUrl,
        // Store the full text content as label (for matching later)
        label: nameText
      });
    });

    // Close the dialog if we opened it
    if (!wasExpanded) {
      // Press Escape or click outside to close
      const escEvent = new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, cancelable: true });
      document.dispatchEvent(escEvent);
      await new Promise(r => setTimeout(r, 300));
      // If still open, click the button again to toggle
      if (addBtn.getAttribute("aria-expanded") === "true") {
        addBtn.click();
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return items;
  }


  function mediaDescriptor(element) {
    const mediaElement = element.tagName === "SOURCE" ? element.closest("video") || element : element;

    const tagName = mediaElement.tagName;
    const kind = tagName === "VIDEO" || element.tagName === "SOURCE" || /\.(mp4|webm|mov)(?:[?#]|$)/iu.test(element.href || "")
      ? "video"
      : "image";

    let url = mediaElement.currentSrc || mediaElement.src || element.src || element.href || "";

    // Nếu media nằm trong link tải trực tiếp, href thường ổn định hơn blob src.
    const link = mediaElement.closest?.("a[href]");
    if (link?.href && /\.(mp4|webm|mov|png|jpe?g|webp)(?:[?#]|$)/iu.test(link.href)) {
      url = link.href;
    }

    if (!url || /^(chrome-extension:|data:image\/svg)/iu.test(url)) return null;

    if (kind === "image" && tagName === "IMG") {
      const rect = mediaElement.getBoundingClientRect();
      const width = mediaElement.naturalWidth || rect.width;
      const height = mediaElement.naturalHeight || rect.height;
      const label = normalizeText(`${mediaElement.alt || ""} ${mediaElement.getAttribute("aria-label") || ""}`);

      // Loại avatar/icon/logo mới xuất hiện trong quá trình render.
      if ((width < 180 || height < 180) && width * height < 60_000) return null;
      if (/avatar|logo|icon|profile|emoji/u.test(label) && width < 512) return null;
    }

    return { url, kind };
  }

  function hasVisibleLoadingIndicator() {
    return SELECTORS.loadingIndicators.some((selector) =>
      [...document.querySelectorAll(selector)].some(isVisible)
    );
  }

  function waitForElement(finder, timeoutMs, job) {
    return new Promise((resolve, reject) => {
      const initial = finder();
      if (initial) {
        resolve(initial);
        return;
      }

      let settled = false;
      const cleanup = () => {
        observer.disconnect();
        clearTimeout(timeoutTimer);
        unregisterCancel();
      };
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const observer = new MutationObserver(() => {
        const element = finder();
        if (element) finish(() => resolve(element));
      });
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });

      const timeoutTimer = setTimeout(() => {
        finish(() => reject(new Error(
          "Không tìm thấy ô prompt hoặc nút Generate/Tạo. Hãy cập nhật khối SELECTORS ở đầu content.js."
        )));
      }, timeoutMs);
      const unregisterCancel = job.onCancel(() => {
        finish(() => reject(new Error("Tác vụ đã bị hủy.")));
      });
    });
  }

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  }

  function isDisabled(element) {
    return Boolean(
      element.matches(":disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.hasAttribute("disabled")
    );
  }

  function getButtonLabel(element) {
    return normalizeText([
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.getAttribute("aria-description"),
      element.textContent
    ].filter(Boolean).join(" "));
  }

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/gu, " ").toLowerCase();
  }

  function truncateText(value, maxLength) {
    const text = String(value || "");
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function throwIfCancelled(job) {
    if (job.cancelled) throw new Error("Tác vụ đã bị hủy.");
  }

  function log(job, level, message) {
    sendMessage({ type: "CONTENT_LOG", runId: job.runId, index: job.index, level, message });
  }

  function sendMessage(message) {
    try {
      chrome.runtime.sendMessage(message, () => {
        // Đọc lastError để Chrome không in cảnh báo khi service worker vừa ngủ/reload.
        void chrome.runtime.lastError;
      });
    } catch {
      // Extension có thể vừa được reload trong lúc trang vẫn mở.
    }
  }
})();
