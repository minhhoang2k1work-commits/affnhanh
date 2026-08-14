'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, Video, FileText, Wand2, Plus, X, UploadCloud, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface ProjectFormData {
  productDescription: string;
  images: string[];
  style: string;
  duration: string;
  language: string;
  templateId?: string;
}

interface VideoStudioFormProps {
  onSubmit: (data: ProjectFormData) => void;
  isLoading: boolean;
}

export function VideoStudioForm({ onSubmit, isLoading }: VideoStudioFormProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    productDescription: '',
    images: [],
    style: 'Trendy',
    duration: '30s',
    language: 'vi',
  });
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Description */}
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            1. Mô tả sản phẩm
          </label>
          <button 
            type="button" 
            onClick={() => setIsProductModalOpen(true)}
            className="text-xs px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 font-semibold hover:bg-purple-500/30 transition-colors flex items-center gap-1.5"
          >
            <Library className="w-4 h-4" />
            Chọn từ thư viện
          </button>
        </div>
        <textarea
          rows={4}
          placeholder="Nhập thông tin sản phẩm, USP, giá bán, khuyến mãi..."
          className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
          value={formData.productDescription}
          onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
        />
      </div>

      {/* Style & Duration */}
      <div className="glass-panel p-6 rounded-3xl space-y-6">
        <label className="text-sm font-bold text-white flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-purple-400" />
          2. Phong cách & Thời lượng
        </label>
        
        <div className="space-y-3">
          <span className="text-xs text-slate-400 font-semibold uppercase">Thời lượng video</span>
          <div className="flex flex-wrap gap-2">
            {['15s', '30s', '60s'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setFormData({ ...formData, duration: d })}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-bold transition-all",
                  formData.duration === d 
                    ? "bg-purple-600 text-white shadow-lg" 
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        
        <div className="space-y-3">
           <span className="text-xs text-slate-400 font-semibold uppercase">Ngôn ngữ</span>
           <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, language: 'vi' })}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-bold transition-all",
                  formData.language === 'vi' 
                    ? "bg-purple-600 text-white shadow-lg" 
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                )}
              >
                Tiếng Việt
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, language: 'en' })}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-bold transition-all",
                  formData.language === 'en' 
                    ? "bg-purple-600 text-white shadow-lg" 
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                )}
              >
                English
              </button>
           </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !formData.productDescription}
        className="w-full py-4 rounded-2xl gradient-brand text-white font-extrabold text-sm shadow-xl shadow-purple-900/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <span className="animate-pulse">ĐANG KHỞI TẠO...</span>
        ) : (
          <>
            <Wand2 className="w-5 h-5" />
            <span>TẠO VIDEO MỚI</span>
          </>
        )}
      </button>
    </form>
  );
}
