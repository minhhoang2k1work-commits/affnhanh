const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://business.facebook.com/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<button aria-label="Chọn tài sản" aria-haspopup="true">Chọn Page</button><div id="assets" style="display:none"><div><span role="radio" aria-checked="true" style="display:inline-block;width:20px;height:20px"></span><span>Page A</span><div>Facebook</div></div><div><span role="radio" aria-checked="false" style="display:inline-block;width:20px;height:20px"></span><span>Page B</span><div>Facebook</div></div><div><span role="radio" style="display:inline-block;width:20px;height:20px"></span><span>Instagram account</span><div>Instagram</div></div></div>` }));
    await page.goto('https://business.facebook.com/latest/home/?asset_id=123456');
    const source = fs.readFileSync('extension/publishing-assets.js', 'utf8');
    await page.addScriptTag({ content: source.slice(0, source.indexOf('async function syncPublishingAssets')) });
    assert.ok((await page.evaluate(() => inspectPublishingAssets('open'))).point);
    await page.evaluate(() => document.getElementById('assets').style.display = 'block');
    assert.deepEqual(await page.evaluate(() => inspectPublishingAssets('list')), { names: ['Page A', 'Page B'] });
    assert.deepEqual(await page.evaluate(() => inspectPublishingAssets('identity', 'Page A')), { pageId: '123456', pageName: 'Page A' });
    assert.equal((await page.evaluate(() => inspectPublishingAssets('identity', 'Page B'))).waiting, true);
    assert.ok((await page.evaluate(() => inspectPublishingAssets('choose', 'Page B'))).point);
    await page.evaluate(() => { const row = document.getElementById('assets').firstElementChild; row.parentElement.append(row.cloneNode(true)); });
    await assert.rejects(page.evaluate(() => inspectPublishingAssets('choose', 'Page A')), /không duy nhất/);
    console.log('Meta asset DOM fixture: open, list, radio identity, click coordinates, non-Facebook exclusion and ambiguity passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
