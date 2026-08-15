'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clapperboard,
  Loader2,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Film,
  Library,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Workflow,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { VideoStudioForm, ProjectFormData } from '@/components/ai-video/VideoStudioForm';
import { ScriptEditor } from '@/components/ai-video/ScriptEditor';
import { StoryboardTimeline } from '@/components/ai-video/StoryboardTimeline';
import { FlowRunTracker } from '@/components/ai-video/FlowRunTracker';
import { VideoPlayer } from '@/components/ai-video/VideoPlayer';
import { GoogleDrivePanel } from '@/components/ai-video/GoogleDrivePanel';
import { resolveSelectedFlowTemplateId } from '@/lib/flow/template-selection';

type WizardStep = 'form' | 'script' | 'storyboard' | 'generating' | 'complete';
type Tab = 'create' | 'processing' | 'library';

export default function AIVideoStudioPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [wizardStep, setWizardStep] = useState<WizardStep>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [processingProjects, setProcessingProjects] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);

  // Preserve the flow selected from /flows and make that choice visible here.
  useEffect(() => {
    const templateId = resolveSelectedFlowTemplateId(window.location.search);
    if (!templateId) return;

    setSelectedTemplateId(templateId);
    fetch('/api/flows')
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        const template = payload?.templates?.find((item: any) => item.id === templateId);
        setSelectedTemplateName(template?.name || 'Mẫu quy trình đã chọn');
      })
      .catch(() => setSelectedTemplateName('Mẫu quy trình đã chọn'));
  }, []);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const [allRes, processingRes] = await Promise.all([
        fetch('/api/ai-video?limit=20&status=completed'),
        fetch('/api/ai-video?limit=20&status=generating_video,scripting,storyboarding,generating_images,generating_voiceover,assembling,archiving'),
      ]);
      if (allRes.ok) {
        const data = await allRes.json();
        setProjects(data.projects || []);
      }
      if (processingRes.ok) {
        const data = await processingRes.json();
        setProcessingProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Auto-refresh processing projects
  useEffect(() => {
    if (activeTab === 'processing' || wizardStep === 'generating') {
      const interval = setInterval(fetchProjects, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, wizardStep, fetchProjects]);

  // Handle form submit
  const handleCreateProject = async (formData: ProjectFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.productDescription.slice(0, 50) || 'AI Video Project',
          productDescription: formData.productDescription,
          productImages: formData.images,
          style: formData.style,
          duration: parseInt(formData.duration) || 30,
          language: formData.language,
        }),
      });
      if (!res.ok) throw new Error('Không thể tạo project');
      const payload = await res.json();
      const project = payload.project;
      if (!project?.id) throw new Error('API không trả về project hợp lệ');
      const templateId = resolveSelectedFlowTemplateId(window.location.search, selectedTemplateId);
      setCurrentProject({ ...project, templateId: templateId || undefined });

      // Auto-generate script
      const scriptRes = await fetch(`/api/ai-video/${project.id}/script`, {
        method: 'POST',
      });
      if (scriptRes.ok) {
        const scriptData = await scriptRes.json();
        setCurrentProject((prev: any) => ({ ...prev, script: scriptData.script }));
        setWizardStep('script');
      } else {
        throw new Error('Không thể tạo script. Vui lòng kiểm tra API key OpenAI.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle script actions
  const handleRegenerateScript = async () => {
    if (!currentProject) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai-video/${currentProject.id}/script`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCurrentProject((prev: any) => ({ ...prev, script: data.script }));
      }
    } catch (err) {
      console.error('Failed to regenerate script:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToStoryboard = async () => {
    if (!currentProject) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai-video/${currentProject.id}/storyboard`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCurrentProject((prev: any) => ({ ...prev, scenes: data.scenes, storyboard: data.scenes }));
        setWizardStep('storyboard');
      }
    } catch (err) {
      console.error('Failed to generate storyboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle start generation
  const handleStartGeneration = async () => {
    if (!currentProject) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai-video/${currentProject.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId || currentProject.templateId }),
      });
      if (res.ok) {
        setWizardStep('generating');
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to start generation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'create', label: 'Tạo Mới', icon: Plus },
    { key: 'processing', label: 'Đang Xử Lý', icon: Loader2, count: processingProjects.length },
    { key: 'library', label: 'Thư Viện', icon: Library },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            AI Video Studio
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Tạo video sản phẩm tự động bằng AI — từ mô tả đến video hoàn chỉnh</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/flows')}
            className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-purple-300 hover:bg-purple-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Workflow className="w-3.5 h-3.5" />
            Quy trình tự động hóa
          </button>
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI Powered
          </div>
        </div>
      </motion.div>

      <GoogleDrivePanel />

      {selectedTemplateId && (
        <div className="px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/25 text-sm text-purple-200 flex items-center gap-2">
          <Workflow className="w-4 h-4 shrink-0" />
          <span>Quy trình đã chọn: <strong>{selectedTemplateName || 'Đang tải...'}</strong></span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key === 'create') setWizardStep('form'); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-amber-600/80 to-orange-600/70 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              )}
            >
              <Icon className={cn('w-4 h-4', activeTab === tab.key && tab.key === 'processing' && 'animate-spin')} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white/20 rounded-full">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-white">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {/* Tab: Tạo Mới */}
        {activeTab === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Wizard Step: Form */}
            {wizardStep === 'form' && (
              <VideoStudioForm onSubmit={handleCreateProject} isLoading={isLoading} />
            )}

            {/* Wizard Step: Script Review */}
            {wizardStep === 'script' && currentProject?.script && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 font-bold">Bước 2/4</span>
                  Xem & chỉnh sửa Script AI tạo
                </div>
                <ScriptEditor
                  script={currentProject.script}
                  onUpdate={(script) => setCurrentProject((prev: any) => ({ ...prev, script }))}
                  onRegenerate={handleRegenerateScript}
                  onContinue={handleContinueToStoryboard}
                  isLoading={isLoading}
                />
              </div>
            )}

            {/* Wizard Step: Storyboard Review */}
            {wizardStep === 'storyboard' && currentProject?.scenes && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 font-bold">Bước 3/4</span>
                  Xem lại Storyboard trước khi tạo video
                </div>
                <StoryboardTimeline
                  scenes={currentProject.scenes}
                  onSceneClick={() => {}}
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setWizardStep('script')}
                    className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    ← Quay lại Script
                  </button>
                  <button
                    onClick={handleStartGeneration}
                    disabled={isLoading}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Bắt Đầu Tạo Video
                  </button>
                </div>
              </div>
            )}

            {/* Wizard Step: Generating */}
            {wizardStep === 'generating' && currentProject && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-400 font-bold">Bước 4/4</span>
                  Đang tạo video...
                </div>
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-4">
                  <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto" />
                  <p className="text-lg font-semibold">Đang xử lý pipeline AI...</p>
                  <p className="text-slate-400 text-sm">Video của bạn đang được tạo. Quá trình này có thể mất 2-5 phút.</p>
                  <button
                    onClick={() => router.push(`/ai-video/${currentProject.id}`)}
                    className="px-5 py-2 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors inline-flex items-center gap-2"
                  >
                    Xem Chi Tiết <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Đang Xử Lý */}
        {activeTab === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {processingProjects.length === 0 ? (
              <div className="p-12 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                <Film className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-300">Không có video đang xử lý</h3>
                <p className="text-slate-500 mt-1 text-sm">Tạo video mới để bắt đầu</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold"
                >
                  <Plus className="w-4 h-4 inline mr-1" /> Tạo Video Mới
                </button>
              </div>
            ) : (
              processingProjects.map((project) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/ai-video/${project.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{project.title}</h3>
                        <p className="text-xs text-slate-400">{project.status} • {project.style}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-400 font-bold">{project.status}</span>
                      <ArrowRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Tab: Thư Viện */}
        {activeTab === 'library' && (
          <motion.div
            key="library"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {projects.length === 0 ? (
              <div className="p-12 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                <Library className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-300">Thư viện video trống</h3>
                <p className="text-slate-500 mt-1 text-sm">Video hoàn thành sẽ hiển thị ở đây</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden cursor-pointer group"
                    onClick={() => router.push(`/ai-video/${project.id}`)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-slate-800 relative flex items-center justify-center">
                      {project.thumbnailUrl ? (
                        <img src={project.thumbnailUrl} alt={project.title} className="w-full h-full object-cover" />
                      ) : (
                        <Film className="w-12 h-12 text-slate-600" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                      {project.videoDuration && (
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white font-mono">
                          {project.videoDuration}s
                        </span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold text-sm truncate">{project.title}</h3>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(project.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full font-bold text-[10px]',
                          project.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        )}>
                          {project.status === 'completed' ? 'Hoàn thành' : project.status}
                        </span>
                      </div>
                      {project.actualCost && (
                        <p className="text-[11px] text-slate-500">Chi phí: ${project.actualCost.toFixed(2)}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
