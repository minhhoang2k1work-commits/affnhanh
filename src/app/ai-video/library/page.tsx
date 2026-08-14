'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Library,
  Film,
  Play,
  Clock,
  Search,
  Filter,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VideoLibraryPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const fetchProjects = async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/ai-video?${params}`);
      if (res.ok) {
        const data = await res.json();
        let items = data.projects || [];
        if (sortBy === 'oldest') items.reverse();
        if (sortBy === 'name') items.sort((a: any, b: any) => a.title.localeCompare(b.title));
        setProjects(items);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Xóa video này?')) return;
    await fetch(`/api/ai-video/${id}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Nháp', color: 'bg-slate-600/20 text-slate-400' },
    completed: { label: 'Hoàn thành', color: 'bg-emerald-500/10 text-emerald-400' },
    failed: { label: 'Lỗi', color: 'bg-rose-500/10 text-rose-400' },
    scripting: { label: 'Scripting', color: 'bg-blue-500/10 text-blue-400' },
    generating_video: { label: 'Generating', color: 'bg-amber-500/10 text-amber-400' },
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Library className="w-5 h-5 text-white" />
          </div>
          Thư Viện Video
        </h1>
        <p className="text-slate-400 mt-1 text-sm">Tất cả video AI đã tạo</p>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm video..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </form>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-sm focus:outline-none"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="completed">Hoàn thành</option>
          <option value="draft">Nháp</option>
          <option value="failed">Lỗi</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-sm focus:outline-none"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="name">Theo tên</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="p-16 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
          <Film className="w-20 h-20 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300">Chưa có video nào</h3>
          <p className="text-slate-500 mt-1 text-sm">Tạo video đầu tiên tại AI Video Studio</p>
          <button
            onClick={() => router.push('/ai-video')}
            className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold"
          >
            Tạo Video Mới
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, i) => {
            const st = statusLabels[project.status] || statusLabels.draft;
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden cursor-pointer group relative"
                onClick={() => router.push(`/ai-video/${project.id}`)}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-slate-800/50 relative flex items-center justify-center">
                  {project.thumbnailUrl ? (
                    <img src={project.thumbnailUrl} alt={project.title} className="w-full h-full object-cover" />
                  ) : (
                    <Film className="w-14 h-14 text-slate-700" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100" />
                  </div>
                  {project.videoDuration && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-[11px] text-white font-mono">
                      {Math.floor(project.videoDuration / 60)}:{String(project.videoDuration % 60).padStart(2, '0')}
                    </span>
                  )}
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm truncate">{project.title}</h3>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(project.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded-full font-bold', st.color)}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">{project.style} • {project.duration}s</span>
                    {project.actualCost && (
                      <span className="text-emerald-400 font-semibold">${project.actualCost.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {projects.length > 0 && (
        <div className="text-center text-xs text-slate-500 pt-4">
          {projects.length} video • {projects.filter(p => p.status === 'completed').length} hoàn thành
        </div>
      )}
    </div>
  );
}
