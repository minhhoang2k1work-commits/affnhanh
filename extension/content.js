// AFF HUB Chrome Extension - Content Script

(function () {
  console.log('[AFF HUB Content Script] Loaded on:', window.location.href);

  // Auto-sync serverUrl and handshake when user is on AFF HUB Web App
  if (!window.location.hostname.includes('shopee.vn')) {
    const currentOrigin = window.location.origin;
    chrome.runtime.sendMessage({ action: 'SYNC_SERVER_URL', serverUrl: currentOrigin });
    window.postMessage({ type: 'AFF_EXTENSION_INSTALLED', version: '1.0.0', status: 'ready' }, '*');
    document.documentElement.setAttribute('data-aff-extension-installed', 'true');
    console.log('[AFF HUB Extension] Auto-paired with web app origin:', currentOrigin);
    return;
  }

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
          const pushBtn = document.getElementById('aff-hub-push');
          if (res && res.success) {
            pushBtn.innerText = 'THÀNH CÔNG!';
            pushBtn.style.background = '#3b82f6';
            window.pendingProducts = []; // clear after push
            
            if (currentScanJobId && !currentScanJobId.startsWith('ext_')) {
              // Automated background scan -> close tab
              chrome.runtime.sendMessage({ action: 'CLOSE_TAB' });
            } else {
              // Manual scan -> open library using stored serverUrl
              chrome.runtime.sendMessage({ action: 'GET_SERVER_URL' }, (urlRes) => {
                const targetServer = urlRes?.serverUrl || 'https://affnhanh.vercel.app';
                setTimeout(() => {
                  window.open(`${targetServer}/library`, '_blank');
                }, 1000);
              });
            }
          } else {
            pushBtn.innerText = 'LỖI ĐẨY DỮ LIỆU!';
            pushBtn.style.background = '#ef4444';
            alert(`Không thể đẩy dữ liệu lên Server: ${res?.error || 'Lỗi không xác định'}`);
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

  function sanitizePrice(amount) {
    if (!amount || isNaN(amount) || amount <= 0) return 0;
    let val = Number(amount);
    while (val > 50000000) {
      val = Math.round(val / 100000);
    }
    return val;
  }

  function addProductToUI(product) {
    if (!uiList) return;
    const cleanPrice = sanitizePrice(product.salePrice || product.price);
    product.price = cleanPrice;
    product.salePrice = cleanPrice;

    const item = document.createElement('div');
    item.style.cssText = `display: flex; gap: 8px; padding: 8px; border-bottom: 1px solid #1e293b; align-items: center;`;
    item.innerHTML = `
      <img src="${product.productImage}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0;" />
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #e2e8f0;">${product.productName}</div>
        <div style="font-size: 11px; color: #a855f7; font-weight: bold;">${cleanPrice.toLocaleString('vi-VN')}₫</div>
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
        let salePrice = 0;
        const priceSelectors = [
          '[aria-label*="₫"]',
          '[aria-label*="đ"]',
          'span[class*="price"]',
          'div[class*="price"]',
          'span[class*="text-shopee"]',
          'span[class*="font-medium"]',
          '.text-emerald-400'
        ];
        for (const sel of priceSelectors) {
          const el = card.querySelector(sel);
          if (el) {
            const txt = el.getAttribute('aria-label') || el.innerText || '';
            const match = txt.match(/[\d\.,]+/);
            if (match) {
              const val = parseInt(match[0].replace(/[\.,]/g, ''), 10);
              if (!isNaN(val) && val > 0) {
                salePrice = sanitizePrice(val);
                if (salePrice > 0) break;
              }
            }
          }
        }
        if (!salePrice) {
          const cardTxt = card.innerText || '';
          const match = cardTxt.match(/(?:₫|đ|VND)\s*([\d\.,]+)|([\d\.,]+)\s*(?:₫|đ|VND)/i);
          if (match) {
            const rawStr = (match[1] || match[2] || '').replace(/[\.,]/g, '');
            const val = parseInt(rawStr, 10);
            if (!isNaN(val) && val > 0) {
              salePrice = sanitizePrice(val);
            }
          }
        }

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

        // Affiliate Info Extraction from card/page DOM
        let commissionRate = 0;
        let voucherAffiliate = '';
        let voucherShop = '';
        let voucherPlatform = '';
        let affiliateProgram = '';

        // Try extracting commission rate from card (e.g. "Hoa hồng X%" badges)
        const cardText = card.innerText || '';
        const commMatch = cardText.match(/(?:Hoa hồng|Commission|HH)[:\s]*([\d.,]+)\s*%/i);
        if (commMatch) {
          commissionRate = parseFloat(commMatch[1].replace(',', '.')) || 0;
        }

        // Try extracting voucher info from card labels
        const voucherEls = card.querySelectorAll('[class*="voucher"], [class*="badge"], [class*="label"], [class*="tag"]');
        voucherEls.forEach(el => {
          const txt = (el.innerText || '').trim();
          if (!txt) return;
          const lower = txt.toLowerCase();
          if (lower.includes('affiliate') || lower.includes('aff')) {
            voucherAffiliate = txt;
          } else if (lower.includes('shop') || lower.includes('cửa hàng')) {
            voucherShop = txt;
          } else if (lower.includes('sàn') || lower.includes('shopee') || lower.includes('platform')) {
            voucherPlatform = txt;
          }
        });

        // Try extracting affiliate program from card
        const progMatch = cardText.match(/(?:Chương trình|Program)[:\s]*([^\n]+)/i);
        if (progMatch) {
          affiliateProgram = progMatch[1].trim();
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
          commissionRate,
          voucherAffiliate,
          voucherShop,
          voucherPlatform,
          affiliateProgram,
        };
        
        addProductToUI(productObj);
        newProducts.push(productObj);
      } catch (err) {}
    });

    return newProducts;
  }

  // Extract detailed affiliate info from product detail page
  function extractProductDetailAffiliateInfo() {
    const info = {
      commissionRate: 0,
      maxCommission: null,
      affiliateProgram: '',
      voucherAffiliate: '',
      voucherShop: '',
      voucherPlatform: '',
      commissionCondition: '',
      campaignValidity: '',
      allowAds: null,
      cpsActual: null,
    };

    const pageText = document.body.innerText || '';

    // Commission rate
    const commMatch = pageText.match(/(?:Hoa hồng|Commission)[:\s]*([\d.,]+)\s*%/i);
    if (commMatch) {
      info.commissionRate = parseFloat(commMatch[1].replace(',', '.')) || 0;
    }

    // Max commission
    const maxCommMatch = pageText.match(/(?:Hoa hồng tối đa|Max Commission|HH tối đa)[:\s]*([\d.,]+)\s*(?:₫|đ|VND|k)/i);
    if (maxCommMatch) {
      let val = parseFloat(maxCommMatch[1].replace(/[.,]/g, ''));
      if (pageText.match(/(?:Hoa hồng tối đa|Max Commission|HH tối đa)[:\s]*[\d.,]+\s*k/i)) {
        val *= 1000;
      }
      info.maxCommission = val;
    }

    // Vouchers extraction from detail page
    const allEls = document.querySelectorAll('[class*="voucher"], [class*="badge"], [class*="promo"], [class*="label"]');
    allEls.forEach(el => {
      const txt = (el.innerText || '').trim();
      if (!txt || txt.length > 200) return;
      const lower = txt.toLowerCase();
      if ((lower.includes('affiliate') || lower.includes('aff')) && !info.voucherAffiliate) {
        info.voucherAffiliate = txt;
      } else if ((lower.includes('shop') || lower.includes('cửa hàng')) && !info.voucherShop) {
        info.voucherShop = txt;
      } else if ((lower.includes('sàn') || lower.includes('freeship') || lower.includes('platform')) && !info.voucherPlatform) {
        info.voucherPlatform = txt;
      }
    });

    // Affiliate program name
    const progMatch = pageText.match(/(?:Chương trình Affiliate|Affiliate Program|Campaign)[:\s]*([^\n]{3,80})/i);
    if (progMatch) {
      info.affiliateProgram = progMatch[1].trim();
    }

    // Commission condition
    const condMatch = pageText.match(/(?:Điều kiện|Condition|Yêu cầu)[:\s]*([^\n]{3,150})/i);
    if (condMatch) {
      info.commissionCondition = condMatch[1].trim();
    }

    // Campaign validity
    const validMatch = pageText.match(/(?:Hiệu lực|Thời gian|Valid|Validity|Hạn)[:\s]*([\d\/\-\.]+\s*[-~đến]+\s*[\d\/\-\.]+)/i);
    if (validMatch) {
      info.campaignValidity = validMatch[1].trim();
    }

    // Allow ads
    if (pageText.match(/(?:Được phép|Cho phép|Allowed).*(?:quảng cáo|ads|advertising)/i)) {
      info.allowAds = true;
    } else if (pageText.match(/(?:Không được|Cấm|Not allowed).*(?:quảng cáo|ads|advertising)/i)) {
      info.allowAds = false;
    }

    // CPS actual
    const cpsMatch = pageText.match(/(?:CPS|Commission thực tế|Actual Commission)[:\s]*([\d.,]+)\s*%/i);
    if (cpsMatch) {
      info.cpsActual = parseFloat(cpsMatch[1].replace(',', '.')) || null;
    }

    return info;
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

  // Helper: Layer 1 - GraphQL API Call
  async function generateViaGraphQL(productUrl, subIds) {
    console.log('[AFF HUB] Attempting GraphQL API cho việc tạo link...');
    const bodyObj = { urls: [productUrl], subIds: subIds || [] };

    try {
      const response = await fetch('https://affiliate.shopee.vn/api/v3/gql?q=batchCustomLink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyObj)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const jsonString = JSON.stringify(data);
      const match = jsonString.match(/https:\/\/(?:s\.shopee\.vn|shp\.ee)\/[a-zA-Z0-9_-]+/);
      if (match) {
        return match[0];
      }
      throw new Error('GraphQL response did not contain a valid short link');
    } catch (error) {
      console.log('[AFF HUB] GraphQL attempt failed:', error.message);
      throw error;
    }
  }

  // Helper: Layer 2 - DOM Automation
  async function generateViaDomAutomation(productUrl, subIds) {
    console.log('[AFF HUB] Attempting DOM automation fallback...');
    
    if (!window.location.href.includes('custom_link')) {
      console.log('[AFF HUB] Navigating to custom_link page...');
      window.location.href = 'https://affiliate.shopee.vn/offer/custom_link';
      // Return a special error to allow redirect
      throw new Error('NAVIGATING_TO_CUSTOM_LINK');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Find link input
    const inputSelectors = 'textarea, input[placeholder*="http"], input[placeholder*="shopee"], input[type="text"]';
    const linkInput = document.querySelector(inputSelectors);
    
    if (!linkInput) throw new Error('Không tìm thấy ô nhập link');
    
    // 3. Set value + dispatch events
    linkInput.value = productUrl;
    linkInput.dispatchEvent(new Event('input', { bubbles: true }));
    linkInput.dispatchEvent(new Event('change', { bubbles: true }));

    // 4. Fill SubID inputs if provided
    if (subIds && subIds.length > 0) {
      const subInputs = document.querySelectorAll('input[placeholder*="Sub"], input[name*="sub"]');
      subIds.forEach((subId, index) => {
        if (subInputs[index]) {
          subInputs[index].value = subId;
          subInputs[index].dispatchEvent(new Event('input', { bubbles: true }));
          subInputs[index].dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }

    // 5. Find and click generate button
    const buttons = document.querySelectorAll('button');
    let genBtn = null;
    const btnTexts = ['Lấy Link', 'Chuyển đổi', 'Tạo Link', 'Generate'];
    for (const btn of buttons) {
      const text = btn.innerText?.trim() || '';
      if (btnTexts.some(t => text.includes(t))) {
        genBtn = btn;
        break;
      }
    }

    if (!genBtn) throw new Error('Không tìm thấy nút tạo link');
    
    genBtn.click();

    // 6. Wait 2-3 seconds for result
    await new Promise(resolve => setTimeout(resolve, 2500));

    // 7. Extract result
    const resultSelectors = 'input[value*="s.shopee.vn"], input[value*="shp.ee"], input[readonly], [class*="link-result"]';
    const resultEls = document.querySelectorAll(resultSelectors);
    let resultLink = null;

    for (const el of resultEls) {
      const val = el.value || el.innerText;
      if (val && (val.includes('s.shopee.vn') || val.includes('shp.ee'))) {
        resultLink = val;
        break;
      }
    }

    // 8. Try regex fallback on page content
    if (!resultLink) {
      const match = document.body.innerHTML.match(/https:\/\/(?:s\.shopee\.vn|shp\.ee)\/[a-zA-Z0-9_-]+/);
      if (match) resultLink = match[0];
    }

    if (resultLink) return resultLink;
    
    throw new Error('Không thể lấy được link sau khi tạo');
  }

  // Handle Extension Affiliate Helper (on affiliate.shopee.vn)
  async function handleAffiliateLinkGeneration(jobId, payload) {
    console.log('[AFF HUB] Generating link for job:', jobId, payload);
    const { productUrl, subIds } = payload || {};
    
    if (!productUrl) {
      return chrome.runtime.sendMessage({
        action: 'AFFILIATE_RESULT',
        jobId,
        error: 'No product URL provided'
      });
    }

    // Check Auth/Verification states first
    const currentUrl = window.location.href;
    const pageContent = document.body.innerText.toLowerCase();
    
    if (currentUrl.includes('/login')) {
      return chrome.runtime.sendMessage({
        action: 'AFFILIATE_RESULT',
        jobId,
        error: 'SHOPEE_AUTH_REQUIRED'
      });
    }

    if (currentUrl.includes('/verify') || pageContent.includes('captcha')) {
      return chrome.runtime.sendMessage({
        action: 'AFFILIATE_RESULT',
        jobId,
        error: 'SHOPEE_VERIFICATION_REQUIRED'
      });
    }

    // Timeout mechanism (15 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('BROWSER_TIMEOUT')), 15000);
    });

    try {
      const generateTask = async () => {
        try {
          // Layer 1: GraphQL API
          return await generateViaGraphQL(productUrl, subIds);
        } catch (gqlError) {
          // Layer 2: DOM Automation fallback
          return await generateViaDomAutomation(productUrl, subIds);
        }
      };

      const generatedLink = await Promise.race([generateTask(), timeoutPromise]);
      
      chrome.runtime.sendMessage({
        action: 'AFFILIATE_RESULT',
        jobId,
        affiliateUrl: generatedLink
      });

    } catch (err) {
      console.error('[AFF HUB] Link generation failed:', err);
      // Let background handle navigation state if needed or report error
      chrome.runtime.sendMessage({
        action: 'AFFILIATE_RESULT',
        jobId,
        error: err.message === 'NAVIGATING_TO_CUSTOM_LINK' ? 'NAVIGATING' : err.message,
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
