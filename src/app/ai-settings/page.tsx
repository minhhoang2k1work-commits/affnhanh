'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Sparkles, 
  Globe, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Loader2, 
  ExternalLink, 
  RefreshCw,
  Monitor
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectionStatus = 'connected' | 'expired' | 'disconnected' | 'loading';
type ProviderMode = 'browser' | 'api';

interface ProviderState {
  mode: ProviderMode;
  browserStatus: ConnectionStatus;
  apiKey: string;
  isSaving: boolean;
  isTesting: boolean;
  isLaunchingBrowser: boolean;
}

const INITIAL_PROVIDERS = {
  chatgpt: { mode: 'browser' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false },
  kling: { mode: 'browser' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false },
  runway: { mode: 'browser' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false },
  google_aistudio: { mode: 'browser' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false },
  elevenlabs: { mode: 'api' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false },
  openai: { mode: 'api' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false },
};

export default function AISettingsPage() {
  const [providers, setProviders] = useState(INITIAL_PROVIDERS);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [globalLoading, setGlobalLoading] = useState(true);

  const fetchStatuses = async () => {
    try {
      const res = await fetch('/api/ai-browser/status');
      const data = await res.json();
      if (data.success && data.statuses) {
        setProviders(prev => {
          const next = { ...prev };
          Object.keys(data.statuses).forEach(key => {
            if (next[key as keyof typeof INITIAL_PROVIDERS]) {
              next[key as keyof typeof INITIAL_PROVIDERS].browserStatus = data.statuses[key];
            }
          });
          return next;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const updateProvider = (id: keyof typeof INITIAL_PROVIDERS, updates: Partial<ProviderState>) => {
    setProviders(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  };

  const handleLaunchBrowser = async (id: keyof typeof INITIAL_PROVIDERS) => {
    updateProvider(id, { isLaunchingBrowser: true });
    try {
      const res = await fetch('/api/ai-browser/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchStatuses();
      }
    } catch (err) {
      console.error('Launch error', err);
    } finally {
      updateProvider(id, { isLaunchingBrowser: false });
    }
  };

  const handleSaveApi = async (id: keyof typeof INITIAL_PROVIDERS) => {
    updateProvider(id, { isSaving: true });
    try {
      await fetch('/api/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: id, apiKey: providers[id].apiKey }),
      });
      // Simulate success
      setTimeout(() => updateProvider(id, { isSaving: false }), 500);
    } catch (err) {
      console.error('Save error', err);
      updateProvider(id, { isSaving: false });
    }
  };

  const handleTestApi = async (id: keyof typeof INITIAL_PROVIDERS) => {
    updateProvider(id, { isTesting: true });
    try {
      await fetch('/api/ai-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: id }),
      });
      // Simulate test complete
      setTimeout(() => updateProvider(id, { isTesting: false }), 800);
    } catch (err) {
      console.error('Test error', err);
      updateProvider(id, { isTesting: false });
    }
  };

  const handleHealthCheck = async (id: keyof typeof INITIAL_PROVIDERS) => {
    updateProvider(id, { browserStatus: 'loading' });
    try {
      const res = await fetch('/api/ai-browser/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: id }),
      });
      const data = await res.json();
      if (data.success) {
        updateProvider(id, { browserStatus: data.status });
      } else {
        updateProvider(id, { browserStatus: 'disconnected' });
      }
    } catch (err) {
      updateProvider(id, { browserStatus: 'disconnected' });
    }
  };

  const renderStatus = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Connected ✅</span>;
      case 'expired':
        return <span className="flex items-center gap-1.5 text-amber-400 text-xs font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20"><AlertCircle className="w-3.5 h-3.5" /> Expired ⚠️</span>;
      case 'loading':
        return <span className="flex items-center gap-1.5 text-blue-400 text-xs font-bold bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...</span>;
      default:
        return <span className="flex items-center gap-1.5 text-rose-400 text-xs font-bold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Not Connected ❌</span>;
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const PROVIDER_CONFIGS = [
    {
      id: 'chatgpt' as const,
      name: 'ChatGPT',
      icon: '🤖',
      desc: 'Tạo script & storyboard cho video sản phẩm',
      badge: 'LLM',
      allowBrowser: true,
    },
    {
      id: 'kling' as const,
      name: 'Kling AI',
      icon: '🎬',
      desc: 'Tạo video AI chất lượng cao — 66 credits/ngày miễn phí',
      badge: 'Video',
      allowBrowser: true,
    },
    {
      id: 'runway' as const,
      name: 'Runway',
      icon: '🎥',
      desc: 'Runway Gen-4 — 125 credits miễn phí khi đăng ký',
      badge: 'Video',
      allowBrowser: true,
    },
    {
      id: 'google_aistudio' as const,
      name: 'Google AI Studio',
      icon: '🌐',
      desc: 'Google Veo — Chất lượng cinematic qua AI Studio',
      badge: 'Video',
      allowBrowser: true,
    },
    {
      id: 'elevenlabs' as const,
      name: 'ElevenLabs',
      icon: '🎙️',
      desc: 'Thuyết minh AI tự nhiên — API only',
      badge: 'Voiceover',
      allowBrowser: false,
    },
    {
      id: 'openai' as const,
      name: 'OpenAI API',
      icon: '🔑',
      desc: 'OpenAI GPT-4o API — Nhanh và ổn định hơn, nhưng tốn phí',
      badge: 'LLM',
      allowBrowser: false,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold mb-3">
            <Settings className="w-3.5 h-3.5" />
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Automation Configurations</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Cài Đặt AI Providers
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Quản lý kết nối với các dịch vụ AI — chọn dùng miễn phí qua Browser hoặc API Key
          </p>
        </div>
      </div>

      {/* Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
            <ZapIcon />
          </div>
          <div>
            <h4 className="font-bold text-emerald-300">Tiết kiệm chi phí với Browser Mode</h4>
            <p className="text-sm text-emerald-400/80">Tiết kiệm ~$1.31/video khi dùng Browser Mode thay API</p>
          </div>
        </div>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PROVIDER_CONFIGS.map((config, idx) => {
          const state = providers[config.id];
          return (
            <motion.div
              key={config.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm hover:border-slate-700 transition-colors"
            >
              <div className="p-5 border-b border-slate-800/50 flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="text-3xl bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex items-center justify-center w-14 h-14 shadow-inner">
                    {config.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white text-lg">{config.name}</h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {config.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{config.desc}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5 bg-slate-950/30">
                {/* Mode Toggle */}
                {config.allowBrowser && (
                  <div className="flex p-1 bg-slate-900 rounded-lg border border-slate-800 relative">
                    <button
                      onClick={() => updateProvider(config.id, { mode: 'browser' })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all z-10",
                        state.mode === 'browser' ? "text-white bg-slate-800 shadow-sm border border-slate-700" : "text-slate-400 hover:text-slate-300"
                      )}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Browser (Free)
                    </button>
                    <button
                      onClick={() => updateProvider(config.id, { mode: 'api' })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all z-10",
                        state.mode === 'api' ? "text-white bg-slate-800 shadow-sm border border-slate-700" : "text-slate-400 hover:text-slate-300"
                      )}
                    >
                      <Key className="w-3.5 h-3.5" />
                      API ($)
                    </button>
                  </div>
                )}

                {!config.allowBrowser && (
                  <div className="flex p-1 bg-slate-900 rounded-lg border border-slate-800">
                     <button className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md text-white bg-slate-800 shadow-sm border border-slate-700 cursor-default">
                      <Key className="w-3.5 h-3.5" />
                      API Mode Only
                    </button>
                  </div>
                )}

                {/* Content area */}
                <div className="min-h-[120px] flex flex-col justify-end">
                  {state.mode === 'browser' && config.allowBrowser ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800/80">
                        <span className="text-xs font-medium text-slate-400">Connection Status</span>
                        <div className="flex items-center gap-2">
                          {renderStatus(state.browserStatus)}
                          <button 
                            onClick={() => handleHealthCheck(config.id)}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                            title="Check Status"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", state.browserStatus === 'loading' && "animate-spin")} />
                          </button>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleLaunchBrowser(config.id)}
                        disabled={state.isLaunchingBrowser}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 border border-blue-400/20 disabled:opacity-70"
                      >
                        {state.isLaunchingBrowser ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Monitor className="w-4 h-4" />
                        )}
                        <span>Mở Browser Đăng Nhập</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400">API Key</label>
                        <div className="relative">
                          <input
                            type={showKeys[config.id] ? "text" : "password"}
                            value={state.apiKey}
                            onChange={(e) => updateProvider(config.id, { apiKey: e.target.value })}
                            placeholder={`Nhập ${config.name} API Key...`}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-3 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(config.id)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={() => handleSaveApi(config.id)}
                          disabled={state.isSaving || !state.apiKey}
                          className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 border border-slate-700"
                        >
                          {state.isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Lưu
                        </button>
                        <button
                          onClick={() => handleTestApi(config.id)}
                          disabled={state.isTesting || !state.apiKey}
                          className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 border border-slate-700"
                        >
                          {state.isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ZapIcon />}
                          Test
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ZapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
  );
}
