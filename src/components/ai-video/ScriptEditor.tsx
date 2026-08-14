'use client';

import React from 'react';
import { RefreshCw, Play, Save, CheckCircle2, FileText, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScriptSection {
  type: 'hook' | 'intro' | 'highlight' | 'demo' | 'cta';
  content: string;
}

interface ScriptEditorProps {
  script: ScriptSection[];
  onUpdate: (script: ScriptSection[]) => void;
  onRegenerate: () => void;
  onContinue: () => void;
  isLoading: boolean;
}

export function ScriptEditor({ script, onUpdate, onRegenerate, onContinue, isLoading }: ScriptEditorProps) {
  const getIconForType = (type: string) => {
    switch (type) {
      case 'hook': return '⚡';
      case 'intro': return '📌';
      case 'highlight': return '⭐';
      case 'demo': return '🎯';
      case 'cta': return '🔥';
      default: return '📝';
    }
  };

  const getNameForType = (type: string) => {
    switch (type) {
      case 'hook': return 'Hook (Thu hút)';
      case 'intro': return 'Giới thiệu';
      case 'highlight': return 'Điểm nổi bật';
      case 'demo': return 'Thực tế / Tính năng';
      case 'cta': return 'Kêu gọi hành động';
      default: return type;
    }
  };

  const handleContentChange = (index: number, newContent: string) => {
    const newScript = [...script];
    newScript[index].content = newContent;
    onUpdate(newScript);
  };

  const totalWords = script.reduce((acc, curr) => acc + curr.content.split(' ').length, 0);
  const estimatedDuration = Math.ceil(totalWords / 2.5); // avg 2.5 words per second

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Kịch bản AI đề xuất
          </h2>
          <p className="text-sm text-slate-400">Bạn có thể chỉnh sửa trực tiếp nội dung dưới đây</p>
        </div>
        <div className="flex gap-2">
           <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
             ~{estimatedDuration}s ({totalWords} từ)
           </div>
        </div>
      </div>

      <div className="space-y-4">
        {script.map((section, index) => (
          <div key={index} className="glass-panel p-4 rounded-2xl border border-slate-800 focus-within:border-purple-500/50 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{getIconForType(section.type)}</span>
              <span className="text-xs font-bold text-slate-300 uppercase">{getNameForType(section.type)}</span>
            </div>
            <textarea
              className="w-full bg-transparent border-none text-white text-sm focus:outline-none resize-none min-h-[60px]"
              value={section.content}
              onChange={(e) => handleContentChange(index, e.target.value)}
              rows={Math.max(2, Math.ceil(section.content.length / 80))}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800">
        <button
          onClick={onRegenerate}
          disabled={isLoading}
          className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          <span>Tạo lại kịch bản</span>
        </button>
        <button
          onClick={onContinue}
          disabled={isLoading}
          className="flex-1 px-6 py-3 rounded-xl gradient-brand text-white font-bold text-sm shadow-glow hover:brightness-110 transition-all flex items-center justify-center gap-2"
        >
          <span>Tiếp tục (Tạo Storyboard)</span>
          <Zap className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
