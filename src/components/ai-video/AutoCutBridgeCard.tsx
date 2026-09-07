'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Film,
  Monitor,
  Download,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutoCutBridgeCardProps {
  projectId: string;
  project: {
    id: string;
    title: string;
    status: string;
    videoUrl?: string | null;
    scenes?: Array<{
      id: string;
      sceneNumber: number;
      visualPrompt: string;
      narration?: string | null;
      duration: number;
      videoClipUrl?: string | null;
      voiceoverUrl?: string | null;
    }>;
  };
  onProjectUpdated?: () => void;
}

export function AutoCutBridgeCard({
  projectId,
  project,
  onProjectUpdated,
}: AutoCutBridgeCardProps) {
  const [autocutOnline, setAutocutOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [exportResult, setExportResult] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Check AutoCut Desktop connection
  const checkAutoCut = useCallback(async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/bridge/status');
      const data = await res.json();
      setAutocutOnline(Boolean(data?.autocut?.online));
    } catch {
      setAutocutOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAutoCut();
  }, [checkAutoCut]);

  // Export timeline format
  const handleExportTimeline = async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/bridge/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export_timeline',
          projectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xuất timeline thất bại');
      setExportResult(data.timeline);
      setMessage({
        type: 'success',
        text: `Đã xuất Timeline NLE thành công! (${data.timeline.tracks?.[0]?.clips?.length || 0} video clips, ${data.timeline.tracks?.[1]?.clips?.length || 0} audio clips)`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Lỗi xuất timeline' });
    } finally {
      setIsExporting(false);
    }
  };

  // Submit high-quality NLE render job
  const handleSubmitRender = async () => {
    setIsRendering(true);
    setMessage(null);
    try {
      const res = await fetch('/api/bridge/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_render',
          projectId,
          priority: 'high',
          renderSettings: {
            codec: 'h264',
            resolution: '1080p',
            fps: 30,
            quality: 'high',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gửi render job thất bại');
      setMessage({
        type: 'info',
        text: 'Đã gửi yêu cầu render sang hàng đợi AutoCut NLE. AutoCut Desktop sẽ render chất lượng cao và đồng bộ kết quả.',
      });
      if (onProjectUpdated) onProjectUpdated();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Lỗi gửi render job' });
    } finally {
      setIsRendering(false);
    }
  };

  // Download timeline JSON file for manual import if needed
  const handleDownloadTimelineJson = () => {
    if (!exportResult) return;
    const blob = new Blob([JSON.stringify(exportResult, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_${projectId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasClips = Boolean(
    project.scenes?.some((s) => Boolean(s.videoClipUrl || s.voiceoverUrl))
  );

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
              AutoCut Desktop NLE Bridge
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal">
                Desktop Editor
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Dựng video timeline chuyên nghiệp, ghép clips AI và render FFmpeg
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border',
              autocutOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                autocutOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              )}
            />
            {autocutOnline ? 'AutoCut Desktop Online' : 'AutoCut Offline'}
          </div>
          <button
            onClick={checkAutoCut}
            disabled={isChecking}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Kiểm tra lại kết nối"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isChecking && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Connection notice if offline */}
      {!autocutOnline && (
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400 flex items-start gap-2.5">
          <Monitor className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-300">Khởi động AutoCut Desktop:</span>{' '}
            Mở terminal và chạy{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[11px]">
              python preview.py
            </code>{' '}
            trong thư mục <code className="text-slate-300">D:\AutoCut</code> để kết nối dựng phim thời gian thực.
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div
          className={cn(
            'p-3 rounded-xl text-xs flex items-center gap-2 border',
            message.type === 'success' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
            message.type === 'error' && 'bg-rose-500/10 border-rose-500/30 text-rose-300',
            message.type === 'info' && 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          )}
        >
          {message.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {message.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.type === 'info' && <Sparkles className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Action 1: Export / Send to Timeline */}
        <button
          onClick={handleExportTimeline}
          disabled={isExporting || !hasClips}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Layers className="w-4 h-4" />
          )}
          Xuất Timeline NLE ({project.scenes?.length || 0} scenes)
        </button>

        {/* Action 2: Render via AutoCut NLE */}
        <button
          onClick={handleSubmitRender}
          disabled={isRendering || !hasClips}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
        >
          {isRendering ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Render Chất Lượng Cao (AutoCut)
        </button>
      </div>

      {/* Export Result Box (if exported) */}
      {exportResult && (
        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Timeline đã sẵn sàng:
            </span>
            <button
              onClick={handleDownloadTimelineJson}
              className="text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
            >
              <Download className="w-3 h-3" /> Tải file JSON
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
            <div>Độ phân giải: <span className="text-slate-200 font-mono">{exportResult.targetResolution?.width}x{exportResult.targetResolution?.height}</span></div>
            <div>Tỉ lệ: <span className="text-slate-200 font-mono">{exportResult.aspectRatio}</span></div>
            <div>FPS: <span className="text-slate-200 font-mono">{exportResult.targetFps}</span></div>
          </div>
          <p className="text-[11px] text-slate-400">
            👉 Trên AutoCut Desktop, mở tab <strong className="text-amber-300">🛍️ AFF Hub</strong> và nhấn <strong className="text-blue-300">"Import vào Timeline NLE"</strong> để kéo các clip vào track.
          </p>
        </div>
      )}
    </div>
  );
}
