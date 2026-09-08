import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { enqueueRender, jobIdFor, localGeneratedVideo, workerStatus } from './queue';
const dirs: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const dir of dirs.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });
async function workspace() { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aff-queue-test-')); dirs.push(root); vi.spyOn(process, 'cwd').mockReturnValue(root); return root; }
describe('durable AutoCut queue', () => {
  it('reports missing and stale heartbeats offline', async () => {
    const root = await workspace();
    expect((await workerStatus()).online).toBe(false);
    await fs.mkdir(path.join(root, '.autocut'));
    await fs.writeFile(path.join(root, '.autocut/worker.json'), JSON.stringify({checkedAt:'2020-01-01', templates:[]}));
    expect((await workerStatus()).online).toBe(false);
  });
  it('publishes a complete immutable request once under concurrent submit', async () => {
    const root = await workspace(); const id=jobIdFor('run',0);
    const job={version:1 as const,id,projectId:'project',templateId:'template',templateDigest:'digest',sourcePath:'source',outputPath:'output',createdAt:'now'};
    await Promise.all([enqueueRender(job),enqueueRender(job)]);
    expect(JSON.parse(await fs.readFile(path.join(root,'.autocut/requests',`${id}.json`),'utf8'))).toEqual(job);
    expect(await fs.readdir(path.join(root,'.autocut/requests'))).toEqual([`${id}.json`]);
    expect(jobIdFor('run',1)).not.toBe(id);
  });
  it('rejects traversal outside generated and remote inputs', async () => {
    const root=await workspace(); await fs.mkdir(path.join(root,'public/generated'),{recursive:true});
    await fs.writeFile(path.join(root,'private.mp4'),'private');
    await expect(localGeneratedVideo('/generated/../../private.mp4')).rejects.toThrow();
    await expect(localGeneratedVideo('https://example.com/a.mp4')).rejects.toThrow();
  });
});
