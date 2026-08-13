'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Link2,
  Copy,
  Check,
  Sparkles,
  Trash2,
  ExternalLink,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Package,
  Store,
  Globe,
} from 'lucide-react';
import {
  generateShopeeShortlink,
  generateShopeeShortlinkBatch,
  parseShopeeUrl,
  type ShortlinkResult,
} from '@/lib/affiliate/shopee-shortlink';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface HistoryItem {
  id: string;
  originalUrl: string;
  affiliateUrl: string;
  subId?: string;
  createdAt: string;
  type: 'product' | 'shop' | 'other';
  displayName: string;
}

const STORAGE_KEY_AFF_ID = 'aff_shopee_affiliate_id';
const STORAGE_KEY_HISTORY = 'aff_shortlink_history';
const MAX_HISTORY = 50;
const DEFAULT_AFFILIATE_ID = '17382580126';

// ---------------------------------------------------------------------------
// Sub-ID presets for quick selection
// ---------------------------------------------------------------------------
const SUB_ID_PRESETS = [
  { label: 'Facebook Video', value: 'FB_VIDEO' },
  { label: 'TikTok', value: 'TIKTOK' },
  { label: 'YouTube', value: 'YOUTUBE' },
  { label: 'Zalo', value: 'ZALO' },
  { label: 'Website/Blog', value: 'WEBSITE' },
  { label: 'Telegram', value: 'TELEGRAM' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LinkGeneratorPage() {
  // Core state
  const [affiliateId, setAffiliateId] = useState(DEFAULT_AFFILIATE_ID);
  const [urlInput, setUrlInput] = useState('');
  const [subIdValues, setSubIdValues] = useState(['', '', '', '', '']);
  const [results, setResults] = useState<ShortlinkResult[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [affIdSaved, setAffIdSaved] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY_AFF_ID);
      if (savedId) {
        setAffiliateId(savedId);
      } else {
        // Auto-save default ID on first visit
        localStorage.setItem(STORAGE_KEY_AFF_ID, DEFAULT_AFFILIATE_ID);
      }
      setAffIdSaved(true);
      const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch {}
  }, []);

  // Save affiliate ID to localStorage
  const handleSaveAffiliateId = useCallback(() => {
    if (affiliateId.trim()) {
      localStorage.setItem(STORAGE_KEY_AFF_ID, affiliateId.trim());
      setAffIdSaved(true);
      setTimeout(() => setAffIdSaved(false), 2000);
    }
  }, [affiliateId]);

  // Build combined sub_id string
  const buildSubId = useCallback((): string | undefined => {
    const parts = subIdValues.map((v) => v.trim()).filter(Boolean);
    if (parts.length === 0) return undefined;
    return parts.join('-');
  }, [subIdValues]);

  // Generate links
  const handleGenerate = useCallback(() => {
    if (!affiliateId.trim()) return;

    const urls = urlInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (urls.length === 0) return;

    setIsGenerating(true);

    // Small delay for animation feel
    setTimeout(() => {
      const subId = buildSubId();

      let generatedResults: ShortlinkResult[];

      if (urls.length === 1) {
        generatedResults = [
          generateShopeeShortlink({
            targetUrl: urls[0],
            affiliateId: affiliateId.trim(),
            subId,
          }),
        ];
      } else {
        generatedResults = generateShopeeShortlinkBatch(
          urls,
          affiliateId.trim(),
          subId
        );
      }

      setResults(generatedResults);

      // Add successful results to history
      const newHistoryItems: HistoryItem[] = generatedResults
        .filter((r) => r.success && r.affiliateUrl)
        .map((r) => {
          const parsed = parseShopeeUrl(r.originalUrl);
          return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            originalUrl: r.originalUrl,
            affiliateUrl: r.affiliateUrl!,
            subId,
            createdAt: new Date().toISOString(),
            type: parsed.type,
            displayName: parsed.displayName,
          };
        });

      if (newHistoryItems.length > 0) {
        setHistory((prev) => {
          const updated = [...newHistoryItems, ...prev].slice(0, MAX_HISTORY);
          try {
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      // Save affiliate ID if not saved yet
      if (affiliateId.trim()) {
        localStorage.setItem(STORAGE_KEY_AFF_ID, affiliateId.trim());
      }

      setIsGenerating(false);

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }, 300);
  }, [affiliateId, urlInput, buildSubId]);

  // Copy to clipboard
  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Copy all successful links
  const handleCopyAll = useCallback(() => {
    const allLinks = results
      .filter((r) => r.success && r.affiliateUrl)
      .map((r) => r.affiliateUrl)
      .join('\n');
    if (allLinks) {
      navigator.clipboard.writeText(allLinks);
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [results]);

  // Clear history
  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  }, []);

  // Update a single sub_id slot
  const updateSubId = (index: number, value: string) => {
    setSubIdValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // Apply preset
  const applyPreset = (presetValue: string) => {
    setSubIdValues((prev) => {
      const next = [...prev];
      next[2] = presetValue; // Slot 3 = referral source
      return next;
    });
  };

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;
  const hasResults = results.length > 0;
  const builtSubId = buildSubId();

  const typeIcon = (type: string) => {
    switch (type) {
      case 'product': return <Package className="w-3.5 h-3.5" />;
      case 'shop': return <Store className="w-3.5 h-3.5" />;
      default: return <Globe className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-24 md:pb-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900/50 via-teal-900/30 to-slate-900 border border-emerald-500/20 p-5 sm:p-7">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 text-[11px] sm:text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Shopee Affiliate Short-link Generator</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Tạo Link <span className="text-emerald-400">Tiếp Thị Liên Kết</span> Rút Gọn
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xl">
            Dán bất kỳ link Shopee nào — tự động tạo link Affiliate có gắn tracking.
            Không cần API key, chỉ cần Affiliate ID.
          </p>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-600/8 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Step 1: Affiliate ID */}
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-xs font-bold">
            1
          </div>
          <h2 className="text-sm font-bold text-white">Affiliate ID của bạn</h2>
          {affiliateId.trim() && (
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
              ✓ Đã nhập
            </span>
          )}
        </div>

        <div className="flex gap-2.5">
          <input
            type="text"
            value={affiliateId}
            onChange={(e) => setAffiliateId(e.target.value)}
            placeholder="Ví dụ: 14354840000"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all"
          />
          <button
            onClick={handleSaveAffiliateId}
            className="px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 transition-all active:scale-95 whitespace-nowrap"
          >
            {affIdSaved ? '✓ Đã lưu' : 'Lưu ID'}
          </button>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-900/50 rounded-lg p-3 border border-slate-800">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-500" />
          <span>
            Tìm Affiliate ID tại{' '}
            <a
              href="https://affiliate.shopee.vn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              affiliate.shopee.vn
            </a>{' '}
            → Hồ sơ → Affiliate ID. ID sẽ được lưu trên trình duyệt cho lần sau.
          </span>
        </div>
      </div>

      {/* Step 2: URL Input */}
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-xs font-bold">
            2
          </div>
          <h2 className="text-sm font-bold text-white">Dán Link Shopee</h2>
          <span className="ml-auto text-[10px] text-slate-500">Mỗi dòng 1 URL</span>
        </div>

        <textarea
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder={`https://shopee.vn/shop-name\nhttps://shopee.vn/product-name-i.12345.67890\n\nDán 1 hoặc nhiều link Shopee, mỗi dòng 1 link...`}
          rows={5}
          className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-all resize-none leading-relaxed font-mono text-[13px]"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {urlInput.split('\n').filter((l) => l.trim()).length} URL nhập
          </span>
          {urlInput.trim() && (
            <button
              onClick={() => setUrlInput('')}
              className="text-slate-500 hover:text-rose-400 active:text-rose-400 transition-colors px-2 py-1 -mr-2"
            >
              Xóa tất cả
            </button>
          )}
        </div>
      </div>

      {/* Step 3: Sub-ID Tracking (Advanced — Collapsible) */}
      <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center gap-2.5"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center text-slate-400 text-xs font-bold">
            3
          </div>
          <h2 className="text-sm font-bold text-white">Sub-ID Tracking</h2>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            Tùy chọn
          </span>
          <div className="ml-auto text-slate-400">
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAdvanced && (
          <div className="space-y-4 animate-fade-in">
            {/* Quick presets */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Nguồn giới thiệu nhanh
              </label>
              <div className="flex flex-wrap gap-2">
                {SUB_ID_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => applyPreset(preset.value)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all active:scale-95 ${
                      subIdValues[2] === preset.value
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5 Sub-ID fields */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              {['Sub-Publisher', 'Click ID', 'Nguồn', 'Custom 1', 'Custom 2'].map((label, idx) => (
                <div key={idx} className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-medium">{label}</label>
                  <input
                    type="text"
                    value={subIdValues[idx]}
                    onChange={(e) => updateSubId(idx, e.target.value)}
                    placeholder={`value${idx + 1}`}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
              ))}
            </div>

            {builtSubId && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 flex-shrink-0">Sub-ID Preview:</span>
                <code className="text-[11px] text-emerald-400 font-mono truncate">
                  {builtSubId}
                </code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!affiliateId.trim() || !urlInput.trim() || isGenerating}
        className={`w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-3 active:scale-[0.98] ${
          !affiliateId.trim() || !urlInput.trim()
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            : isGenerating
            ? 'bg-emerald-700/50 text-emerald-200 cursor-wait border border-emerald-600/30'
            : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/40 hover:shadow-emerald-900/60 hover:brightness-110 border border-emerald-500/30'
        }`}
      >
        {isGenerating ? (
          <>
            <div className="w-5 h-5 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
            <span>Đang tạo link...</span>
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            <span>TẠO LINK AFFILIATE</span>
          </>
        )}
      </button>

      {/* Results */}
      {hasResults && (
        <div ref={resultsRef} className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">Kết quả</h2>
              {successCount > 0 && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                  {successCount} thành công
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400">
                  {errorCount} lỗi
                </span>
              )}
            </div>
            {successCount > 1 && (
              <button
                onClick={handleCopyAll}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                {copiedId === 'all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'all' ? 'Đã copy!' : 'Copy tất cả'}
              </button>
            )}
          </div>

          {/* Result Cards */}
          <div className="space-y-2.5">
            {results.map((result, idx) => {
              const itemId = `result-${idx}`;
              const parsed = parseShopeeUrl(result.originalUrl);

              return (
                <div
                  key={idx}
                  className={`rounded-xl p-4 border transition-all ${
                    result.success
                      ? 'bg-slate-900/70 border-slate-800 hover:border-emerald-500/30'
                      : 'bg-rose-950/20 border-rose-500/20'
                  }`}
                >
                  {result.success ? (
                    <div className="space-y-2.5">
                      {/* Original URL */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {typeIcon(parsed.type)}
                        <span className="truncate">{parsed.displayName}</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-emerald-400 font-medium">Affiliate Link</span>
                      </div>

                      {/* Affiliate URL */}
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs text-emerald-300 bg-slate-950/60 rounded-lg px-3 py-2.5 font-mono truncate border border-slate-800">
                          {result.affiliateUrl}
                        </code>
                        <button
                          onClick={() => handleCopy(result.affiliateUrl!, itemId)}
                          className="p-2.5 rounded-lg bg-emerald-600/15 text-emerald-300 hover:bg-emerald-600/30 transition-all active:scale-90 flex-shrink-0"
                          title="Copy link"
                        >
                          {copiedId === itemId ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <a
                          href={result.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-lg bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all active:scale-90 flex-shrink-0"
                          title="Mở link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="text-xs text-rose-300 font-medium">{result.error}</p>
                        <p className="text-[11px] text-slate-500 truncate">{result.originalUrl}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300">Lịch sử tạo link ({history.length})</h2>
            <button
              onClick={handleClearHistory}
              className="text-[11px] text-slate-500 hover:text-rose-400 active:text-rose-400 transition-colors flex items-center gap-1.5 px-2 py-1.5 -mr-2 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa lịch sử
            </button>
          </div>

          <div className="space-y-1.5">
            {history.slice(0, 15).map((item) => (
              <div
                key={item.id}
                className="rounded-xl p-3 bg-slate-900/40 border border-slate-800/60 flex items-center gap-3 hover:border-slate-700 transition-colors group"
              >
                <div className="p-1.5 rounded-lg bg-slate-800/60 text-slate-500">
                  {typeIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 font-medium truncate">{item.displayName}</p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{item.affiliateUrl}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleCopy(item.affiliateUrl, item.id)}
                    className="p-2 rounded-lg bg-slate-800/40 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all active:scale-90"
                    title="Copy"
                  >
                    {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={item.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-800/40 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                    title="Mở"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <span className="text-[9px] text-slate-600 flex-shrink-0 hidden sm:block">
                  {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>

          {history.length > 15 && (
            <p className="text-center text-[11px] text-slate-500">
              +{history.length - 15} link khác (lưu trong trình duyệt)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
