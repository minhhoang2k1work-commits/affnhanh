'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Package, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Product {
  id: string;
  name: string;
  image: string;
  salePrice: number;
  shop?: { name: string };
}

interface ProductPickerProps {
  isOpen: boolean;
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export function ProductPicker({ isOpen, onSelect, onClose }: ProductPickerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen, query]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?q=${encodeURIComponent(query)}&limit=12`);
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-400" />
            Chọn Sản Phẩm Từ Thư Viện
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-900/30">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm sản phẩm..."
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-purple-400">
               <span className="animate-pulse">Đang tải...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className={`relative p-3 rounded-2xl cursor-pointer transition-all border-2 ${
                    selectedProduct?.id === p.id 
                      ? 'border-purple-500 bg-slate-800/80 shadow-glow' 
                      : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  {selectedProduct?.id === p.id && (
                    <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="aspect-square rounded-xl bg-slate-800 overflow-hidden mb-3">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-xs font-bold text-white line-clamp-2 mb-1">{p.name}</h4>
                  <div className="text-emerald-400 font-bold text-sm mb-1">{formatCurrency(p.salePrice)}</div>
                  <div className="text-[10px] text-slate-500 truncate">{p.shop?.name || 'Shopee'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Hủy
          </button>
          <button 
            onClick={() => {
              if (selectedProduct) {
                onSelect(selectedProduct);
                onClose();
              }
            }}
            disabled={!selectedProduct}
            className="px-6 py-2.5 rounded-xl text-sm font-bold gradient-brand text-white shadow-glow disabled:opacity-50"
          >
            Chọn Sản Phẩm
          </button>
        </div>
      </motion.div>
    </div>
  );
}
