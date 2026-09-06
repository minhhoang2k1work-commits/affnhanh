const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || 'msedge' });
  try {
    for (const file of ['extension/content.js', 'extension-unified/content-marketplace.js']) {
      const page = await browser.newPage();
      await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<main><h1>Cotton shirt</h1><div class="product-description">Soft cotton shirt</div><div class="shipping-info">Ships in 2 days</div><div class="review-item"><div class="content">Soft fabric</div><div class="variation">Blue M</div></div><script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Cotton shirt', description: 'x'.repeat(9000), image: ['https://example.com/shirt.jpg'], additionalProperty: [{ name: 'Material', value: 'Cotton' }], offers: { price: 120000, priceCurrency: 'VND' } })}</script></main>` }));
      await page.goto('https://shopee.vn/product/1/2');
      await page.evaluate(() => { window.chrome = { runtime: { onMessage: { addListener(fn) { window.collectorListener = fn; } }, sendMessage() {} } }; });
      await page.addScriptTag({ path: path.resolve(file) });
      const result = await page.evaluate(() => new Promise(resolve => window.collectorListener({ action: 'AFF_EXTRACT_PRODUCT_DETAILS' }, {}, resolve)));
      assert.equal(result.success, true);
      assert.equal(result.details.description.length, 9000);
      assert.equal(result.details.price, 120000);
      assert.deepEqual(result.details.images, ['https://example.com/shirt.jpg']);
      assert.equal(result.details.specifications[0].value, 'Cotton');
      assert.equal(result.details.reviews[0].text, 'Soft fabric');
      assert.ok(result.details.missingFields.includes('videos'));
      console.log('PASS', file, 'long description, images, specifications, reviews, missing fields');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
