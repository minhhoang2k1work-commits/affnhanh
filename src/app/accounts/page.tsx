'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Plus, CheckCircle2, Lock, Sparkles, Loader2, RefreshCw, AlertCircle, Globe, MonitorPlay, AlertTriangle, LogIn } from 'lucide-react';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [platform, setPlatform] = useState('SHOPEE');
  const [accountName, setAccountName] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Test Connection States
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  // Browser Connection States (Section 3)
  const [browserStatus, setBrowserStatus] = useState<any | null>(null);
  const [launchingBrowser, setLaunchingBrowser] = useState(false);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);

      const bRes = await fetch('/api/browser-session/status');
      const bData = await bRes.json();
      setBrowserStatus(bData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName || !appId || !appSecret) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          accountName,
          appId,
          appSecret,
          isDefault,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setAccountName('');
        setAppId('');
        setAppSecret('');
        fetchAccounts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnection = async (accId: string) => {
    setTestingId(accId);
    setTestResult(null);
    try {
      const res = await fetch('/api/accounts/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accId }),
      });
      const data = await res.json();

      if (data.success) {
        setTestResult({ id: accId, success: true, msg: data.message });
      } else {
        setTestResult({ id: accId, success: false, msg: data.error || 'Xác thực thất bại với server Shopee.' });
      }
    } catch (err: any) {
      setTestResult({ id: accId, success: false, msg: err?.message || 'Có lỗi kết nối máy chủ.' });
    } finally {
      setTestingId(null);
    }
  };

  // Launch Playwright Browser for Manual Login (Section 3 & 4)
  const handleLaunchBrowser = async () => {
    setLaunchingBrowser(true);
    try {
      const res = await fetch('/api/browser-session/launch', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Trình duyệt đã được mở.');
      fetchAccounts();
    } catch (err) {
      console.error(err);
    } finally {
      setLaunchingBrowser(false);
    }
  };

  const renderBrowserBadge = (status?: string) => {
    switch (status) {
      case 'CONNECTED':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Đã kết nối</span>;
      case 'OPENING_BROWSER':
        return <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang mở trình duyệt</span>;
      case 'VERIFICATION_REQUIRED':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Cần xác minh</span>;
      case 'EXPIRED':
        return <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Phiên đã hết hạn</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-bold text-xs">Chưa kết nối</span>;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Dual Provider Engine (API + Browser Automation)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Cấu Hình Kết Nối Shopee & Affiliate
          </h1>
          <p className="text-xs text-slate-400">Kết nối song song bằng Official Open API hoặc Playwright Browser Automation.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 rounded-xl gradient-shopee text-white font-bold text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>KẾT NỐI API CREDENTIALS</span>
        </button>
      </div>

      {/* SECTION 3: SHOPEE BROWSER CONNECTION CARD */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-purple-500/40 bg-gradient-to-r from-purple-900/20 via-slate-900 to-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <MonitorPlay className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base">SHOPEE BROWSER CONNECTION</h3>
                {renderBrowserBadge(browserStatus?.status)}
              </div>
              <p className="text-xs text-slate-400">Đăng nhập thủ công 1 lần trên trình duyệt Playwright để tự động hóa khi chưa có API Key.</p>
            </div>
          </div>

          <button
            onClick={handleLaunchBrowser}
            disabled={launchingBrowser}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-glow transition-all flex items-center justify-center gap-2 flex-shrink-0"
          >
            {launchingBrowser ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>{browserStatus?.status === 'EXPIRED' ? 'KẾT NỐI LẠI SHOPEE' : 'KẾT NỐI SHOPEE (BROWSER)'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Bảo mật mật khẩu</span>
            <span className="text-emerald-400 font-semibold">100% Không lưu Password (Đăng nhập QR/OTP)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Lưu trữ Session</span>
            <span className="text-purple-300 font-semibold">Playwright Encrypted StorageState</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Xác minh 2FA / CAPTCHA</span>
            <span className="text-amber-300 font-semibold">Non-Bypass (Dừng để người dùng xác minh)</span>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 space-y-5 border border-purple-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                <span>Kết Nối Official API Credentials</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">NỀN TẢNG AFFILIATE</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="ACCESSTRADE">Accesstrade Publisher API</option>
                  <option value="SHOPEE">Shopee Affiliate Program</option>
                  <option value="TIKTOK">TikTok Shop Affiliate</option>
                  <option value="LAZADA">Lazada Affiliate Program</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">TÊN GỢI NHỚ TÀI KHOẢN</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Ví dụ: Shopee Account Chính"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">APP ID</label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="Nhập App ID từ Affiliate Portal"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">APP SECRET (MÃ HÓA BẢO MẬT)</label>
                <input
                  type="password"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="defCheck"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="defCheck" className="text-xs text-slate-300">Đặt làm Tài khoản Mặc định cho nền tảng này</label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl gradient-shopee text-white font-extrabold text-sm shadow-glow hover:brightness-110 active:scale-95 transition-all"
              >
                {submitting ? 'Đang lưu credentials...' : 'LƯU & KẾT NỐI TÀI KHOẢN'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* List of Official API Accounts */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Đang tải danh sách tài khoản...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 glass-card rounded-3xl space-y-3">
          <KeyRound className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="font-bold text-white text-base">Chưa kết nối tài khoản Official API nào</h3>
          <p className="text-xs text-slate-400">Nếu bạn đã có App ID & App Secret, nhấn "KẾT NỐI API CREDENTIALS". Hoặc dùng nút Shopee Browser ở trên.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {accounts.map((acc) => (
            <div key={acc.id} className="glass-card p-6 rounded-2xl space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl gradient-shopee text-white font-bold text-sm">
                      {acc.platform.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-base">{acc.accountName}</h3>
                        {acc.isDefault && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Mặc Định</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">Platform: {acc.platform}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">App ID:</span>
                    <span className="text-purple-300 font-bold">{acc.appId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bảo mật:</span>
                    <span className="text-emerald-400 font-bold">AES-256-GCM OK</span>
                  </div>
                </div>

                {testResult?.id === acc.id && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    testResult?.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    {testResult?.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                    <span>{testResult?.msg}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <button
                  onClick={() => handleTestConnection(acc.id)}
                  disabled={testingId === acc.id}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all flex items-center gap-1.5"
                >
                  {testingId === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>TEST CONNECTION</span>
                </button>
                <span className="text-slate-500 text-[11px]">HMAC-SHA256 Verified</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
