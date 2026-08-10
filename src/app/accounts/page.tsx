'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Plus, CheckCircle2, Lock, Sparkles, Check } from 'lucide-react';

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

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
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

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AES-256 GCM Encrypted Storage</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Cấu Hình Tài Khoản Affiliate
          </h1>
          <p className="text-xs text-slate-400">Kết nối App ID & App Secret chính thức từ Shopee Open API / TikTok Open API.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 rounded-xl gradient-shopee text-white font-bold text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>KẾT NỐI TÀI KHOẢN MOI</span>
        </button>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 space-y-5 border border-purple-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                <span>Kết Nối API Credentials</span>
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

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>App Secret được mã hóa AES-256 GCM trước khi lưu DB. Tuyệt đối không hiển thị lại.</span>
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

      {/* List of Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Preset Default Active Shopee Account */}
        <div className="glass-card p-6 rounded-2xl space-y-4 border-emerald-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl gradient-shopee text-white font-bold text-sm">
                SP
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-white text-base">Shopee Affiliate Primary</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Mặc Định</span>
                </div>
                <div className="text-xs text-slate-400">Platform: Shopee Vietnam</div>
              </div>
            </div>
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <div className="space-y-2 text-xs p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">App ID:</span>
              <span className="text-purple-300 font-bold">100889201</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">App Secret:</span>
              <span className="text-slate-400">••••••••••••92a4</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mã hóa:</span>
              <span className="text-emerald-400 font-bold">AES-256-GCM OK</span>
            </div>
          </div>
        </div>

        {accounts.map((acc) => (
          <div key={acc.id} className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-600 text-white font-bold text-sm">
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
                <span className="text-slate-500">App Secret:</span>
                <span className="text-slate-400">{acc.appSecretMasked}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
