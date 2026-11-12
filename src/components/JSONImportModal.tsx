/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { X, Upload, ClipboardCheck, AlertCircle, Sparkles } from 'lucide-react';
import { parseAndNormalizeBookPages } from '../utils';
import { Page } from '../types';

interface JSONImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (pages: Page[], detected: ('turkish' | 'arabic')[]) => void;
}

export default function JSONImportModal({ isOpen, onClose, onImport }: JSONImportModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessImport = () => {
    if (!jsonText.trim()) {
      setErrorMessage('Lütfen JSON metnini girin veya bir dosya yükleyin.');
      return;
    }

    try {
      const { pages, detected } = parseAndNormalizeBookPages(jsonText);
      if (pages.length === 0) {
        setErrorMessage('Girilen JSON geçerli fakat okunabilir herhangi bir sayfa içeriği (Türkçe veya Arapça) bulunamadı.');
        return;
      }
      onImport(pages, detected);
      setJsonText('');
      setErrorMessage('');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'JSON ayrıştırma hatası. Formatı kontrol edin.');
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setJsonText(text);
        setErrorMessage('');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
      <div 
        id="import-modal-card"
        className="relative w-full max-w-2xl glass-panel-deep rounded-2xl shadow-2xl overflow-hidden border border-[#D9D1C2] flex flex-col max-h-[90vh] text-[#2D2D2A]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9D1C2] bg-white/40">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#8B7E66]/20 text-[#8B7E66] rounded-lg border border-[#D9D1C2]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">JSON İçe Aktar</h3>
              <p className="text-xs text-slate-500">Kitap sayfalarını hızlıca uygulamaya yükleyin</p>
            </div>
          </div>
          <button 
            id="close-import-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-550 hover:text-slate-750 hover:bg-white/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Standalone Clickable File Drag & Drop / Selector Button Area (First Section) */}
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {!jsonText ? (
              <button
                type="button"
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full text-center relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col justify-center items-center cursor-pointer ${
                  dragActive 
                    ? 'border-[#8B7E66] bg-[#8B7E66]/10 scale-[0.99]' 
                    : 'border-[#D9D1C2] hover:border-[#8B7E66] bg-[#8B7E66]/5 hover:bg-[#8B7E66]/10'
                }`}
              >
                <div className="py-6 select-none pointer-events-none w-full">
                  <div className="w-16 h-16 bg-[#8B7E66]/15 text-[#8B7E66] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#8B7E66]/25 shadow-xs">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-base font-extrabold text-stone-800">
                    JSON dosyasını buraya sürükleyin ve yükleyin
                  </p>
                  <p className="text-xs text-stone-500 mt-2 font-semibold">
                    veya tıklayarak cihazınızdan dosya seçin (.json)
                  </p>
                </div>
              </button>
            ) : (
              <div className="border border-[#D9D1C2] bg-white rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs text-stone-550 font-bold border-b border-stone-100 pb-2.5 select-none">
                  <span className="flex items-center gap-1.5 text-emerald-750">
                    <ClipboardCheck className="w-4.5 h-4.5 text-emerald-600" />
                    Dosya Yüklendi! İçerik Hazır
                  </span>
                  <button 
                    type="button"
                    onClick={() => setJsonText('')}
                    className="text-[#8B7E66] underline hover:text-[#70644e] cursor-pointer font-extrabold transition-all text-[11px]"
                  >
                    Başka Dosya Yükle / Temizle
                  </button>
                </div>

                <textarea
                  id="json-textarea-input"
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full h-40 font-mono text-xs p-3 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#8B7E66] resize-none bg-[#F5F2EA] font-medium"
                  placeholder="JSON içeriği..."
                />
              </div>
            )}
          </div>

          {/* Informational Code Snippets (Non-Interactive / Non-Clickable) */}
          <div className="bg-[#8B7E66]/5 p-5 rounded-2xl border border-[#D9D1C2]/65 space-y-4">
            <div className="flex items-center gap-2 select-none">
              <Sparkles className="w-4.2 h-4.2 text-[#FF8A65]" />
              <span className="text-xs font-extrabold text-[#8B7E66] uppercase tracking-widest">
                Bilgi: Kabul Edilen JSON Formatı
              </span>
            </div>
            
            <p className="text-xs text-stone-600 leading-relaxed font-sans select-none">
              Dilediğiniz dilde sayfa hazırlayabilirsiniz. Sistem sayfa yapılarını tam otomatik olarak analiz eder ve algılar. Örnek yapılar şu şekildedir:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 text-left">
              <div className="bg-white/70 p-3 rounded-xl border border-[#D9D1C2]/50">
                <span className="text-[9px] font-extrabold text-[#8a7f66] bg-[#8B7E66]/10 px-1.5 py-0.5 rounded uppercase tracking-wider block w-fit mb-2 select-none">
                  1. Çift Dilli (TR + AR)
                </span>
                <pre className="text-[10px] font-mono text-stone-600 leading-tight block bg-stone-100 p-2 rounded-md select-all overflow-x-auto">
{`[
  {
    "page": 1,
    "arabic": "بِسْمِ اللَّهِ...",
    "turkish": "Rahman..."
  }
]`}
                </pre>
              </div>

              <div className="bg-white/70 p-3 rounded-xl border border-[#D9D1C2]/50">
                <span className="text-[9px] font-extrabold text-[#8a7f66] bg-[#8B7E66]/10 px-1.5 py-0.5 rounded uppercase tracking-wider block w-fit mb-2 select-none">
                  2. Sadece Türkçe
                </span>
                <pre className="text-[10px] font-mono text-stone-600 leading-tight block bg-stone-100 p-2 rounded-md select-all overflow-x-auto">
{`[
  {
    "page": 1,
    "turkish": "Evvel zaman..."
  }
]`}
                </pre>
              </div>

              <div className="bg-white/70 p-3 rounded-xl border border-[#D9D1C2]/50">
                <span className="text-[9px] font-extrabold text-[#8a7f66] bg-[#8B7E66]/10 px-1.5 py-0.5 rounded uppercase tracking-wider block w-fit mb-2 select-none">
                  3. Sadece Arapça
                </span>
                <pre className="text-[10px] font-mono text-stone-600 leading-tight block bg-stone-100 p-2 rounded-md select-all overflow-x-auto">
{`[
  {
    "page": 1,
    "arabic": "كَانَ يَامَا..."
  }
]`}
                </pre>
              </div>
            </div>

            <div className="text-[10px] text-stone-500 italic bg-stone-200/20 p-2.5 rounded-lg border border-stone-200/40 leading-snug select-none">
              📌 Sayfa sıralaması için objelere <code className="bg-white px-1 border border-[#D9D1C2] rounded font-mono font-bold text-[9px]">"page"</code> alanını eklemeniz yeterlidir.
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <span className="font-bold">{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#D9D1C2] bg-white/40 flex items-center justify-end gap-3">
          <button
            id="cancel-import-btn"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#8B7E66] hover:text-[#70644e] cursor-pointer"
          >
            İptal
          </button>
          <button
            id="confirm-import-btn"
            onClick={handleProcessImport}
            className="px-5 py-2.5 text-xs font-extrabold text-white bg-[#8B7E66] hover:bg-[#70644e] active:bg-[#594f3d] rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-1.5"
          >
            İçeriği Aktar
          </button>
        </div>
      </div>
    </div>
  );
}
