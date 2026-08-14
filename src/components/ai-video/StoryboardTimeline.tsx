'use client';

import React from 'react';
import { Film, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface Scene {
  id: string;
  visual: string;
  narration: string;
  duration: number;
  camera: string;
  transition: string;
  status?: 'pending' | 'generating' | 'completed' | 'failed';
  thumbnailUrl?: string;
}

interface StoryboardTimelineProps {
  scenes: Scene[];
  activeScene?: number;
  onSceneClick: (index: number) => void;
}

export function StoryboardTimeline({ scenes, activeScene, onSceneClick }: StoryboardTimelineProps) {
  const totalDuration = scenes.reduce((acc, curr) => acc + curr.duration, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Film className="w-4 h-4 text-purple-400" />
          Storyboard Timeline
        </h3>
        <span className="text-xs text-slate-400">Total: {totalDuration}s</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
        {scenes.map((scene, index) => {
          const isActive = index === activeScene;
          
          return (
            <div 
              key={scene.id}
              onClick={() => onSceneClick(index)}
              className={cn(
                "min-w-[280px] w-[280px] glass-panel rounded-2xl p-4 cursor-pointer snap-start transition-all duration-300",
                isActive ? "border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)] bg-slate-800/80" : "border-slate-800 hover:border-slate-600"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                  {index + 1}
                </span>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900/50 text-[10px] font-semibold text-slate-400">
                  <Clock className="w-3 h-3" />
                  {scene.duration}s
                </div>
              </div>
              
              <div className="space-y-3">
                {scene.thumbnailUrl ? (
                   <div className="aspect-video rounded-lg overflow-hidden bg-slate-900">
                      <img src={scene.thumbnailUrl} alt="scene" className="w-full h-full object-cover" />
                   </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-900/50 text-xs text-slate-300 line-clamp-3 min-h-[60px] italic">
                    "{scene.visual}"
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {scene.camera}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {scene.transition}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Duration Bar */}
      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden flex">
         {scenes.map((scene, i) => (
           <div 
             key={scene.id} 
             style={{ width: `${(scene.duration / totalDuration) * 100}%` }}
             className={cn(
               "h-full border-r border-slate-950 last:border-0",
               i === activeScene ? "bg-purple-500" : "bg-slate-700"
             )}
           />
         ))}
      </div>
    </div>
  );
}
