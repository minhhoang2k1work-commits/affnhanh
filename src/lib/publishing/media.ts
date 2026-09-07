import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegStatic from 'ffmpeg-static';

export const MAX_PUBLISH_VIDEO_BYTES = 250 * 1024 * 1024;
export function parseDriveVideoLink(value: unknown) {
  if (typeof value !== 'string' || value.length > 2000) throw new Error('Nhập link Google Drive của một tệp video.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password || url.port) throw new Error('Chỉ nhận link https://drive.google.com của tệp video.');
  const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1] || (['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : null);
  if (!id || !/^[\w-]{10,200}$/.test(id)) throw new Error('Cần link một tệp video trên Drive, không phải link thư mục.');
  const download = new URL('https://drive.usercontent.google.com/download');
  download.searchParams.set('id', id); download.searchParams.set('export', 'download'); download.searchParams.set('confirm', 't');
  const resourceKey = url.searchParams.get('resourcekey');
  if (resourceKey && /^[\w-]{1,200}$/.test(resourceKey)) download.searchParams.set('resourcekey', resourceKey);
  return { id, downloadUrl: download.href };
}

export function isDriveDownloadHost(url: URL) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && (['drive.google.com', 'drive.usercontent.google.com'].includes(url.hostname) || /^[a-zA-Z0-9.-]+\.googleusercontent\.com$/.test(url.hostname));
}

export async function fetchPublicDriveVideo(link: string) {
  const { id, downloadUrl } = parseDriveVideoLink(link);
  let current = new URL(downloadUrl);
  for (let hop = 0; hop < 6; hop++) {
    if (!isDriveDownloadHost(current)) throw new Error('Drive chuyển hướng sang địa chỉ tải không được hỗ trợ.');
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(120000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const destination = response.headers.get('location'); await response.body?.cancel();
      if (!destination) throw new Error('Drive không trả địa chỉ tải.');
      current = new URL(destination, current); continue;
    }
    if (!response.ok || /text\/html|application\/json/.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel();
      throw new Error('Drive chưa cho tải trực tiếp. Bật “Bất kỳ ai có đường liên kết” và cho phép tải xuống; nếu Drive yêu cầu xác nhận hoặc hết hạn mức, tải bằng Chrome rồi dùng Chọn thư mục/tệp.');
    }
    if (!response.body) throw new Error('Drive trả tệp rỗng.');
    const size = Number(response.headers.get('content-length') || 0);
    if (size > MAX_PUBLISH_VIDEO_BYTES) { await response.body.cancel(); throw new Error('Video vượt quá 250 MB.'); }
    const disposition = response.headers.get('content-disposition') || '';
    const name = disposition.match(/filename="([^"]+)"/i)?.[1] || `Drive-${id}.mp4`;
    return { response, name };
  }
  throw new Error('Drive chuyển hướng quá nhiều lần.');
}

export function validateMp4Header(bytes: Buffer) {
  if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') throw new Error('Tệp không có định dạng MP4 hợp lệ. Không lưu trang HTML hay tệp đổi đuôi giả.');
}

export async function inspectImportedVideo(filePath: string) {
  const executable = process.env.FFMPEG_PATH || ffmpegStatic;
  if (!executable) throw new Error('Chưa có FFmpeg để kiểm tra video nhập.');
  try {
    const { stderr } = await promisify(execFile)(executable, ['-hide_banner', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', filePath, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'], { windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 });
    const time = String(stderr).match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!time) throw new Error();
    return Math.max(1, Math.round(Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3])));
  } catch { throw new Error('Không đọc được luồng hình/thời lượng video MP4. Kiểm tra tệp trước khi nhập.'); }
}

export async function storePublishingVideo(stream: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  const root = path.resolve(process.cwd(), 'public', 'generated', 'publishing');
  await fs.mkdir(root, { recursive: true });
  const filename = `${randomUUID()}.mp4`;
  const destination = path.join(root, filename);
  const temporary = `${destination}.upload`;
  let size = 0; let header = Buffer.alloc(0); let checked = false;
  const guard = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    size += chunk.length;
    if (size > MAX_PUBLISH_VIDEO_BYTES) return callback(new Error('Video vượt quá 250 MB.'));
    if (!checked) {
      header = Buffer.concat([header, chunk.subarray(0, Math.max(0, 32 - header.length))]);
      if (header.length >= 12) {
        try { validateMp4Header(header); checked = true; } catch (error) { return callback(error as Error); }
      }
    }
    callback(null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]), guard, createWriteStream(temporary, { flags: 'wx' }), { signal });
    if (!checked || size < 1024) throw new Error('Tệp MP4 rỗng hoặc quá ngắn.');
    await fs.rename(temporary, destination);
    return { videoUrl: `/generated/publishing/${filename}`, filePath: destination, size };
  } catch (error) { await fs.unlink(temporary).catch(() => {}); throw error; }
}
