import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function setup(file: string) {
  const local: Record<string, any> = { serverUrl: 'https://aff.example' };
  const record = { tabId: 1, payload: { text: 'Approved text' } };
  const commands: string[] = [];
  const chrome = {
    runtime: { getPlatformInfo: async () => ({}), onStartup: { addListener() {} }, onInstalled: { addListener() {} } },
    alarms: { get: async () => ({}), create: async () => {}, onAlarm: { addListener() {} } },
    storage: {
      local: { get: async () => local, set: async (v: any) => Object.assign(local, v), remove: async (key: string) => { delete local[key]; } },
      session: { get: async (key: string) => key === 'affReelTab' ? { affReelTab: { tabId: 1 } } : { [key]: record } },
    },
  };
  let claimed = false;
  const requests = vi.fn(async (op: string, body?: any): Promise<any> => {
    if (op === 'claim') {
      if (claimed) return { job: null };
      claimed = true;
      return { job: { id: 'post', leaseToken: 'lease', pageId: '123456', pageName: 'Page', videoUrl: '/generated/final.mp4', text: 'Approved text' } };
    }
    if (body?.phase === 'before_submit') return { allowed: true };
    return {};
  });
  const dispatch = vi.fn(async (msg: any): Promise<any> => { commands.push(msg.operation); return msg.operation === 'PREPARE' ? { success: true, token: 'token' } : msg.operation === 'SUBMIT' ? { success: true, status: 'published', permalink: 'https://www.facebook.com/reel/123456', message: 'Published' } : { success: true }; });
  const context = vm.createContext({ chrome, URL, AbortSignal, setInterval, clearInterval, publishingBusy: false, publishingSleep: async () => {}, publishingInspect: async () => ({}), dispatchPublishing: dispatch });
  vm.runInContext(readFileSync(file, 'utf8'), context);
  context.publishingWorkerFetch = requests;
  return { context, local, requests, dispatch, commands };
}

describe('Chrome scheduled publishing worker', () => {
  for (const file of ['extension/publishing-worker.js', 'extension-unified/publishing-worker.js']) {
    it(`${file}: prepares then consumes server permission before publishing`, async () => {
      const { context, requests, dispatch, commands, local } = setup(file);
      dispatch.mockImplementation(async (msg: any) => {
        commands.push(msg.operation);
        if (msg.operation === 'SUBMIT') expect(requests.mock.calls.some(([, body]) => body?.phase === 'before_submit')).toBe(true);
        return msg.operation === 'PREPARE' ? { success: true, token: 'token' } : msg.operation === 'SUBMIT' ? { success: true, status: 'published', permalink: 'https://www.facebook.com/reel/123456' } : { success: true };
      });
      await context.runPublishingQueue();
      expect(commands).toEqual(['OPEN', 'PREPARE', 'SUBMIT']);
      expect(requests.mock.calls.some(([, body]) => body?.phase === 'published')).toBe(true);
      expect(local.affPublishingActive).toBeUndefined();
    });
    it(`${file}: never clicks publish when server permission is rejected`, async () => {
      const { context, requests, commands } = setup(file);
      const original = requests.getMockImplementation()!;
      requests.mockImplementation(async (op, body) => { if (body?.phase === 'before_submit') throw new Error('Page paused'); return original(op, body); });
      await context.runPublishingQueue();
      expect(commands).not.toContain('SUBMIT');
      expect(requests.mock.calls.some(([, body]) => body?.phase === 'failed')).toBe(true);
    });
    it(`${file}: persists a receipt during network failure and only reports it after restart`, async () => {
      const { context, local, requests, commands } = setup(file);
      const original = requests.getMockImplementation()!;
      let disconnected = true;
      requests.mockImplementation(async (op, body) => { if (body?.phase === 'published' && disconnected) throw new Error('Network lost'); return original(op, body); });
      await context.runPublishingQueue();
      expect(local.affPublishingActive.report.phase).toBe('published');
      disconnected = false;
      await context.runPublishingQueue();
      expect(commands.filter(c => c === 'SUBMIT')).toHaveLength(1);
      expect(local.affPublishingActive).toBeUndefined();
    });
    it(`${file}: reports interrupted work instead of resuming a click`, async () => {
      const { context, local, requests, commands } = setup(file);
      local.affPublishingActive = { origin: 'https://aff.example', id: 'old', leaseToken: 'old-lease' };
      requests.mockImplementation(async (op) => op === 'claim' ? { job: null } : {});
      await context.runPublishingQueue();
      expect(commands).toEqual([]);
      expect(requests.mock.calls[0]).toEqual(['report', expect.objectContaining({ id: 'old', phase: 'failed' })]);
    });
  }
});
