'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CATEGORY_OPTIONS } from '@/lib/constants';
import { buildIndustryDossier, buildIndustryTask, chatgptProjectKey, INDUSTRY_PROFILE_FIELDS, INDUSTRY_TASKS, IndustryTask, IndustryDraft, isServiceUrl, validateIndustry } from '@/lib/products/industry';
import { requestProductExtension } from '@/lib/products/extension-request';

type Workspace = IndustryDraft & { id: string };
const empty: IndustryDraft = { name: '', basePrompt: '', referenceLinks: [], chatgptUrl: 'https://chatgpt.com/', flowUrl: '' };
const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white focus:border-indigo-400 focus:outline-none';
const buttonClass = 'rounded-xl border border-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-40';

export default function IndustriesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [draft, setDraft] = useState<IndustryDraft>(empty);
  const [id, setId] = useState('');
  const [links, setLinks] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState('');
  const [evidence, setEvidence] = useState<any[]>([]);
  const [task, setTask] = useState<IndustryTask>('profile');
  const [request, setRequest] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/industries'), fetch('/api/products')]).then(async ([a, b]) => {
      const [industryData, productData] = await Promise.all([a.json(), b.json()]);
      if (!a.ok || !b.ok) throw new Error(industryData.error || productData.error || 'Không tải được dữ liệu.');
      setWorkspaces(industryData.industries);
      setProducts(productData.products || []);
    }).catch(error => setStatus(error.message));
  }, []);

  function change(field: keyof IndustryDraft, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setPreview('');
  }
  function choose(workspace?: Workspace, name = '') {
    setId(workspace?.id || '');
    setDraft(workspace || { ...empty, name, profile: {} });
    setRequest(''); setTask('profile');
    setLinks(workspace?.referenceLinks.join('\n') || '');
    setSelected([]); setEvidence([]); setPreview(''); setStatus(''); setAllProducts(false);
  }
  function current() {
    if (draft.chatgptUrl && draft.chatgptUrl !== 'https://chatgpt.com/' && !chatgptProjectKey(draft.chatgptUrl)) throw new Error('Dán link trang dự án ChatGPT (có /g/g-p-…/project), không dùng link chat hoặc GPT riêng.');
    return validateIndustry({ ...draft, referenceLinks: links.split(/\r?\n/).map(link => link.trim()).filter(Boolean) });
  }
  async function save() {
    const data = current();
    const response = await fetch('/api/industries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, ...(id ? { id } : {}) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    const oldName = workspaces.find(w => w.id === id)?.name;
    if (oldName && oldName !== result.industry.name) setProducts(previous => previous.map(p => p.category === oldName ? { ...p, category: result.industry.name } : p));
    setId(result.industry.id);
    setDraft(result.industry);
    setWorkspaces(previous => [...previous.filter(w => w.id !== result.industry.id), result.industry].sort((a, b) => a.name.localeCompare(b.name)));
    return result.industry as Workspace;
  }
  async function act(label: string, operation: () => Promise<void>) {
    setBusy(label); setStatus('');
    try { await operation(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Không thực hiện được.'); }
    finally { setBusy(''); }
  }
  async function prepare() {
    if (selected.length > 5) throw new Error('Chọn tối đa 5 sản phẩm cho một prompt. Bạn vẫn có thể gán ngành hàng cho tối đa 250 sản phẩm cùng lúc.');
    const workspace = await save();
    const gathered: any[] = [];
    for (const url of workspace.referenceLinks) {
      const savedProduct = products.find(p => p.originalUrl === url);
      if (savedProduct?.marketplaceData?.description) {
        gathered.push({ url, ...savedProduct.marketplaceData });
        continue;
      }
      if (!/^(?:[\w-]+\.)*(?:shopee\.vn|tiktok\.com)$/.test(new URL(url).hostname)) {
        gathered.push({ url, status: 'Chưa đọc nội dung; link tham khảo do người dùng cung cấp.' });
        continue;
      }
      setStatus(`Đang đọc link ${gathered.length + 1}/${workspace.referenceLinks.length}…`);
      try {
        const result = await requestProductExtension('AFF_COLLECT_PRODUCT', { url });
        gathered.push({ url, ...result.details });
      } catch (error) { gathered.push({ url, status: (error as Error).message }); }
    }
    setEvidence(gathered);
    setPreview(buildIndustryTask(workspace, task, request, products.filter(p => selected.includes(p.id)), gathered));
    setStatus('Đã ghép prompt. Kiểm tra nội dung trước khi gửi sang ChatGPT.');
  }
  const visible = products.filter(p => (allProducts || p.category === draft.name) && (!query || p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const uncategorized = [...new Set(products.map(p => p.category).filter(Boolean))].filter(name => !workspaces.some(w => w.name === name));

  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-white">Quản lý ngành hàng</h1><p className="mt-1 text-sm text-slate-400">Mỗi ngành một hồ sơ, một dự án ChatGPT. App quản lý thông tin · ChatGPT phân tích và sáng tạo · Extension thực hiện.</p></div>
      <button disabled={!!busy} className={buttonClass} onClick={() => choose()}>+ Thêm ngành hàng</button>
    </div>
    {status && <p role="status" className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-sm text-indigo-200">{status}</p>}
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <h2 className="font-semibold text-white">Ngành hàng của tôi</h2>
        {!workspaces.length && <p className="text-sm text-slate-400">Tạo ngành hàng đầu tiên hoặc chọn danh mục hiện có bên dưới.</p>}
        {workspaces.map(w => <button disabled={!!busy} key={w.id} onClick={() => choose(w)} className={`w-full rounded-xl border p-3 text-left ${id === w.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-800 bg-slate-900'}`}>
          <span className="block break-words font-medium text-white">{w.name}</span><span className="text-xs text-slate-400">{products.filter(p => p.category === w.name).length} sản phẩm · {chatgptProjectKey(w.chatgptUrl) ? 'Đã gắn dự án ChatGPT' : 'Chưa gắn dự án ChatGPT'}</span>
        </button>)}
        {uncategorized.length > 0 && <><p className="pt-3 text-sm text-slate-400">Danh mục chưa có hồ sơ</p>{uncategorized.map(name => <button disabled={!!busy} className="block text-left text-sm text-indigo-300" key={String(name)} onClick={() => choose(undefined, String(name))}>{String(name)}</button>)}</>}
        <Link href="/library" className="block pt-3 text-sm text-indigo-300">Mở thư viện sản phẩm →</Link>
      </aside>
      <section className="min-w-0 space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <fieldset disabled={!!busy} className="space-y-4 disabled:opacity-70">
          <label className="block space-y-2 text-sm text-slate-300"><span>Tên ngành hàng</span><input aria-label="Tên ngành hàng" className={inputClass} list="industry-names" value={draft.name} onChange={e => change('name', e.target.value)} placeholder="Ví dụ: Mỹ phẩm & Làm đẹp" maxLength={120} /></label>
          <datalist id="industry-names">{CATEGORY_OPTIONS.map(name => <option key={name} value={name} />)}</datalist>
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-slate-300"><strong className="text-white">1. Hồ sơ riêng của ngành</strong><p className="mt-1">Thông tin này được ghép vào mỗi yêu cầu gửi ChatGPT để giữ đúng đặc điểm ngành. Nội dung chưa biết có thể để trống.</p></div>
          <div className="grid gap-4 md:grid-cols-2">{INDUSTRY_PROFILE_FIELDS.map(([key, label, placeholder]) => <label key={key} className={`block space-y-2 text-sm text-slate-300 ${key === 'knowledge' ? 'md:col-span-2' : ''}`}><span>{label}</span><textarea aria-label={label} className={inputClass} rows={key === 'knowledge' ? 5 : 3} maxLength={12000} value={draft.profile?.[key] || ''} placeholder={placeholder} onChange={e => { setDraft(previous => ({ ...previous, profile: { ...previous.profile, [key]: e.target.value } })); setPreview(''); }} /></label>)}</div>
          <label className="block space-y-2 text-sm text-slate-300"><span>Prompt cơ bản / yêu cầu sáng tạo</span><textarea aria-label="Prompt cơ bản" className={inputClass} rows={6} value={draft.basePrompt} onChange={e => change('basePrompt', e.target.value)} placeholder="Khách hàng nữ 25–35 tuổi, video 24 giây gồm 3 cảnh. Giọng kể tự nhiên, cận cảnh sản phẩm. Chỉ dùng công dụng đã xác nhận…" maxLength={20000} /></label>
          <label className="block space-y-2 text-sm text-slate-300"><span>Link sản phẩm / link tham khảo — mỗi dòng một link, tối đa 20</span><textarea aria-label="Link tham khảo" className={inputClass} rows={4} value={links} onChange={e => { setLinks(e.target.value); setPreview(''); setEvidence([]); }} placeholder="https://shopee.vn/product/…&#10;https://www.tiktok.com/view/product/…" /></label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm text-slate-300"><span>2. Dự án ChatGPT dành riêng cho ngành</span><input aria-label="Link dự án ChatGPT" className={inputClass} value={draft.chatgptUrl} onChange={e => change('chatgptUrl', e.target.value)} placeholder="https://chatgpt.com/g/g-p-…/project" /></label>
            <label className="block space-y-2 text-sm text-slate-300"><span>Link dự án Flow dùng lại</span><input aria-label="Link dự án Flow" className={inputClass} value={draft.flowUrl} onChange={e => change('flowUrl', e.target.value)} placeholder="https://labs.google/fx/tools/flow/project/…" /></label>
          </div>
          <p className="text-xs text-slate-400">Dán link khi đang ở trong dự án Flow. Các video thuộc ngành hàng này sẽ dùng lại dự án đã gắn.</p>
          <p className="text-sm text-indigo-200">Trong ChatGPT, tạo một Project mang tên ngành, mở trang dự án và dán địa chỉ vào đây. Dùng lại dự án này cho các lần làm việc sau. App không tự tạo Project hay chỉnh Project Instructions.</p>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button disabled={!!busy} className={buttonClass} onClick={() => act('save', async () => { await save(); setStatus('Đã lưu ngành hàng, prompt và các link.'); })}>Lưu ngành hàng</button>
          {isServiceUrl(draft.flowUrl, 'flow', true) && <a href={draft.flowUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>Mở dự án Flow</a>}
          {isServiceUrl(draft.chatgptUrl, 'chatgpt') && <a href={draft.chatgptUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>Mở ChatGPT</a>}
          {id && <Link href={`/library?category=${encodeURIComponent(workspaces.find(w => w.id === id)?.name || draft.name)}`} className={buttonClass}>Sản phẩm & video của ngành</Link>}
          <button disabled={!!busy || !draft.name.trim()} className={buttonClass} onClick={() => act('dossier', async () => { await navigator.clipboard.writeText(buildIndustryDossier(current())); setStatus('Đã sao chép hồ sơ. Bạn có thể dán vào Project Instructions hoặc lưu làm nguồn của dự án trong ChatGPT.'); })}>Sao chép hồ sơ cho Project</button>
        </div>
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <h2 className="font-semibold text-white">3. Giao việc cho ChatGPT</h2>
          <div className="flex flex-wrap gap-2">{(Object.entries(INDUSTRY_TASKS) as [IndustryTask, string][]).map(([key, label]) => <button key={key} disabled={!!busy} aria-pressed={task === key} className={`${buttonClass} ${task === key ? 'border-indigo-400 bg-indigo-600' : ''}`} onClick={() => { setTask(key); setPreview(''); }}>{label}</button>)}</div>
          <textarea aria-label="Yêu cầu lần này" className={inputClass} rows={4} maxLength={20000} value={request} onChange={e => { setRequest(e.target.value); setPreview(''); }} placeholder="Ví dụ: Đề xuất 10 ý tưởng cho người mới thuê phòng trọ. Hoặc dán kịch bản đã duyệt để viết prompt video…" />
          <h2 className="font-semibold text-white">Sản phẩm đã chọn ({selected.length})</h2>
          <p className="text-xs text-slate-400">Gán ngành hàng cho tối đa 250 sản phẩm; chọn tối đa 5 sản phẩm khi ghép một prompt.</p>
          <div className="flex flex-wrap items-center gap-3"><input aria-label="Tìm sản phẩm" className={inputClass + ' md:!w-64'} value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm sản phẩm…" /><label className="text-sm text-slate-300"><input type="checkbox" checked={allProducts} onChange={e => setAllProducts(e.target.checked)} /> Hiện toàn bộ thư viện để gán ngành</label></div>
          <div className="max-h-64 space-y-2 overflow-auto">
            {!visible.length && <p className="text-sm text-slate-400">Chưa có sản phẩm. Bật toàn bộ thư viện để chọn, hoặc thêm link ở trên.</p>}
            {visible.map(p => <label key={p.id} className="flex items-start gap-3 rounded-lg bg-slate-950/60 p-3 text-sm text-slate-200"><input disabled={!!busy || (!selected.includes(p.id) && selected.length >= 250)} type="checkbox" checked={selected.includes(p.id)} onChange={e => { setSelected(previous => e.target.checked ? [...previous, p.id] : previous.filter(value => value !== p.id)); setPreview(''); }} /><span>{p.name}<span className="block text-xs text-slate-500">{p.category || 'Chưa phân ngành'} · {p.marketplaceData?.description ? 'Đã có hồ sơ' : 'Chưa có mô tả chi tiết'}</span></span></label>)}
          </div>
          <div className="flex gap-2"><button disabled={!!busy || !visible.length} className={buttonClass} onClick={() => { setSelected(visible.slice(0, 250).map(p => p.id)); setPreview(''); }}>Chọn danh sách đang hiện (tối đa 250)</button><button disabled={!!busy || !selected.length} className={buttonClass} onClick={() => { setSelected([]); setPreview(''); }}>Bỏ chọn</button></div>
          <button disabled={!!busy || !selected.length} className={buttonClass} onClick={() => act('assign', async () => {
            const workspace = await save();
            const response = await fetch('/api/industries', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: workspace.id, productIds: selected }) });
            const data = await response.json(); if (!response.ok) throw new Error(data.error);
            setProducts(previous => previous.map(p => selected.includes(p.id) ? { ...p, category: workspace.name } : p)); setPreview('');
            setStatus(`Đã gán ${data.count} sản phẩm vào ${workspace.name}.`);
          })}>Gán sản phẩm đã chọn vào ngành hàng</button>
        </div>
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <button disabled={!!busy} className={buttonClass + ' bg-indigo-600'} onClick={() => act('prepare', prepare)}>{busy === 'prepare' ? 'Đang ghép dữ liệu…' : 'Lấy dữ liệu & xem prompt'}</button>
          <p className="text-xs text-slate-400">Đọc link Shopee/TikTok bằng extension. Link khác được giữ làm tham khảo và ghi rõ chưa đọc nội dung.</p>
          {preview && <><label className="block space-y-2 text-sm text-slate-300"><span>Prompt sẽ gửi — bạn có thể chỉnh trước khi gửi</span><textarea aria-label="Prompt sẽ gửi" disabled={!!busy} rows={15} className={inputClass} value={preview} onChange={e => setPreview(e.target.value)} /></label>
            <p className="text-xs text-slate-400">Đã ghép {selected.length} sản phẩm và {evidence.length} link.</p>
            <div className="flex flex-wrap gap-2"><button disabled={!!busy} className={buttonClass} onClick={() => act('copy', async () => { await navigator.clipboard.writeText(preview); setStatus('Đã sao chép prompt.'); })}>Sao chép prompt</button>
              <button disabled={!!busy} className={buttonClass + ' bg-emerald-700'} onClick={() => act('send', async () => {
                const workspace = await save();
                if (!chatgptProjectKey(workspace.chatgptUrl)) throw new Error('Gắn link dự án ChatGPT cho ngành hàng trước khi gửi.');
                await requestProductExtension('AFF_SEND_INDUSTRY_PROMPT', { url: workspace.chatgptUrl, prompt: preview, requireProject: true });
                setStatus(`Đã gửi yêu cầu “${INDUSTRY_TASKS[task]}” vào dự án ChatGPT của ${workspace.name}. Xem và trao đổi tiếp trong ChatGPT. Đây là gửi tin nhắn, không tự cập nhật Project Instructions.`);
              })}>{busy === 'send' ? 'Đang gửi…' : 'Gửi sang ChatGPT'}</button></div>
          </>}
        </div>
      </section>
    </div>
  </div>;
}
