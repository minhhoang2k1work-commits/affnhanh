'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, CloudUpload, Copy, ExternalLink, Loader2, Save, Unplug } from 'lucide-react';
import { cn } from '@/lib/utils';

type DriveStatus = {
  configured: boolean;
  connected: boolean;
  clientId: string;
  folderId: string;
  autoUpload: boolean;
  accountEmail: string;
  accountName: string;
  source: 'database' | 'environment' | null;
  hasClientSecret: boolean;
};

export function GoogleDrivePanel() {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [redirectUri, setRedirectUri] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [folderId, setFolderId] = useState('');
  const [autoUpload, setAutoUpload] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/google-drive');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Không thể đọc trạng thái Google Drive.');
      setStatus(payload.status);
      setRedirectUri(payload.redirectUri || '');
      setClientId(payload.status.clientId || '');
      setFolderId(payload.status.folderId || '');
      setAutoUpload(payload.status.autoUpload !== false);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể đọc trạng thái Google Drive.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const url = new URL(window.location.href);
    const driveResult = url.searchParams.get('drive');
    if (driveResult === 'connected') {
      setMessage({ type: 'success', text: 'Đã kết nối Google Drive thành công.' });
      setExpanded(true);
    } else if (driveResult === 'error') {
      setMessage({ type: 'error', text: url.searchParams.get('message') || 'Kết nối Google Drive thất bại.' });
      setExpanded(true);
    }
    if (driveResult) {
      url.searchParams.delete('drive');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.toString());
    }
  }, [loadStatus]);

  const saveConfiguration = async (connectAfterSave: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/integrations/google-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret, folderId, autoUpload }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Không thể lưu cấu hình Google Drive.');
      setStatus(payload.status);
      setClientSecret('');
      if (connectAfterSave) {
        window.open('/api/integrations/google-drive/auth', '_self');
        return;
      }
      setMessage({ type: 'success', text: 'Đã lưu cài đặt Google Drive.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể lưu cấu hình Google Drive.' });
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Xóa kết nối Google Drive khỏi app? Video đã lưu trên Drive sẽ không bị xóa.')) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/integrations/google-drive', { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Không thể ngắt kết nối Google Drive.');
      setClientId('');
      setClientSecret('');
      setFolderId('');
      await loadStatus();
      setMessage({ type: 'success', text: 'Đã xóa kết nối khỏi app. Các file trên Drive được giữ nguyên.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể ngắt kết nối Google Drive.' });
    } finally {
      setSaving(false);
    }
  };

  const connected = Boolean(status?.connected);
  const managedByEnvironment = status?.source === 'environment';

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      connected ? 'bg-blue-500/10 border-blue-500/30' : 'bg-amber-500/10 border-amber-500/30',
    )}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          connected ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300',
        )}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : connected ? <CheckCircle2 className="w-5 h-5" /> : <CloudUpload className="w-5 h-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Google Drive: {loading ? 'Đang kiểm tra...' : connected ? 'Đã kết nối' : 'Chưa kết nối'}</p>
          <p className="text-sm text-slate-400 mt-0.5 truncate">
            {connected
              ? `${status?.accountEmail || status?.accountName || 'Tài khoản Google'} · ${autoUpload ? 'Tự động lưu đang bật' : 'Chỉ lưu thủ công'}`
              : 'Bấm Thiết lập để kết nối tài khoản Google ngay trên app.'}
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-300 hidden sm:inline">{expanded ? 'Thu gọn' : 'Thiết lập'}</span>
        <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4 md:p-5 space-y-4 bg-slate-950/30">
          {message && (
            <div className={cn(
              'rounded-xl border px-3 py-2.5 text-sm',
              message.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300',
            )}>
              {message.text}
            </div>
          )}

          {!connected && (
            <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 text-sm text-slate-300 space-y-2">
              <p className="font-semibold text-white">Thiết lập một lần</p>
              <ol className="list-decimal pl-5 space-y-1 text-slate-400">
                <li>Bật Google Drive API trong Google Cloud.</li>
                <li>Tạo OAuth Client loại “Web application”.</li>
                <li>Thêm URI chuyển hướng bên dưới vào Authorized redirect URIs.</li>
                <li>Dán Client ID và Client Secret, rồi bấm “Lưu và kết nối Google”.</li>
              </ol>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200">
                Mở Google Cloud Console <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400">OAuth Client ID</span>
              <input value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={managedByEnvironment} placeholder="...apps.googleusercontent.com" className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm disabled:opacity-60" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400">OAuth Client Secret</span>
              <input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} disabled={managedByEnvironment} placeholder={status?.hasClientSecret ? 'Đã lưu an toàn — để trống nếu không đổi' : 'Nhập Client Secret'} className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm disabled:opacity-60" />
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs font-semibold text-slate-400">Authorized redirect URI</span>
            <div className="flex gap-2">
              <input readOnly value={redirectUri} className="min-w-0 flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-slate-400" />
              <button type="button" onClick={() => navigator.clipboard.writeText(redirectUri)} className="px-3 rounded-xl border border-slate-700 hover:bg-slate-800" title="Sao chép URI">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-semibold text-slate-400">Google Drive Folder ID — không bắt buộc</span>
            <input value={folderId} onChange={(event) => setFolderId(event.target.value)} disabled={managedByEnvironment} placeholder="Để trống để lưu vào My Drive" className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm disabled:opacity-60" />
          </label>

          <label className="flex items-center gap-3 rounded-xl bg-slate-900/60 border border-slate-800 p-3">
            <input type="checkbox" checked={autoUpload} onChange={(event) => setAutoUpload(event.target.checked)} disabled={managedByEnvironment} className="w-4 h-4 accent-blue-500" />
            <span className="text-sm">Tự động lưu video lên Drive sau khi dựng xong</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {!connected && !managedByEnvironment && (
              <button type="button" onClick={() => saveConfiguration(true)} disabled={saving} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                Lưu và kết nối Google
              </button>
            )}
            {connected && !managedByEnvironment && (
              <>
                <button type="button" onClick={() => saveConfiguration(false)} disabled={saving} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Lưu cài đặt
                </button>
                <button type="button" onClick={disconnect} disabled={saving} className="px-4 py-2.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 font-semibold flex items-center gap-2">
                  <Unplug className="w-4 h-4" /> Ngắt kết nối
                </button>
              </>
            )}
            {managedByEnvironment && <p className="text-xs text-slate-500 py-2">Kết nối này đang được quản lý bằng biến môi trường trên server.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
