import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Languages, Hash, Plus } from 'lucide-react';
import { Page } from '../types';

interface AddPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (page: Page, index: number) => void;
  maxPageNumber: number;
}

export default function AddPageModal({ isOpen, onClose, onAdd, maxPageNumber }: AddPageModalProps) {
  const [turkishText, setTurkishText] = useState('');
  const [arabicText, setArabicText] = useState('');
  const [pageNumberStr, setPageNumberStr] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTurkishText('');
      setArabicText('');
      setPageNumberStr((maxPageNumber + 1).toString());
    }
  }, [isOpen, maxPageNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turkishText.trim() && !arabicText.trim()) return;

    let targetNum = parseInt(pageNumberStr, 10);
    if (isNaN(targetNum) || targetNum < 1) {
      targetNum = maxPageNumber + 1;
    }

    // If entered number is greater than max + 1, make it max + 1
    if (targetNum > maxPageNumber + 1) {
      targetNum = maxPageNumber + 1;
    }

    const newPage: Page = {
      page: targetNum,
    };

    if (turkishText.trim()) {
      newPage.turkish = turkishText.trim();
    }
    
    if (arabicText.trim()) {
      newPage.arabic = arabicText.trim();
    }

    onAdd(newPage, targetNum - 1);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-[#FAF8F5] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-[#D9D1C2]/60 bg-white/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#8B7E66]/10 flex items-center justify-center text-[#8B7E66]">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Yeni Sayfa Ekle</h3>
                  <p className="text-xs text-slate-500 font-medium">Kitaba manuel olarak sayfa ekleyin</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 md:p-6 overflow-y-auto flex-1">
              <form id="add-page-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 ml-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    Sayfa Numarası
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={pageNumberStr}
                    onChange={(e) => setPageNumberStr(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-[#D9D1C2] rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:border-[#8B7E66] focus:ring-2 focus:ring-[#8B7E66]/20 transition-all shadow-xs"
                    placeholder="Örn: 1"
                  />
                  <p className="text-[10px] text-slate-500 ml-1">Mevcut sayfa sayısından büyük girilirse en sona eklenir.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 ml-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Türkçe Metin
                  </label>
                  <textarea
                    value={turkishText}
                    onChange={(e) => setTurkishText(e.target.value)}
                    className="w-full h-32 px-4 py-3 bg-white border border-[#D9D1C2] rounded-xl text-sm text-slate-800 focus:outline-hidden focus:border-[#8B7E66] focus:ring-2 focus:ring-[#8B7E66]/20 transition-all shadow-xs resize-none"
                    placeholder="Bu sayfanın Türkçe metnini buraya girin..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 ml-1">
                    <Languages className="w-3.5 h-3.5 text-slate-400" />
                    Arapça Metin (İsteğe Bağlı)
                  </label>
                  <textarea
                    value={arabicText}
                    onChange={(e) => setArabicText(e.target.value)}
                    className="w-full h-32 px-4 py-3 bg-white border border-[#D9D1C2] rounded-xl text-lg font-arabic text-right text-slate-800 focus:outline-hidden focus:border-[#8B7E66] focus:ring-2 focus:ring-[#8B7E66]/20 transition-all shadow-xs resize-none"
                    placeholder="اكتب النص العربي هنا..."
                    dir="rtl"
                  />
                </div>
              </form>
            </div>

            <div className="p-5 md:p-6 border-t border-[#D9D1C2]/60 bg-white/50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-[#D9D1C2] hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                form="add-page-form"
                disabled={!turkishText.trim() && !arabicText.trim()}
                className="px-5 py-2.5 text-sm font-bold text-white bg-[#8B7E66] hover:bg-[#70644e] rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Sayfa Ekle
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
