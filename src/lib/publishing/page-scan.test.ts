import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';

for (const folder of ['extension', 'extension-unified']) {
  it(`${folder}: only returns visible Page avatar links, deduplicates IDs and excludes navigation`, () => {
    const source = readFileSync(`${folder}/publishing.js`, 'utf8');
    const collector = source.slice(source.indexOf('function collectPublishingPages()'), source.indexOf('async function scanPublishingPages()'));
    const link = (href: string, name: string, avatar = true, visible = true) => ({ href, innerText: name, querySelector: () => avatar ? {} : null, getAttribute: () => null, getBoundingClientRect: () => ({ width: visible ? 100 : 0, height: 20 }) });
    const links = [link('https://business.facebook.com/latest/home/?asset_id=123456', 'Page A'), link('https://business.facebook.com/latest/home/?asset_id=123456', 'Page A'), link('https://business.facebook.com/latest/content/?asset_id=987654', 'Nội dung', false), link('https://evil.test/?asset_id=234567', 'Wrong'), link('https://business.facebook.com/?asset_id=345678', 'Hidden', true, false)];
    const context = vm.createContext({ URL, location: { origin: 'https://business.facebook.com', href: 'https://business.facebook.com/latest/home/' }, document: { querySelectorAll: () => links }, getComputedStyle: () => ({ visibility: 'visible' }) });
    const result = vm.runInContext(`${collector}; collectPublishingPages()`, context);
    expect(JSON.parse(JSON.stringify(result))).toEqual([{ pageId: '123456', pageName: 'Page A' }]);
  });
}
