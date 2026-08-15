import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegStatic from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { videoUrls } = body;

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 video URLs' }, { status: 400 });
    }

    const projectId = `merge_${Date.now()}`;
    const directory = path.join(process.cwd(), 'public', 'generated', projectId);
    await fs.mkdir(directory, { recursive: true });

    // Download videos
    const localPaths = [];
    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i];
      const localPath = path.join(directory, `clip_${i}.mp4`);
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download video ${i}: ${response.statusText}`);
      await fs.writeFile(localPath, Buffer.from(await response.arrayBuffer()));
      localPaths.push(localPath);
    }

    // Normalize and concatenate with FFmpeg
    const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic;
    if (!ffmpeg) throw new Error('FFmpeg not found');

    // Normalize each clip to same format
    const normalizedPaths = [];
    for (let i = 0; i < localPaths.length; i++) {
      const normalized = path.join(directory, `norm_${i}.mp4`);
      await execFileAsync(ffmpeg, [
        '-y', '-i', localPaths[i],
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-movflags', '+faststart', normalized
      ], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
      normalizedPaths.push(normalized);
    }

    // Create concat file
    const concatFile = path.join(directory, 'concat.txt');
    const concatContent = normalizedPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    await fs.writeFile(concatFile, concatContent, 'utf8');

    // Concatenate
    const finalPath = path.join(directory, 'final.mp4');
    await execFileAsync(ffmpeg, [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatFile,
      '-c', 'copy', '-movflags', '+faststart', finalPath
    ], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });

    // Generate thumbnail
    const thumbnailPath = path.join(directory, 'thumbnail.jpg');
    await execFileAsync(ffmpeg, [
      '-y', '-ss', '0.5', '-i', finalPath, '-frames:v', '1', '-q:v', '2', thumbnailPath
    ], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });

    // Get relative URLs
    const publicDir = path.join(process.cwd(), 'public');
    const videoUrl = '/' + path.relative(publicDir, finalPath).split(path.sep).join('/');
    const thumbUrl = '/' + path.relative(publicDir, thumbnailPath).split(path.sep).join('/');

    return NextResponse.json({
      success: true,
      videoUrl,
      thumbnailUrl: thumbUrl,
      clipCount: videoUrls.length
    });
  } catch (error: any) {
    console.error('Merge error:', error);
    return NextResponse.json({ error: error?.message || 'Merge failed' }, { status: 500 });
  }
}
