import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export type AutoCutTemplate = { id: string; name: string; duration: number; slots: number; digest: string };
export type WorkerStatus = { online: boolean; checkedAt?: string; state: string; templates: AutoCutTemplate[]; error?: string };
export const queueRoot = () => path.join(process.cwd(), '.autocut');
export async function workerStatus(): Promise<WorkerStatus> {
  try {
    const value = JSON.parse(await fs.readFile(path.join(queueRoot(), 'worker.json'), 'utf8'));
    const age = Date.now() - Date.parse(value.checkedAt);
    if (!Number.isFinite(age) || age < -5000 || age > 20000) throw new Error();
    return { online: true, checkedAt: value.checkedAt, state: value.state, templates: Array.isArray(value.templates) ? value.templates : [], error: value.error };
  } catch { return { online: false, state: 'offline', templates: [], error: 'Chưa nhận heartbeat từ worker AutoCut. Mở phiên AutoCut dành riêng cho AFF.' }; }
}
export function jobIdFor(runId: string, attempt: number) { return createHash('sha256').update(`${runId}:${attempt}`).digest('hex'); }
export async function localGeneratedVideo(url: string) {
  if (!/^\/generated\/[a-zA-Z0-9_./-]+\.mp4$/.test(url)) throw new Error('AutoCut chỉ nhận MP4 đã tải về thư mục generated của AFF.');
  const root = await fs.realpath(path.join(process.cwd(), 'public', 'generated'));
  const target = await fs.realpath(path.join(process.cwd(), 'public', url.slice(1)));
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Video nằm ngoài thư mục AFF cho phép.');
  return target;
}
export type RenderRequest = { version: 1; id: string; projectId: string; templateId: string; templateDigest: string; sourcePath: string; outputPath: string; createdAt: string };
export async function enqueueRender(request: RenderRequest) {
  const folder = path.join(queueRoot(), 'requests'); await fs.mkdir(folder, { recursive: true });
  const target = path.join(folder, `${request.id}.json`);
  const temporary = path.join(folder, `${request.id}.${randomUUID()}.tmp`);
  await fs.writeFile(temporary, JSON.stringify(request));
  try { await fs.link(temporary, target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  finally { await fs.unlink(temporary); }
}
export async function renderResult(id: string): Promise<{ id: string; status: 'completed' | 'failed'; error?: string } | null> {
  try { return JSON.parse(await fs.readFile(path.join(queueRoot(), 'results', `${id}.json`), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
