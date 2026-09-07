const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const directory of ['extension', 'extension-unified']) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { window.chrome = { storage: { local: { get: async () => ({ serverUrl: 'https://aff.test', deviceToken: 'test-device', licenseKey: 'test-license' }) } } }; });
      let fail = false;
      await page.route('https://aff.test/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/publishing/worker') {
          const request = route.request().postDataJSON();
          assert.equal(request.operation, 'history');
          if (fail) return route.fulfill({ status: 503, json: { error: 'Máy chủ đang tắt' } });
          const states = request.filter === 'failed' ? ['needs_attention'] : ['published', 'needs_attention', 'submitted_unknown'];
          return route.fulfill({ json: { posts: states.map((status, i) => ({ id: String(i), title: '<img src=x onerror=alert(1)> Video mẫu', status, channel: { name: 'Page thử nghiệm', profileName: 'Chrome A' }, createdAt: '2026-09-07T02:00:00Z', error: status === 'needs_attention' ? 'Không tìm thấy nút tải video' : null, permalink: status === 'published' ? 'https://www.facebook.com/reel/123456' : 'javascript:alert(1)', events: [{ status, message: 'Nội dung kiểm tra', createdAt: '2026-09-07T02:00:00Z' }] })), counts: { published: 1, needs_attention: 1, submitted_unknown: 1 }, total: 21, page: request.page, hasMore: request.page === 0, syncedAt: '2026-09-07T02:00:00Z' } });
        }
        const file = path.join(directory, path.basename(url.pathname));
        return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
      });
      await page.goto('https://aff.test/publishing-history.html');
      await page.locator('article').nth(2).waitFor();
      assert.equal(await page.locator('article img').count(), 0);
      assert.equal(await page.locator('article a').count(), 1);
      await page.locator('#filter').selectOption('failed');
      await page.waitForFunction(() => document.querySelectorAll('article').length === 1);
      assert.match(await page.locator('article').innerText(), /Không tìm thấy nút/);
      await page.locator('#next').click();
      await page.waitForFunction(() => document.getElementById('pagination').textContent.includes('Trang 2'));
      assert.equal(await page.locator('#next').isDisabled(), true);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      fail = true; await page.locator('#refresh').click();
      await page.waitForFunction(() => document.getElementById('notice').textContent.includes('Máy chủ đang tắt'));
      assert.equal(await page.locator('article').count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${directory}: history rendering, filters, pagination, XSS, mobile and errors passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
