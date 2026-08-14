'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  RefreshCw,
  Clock,
  DollarSign,
  Film,
  Play,
  Upload,
  CloudUpload,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScriptEditor } from '@/components/ai-video/ScriptEditor';
import { StoryboardTimeline } from '@/components/ai-video/StoryboardTimeline';
import { FlowDiagram } from '@/components/ai-video/FlowDiagram';
import { FlowRunTracker } from '@/components/ai-video/FlowRunTracker';
import { VideoPlayer } from '@/components/ai-video/VideoPlayer';
import Link from 'next/link';

export default function VideoProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai-video/${projectId}`);
      if (!res.ok) throw new Error('Không tìm thấy project');
      const data = await res.json();
      setProject(data.project);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Auto-refresh while processing
  useEffect(() => {
    if (project && !['completed', 'failed', 'draft'].includes(project.status)) {
      const interval = setInterval(fetchProject, 3000);
      return () => clearInterval(interval);
    }
  }, [project?.status, fetchProject]);

  const handleRetry = async () => {
    try {
      await fetch(`/api/ai-video/${projectId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: project?.flowRun?.templateId }),
      });
      fetchProject();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  const handlePublishYouTube = async () => {
    if (!confirm('Upload video lên YouTube ở chế độ riêng tư?')) return;
    setIsPublishing(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai-video/${projectId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'youtube', privacyStatus: 'private' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Không thể upload YouTube');
      window.open(payload.publication.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleArchiveGoogleDrive = async () => {
    setIsArchiving(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai-video/${projectId}/archive`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Không thể lưu lên Google Drive');
      await fetchProject();
      window.open(payload.storage.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsArchiving(false);
    }
  };

  const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
    draft: { color: 'text-slate-400', icon: Clock, label: 'Nháp' },
    scripting: { color: 'text-blue-400', icon: Loader2, label: 'Đang tạo script...' },
    storyboarding: { color: 'text-blue-400', icon: Loader2, label: 'Đang tạo storyboard...' },
    generating_images: { color: 'text-amber-400', icon: Loader2, label: 'Đang tạo ảnh tham chiếu...' },
    generating_video: { color: 'text-amber-400', icon: Loader2, label: 'Đang tạo video...' },
    generating_voiceover: { color: 'text-purple-400', icon: Loader2, label: 'Đang tạo thuyết minh...' },
    assembling: { color: 'text-cyan-400', icon: Loader2, label: 'Đang ghép video...' },
    archiving: { color: 'text-blue-400', icon: Loader2, label: 'Đang lưu Google Drive...' },
    completed: { color: 'text-emerald-400', icon: CheckCircle2, label: 'Hoàn thành!' },
    failed: { color: 'text-rose-400', icon: XCircle, label: 'Thất bại' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Không tìm thấy project</h2>
        <p className="text-slate-400 mb-4">{error || 'Project này không tồn tại'}</p>
        <Link href="/ai-video" className="text-amber-400 hover:underline">← Quay lại Video Studio</Link>
      </div>
    );
  }

  const status = statusConfig[project.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/ai-video"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">{project.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn('flex items-center gap-1.5 text-sm font-semibold', status.color)}>
                <StatusIcon className={cn('w-4 h-4', project.status.includes('generating') || project.status === 'scripting' || project.status === 'storyboarding' || project.status === 'assembling' || project.status === 'archiving' ? 'animate-spin' : '')} />
                {status.label}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(project.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {project.status === 'completed' && project.videoUrl && project.storage?.googleDrive?.url && (
            <a
              href={project.storage.googleDrive.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Mở Google Drive
            </a>
          )}
          {project.status === 'completed' && project.videoUrl && !project.storage?.googleDrive?.url && (
            <button
              onClick={handleArchiveGoogleDrive}
              disabled={isArchiving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium flex items-center gap-2 transition-colors"
            >
              {isArchiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              Lưu Google Drive
            </button>
          )}
          {project.status === 'completed' && project.videoUrl && (
            <button
              onClick={handlePublishYouTube}
              disabled={isPublishing}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium flex items-center gap-2 transition-colors"
            >
              {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              YouTube riêng tư
            </button>
          )}
          {project.status === 'completed' && project.videoUrl && (
            <a
              href={project.videoUrl}
              download
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" /> Tải Video
            </a>
          )}
          {project.status === 'failed' && (
            <button
              onClick={handleRetry}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Thử Lại
            </button>
          )}
        </div>
      </motion.div>

      {/* Project Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Style', value: project.style, icon: '🎬' },
          { label: 'Thời lượng', value: `${project.duration}s`, icon: '⏱️' },
          { label: 'Ngôn ngữ', value: project.language === 'vi' ? 'Tiếng Việt' : 'English', icon: '🌐' },
          { label: 'Chi phí', value: project.actualCost ? `$${project.actualCost.toFixed(2)}` : (project.estimatedCost ? `~$${project.estimatedCost.toFixed(2)}` : 'N/A'), icon: '💰' },
        ].map((item) => (
          <div key={item.label} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">{item.icon} {item.label}</p>
            <p className="text-sm font-semibold mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Flow Progress */}
        <div className="lg:col-span-1 space-y-4">
          {project.flowRun && (
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <h3 className="font-semibold mb-3 text-sm text-slate-300">Pipeline Progress</h3>
              <FlowDiagram
                steps={project.flowRun.stepRuns?.map((sr: any) => ({
                  id: sr.stepId,
                  name: sr.stepName,
                  type: sr.stepType,
                  status: sr.status,
                })) || []}
                currentStepId={project.flowRun.currentStepId}
              />
            </div>
          )}

          {project.flowRun && (
            <FlowRunTracker
              run={{
                id: project.flowRun.id,
                status: project.flowRun.status,
                progress: project.flowRun.progress || 0,
                steps: (project.flowRun.stepRuns || []).map((step: any) => ({
                  id: step.id,
                  name: step.stepName,
                  status: step.status,
                  duration: step.duration,
                  cost: step.cost,
                  error: step.errorMessage,
                })),
                totalCost: (project.flowRun.stepRuns || []).reduce((sum: number, step: any) => sum + (step.cost || 0), 0),
                totalDuration: (project.flowRun.stepRuns || []).reduce((sum: number, step: any) => sum + (step.duration || 0), 0),
              }}
              onAction={async (action) => {
                await fetch(`/api/flows/runs/${project.flowRun.id}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action }),
                });
                fetchProject();
              }}
            />
          )}
        </div>

        {/* Right: Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player (if completed) */}
          {project.status === 'completed' && (
            <VideoPlayer
              videoUrl={project.videoUrl}
              thumbnailUrl={project.thumbnailUrl}
              scenes={project.scenes}
              onDownload={() => window.open(project.videoUrl, '_blank')}
            />
          )}

          {/* Script (if available) */}
          {project.script && project.status !== 'completed' && (
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <h3 className="font-semibold mb-3 text-sm text-slate-300">📝 Script</h3>
              <div className="space-y-2 text-sm">
                {project.script.sections?.map((section: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-800/50">
                    <span className="text-xs text-amber-400 font-bold uppercase">{section.type}</span>
                    <p className="mt-1 text-slate-200">{section.content}</p>
                    {section.visualDescription && (
                      <p className="mt-1 text-xs text-slate-500 italic">🎥 {section.visualDescription}</p>
                    )}
                  </div>
                )) || <p className="text-slate-500">Script đang được tạo...</p>}
              </div>
            </div>
          )}

          {/* Storyboard Timeline */}
          {project.scenes && project.scenes.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <h3 className="font-semibold mb-3 text-sm text-slate-300">🎬 Storyboard</h3>
              <StoryboardTimeline
                scenes={project.scenes}
                activeScene={activeScene}
                onSceneClick={setActiveScene}
              />
            </div>
          )}

          {/* Error Display */}
          {project.status === 'failed' && project.errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                <span className="font-semibold text-rose-300">Lỗi xảy ra</span>
              </div>
              <p className="text-sm text-rose-200/70">{project.errorMessage}</p>
            </div>
          )}

          {/* Processing Animation */}
          {!['completed', 'failed', 'draft'].includes(project.status) && !project.script && (
            <div className="p-12 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
              <Loader2 className="w-16 h-16 text-amber-400 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold">{status.label}</h3>
              <p className="text-slate-400 text-sm mt-1">Vui lòng chờ trong giây lát...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
