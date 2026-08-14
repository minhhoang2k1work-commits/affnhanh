'use client';

import React from 'react';
import { DollarSign, Shield, Zap, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface CostEstimation {
  provider: string;
  totalUsd: number;
  totalVnd: number;
  breakdown: {
    script: number;
    video: number;
    voiceover: number;
    assembly: number;
  };
  isCheapest?: boolean;
  isBestQuality?: boolean;
}

interface CostEstimatorProps {
  estimations: CostEstimation[];
  selectedProvider?: string;
}

export function CostEstimator({ estimations, selectedProvider }: CostEstimatorProps) {
  if (!estimations || estimations.length === 0) return null;

  const maxCost = Math.max(...estimations.map(e => e.totalUsd));

  return (
    <div className="glass-panel p-6 rounded-3xl space-y-5 border border-slate-800">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-bold text-white">Dự toán chi phí</h3>
      </div>

      <div className="space-y-4">
        {estimations.map((est) => {
          const isSelected = est.provider === selectedProvider;
          
          return (
            <div 
              key={est.provider} 
              className={cn(
                "p-4 rounded-2xl border transition-all",
                isSelected ? "bg-slate-800/80 border-purple-500" : "bg-slate-900/50 border-slate-800"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">{est.provider}</h4>
                  {est.isCheapest && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> Rẻ nhất
                    </span>
                  )}
                  {est.isBestQuality && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Tốt nhất
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-400">${est.totalUsd.toFixed(4)}</div>
                  <div className="text-xs text-slate-400">~{est.totalVnd.toLocaleString('vi-VN')}đ</div>
                </div>
              </div>

              {/* Visual Breakdown Bar */}
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden flex mb-3">
                <div style={{ width: `${(est.breakdown.script / maxCost) * 100}%` }} className="h-full bg-blue-500" title={`Script: $${est.breakdown.script}`} />
                <div style={{ width: `${(est.breakdown.video / maxCost) * 100}%` }} className="h-full bg-purple-500" title={`Video: $${est.breakdown.video}`} />
                <div style={{ width: `${(est.breakdown.voiceover / maxCost) * 100}%` }} className="h-full bg-amber-500" title={`Voice: $${est.breakdown.voiceover}`} />
                <div style={{ width: `${(est.breakdown.assembly / maxCost) * 100}%` }} className="h-full bg-emerald-500" title={`Assembly: $${est.breakdown.assembly}`} />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"/> Kịch bản: ${est.breakdown.script}</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"/> Hình ảnh/Video: ${est.breakdown.video}</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"/> Thu âm: ${est.breakdown.voiceover}</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"/> Xử lý: ${est.breakdown.assembly}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
