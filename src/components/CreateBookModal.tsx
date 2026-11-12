/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, PlusCircle, Check, Trash2, Upload, FileText } from 'lucide-react';
import { Book } from '../types';
import { compressCoverImage } from '../utils';

interface CreateBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, coverImageUrl?: string, content?: string) => void;
}

export default function CreateBookModal({ isOpen, onClose, onCreate }: CreateBookModalProps) {
  const [title, setTitle] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [content, setContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Lütfen sadece resim dosyası seçiniz.');
      return;
    }
    try {
      const compressedUrl = await compressCoverImage(file);
      setCoverImageUrl(compressedUrl);
    } catch (err) {
      console.error('Error compressing image, falling back', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCoverImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        setContent(result);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), coverImageUrl.trim() || undefined, content.trim() || undefined);
    setTitle('');
    setCoverImageUrl('');
    setContent('');
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
    >
      <motion.div 
        id="create-book-modal-card"
        initial={{ scale: 0.95, y: 10, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 10, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-full max-w-xl glass-panel-deep rounded-2xl shadow-2xl overflow-hidden border border-[#D9D1C2] flex flex-col text-[#2D2D2A] max-h-[90vh]"
      >
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9D1C2] bg-white/40 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#8B7E66]/20 text-[#8B7E66] rounded-lg border border-[#D9D1C2]">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Yeni Kitap Oluştur</h3>
                <p className="text-xs text-slate-500">Kitaplığınıza eklemek için bir isim verin ve isterseniz içerik yükleyin</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-500 hover:text-slate-700 hover:bg-white/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-1.5">
              <label htmlFor="new-book-title-field" className="text-xs font-bold text-[#8B7E66] uppercase tracking-widest">
                Kitap İsmi (Başlık)
              </label>
              <input
                id="new-book-title-field"
                type="text"
                autoFocus
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: El-Fatiha Suresi Meali, Masallar vb."
                className="w-full p-3 border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B7E66] text-sm font-medium text-slate-800 bg-[#F5F2EA]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8B7E66] uppercase tracking-widest block">
                  Kapak Resmi Yükle (İsteğe Bağlı)
                </label>
                
                {coverImageUrl ? (
                  <div className="relative group rounded-xl overflow-hidden border border-[#D9D1C2] bg-stone-50 p-2 flex items-center gap-3">
                    <img 
                      src={coverImageUrl} 
                      alt="Önizleme" 
                      referrerPolicy="no-referrer"
                      className="w-12 h-16 object-cover rounded-lg shadow-xs" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">Kapak yüklendi</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl('')}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50/50 hover:text-rose-700 cursor-pointer shrink-0"
                      title="Resmi kaldır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processFile(file);
                    }}
                    className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all h-20 flex flex-col justify-center items-center ${
                      isDragging 
                        ? 'border-[#8B7E66] bg-[#8B7E66]/5' 
                        : 'border-[#D9D1C2] hover:border-[#8B7E66]/60 bg-white/70'
                    }`}
                    onClick={() => document.getElementById('cover-file-upload')?.click()}
                  >
                    <input
                      id="cover-file-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processFile(file);
                      }}
                    />
                    <Upload className="w-5 h-5 text-[#8B7E66] opacity-70 mb-1" />
                    <p className="text-[10px] font-bold text-slate-700">Tıklayın veya sürükleyin</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8B7E66] uppercase tracking-widest flex items-center justify-between">
                  Metin veya JSON Yükle (Dosya)
                </label>
                <div 
                  className="border-2 border-dashed border-[#D9D1C2] hover:border-[#8B7E66]/60 bg-white/70 rounded-xl p-3 text-center cursor-pointer transition-all h-20 flex flex-col justify-center items-center gap-1.5"
                  onClick={() => document.getElementById('json-file-upload-create')?.click()}
                >
                  <FileText className="w-5 h-5 text-[#8B7E66] opacity-70" />
                  <p className="text-[10px] font-bold text-slate-700 w-full px-2 leading-tight">İçerik dosyası seç (.json, .txt)</p>
                  <input
                    id="json-file-upload-create"
                    type="file"
                    accept=".json,.txt,text/plain,application/json"
                    className="hidden"
                    onChange={handleJsonFileUpload}
                  />
                  {content && (
                    <p className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full mt-1 border border-emerald-200">
                      Metin/JSON belleğe alındı
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col">
              <label htmlFor="content-textfield" className="text-xs font-bold text-[#8B7E66] uppercase tracking-widest">
                Veya Metin / Json Kopyala Yapıştır (İsteğe Bağlı)
              </label>
              <textarea
                id="content-textfield"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Düz metin veya JSON (örneğin kopyaladığınız bir arapça ve/veya okunuşu) buraya yapıştırabilirsiniz. Boş bırakırsanız sadece boş bir kitap oluşur."
                className="w-full p-3 border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B7E66] text-xs font-mono text-slate-700 bg-white min-h-[80px] resize-y shadow-inner"
              />
              <p className="text-[10px] text-slate-400 mt-1">Eğer içeriği şimdi girmek istemiyorsanız boş bırakabilirsiniz, daha sonra kitabın içinden de eklenebilir.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#D9D1C2] bg-white/40 shrink-0 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#8B7E66] hover:text-[#70644e] cursor-pointer"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2.5 text-xs font-extrabold text-white bg-[#8B7E66] hover:bg-[#70644e] active:bg-[#594f3d] rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center gap-1"
            >
              <Check className="w-4 h-4" /> Kitabı Oluştur
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

