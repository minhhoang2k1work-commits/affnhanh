import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegStatic from 'ffmpeg-static';
import { fetchPublicDriveVideo, inspectImportedVideo, isDriveDownloadHost, parseDriveVideoLink, storePublishingVideo, validateMp4Header } from './media';
import { GET as serveVideo } from '../../app/generated/publishing/[filename]/route';

afterEach(() => vi.unstubAllGlobals());
describe('publishing media sources', () => {
  it('decodes a real MP4 frame and extracts its duration', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aff-video-test-'));
    const filename = path.join(directory, 'test.mp4');
    try {
      await promisify(execFile)(ffmpegStatic!, ['-hide_banner', '-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=10', '-t', '1', '-c:v', 'libx264', filename], { windowsHide: true, timeout: 15000 });
      expect(await inspectImportedVideo(filename)).toBe(1);
    } finally { await fs.unlink(filename).catch(() => {}); await fs.rmdir(directory); }
  });
  it('accepts shared file links and rejects folders, credentials and lookalike hosts', () => {
    const value = parseDriveVideoLink('https://drive.google.com/file/d/abc123456789/view?usp=sharing&resourcekey=key-123');
    expect(value.id).toBe('abc123456789'); expect(value.downloadUrl).toContain('resourcekey=key-123');
    for (const url of ['https://drive.google.com/drive/folders/abc123456789', 'https://drive.google.com.evil.test/file/d/abc123456789/view', 'https://u:p@drive.google.com/file/d/abc123456789/view', 'http://localhost/file/d/abc123456789/view']) expect(() => parseDriveVideoLink(url)).toThrow();
    expect(isDriveDownloadHost(new URL('https://doc-abc-docs.googleusercontent.com/video'))).toBe(true);
    expect(isDriveDownloadHost(new URL('https://127.0.0.1/video'))).toBe(false);
  });
  it('revalidates redirect targets instead of fetching a private address', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchPublicDriveVideo('https://drive.google.com/file/d/abc123456789/view')).rejects.toThrow('không được hỗ trợ');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not treat a Drive login or confirmation HTML page as a video', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } })));
    await expect(fetchPublicDriveVideo('https://drive.google.com/file/d/abc123456789/view')).rejects.toThrow('chưa cho tải');
    expect(() => validateMp4Header(Buffer.from('<html>not a video'))).toThrow();
  });
  it('streams chunked MP4 bytes to disk and supports partial playback ranges', async () => {
    const bytes = Buffer.alloc(2048); bytes.writeUInt32BE(24); bytes.write('ftypisom', 4);
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes.subarray(0, 6)); c.enqueue(bytes.subarray(6)); c.close(); } });
    const stored = await storePublishingVideo(stream);
    try {
      expect(stored.size).toBe(2048);
      const params = Promise.resolve({ filename: path.basename(stored.filePath) });
      const response = await serveVideo(new Request('http://localhost/video', { headers: { range: 'bytes=0-31' } }), { params });
      expect(response.status).toBe(206); expect((await response.arrayBuffer()).byteLength).toBe(32);
      expect(response.headers.get('content-range')).toBe('bytes 0-31/2048');
      const bad = await serveVideo(new Request('http://localhost/video', { headers: { range: 'bytes=99999-' } }), { params });
      expect(bad.status).toBe(416);
    } finally { await fs.unlink(stored.filePath); }
  });
  it('rejects empty uploads and traversal filenames', async () => {
    await expect(storePublishingVideo(new ReadableStream({ start(c) { c.close(); } }))).rejects.toThrow();
    expect((await serveVideo(new Request('http://localhost/video'), { params: Promise.resolve({ filename: '../../secret.mp4' }) })).status).toBe(404);
  });
});
