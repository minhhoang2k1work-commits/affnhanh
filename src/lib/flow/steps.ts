import { promises as fs } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { AIProviderManager } from '@/lib/ai/providers';
import { aiSessionManager } from '@/lib/ai-browser/session-manager';
import {
  assembleProjectVideo,
  ensureGeneratedProjectDir,
  materializeAsset,
  persistDataUrl,
  toPublicAssetUrl,
} from '@/lib/ai/assets';
import { archiveProjectToGoogleDrive } from '@/lib/storage/archive-project';
import { isGoogleDriveAutoUploadEnabled, isGoogleDriveConfigured } from '@/lib/storage/google-drive';

export type StepInput = Record<string, any>;
export type StepOutput = Record<string, any>;
export type StepHandler = (input: StepInput) => Promise<StepOutput>;

const providerManager = AIProviderManager.getInstance();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getProject(projectId?: string) {
  if (!projectId) throw new Error('This flow step requires a videoProjectId.');
  const project = await db.aIVideoProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Video project not found: ${projectId}`);
  return project;
}

async function getScenes(projectId: string) {
  return db.aIVideoScene.findMany({ where: { projectId }, orderBy: { sceneNumber: 'asc' } });
}

const llm_script: StepHandler = async (input) => {
  const project = await getProject(input.videoProjectId);
  const config = input.stepConfig || {};
  const duration = Number(config.duration || project.duration || 30);
  const provider = await providerManager.getProviderWithFallback('llm');
  let script: any;

  if (provider.mode === 'browser') {
    const session = await aiSessionManager.getAuthenticatedPage(provider.userId, 'chatgpt');
    if (!session) throw new Error('ChatGPT browser session expired.');
    try {
      const { sendPrompt, extractJSON, buildScriptPrompt } = await import('@/lib/ai-browser/chatgpt-driver');
      const prompt = buildScriptPrompt({
        productName: project.title,
        productDescription: project.productDescription || '',
        style: project.style,
        duration,
        language: project.language,
      });
      script = extractJSON((await sendPrompt(session.page, prompt)).response);
    } finally {
      await session.context.close().catch(() => {});
      await session.browser.close().catch(() => {});
    }
  } else {
    const { generateScript } = await import('@/lib/ai/openai-client');
    script = await generateScript({
      productName: project.title,
      productDescription: project.productDescription || '',
      style: project.style,
      duration,
      language: project.language,
      apiKey: provider.apiKey!,
    });
  }

  await db.aIVideoProject.update({
    where: { id: project.id },
    data: { script, llmProvider: `${provider.name}_${provider.mode}` },
  });
  return { script, llmProvider: `${provider.name}_${provider.mode}` };
};

const llm_storyboard: StepHandler = async (input) => {
  const project = await getProject(input.videoProjectId);
  const script = project.script || input.script;
  if (!script) throw new Error('A script is required before storyboard generation.');
  const config = input.stepConfig || {};
  const provider = await providerManager.getProviderWithFallback('llm');
  let scenes: any[];

  if (provider.mode === 'browser') {
    const session = await aiSessionManager.getAuthenticatedPage(provider.userId, 'chatgpt');
    if (!session) throw new Error('ChatGPT browser session expired.');
    try {
      const { sendPrompt, extractJSON, buildStoryboardPrompt } = await import('@/lib/ai-browser/chatgpt-driver');
      const prompt = buildStoryboardPrompt({ script, duration: Number(config.duration || project.duration), style: project.style });
      const storyboard = extractJSON((await sendPrompt(session.page, prompt)).response);
      scenes = storyboard?.scenes || [];
    } finally {
      await session.context.close().catch(() => {});
      await session.browser.close().catch(() => {});
    }
  } else {
    const { generateStoryboard } = await import('@/lib/ai/openai-client');
    const storyboard = await generateStoryboard({
      script: script as any,
      duration: Number(config.duration || project.duration),
      style: project.style,
      apiKey: provider.apiKey!,
    });
    scenes = storyboard.scenes || [];
  }

  if (config.maxScenes) scenes = scenes.slice(0, Number(config.maxScenes));
  if (scenes.length === 0) throw new Error('The LLM returned an empty storyboard.');

  await db.$transaction([
    db.aIVideoScene.deleteMany({ where: { projectId: project.id } }),
    ...scenes.map((scene, index) => db.aIVideoScene.create({
      data: {
        projectId: project.id,
        sceneNumber: index + 1,
        visualPrompt: scene.visualPrompt || scene.visual || '',
        narration: scene.narration || null,
        cameraAngle: scene.cameraAngle || null,
        duration: Math.max(1, Math.round(Number(scene.duration) || 5)),
        transition: scene.transition || 'fade',
      },
    })),
    db.aIVideoProject.update({ where: { id: project.id }, data: { storyboard: scenes as any } }),
  ]);

  return { scenes, storyboard: scenes };
};

const generate_image: StepHandler = async (input) => {
  const project = await getProject(input.videoProjectId);
  const scenes = await getScenes(project.id);
  const productImages = Array.isArray(project.productImages) ? (project.productImages as string[]) : [];

  for (const [index, scene] of scenes.entries()) {
    const referenceImageUrl = scene.referenceImageUrl || productImages[index % Math.max(1, productImages.length)] || null;
    await db.aIVideoScene.update({
      where: { id: scene.id },
      data: { referenceImageUrl, status: 'pending', errorMessage: null },
    });
  }
  return { scenes: await getScenes(project.id), imageCount: productImages.length };
};

async function waitForApiVideo(client: any, taskId: string) {
  const timeoutMs = Number(process.env.VIDEO_GENERATION_TIMEOUT_MS || 20 * 60 * 1000);
  const pollMs = Math.max(5000, Number(process.env.VIDEO_POLL_INTERVAL_MS || 5000));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await client.checkStatus({ taskId });
    if (result.status === 'COMPLETED') {
      if (!result.videoUrl) throw new Error('Video provider completed without a video URL.');
      return result.videoUrl as string;
    }
    if (result.status === 'FAILED') throw new Error(result.error || 'Video provider reported failure.');
    await sleep(pollMs + Math.floor(Math.random() * 1000));
  }
  throw new Error('Video generation timed out. The worker can retry this step.');
}

async function generateBrowserClip(provider: any, scene: any, outputDir: string): Promise<string> {
  const service = provider.name as 'kling' | 'runway' | 'google_aistudio';
  const session = await aiSessionManager.getAuthenticatedPage(provider.userId, service);
  if (!session) throw new Error(`${provider.name} browser session expired.`);
  try {
    let filePath: string | null = null;
    if (service === 'kling') {
      const driver = await import('@/lib/ai-browser/kling-driver');
      const started = await driver.createVideo(session.page, { prompt: scene.visualPrompt, duration: scene.duration >= 8 ? '10' : '5', aspectRatio: '9:16' });
      if (started.status === 'failed') throw new Error(started.error || 'Kling generation could not start.');
      for (let attempt = 0; attempt < 120; attempt++) {
        const status = await driver.checkVideoStatus(session.page);
        if (status.status === 'failed') throw new Error(status.error || 'Kling generation failed.');
        if (status.status === 'completed') { filePath = await driver.downloadVideo(session.page, outputDir); break; }
        await sleep(5000);
      }
    } else if (service === 'runway') {
      const driver = await import('@/lib/ai-browser/runway-driver');
      const started = await driver.createGeneration(session.page, { prompt: scene.visualPrompt, imageUrl: scene.referenceImageUrl || undefined, duration: scene.duration });
      if (started.status === 'failed') throw new Error(started.error || 'Runway generation could not start.');
      for (let attempt = 0; attempt < 120; attempt++) {
        const status = await driver.checkGenerationStatus(session.page);
        if (status.status === 'failed') throw new Error(status.error || 'Runway generation failed.');
        if (status.status === 'completed') { filePath = await driver.downloadResult(session.page, outputDir); break; }
        await sleep(5000);
      }
    } else {
      const driver = await import('@/lib/ai-browser/google-aistudio-driver');
      const started = await driver.generateVideo(session.page, { prompt: scene.visualPrompt });
      if (started.status === 'failed') throw new Error(started.error || 'AI Studio generation could not start.');
      filePath = await driver.waitAndDownload(session.page, outputDir);
    }
    if (!filePath) throw new Error(`${provider.name} did not return a downloadable video.`);
    return toPublicAssetUrl(filePath);
  } finally {
    await session.context.close().catch(() => {});
    await session.browser.close().catch(() => {});
  }
}

const generate_video: StepHandler = async (input) => {
  const project = await getProject(input.videoProjectId);
  const scenes = await getScenes(project.id);
  if (scenes.length === 0) throw new Error('Storyboard scenes are required before video generation.');
  const config = input.stepConfig || {};
  const provider = await providerManager.getProviderWithFallback('video');
  const outputDir = await ensureGeneratedProjectDir(project.id);
  let cost = 0;
  const videoClient = provider.mode === 'api' ? await providerManager.getVideoClient(provider.name) : null;

  for (const scene of scenes) {
    await db.aIVideoScene.update({ where: { id: scene.id }, data: { status: 'generating_video', errorMessage: null } });
    try {
      let videoClipUrl: string;
      if (provider.mode === 'browser') {
        videoClipUrl = await generateBrowserClip(provider, scene, outputDir);
      } else {
        const client = videoClient!;
        const task = await client.generateVideo({
          prompt: scene.visualPrompt,
          referenceImageUrl: scene.referenceImageUrl || undefined,
          duration: scene.duration,
          aspectRatio: config.aspectRatio || '9:16',
        });
        const remoteUrl = await waitForApiVideo(client, task.taskId);
        const localPath = path.join(outputDir, `scene-${scene.sceneNumber}-video.mp4`);
        if (remoteUrl.startsWith('gs://') && client.downloadVideo) {
          await fs.writeFile(localPath, await client.downloadVideo(remoteUrl));
        } else {
          await materializeAsset(remoteUrl, localPath);
        }
        videoClipUrl = toPublicAssetUrl(localPath);
        cost += Number(client.getEstimatedCost(scene.duration, config.quality || 'standard') || 0);
      }
      await db.aIVideoScene.update({ where: { id: scene.id }, data: { videoClipUrl, status: 'pending' } });
    } catch (error: any) {
      await db.aIVideoScene.update({ where: { id: scene.id }, data: { status: 'failed', errorMessage: error.message } });
      throw error;
    }
  }

  await db.aIVideoProject.update({ where: { id: project.id }, data: { videoProvider: `${provider.name}_${provider.mode}` } });
  return { scenes: await getScenes(project.id), videoProvider: `${provider.name}_${provider.mode}`, cost };
};

const generate_voice: StepHandler = async (input) => {
  const project = await getProject(input.videoProjectId);
  const scenes = await getScenes(project.id);
  const client = await providerManager.getVoiceoverClient();
  const config = input.stepConfig || {};
  const outputDir = await ensureGeneratedProjectDir(project.id);
  let cost = 0;

  for (const scene of scenes) {
    if (!scene.narration?.trim()) continue;
    await db.aIVideoScene.update({ where: { id: scene.id }, data: { status: 'generating_voice', errorMessage: null } });
    try {
      const result = await client.generateVoiceover({ text: scene.narration, language: project.language, voiceId: config.voiceId });
      const voicePath = path.join(outputDir, `scene-${scene.sceneNumber}-voice.mp3`);
      await persistDataUrl(result.audioUrl, voicePath);
      const voiceoverUrl = toPublicAssetUrl(voicePath);
      cost += client.getEstimatedCost(scene.narration.length);
      await db.aIVideoScene.update({ where: { id: scene.id }, data: { voiceoverUrl, status: 'pending' } });
    } catch (error: any) {
      await db.aIVideoScene.update({ where: { id: scene.id }, data: { status: 'failed', errorMessage: error.message } });
      throw error;
    }
  }

  await db.aIVideoProject.update({ where: { id: project.id }, data: { voiceProvider: client.providerName } });
  return { scenes: await getScenes(project.id), voiceProvider: client.providerName, cost };
};

const assemble: StepHandler = async (input) => {
  const project = await getProject(input.videoProjectId);
  const scenes = await getScenes(project.id);
  const result = await assembleProjectVideo(project.id, scenes, input.stepConfig?.aspectRatio || '9:16');
  await db.$transaction([
    db.aIVideoProject.update({
      where: { id: project.id },
      data: { videoUrl: result.videoUrl, thumbnailUrl: result.thumbnailUrl, videoDuration: result.totalDuration },
    }),
    ...scenes.map((scene) => db.aIVideoScene.update({ where: { id: scene.id }, data: { status: 'completed', errorMessage: null } })),
  ]);
  return result;
};

const upload_drive: StepHandler = async (input) => {
  const project = await getProject(input.videoProjectId);
  if (!(await isGoogleDriveAutoUploadEnabled(project.userId))) {
    return { provider: 'google_drive', uploaded: false, reason: 'automatic_upload_disabled' };
  }
  if (!(await isGoogleDriveConfigured(project.userId))) {
    throw new Error('Google Drive automatic upload is enabled but OAuth credentials are missing.');
  }
  return archiveProjectToGoogleDrive(project.id, project.userId);
};

const notify: StepHandler = async (input) => {
  console.log(`[Flow] Video project ${input.videoProjectId} completed.`);
  return { notified: true, notifiedAt: new Date().toISOString() };
};

export const stepHandlers: Record<string, StepHandler> = {
  llm_script,
  llm_storyboard,
  generate_image,
  generate_video,
  generate_voice,
  assemble,
  upload_drive,
  notify,
};
