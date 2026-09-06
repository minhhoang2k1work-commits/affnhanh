"use strict";

/**
 * Google Flow dùng Slate/React cho ô prompt. Content script thông thường chạy
 * trong isolated world nên không truy cập được React Fiber/Slate editor. File
 * này chạy ở MAIN world và chỉ nhận ba lệnh nội bộ qua window.postMessage:
 * ping, setText và submit.
 */
(() => {
  if (globalThis.__autoFlowMainWorldBridgeLoaded) return;
  globalThis.__autoFlowMainWorldBridgeLoaded = true;

  const REQUEST_SOURCE = "autoflow-flow-bridge";
  const RESULT_SOURCE = "autoflow-flow-bridge-result";
  const SLATE_SELECTOR = '[data-slate-editor="true"]';
  const SUBMIT_WORDS = ["generate", "create", "send", "tạo", "gửi", "submit"];

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== REQUEST_SOURCE || !event.data.requestId) return;

    const { action, requestId } = event.data;
    try {
      if (action === "ping") {
        reply(requestId, true, { editorFound: Boolean(findSlateEditor()?.editor) });
        return;
      }

      const result = findSlateEditor();
      if (!result?.editor || !result.element) {
        reply(requestId, false, { error: "Không tìm thấy Slate editor/React model của Google Flow." });
        return;
      }

      if (action === "setText") {
        const text = String(event.data.text || "");
        const tier = setSlateText(result.editor, result.element, text);
        if (!tier) {
          reply(requestId, false, { error: "Slate editor không chấp nhận nội dung prompt." });
          return;
        }
        reply(requestId, true, { tier, modelText: readEditorText(result.editor) });
        return;
      }

      if (action === "submit") {
        const submitResult = submitSlatePrompt(result.editor, result.element);
        if (!submitResult) {
          reply(requestId, false, { error: "Không kích hoạt được nút Generate/Send của Google Flow." });
          return;
        }
        reply(requestId, true, submitResult);
        return;
      }

      reply(requestId, false, { error: `Lệnh bridge không được hỗ trợ: ${action}` });
    } catch (error) {
      reply(requestId, false, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  function reply(requestId, success, detail = {}) {
    window.postMessage({ source: RESULT_SOURCE, requestId, success, ...detail }, "*");
  }

  function findSlateEditor() {
    const elements = [...document.querySelectorAll(SLATE_SELECTOR)];
    for (const element of elements) {
      const fiberKey = Object.keys(element).find((key) =>
        key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")
      );
      if (!fiberKey) continue;

      let fiber = element[fiberKey];
      let depth = 0;
      while (fiber && depth < 80) {
        const fromContext = editorFromContexts(fiber.dependencies?.firstContext);
        if (fromContext) return { editor: fromContext, element };

        const fromHooks = editorFromHooks(fiber.memoizedState);
        if (fromHooks) return { editor: fromHooks, element };

        for (const value of [fiber.memoizedProps, fiber.pendingProps, fiber.stateNode]) {
          const editor = unwrapEditor(value);
          if (editor) return { editor, element };
        }

        fiber = fiber.return;
        depth += 1;
      }
    }
    return null;
  }

  function editorFromContexts(context) {
    let current = context;
    let depth = 0;
    while (current && depth < 30) {
      const editor = unwrapEditor(current.memoizedValue);
      if (editor) return editor;
      current = current.next;
      depth += 1;
    }
    return null;
  }

  function editorFromHooks(hook) {
    let current = hook;
    let depth = 0;
    while (current && depth < 80) {
      const editor = unwrapEditor(current.memoizedState);
      if (editor) return editor;
      current = current.next;
      depth += 1;
    }
    return null;
  }

  function unwrapEditor(value) {
    if (isSlateEditor(value)) return value;
    if (isSlateEditor(value?.current)) return value.current;
    if (isSlateEditor(value?.editor)) return value.editor;
    return null;
  }

  function isSlateEditor(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      Array.isArray(value.children) &&
      typeof value.apply === "function" &&
      (typeof value.insertText === "function" || typeof value.insertData === "function")
    );
  }

  function setSlateText(editor, element, text) {
    clearSlateEditor(editor);
    if (readEditorText(editor).trim()) return null;

    const end = getEdgePoint(editor, "end");
    editor.selection = { anchor: end, focus: end };

    const methods = [
      ["insertText", () => editor.insertText(text)],
      ["apply", () => editor.apply({ type: "insert_text", path: end.path, offset: end.offset, text })],
      ["insertData", () => {
        if (typeof editor.insertData !== "function") return false;
        const transfer = new DataTransfer();
        transfer.setData("text/plain", text);
        editor.insertData(transfer);
        return true;
      }]
    ];

    for (const [name, method] of methods) {
      try {
        if (method() === false) continue;
        editor.onChange?.();
        const modelText = readEditorText(editor);
        if (!text || modelText.includes(text.slice(0, Math.min(40, text.length)))) {
          element.focus();
          queueMicrotask(() => {
            try {
              element.blur();
              element.focus();
            } catch {
              // Không ảnh hưởng model Slate đã cập nhật.
            }
          });
          return name;
        }
      } catch {
        // Thử tầng tiếp theo.
      }
    }
    return null;
  }

  function clearSlateEditor(editor) {
    if (!readEditorText(editor).trim()) return true;

    try {
      const start = getEdgePoint(editor, "start");
      const end = getEdgePoint(editor, "end");
      editor.selection = { anchor: start, focus: end };
      if (typeof editor.deleteFragment === "function") {
        editor.deleteFragment();
        editor.onChange?.();
      }
    } catch {
      // Việc xác minh phía dưới quyết định có thể tiếp tục hay không.
    }
    return !readEditorText(editor).trim();
  }

  function getEdgePoint(editor, edge) {
    const path = [];
    let node = { children: editor.children };
    while (Array.isArray(node.children) && node.children.length) {
      const index = edge === "start" ? 0 : node.children.length - 1;
      path.push(index);
      node = node.children[index];
    }
    return { path, offset: edge === "start" ? 0 : String(node.text || "").length };
  }

  function readEditorText(editor) {
    return readNodeText({ children: editor.children });
  }

  function readNodeText(node) {
    if (typeof node?.text === "string") return node.text;
    if (Array.isArray(node?.children)) return node.children.map(readNodeText).join("\n");
    return "";
  }

  function submitSlatePrompt(editor, slateElement) {
    if (!readEditorText(editor).trim()) return null;

    const button = findSubmitButton(slateElement);
    if (button) {
      const reactTier = invokeReactHandler(button, "onClick") || invokeAncestorSubmit(button);
      if (reactTier) return { tier: reactTier, buttonLabel: buttonLabel(button) };

      try {
        button.click();
        return { tier: "nativeClick", buttonLabel: buttonLabel(button) };
      } catch {
        // Chuyển sang Enter phía dưới.
      }
    }

    const form = slateElement.closest?.("form");
    if (form && typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return { tier: "form.requestSubmit", buttonLabel: "form" };
    }

    // Không báo thành công giả bằng phím Enter: Flow có thể hiểu Enter là xuống
    // dòng. Content script sẽ chờ đúng nút mũi tên và báo lỗi rõ nếu không thấy.
    return null;
  }

  function findSubmitButton(slateElement) {
    const scopes = [];
    let parent = slateElement.parentElement;
    for (let depth = 0; parent && depth < 7; depth += 1) {
      scopes.push(parent);
      parent = parent.parentElement;
    }
    scopes.push(document);

    const candidates = [];
    scopes.forEach((scope, scopeIndex) => {
      scope.querySelectorAll('button, [role="button"]').forEach((element) => {
        if (!isVisible(element) || isDisabled(element) || candidates.some((item) => item.element === element)) return;
        const label = buttonLabel(element);
        const isSubmitType = element.getAttribute("type") === "submit";
        const hasSubmitWord = SUBMIT_WORDS.some((word) =>
          label === word || label.startsWith(`${word} `) || label.includes(` ${word} `)
        );
        const hasSubmitIcon = /arrow|send|generate|create|submit|spark/u.test(label);
        if (!isSubmitType && !hasSubmitWord && !hasSubmitIcon) return;

        let score = 100 - scopeIndex * 12;
        if (isSubmitType) score += 80;
        if (hasSubmitWord) score += 100;
        if (hasSubmitIcon) score += 45;
        if (/cancel|stop|close|upload|settings|menu|more/u.test(label)) score -= 150;
        if (score > 20) candidates.push({ element, score });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.element || findPositionalSubmitButton(slateElement, scopes);
  }

  function findPositionalSubmitButton(slateElement, scopes) {
    const inputRect = slateElement.getBoundingClientRect();
    const seen = new Set();
    const candidates = [];

    scopes.slice(0, 6).forEach((scope, scopeIndex) => {
      scope.querySelectorAll('button, [role="button"]').forEach((element) => {
        if (seen.has(element) || !isVisible(element) || isDisabled(element)) return;
        seen.add(element);

        const rect = element.getBoundingClientRect();
        const label = buttonLabel(element);
        const isCompact = rect.width >= 20 && rect.height >= 20 && rect.width <= 88 && rect.height <= 88;
        const nearComposer = rect.top <= inputRect.bottom + 110 && rect.bottom >= inputRect.top - 55;
        const onRightSide = rect.left >= inputRect.left + inputRect.width * 0.55;
        if (!isCompact || !nearComposer || !onRightSide) return;
        if (/attach|upload|add|plus|agent|video|image|10s|settings|menu|more|mic|voice|close|cancel/u.test(label)) return;

        let score = 160 - scopeIndex * 16;
        score += Math.max(0, 80 - Math.abs(inputRect.right - rect.right) / 2);
        score += Math.max(0, 50 - Math.abs(inputRect.bottom - rect.bottom) / 2);
        if (Math.abs(rect.width - rect.height) <= 8) score += 25;
        if (/arrow|send|forward|north|play/u.test(label)) score += 80;
        candidates.push({ element, score });
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.element || null;
  }

  function invokeReactHandler(element, handlerName) {
    const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
    const handler = propsKey ? element[propsKey]?.[handlerName] : null;
    if (typeof handler !== "function") return null;

    const rect = element.getBoundingClientRect();
    handler({
      type: handlerName === "onClick" ? "click" : "keydown",
      key: handlerName === "onKeyDown" ? "Enter" : undefined,
      code: handlerName === "onKeyDown" ? "Enter" : undefined,
      keyCode: handlerName === "onKeyDown" ? 13 : undefined,
      which: handlerName === "onKeyDown" ? 13 : undefined,
      target: element,
      currentTarget: element,
      nativeEvent: { isTrusted: true },
      isTrusted: true,
      defaultPrevented: false,
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      preventDefault() {},
      stopPropagation() {},
      persist() {}
    });
    return `reactProps.${handlerName}`;
  }

  function invokeAncestorSubmit(element) {
    const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? element[fiberKey] : null;
    let depth = 0;
    while (fiber && depth < 60) {
      const handler = fiber.pendingProps?.onSubmit || fiber.memoizedProps?.onSubmit;
      if (typeof handler === "function") {
        handler({ preventDefault() {}, stopPropagation() {}, target: element, currentTarget: element });
        return "reactFiber.onSubmit";
      }
      fiber = fiber.return;
      depth += 1;
    }
    return null;
  }

  function buttonLabel(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.textContent
    ].filter(Boolean).join(" ").trim().replace(/\s+/gu, " ").toLowerCase();
  }

  function isVisible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  }

  function isDisabled(element) {
    return element.matches(":disabled") || element.getAttribute("aria-disabled") === "true" || element.hasAttribute("disabled");
  }
})();
