import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegStatic from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

export type AssemblableScene = {
  sceneNumber: number;
  duration: number;
  videoClipUrl?: string | null;
  voiceoverUrl?: string | null;
};

export function generatedProjectDir(projectId: string): string {
  return path.join(process.cwd(), 'public', 'generated', projectId);
}

export function toPublicAssetUrl(filePath: string): string {
  const relative = path.relative(path.join(process.cwd(), 'public'), filePath).split(path.sep).join('/');
  return `/${relative}`;
}

export async function ensureGeneratedProjectDir(projectId: string): Promise<string> {
  const directory = generatedProjectDir(projectId);
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export async function persistDataUrl(dataUrl: string, outputPath: string): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error('Unsupported data URL.');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(match[2], 'base64'));
  return outputPath;
}

export async function materializeAsset(assetUrl: string, outputPath: string): Promise<string> {
  if (assetUrl.startsWith('data:')) return persistDataUrl(assetUrl, outputPath);
  if (assetUrl.startsWith('/')) {
    const localPath = path.join(process.cwd(), 'public', assetUrl.replace(/^\/+/, ''));
    await fs.access(localPath);
    return localPath;
  }
  if (/^https?:\/\//i.test(assetUrl)) {
    const response = await fetch(assetUrl);
    if (!response.ok) throw new Error(`Could not download generated asset (${response.status}).`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    return outputPath;
  }
  await fs.access(assetUrl);
  return assetUrl;
}

function ffmpegExecutable(): string {
  const executable = process.env.FFMPEG_PATH || ffmpegStatic;
  if (!executable) throw new Error('FFmpeg is unavailable. Install ffmpeg-static or set FFMPEG_PATH.');
  return executable;
}

async function runFfmpeg(args: string[]): Promise<void> {
  try {
    await execFileAsync(ffmpegExecutable(), args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  } catch (error: any) {
    const detail = error?.stderr?.toString().split(/\r?\n/).slice(-8).join('\n');
    throw new Error(`FFmpeg failed${detail ? `: ${detail}` : '.'}`);
  }
}

export async function assembleProjectVideo(
  projectId: string,
  scenes: AssemblableScene[],
  aspectRatio = '9:16',
): Promise<{ videoUrl: string; thumbnailUrl: string; totalDuration: number }> {
  if (scenes.length === 0) throw new Error('No generated scenes are available to assemble.');
  const directory = await ensureGeneratedProjectDir(projectId);
  const portrait = aspectRatio === '9:16';
  const width = portrait ? 1080 : 1920;
  const height = portrait ? 1920 : 1080;
  const segmentPaths: string[] = [];

  for (const [index, scene] of scenes.entries()) {
    if (!scene.videoClipUrl) throw new Error(`Scene ${scene.sceneNumber} has no generated video clip.`);
    const clipPath = await materializeAsset(scene.videoClipUrl, path.join(directory, `scene-${scene.sceneNumber}-source.mp4`));
    const segmentPath = path.join(directory, `scene-${scene.sceneNumber}-segment.mp4`);
    const duration = Math.max(1, scene.duration || 5);
    const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p`;
    const commonOutput = [
      '-map', '[v]', '-map', '1:a:0', '-t', String(duration),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart', segmentPath,
    ];

    if (scene.voiceoverUrl) {
      const voicePath = await materializeAsset(scene.voiceoverUrl, path.join(directory, `scene-${scene.sceneNumber}-voice.mp3`));
      await runFfmpeg([
        '-y', '-i', clipPath, '-i', voicePath,
        '-filter_complex', `[0:v]${videoFilter}[v];[1:a]apad=pad_dur=${duration}[a]`,
        '-map', '[v]', '-map', '[a]', '-t', String(duration),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-movflags', '+faststart', segmentPath,
      ]);
    } else {
      await runFfmpeg([
        '-y', '-i', clipPath, '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
        '-filter_complex', `[0:v]${videoFilter}[v]`,
        ...commonOutput,
      ]);
    }
    segmentPaths.push(segmentPath);
  }

  const concatFile = path.join(directory, 'segments.txt');
  const concatBody = segmentPaths.map((item) => `file '${item.replace(/'/g, "'\\''").replace(/\\/g, '/')}'`).join('\n');
  await fs.writeFile(concatFile, concatBody, 'utf8');

  const finalPath = path.join(directory, 'final.mp4');
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', '-movflags', '+faststart', finalPath]);

  const thumbnailPath = path.join(directory, 'thumbnail.jpg');
  await runFfmpeg(['-y', '-ss', '0.5', '-i', finalPath, '-frames:v', '1', '-q:v', '2', thumbnailPath]);

  return {
    videoUrl: toPublicAssetUrl(finalPath),
    thumbnailUrl: toPublicAssetUrl(thumbnailPath),
    totalDuration: scenes.reduce((sum, scene) => sum + Math.max(1, scene.duration || 5), 0),
  };
}
