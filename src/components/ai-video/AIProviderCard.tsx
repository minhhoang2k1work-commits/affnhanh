'use client';

import React, { useState } from 'react';
import { KeyRound, Activity, CheckCircle2, AlertCircle, RefreshCw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Provider {
  id: string;
  name: string;
  type: 'llm' | 'video' | 'voiceover';
  logoUrl?: string;
  apiKey: string;
  isActive: boolean;
  usage?: {
    requests: number;
    cost: number;
  };
}

interface AIProviderCardProps {
  provider: Provider;
  onSave: (data: any) => void;
  onTest: () => void;
  isLoading: boolean;
}

export function AIProviderCard({ provider, onSave, onTest, isLoading }: AIProviderCardProps) {
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [isActive, setIsActive] = useState(provider.isActive);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  const handleTest = async () => {
    setTestStatus('testing');
    try {
      await onTest();
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (e) {
      setTestStatus('failed');
    }
  };

  const handleSave = () => {
    onSave({ ...provider, apiKey, isActive });
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'llm': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'video': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'voiceover': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden">
             {provider.logoUrl ? (
               <img src={provider.logoUrl} alt={provider.name} className="w-6 h-6 object-contain" />
             ) : (
               <span className="font-bold text-slate-400">{provider.name[0]}</span>
             )}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{provider.name}</h3>
            <span className={cn("text-[10px] px-2 py-0.5 rounded font-semibold border", getTypeColor(provider.type))}>
              {provider.type.toUpperCase()}
            </span>
          </div>
        </div>
        
        {/* Toggle */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={isActive} 
            onChange={(e) => setIsActive(e.target.checked)} 
          />
          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400">API Key</label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {provider.usage && (
        <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-900/50">
          <span className="text-slate-400">Đã dùng: <strong className="text-white">{provider.usage.requests} reqs</strong></span>
          <span className="text-slate-400">Chi phí: <strong className="text-emerald-400">${provider.usage.cost.toFixed(2)}</strong></span>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleTest}
          disabled={!apiKey || testStatus === 'testing'}
          className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
        >
          {testStatus === 'testing' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
          {testStatus === 'success' ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> OK</span> :
           testStatus === 'failed' ? <span className="text-rose-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/> Lỗi</span> :
           'Test Connect'}
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 shadow-glow"
        >
          <Save className="w-3.5 h-3.5" />
          Lưu
        </button>
      </div>
    </div>
  );
}
