'use client';

import { useState } from 'react';
import { buildProductBrief } from '@/lib/products/knowledge';

export function ProductKnowledgeButton({ product, onSaved }: { product: any; onSaved: (product: any) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  async function collect() {
    if (busy) return;
    setBusy(true);
    setMessage('Đang đọc trang sản phẩm…');
    try {
      if (!document.documentElement.hasAttribute('data-aff-extension-installed')) throw new Error('Hãy cài hoặc tải lại AFF HUB Extension.');
      const requestId = crypto.randomUUID();
      const details = await new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => { window.removeEventListener('message', listener); reject(new Error('Hết thời gian chờ extension.')); }, 70000);
        function listener(event: MessageEvent) {
          if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'AFF_PRODUCT_COLLECTED' || event.data.requestId !== requestId) return;
          clearTimeout(timer);
          window.removeEventListener('message', listener);
          if (event.data.success) resolve(event.data.details);
          else reject(new Error(event.data.error || 'Không đọc được dữ liệu.'));
        }
        window.addEventListener('message', listener);
        window.postMessage({ type: 'AFF_COLLECT_PRODUCT', requestId, url: product.originalUrl }, location.origin);
      });
      const response = await fetch(`/api/products/${product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketplaceData: details }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không lưu được hồ sơ.');
      onSaved(data.product);
      setMessage('Đã lưu hồ sơ cho prompt kịch bản và video.');
      setOpen(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không lấy được dữ liệu.'); }
    finally { setBusy(false); }
  }
  return <div className="text-xs">
    <button type="button" disabled={busy} onClick={collect} className="rounded border border-indigo-400/40 px-2 py-1 text-indigo-300 disabled:opacity-50">{busy ? 'Đang lấy chi tiết…' : 'Lấy dữ liệu viết prompt'}</button>
    {product.marketplaceData && <button type="button" onClick={() => setOpen(!open)} className="ml-2 text-slate-400">{open ? 'Ẩn hồ sơ' : 'Xem hồ sơ'}</button>}
    {message && <p role="status" className="mt-1 text-slate-400">{message}</p>}
    {open && product.marketplaceData && <div className="mt-2 max-h-64 max-w-md overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 text-slate-300">
      <p>{product.marketplaceData.description || 'Chưa có mô tả.'}</p>
      <p className="mt-2">{product.marketplaceData.detailText}</p>
      {(product.marketplaceData.specifications || []).map((item: any, i: number) => <p key={i}>{item.name}: {item.value}</p>)}
      <p>Phân loại: {(product.marketplaceData.variants || []).join(', ') || 'Chưa đọc được'}</p>
      <p>Đã thu thập: {product.marketplaceData.images?.length || 0} ảnh · {product.marketplaceData.videos?.length || 0} video · {product.marketplaceData.reviews?.length || 0} đánh giá mẫu</p>
      <p>Vận chuyển: {product.marketplaceData.shipping || 'Chưa đọc được'}</p>
      <p>Đổi trả: {product.marketplaceData.returns || 'Chưa đọc được'}</p>
      <p>Bảo hành: {product.marketplaceData.warranty || 'Chưa đọc được'}</p>
      <p>Ưu đãi: {product.marketplaceData.promotions || 'Chưa đọc được'}</p>
      <p>Thời điểm thu thập: {product.marketplaceData.capturedAt || 'Chưa xác định'}</p>
      {product.marketplaceData.enrichmentWarning && <p>{product.marketplaceData.enrichmentWarning}</p>}
      <button type="button" className="mt-2 text-indigo-300" onClick={async () => {
        try { await navigator.clipboard.writeText(buildProductBrief(product)); setMessage('Đã sao chép dữ liệu để viết prompt.'); }
        catch { setMessage('Trình duyệt chưa cho phép sao chép.'); }
      }}>Sao chép dữ liệu cho prompt</button>
    </div>}
  </div>;
}
