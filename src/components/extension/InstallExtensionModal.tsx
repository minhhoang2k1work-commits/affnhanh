'use client';

import React, { useState } from 'react';
import {
  Download,
  CheckCircle2,
  X,
  ExternalLink,
  Puzzle,
  Sparkles,
  ArrowRight,
  FolderArchive,
  ToggleRight,
  Layers,
  Copy,
  Check,
} from 'lucide-react';

interface InstallExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected?: boolean;
}

export function InstallExtensionModal({ isOpen, onClose, isConnected }: InstallExtensionModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setDownloading(true);
    const link = document.createElement('a');
    link.href = '/api/extension/download';
    link.download = 'AFF-Shopee-Scanner-Extension.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 2000);
  };

  const handleCopyChromeUrl = () => {
    navigator.clipboard.writeText('chrome://extensions/');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold uppercase tracking-wider">
            <Puzzle className="w-3.5 h-3.5" />
            Cài Đặt Tiện Ích Trình Duyệt
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            Cài Đặt Extension Quét Shopee Tự Động
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Dành cho người mới — Chỉ mất 30 giây để cài đặt và bắt đầu quét toàn bộ sản phẩm Shopee tự động!
          </p>
        </div>

        {/* Status indicator */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
          isConnected
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <div>
              <p className="text-xs font-bold">
                {isConnected ? '🟢 Tiện ích đã kết nối thành công!' : '⚪ Chưa phát hiện tiện ích trên Chrome'}
              </p>
              <p className="text-[11px] opacity-80">
                {isConnected
                  ? 'Bạn đã sẵn sàng để quét tự động từ website.'
                  : 'Hãy làm theo 3 bước đơn giản bên dưới để cài đặt.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/20 shrink-0 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Đang tải...' : 'Tải File ZIP'}</span>
          </button>
        </div>

        {/* 3 Steps Guide */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            3 Bước Cài Đặt Siêu Dễ
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 relative flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-sm">
                  1
                </div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <FolderArchive className="w-4 h-4 text-purple-400" />
                  Tải & Giải Nén
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bấm nút <strong>Tải File ZIP</strong> ở trên, sau đó nhấp chuột phải vào file vừa tải chọn <strong>Extract All (Giải nén)</strong>.
                </p>
              </div>

              <button
                onClick={handleDownload}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Ngay (.zip)</span>
              </button>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 relative flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-sm">
                  2
                </div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ToggleRight className="w-4 h-4 text-cyan-400" />
                  Mở Trang Extension
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Mở tab mới trên Chrome, dán <code>chrome://extensions/</code> và gạt bật nút <strong>Chế độ cho nhà phát triển (Developer mode)</strong> ở góc phải.
                </p>
              </div>

              <button
                onClick={handleCopyChromeUrl}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-700"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đã Copy Link!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Đường Dẫn</span>
                  </>
                )}
              </button>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 relative flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm">
                  3
                </div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Nạp Tiện Ích
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bấm nút <strong>Tải tiện ích đã giải nén (Load unpacked)</strong> ở góc trái ➜ Chọn thư mục vừa giải nén ở Bước 1.
                </p>
              </div>

              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-300 text-[11px] font-bold text-center border border-emerald-500/20">
                ✓ Hoàn thành tự động!
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            Hỗ trợ tất cả trình duyệt: Google Chrome, Cốc Cốc, Microsoft Edge, Brave.
          </span>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all w-full sm:w-auto"
          >
            Đã Hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
