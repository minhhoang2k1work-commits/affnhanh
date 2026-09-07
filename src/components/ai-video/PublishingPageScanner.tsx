'use client';
import { useState } from 'react';
import { requestPublishing } from '@/lib/publishing/extension';

export function PublishingPageScanner({ onSelect }: { onSelect: (page: { pageId: string; name: string; deviceId: string }) => void }) {
  const [pages, setPages] = useState<{ pageId: string; pageName: string }[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <section className="rounded-xl border border-indigo-500/30 p-4 space-y-3">
    <button type="button" disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={async () => {
      setBusy(true); setPages([]); setDeviceId(''); setMessage('Đang đọc danh sách Page từ Chrome…');
      try {
        const result = await requestPublishing('SCAN_PAGES');
        const found = Array.isArray(result.pages) ? result.pages.filter((p: { pageId?: string; pageName?: string }) => /^\d{5,30}$/.test(p.pageId || '') && typeof p.pageName === 'string') : [];
        setPages(found); setDeviceId(String(result.deviceId || '')); setMessage(String(result.message || `Tìm thấy ${found.length} Page.`));
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Không quét được Page.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Đang quét…' : 'Quét Page từ Chrome'}</button>
    <p role="status" className="text-xs text-slate-400">{message || 'Lấy Page từ Meta Business Suite đang đăng nhập trong hồ sơ Chrome này.'}</p>
    {pages.length > 0 && <div className="max-h-72 overflow-auto space-y-2">{pages.map(page => <button type="button" key={page.pageId} disabled={!deviceId} onClick={() => onSelect({ pageId: page.pageId, name: page.pageName, deviceId })} className="block w-full rounded-lg border border-slate-700 p-3 text-left text-sm text-white hover:bg-slate-800">{page.pageName}<span className="block text-xs text-slate-400">ID: {page.pageId} · Chọn Page này</span></button>)}</div>}
  </section>;
}
