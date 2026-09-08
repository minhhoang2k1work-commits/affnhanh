import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { db } from '../db';
import { FlowWaiting } from '../flow/waiting';
import { inspectImportedVideo, validateMp4Header } from '../publishing/media';
export async function generateGoogleFlow(runId: string) {
  const run = await db.flowRun.findUnique({ where: { id: runId } });
  if (!run?.videoProjectId) throw new Error('Không tìm thấy dự án Google Flow.');
  const project = await db.aIVideoProject.findFirst({ where: { id: run.videoProjectId, userId: run.userId }, include: { scenes: { orderBy: { sceneNumber: 'asc' } } } });
  if (!project?.scenes.length) throw new Error('Cần storyboard trước khi gửi Google Flow.');
  const outputDir = path.join(process.cwd(), 'public', 'generated', project.id);
  await fs.mkdir(outputDir, { recursive: true });
  for (const scene of project.scenes) {
    if (scene.videoClipUrl) continue;
    const key = createHash('sha256').update(`${run.id}:${(run.inputData as { handoffAttempt?: string })?.handoffAttempt || 'initial'}:${scene.id}`).digest('hex');
    let response: Response;
    try { response = await fetch('http://127.0.0.1:8766/aff_flow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, prompt: scene.visualPrompt }), signal: AbortSignal.timeout(10000) }); }
    catch { throw new FlowWaiting('Đang chờ AutoCut REST/Google Flow kết nối.'); }
    if (response.status === 409 || response.status === 503) throw new FlowWaiting('Google Flow chưa sẵn sàng hoặc đang xử lý cảnh khác.');
    if (!response.ok) throw new Error('AutoCut chưa có endpoint Google Flow handoff hoặc từ chối yêu cầu.');
    const result = await response.json();
    if (result.key !== key) throw new Error('Kết quả Google Flow không khớp cảnh.');
    if (result.status === 'failed') throw new Error(result.error || 'Google Flow không tạo được video.');
    if (result.status !== 'completed') throw new FlowWaiting(`Google Flow đang tạo cảnh ${scene.sceneNumber}.`);
    const root = await fs.realpath(path.join(os.homedir(), 'Downloads', `aff-${key}`, 'text_to_video'));
    const file = await fs.realpath(result.filePath);
    if (path.dirname(file) !== root || path.extname(file).toLowerCase() !== '.mp4') throw new Error('Tệp Google Flow nằm ngoài thư mục của cảnh.');
    const handle = await fs.open(file, 'r');
    try { const header = Buffer.alloc(12); await handle.read(header, 0, 12, 0); validateMp4Header(header); } finally { await handle.close(); }
    await inspectImportedVideo(file);
    const filename = `flow-${scene.sceneNumber}.mp4`;
    await fs.copyFile(file, path.join(outputDir, filename));
    await db.aIVideoScene.update({ where: { id: scene.id }, data: { videoClipUrl: `/generated/${project.id}/${filename}`, status: 'pending', errorMessage: null } });
  }
  await db.aIVideoProject.update({ where: { id: project.id }, data: { videoProvider: 'google_flow_extension' } });
  return { videoProvider: 'google_flow_extension' };
}
