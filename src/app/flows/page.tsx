'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Workflow,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Layers,
  Sparkles,
  Pause,
  RotateCcw,
  AlertCircle,
  Clapperboard,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const flowIcons: Record<string, string> = {
  llm_script: '📝',
  llm_storyboard: '🎬',
  generate_image: '🖼️',
  generate_video: '🎥',
  generate_voice: '🎙️',
  assemble: '🔧',
  notify: '🔔',
};

export default function FlowManagerPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'templates' | 'history'>('templates');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesRes, runsRes] = await Promise.all([
          fetch('/api/flows'),
          fetch('/api/flows/runs?limit=20'),
        ]);
        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data.templates || []);
        }
        if (runsRes.ok) {
          const data = await runsRes.json();
          setRuns(data.runs || []);
        }
      } catch (err) {
        console.error('Failed to fetch:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Chờ xử lý', color: 'text-slate-400 bg-slate-500/10', icon: Clock },
    running: { label: 'Đang chạy', color: 'text-amber-400 bg-amber-500/10', icon: Loader2 },
    paused: { label: 'Tạm dừng', color: 'text-blue-400 bg-blue-500/10', icon: Pause },
    completed: { label: 'Hoàn thành', color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle2 },
    failed: { label: 'Thất bại', color: 'text-rose-400 bg-rose-500/10', icon: XCircle },
    cancelled: { label: 'Đã hủy', color: 'text-slate-400 bg-slate-500/10', icon: XCircle },
  };

  const handleUseTemplate = (templateId: string) => {
    router.push(`/ai-video?templateId=${templateId}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          Flow Manager
        </h1>
        <p className="text-slate-400 mt-1 text-sm">Quản lý pipeline tự động hóa tạo video AI</p>
      </motion.div>

      {/* Section Toggle */}
      <div className="flex gap-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800">
        {(['templates', 'history'] as const).map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
              activeSection === section
                ? 'bg-gradient-to-r from-purple-600/80 to-indigo-600/70 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            )}
          >
            {section === 'templates' ? <Layers className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            {section === 'templates' ? 'Flow Templates' : 'Lịch Sử Chạy'}
            {section === 'history' && runs.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white/20 rounded-full">{runs.length}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Templates Section */}
          {activeSection === 'templates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.length === 0 ? (
                <div className="col-span-full p-12 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                  <Layers className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-300">Chưa có Flow Template</h3>
                  <p className="text-slate-500 mt-1 text-sm">Templates sẽ được tạo tự động khi bạn bắt đầu sử dụng AI Video Studio</p>
                </div>
              ) : (
                templates.map((template, i) => {
                  const steps = template.steps || [];
                  return (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/30 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-base">{template.name}</h3>
                          <p className="text-xs text-slate-400 mt-1">{template.description}</p>
                        </div>
                        {template.isSystem && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400">
                            SYSTEM
                          </span>
                        )}
                      </div>

                      {/* Mini Flow Diagram */}
                      <div className="flex items-center gap-1 mb-4 overflow-x-auto py-2">
                        {steps.map((step: any, j: number) => (
                          <React.Fragment key={step.id}>
                            <div className="flex flex-col items-center shrink-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm">
                                {flowIcons[step.type] || '⚙️'}
                              </div>
                              <span className="text-[9px] text-slate-500 mt-1 max-w-[60px] truncate text-center">
                                {step.name}
                              </span>
                            </div>
                            {j < steps.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-slate-600 shrink-0 mt-[-12px]" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{steps.length} bước</span>
                        <button
                          onClick={() => handleUseTemplate(template.id)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1.5"
                        >
                          <Clapperboard className="w-3.5 h-3.5" /> Sử Dụng
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}

          {/* History Section */}
          {activeSection === 'history' && (
            <div className="space-y-3">
              {runs.length === 0 ? (
                <div className="p-12 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                  <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-300">Chưa có lịch sử chạy</h3>
                  <p className="text-slate-500 mt-1 text-sm">Bắt đầu tạo video để xem lịch sử pipeline</p>
                </div>
              ) : (
                runs.map((run, i) => {
                  const st = statusConfig[run.status] || statusConfig.pending;
                  const StatusIcon = st.icon;
                  return (
                    <motion.div
                      key={run.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                      onClick={() => run.videoProjectId && router.push(`/ai-video/${run.videoProjectId}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', st.color.split(' ')[1])}>
                            <StatusIcon className={cn('w-5 h-5', st.color.split(' ')[0], run.status === 'running' && 'animate-spin')} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm">{run.template?.name || 'Flow Run'}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-bold', st.color)}>{st.label}</span>
                              <span className="text-[11px] text-slate-500">
                                {new Date(run.createdAt).toLocaleString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Progress */}
                          <div className="hidden md:flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  run.status === 'completed' ? 'bg-emerald-400' : run.status === 'failed' ? 'bg-rose-400' : 'bg-amber-400'
                                )}
                                style={{ width: `${run.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-8">{run.progress}%</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
