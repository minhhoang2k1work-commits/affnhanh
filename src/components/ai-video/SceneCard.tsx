'use client';

import React from 'react';
import { Camera, RefreshCw, AlertCircle, Play, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Scene } from './StoryboardTimeline';

interface SceneCardProps {
  scene: Scene;
  isActive: boolean;
  onClick: () => void;
}

export function SceneCard({ scene, isActive, onClick }: SceneCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "glass-panel rounded-2xl p-4 cursor-pointer transition-all border-2",
        isActive ? "border-purple-500 bg-slate-800/80 shadow-glow" : "border-transparent hover:border-slate-700"
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Visual Preview */}
        <div className="aspect-video rounded-xl bg-slate-900 border border-slate-800 overflow-hidden relative flex items-center justify-center group">
          {scene.thumbnailUrl ? (
            <>
              <img src={scene.thumbnailUrl} alt="scene" className="w-full h-full object-cover" />
              {scene.status === 'completed' && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Play className="w-8 h-8 text-white" />
                </div>
              )}
            </>
          ) : (
            <Video className="w-8 h-8 text-slate-700" />
          )}
          
          {/* Status Overlay */}
          {scene.status === 'generating' && (
            <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center backdrop-blur-sm">
              <RefreshCw className="w-6 h-6 text-purple-400 animate-spin mb-2" />
              <span className="text-[10px] font-bold text-white">Đang render...</span>
            </div>
          )}
          {scene.status === 'failed' && (
            <div className="absolute inset-0 bg-rose-900/80 flex flex-col items-center justify-center backdrop-blur-sm">
              <AlertCircle className="w-6 h-6 text-rose-400 mb-2" />
              <span className="text-[10px] font-bold text-white">Thất bại</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="md:col-span-2 flex flex-col justify-between py-1">
          <div className="space-y-3">
             <div className="flex items-start gap-2">
               <Camera className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
               <p className="text-sm text-slate-200 font-medium">{scene.visual}</p>
             </div>
             <div className="pl-6 text-sm text-slate-400 italic">
               "{scene.narration}"
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-800/50">
             <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 font-semibold">
               ⏱ {scene.duration}s
             </span>
             <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
               🎥 {scene.camera}
             </span>
             <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20">
               ✨ {scene.transition}
             </span>
          </div>
        </div>
      </div>
    </div>
  );
}
