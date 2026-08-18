'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
  Monitor,
  Workflow,
  Clapperboard,
  SlidersHorizontal,
  Save,
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
  apiConnected: boolean;
}

type VideoAutomationSettings = {
  chatgptUrl: string;
  flowUrl: string;
  referenceMode: 'ingredient' | 'frame';
  aspectRatio: '9:16' | '16:9';
  duration: 4 | 6 | 8 | 10;
  outputCount: 1;
};

const VIDEO_SETTINGS_STORAGE_KEY = 'aff_video_flow_settings';
const DEFAULT_VIDEO_AUTOMATION_SETTINGS: VideoAutomationSettings = {
  chatgptUrl: 'https://chatgpt.com/',
  flowUrl: 'https://labs.google/fx/tools/flow',
  referenceMode: 'ingredient',
  aspectRatio: '9:16',
  duration: 8,
  outputCount: 1,
};

function normalizeVideoAutomationSettings(value: Partial<VideoAutomationSettings> = {}): VideoAutomationSettings {
  const duration = Number(value.duration);
  return {
    chatgptUrl: String(value.chatgptUrl || DEFAULT_VIDEO_AUTOMATION_SETTINGS.chatgptUrl).trim(),
    flowUrl: String(value.flowUrl || DEFAULT_VIDEO_AUTOMATION_SETTINGS.flowUrl).trim(),
    referenceMode: value.referenceMode === 'frame' ? 'frame' : 'ingredient',
    aspectRatio: value.aspectRatio === '16:9' ? '16:9' : '9:16',
    duration: ([4, 6, 8, 10].includes(duration) ? duration : 8) as VideoAutomationSettings['duration'],
    outputCount: 1,
  };
}

function isAllowedAutomationUrl(value: string, service: 'chatgpt' | 'flow') {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (service === 'chatgpt') return url.hostname === 'chatgpt.com' || url.hostname.endsWith('.chatgpt.com');
    return url.hostname === 'flow.google' || url.hostname.endsWith('.flow.google') ||
      url.hostname === 'labs.google' || url.hostname.endsWith('.labs.google');
  } catch {
    return false;
  }
}

const INITIAL_PROVIDERS = {
  chatgpt: { mode: 'browser' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false, apiConnected: false },
  kling: { mode: 'browser' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false, apiConnected: false },
  runway: { mode: 'browser' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false, apiConnected: false },
  google_aistudio: { mode: 'browser' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false, apiConnected: false },
  elevenlabs: { mode: 'api' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false, apiConnected: false },
  openai: { mode: 'api' as ProviderMode, browserStatus: 'disconnected' as ConnectionStatus, apiKey: '', isSaving: false, isTesting: false, isLaunchingBrowser: false, apiConnected: false },
};

const PROVIDER_TYPES: Record<keyof typeof INITIAL_PROVIDERS, 'llm' | 'video' | 'voiceover'> = {
  chatgpt: 'llm',
  openai: 'llm',
  kling: 'video',
  runway: 'video',
  google_aistudio: 'video',
  elevenlabs: 'voiceover',
};

export default function AISettingsPage() {
  const [providers, setProviders] = useState(INITIAL_PROVIDERS);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [videoAutomation, setVideoAutomation] = useState<VideoAutomationSettings>(DEFAULT_VIDEO_AUTOMATION_SETTINGS);

  const fetchStatuses = async () => {
    try {
      const [browserResponse, apiResponse] = await Promise.all([
        fetch('/api/ai-browser/status'),
        fetch('/api/ai-providers'),
      ]);
      const data = await browserResponse.json();
      const apiData = await apiResponse.json();
      if (data.success && data.statuses) {
        setProviders(prev => {
          const next = { ...prev };
          Object.keys(data.statuses).forEach(key => {
            if (next[key as keyof typeof INITIAL_PROVIDERS]) {
              const rawStatus = data.statuses[key]?.status;
              next[key as keyof typeof INITIAL_PROVIDERS].browserStatus = rawStatus === 'connected'
                ? 'connected'
                : rawStatus === 'expired' ? 'expired' : 'disconnected';
            }
          });
          for (const provider of apiData.providers || []) {
            const id = provider.name as keyof typeof INITIAL_PROVIDERS;
            if (next[id]) {
              next[id] = {
                ...next[id],
                mode: provider.mode === 'api' ? 'api' : 'browser',
                apiConnected: Boolean(provider.hasApiKey),
                browserStatus: provider.browserSessionValid ? 'connected' : next[id].browserStatus,
              };
            }
          }
          return next;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatuses();
    try {
      const saved = JSON.parse(localStorage.getItem(VIDEO_SETTINGS_STORAGE_KEY) || 'null') || {};
      setVideoAutomation(normalizeVideoAutomationSettings({
        ...saved,
        chatgptUrl: saved.chatgptUrl || localStorage.getItem('aff_chatgpt_url') || undefined,
        flowUrl: saved.flowUrl || localStorage.getItem('aff_flow_url') || undefined,
      }));
    } catch {
      setVideoAutomation(DEFAULT_VIDEO_AUTOMATION_SETTINGS);
    }
  }, []);

  const handleSaveVideoAutomation = () => {
    const settings = normalizeVideoAutomationSettings(videoAutomation);
    if (!isAllowedAutomationUrl(settings.chatgptUrl, 'chatgpt')) {
      setNotice({ type: 'error', text: 'Link ChatGPT phải thuộc miền https://chatgpt.com.' });
      return;
    }
    if (!isAllowedAutomationUrl(settings.flowUrl, 'flow')) {
      setNotice({ type: 'error', text: 'Link Google Flow phải thuộc miền https://labs.google hoặc https://flow.google.' });
      return;
    }
    localStorage.setItem(VIDEO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem('aff_chatgpt_url', settings.chatgptUrl);
    localStorage.setItem('aff_flow_url', settings.flowUrl);
    setVideoAutomation(settings);
    setNotice({ type: 'success', text: `Đã lưu Link ChatGPT và cấu hình Flow · ${settings.duration}s · ${settings.aspectRatio} · x1.` });
  };

  const updateProvider = (id: keyof typeof INITIAL_PROVIDERS, updates: Partial<ProviderState>) => {
    setProviders(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  };

  const handleLaunchBrowser = async (id: keyof typeof INITIAL_PROVIDERS) => {
    updateProvider(id, { isLaunchingBrowser: true });
    setNotice(null);
    try {
      const res = await fetch('/api/ai-browser/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchStatuses();
        setNotice({ type: 'success', text: data.message || `Đã lưu phiên đăng nhập ${id}.` });
      } else {
        throw new Error(data.error || data.message || 'Không thể mở Browser đăng nhập.');
      }
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Không thể mở Browser đăng nhập.' });
    } finally {
      updateProvider(id, { isLaunchingBrowser: false });
    }
  };

  const handleSaveApi = async (id: keyof typeof INITIAL_PROVIDERS) => {
    updateProvider(id, { isSaving: true });
    setNotice(null);
    try {
      const response = await fetch('/api/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: id, type: PROVIDER_TYPES[id], mode: 'api', apiKey: providers[id].apiKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể lưu API key.');
      updateProvider(id, { apiConnected: true, apiKey: '' });
      setNotice({ type: 'success', text: `Đã lưu ${id} API key an toàn.` });
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Không thể lưu API key.' });
    } finally {
      updateProvider(id, { isSaving: false });
    }
  };

  const handleTestApi = async (id: keyof typeof INITIAL_PROVIDERS) => {
    updateProvider(id, { isTesting: true });
    setNotice(null);
    try {
      const response = await fetch('/api/ai-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: id, apiKey: providers[id].apiKey }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Kiểm tra kết nối thất bại.');
      setNotice({ type: 'success', text: `${id}: ${data.message}` });
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Kiểm tra kết nối thất bại.' });
    } finally {
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
    } catch {
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
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
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
          <div className="flex flex-wrap gap-2">
            <Link href="/ai-video" className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-sm font-semibold flex items-center gap-2">
              <Clapperboard className="w-4 h-4" /> AI Video Studio
            </Link>
            <Link href="/flows" className="px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 text-sm font-semibold flex items-center gap-2">
              <Workflow className="w-4 h-4" /> Quy trình tự động hóa
            </Link>
          </div>
        </div>
      </div>

      {notice && (
        <div className={cn(
          'rounded-xl border px-4 py-3 text-sm',
          notice.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300',
        )}>
          {notice.text}
        </div>
      )}

      <section id="video-automation" className="scroll-mt-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-slate-950 overflow-hidden shadow-xl shadow-cyan-950/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-2 text-cyan-200 font-extrabold">
              <SlidersHorizontal className="w-5 h-5" />
              Link ChatGPT & Google Flow
            </div>
            <p className="mt-1 text-xs text-slate-400">Cấu hình được dùng khi bấm tạo video từ Thư viện sản phẩm.</p>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 text-[10px] font-bold text-cyan-300">VIDEO AUTOMATION</span>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-xs font-bold text-white">Link ChatGPT hoặc GPT riêng</label>
              <input
                type="url"
                value={videoAutomation.chatgptUrl}
                onChange={(event) => setVideoAutomation((current) => ({ ...current, chatgptUrl: event.target.value }))}
                placeholder="https://chatgpt.com/ hoặc https://chatgpt.com/g/..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">Dán link cuộc trò chuyện hoặc link GPT dùng để phân tích ảnh và tạo prompt.</p>
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold text-white">Link dự án Google Flow</label>
              <input
                type="url"
                value={videoAutomation.flowUrl}
                onChange={(event) => setVideoAutomation((current) => ({ ...current, flowUrl: event.target.value }))}
                placeholder="https://labs.google/fx/tools/flow/..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">Nên dùng link dự án Flow bạn đang làm việc để extension mở đúng nơi.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-bold text-slate-300">
              <span className="block mb-1.5">Ảnh tham chiếu</span>
              <select
                value={videoAutomation.referenceMode}
                onChange={(event) => setVideoAutomation((current) => ({ ...current, referenceMode: event.target.value === 'frame' ? 'frame' : 'ingredient' }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500"
              >
                <option value="ingredient">Thành phần</option>
                <option value="frame">Khung hình</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-300">
              <span className="block mb-1.5">Tỷ lệ</span>
              <select
                value={videoAutomation.aspectRatio}
                onChange={(event) => setVideoAutomation((current) => ({ ...current, aspectRatio: event.target.value === '16:9' ? '16:9' : '9:16' }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500"
              >
                <option value="9:16">9:16 dọc</option>
                <option value="16:9">16:9 ngang</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-300">
              <span className="block mb-1.5">Thời lượng</span>
              <select
                value={videoAutomation.duration}
                onChange={(event) => setVideoAutomation((current) => ({ ...current, duration: Number(event.target.value) as VideoAutomationSettings['duration'] }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500"
              >
                {[4, 6, 8, 10].map((seconds) => <option key={seconds} value={seconds}>{seconds} giây</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div className="text-xs text-cyan-300">
              Video · {videoAutomation.duration}s · {videoAutomation.aspectRatio} · {videoAutomation.referenceMode === 'ingredient' ? 'Thành phần' : 'Khung hình'} · x1
            </div>
            <button
              onClick={handleSaveVideoAutomation}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-cyan-500"
            >
              <Save className="w-4 h-4" />
              Lưu Link & cấu hình video
            </button>
          </div>
        </div>
      </section>

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
            <h4 className="font-bold text-emerald-300">Chọn chế độ phù hợp nơi triển khai</h4>
            <p className="text-sm text-emerald-400/80">Browser Mode dành cho máy local có giao diện và ổ đĩa bền vững; khi deploy cloud nên dùng API Mode.</p>
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
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">API connection</span>
                        {state.apiConnected
                          ? <span className="text-xs font-bold text-emerald-400">Connected ✅</span>
                          : <span className="text-xs font-bold text-rose-400">Not Connected</span>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400">API Key</label>
                        <div className="relative">
                          <input
                            type={showKeys[config.id] ? "text" : "password"}
                            value={state.apiKey}
                            onChange={(e) => updateProvider(config.id, { apiKey: e.target.value })}
                            placeholder={state.apiConnected ? 'Đã lưu an toàn — nhập key mới để thay đổi' : `Nhập ${config.name} API Key...`}
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
