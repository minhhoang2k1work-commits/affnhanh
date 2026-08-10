// AFF HUB Chrome Extension - Content Script

(function () {
  console.log('[AFF HUB Content Script] Loaded on:', window.location.href);

  let isScanning = false;
  let currentScanJobId = null;
  let collectedProductKeys = new Set();

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

        newProducts.push({
          productId,
          shopId: shopInfo.shopId,
          productName,
          productImage,
          price: salePrice,
          salePrice,
          soldCount,
          rating: 5.0,
          productUrl: fullUrl,
        });
      } catch (err) {}
    });

    return newProducts;
  }

  // Auto-scroll loop engine
  async function startScanProcess(scanJobId) {
    if (isScanning) return;
    isScanning = true;
    collectedProductKeys.clear();

    const shopInfo = extractShopInfo();
    console.log('[AFF HUB Content Script] Starting scan for shop:', shopInfo);

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

        // Send batch to background
        chrome.runtime.sendMessage({
          action: 'PRODUCTS_BATCH',
          scanJobId,
          shop: shopInfo,
          products: batch,
        });

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
