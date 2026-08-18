// AFF HUB Chrome Extension - Content Script

(function () {
  console.log('[AFF HUB Content Script] Loaded on:', window.location.href);

  // Auto-sync serverUrl and handshake when user is on AFF HUB Web App
  const isShopee = window.location.hostname.includes('shopee.vn');
  const isTikTok = window.location.hostname.includes('tiktok.com');
  const isMarketplace = isShopee || isTikTok;

  // Auto-sync serverUrl and handshake when user is on AFF HUB Web App
  if (!isMarketplace) {
    const currentOrigin = window.location.origin;
    chrome.runtime.sendMessage({ action: 'SYNC_SERVER_URL', serverUrl: currentOrigin });
    window.postMessage({ type: 'AFF_EXTENSION_INSTALLED', version: '1.4.3', status: 'ready' }, '*');
    document.documentElement.setAttribute('data-aff-extension-installed', 'true');
    console.log('[AFF HUB Extension] Auto-paired with web app origin:', currentOrigin);

    // Listen for video creation and commission lookup requests from the web app
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      // Web app requests video creation for a product
      if (event.data?.type === 'AFF_CREATE_VIDEO') {
        console.log('[AFF HUB Extension] Video creation request:', event.data);
        chrome.runtime.sendMessage({
          action: 'VIDEO_BROWSER_START',
          payload: {
            imageData: event.data.imageUrl,
            chatgptUrl: event.data.chatgptUrl,
            flowUrl: event.data.flowUrl,
            flowOptions: event.data.flowOptions,
            productId: event.data.productId,
            productName: event.data.productName,
            productContext: event.data.productContext,
          }
        }, (res) => {
          window.postMessage({
            type: 'AFF_VIDEO_STARTED',
            started: res?.started || false,
            error: res?.error || null,
          }, '*');
        });
      }

      // Web app checks current pipeline state
      if (event.data?.type === 'AFF_VIDEO_STATUS') {
        chrome.storage.local.get('videoPipelineState', (result) => {
          window.postMessage({
            type: 'AFF_VIDEO_STATE',
            state: result.videoPipelineState || null,
          }, '*');
        });
      }

      if (event.data?.type === 'AFF_VIDEO_CONTROL') {
        const actions = {
          pause: 'VIDEO_BROWSER_PAUSE',
          resume: 'VIDEO_BROWSER_RESUME',
          cancel: 'VIDEO_BROWSER_CANCEL',
          retry: 'VIDEO_BROWSER_RETRY',
          reset: 'VIDEO_BROWSER_RESET',
        };
        const action = actions[event.data.command];
        if (!action) return;
        chrome.runtime.sendMessage({ action }, (response) => {
          window.postMessage({
            type: 'AFF_VIDEO_CONTROL_RESULT',
            command: event.data.command,
            ok: response?.ok ?? response?.started ?? false,
            error: response?.error || null,
          }, '*');
        });
      }

      // Web app requests commission lookup for a product via Extension
      if (event.data?.type === 'AFF_COMMISSION_LOOKUP') {
        console.log('[AFF HUB Extension] Commission lookup request:', event.data);
        chrome.runtime.sendMessage({
          action: 'COMMISSION_LOOKUP_START',
          payload: {
            productUrl: event.data.productUrl,
            itemId: event.data.itemId,
            lookupId: event.data.lookupId || 'lookup_' + Date.now(),
          }
        }, (res) => {
          window.postMessage({
            type: 'AFF_COMMISSION_STARTED',
            started: res?.started || false,
            error: res?.error || null,
          }, '*');
        });
      }
    });

    // Forward pipeline state changes and commission results back to web app in real-time
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.videoPipelineState) {
        window.postMessage({
          type: 'AFF_VIDEO_STATE',
          state: changes.videoPipelineState.newValue,
        }, '*');
      }
      if (area === 'local' && changes.commissionLookupResult) {
        window.postMessage({
          type: 'AFF_COMMISSION_RESULT',
          result: changes.commissionLookupResult.newValue,
        }, '*');
      }
    });

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
    const platformLabel = isTikTok ? '🎵 TikTok Shop' : '⚡ Shopee';
    header.innerHTML = `
      <span style="font-size: 13px;">${platformLabel} - Đang quét</span>
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
          shop: window.currentShopInfo || { shopId: 'manual', name: 'Manual Scan', platform: isTikTok ? 'TIKTOK' : 'SHOPEE' },
          products: window.pendingProducts,
          platform: isTikTok ? 'TIKTOK' : 'SHOPEE',
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
    } else if (message.action === 'COMMISSION_LOOKUP') {
      handleCommissionLookup(message.lookupId, message.payload);
      sendResponse({ processing: true });
    } else if (message.action === 'AFF_EXTRACT_PRODUCT_DETAILS') {
      extractMarketplaceProductDetailsWithWait()
        .then((details) => sendResponse({ success: true, details }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
  });

  function cleanMarketplaceText(value, maxLength = 4000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function firstMetaContent(selectors) {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute('content');
      if (value) return cleanMarketplaceText(value);
    }
    return '';
  }

  function firstElementText(selectors, maxLength = 4000) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const value = element?.innerText || element?.textContent;
      if (value) return cleanMarketplaceText(value, maxLength);
    }
    return '';
  }

  function parseMarketplaceNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value || '').trim().toLowerCase().replace(/\s/g, '');
    const match = text.match(/([\d.,]+)\s*([km])?/i);
    if (!match) return null;
    let amount = Number(match[1].replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    if (!Number.isFinite(amount)) return null;
    if (match[2] === 'k') amount *= 1000;
    if (match[2] === 'm') amount *= 1000000;
    return Math.round(amount * 100) / 100;
  }

  function findProductJsonLd() {
    const queue = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent || 'null');
        queue.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      } catch {}
    });
    while (queue.length) {
      const item = queue.shift();
      if (!item || typeof item !== 'object') continue;
      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      if (types.some((type) => String(type).toLowerCase() === 'product')) return item;
      if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
    }
    return null;
  }

  function marketplaceSection(pageText, startPattern, endPattern, maxLength = 4000) {
    const start = pageText.search(startPattern);
    if (start < 0) return '';
    const remainder = pageText.slice(start);
    const headingEnd = remainder.indexOf('\n');
    const content = headingEnd >= 0 ? remainder.slice(headingEnd + 1) : remainder;
    const end = content.search(endPattern);
    return cleanMarketplaceText(end >= 0 ? content.slice(0, end) : content, maxLength);
  }

  function marketplaceDetailsSnapshot() {
    const jsonProduct = findProductJsonLd() || {};
    const offer = Array.isArray(jsonProduct.offers) ? jsonProduct.offers[0] || {} : jsonProduct.offers || {};
    const ratingData = jsonProduct.aggregateRating || {};
    const bodyText = document.body?.innerText || '';
    const soldMatch = bodyText.match(/(?:đã bán|sold)\s*([\d.,]+\s*[km]?)/i);
    const stockMatch = bodyText.match(/(?:kho|stock|còn lại)[:\s]*([\d.,]+)/i);
    const breadcrumbItems = [...document.querySelectorAll(
      'nav[aria-label*="breadcrumb" i] a, [data-testid*="breadcrumb" i] a, [class*="breadcrumb"] a, [class*="breadcrumb"] span',
    )]
      .map((element) => cleanMarketplaceText(element.textContent, 100))
      .filter(Boolean)
      .slice(-6);
    const additionalProperties = (Array.isArray(jsonProduct.additionalProperty) ? jsonProduct.additionalProperty : [])
      .slice(0, 20)
      .map((item) => ({ name: cleanMarketplaceText(item?.name, 100), value: cleanMarketplaceText(item?.value, 300) }))
      .filter((item) => item.name && item.value);
    const title = cleanMarketplaceText(
      jsonProduct.name ||
      firstMetaContent(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      firstElementText(['h1', '[data-e2e="product-title"]', '[class*="product-title"]', '[class*="product_name"]']),
      500,
    );
    const descriptionSection = marketplaceSection(
      bodyText,
      /(?:mô tả sản phẩm|product description|description)/i,
      /(?:đánh giá sản phẩm|product reviews?|customer reviews?|sản phẩm tương tự|you may also like)/i,
      5000,
    );
    const detailText = marketplaceSection(
      bodyText,
      /(?:chi tiết sản phẩm|thông tin sản phẩm|product details?|specifications?)/i,
      /(?:mô tả sản phẩm|product description|đánh giá sản phẩm|product reviews?)/i,
      3500,
    );
    const description = cleanMarketplaceText(
      jsonProduct.description ||
      firstElementText([
        '[data-testid="product-description"]', '[data-e2e="product-description"]',
        '[class*="product-description"]', '[class*="product_detail"]', '[class*="product-detail"]',
      ]) || descriptionSection ||
      firstMetaContent(['meta[property="og:description"]', 'meta[name="description"]']),
      5000,
    );
    const brand = typeof jsonProduct.brand === 'object' ? jsonProduct.brand?.name : jsonProduct.brand;
    const seller = offer.seller || jsonProduct.seller || {};
    const priceText = offer.price || offer.lowPrice || firstMetaContent([
      'meta[property="product:price:amount"]', 'meta[itemprop="price"]',
    ]);
    return {
      source: 'marketplace_live_page',
      capturedAt: new Date().toISOString(),
      platform: isTikTok ? 'TIKTOK' : isShopee ? 'SHOPEE' : location.hostname,
      url: document.querySelector('link[rel="canonical"]')?.href || location.href,
      name: title,
      description,
      detailText,
      brand: cleanMarketplaceText(brand, 200),
      sku: cleanMarketplaceText(jsonProduct.sku || jsonProduct.productID, 150),
      price: parseMarketplaceNumber(priceText),
      currency: cleanMarketplaceText(offer.priceCurrency || firstMetaContent(['meta[property="product:price:currency"]']), 20),
      availability: cleanMarketplaceText(offer.availability, 150),
      rating: parseMarketplaceNumber(ratingData.ratingValue || firstMetaContent(['meta[itemprop="ratingValue"]'])),
      reviewCount: parseMarketplaceNumber(ratingData.reviewCount || ratingData.ratingCount),
      sold: parseMarketplaceNumber(soldMatch?.[1]),
      stock: parseMarketplaceNumber(stockMatch?.[1]),
      shopName: cleanMarketplaceText(seller.name || firstElementText([
        '[data-e2e="seller-name"]', '[class*="shop-name"]', '[class*="seller-name"]',
      ]), 300),
      categoryPath: breadcrumbItems,
      specifications: additionalProperties,
      variants: [...new Set([...document.querySelectorAll(
        '[class*="variation"] button, [class*="variation"] [role="button"], [class*="sku"] button, [class*="sku"] [role="button"]',
      )].map((element) => cleanMarketplaceText(element.textContent, 120)).filter(Boolean))].slice(0, 30),
    };
  }

  async function extractMarketplaceProductDetailsWithWait() {
    const pageText = document.body?.innerText || '';
    if (/login required|log in to continue|cần đăng nhập|đăng nhập để tiếp tục/i.test(pageText)) {
      throw new Error('MARKETPLACE_AUTH_REQUIRED: Cần đăng nhập sàn để đọc mô tả chi tiết.');
    }
    if (/captcha|xác minh|verify you are human/i.test(pageText)) {
      throw new Error('MARKETPLACE_VERIFICATION_REQUIRED: Sàn yêu cầu xác minh.');
    }
    const startedAt = Date.now();
    let details = marketplaceDetailsSnapshot();
    while (Date.now() - startedAt < 12000 && !details.name) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      details = marketplaceDetailsSnapshot();
    }
    if (!details.name && !details.description) {
      throw new Error('Không đọc được tên hoặc mô tả sản phẩm từ trang sàn.');
    }
    return details;
  }

  // Extract Shop Header Info
  function extractShopInfo() {
    const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;

    if (isTikTok) {
      const usernameMatch = window.location.pathname.match(/@([a-zA-Z0-9_\.\-]+)/) ||
                            window.location.hostname.match(/([a-zA-Z0-9_\.\-]+)\.tiktok\.com/);
      let shopId = usernameMatch ? usernameMatch[1] : 'tiktok_shop';

      const nameEl =
        document.querySelector('[data-e2e="user-title"]') ||
        document.querySelector('[data-e2e="user-subtitle"]') ||
        document.querySelector('.shop-header-title') ||
        document.querySelector('h1') ||
        document.querySelector('.page-product__shop-name');

      const avatarEl =
        document.querySelector('[data-e2e="user-avatar"] img') ||
        document.querySelector('.shop-avatar img') ||
        document.querySelector('img[class*="avatar"]');

      let shopName = nameEl ? nameEl.innerText.trim() : `@${shopId}`;
      let avatar = avatarEl ? avatarEl.src : '';

      return {
        shopId,
        name: shopName,
        url: canonical,
        avatar,
        platform: 'TIKTOK',
      };
    }

    // Shopee Shop Detection
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
      platform: 'SHOPEE',
    };
  }

  // Extract Products from visible DOM / page structures
  function extractProductsFromPage(shopInfo) {
    const newProducts = [];
    // Select all potential product card elements across Shopee and TikTok
    const cardElements = document.querySelectorAll(
      '.shopee-search-item-result__item, .shop-search-result-view__item, [data-sqe="item"], .shopee-grid-item, a[href*="-i."], [data-e2e="product-card"], a[href*="/view/product/"], div[class*="product-card"], div[class*="ProductCard"], div[class*="showcase-item"], div[class*="goods-item"]'
    );

    cardElements.forEach((card, index) => {
      try {
        let linkEl = null;
        if (isTikTok) {
          linkEl = card.tagName === 'A' ? card : (card.querySelector('a[href*="/view/product/"], a[href*="product_id="], a[href*="/product/"]') || card.querySelector('a'));
        } else {
          linkEl = card.tagName === 'A' ? card : card.querySelector('a[href*="-i."]');
        }

        if (!linkEl && !isTikTok) return;

        const href = linkEl ? (linkEl.getAttribute('href') || '') : '';
        let fullUrl = '';
        if (href) {
          fullUrl = href.startsWith('http') ? href : (isTikTok ? `https://www.tiktok.com${href}` : `https://shopee.vn${href}`);
        } else {
          fullUrl = window.location.href;
        }

        // Parse productId from URL or element attribute
        let productId = '';
        if (isTikTok) {
          const ttIdMatch = href.match(/product\/(\d+)/) || href.match(/product_id=(\d+)/) || href.match(/productId=(\d+)/);
          if (ttIdMatch) {
            productId = ttIdMatch[1];
          } else {
            productId = card.getAttribute('data-product-id') || `tt_${index}_${Date.now()}`;
          }
        } else {
          const idMatch = href.match(/-i\.(\d+)\.(\d+)/) || href.match(/i\.(\d+)\.(\d+)/);
          if (idMatch) {
            productId = idMatch[2];
          } else {
            productId = `p_${href.split('?')[0].split('/').pop()}`;
          }
        }

        const dedupKey = `${shopInfo.shopId}_${productId}`;
        if (collectedProductKeys.has(dedupKey)) return;
        collectedProductKeys.add(dedupKey);

        // Product Name
        const nameEl =
          card.querySelector('[data-sqe="name"]') ||
          card.querySelector('[data-e2e="product-title"]') ||
          card.querySelector('.aria-label') ||
          card.querySelector('.line-clamp-2') ||
          card.querySelector('img[alt]') ||
          linkEl ||
          card;
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

  // ============ COMMISSION LOOKUP VIA AFFILIATE.SHOPEE.VN ============

  // Layer 1: Try GraphQL/REST API for commission data
  async function commissionViaAPI(itemId, shopId) {
    console.log('[AFF HUB] Commission lookup via API for item:', itemId);

    const endpoints = [
      {
        url: 'https://affiliate.shopee.vn/api/v3/gql?q=getOfferByProduct',
        method: 'POST',
        body: { item_id: parseInt(itemId), shop_id: shopId ? parseInt(shopId) : undefined },
      },
      {
        url: 'https://affiliate.shopee.vn/api/v3/gql?q=productOfferInfo',
        method: 'POST',
        body: { item_id: parseInt(itemId) },
      },
      {
        url: `https://affiliate.shopee.vn/api/v3/offer/product/detail?item_id=${itemId}`,
        method: 'GET',
      },
    ];

    for (const endpoint of endpoints) {
      try {
        const options = {
          method: endpoint.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
        };
        if (options.method === 'POST' && endpoint.body) {
          options.body = JSON.stringify(endpoint.body);
        }

        const response = await fetch(endpoint.url, options);
        if (!response.ok) continue;

        const data = await response.json();
        const jsonStr = JSON.stringify(data);

        const result = parseCommissionFromJSON(data, jsonStr);
        if (result && result.commissionRate > 0) {
          console.log('[AFF HUB] Commission found via API:', result);
          return { success: true, source: 'graphql', data: result };
        }
      } catch (e) {
        console.log('[AFF HUB] API endpoint failed:', endpoint.url, e.message);
      }
    }

    throw new Error('All commission API endpoints failed or returned no data');
  }

  function parseCommissionFromJSON(data, jsonStr) {
    const result = {
      commissionRate: 0,
      shopeeRate: 0,
      sellerRate: 0,
      maxCommission: null,
      capStatus: '',
      affiliateProgram: '',
      campaignValidity: '',
      allowAds: null,
      productName: '',
      productImage: '',
    };

    // Try structured access on common response shapes
    const tryPaths = [data, data?.data, data?.data?.result, data?.result, data?.data?.data];
    for (const obj of tryPaths) {
      if (!obj || typeof obj !== 'object') continue;
      // Handle arrays (search results)
      const target = Array.isArray(obj) ? obj[0] : obj;
      if (!target) continue;

      if (target.commission_rate != null) result.commissionRate = parseFloat(target.commission_rate) || 0;
      if (target.commissionRate != null) result.commissionRate = parseFloat(target.commissionRate) || 0;
      if (target.seller_commission_rate != null) result.sellerRate = parseFloat(target.seller_commission_rate) || 0;
      if (target.extra_commission_rate != null) result.sellerRate = parseFloat(target.extra_commission_rate) || 0;
      if (target.shopee_commission_rate != null) result.shopeeRate = parseFloat(target.shopee_commission_rate) || 0;
      if (target.base_commission_rate != null) result.shopeeRate = parseFloat(target.base_commission_rate) || 0;
      if (target.max_commission != null) result.maxCommission = parseFloat(target.max_commission);
      if (target.campaign_name) result.affiliateProgram = target.campaign_name;
      if (target.product_name || target.productName) result.productName = target.product_name || target.productName;
      if (target.image || target.product_image) result.productImage = target.image || target.product_image;
    }

    // Fallback: regex patterns on raw JSON string
    if (!result.commissionRate) {
      const rateMatch = jsonStr.match(/"(?:commission_rate|commissionRate)"[:\s]*"?(\d+\.?\d*)"?/i);
      if (rateMatch) result.commissionRate = parseFloat(rateMatch[1]);
    }

    // Ensure total = shopee + seller if both are present
    if (!result.commissionRate && (result.shopeeRate + result.sellerRate) > 0) {
      result.commissionRate = result.shopeeRate + result.sellerRate;
    }

    return result;
  }

  // Layer 2: DOM Automation on "Hoa hồng Sản phẩm" page
  async function commissionViaDom(productUrl, itemId) {
    console.log('[AFF HUB] Commission lookup via DOM for:', productUrl || itemId);

    // Navigate to product offer page if not already there
    const offerPaths = ['product_offer', 'product-offer', 'offer/product'];
    const isOnOfferPage = offerPaths.some(p => window.location.href.includes(p));

    if (!isOnOfferPage) {
      window.location.href = 'https://affiliate.shopee.vn/offer/product_offer';
      throw new Error('NAVIGATING_TO_PRODUCT_OFFER');
    }

    await new Promise(r => setTimeout(r, 1500));

    // Find search input
    const searchInput = document.querySelector(
      'input[placeholder*="link"], input[placeholder*="Link"], input[placeholder*="URL"], ' +
      'input[placeholder*="sản phẩm"], input[placeholder*="tìm"], input[placeholder*="search"], ' +
      'textarea, input[type="text"], input[type="search"]'
    );

    if (!searchInput) throw new Error('Không tìm thấy ô tìm kiếm trên trang Hoa hồng Sản phẩm');

    // Enter product URL or ID
    const searchTerm = productUrl || `https://shopee.vn/product/0/${itemId}`;
    searchInput.value = '';
    searchInput.focus();

    // Simulate realistic typing via native setter for React compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(searchInput, searchTerm);
    } else {
      searchInput.value = searchTerm;
    }
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise(r => setTimeout(r, 500));

    // Find and click search button
    const buttons = document.querySelectorAll('button, [role="button"]');
    let searchClicked = false;
    for (const btn of buttons) {
      const text = (btn.innerText || btn.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes('tìm') || text.includes('search') || text.includes('tra cứu') || text.includes('kiểm tra') || text.includes('apply')) {
        btn.click();
        searchClicked = true;
        break;
      }
    }

    // Also try pressing Enter as fallback
    if (!searchClicked) {
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
      searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
    }

    // Wait for results to load
    await new Promise(r => setTimeout(r, 3000));

    // Scrape commission data from the results page
    return scrapeCommissionFromPage();
  }

  function scrapeCommissionFromPage() {
    const pageText = document.body.innerText || '';
    const result = {
      commissionRate: 0,
      shopeeRate: 0,
      sellerRate: 0,
      maxCommission: null,
      capStatus: '',
      affiliateProgram: '',
      campaignValidity: '',
      allowAds: null,
      productName: '',
      productImage: '',
    };

    // Commission rate patterns
    const totalMatch = pageText.match(/(?:Tổng hoa hồng|Total Commission|Hoa hồng)[:\s]*(\d+[.,]?\d*)\s*%/i);
    if (totalMatch) result.commissionRate = parseFloat(totalMatch[1].replace(',', '.'));

    const shopeeRateMatch = pageText.match(/(?:Hoa hồng Shopee|Shopee Commission|HH Shopee|Hoa hồng sàn)[:\s]*(\d+[.,]?\d*)\s*%/i);
    if (shopeeRateMatch) result.shopeeRate = parseFloat(shopeeRateMatch[1].replace(',', '.'));

    const sellerRateMatch = pageText.match(/(?:Hoa hồng Seller|Seller Commission|Extra|HH Seller|Hoa hồng shop)[:\s]*(\d+[.,]?\d*)\s*%/i);
    if (sellerRateMatch) result.sellerRate = parseFloat(sellerRateMatch[1].replace(',', '.'));

    // If only partial found, try to derive total
    if (!result.commissionRate && (result.shopeeRate + result.sellerRate) > 0) {
      result.commissionRate = result.shopeeRate + result.sellerRate;
    }

    // Fallback: any percentage that looks like commission from table/card elements
    if (!result.commissionRate) {
      const rows = document.querySelectorAll('tr, [class*="row"], [class*="item"], [class*="card"], [class*="offer"]');
      for (const row of rows) {
        const text = row.innerText || '';
        const rateMatch = text.match(/(\d+[.,]?\d*)\s*%/);
        if (rateMatch) {
          const val = parseFloat(rateMatch[1].replace(',', '.'));
          if (val > 0 && val <= 90) {
            result.commissionRate = val;
            break;
          }
        }
      }
    }

    // Max commission / Cap
    const capMatch = pageText.match(/(?:Cap|Giới hạn|Max|Tối đa|Hoa hồng tối đa)[:\s]*([\d.,]+)\s*(?:₫|đ|VND|k)/i);
    if (capMatch) {
      let capVal = parseFloat(capMatch[1].replace(/[.,]/g, ''));
      if (pageText.match(/(?:Cap|Giới hạn|Max|Tối đa)[:\s]*[\d.,]+\s*k/i)) capVal *= 1000;
      result.maxCommission = capVal;
    }

    const capStatusMatch = pageText.match(/(?:Trạng thái cap|Cap status)[:\s]*([^\n]{3,50})/i);
    if (capStatusMatch) result.capStatus = capStatusMatch[1].trim();

    // Program name
    const progMatch = pageText.match(/(?:Chương trình|Campaign|Program)[:\s]*([^\n]{3,80})/i);
    if (progMatch) result.affiliateProgram = progMatch[1].trim();

    // Campaign validity
    const validMatch = pageText.match(/(?:Hiệu lực|Thời gian|Valid|Hạn)[:\s]*([\d\/\-\.]+\s*[-~đến]+\s*[\d\/\-\.]+)/i);
    if (validMatch) result.campaignValidity = validMatch[1].trim();

    // Product info from page
    const nameEl = document.querySelector('[class*="product-name"], [class*="product_name"], [class*="productName"], h3, h4');
    if (nameEl) result.productName = nameEl.innerText?.trim() || '';

    const imgEl = document.querySelector('[class*="product"] img, [class*="offer"] img');
    if (imgEl) result.productImage = imgEl.src || '';

    return result;
  }

  // Main commission lookup handler
  async function handleCommissionLookup(lookupId, payload) {
    console.log('[AFF HUB] Commission lookup started:', lookupId, payload);
    const { productUrl, itemId } = payload || {};

    if (!productUrl && !itemId) {
      return chrome.runtime.sendMessage({
        action: 'COMMISSION_LOOKUP_RESULT',
        lookupId,
        result: { success: false, error: 'Không có URL hoặc Item ID để tra cứu' },
      });
    }

    // Check auth state
    const currentUrl = window.location.href;
    const pageContent = document.body.innerText.toLowerCase();

    if (currentUrl.includes('/login')) {
      return chrome.runtime.sendMessage({
        action: 'COMMISSION_LOOKUP_RESULT',
        lookupId,
        result: { success: false, error: 'SHOPEE_AUTH_REQUIRED' },
      });
    }

    if (currentUrl.includes('/verify') || pageContent.includes('captcha')) {
      return chrome.runtime.sendMessage({
        action: 'COMMISSION_LOOKUP_RESULT',
        lookupId,
        result: { success: false, error: 'SHOPEE_VERIFICATION_REQUIRED' },
      });
    }

    // Extract item ID from URL if needed
    let resolvedItemId = itemId || '';
    if (!resolvedItemId && productUrl) {
      const match = productUrl.match(/(?:product\/\d+\/|[-/]i\.)(\d+)/);
      if (match) resolvedItemId = match[1];
    }

    // Timeout (20 seconds for commission lookup)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('BROWSER_TIMEOUT')), 20000);
    });

    try {
      const lookupTask = async () => {
        // Layer 1: Try API first (fast)
        try {
          const apiResult = await commissionViaAPI(resolvedItemId, '');
          if (apiResult.success && apiResult.data.commissionRate > 0) {
            return apiResult;
          }
        } catch (e) {
          console.log('[AFF HUB] API commission lookup failed, trying DOM:', e.message);
        }

        // Layer 2: DOM automation fallback (reliable)
        const domResult = await commissionViaDom(productUrl, resolvedItemId);
        return {
          success: domResult.commissionRate > 0,
          source: 'dom_scrape',
          data: domResult,
        };
      };

      const result = await Promise.race([lookupTask(), timeoutPromise]);

      chrome.runtime.sendMessage({
        action: 'COMMISSION_LOOKUP_RESULT',
        lookupId,
        result: {
          success: true,
          source: result.source,
          data: result.data,
          itemId: resolvedItemId,
        },
      });
    } catch (err) {
      console.error('[AFF HUB] Commission lookup failed:', err);
      chrome.runtime.sendMessage({
        action: 'COMMISSION_LOOKUP_RESULT',
        lookupId,
        result: {
          success: false,
          error: err.message === 'NAVIGATING_TO_PRODUCT_OFFER' ? 'NAVIGATING' : err.message,
        },
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
