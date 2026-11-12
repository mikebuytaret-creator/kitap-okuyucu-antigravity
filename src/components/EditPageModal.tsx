import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  FileText, 
  Languages, 
  Hash, 
  Check, 
  Trash2, 
  PlusCircle, 
  BookOpen, 
  AlertTriangle,
  Eye,
  CornerDownRight
} from 'lucide-react';
import { Page } from '../types';
import { ARABIC_SEPARATOR_REGEX, isArabicSeparator } from '../utils';

interface EditPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: Page | null;
  pageIndex: number;
  totalPages: number;
  separatorColor?: string;
  onSavePage: (pageIndex: number, updatedPage: Page) => void;
  onDeletePage: (pageIndex: number) => void;
  onInsertPage: (insertIndex: number, newPage: Page) => void;
  onReadPage?: (pageNum: string | number) => void;
}

export default function EditPageModal({
  isOpen,
  onClose,
  page,
  pageIndex,
  totalPages,
  separatorColor = '#d97706',
  onSavePage,
  onDeletePage,
  onInsertPage,
  onReadPage
}: EditPageModalProps) {
  const [pageNumberStr, setPageNumberStr] = useState('');
  const [turkishText, setTurkishText] = useState('');
  const [arabicText, setArabicText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [insertMode, setInsertMode] = useState<'before' | 'after' | null>(null);
  const [insertTurkish, setInsertTurkish] = useState('');
  const [insertArabic, setInsertArabic] = useState('');
  const [insertPageNum, setInsertPageNum] = useState('');

  useEffect(() => {
    if (page && isOpen) {
      setPageNumberStr(String(page.page));
      setTurkishText(page.turkish || '');
      setArabicText(page.arabic || '');
      setShowDeleteConfirm(false);
      setInsertMode(null);
    }
  }, [page, isOpen]);

  if (!isOpen || !page) return null;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!turkishText.trim() && !arabicText.trim()) {
      alert('Sayfada en az bir dilde metin (Türkçe veya Arapça) bulunmalıdır.');
      return;
    }

    const rawStr = pageNumberStr.trim();
    const asInt = parseInt(rawStr, 10);
    const parsedNum: string | number = (!isNaN(asInt) && String(asInt) === rawStr) ? asInt : rawStr;

    const updated: Page = {
      page: parsedNum || page.page,
      turkish: turkishText.trim() || undefined,
      arabic: arabicText.trim() || undefined
    };

    onSavePage(pageIndex, updated);
    onClose();
  };

  const handleConfirmDelete = () => {
    onDeletePage(pageIndex);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleOpenInsert = (mode: 'before' | 'after') => {
    setInsertMode(mode);
    setInsertTurkish('');
    setInsertArabic('');
    const baseNum = typeof page.page === 'number' ? page.page : parseInt(String(page.page), 10);
    if (!isNaN(baseNum)) {
      setInsertPageNum(mode === 'before' ? String(baseNum) : String(baseNum + 1));
    } else {
      setInsertPageNum(`${page.page}_${mode}`);
    }
  };

  const handleConfirmInsert = () => {
    if (!insertTurkish.trim() && !insertArabic.trim()) {
      alert('Lütfen eklenecek sayfa için metin giriniz.');
      return;
    }

    const rawStr = insertPageNum.trim();
    const asInt = parseInt(rawStr, 10);
    const parsedNum: string | number = (!isNaN(asInt) && String(asInt) === rawStr) ? asInt : rawStr;

    const newPage: Page = {
      page: parsedNum || (insertMode === 'before' ? pageIndex + 1 : pageIndex + 2),
      turkish: insertTurkish.trim() || undefined,
      arabic: insertArabic.trim() || undefined
    };

    const targetIndex = insertMode === 'before' ? pageIndex : pageIndex + 1;
    onInsertPage(targetIndex, newPage);
    setInsertMode(null);
    onClose();
  };

  // Preview helper for Arabic separator highlights
  const renderArabicPreview = (text: string) => {
    if (!text.trim()) return null;
    const parts = text.split(ARABIC_SEPARATOR_REGEX);
    return (
      <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl font-arabic text-lg leading-relaxed text-right dir-rtl select-text max-h-36 overflow-y-auto">
        {parts.map((part, idx) => {
          if (!part) return null;
          if (isArabicSeparator(part)) {
            return (
              <span
                key={idx}
                className="inline-block mx-1 font-bold select-none cursor-default"
                style={{ color: separatorColor }}
              >
                {part}
              </span>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-2xl bg-[#FAF8F5] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-[#D9D1C2]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#D9D1C2]/60 bg-white/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#8B7E66]/15 flex items-center justify-center text-[#8B7E66] shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2 truncate">
                  <span>Sayfa Düzenle</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[#8B7E66]/10 text-[#8B7E66] font-mono font-semibold">
                    {pageIndex + 1} / {totalPages}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Metinleri düzenleyin, araya yeni sayfa ekleyin veya silin</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer shrink-0"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            
            {/* If currently inserting a new page */}
            {insertMode ? (
              <div className="space-y-4 bg-white/70 p-4 rounded-2xl border border-[#8B7E66]/30">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-[#8B7E66]" />
                    <span className="text-xs font-bold text-slate-800">
                      {insertMode === 'before' ? `Sayfa ${page.page} Öncesine Ekle` : `Sayfa ${page.page} Sonrasına Ekle`}
                    </span>
                  </div>
                  <button
                    onClick={() => setInsertMode(null)}
                    className="text-xs text-stone-500 hover:text-stone-800 font-semibold cursor-pointer"
                  >
                    Vazgeç
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400" /> Yeni Sayfa Numarası
                  </label>
                  <input
                    type="text"
                    value={insertPageNum}
                    onChange={(e) => setInsertPageNum(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D9D1C2] rounded-xl text-xs font-bold focus:outline-hidden focus:border-[#8B7E66]"
                    placeholder="Örn: 5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Türkçe Metin</label>
                  <textarea
                    value={insertTurkish}
                    onChange={(e) => setInsertTurkish(e.target.value)}
                    className="w-full h-24 p-3 bg-white border border-[#D9D1C2] rounded-xl text-xs focus:outline-hidden focus:border-[#8B7E66] resize-none"
                    placeholder="Eklenecek sayfanın Türkçe metni..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Arapça Metin (İsteğe Bağlı)</label>
                  <textarea
                    value={insertArabic}
                    onChange={(e) => setInsertArabic(e.target.value)}
                    dir="rtl"
                    className="w-full h-24 p-3 bg-white border border-[#D9D1C2] rounded-xl text-sm font-arabic text-right focus:outline-hidden focus:border-[#8B7E66] resize-none"
                    placeholder="النص العربي..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setInsertMode(null)}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-stone-100 rounded-xl hover:bg-stone-200 cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleConfirmInsert}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-[#8B7E66] hover:bg-[#746852] rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Araya Sayfayı Ekle
                  </button>
                </div>
              </div>
            ) : (
              /* Regular edit form */
              <form id="edit-page-form" onSubmit={handleSave} className="space-y-4">
                
                {/* Sayfa Numarası */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-[#8B7E66]" />
                    Sayfa Numarası / Tanımlayıcı
                  </label>
                  <input
                    type="text"
                    value={pageNumberStr}
                    onChange={(e) => setPageNumberStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9D1C2] rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-[#8B7E66] focus:ring-1 focus:ring-[#8B7E66]/20 transition-all shadow-xs"
                    placeholder="Örn: 1 veya Sayfa 1"
                  />
                </div>

                {/* Türkçe Metin */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#8B7E66]" />
                      Türkçe Metin
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {turkishText.length} karakter
                    </span>
                  </div>
                  <textarea
                    value={turkishText}
                    onChange={(e) => setTurkishText(e.target.value)}
                    rows={5}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9D1C2] rounded-xl text-xs leading-relaxed text-slate-800 focus:outline-hidden focus:border-[#8B7E66] focus:ring-1 focus:ring-[#8B7E66]/20 transition-all shadow-xs resize-y"
                    placeholder="Bu sayfanın Türkçe metnini buraya girin veya düzenleyin..."
                  />
                </div>

                {/* Arapça Metin */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-[#8B7E66]" />
                      Arapça Metin
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {arabicText.length} karakter
                    </span>
                  </div>
                  <textarea
                    value={arabicText}
                    onChange={(e) => setArabicText(e.target.value)}
                    dir="rtl"
                    rows={4}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9D1C2] rounded-xl text-base font-arabic text-right leading-loose text-slate-800 focus:outline-hidden focus:border-[#8B7E66] focus:ring-1 focus:ring-[#8B7E66]/20 transition-all shadow-xs resize-y"
                    placeholder="اكتب أو عدّل النص العربي هنا..."
                  />
                </div>

                {/* Canlı Ayraç Önizleme (eğer Arapça metin varsa) */}
                {arabicText.trim() && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-[#8B7E66]" /> Arapça Ayraç Renk Önizlemesi
                      </span>
                      <span className="text-[10px] font-mono text-stone-500">
                        Ayraç Rengi: <span className="font-bold" style={{ color: separatorColor }}>{separatorColor}</span>
                      </span>
                    </div>
                    {renderArabicPreview(arabicText)}
                  </div>
                )}

                {/* Araya Sayfa Ekleme Seçenekleri */}
                <div className="pt-2 border-t border-[#D9D1C2]/60">
                  <div className="text-[11px] font-bold text-slate-600 mb-2">Araya Yeni Sayfa Ekle:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenInsert('before')}
                      className="px-3 py-2 bg-white hover:bg-stone-100 border border-[#D9D1C2] rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-[#8B7E66]" /> Bu Sayfadan Önce
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenInsert('after')}
                      className="px-3 py-2 bg-white hover:bg-stone-100 border border-[#D9D1C2] rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-[#8B7E66]" /> Bu Sayfadan Sonra
                    </button>
                  </div>
                </div>

              </form>
            )}

            {/* Delete Confirmation Box */}
            {showDeleteConfirm && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Sayfa {page.page} Silinsin mi?
                </div>
                <p className="text-[11px] text-rose-700 leading-normal">
                  Bu sayfa kitaptan kalıcı olarak çıkarılacaktır. Diğer sayfalarınız etkilenmez.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-rose-200 rounded-xl hover:bg-rose-100/50 cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Evet, Sayfayı Sil
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footer Controls */}
          <div className="p-4 sm:p-5 border-t border-[#D9D1C2]/60 bg-white/60 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              {!showDeleteConfirm && !insertMode && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold border border-rose-200"
                  title="Bu Sayfayı Sil"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Sil</span>
                </button>
              )}
              {onReadPage && !insertMode && (
                <button
                  type="button"
                  onClick={() => {
                    onReadPage(page.page);
                    onClose();
                  }}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-stone-200"
                  title="Bu Sayfayı Oku"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#8B7E66]" />
                  <span className="hidden sm:inline">Sayfayı Oku</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-[#D9D1C2] hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              {!insertMode && (
                <button
                  type="submit"
                  form="edit-page-form"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#8B7E66] hover:bg-[#746852] rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Değişiklikleri Kaydet
                </button>
              )}
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
