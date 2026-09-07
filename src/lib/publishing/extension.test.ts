import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function setup(file: string) {
  const session: Record<string, any> = {};
  const chrome = {
    runtime: { onMessage: { addListener() {} }, getPlatformInfo: vi.fn(async () => ({})) },
    storage: {
      local: { get: async () => ({ serverUrl: 'https://aff.example' }) },
      session: { get: async (key: string) => ({ [key]: session[key] }), set: async (values: object) => { Object.assign(session, values); } },
    },
    tabs: { update: vi.fn(async () => ({})) },
    debugger: { attach: vi.fn(async () => {}), detach: vi.fn(async () => {}), sendCommand: vi.fn(async () => ({})) },
  };
  const context = vm.createContext({ chrome, URL, console, setInterval, clearInterval, setTimeout });
  vm.runInContext(readFileSync(file, 'utf8'), context);
  context.publishingInspect = vi.fn(async () => ({ button: { x: 50, y: 50 } }));
  context.publishingReceiptLinks = async () => [];
  context.waitPublishingReceipt = async () => null;
  return { context, session, chrome };
}
const sender = { url: 'https://aff.example/ai-video/p', frameId: 0 };

describe('publishing extension', () => {
  for (const file of ['extension/chatgpt-content.js', 'extension-unified/content-chatgpt.js']) {
    it(`${file}: returns the new answer for copy generation without sending twice`, async () => {
      let listener: any;
      let sent = false;
      const wait = vi.fn(async () => '{"title":"A","caption":"B","hashtags":[]}');
      const context = vm.createContext({ chrome: { runtime: { onMessage: { addListener(fn: any) { listener = fn; } } } }, console });
      vm.runInContext(readFileSync(file, 'utf8'), context);
      const click = vi.fn(async () => { sent = true; });
      Object.assign(context, {
        waitForElement: async () => ({ value: '' }),
        document: { querySelector: () => null, querySelectorAll: () => sent ? [{}] : [] },
        setEditorText: vi.fn(), sleep: async () => {}, clickSend: click,
        waitForCompletion: wait, location: { href: 'https://chatgpt.com/c/test' },
      });
      const result = await new Promise<any>(resolve => listener({ action: 'CHATGPT_SEND_PROMPT', prompt: 'Product description', waitForResponse: true }, {}, resolve));
      expect(result.responseText).toContain('"title":"A"');
      expect(wait).toHaveBeenCalledWith(0, 210000, false);
      expect(click).toHaveBeenCalledTimes(1);
    });
  }
  for (const file of ['extension/publishing.js', 'extension-unified/publishing.js']) {
    it(`${file}: blocks foreign origins, frames and unsafe media`, async () => {
      const { context } = setup(file);
      await expect(context.dispatchPublishing({ operation: 'OPEN' }, { ...sender, url: 'https://evil.example' })).rejects.toThrow('AFF');
      await expect(context.dispatchPublishing({ operation: 'OPEN' }, { ...sender, frameId: 1 })).rejects.toThrow('AFF');
      for (const value of ['https://evil.example/generated/a.mp4', 'https://aff.example/api/private.mp4', 'https://aff.example/generated/../private.mp4', 'https://aff.example/generated/a.mp4?token=secret']) expect(() => context.publishingVideo(value, 'https://aff.example')).toThrow();
      expect(context.publishingVideo('https://aff.example/generated/p/final.mp4', 'https://aff.example')).toContain('final.mp4');
    });
    it(`${file}: persists consumption before click and cannot publish the same token twice`, async () => {
      const { context, session, chrome } = setup(file);
      session['affReel:token'] = { tabId: 10, origin: 'https://aff.example', state: 'prepared', expires: Date.now() + 60000, payload: {} };
      chrome.debugger.sendCommand.mockImplementation(async () => { expect(session['affReel:token'].state).toBe('submitted_unknown'); return {}; });
      const result = await context.dispatchPublishing({ operation: 'SUBMIT', payload: { token: 'token' } }, sender);
      expect(result.status).toBe('submitted_unknown'); expect(chrome.debugger.sendCommand).toHaveBeenCalledTimes(2);
      await expect(context.dispatchPublishing({ operation: 'SUBMIT', payload: { token: 'token' } }, sender)).rejects.toThrow('đã gửi');
      expect(chrome.debugger.sendCommand).toHaveBeenCalledTimes(2);
    });
    it(`${file}: does not click if the Page or content check fails`, async () => {
      const { context, session, chrome } = setup(file);
      session['affReel:token'] = { tabId: 10, origin: 'https://aff.example', state: 'prepared', expires: Date.now() + 60000, payload: {} };
      context.publishingInspect = async () => { throw new Error('Wrong Page'); };
      await expect(context.dispatchPublishing({ operation: 'SUBMIT', payload: { token: 'token' } }, sender)).rejects.toThrow('Wrong Page');
      expect(chrome.debugger.sendCommand).not.toHaveBeenCalled();
    });
    it(`${file}: preserves unknown status after a lost click response`, async () => {
      const { context, session, chrome } = setup(file);
      session['affReel:token'] = { tabId: 10, origin: 'https://aff.example', state: 'prepared', expires: Date.now() + 60000, payload: {} };
      chrome.debugger.sendCommand.mockRejectedValue(new Error('Disconnected'));
      await expect(context.dispatchPublishing({ operation: 'SUBMIT', payload: { token: 'token' } }, sender)).rejects.toThrow('Disconnected');
      expect(session['affReel:token'].state).toBe('submitted_unknown'); expect(chrome.debugger.detach).toHaveBeenCalled();
    });
  }
});
