/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Bookmark, 
  Trash2, 
  Edit3, 
  Upload, 
  Play, 
  Compass, 
  BookOpen, 
  Sparkles, 
  Check, 
  HelpCircle,
  FileCode2,
  Grid,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  ArrowDownUp,
  Plus,
  Settings,
  FileEdit,
  ListOrdered,
  RotateCcw
} from 'lucide-react';
import { Book, Page, Deck } from '../types';
import JSONImportModal from './JSONImportModal';
import AddPageModal from './AddPageModal';
import EditPageModal from './EditPageModal';
import BookSettingsModal from './BookSettingsModal';
import { getRandomCoverGradient, normalizeText, compressCoverImage } from '../utils';

interface BookDashboardProps {
  book: Book;
  decks: Deck[];
  onBack: () => void;
  onStartReading: (pageNum: string | number) => void;
  onUpdateBook: (updatedBook: Book) => void;
  onDeleteBook: (id: string) => void;
}

export default function BookDashboard({ 
  book, 
  decks,
  onBack, 
  onStartReading, 
  onUpdateBook, 
  onDeleteBook 
}: BookDashboardProps) {
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(book.title);
  const [editedCoverUrl, setEditedCoverUrl] = useState(book.coverImageUrl || '');
  const [isEditCoverDragging, setIsEditCoverDragging] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPageEditMode, setIsPageEditMode] = useState(false);
  const [editingPageData, setEditingPageData] = useState<{ page: Page; index: number } | null>(null);

  const [isNotesDropdownOpen, setIsNotesDropdownOpen] = useState(false);
  const [expandedDashboardNotes, setExpandedDashboardNotes] = useState<string[]>([]);
  const [notesSearchQuery, setNotesSearchQuery] = useState('');
  const [notesSortOrder, setNotesSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  const [noteActionMenu, setNoteActionMenu] = useState<{id: string, title: string, content: string, createdAt: number} | null>(null);
  const [editingNote, setEditingNote] = useState<{id: string, title: string, content: string} | null>(null);

  const handleSaveEditedNote = () => {
    if (!editingNote || !editingNote.title.trim()) return;
    onUpdateBook({
      ...book,
      notes: book.notes?.map(n => n.id === editingNote.id ? { ...n, title: editingNote.title, content: editingNote.content } : n)
    });
    setEditingNote(null);
  };

  // Sync state with book props when book details change
  React.useEffect(() => {
    setEditedTitle(book.title);
    setEditedCoverUrl(book.coverImageUrl || '');
  }, [book.id, book.title, book.coverImageUrl]);
  const [isDashboardDropdownOpen, setIsDashboardDropdownOpen] = useState(false);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');

  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const noteLongPressTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const noteLongPressTriggeredRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (noteLongPressTimeoutRef.current) {
        clearTimeout(noteLongPressTimeoutRef.current);
      }
    };
  }, []);

  const startNoteLongPress = (note: any) => {
    noteLongPressTriggeredRef.current = false;
    noteLongPressTimeoutRef.current = setTimeout(() => {
      setEditingNote(note);
      noteLongPressTriggeredRef.current = true;
    }, 500); // 500ms hold triggers the edit mode directly
  };

  const cancelNoteLongPress = () => {
    if (noteLongPressTimeoutRef.current) {
      clearTimeout(noteLongPressTimeoutRef.current);
      noteLongPressTimeoutRef.current = null;
    }
  };

  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setIsEditingTitle(true);
    }, 600); // 600ms hold triggers the edit mode
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const hasPages = book.pages && book.pages.length > 0;
  
  // Format last read date
  const lastReadFormatted = new Date(book.lastReadAt || book.createdAt).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const processEditCoverFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Lütfen sadece resim dosyası seçiniz.');
      return;
    }
    try {
      const compressedUrl = await compressCoverImage(file);
      setEditedCoverUrl(compressedUrl);
    } catch (err) {
      console.error('Error compressing image, falling back', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setEditedCoverUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveTitle = () => {
    if (!editedTitle.trim()) return;
    onUpdateBook({
      ...book,
      title: editedTitle.trim(),
      coverImageUrl: editedCoverUrl.trim() || undefined
    });
    setIsEditingTitle(false);
  };

  const handleImportPages = (newPages: Page[], detected: ('turkish' | 'arabic')[]) => {
    onUpdateBook({
      ...book,
      pages: newPages,
      detectedLanguages: detected,
      // Reset bookmark if the page numbers changed and no longer exist
      bookmark: book.bookmark && newPages.some(p => String(p.page) === String(book.bookmark)) ? book.bookmark : null
    });
  };

  const handleAddPage = (newPage: Page, insertIndex: number) => {
    const updatedPages = [...book.pages];
    
    // Safety check for insert index
    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > updatedPages.length) insertIndex = updatedPages.length;

    updatedPages.splice(insertIndex, 0, newPage);

    // Re-evaluate languages
    const detected: Set<'turkish' | 'arabic'> = new Set(book.detectedLanguages);
    if (newPage.turkish) detected.add('turkish');
    if (newPage.arabic) detected.add('arabic');

    onUpdateBook({
      ...book,
      pages: updatedPages,
      detectedLanguages: Array.from(detected),
    });
  };

  const handleSavePage = (pageIndex: number, updatedPage: Page) => {
    const updatedPages = [...book.pages];
    updatedPages[pageIndex] = updatedPage;

    const detected = new Set<'turkish' | 'arabic'>();
    updatedPages.forEach(p => {
      if (p.turkish && p.turkish.trim()) detected.add('turkish');
      if (p.arabic && p.arabic.trim()) detected.add('arabic');
    });

    onUpdateBook({
      ...book,
      pages: updatedPages,
      detectedLanguages: Array.from(detected)
    });
  };

  const handleDeletePage = (pageIndex: number) => {
    const updatedPages = book.pages.filter((_, idx) => idx !== pageIndex);

    const detected = new Set<'turkish' | 'arabic'>();
    updatedPages.forEach(p => {
      if (p.turkish && p.turkish.trim()) detected.add('turkish');
      if (p.arabic && p.arabic.trim()) detected.add('arabic');
    });

    onUpdateBook({
      ...book,
      pages: updatedPages,
      detectedLanguages: Array.from(detected),
      bookmark: book.bookmark && !updatedPages.some(p => String(p.page) === String(book.bookmark)) ? null : book.bookmark
    });
  };

  const handleInsertPage = (insertIndex: number, newPage: Page) => {
    const updatedPages = [...book.pages];
    updatedPages.splice(insertIndex, 0, newPage);

    const detected = new Set<'turkish' | 'arabic'>(book.detectedLanguages);
    if (newPage.turkish && newPage.turkish.trim()) detected.add('turkish');
    if (newPage.arabic && newPage.arabic.trim()) detected.add('arabic');

    onUpdateBook({
      ...book,
      pages: updatedPages,
      detectedLanguages: Array.from(detected)
    });
  };

  const handleRenumberPagesSequentially = () => {
    if (!window.confirm("Tüm sayfalar 1'den başlayarak sırasıyla (1, 2, 3...) yeniden numaralandırılsın mı?")) {
      return;
    }
    const renumberedPages = book.pages.map((p, idx) => ({
      ...p,
      page: idx + 1
    }));
    
    onUpdateBook({
      ...book,
      pages: renumberedPages,
      bookmark: book.bookmark ? 1 : null
    });
  };

  const handleContinueFromBookmark = () => {
    if (book.bookmark !== null && book.bookmark !== undefined) {
      onStartReading(book.bookmark);
    } else if (hasPages) {
      // Fallback if no bookmark yet, start from first page
      onStartReading(book.pages[0].page);
    }
  };

  const coverGradient = getRandomCoverGradient(book.id);

  return (
    <div className="min-h-[100dvh] bg-[#F5F2EA] pb-16 animate-in fade-in duration-200 text-[#2D2D2A]">
      
      {/* Mini Header / Navigation - Sticky glass wrapper */}
      <div className="sticky top-0 z-30 w-full bg-[#F5F2EA]/85 backdrop-blur-md border-b border-[#D9D1C2]/50 shadow-xs">
        <nav className="max-w-3xl mx-auto px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between font-sans">
          <button
            id="dashboard-back-btn"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-[#8B7E66] hover:text-[#70644e] bg-white/85 shadow-xs border border-[#D9D1C2] px-3.5 py-2 rounded-xl cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Kitaplığa Dön
          </button>

          <div className="flex items-center gap-2">
            {/* Bu Kitabın Metin Ayarları */}
            <button
              id="dashboard-header-settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-[#8B7E66] hover:text-[#70644e] bg-white/75 backdrop-blur-xs shadow-xs hover:shadow-sm border border-[#D9D1C2] rounded-xl cursor-pointer transition-all"
              title="Bu Kitabın Metin & Görünüm Ayarları"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Upload icon button (Request #6) */}
            {hasPages && !book.createdWithContent && (
              <button
                id="dashboard-header-upload-btn"
                onClick={() => setIsImportOpen(true)}
                className="p-2 text-[#8B7E66] hover:text-[#70644e] bg-white/75 backdrop-blur-xs shadow-xs hover:shadow-sm border border-[#D9D1C2] rounded-xl cursor-pointer transition-all"
                title="Sayfaları Güncelle (JSON)"
              >
                <Upload className="w-4 h-4" />
              </button>
            )}

            {/* Delete icon */}
            <button
              id="dashboard-delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-rose-600 hover:text-rose-800 bg-white/70 backdrop-blur-xs shadow-xs hover:shadow-sm border border-[#D9D1C2] rounded-xl cursor-pointer transition-all"
              title="Kitabı Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </nav>
      </div>

      <main className="max-w-3xl mx-auto px-4 mt-4 space-y-6">
        
        {/* Book details / Title edit */}
        <div id="dashboard-hero-section" className="glass-panel rounded-2xl border border-[#D9D1C2] p-6 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6">
          
          {/* Abstract cover mockup */}
          <div className="w-26 h-36 rounded-xl shadow-md shrink-0 relative overflow-hidden flex flex-col justify-between">
            {book.coverImageUrl ? (
              <img 
                src={book.coverImageUrl} 
                alt={book.title} 
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <div className={`absolute inset-0 bg-gradient-to-br ${coverGradient} ${book.coverImageUrl ? 'bg-black/35 group-hover:bg-black/10 transition-colors' : ''} flex flex-col justify-between p-3 text-white z-10`}>
              <div className="absolute top-0 right-0 w-20 h-24 bg-white/5 rounded-full blur-xl -mr-8 -mt-8"></div>
              <div className="text-[8px] font-mono tracking-widest uppercase opacity-60">KITAP</div>
              <div className="font-semibold text-xs line-clamp-3 leading-tight tracking-wide">
                {book.title}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] opacity-75 font-mono">{hasPages ? `${book.pages.length} S.` : 'Boş'}</span>
                <BookOpen className="w-3.5 h-3.5 opacity-50" />
              </div>
            </div>
          </div>

          {/* Book metadata and actions */}
          <div className="flex-1 w-full text-center md:text-left space-y-3">
            
            <div className="space-y-1">
              {isEditingTitle ? (
                <div className="space-y-2.5 mt-1 text-left max-w-lg">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#8B7E66] uppercase tracking-wider">Kitap Adı</label>
                    <input
                      id="edit-book-title-input"
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="text-sm font-bold text-slate-800 border-2 border-[#8B7E66] rounded-xl px-3 py-2 w-full focus:outline-hidden bg-[#F5F2EA]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#8B7E66] uppercase tracking-wider">Kapak Resmi (Resim Yükle)</label>
                    {editedCoverUrl ? (
                      <div className="relative group rounded-xl overflow-hidden border border-[#D9D1C2] bg-stone-50 p-2 flex items-center gap-3">
                        <img 
                          src={editedCoverUrl} 
                          alt="Önizleme" 
                          referrerPolicy="no-referrer"
                          className="w-10 h-14 object-cover rounded-md shadow-xs" 
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-800 truncate">Kapak resmi yüklendi</p>
                          <p className="text-[9px] text-slate-400">Yeni kapak olarak kaydedilecek</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditedCoverUrl('')}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50/50 hover:text-rose-700 cursor-pointer"
                          title="Resmi kaldır"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsEditCoverDragging(true); }}
                        onDragLeave={() => setIsEditCoverDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsEditCoverDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) processEditCoverFile(file);
                        }}
                        className={`border border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                          isEditCoverDragging 
                            ? 'border-[#8B7E66] bg-[#8B7E66]/5' 
                            : 'border-[#D9D1C2] hover:border-[#8B7E66]/60 bg-white/70'
                        }`}
                        onClick={() => document.getElementById('edit-cover-file-upload')?.click()}
                      >
                        <input
                          id="edit-cover-file-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) processEditCoverFile(file);
                          }}
                        />
                        <div className="flex flex-col items-center gap-0.5">
                          <Upload className="w-4 h-4 text-[#8B7E66] opacity-70 mb-0.5" />
                          <p className="text-[10px] font-bold text-slate-700">Resim seçmek/sürüklemek için tıklayın</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2 pt-2.5 w-full">
                    <button
                      id="save-book-title-btn"
                      onClick={handleSaveTitle}
                      className="bg-[#8B7E66] text-white px-4 py-2 rounded-xl hover:bg-[#70644e] cursor-pointer transition-all text-xs font-bold flex items-center gap-1 shadow-xs"
                      title="Kaydet"
                    >
                      <Check className="w-3.5 h-3.5" /> Kaydet
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingTitle(false);
                        setEditedTitle(book.title);
                        setEditedCoverUrl(book.coverImageUrl || '');
                      }}
                      className="bg-[#D9D1C2] text-slate-700 px-4 py-2 rounded-xl hover:bg-[#cac0ad] cursor-pointer text-xs font-bold"
                      title="İptal"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : (
                <h1 
                  id="dashboard-book-title-display"
                  onDoubleClick={() => setIsEditingTitle(true)}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onTouchMove={handleTouchEnd}
                  className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center justify-center md:justify-start gap-2 flex-wrap cursor-pointer select-none"
                  title="Düzenlemek için çift tıklayın veya basılı tutun"
                >
                  {book.title}
                </h1>
              )}

              <p className="text-xs text-slate-500 font-medium select-none">Son Okunma Tarihi: {lastReadFormatted}</p>
            </div>

            {/* Deck Selector Container */}
            <div className="pt-2 pb-1 border-t border-[#D9D1C2]/40 flex flex-col items-center md:items-start gap-1">
              <label htmlFor="book-deck-select" className="text-[10px] font-bold text-[#8B7E66] uppercase tracking-wider">
                Bulunduğu Deste (Kategori)
              </label>
              <select
                id="book-deck-select"
                value={book.deckId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateBook({
                    ...book,
                    deckId: val ? val : undefined
                  });
                }}
                className="text-xs font-semibold px-2.5 py-1.5 border border-[#D9D1C2] hover:border-[#8B7E66] rounded-xl bg-[#F5F2EA] focus:outline-hidden focus:ring-1 focus:ring-[#8B7E66] cursor-pointer"
              >
                <option value="">-- Destesiz (Genel Liste) --</option>
                {decks && decks.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Explanatory subtitle for empty files */}
            {!hasPages && (
              <div className="bg-[#FF8A65]/10 border border-[#FF8A65]/30 p-3 rounded-xl text-xs text-amber-900 text-left">
                Bu kitapta henüz sayfa bulunmuyor. Kitaba başlamak için aşağıda yer alan <b className="font-bold">"JSON İçe Aktar"</b> düğmesine basıp sayfa verilerinizi ekleyin.
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Launch Controls: "Kaldığım Yer" & "JSON İçe Aktar" Buttons (Request #6) */}
        <div className="space-y-4">
          
          {/* KALDIĞIM YER (Bookmark jump button) */}
          <button
            id="kaldigim-yer-shortcut-btn"
            onClick={handleContinueFromBookmark}
            disabled={!hasPages}
            className={`p-6 rounded-2xl border transition-all text-left flex items-start gap-4 relative group cursor-pointer w-full ${
              !hasPages 
                ? 'bg-[#D9D1C2]/30 border-[#D9D1C2] opacity-50 cursor-not-allowed' 
                : book.bookmark !== null
                  ? 'bg-[#FF8A65]/10 border-[#FF8A65]/40 hover:border-[#FF8A65]/80 shadow-xs hover:bg-[#FF8A65]/15'
                  : 'bg-white/60 border-[#D9D1C2] hover:border-[#8B7E66] shadow-xs hover:bg-white/'
            }`}
          >
            <div className={`p-3 rounded-xl transition-transform group-hover:scale-105 ${
              book.bookmark !== null ? 'bg-[#FF8A65]/20 text-[#f55928]' : 'bg-[#8B7E66]/25 text-[#8B7E66]'
            }`}>
              <Bookmark className={`w-6 h-6 ${book.bookmark !== null ? 'fill-[#FF8A65]' : ''}`} />
            </div>

            <div className="space-y-1 font-sans">
              <h3 className="font-bold text-slate-800 text-sm">
                Kaldığım Yer
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {book.bookmark !== null 
                  ? `Sayfa ${book.bookmark} işaretli` 
                  : hasPages 
                    ? `1. Sayfadan (Başlangıç)` 
                    : 'Yüklü sayfa yok'}
              </p>
              <div className="text-[10px] font-semibold text-slate-500 mt-1 flex items-center gap-1 group-hover:text-[#8B7E66] transition-colors">
                Kitap okuma ekranını aç &rarr;
              </div>
            </div>
            
            {hasPages && (
              <span className="absolute top-4 right-4 p-1 bg-white rounded-full text-[#8B7E66] border border-[#D9D1C2] group-hover:bg-[#8B7E66] group-hover:text-white transition-all opacity-0 group-hover:opacity-100">
                <Play className="w-3.5 h-3.5 fill-current" />
              </span>
            )}
          </button>

          {/* JSON İÇE AKTAR (Only show centrally if book is completely empty) */}
          {!hasPages && (
            <button
              id="dashboard-import-pages-btn"
              onClick={() => setIsImportOpen(true)}
              className="p-6 rounded-2xl border bg-white/50 border-[#D9D1C2] hover:border-[#8B7E66] shadow-xs hover:bg-white/70 transition-all text-left flex items-start gap-4 relative group cursor-pointer w-full font-sans"
            >
              <div className="p-3 rounded-xl bg-white text-[#8B7E66] group-hover:bg-[#8B7E66]/20 transition-colors border border-[#D9D1C2]">
                <Upload className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm">
                  Sayfaları Yükle (JSON)
                </h3>
                <p className="text-xs text-slate-500">
                  JSON metnini yapıştırın veya dosya seçin
                </p>
                <div className="text-[10px] font-bold text-[#8B7E66] mt-1 flex items-center gap-1">
                  İçe aktarma aracını aç &rarr;
                </div>
              </div>
            </button>
          )}

          {/* MANUEL SAYFA EKLE */}
          <button
            onClick={() => setIsAddPageModalOpen(true)}
            className="p-6 rounded-2xl border bg-white/50 border-[#D9D1C2] hover:border-[#8B7E66] shadow-xs hover:bg-white/70 transition-all text-left flex items-start gap-4 relative group cursor-pointer w-full font-sans"
          >
            <div className="p-3 rounded-xl bg-white text-[#8B7E66] group-hover:bg-[#8B7E66]/20 transition-colors border border-[#D9D1C2]">
              <Plus className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-sm">
                Sayfa Ekle
              </h3>
              <p className="text-xs text-slate-500">
                Manuel olarak yeni bir sayfa (Türkçe/Arapça) ekleyin
              </p>
              <div className="text-[10px] font-bold text-[#8B7E66] mt-1 flex items-center gap-1">
                Sayfa oluşturma formunu aç &rarr;
              </div>
            </div>
          </button>

        </div>

        {/* NOTES SECTION */}
        {(book.notes && book.notes.length > 0) && (
          <div className="glass-panel rounded-2xl border border-[#D9D1C2] p-6 shadow-sm space-y-4">
            <div 
              onClick={() => setIsNotesDropdownOpen(!isNotesDropdownOpen)}
              className="flex items-center justify-between pb-3 border-b border-[#D9D1C2] cursor-pointer hover:opacity-85 select-none"
            >
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#8B7E66]" /> 
                <h3 className="font-bold text-slate-800 text-sm">
                  Notlarım
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-white text-[#8B7E66] px-2.5 py-1 rounded-lg border border-[#D9D1C2]">
                  {book.notes.length} Not
                </span>
                {book.notes.length > 2 && (
                  isNotesDropdownOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#8B7E66] stroke-[2.5]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8B7E66] stroke-[2.5]" />
                  )
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              {isNotesDropdownOpen && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Notlarda ara..."
                      value={notesSearchQuery}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setNotesSearchQuery(e.target.value)}
                      className="w-full text-xs font-medium pl-8 pr-8 py-1.5 border border-[#D9D1C2] rounded-lg focus:outline-hidden focus:border-[#8B7E66] bg-white/50"
                    />
                    {notesSearchQuery && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setNotesSearchQuery(''); }}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotesSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/50 border border-[#D9D1C2] rounded-lg text-xs font-medium text-slate-600 hover:bg-white transition-colors cursor-pointer"
                  >
                    <ArrowDownUp className="w-3.5 h-3.5" />
                    {notesSortOrder === 'newest' ? 'Yeni' : 'Eski'}
                  </button>
                </div>
              )}
              {(() => {
                let filteredNotes = book.notes || [];
                
                // Search filter
                if (notesSearchQuery.trim()) {
                  const q = notesSearchQuery.trim().toLowerCase();
                  filteredNotes = filteredNotes.filter(n => 
                    n.title.toLowerCase().includes(q) || 
                    (n.content && n.content.toLowerCase().includes(q))
                  );
                }
                
                // Sort
                filteredNotes = [...filteredNotes].sort((a, b) => {
                  if (notesSortOrder === 'newest') return b.createdAt - a.createdAt;
                  return a.createdAt - b.createdAt;
                });
                
                // Truncate if not expanded
                const displayNotes = isNotesDropdownOpen ? filteredNotes : filteredNotes.slice(0, 2);
                
                if (displayNotes.length === 0 && notesSearchQuery) {
                  return <div className="text-center py-4 text-xs text-stone-500 italic">Not bulunamadı.</div>;
                }
                
                return displayNotes.map(note => {
                  const isExpanded = expandedDashboardNotes.includes(note.id);
                  return (
                    <div 
                      key={note.id} 
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingNote(note);
                      }}
                      onMouseDown={() => startNoteLongPress(note)}
                      onTouchStart={() => startNoteLongPress(note)}
                      onMouseUp={cancelNoteLongPress}
                      onTouchEnd={cancelNoteLongPress}
                      onMouseLeave={cancelNoteLongPress}
                      onTouchMove={cancelNoteLongPress}
                      onClick={(e) => {
                        if (noteLongPressTriggeredRef.current) {
                          e.preventDefault();
                          e.stopPropagation();
                          noteLongPressTriggeredRef.current = false;
                          return;
                        }
                        if (isExpanded) {
                          setExpandedDashboardNotes(prev => prev.filter(id => id !== note.id));
                        } else {
                          setExpandedDashboardNotes(prev => [...prev, note.id]);
                        }
                      }}
                      className="p-3 bg-white/50 border border-[#D9D1C2] hover:border-[#8B7E66] hover:bg-white/80 transition-colors rounded-xl flex flex-col gap-1 cursor-pointer select-none"
                    >
                      <h4 className={`font-bold text-sm text-slate-800 whitespace-pre-wrap break-words leading-snug ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {note.title}
                      </h4>
                      {isExpanded && note.content && (
                        <p className="text-xs text-slate-600 mt-2 pt-2 border-t border-[#D9D1C2]/40 whitespace-pre-wrap break-words">
                          {note.content}
                        </p>
                      )}
                      <span className="text-[10px] text-slate-400 mt-1">
                        {new Date(note.createdAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* DASHBOARD CARD - COLLAPSIBLE DROP-DOWN WITH SEARCH ONLY FOR GRID VIEWS */}
        <div className="glass-panel rounded-2xl border border-[#D9D1C2] p-6 shadow-sm space-y-4">
          <div 
            onClick={() => setIsDashboardDropdownOpen(!isDashboardDropdownOpen)}
            className="flex items-center justify-between pb-3 border-b border-[#D9D1C2] cursor-pointer hover:opacity-85 select-none"
          >
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#8B7E66]" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Dashboard
                </h3>
                <p className="text-[11.5px] text-zinc-500">Okumak istediğiniz sayfanın üzerine tıklayarak hemen gidin</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {hasPages && (
                <span className="text-xs font-mono font-bold bg-white text-[#8B7E66] px-2.5 py-1 rounded-lg border border-[#D9D1C2]">
                  {book.pages.length} Sayfa
                </span>
              )}
              {isDashboardDropdownOpen ? (
                <ChevronUp className="w-4 h-4 text-[#8B7E66] stroke-[2.5]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#8B7E66] stroke-[2.5]" />
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isDashboardDropdownOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-1 pb-2">
                  {/* Dashboard Search Input (Request #3) */}
                  {hasPages && (
                    <div className="relative w-full">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Search className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        placeholder="Sayfalarda kelime veya numara ara..."
                        value={dashboardSearchQuery}
                        onChange={(e) => setDashboardSearchQuery(e.target.value)}
                        className="w-full text-xs font-semibold pl-9 pr-9 py-2 border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B7E66] bg-[#F5F2EA]"
                      />
                      {dashboardSearchQuery && (
                        <button
                          onClick={() => setDashboardSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {hasPages ? (
                    (() => {
                      const filtered = book.pages.filter(p => {
                        const q = dashboardSearchQuery.trim();
                        if (!q) return true;
                        
                        // If the search query is numeric, restrict matching purely to the page numbers containing that query 
                        // to prevent irrelevant results where normal text strings contain the searched number.
                        const isQueryNumeric = /^\d+$/.test(q);
                        if (isQueryNumeric) {
                          return String(p.page) === q || String(p.page).startsWith(q);
                        }
                        
                        // Normalize both search query and texts for highly flexible and customizable character mappings
                        const normQ = normalizeText(q);
                        return String(p.page).includes(normQ) || 
                               normalizeText(p.turkish || '').includes(normQ) || 
                               normalizeText(p.arabic || '').includes(normQ);
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="py-8 text-center text-xs font-medium text-stone-550 italic">
                            Aranan kriterlere uygun sayfa bulunamadı.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {/* Page Management Toolbar */}
                          <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-[#D9D1C2]/40 text-xs">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setIsPageEditMode(!isPageEditMode)}
                                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs ${
                                  isPageEditMode 
                                    ? 'bg-[#8B7E66] text-white shadow-xs' 
                                    : 'bg-white/60 border border-[#D9D1C2] text-slate-700 hover:bg-white'
                                }`}
                              >
                                <FileEdit className="w-3.5 h-3.5" />
                                {isPageEditMode ? 'Düzenleme Modu Açık' : 'Sayfaları Düzenle'}
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => setIsAddPageModalOpen(true)}
                                className="px-3 py-1.5 rounded-xl font-bold bg-white/60 border border-[#D9D1C2] hover:bg-white text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer text-xs"
                              >
                                <Plus className="w-3.5 h-3.5 text-[#8B7E66]" />
                                Yeni Sayfa Ekle
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={handleRenumberPagesSequentially}
                              className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer"
                              title="Tüm sayfaları 1'den başlayarak ardışık numaralandır"
                            >
                              <ListOrdered className="w-3.5 h-3.5" /> Numaraları Sırala (1..N)
                            </button>
                          </div>

                          {/* Grid layouts */}
                          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 pt-1">
                            {filtered.map((p) => {
                              const originalIdx = book.pages.findIndex(orig => orig === p);
                              const isPageBookmarked = book.bookmark !== null && String(book.bookmark) === String(p.page);
                              return (
                                <button
                                  key={p.page}
                                  id={`page-tile-${p.page}`}
                                  onClick={() => {
                                    if (isPageEditMode) {
                                      setEditingPageData({ page: p, index: originalIdx >= 0 ? originalIdx : 0 });
                                    } else {
                                      onStartReading(p.page);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    setEditingPageData({ page: p, index: originalIdx >= 0 ? originalIdx : 0 });
                                  }}
                                  className={`py-3.5 px-1 rounded-xl text-center font-mono text-xs font-medium border transition-all duration-150 cursor-pointer relative group scale-100 active:scale-95 ${
                                    isPageEditMode
                                      ? 'bg-amber-50/80 border-[#8B7E66] text-[#8B7E66] hover:bg-amber-100/60 font-bold ring-1 ring-[#8B7E66]/30'
                                      : isPageBookmarked
                                        ? 'bg-[#FF8A65]/15 border-[#FF8A65] text-[#f55928] font-bold shadow-xs ring-1 ring-[#FF8A65]/40'
                                        : 'bg-white/40 border-[#D9D1C2] text-slate-705 hover:bg-white hover:border-[#8B7E66] hover:text-[#8B7E66] hover:scale-105'
                                  }`}
                                  title={isPageEditMode ? `Sayfa ${p.page} Düzenle` : `Sayfa ${p.page} Oku (Düzenlemek için sağ tıklayın)`}
                                >
                                  {p.page}

                                  {isPageEditMode && (
                                    <span className="absolute -top-1 -right-1 bg-[#8B7E66] text-white p-0.5 rounded-full shadow-xs">
                                      <FileEdit className="w-2.5 h-2.5" />
                                    </span>
                                  )}

                                  {!isPageEditMode && isPageBookmarked && (
                                    <span className="absolute -top-1 -right-1 flex w-2 h-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f55928]/40 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f55928]"></span>
                                    </span>
                                  )}

                                  {!isPageEditMode && (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingPageData({ page: p, index: originalIdx >= 0 ? originalIdx : 0 });
                                      }}
                                      className="absolute -top-1 -left-1 p-0.5 bg-white border border-[#D9D1C2] text-[#8B7E66] rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-xs"
                                      title="Bu Sayfayı Düzenle"
                                    >
                                      <FileEdit className="w-2.5 h-2.5" />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div id="no-pages-placeholder" className="py-12 text-center rounded-xl border border-dashed border-[#D9D1C2] flex flex-col items-center justify-center space-y-2 bg-white/20">
                      <FileCode2 className="w-10 h-10 text-[#8B7E66] opacity-50 animate-pulse" />
                      <p className="text-xs font-semibold text-slate-500">Gösterilecek sayfa yok.</p>
                      <p className="text-[10px] text-slate-400 max-w-sm px-4">
                        Yukarıdaki "Sayfaları Yükle" butonu yardımıyla JSON şablonlarını kullanarak sayfa verisi ekleyin.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Delete Confirmation Overlay Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="glass-panel-deep rounded-2xl p-6 max-w-md w-full border border-[#D9D1C2] shadow-2xl space-y-4">
              <h4 className="font-bold text-slate-800 text-base">Bu Kitabı Silmek İstediğinize Emin misiniz?</h4>
              <p className="text-xs text-slate-500">
                <b>"{book.title}"</b> isimli kitap ve buna ait tüm sayfa verileri, ayraçlar ve yazı ayarları sistemden kalıcı olarak temizlenecektir. Bu işlem geri alınamaz.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  id="cancel-delete-btn"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-white hover:bg-[#F5F2EA] border border-[#D9D1C2] rounded-xl text-[#8B7E66] text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  id="confirm-delete-btn"
                  onClick={() => {
                    onDeleteBook(book.id);
                    onBack();
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                >
                  Evet, Kalıcı Olarak Sil
                </button>
              </div>
            </div>
          </div>
        )}

        {/* JSON Import Overlay Modal */}
        <JSONImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImport={handleImportPages}
        />

        {/* Add Page Modal */}
        <AddPageModal
          isOpen={isAddPageModalOpen}
          onClose={() => setIsAddPageModalOpen(false)}
          onAdd={handleAddPage}
          maxPageNumber={book.pages.length}
        />

        {/* Note Action Menu Modal */}
        <AnimatePresence>
          {noteActionMenu && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm sm:items-center"
              onClick={() => setNoteActionMenu(null)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#F5F2EA] rounded-t-2xl sm:rounded-2xl max-w-sm w-full border border-[#D9D1C2] shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
              >
                <div className="p-4 border-b border-[#D9D1C2] bg-white/50 text-center">
                  <h3 className="font-bold text-slate-800 line-clamp-1">{noteActionMenu.title}</h3>
                </div>
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      setEditingNote(noteActionMenu);
                      setNoteActionMenu(null);
                    }}
                    className="w-full flex items-center gap-3 p-3 text-sm font-bold text-slate-700 hover:bg-white rounded-xl transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-[#8B7E66]" /> Düzenle
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Bu notu silmek istediğinize emin misiniz?')) {
                        onUpdateBook({
                          ...book,
                          notes: book.notes?.filter(n => n.id !== noteActionMenu.id)
                        });
                      }
                      setNoteActionMenu(null);
                    }}
                    className="w-full flex items-center gap-3 p-3 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Sil
                  </button>
                </div>
                <div className="p-2 pt-0">
                  <button
                    onClick={() => setNoteActionMenu(null)}
                    className="w-full p-3 text-sm font-bold text-slate-500 bg-white/60 hover:bg-white rounded-xl border border-[#D9D1C2] transition-colors cursor-pointer"
                  >
                    İptal
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Note Modal */}
        <AnimatePresence>
          {editingNote && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              onClick={() => setEditingNote(null)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#F5F2EA] rounded-2xl max-w-md w-full border border-[#D9D1C2] shadow-2xl p-4 sm:p-6 flex flex-col gap-4"
              >
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#8B7E66]" /> Notu Düzenle
                </h3>
                
                <textarea
                  placeholder="Not Başlığı"
                  value={editingNote.title}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="w-full px-4 py-2 border border-[#D9D1C2] rounded-xl text-sm font-bold focus:outline-hidden focus:border-[#8B7E66] focus:ring-1 focus:ring-[#8B7E66] bg-white resize-none h-16 whitespace-pre-wrap break-words"
                />
                
                <textarea
                  placeholder="Notunuz..."
                  value={editingNote.content}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  className="w-full px-4 py-3 border border-[#D9D1C2] rounded-xl text-sm min-h-[120px] resize-none focus:outline-hidden focus:border-[#8B7E66] focus:ring-1 focus:ring-[#8B7E66] bg-white whitespace-pre-wrap break-words"
                />
                
                <div className="flex flex-col gap-2 pt-2 border-t border-[#D9D1C2]/50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveEditedNote}
                      disabled={!editingNote.title.trim()}
                      className="flex-1 py-2.5 bg-[#8B7E66] text-white rounded-xl text-sm font-bold hover:bg-[#7A6E59] transition-colors disabled:opacity-50 cursor-pointer animate-press"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={() => setEditingNote(null)}
                      className="flex-1 py-2.5 bg-white border border-[#D9D1C2] rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      İptal
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Bu notu silmek istediğinize emin misiniz?')) {
                        onUpdateBook({
                          ...book,
                          notes: book.notes?.filter(n => n.id !== editingNote.id)
                        });
                        setEditingNote(null);
                      }
                    }}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Notu Sil
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Page Modal */}
        {editingPageData && (
          <EditPageModal
            isOpen={!!editingPageData}
            onClose={() => setEditingPageData(null)}
            page={editingPageData.page}
            pageIndex={editingPageData.index}
            totalPages={book.pages.length}
            separatorColor={book.settings?.arabic?.separatorColor || '#d97706'}
            onSavePage={handleSavePage}
            onDeletePage={handleDeletePage}
            onInsertPage={handleInsertPage}
            onReadPage={onStartReading}
          />
        )}

        {/* Book Settings Modal for this specific book */}
        <AnimatePresence>
          {isSettingsOpen && (
            <BookSettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              book={book}
              onUpdateSettings={(newSettings) => {
                onUpdateBook({
                  ...book,
                  settings: newSettings
                });
              }}
              onResetToDefaults={() => {
                try {
                  const saved = localStorage.getItem('dualreader_global_settings');
                  if (saved) {
                    onUpdateBook({
                      ...book,
                      settings: JSON.parse(saved)
                    });
                  }
                } catch (e) {}
              }}
            />
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
