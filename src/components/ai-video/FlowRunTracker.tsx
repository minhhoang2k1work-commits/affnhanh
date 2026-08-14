'use client';

import React from 'react';
import { Play, Pause, X, RotateCcw, CheckCircle2, AlertCircle, Loader2, DollarSign, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface FlowRunStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  cost?: number;
  error?: string;
}

export interface FlowRun {
  id: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  steps: FlowRunStep[];
  totalCost: number;
  totalDuration: number;
}

interface FlowRunTrackerProps {
  run: FlowRun;
  onAction: (action: string) => void;
}

export function FlowRunTracker({ run, onAction }: FlowRunTrackerProps) {
  return (
    <div className="glass-panel p-6 rounded-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Tiến độ thực thi
        </h3>
        <div className="flex items-center gap-2">
          {run.status === 'running' && (
            <button onClick={() => onAction('pause')} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-amber-500/30">
              <Pause className="w-3.5 h-3.5" /> Tạm dừng
            </button>
          )}
          {run.status === 'paused' && (
            <button onClick={() => onAction('resume')} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-emerald-500/30">
              <Play className="w-3.5 h-3.5" /> Tiếp tục
            </button>
          )}
          {(run.status === 'running' || run.status === 'paused') && (
            <button onClick={() => onAction('cancel')} className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-rose-500/30">
              <X className="w-3.5 h-3.5" /> Hủy
            </button>
          )}
          {run.status === 'failed' && (
            <button onClick={() => onAction('retry')} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-glow">
              <RotateCcw className="w-3.5 h-3.5" /> Thử lại
            </button>
          )}
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-purple-400">{run.progress}% Hoàn thành</span>
          <span className="text-slate-400">
            Tổng phí: <span className="text-emerald-400">${run.totalCost.toFixed(4)}</span>
          </span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 relative"
            initial={{ width: 0 }}
            animate={{ width: `${run.progress}%` }}
            transition={{ duration: 0.5 }}
          >
            {run.status === 'running' && (
              <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/20 animate-[shimmer_1s_infinite]" />
            )}
          </motion.div>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3 pt-2">
        {run.steps.map((step, idx) => (
          <div 
            key={step.id} 
            className={cn(
              "p-4 rounded-2xl border transition-all flex items-start gap-4",
              step.status === 'running' ? "bg-slate-800/80 border-purple-500/50" : "bg-slate-900/50 border-slate-800"
            )}
          >
            <div className="mt-0.5">
              {step.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {step.status === 'running' && <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />}
              {step.status === 'failed' && <AlertCircle className="w-5 h-5 text-rose-400" />}
              {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-700" />}
            </div>
            
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className={cn(
                  "font-bold text-sm",
                  step.status === 'running' ? "text-white" : "text-slate-300"
                )}>
                  {idx + 1}. {step.name}
                </h4>
                
                {(step.status === 'completed' || step.status === 'running') && (
                  <div className="flex items-center gap-3 text-xs">
                    {step.duration !== undefined && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" /> {step.duration}s
                      </span>
                    )}
                    {step.cost !== undefined && (
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <DollarSign className="w-3 h-3" /> {step.cost.toFixed(4)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {step.error && (
                <div className="p-2 mt-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {step.error}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
