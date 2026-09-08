import { db } from '../db';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FlowWaiting } from '../flow/waiting';
import { inspectImportedVideo, validateMp4Header } from '../publishing/media';
import { enqueueRender, jobIdFor, localGeneratedVideo, renderResult, workerStatus } from './queue';
export async function renderAutoCut(runId: string) {
  const run = await db.flowRun.findUnique({ where: { id: runId }, include: { stepRuns: true } });
  const options = (run?.inputData as { autoCut?: { templateId: string; templateDigest: string } })?.autoCut;
  if (!run?.videoProjectId || !options) throw new Error('Thiếu cấu hình template AutoCut của đợt video.');
  const project = await db.aIVideoProject.findFirst({ where: { id: run.videoProjectId, userId: run.userId } });
  if (!project?.videoUrl) throw new Error('Chưa có video nguồn để dựng AutoCut.');
  const attempt = run.stepRuns.find(step => step.stepType === 'autocut_render')?.retryCount || 0;
  const id = jobIdFor(`${run.id}:${(run.inputData as { handoffAttempt?: string })?.handoffAttempt || 'initial'}`, attempt);
  const result = await renderResult(id);
  const outputUrl = `/generated/publishing/${id}.mp4`;
  if (result) {
    if (result.id !== id || result.status !== 'completed') throw new Error(result.error || 'AutoCut không hoàn tất render.');
    const file = await localGeneratedVideo(outputUrl);
    const handle = await fs.open(file, 'r');
    try { const header = Buffer.alloc(12); await handle.read(header, 0, 12, 0); validateMp4Header(header); } finally { await handle.close(); }
    const duration = await inspectImportedVideo(file);
    await db.aIVideoProject.update({ where: { id: project.id }, data: { videoUrl: outputUrl, videoDuration: duration } });
    return { videoUrl: outputUrl, totalDuration: duration, autoCutJobId: id };
  }
  const status = await workerStatus();
  if (!status.online || status.state === 'blocked') throw new FlowWaiting(status.error || 'Đang chờ worker AutoCut.');
  if (!status.templates.some(t => t.id === options.templateId && t.digest === options.templateDigest)) throw new Error('Template đã thay đổi hoặc không còn tồn tại. Chọn lại template cho đợt mới.');
  const outputPath = path.join(process.cwd(), 'public', 'generated', 'publishing', `${id}.mp4`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await enqueueRender({ version: 1, id, projectId: project.id, templateId: options.templateId, templateDigest: options.templateDigest, sourcePath: await localGeneratedVideo(project.videoUrl), outputPath, createdAt: new Date().toISOString() });
  throw new FlowWaiting('AutoCut đang nhận việc, áp template và xuất MP4 vào thư mục chờ.');
}
