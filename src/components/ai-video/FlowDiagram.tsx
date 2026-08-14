'use client';

import React from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface FlowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
}

interface FlowDiagramProps {
  steps: FlowStep[];
  currentStepId?: string;
}

export function FlowDiagram({ steps, currentStepId }: FlowDiagramProps) {
  return (
    <div className="glass-panel p-6 rounded-3xl space-y-0 relative">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isActive = step.id === currentStepId;

        return (
          <div key={step.id} className="relative flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center z-10 shadow-lg relative",
                step.status === 'completed' ? "bg-emerald-500 text-slate-950" :
                step.status === 'running' ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]" :
                step.status === 'failed' ? "bg-rose-500 text-white" :
                "bg-slate-800 border border-slate-700 text-slate-500"
              )}>
                {step.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                {step.status === 'running' && <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />}
                {step.status === 'failed' && <AlertCircle className="w-4 h-4" />}
                {step.status === 'pending' && <Circle className="w-3 h-3" />}
              </div>
              {!isLast && (
                <div className={cn(
                  "w-0.5 h-12 -my-2 z-0",
                  step.status === 'completed' ? "bg-emerald-500/50" : "bg-slate-800"
                )} />
              )}
            </div>
            
            <div className="pt-1.5 pb-8">
              <h4 className={cn(
                "text-sm font-bold",
                step.status === 'completed' ? "text-emerald-400" :
                step.status === 'running' ? "text-white" :
                step.status === 'failed' ? "text-rose-400" :
                "text-slate-400"
              )}>
                {step.name}
              </h4>
              {step.duration && (
                <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" /> {step.duration}s
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
