'use client';
import { useState } from 'react';
export function ReviewVideo({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{failed ? 'Không mở được tệp video. Kiểm tra video nguồn trước khi duyệt đăng.' : 'Chưa có đường dẫn video để xem trước. Mở video nguồn để kiểm tra.'}{src && <a className="mt-2 block underline" href={src} target="_blank" rel="noreferrer">Mở tệp video</a>}</div>;
  return <video aria-label={`Xem trước: ${title}`} src={src} controls playsInline preload="metadata" onError={() => setFailed(true)} className="mx-auto max-h-[55vh] w-full rounded-xl bg-black object-contain" />;
}
