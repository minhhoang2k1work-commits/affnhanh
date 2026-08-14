'use client';

import React from 'react';
import { Briefcase, Zap, Sparkles, Flame, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const STYLES = [
  {
    id: 'Professional',
    name: 'Professional',
    desc: 'Chuyên nghiệp, sạch sẽ, tin cậy',
    icon: Briefcase,
    color: 'blue'
  },
  {
    id: 'Trendy',
    name: 'Trendy',
    desc: 'Năng động, bắt trend, Gen-Z',
    icon: Flame,
    color: 'orange'
  },
  {
    id: 'Minimal',
    name: 'Minimal',
    desc: 'Tối giản, thanh lịch, tinh tế',
    icon: Sparkles,
    color: 'slate'
  },
  {
    id: 'Energetic',
    name: 'Energetic',
    desc: 'Sôi động, mạnh mẽ, hành động',
    icon: Zap,
    color: 'yellow'
  },
  {
    id: 'Luxury',
    name: 'Luxury',
    desc: 'Sang trọng, cao cấp, đẳng cấp',
    icon: Gem,
    color: 'amber'
  }
];

interface StyleSelectorProps {
  selected: string;
  onChange: (style: string) => void;
}

export function StyleSelector({ selected, onChange }: StyleSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {STYLES.map((style) => {
        const Icon = style.icon;
        const isSelected = selected === style.id;
        
        return (
          <div
            key={style.id}
            onClick={() => onChange(style.id)}
            className={cn(
              "cursor-pointer rounded-2xl p-4 flex flex-col items-center text-center transition-all duration-300 border-2",
              isSelected 
                ? "bg-slate-800/80 border-purple-500 shadow-glow scale-[1.02]" 
                : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
              isSelected ? `bg-${style.color}-500/20 text-${style.color}-400` : "bg-slate-800 text-slate-400"
            )}>
              <Icon className="w-6 h-6" />
            </div>
            <h4 className={cn("text-sm font-bold mb-1", isSelected ? "text-white" : "text-slate-300")}>
              {style.name}
            </h4>
            <p className="text-[10px] text-slate-500 leading-tight">
              {style.desc}
            </p>
          </div>
        );
      })}
    </div>
  );
}
