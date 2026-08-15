// AFF HUB Chrome Extension - ChatGPT Content Script

const CHATGPT_SELECTORS = {
  editor: '#prompt-textarea, div[contenteditable="true"]',
  fileInput: 'input[type="file"]',
  attachButton: 'button[aria-label="Attach files"], button[data-testid="attach-button"]',
  sendButton: 'button[data-testid="send-button"], button[aria-label*="Send"]',
  stopButton: 'button[data-testid="stop-button"], button[aria-label="Stop generating"]',
  streaming: '.result-streaming, .streaming',
  assistantMessage: 'div[data-message-author-role="assistant"]',
  copyButton: '[data-testid="copy-turn-action-button"]',
};

// UTILITY: Wait for element to appear in DOM
async function waitForElement(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) {
      return resolve(el);
    }

    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[AFF HUB] Element timeout: ${selector}`));
    }, timeout);
  });
}

// UTILITY: Convert URL or base64 to File blob
async function urlToFile(urlOrBase64, filename = 'product.jpg') {
  try {
    if (urlOrBase64.startsWith('data:')) {
      const arr = urlOrBase64.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } else {
      const res = await fetch(urlOrBase64);
      const blob = await res.blob();
      return new File([blob], filename, { type: blob.type || 'image/jpeg' });
    }
  } catch (error) {
    console.error('[AFF HUB] Error in urlToFile:', error);
    throw error;
  }
}

// CORE: Upload image to ChatGPT
async function uploadImage(imageData) {
  try {
    console.log('[AFF HUB] Uploading image to ChatGPT...');
    const fileInput = await waitForElement(CHATGPT_SELECTORS.fileInput, 10000);
    const file = await urlToFile(imageData);
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    
    const event = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(event);
    console.log('[AFF HUB] Image uploaded.');
  } catch (error) {
    console.error('[AFF HUB] Error uploading image:', error);
    throw error;
  }
}

// CORE: Set text in the editor
function setEditorText(text) {
  try {
    const editor = document.querySelector(CHATGPT_SELECTORS.editor);
    if (!editor) throw new Error('Editor not found');
    
    editor.focus();
    
    // Attempt execCommand for rich text editors
    const success = document.execCommand('insertText', false, text);
    
    if (!success) {
      // Fallback
      if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
        editor.value = text;
      } else {
        editor.innerText = text;
      }
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    console.log('[AFF HUB] Editor text set.');
  } catch (error) {
    console.error('[AFF HUB] Error setting editor text:', error);
    throw error;
  }
}

// CORE: Click send button
function clickSend() {
  try {
    const sendButton = document.querySelector(CHATGPT_SELECTORS.sendButton);
    if (sendButton && !sendButton.disabled) {
      sendButton.click();
      console.log('[AFF HUB] Send button clicked.');
    } else {
      console.log('[AFF HUB] Send button disabled or not found, simulating Enter key.');
      const editor = document.querySelector(CHATGPT_SELECTORS.editor);
      if (editor) {
        const enterEvent = new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          code: 'Enter',
          keyCode: 13
        });
        editor.dispatchEvent(enterEvent);
      }
    }
  } catch (error) {
    console.error('[AFF HUB] Error clicking send:', error);
    throw error;
  }
}

// CORE: Wait for ChatGPT to finish responding
async function waitForCompletion(timeout = 120000) {
  return new Promise((resolve, reject) => {
    let checkInterval;
    let timeoutId;
    let generationStarted = false;
    
    console.log('[AFF HUB] Waiting for completion...');
    
    const check = () => {
      try {
        const stopBtn = document.querySelector(CHATGPT_SELECTORS.stopButton);
        if (stopBtn) {
          generationStarted = true;
        } else if (generationStarted && !stopBtn) {
          // Generation finished
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          
          const messages = document.querySelectorAll(CHATGPT_SELECTORS.assistantMessage);
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            resolve(lastMessage.innerText);
          } else {
            reject(new Error('[AFF HUB] No assistant message found after generation.'));
          }
        }
      } catch (error) {
        clearInterval(checkInterval);
        clearTimeout(timeoutId);
        reject(error);
      }
    };
    
    checkInterval = setInterval(check, 500);
    
    timeoutId = setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error(`[AFF HUB] Timeout waiting for completion after ${timeout}ms`));
    }, timeout);
  });
}

// MESSAGE HANDLER - receives commands from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CHATGPT_ANALYZE') {
    console.log('[AFF HUB] Received CHATGPT_ANALYZE message:', message);
    (async () => {
      try {
        const { imageData, prompt } = message;
        
        // Step 1: Wait for ChatGPT to be ready
        await waitForElement(CHATGPT_SELECTORS.editor, 10000);
        await new Promise(r => setTimeout(r, 1000));
        
        // Step 2: Upload image
        if (imageData) {
          await uploadImage(imageData);
          await new Promise(r => setTimeout(r, 2000)); // Wait for upload
        }
        
        // Step 3: Type the prompt
        const defaultPrompt = prompt || `Hãy phân tích ảnh sản phẩm này và tạo 2 prompt video:
- Prompt 1: Video quảng cáo kiểu marketing, close-up chi tiết sản phẩm, nền studio chuyên nghiệp
- Prompt 2: Video lifestyle, sản phẩm đang được sử dụng, góc quay cinematic, ánh sáng tự nhiên

Trả lời theo format:
[PROMPT1]
(nội dung prompt 1 bằng tiếng Anh)
[/PROMPT1]
[PROMPT2]
(nội dung prompt 2 bằng tiếng Anh)
[/PROMPT2]`;
        
        setEditorText(defaultPrompt);
        await new Promise(r => setTimeout(r, 500));
        
        // Step 4: Send
        clickSend();
        await new Promise(r => setTimeout(r, 1000)); // give time to start generating
        
        // Step 5: Wait for completion
        const responseText = await waitForCompletion(120000);
        console.log('[AFF HUB] ChatGPT response received.');
        
        sendResponse({ success: true, responseText });
      } catch (error) {
        console.error('[AFF HUB] CHATGPT_ANALYZE Error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }
});

console.log('[AFF HUB] ChatGPT Content Script Loaded.');
