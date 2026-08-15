// AFF HUB Chrome Extension - Google Flow (VideoFX/Veo) Content Script
// Tự động tương tác với flow.google để tạo video từ ảnh + prompt

const FLOW_SELECTORS = {
  // Prompt input — Google Flow dùng textarea hoặc contenteditable
  promptInput: 'textarea[aria-label*="prompt" i], textarea[placeholder*="prompt" i], textarea[placeholder*="describe" i], textarea[placeholder*="Describe" i], div[contenteditable="true"][aria-label*="prompt" i]',
  // File upload
  fileInput: 'input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]',
  uploadButton: 'button[aria-label*="Upload" i], button[aria-label*="Image" i], button[aria-label*="upload" i], button[aria-label*="Reference" i]',
  // Generate button
  generateButton: 'button[data-testid="generate-button"], button[aria-label*="Generate" i]',
  // Video result & download
  videoElement: 'video[src], video source[src]',
  downloadButton: 'button[aria-label*="Download" i], a[download], button[data-testid*="download"]',
  // Progress / loading indicators
  progressIndicator: '[role="progressbar"], div[class*="progress"], div[class*="loading"], div[class*="spinner"]',
  // Result container (generation history / output panel)
  resultCard: 'div[class*="result"], div[class*="generation"], div[class*="output"], div[class*="preview"]',
};

// UTILITY: Wait for element to appear in DOM
async function waitForElement(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[AFF HUB] Element timeout: ${selector}`));
    }, timeout);
  });
}

// UTILITY: Wait for ANY matching element (tries multiple selectors)
async function waitForAny(selectors, timeout = 15000) {
  const selectorList = selectors.split(',').map(s => s.trim());
  return new Promise((resolve, reject) => {
    // Check immediately
    for (const sel of selectorList) {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
    }

    const observer = new MutationObserver(() => {
      for (const sel of selectorList) {
        const el = document.querySelector(sel);
        if (el) {
          observer.disconnect();
          resolve(el);
          return;
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[AFF HUB] No element found for: ${selectors}`));
    }, timeout);
  });
}

// UTILITY: Convert URL/base64 to File
async function urlToFile(urlOrBase64, filename = 'source.jpg') {
  try {
    if (urlOrBase64.startsWith('data:')) {
      const arr = urlOrBase64.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
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

// CORE: Upload image to Google Flow
async function uploadImage(imageData) {
  try {
    console.log('[AFF HUB] Uploading image to Google Flow...');

    // Approach 1: Try hidden file input
    let fileInput = document.querySelector(FLOW_SELECTORS.fileInput);

    // Approach 2: If no file input visible, click upload button first to reveal it
    if (!fileInput) {
      console.log('[AFF HUB] No file input found, clicking upload button...');
      const uploadBtn = document.querySelector(FLOW_SELECTORS.uploadButton);
      if (uploadBtn) {
        uploadBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        fileInput = document.querySelector(FLOW_SELECTORS.fileInput);
      }
    }

    // Approach 3: Search all inputs more broadly
    if (!fileInput) {
      const allInputs = document.querySelectorAll('input[type="file"]');
      if (allInputs.length > 0) fileInput = allInputs[0];
    }

    if (!fileInput) throw new Error('File input not found on Google Flow');

    const file = await urlToFile(imageData);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    console.log('[AFF HUB] Image upload triggered, waiting for preview...');

    // Wait for upload to process (look for image preview or loading indicator change)
    await new Promise(r => setTimeout(r, 3000));
    console.log('[AFF HUB] Image uploaded successfully.');
  } catch (error) {
    console.error('[AFF HUB] Error uploading image:', error);
    throw error;
  }
}

// CORE: Set prompt text
function setPrompt(promptText) {
  try {
    console.log('[AFF HUB] Setting prompt on Google Flow...');

    // Try textarea first
    let input = document.querySelector(FLOW_SELECTORS.promptInput);

    // Broader search
    if (!input) {
      input = document.querySelector('textarea') || document.querySelector('div[contenteditable="true"]');
    }

    if (!input) throw new Error('Prompt input not found on Google Flow');

    input.focus();

    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      // Use native setter for React/Angular state sync
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(input, promptText);
      } else {
        input.value = promptText;
      }
    } else {
      // ContentEditable div
      const success = document.execCommand('insertText', false, promptText);
      if (!success) {
        input.innerText = promptText;
      }
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[AFF HUB] Prompt set successfully.');
  } catch (error) {
    console.error('[AFF HUB] Error setting prompt:', error);
    throw error;
  }
}

// CORE: Click generate button
function clickGenerate() {
  try {
    console.log('[AFF HUB] Looking for Generate button...');

    // Approach 1: Try specific selectors
    let genBtn = document.querySelector(FLOW_SELECTORS.generateButton);

    // Approach 2: Search by text content
    if (!genBtn) {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = (btn.innerText || btn.textContent || '').toLowerCase();
        if ((text.includes('generate') || text.includes('create') || text.includes('tạo')) && !btn.disabled) {
          genBtn = btn;
          break;
        }
      }
    }

    if (!genBtn) throw new Error('Generate button not found or disabled on Google Flow');

    genBtn.click();
    console.log('[AFF HUB] Generate button clicked.');
  } catch (error) {
    console.error('[AFF HUB] Error clicking generate:', error);
    throw error;
  }
}

// CORE: Wait for video to be ready
async function waitForVideo(timeout = 600000) {
  return new Promise((resolve, reject) => {
    console.log('[AFF HUB] Waiting for video generation on Google Flow...');
    let checkInterval;
    let timeoutId;

    const check = () => {
      try {
        // Look for video elements with src
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
          const src = video.src || video.querySelector('source')?.src;
          if (src && src.startsWith('http') && !src.includes('placeholder')) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            console.log('[AFF HUB] Video found:', src);
            resolve(src);
            return;
          }
        }

        // Also check for download links
        const downloadLinks = document.querySelectorAll('a[download], a[href*=".mp4"]');
        for (const link of downloadLinks) {
          if (link.href && link.href.includes('.mp4')) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            console.log('[AFF HUB] Video download link found:', link.href);
            resolve(link.href);
            return;
          }
        }

        // Check for blob URLs in video elements
        for (const video of videos) {
          const src = video.src || '';
          if (src.startsWith('blob:')) {
            // For blob URLs, try to find a download button nearby
            const parent = video.closest('div[class*="result"], div[class*="output"], div[class*="preview"], div[class*="card"]');
            if (parent) {
              const dlBtn = parent.querySelector('button[aria-label*="Download" i], a[download]');
              if (dlBtn) {
                const downloadUrl = dlBtn.href || dlBtn.getAttribute('data-url');
                if (downloadUrl) {
                  clearInterval(checkInterval);
                  clearTimeout(timeoutId);
                  resolve(downloadUrl);
                  return;
                }
              }
            }
            // Blob URL means video is ready even if we can't get direct URL
            // Signal completion so orchestrator can try download
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            console.log('[AFF HUB] Video blob detected, triggering download...');
            resolve(src);
            return;
          }
        }
      } catch (error) {
        console.error('[AFF HUB] Error checking video status:', error);
      }
    };

    // Start polling every 5 seconds
    checkInterval = setInterval(check, 5000);

    timeoutId = setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error(`[AFF HUB] Timeout waiting for video after ${timeout / 1000}s`));
    }, timeout);
  });
}

// CORE: Try to get downloadable video URL
async function getDownloadableUrl() {
  try {
    // Click download button if available
    const dlBtn = document.querySelector(FLOW_SELECTORS.downloadButton);
    if (dlBtn) {
      if (dlBtn.href) return dlBtn.href;
      dlBtn.click();
      await new Promise(r => setTimeout(r, 2000));

      // Check if a download was initiated or a link appeared
      const newLink = document.querySelector('a[download][href*=".mp4"], a[href*="storage.googleapis.com"]');
      if (newLink) return newLink.href;
    }
    return null;
  } catch (error) {
    console.warn('[AFF HUB] Could not get downloadable URL:', error);
    return null;
  }
}

// MESSAGE HANDLER - receives commands from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FLOW_GENERATE') {
    console.log('[AFF HUB] Received FLOW_GENERATE message');
    (async () => {
      try {
        const { imageData, prompt } = message;

        // Wait for page to be fully loaded
        await new Promise(r => setTimeout(r, 2000));

        // Step 1: Upload image if provided
        if (imageData) {
          await uploadImage(imageData);
          await new Promise(r => setTimeout(r, 3000)); // Wait for upload processing
        }

        // Step 2: Enter prompt
        setPrompt(prompt);
        await new Promise(r => setTimeout(r, 1000));

        // Step 3: Generate
        clickGenerate();
        await new Promise(r => setTimeout(r, 3000)); // Wait for generation to start

        // Step 4: Wait for video (up to 10 minutes)
        const videoUrl = await waitForVideo(600000);

        // Step 5: Try to get a direct downloadable URL
        const downloadUrl = await getDownloadableUrl();
        const finalUrl = downloadUrl || videoUrl;

        sendResponse({ success: true, videoUrl: finalUrl });
      } catch (error) {
        console.error('[AFF HUB] FLOW_GENERATE Error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }
});

console.log('[AFF HUB] Google Flow Content Script Loaded.');
