import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.mp4$/.test(filename)) return new Response('Not found', { status: 404 });
  const filePath = path.join(process.cwd(), 'public', 'generated', 'publishing', filename);
  let size: number;
  try { size = (await fs.stat(filePath)).size; } catch { return new Response('Not found', { status: 404 }); }
  const headers = new Headers({ 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', 'Content-Disposition': `inline; filename="${filename}"` });
  let start = 0; let end = size - 1;
  const range = request.headers.get('range');
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
    else start = Math.max(0, size - Number(match[2]));
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  headers.set('Content-Length', String(end - start + 1));
  return new Response(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, { status: range ? 206 : 200, headers });
}
