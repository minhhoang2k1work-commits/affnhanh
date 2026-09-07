import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { db, getOrCreateUser } from '@/lib/db';
import { fetchPublicDriveVideo, inspectImportedVideo, MAX_PUBLISH_VIDEO_BYTES, storePublishingVideo } from '@/lib/publishing/media';
import { publishingFailure } from '@/lib/publishing/http';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(request: Request) {
  let saved: Awaited<ReturnType<typeof storePublishingVideo>> | undefined;
  try {
    if (process.env.VERCEL) throw new Error('Nhập video vào ổ đĩa cần chạy AFF trên máy tính/máy chủ có lưu trữ bền vững. Mở bản AFF local để dùng nguồn thư mục và Drive.');
    const user = await getOrCreateUser();
    let name: string; let description: string; let stream: ReadableStream<Uint8Array>;
    if (request.headers.get('content-type')?.startsWith('application/json')) {
      const body = await request.json();
      description = typeof body.description === 'string' ? body.description.trim() : '';
      if (description.length > 3000) throw new Error('Mô tả sản phẩm tối đa 3.000 ký tự.');
      const drive = await fetchPublicDriveVideo(body.driveUrl);
      name = drive.name; stream = drive.response.body!;
    } else {
      const metadata = JSON.parse(decodeURIComponent(request.headers.get('x-aff-video-metadata') || '{}'));
      name = typeof metadata.name === 'string' ? metadata.name : '';
      description = typeof metadata.description === 'string' ? metadata.description.trim() : '';
      if (!name.toLowerCase().endsWith('.mp4') || description.length > 3000 || name.length > 255) throw new Error('Chọn video MP4 và mô tả tối đa 3.000 ký tự.');
      if (Number(request.headers.get('content-length') || 0) > MAX_PUBLISH_VIDEO_BYTES) throw new Error('Video vượt quá 250 MB.');
      if (!request.body) throw new Error('Chưa có dữ liệu video.');
      stream = request.body;
    }
    saved = await storePublishingVideo(stream, AbortSignal.any([request.signal, AbortSignal.timeout(150000)]));
    const duration = await inspectImportedVideo(saved.filePath);
    const title = name.replace(/[\\/]/g, '_').replace(/\.mp4$/i, '').slice(0, 200).trim() || 'Video nhập';
    // Imported videos reuse the existing completed-video library, so they can use all scheduling tools.
    const project = await db.aIVideoProject.create({ data: { userId: user.id, title, productDescription: description, status: 'completed', videoUrl: saved.videoUrl, style: 'imported', language: 'vi', duration, videoDuration: duration, videoProvider: 'import' }, select: { id: true, title: true, videoUrl: true } });
    return NextResponse.json({ project, bytes: saved.size });
  } catch (error) {
    if (saved) await fs.unlink(saved.filePath).catch(() => {});
    return publishingFailure(error);
  }
}
