// AFF HUB Chrome Extension - Content Script

(function () {
  console.log('[AFF HUB Content Script] Loaded on:', window.location.href);

  let isScanning = false;
  let currentScanJobId = null;
  let collectedProductKeys = new Set();
  
  // -- UI WIDGET START --
  let uiContainer = null;
  let uiList = null;

  function initScannerUI() {
    if (document.getElementById('aff-hub-scanner-ui')) {
      document.getElementById('aff-hub-list').innerHTML = '';
      return;
    }
    
    uiContainer = document.createElement('div');
    uiContainer.id = 'aff-hub-scanner-ui';
    uiContainer.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; width: 320px;
      background: #0f172a; border: 1px solid #334155; border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 2147483647;
      color: #f8fafc; font-family: sans-serif; overflow: hidden;
      display: flex; flex-direction: column; max-height: 400px;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px; background: #1e293b; border-bottom: 1px solid #334155;
      font-weight: bold; display: flex; justify-content: space-between; align-items: center;
    `;
    header.innerHTML = `
      <span style="font-size: 13px;">⚡ AFF HUB - Đang quét</span>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span id="aff-hub-count" style="background: #a855f7; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px;">0 SP</span>
        <button id="aff-hub-push" style="background: #10b981; border: none; color: white; padding: 3px 8px; border-radius: 6px; font-size: 10px; cursor: pointer; font-weight: bold;">ĐẨY DỮ LIỆU</button>
        <button id="aff-hub-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px;">✕</button>
      </div>
    `;

    uiList = document.createElement('div');
    uiList.id = 'aff-hub-list';
    uiList.style.cssText = `flex: 1; overflow-y: auto; padding: 8px;`;

    uiContainer.appendChild(header);
    uiContainer.appendChild(uiList);
    document.body.appendChild(uiContainer);

    document.getElementById('aff-hub-push').onclick = () => {
      if (window.pendingProducts && window.pendingProducts.length > 0) {
        document.getElementById('aff-hub-push').innerText = 'ĐANG ĐẨY...';
        chrome.runtime.sendMessage({
          action: 'PRODUCTS_BATCH',
          scanJobId: currentScanJobId || 'ext_' + Date.now(),
          shop: window.currentShopInfo || { shopId: 'manual', name: 'Manual Scan' },
          products: window.pendingProducts,
        }, (res) => {
          document.getElementById('aff-hub-push').innerText = 'THÀNH CÔNG!';
          document.getElementById('aff-hub-push').style.background = '#3b82f6';
          window.pendingProducts = []; // clear after push
          
          if (currentScanJobId && !currentScanJobId.startsWith('ext_')) {
            // Automated background scan -> close tab
            chrome.runtime.sendMessage({ action: 'CLOSE_TAB' });
          } else {
            // Manual scan -> open library
            setTimeout(() => {
              window.open('https://affnhanh.vercel.app/library', '_blank');
            }, 1000);
          }
        });
      } else {
        alert('Chưa có sản phẩm nào để đẩy!');
      }
    };

    document.getElementById('aff-hub-close').onclick = () => {
      uiContainer.remove();
      uiContainer = null;
    };
  }

  function addProductToUI(product) {
    if (!uiList) return;
    const item = document.createElement('div');
    item.style.cssText = `display: flex; gap: 8px; padding: 8px; border-bottom: 1px solid #1e293b; align-items: center;`;
    item.innerHTML = `
      <img src="${product.productImage}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0;" />
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #e2e8f0;">${product.productName}</div>
        <div style="font-size: 11px; color: #a855f7; font-weight: bold;">${product.salePrice.toLocaleString('vi-VN')}₫</div>
      </div>
    `;
    uiList.prepend(item);
    
    const countEl = document.getElementById('aff-hub-count');
    if (countEl) countEl.innerText = `${collectedProductKeys.size} SP`;
    
    const pushEl = document.getElementById('aff-hub-push');
    if (pushEl) pushEl.innerText = `ĐẨY ${window.pendingProducts?.length || 0} SP`;
  }
  // -- UI WIDGET END --

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'START_SCAN') {
      currentScanJobId = message.scanJobId;
      startScanProcess(message.scanJobId);
      sendResponse({ started: true });
    } else if (message.action === 'GENERATE_LINK') {
      handleAffiliateLinkGeneration(message.jobId, message.payload);
      sendResponse({ processing: true });
    }
  });

  // Extract Shop Header Info
  function extractShopInfo() {
    const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;

    // Try finding shop name and avatar in DOM
    const nameEl =
      document.querySelector('.section-seller-overview__user-name') ||
      document.querySelector('.shopee-seller-portrait__name') ||
      document.querySelector('h1') ||
      document.querySelector('.page-product__shop-name');

    const avatarEl =
      document.querySelector('.shopee-avatar__img') ||
      document.querySelector('.shopee-seller-portrait__avatar img') ||
      document.querySelector('img[src*="avatar"]');

    let shopName = nameEl ? nameEl.innerText.trim() : document.title.split('|')[0].trim();
    let avatar = avatarEl ? avatarEl.src : '';

    // Extract shopId from URL or page state
    let shopId = '';
    const matchShop = window.location.pathname.match(/\/shop\/(\d+)/) || window.location.search.match(/shopid=(\d+)/);
    if (matchShop) {
      shopId = matchShop[1];
    } else {
      shopId = shopName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    return {
      shopId,
      name: shopName,
      url: canonical,
      avatar,
    };
  }

  // Extract Products from visible DOM / page structures
  function extractProductsFromPage(shopInfo) {
    const newProducts = [];
    // Select all potential product card elements
    const cardElements = document.querySelectorAll(
      '.shopee-search-item-result__item, .shop-search-result-view__item, [data-sqe="item"], .shopee-grid-item, a[href*="-i."]'
    );

    cardElements.forEach((card, index) => {
      try {
        const linkEl = card.tagName === 'A' ? card : card.querySelector('a[href*="-i."]');
        if (!linkEl) return;

        const href = linkEl.getAttribute('href') || '';
        const fullUrl = href.startsWith('http') ? href : `https://shopee.vn${href}`;

        // Parse productId from URL e.g. /product-name-i.12345.67890
        const idMatch = href.match(/-i\.(\d+)\.(\d+)/) || href.match(/i\.(\d+)\.(\d+)/);
        let productId = '';
        if (idMatch) {
          productId = idMatch[2];
        } else {
          // fallback string hash
          productId = `p_${href.split('?')[0].split('/').pop()}`;
        }

        const dedupKey = `${shopInfo.shopId}_${productId}`;
        if (collectedProductKeys.has(dedupKey)) return;
        collectedProductKeys.add(dedupKey);

        // Product Name
        const nameEl =
          card.querySelector('[data-sqe="name"]') ||
          card.querySelector('.aria-label') ||
          card.querySelector('.line-clamp-2') ||
          card.querySelector('img[alt]') ||
          linkEl;
        const productName = nameEl ? (nameEl.getAttribute('alt') || nameEl.innerText || '').trim() : '';

        if (!productName || productName.length < 3) return;

        // Image
        const imgEl = card.querySelector('img');
        const productImage = imgEl ? imgEl.src || imgEl.getAttribute('data-src') || '' : '';

        // Price
        const priceEl = card.querySelector('.aria-label[aria-label*="₫"]') || card.querySelector('span[class*="price"]') || card;
        const priceText = priceEl ? priceEl.innerText || '' : '';
        const numbers = priceText.replace(/[^0-9]/g, '');
        const salePrice = numbers ? parseInt(numbers.slice(0, 10), 10) : 0;

        // Sold count
        const soldEl = card.querySelector('[class*="sold"]') || card;
        const soldText = soldEl ? soldEl.innerText || '' : '';
        let soldCount = 0;
        const soldMatch = soldText.match(/Đã bán\s*([\d,\.kM]+)/i);
        if (soldMatch) {
          let sStr = soldMatch[1].replace(',', '.');
          if (sStr.includes('k')) soldCount = Math.round(parseFloat(sStr) * 1000);
          else if (sStr.includes('M')) soldCount = Math.round(parseFloat(sStr) * 1000000);
          else soldCount = parseInt(sStr.replace(/\./g, ''), 10) || 0;
        }

        const productObj = {
          productId,
          shopId: shopInfo.shopId,
          productName,
          productImage,
          price: salePrice,
          salePrice,
          soldCount,
          rating: 5.0,
          productUrl: fullUrl,
        };
        
        addProductToUI(productObj);
        newProducts.push(productObj);
      } catch (err) {}
    });

    return newProducts;
  }

  // Auto-scroll loop engine
  async function startScanProcess(scanJobId) {
    if (isScanning) return;
    isScanning = true;
    collectedProductKeys.clear();
    
    initScannerUI();

    const shopInfo = extractShopInfo();
    console.log('[AFF HUB Content Script] Starting scan for shop:', shopInfo);

    window.currentShopInfo = shopInfo;
    window.pendingProducts = window.pendingProducts || [];

    let scrollAttempts = 0;
    let consecutiveNoNewItems = 0;
    const MAX_SCROLLS = 25;
    const MAX_PRODUCTS = 250;

    while (isScanning && scrollAttempts < MAX_SCROLLS && collectedProductKeys.size < MAX_PRODUCTS) {
      scrollAttempts++;

      // Scroll window down smoothly
      window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const batch = extractProductsFromPage(shopInfo);

      if (batch.length > 0) {
        consecutiveNoNewItems = 0;
        console.log(`[AFF HUB] Batch found: ${batch.length} products (Total: ${collectedProductKeys.size})`);

        // Add to pending products instead of pushing immediately
        window.pendingProducts.push(...batch);
        
        // Update the button text to show how many products are ready to push
        const pushEl = document.getElementById('aff-hub-push');
        if (pushEl) pushEl.innerText = `ĐẨY ${window.pendingProducts.length} SP`;

        // Send progress
        const progressPercent = Math.min(95, Math.round((collectedProductKeys.size / MAX_PRODUCTS) * 100));
        chrome.runtime.sendMessage({
          action: 'SCAN_PROGRESS',
          scanJobId,
          progress: progressPercent,
          processedProducts: collectedProductKeys.size,
        });
      } else {
        consecutiveNoNewItems++;
        if (consecutiveNoNewItems >= 3) {
          console.log('[AFF HUB] No new products found after 3 scrolls. Finishing.');
          break;
        }
      }
    }

    isScanning = false;
    chrome.runtime.sendMessage({
      action: 'SCAN_COMPLETE',
      scanJobId,
      totalFound: collectedProductKeys.size,
    });

    // Auto-push if this scan was triggered by Web App Automation
    if (scanJobId && !scanJobId.startsWith('ext_')) {
      const pushEl = document.getElementById('aff-hub-push');
      if (pushEl && window.pendingProducts && window.pendingProducts.length > 0) {
        pushEl.click();
      } else {
        // If nothing to push, just close tab
        chrome.runtime.sendMessage({ action: 'CLOSE_TAB' });
      }
    }
  }

  // Handle Extension Affiliate Helper (on affiliate.shopee.vn)
  async function handleAffiliateLinkGeneration(jobId, payload) {
    console.log('[AFF HUB] Generating link for job:', jobId, payload);
    // Find link input field on Shopee Affiliate Page
    try {
      const inputEl = document.querySelector('input[placeholder*="http"]') || document.querySelector('textarea');
      if (inputEl && payload?.productUrl) {
        inputEl.value = payload.productUrl;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));

        const btn = document.querySelector('button:not([disabled])');
        if (btn) btn.click();

        await new Promise((r) => setTimeout(r, 2000));

        const resultEl = document.querySelector('[class*="link-result"]') || document.querySelector('input[readonly]');
        const generatedLink = resultEl ? resultEl.value || resultEl.innerText : payload.productUrl;

        chrome.runtime.sendMessage({
          action: 'AFFILIATE_RESULT',
          jobId,
          affiliateUrl: generatedLink,
        });
      }
    } catch (err) {
      chrome.runtime.sendMessage({
        action: 'AFFILIATE_RESULT',
        jobId,
        error: err.message,
      });
    }
  }

  // Auto trigger if page has #affhub_scan=true query parameter
  if (window.location.search.includes('affhub_scan=true') || window.location.hash.includes('affhub_scan')) {
    const params = new URLSearchParams(window.location.search);
    const jobParam = params.get('jobId') || 'auto_scan';
    setTimeout(() => startScanProcess(jobParam), 1500);
  }
})();
