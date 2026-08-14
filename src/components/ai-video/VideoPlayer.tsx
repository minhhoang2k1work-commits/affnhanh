'use client';

import React, { useState } from 'react';
import { Play, Pause, Download, Maximize, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Scene {
  id: string;
  visual: string;
  narration: string;
  duration: number;
}

interface VideoPlayerProps {
  videoUrl?: string;
  thumbnailUrl?: string;
  scenes?: Scene[];
  onDownload?: () => void;
}

export function VideoPlayer({ videoUrl, thumbnailUrl, scenes, onDownload }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800 flex flex-col relative aspect-video bg-slate-950">
      {videoUrl ? (
        <video 
          src={videoUrl} 
          className="w-full h-full object-contain"
          controls={false}
          poster={thumbnailUrl}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
           {thumbnailUrl ? (
             <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover opacity-50" />
           ) : (
             <div className="text-slate-500 flex flex-col items-center gap-2">
                <Play className="w-12 h-12" />
                <span className="text-sm">Video chưa sẵn sàng</span>
             </div>
           )}
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2">
         <div className="w-full h-1 bg-slate-700/50 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-purple-500 w-[30%]" />
         </div>
         <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-purple-400">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <div className="text-xs font-mono">00:05 / 00:30</div>
            </div>
            <div className="flex items-center gap-3">
              {onDownload && (
                <button onClick={onDownload} className="hover:text-purple-400">
                  <Download className="w-5 h-5" />
                </button>
              )}
              <button className="hover:text-purple-400">
                <Maximize className="w-5 h-5" />
              </button>
            </div>
         </div>
      </div>
    </div>
  );
}
