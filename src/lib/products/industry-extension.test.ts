import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('extension project reuse and explicit prompt submission', () => {
  for (const file of ['extension/flow-content.js', 'extension-unified/content-flow-aff.js']) {
    it(`${file}: never creates a project when the saved project is unavailable`, async () => {
      const context = vm.createContext({ chrome: { runtime: { onMessage: { addListener() {} } } }, console });
      vm.runInContext(readFileSync(file, 'utf8'), context);
      const create = vi.fn();
      Object.assign(context, { getComposerContext: () => null, waitForComposer: async () => { throw new Error('project unavailable'); }, findInteractiveByText: create });
      await expect(context.ensureProjectReady(true)).rejects.toThrow('project unavailable');
      expect(create).not.toHaveBeenCalled();
    });
  }
  for (const file of ['extension/chatgpt-content.js', 'extension-unified/content-chatgpt.js']) {
    it(`${file}: sends text-only prompts once and preserves an existing draft`, async () => {
      let listener: any;
      const context = vm.createContext({ chrome: { runtime: { onMessage: { addListener(fn: any) { listener = fn; } } } }, console });
      vm.runInContext(readFileSync(file, 'utf8'), context);
      let sent = false;
      const send = vi.fn(async () => { sent = true; });
      Object.assign(context, {
        waitForElement: async () => ({ value: '', innerText: '' }),
        document: { querySelector: () => null, querySelectorAll: () => sent ? [{}] : [] },
        setEditorText: vi.fn(), sleep: async () => {}, clickSend: send, location: { href: 'https://chatgpt.com/c/demo' },
      });
      const result = await new Promise<any>(resolve => listener({ action: 'CHATGPT_SEND_PROMPT', prompt: 'My brief' }, {}, resolve));
      expect(result.success).toBe(true);
      expect(send).toHaveBeenCalledTimes(1);
      context.waitForElement = async () => ({ value: 'Unsaved draft' });
      const blocked = await new Promise<any>(resolve => listener({ action: 'CHATGPT_SEND_PROMPT', prompt: 'Another brief' }, {}, resolve));
      expect(blocked.success).toBe(false);
      expect(blocked.error).toContain('bản nháp');
      expect(send).toHaveBeenCalledTimes(1);
    });
  }
});
