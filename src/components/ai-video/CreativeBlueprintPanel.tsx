'use client';

import React from 'react';
import { Palette, Users, ShieldCheck } from 'lucide-react';

interface CreativeBlueprintPanelProps {
  storyboard?: {
    styleBible?: {
      visualStyle?: string;
      palette?: string;
      lighting?: string;
      continuityRules?: string;
    };
    characters?: Array<{
      id?: string;
      name?: string;
      role?: string;
      appearance?: string;
      wardrobe?: string;
      signatureDetails?: string;
    }>;
  } | null;
}

export function CreativeBlueprintPanel({ storyboard }: CreativeBlueprintPanelProps) {
  const style = storyboard?.styleBible;
  const characters = storyboard?.characters || [];
  if (!style && characters.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
      <section className="rounded-2xl border border-purple-500/25 bg-purple-500/5 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-purple-200">
          <Palette className="h-4 w-4" /> Khóa phong cách
        </h3>
        <div className="space-y-2 text-xs text-slate-300">
          {style?.visualStyle && <p><span className="text-slate-500">Hình ảnh:</span> {style.visualStyle}</p>}
          {style?.palette && <p><span className="text-slate-500">Màu sắc:</span> {style.palette}</p>}
          {style?.lighting && <p><span className="text-slate-500">Ánh sáng:</span> {style.lighting}</p>}
          {style?.continuityRules && (
            <p className="flex gap-2 rounded-xl bg-slate-950/40 p-2 text-emerald-300">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {style.continuityRules}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-cyan-200">
          <Users className="h-4 w-4" /> Khóa nhân vật ({characters.length})
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {characters.map((character, index) => (
            <div key={character.id || index} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-xs">
              <p className="font-bold text-white">{character.name || `Nhân vật ${index + 1}`}</p>
              {character.role && <p className="mt-0.5 text-cyan-300">{character.role}</p>}
              {character.appearance && <p className="mt-2 text-slate-300">{character.appearance}</p>}
              {character.wardrobe && <p className="mt-1 text-slate-400">Trang phục: {character.wardrobe}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
