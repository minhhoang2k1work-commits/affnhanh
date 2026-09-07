'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { parseReelCopy, reelText, type ReelCopy } from '@/lib/publishing/reels';
import { requestPublishing } from '@/lib/publishing/extension';

type Channel = { id: string; name: string };
const input = 'w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white';
const button = 'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40';

export function ReelPublisher({ projectId }: { projectId: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [chatgptUrl, setChatgptUrl] = useState('https://chatgpt.com/');
  const [copy, setCopy] = useState<ReelCopy>({ title: '', caption: '', hashtags: [] });
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const key = `aff-reel-draft:${projectId}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('aff-reel-channels') || '[]');
      if (Array.isArray(saved)) setChannels(saved.filter(c => /^\d{5,30}$/.test(c.id) && typeof c.name === 'string'));
      const draft = JSON.parse(localStorage.getItem(key) || 'null');
      if (draft) {
        setCopy(parseReelCopy(JSON.stringify(draft.copy)));
        setAffiliateUrl(typeof draft.affiliateUrl === 'string' ? draft.affiliateUrl : '');
        setAttempted(draft.attempted === true);
      }
    } catch { /* An invalid local draft must not prevent opening the editor. */ }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(key, JSON.stringify({ copy, affiliateUrl, attempted })); } catch { /* Draft remains in memory. */ }
  }, [key, copy, affiliateUrl, attempted, hydrated]);

  async function run(label: string, work: () => Promise<void>) {
    setBusy(label); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Không thể thực hiện.'); }
    finally { setBusy(''); }
  }
  async function source() {
    const response = await fetch(`/api/ai-video/${encodeURIComponent(projectId)}/reel-copy`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data as { prompt: string; videoUrl: string; affiliateUrl: string };
  }
  function edit(next: ReelCopy) { setCopy(next); setToken(''); }
  function saveChannel() {
    if (!/^\d{5,30}$/.test(pageId) || !pageName.trim()) { setError('Nhập ID Page dạng số và tên Page chính xác.'); return; }
    const next = [...channels.filter(c => c.id !== pageId), { id: pageId, name: pageName.trim() }];
    try { localStorage.setItem('aff-reel-channels', JSON.stringify(next)); setChannels(next); setMessage('Đã lưu Page trong hồ sơ Chrome này.'); setError(''); }
    catch { setError('Trình duyệt không cho phép lưu danh sách Page.'); }
  }

  return <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
    <div><h2 className="text-lg font-bold text-white">Đăng video/Reels lên Facebook Page</h2><p className="text-sm text-slate-400 mt-1">Tạo tiêu đề từ mô tả sản phẩm, sửa caption rồi chuyển video sang Meta Business Suite. Giữ tab ứng dụng mở trong khi xử lý.</p></div>
    <Link className="inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" href={`/publishing?project=${projectId}`}>Mở trình quản lý & lên lịch tự đăng</Link>
    <fieldset disabled={!!busy} className="space-y-4 disabled:opacity-70">
      <label className="block text-sm text-slate-300">Cuộc trò chuyện ChatGPT<input className={input} value={chatgptUrl} onChange={e => setChatgptUrl(e.target.value)} /></label>
      <button className={button} onClick={() => run('Đang chờ ChatGPT viết tiêu đề và caption…', async () => {
        const data = await source();
        const result = await requestPublishing('GENERATE', { url: chatgptUrl, prompt: data.prompt });
        edit(parseReelCopy(String(result.responseText || ''))); setAffiliateUrl(data.affiliateUrl);
        setMessage('Đã nhận nội dung ChatGPT. Kiểm tra thông tin trước khi đăng.');
      })}>ChatGPT viết tiêu đề và caption</button>
      <details className="text-sm text-slate-400"><summary className="cursor-pointer">Nhập kết quả JSON từ ChatGPT</summary><textarea aria-label="Kết quả JSON ChatGPT" className={input} rows={3} value={manual} onChange={e => setManual(e.target.value)} /><button className={button} onClick={() => run('Đang nhập…', async () => { edit(parseReelCopy(manual)); })}>Áp dụng kết quả</button></details>
      <label className="block text-sm text-slate-300">Tiêu đề ({copy.title.length}/100)<input className={input} maxLength={100} value={copy.title} onChange={e => edit({ ...copy, title: e.target.value })} /></label>
      <label className="block text-sm text-slate-300">Caption<textarea className={input} rows={4} maxLength={1800} value={copy.caption} onChange={e => edit({ ...copy, caption: e.target.value })} /></label>
      <label className="block text-sm text-slate-300">Hashtag (cách nhau bằng dấu cách)<input className={input} value={copy.hashtags.join(' ')} onChange={e => edit({ ...copy, hashtags: e.target.value.split(' ') })} onBlur={() => edit({ ...copy, hashtags: copy.hashtags.filter(Boolean) })} /></label>
      <label className="block text-sm text-slate-300">Link tiếp thị liên kết<input className={input} value={affiliateUrl} onChange={e => { setAffiliateUrl(e.target.value); setToken(''); }} /></label>
      <div className="border-t border-slate-800 pt-4 space-y-3">
        <label className="block text-sm text-slate-300">Page đã lưu trong hồ sơ này<select className={input} value={channels.some(c => c.id === pageId) ? pageId : ''} onChange={e => { const c = channels.find(c => c.id === e.target.value); setPageId(c?.id || ''); setPageName(c?.name || ''); setToken(''); }}><option value="">Thêm/chọn Page</option>{channels.map(c => <option key={c.id} value={c.id}>{c.name} · {c.id}</option>)}</select></label>
        <div className="grid gap-3 md:grid-cols-2"><input aria-label="ID Facebook Page" className={input} placeholder="ID Page (dạng số)" value={pageId} onChange={e => { setPageId(e.target.value.trim()); setToken(''); }} /><input aria-label="Tên Facebook Page" className={input} placeholder="Tên Page chính xác" value={pageName} onChange={e => { setPageName(e.target.value); setToken(''); }} /></div>
        <button className={button} onClick={saveChannel}>Lưu Page</button>
        <p className="text-xs text-slate-400">Dùng một hồ sơ Chrome cho mỗi tài khoản Facebook. Mở AFF và Meta Business Suite trong cùng hồ sơ. Các Page cùng tài khoản có thể dùng chung hồ sơ và đăng lần lượt.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className={button} onClick={() => run('Đang mở trình đăng Reels…', async () => {
          await requestPublishing('OPEN', { pageId, pageName }); setToken('');
          setMessage('Đã mở Meta Business Suite. Chọn đúng Page; để trình đăng Reels trống, rồi quay lại bấm Đưa video và nội dung sang Facebook.');
        })}>1. Mở Page đích</button>
        <button className={button} disabled={attempted} onClick={() => run('Đang tải và đưa video sang Facebook…', async () => {
          const validated = parseReelCopy(JSON.stringify(copy)); const data = await source();
          const result = await requestPublishing('PREPARE', { pageId, pageName, projectId, text: reelText(validated, affiliateUrl), videoUrl: new URL(data.videoUrl, location.origin).href });
          setToken(String(result.token)); setMessage('Đã điền nội dung và đưa tệp video vào trình đăng. Kiểm tra bản xem trước trên Facebook trước khi bấm Đăng Reel.');
        })}>2. Đưa video và nội dung sang Facebook</button>
        <button className={button} disabled={!token || attempted} onClick={() => run('Đang gửi lệnh đăng…', async () => {
          // Mark before sending; an ambiguous response must never encourage a duplicate post.
          localStorage.setItem(key, JSON.stringify({ copy, affiliateUrl, attempted: true }));
          setAttempted(true); const currentToken = token; setToken('');
          const result = await requestPublishing('SUBMIT', { token: currentToken });
          setMessage(String(result.message));
        })}>3. Đăng Reel lên {pageName || 'Page'}</button>
      </div>
      {attempted && <p className="text-sm text-amber-300">Đã có lần gửi lệnh đăng cho video này. Kiểm tra Facebook để tránh đăng trùng. <button className="underline" onClick={() => { setAttempted(false); setToken(''); setMessage('Hãy kiểm tra lại Page và chuẩn bị video trước khi đăng tiếp.'); }}>Tôi đã kiểm tra, cho phép chuẩn bị một lượt đăng mới</button></p>}
    </fieldset>
    {busy && <p role="status" className="text-sm text-indigo-300">{busy}</p>}
    {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </section>;
}
