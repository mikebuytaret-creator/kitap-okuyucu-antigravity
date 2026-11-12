/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bookmark, 
  BookOpen, 
  Plus, 
  Clock, 
  Languages, 
  Search, 
  BookMarked, 
  Sparkles, 
  FileJson,
  Trash2,
  Edit2,
  Grid,
  List,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Layers,
  Download,
  Upload,
  AlertCircle,
  ClipboardCheck,
  ArrowUpDown
} from 'lucide-react';
import { Book, Deck, AppBackupData } from '../types';
import { getRandomCoverGradient, copyToClipboard, downloadFile, createFullBackupPayload, restoreBackupMetadata } from '../utils';

interface LibraryViewProps {
  books: Book[];
  decks: Deck[];
  onSelectBook: (book: Book) => void;
  onAddBookTrigger: () => void;
  onLoadDemoBooks: () => void;
  onCreateDeck: (name: string) => void;
  onRenameDeck: (deckId: string, newName: string) => void;
  onDeleteDeck: (deckId: string, deleteContents: boolean) => void;
  onRestoreBackup: (books: Book[], decks: Deck[]) => void;
}

type SortMode = 'recent' | 'name-asc' | 'name-desc';

export default function LibraryView({ 
  books, 
  decks,
  onSelectBook, 
  onAddBookTrigger, 
  onLoadDemoBooks,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onRestoreBackup
}: LibraryViewProps) {
  
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<'detailed' | 'grid'>('detailed');
  const [gridScale, setGridScale] = useState<number>(0.85); // Make grid look smaller by default (0.85)

  // Tracking collapsed/expanded decks. Default is open (expanded), so collapsed state is false.
  const [collapsedDecks, setCollapsedDecks] = useState<Record<string, boolean>>({});

  // Sorting mode per deck
  const [deckSortModes, setDeckSortModes] = useState<Record<string, SortMode>>(() => {
    const saved = localStorage.getItem('dualreader_deck_sort_modes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const handleToggleSortMode = (deckId: string) => {
    setDeckSortModes(prev => {
      const current = prev[deckId] || 'recent';
      let next: SortMode = 'recent';
      if (current === 'recent') {
        next = 'name-asc';
      } else if (current === 'name-asc') {
        next = 'name-desc';
      } else {
        next = 'recent';
      }
      const updated = {
        ...prev,
        [deckId]: next
      };
      localStorage.setItem('dualreader_deck_sort_modes', JSON.stringify(updated));
      return updated;
    });
  };

  const getSortedBooks = (booksList: Book[], deckId: string) => {
    const mode = deckSortModes[deckId] || 'recent';
    const listCopy = [...booksList];
    if (mode === 'recent') {
      return listCopy.sort((a, b) => {
        const timeA = a.lastReadAt || a.createdAt || 0;
        const timeB = b.lastReadAt || b.createdAt || 0;
        return timeB - timeA;
      });
    } else if (mode === 'name-asc') {
      return listCopy.sort((a, b) => a.title.localeCompare(b.title, 'tr-TR'));
    } else if (mode === 'name-desc') {
      return listCopy.sort((a, b) => b.title.localeCompare(a.title, 'tr-TR'));
    }
    return listCopy;
  };

  // Form states for creating/renaming decks
  const [newDeckName, setNewDeckName] = useState('');
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [editingDeckName, setEditingDeckName] = useState('');
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);

  // Delete deck confirmation modal
  const [deleteConfirmDeckId, setDeleteConfirmDeckId] = useState<string | null>(null);

  // Custom backup states (No window.alert/confirm for iframes)
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pastedJson, setPastedJson] = useState('');

  const [restoreSession, setRestoreSession] = useState<{
    fileName: string;
    booksCount: number;
    decksCount: number;
    notesCount: number;
    hasSettings: boolean;
    fullBackup: AppBackupData;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showRestoreSuccess, setShowRestoreSuccess] = useState(false);

  const touchStartDistRef = React.useRef<number | null>(null);
  const initialTouchScaleRef = React.useRef<number>(1);

  const handleBackupAllData = async () => {
    try {
      const backupData = createFullBackupPayload(books, decks);
      const json = JSON.stringify(backupData, null, 2);
      const filename = `dual_reader_tam_yedek_${new Date().toISOString().split('T')[0]}.json`;
      const success = await downloadFile(json, filename);
      if (!success) {
        setRestoreError('Dosya indirme başlatılamadı. Cihazınızda sistem paylaşımı veya yedek kodu kopyalama seçeneklerini kullanmayı deneyin.');
      }
    } catch (err: any) {
      setRestoreError('Yedekleme sırasında hata oluştu: ' + err.message);
    }
  };

  const handleCopyBackupToClipboard = async () => {
    try {
      const backupData = createFullBackupPayload(books, decks);
      const json = JSON.stringify(backupData, null, 2);
      const success = await copyToClipboard(json);
      if (success) {
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 3000);
      } else {
        setRestoreError('Yedek panoya kopyalanamadı.');
      }
    } catch (err: any) {
      setRestoreError('Yedekleme sırasında hata oluştu: ' + err.message);
    }
  };

  const handleShareBackup = async () => {
    try {
      const backupData = createFullBackupPayload(books, decks);
      const json = JSON.stringify(backupData, null, 2);
      if (navigator.share) {
        const dateStr = new Date().toISOString().split('T')[0];
        try {
          const file = new File([json], `dual_reader_tam_yedek_${dateStr}.json`, { type: 'application/json' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Dual Reader Tam Kütüphane Yedeği',
              text: 'Dual Reader kütüphane yedek dosyası'
            });
          } else {
            if (json.length > 50000) {
              setRestoreError('Yedek dosyası metin olarak paylaşmak için çok büyük. Lütfen kopyalama veya indirme seçeneklerini kullanın.');
              return;
            }
            await navigator.share({
              title: 'Dual Reader Tam Kütüphane Yedeği',
              text: json
            });
          }
        } catch (shareErr) {
          if (json.length > 50000) {
            setRestoreError('Dosya paylaşımı reddedildi veya desteklenmiyor. Yedek kodu metin olarak paylaşmak için çok büyük. Lütfen kopyalama veya indirme seçeneğini kullanın.');
            return;
          }
          await navigator.share({
            title: 'Dual Reader Tam Kütüphane Yedeği',
            text: json
          });
        }
      } else {
        setRestoreError('Sistem paylaşımı bu tarayıcıda desteklenmiyor.');
      }
    } catch (err: any) {
      setRestoreError('Yedek paylaşılırken hata oluştu: ' + err.message);
    }
  };

  const handleRestoreFromText = (text: string) => {
    if (!text.trim()) return;
    try {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.books)) {
        throw new Error('Yedekleme dosyası formatı geçersiz (kitap listesi bulunamadı).');
      }
      const totalNotes = (Array.isArray(data.generalNotes) ? data.generalNotes.length : 0) + 
        data.books.reduce((acc: number, b: any) => acc + (Array.isArray(b.notes) ? b.notes.length : 0), 0);

      setRestoreSession({
        fileName: 'Kopyalanan Yedek Kodu',
        booksCount: data.books.length,
        decksCount: Array.isArray(data.decks) ? data.decks.length : 0,
        notesCount: totalNotes,
        hasSettings: !!data.globalSettings || data.books.some((b: any) => !!b.settings),
        fullBackup: data
      });
      setRestoreError(null);
    } catch (err: any) {
      setRestoreError('Geçersiz yedekleme kodu: ' + err.message);
    }
  };

  const handleRestoreAllData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRestoreError(null);
    setShowRestoreSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (!data || !Array.isArray(data.books)) {
          throw new Error('Yedekleme dosyası formatı geçersiz (kitap listesi bulunamadı).');
        }

        const totalNotes = (Array.isArray(data.generalNotes) ? data.generalNotes.length : 0) + 
          data.books.reduce((acc: number, b: any) => acc + (Array.isArray(b.notes) ? b.notes.length : 0), 0);

        setRestoreSession({
          fileName: file.name,
          booksCount: data.books.length,
          decksCount: Array.isArray(data.decks) ? data.decks.length : 0,
          notesCount: totalNotes,
          hasSettings: !!data.globalSettings || data.books.some((b: any) => !!b.settings),
          fullBackup: data
        });
      } catch (err: any) {
        setRestoreError('Yedek dosyası okunamadı veya biçimi geçersiz: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!restoreSession) return;
    restoreBackupMetadata(restoreSession.fullBackup);
    onRestoreBackup(restoreSession.fullBackup.books, restoreSession.fullBackup.decks || []);
    setRestoreSession(null);
    setShowRestoreSuccess(true);
  };

  // Monitor Ctrl + Wheel zoom on window
  React.useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setGridScale(prev => {
          const newScale = prev - e.deltaY * 0.0012;
          return Math.min(1.5, Math.max(0.55, newScale));
        });
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);

  // Gestures for touchscreens
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      touchStartDistRef.current = dist;
      initialTouchScaleRef.current = gridScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      if (e.cancelable) e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const ratio = dist / touchStartDistRef.current;
      setGridScale(Math.min(1.5, Math.max(0.55, initialTouchScaleRef.current * ratio)));
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  const toggleDeckCollapse = (deckId: string) => {
    setCollapsedDecks(prev => ({
      ...prev,
      [deckId]: !prev[deckId]
    }));
  };

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewDeckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDeckName.trim()) {
      onCreateDeck(newDeckName.trim());
      setNewDeckName('');
      setShowAddDeck(false);
    }
  };

  const handleSaveRename = (deckId: string) => {
    if (editingDeckName.trim()) {
      onRenameDeck(deckId, editingDeckName.trim());
    }
    setEditingDeckId(null);
  };

  // Reusable card builders
  const renderBookDetailedCard = (book: Book) => {
    const coverGradient = getRandomCoverGradient(book.id);
    const numPages = book.pages ? book.pages.length : 0;
    const hasBookmark = book.bookmark !== null;
    
    return (
      <div
        key={book.id}
        id={`book-card-${book.id}`}
        onClick={() => onSelectBook(book)}
        className="hover:bg-[#eae6db] bg-[#F5F2EA] rounded-2xl border border-[#D9D1C2] hover:border-[#8B7E66] hover:shadow-lg transition-all p-4 flex gap-4 cursor-pointer relative group overflow-hidden"
      >
        {/* Visual design cover */}
        <div className="w-14 h-20 shrink-0 rounded-lg shadow-xs relative overflow-hidden flex flex-col justify-between">
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
          
          <div className={`absolute inset-0 bg-gradient-to-br ${coverGradient} ${book.coverImageUrl ? 'bg-black/30 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity' : ''} flex flex-col justify-between p-1.5 text-white z-10`}>
            <div className="absolute top-0 right-0 w-12 h-12 bg-white/5 rounded-full blur-lg -mr-4 -mt-4"></div>
            <span className="text-[6px] font-mono tracking-wider opacity-60 uppercase">Kitap</span>
            <span className="font-bold text-[8.5px] leading-tight line-clamp-3 text-left">
              {book.title}
            </span>
            <span className="text-[7px] font-mono opacity-80 text-left">
              {numPages > 0 ? `${numPages} S.` : 'Boş'}
            </span>
          </div>
        </div>

        {/* Metadata and details */}
        <div className="flex-1 flex flex-col justify-between py-1 min-w-0 text-[#2D2D2A]">
          <div className="space-y-1 text-left">
            <h4 className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug group-hover:text-[#8B7E66] transition-colors">
              {book.title}
            </h4>
            
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-[#8B7E66]/60 font-medium shrink-0" />
              <span>Son Okuma: {new Date(book.lastReadAt || book.createdAt).toLocaleDateString('tr-TR')}</span>
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            {!numPages && (
              <span className="text-[9px] text-[#8B7E66]/90 font-bold flex items-center gap-0.5">
                <FileJson className="w-3 h-3 text-[#8B7E66]" /> JSON Bekleniyor
              </span>
            )}

            {/* Bookmark status */}
            {hasBookmark && (
              <div className="flex items-center gap-1 bg-[#FF8A65]/10 text-[#f55928] text-[10px] px-2 py-0.5 rounded-md font-semibold w-fit border border-[#FF8A65]/35">
                <Bookmark className="w-3 h-3 fill-[#FF8A65] text-[#FF8A65] shrink-0" />
                <span className="truncate">S. {book.bookmark}'da kaldı</span>
              </div>
            )}
          </div>
        </div>

        {/* Subtle enter icon on hover */}
        <div className="absolute bottom-3 right-3 p-1.5 bg-white rounded-full border border-[#D9D1C2] text-slate-500 group-hover:bg-[#8B7E66] group-hover:text-white transition-all opacity-0 group-hover:opacity-100">
          &rarr;
        </div>
      </div>
    );
  };

  const renderBookGridCard = (book: Book) => {
    const coverGradient = getRandomCoverGradient(book.id);
    const numPages = book.pages ? book.pages.length : 0;
    const hasBookmark = book.bookmark !== null;
    
    return (
      <div
        key={book.id}
        id={`book-grid-card-${book.id}`}
        onClick={() => onSelectBook(book)}
        className="hover:bg-[#eae6db] bg-[#F5F2EA] rounded-2xl border border-[#D9D1C2] hover:border-[#8B7E66] hover:shadow-lg transition-all p-2.5 flex flex-col justify-between cursor-pointer relative group overflow-hidden text-[#2D2D2A] w-full"
        style={{ minHeight: `${Math.round(250 * gridScale)}px` }}
      >
        {/* Visual design cover */}
        <div 
          className="w-full relative rounded-xl overflow-hidden shadow-xs shrink-0 bg-[#F5F2EA] transition-all"
          style={{ height: `${Math.round(185 * gridScale)}px` }}
        >
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
          
          <div className={`absolute inset-0 bg-gradient-to-br ${coverGradient} ${book.coverImageUrl ? 'bg-black/35 group-hover:bg-black/15 transition-colors' : ''} flex flex-col justify-between p-2 text-white z-10`}>
            <div className="absolute top-0 right-0 w-10 h-10 bg-white/5 rounded-full blur-md -mr-3 -mt-3"></div>
            <span className="text-[5.5px] font-mono tracking-wider opacity-60 uppercase text-left block">Kitap</span>
            <span 
              className="font-bold leading-tight line-clamp-3 text-left block font-sans"
              style={{ fontSize: `${Math.max(8.5, Math.round(11 * gridScale))}px` }}
            >
              {book.title}
            </span>
            <span className="text-[7px] font-mono opacity-85 text-left block">
              {numPages > 0 ? `${numPages} Sayfa` : 'Boş'}
            </span>
          </div>
        </div>

        {/* Card labels */}
        <div className="mt-1.5 text-left space-y-0.5 w-full min-w-0">
          <h4 
            className="font-bold text-slate-800 truncate leading-snug group-hover:text-[#8B7E66] transition-colors font-sans"
            style={{ fontSize: `${Math.max(9.5, Math.round(12 * gridScale))}px` }}
          >
            {book.title}
          </h4>
          <div className="flex flex-col gap-0.5 text-[8.5px] text-slate-500 font-medium leading-tight">
            <div className="truncate opacity-80">Son: {new Date(book.lastReadAt || book.createdAt).toLocaleDateString('tr-TR')}</div>
            {hasBookmark && (
              <div className="flex items-center gap-0.5 bg-[#FF8A65]/10 text-[#f55928] px-1 py-0.5 rounded-md font-semibold border border-[#FF8A65]/25 w-fit text-[8px] mt-0.5">
                <Bookmark className="w-2.5 h-2.5 fill-[#FF8A65] text-[#FF8A65] shrink-0" />
                <span>S. {book.bookmark}</span>
              </div>
            )}
            {!numPages && (
              <div className="text-[#8B7E66] font-bold text-[8px] truncate flex items-center gap-0.5 font-sans">
                <FileJson className="w-2.5 h-2.5" /> JSON Bekleniyor
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Title & Introduction Panel */}
      <div className="bg-gradient-to-r from-[#8B7E66] to-[#70644e] text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-[#D9D1C2] relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute left-1/3 top-0 w-36 h-36 bg-orange-400/10 rounded-full blur-2xl"></div>

        <div className="space-y-2 z-10 relative">
          <div className="flex items-center gap-2 bg-black/15 w-fit px-3 py-1 rounded-full text-[11px] font-bold text-[#F5F2EA] border border-white/10 uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-[#FF8A65]" /> Kitap Okuyucu
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Kişisel Kitaplığım</h1>
          <p className="text-xs sm:text-sm text-[#F5F2EA] leading-relaxed opacity-90 max-w-2xl text-left">
            Kitaplarınızı ekleyin, JSON formatındaki sayflarınızı aktarın ve okuma göz zevkinize göre özelleştirin. Kitaplarınızı destelere ayırarak daha düzenli bir kütüphane oluşturabilirsiniz.
          </p>
        </div>
      </div>

      {/* Library Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#F5F2EA] p-4 rounded-xl border border-[#D9D1C2]">
        
        {/* Clean search bar */}
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="book-search-input"
            type="text"
            placeholder="Kitaplarda ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-semibold pl-9 pr-4 py-2 border border-[#D9D1C2] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#8B7E66] bg-[#F5F2EA]"
          />
        </div>

        {/* Demo books quick sync if library is small */}
        {books.length === 0 && (
          <button
            id="load-demo-btn"
            onClick={onLoadDemoBooks}
            className="text-xs font-bold px-4 py-2 text-[#8B7E66] hover:text-[#70644e] bg-white/80 hover:bg-[#F5F2EA] rounded-lg cursor-pointer transition-colors border border-[#D9D1C2] flex items-center gap-1.5 self-end md:self-auto"
          >
            <BookMarked className="w-4 h-4 text-[#FF8A65]" />
            Örnek Test Kitaplarını Yükle
          </button>
        )}
      </div>

      {/* Global Scaling / Layout switch header */}
      <div className="flex items-center justify-between border-b border-[#D9D1C2]/45 pb-2 ml-1 gap-2">
        <div className="flex items-center gap-2 select-none flex-wrap">
          <Layers className="w-4 h-4 text-[#8B7E66]" />
          <h3 className="text-xs font-extrabold text-[#8B7E66] uppercase tracking-wider">
            Kitaplık
          </h3>
          
          {/* "+ Deste Ekle" button right adjacent on same row */}
          <button
            onClick={() => setShowAddDeck(true)}
            className="text-[10px] font-extrabold px-2.5 py-1 bg-[#8B7E66]/10 hover:bg-[#8B7E66] text-[#8B7E66] hover:text-white border border-[#8B7E66]/20 hover:border-transparent rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3 h-3" /> Deste Ekle
          </button>
        </div>
        
        <div className="flex items-center gap-1.5 bg-stone-100/65 backdrop-blur-xs p-1 rounded-xl border border-stone-200">
          {layoutMode === 'grid' && (
            <div id="grid-zoom-feedback" className="hidden sm:flex items-center gap-1 text-[10px] text-stone-500 font-bold font-mono px-1.5 select-none" title="Büyütmek/küçültmek için Ctrl + Fare Tekerleği veya Çift Parmak kullanın">
              <span>ZOOM:</span>
              <span className="text-[#8B7E66]">{Math.round(gridScale * 100)}%</span>
              <button 
                onClick={() => setGridScale(0.85)} 
                className="hover:bg-stone-200/85 px-1 py-0.5 rounded cursor-pointer text-[9px]"
                title="Sıfırla"
              >
                ↺
              </button>
            </div>
          )}

          <button
            id="layout-mode-detailed-btn"
            onClick={() => setLayoutMode('detailed')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              layoutMode === 'detailed'
                ? 'bg-[#8B7E66] text-white shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-700'
            }`}
            title="Detaylı Liste"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            id="layout-mode-grid-btn"
            onClick={() => setLayoutMode('grid')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              layoutMode === 'grid'
                ? 'bg-[#8B7E66] text-white shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-700'
            }`}
            title="Kompakt Izgara"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {layoutMode === 'grid' && (
        <div className="text-[10px] text-stone-500 select-none font-bold text-right -mt-4 mr-2 hidden sm:block">
          💡 İpucu: Kitap resimlerini <kbd className="bg-stone-200 px-1 py-[1.5px] rounded border border-stone-300">Ctrl + Kaydırma Tekerleği</kbd> veya çift parmakla kıstırıp açarak boyutlandırabilirsiniz.
        </div>
      )}

      {/* Main Books Display organized by Decks */}
      <div className="space-y-6">
        {books.length > 0 ? (
          <>
            {/* 1. Map through defined decks */}
            {decks.map((deck) => {
              const deckBooks = filteredBooks.filter(b => b.deckId === deck.id);
              const sortedDeckBooks = getSortedBooks(deckBooks, deck.id);
              const isCollapsed = collapsedDecks[deck.id] || false;

              return (
                <div key={deck.id} className="bg-[#F5F2EA] rounded-2xl border border-[#D9D1C2] p-4 space-y-4">
                  {/* Deck Header */}
                  <div className="flex items-center justify-between border-b border-[#D9D1C2]/45 pb-3">
                    {editingDeckId === deck.id ? (
                      <div className="flex items-center gap-2 flex-1 max-w-sm justify-between w-full">
                        <input
                          type="text"
                          value={editingDeckName}
                          onChange={(e) => setEditingDeckName(e.target.value)}
                          className="text-xs font-bold text-slate-800 px-3 py-1.5 border border-[#8B7E66] rounded-xl bg-[#F5F2EA] w-full focus:outline-hidden"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(deck.id);
                          }}
                          autoFocus
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleSaveRename(deck.id)}
                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 cursor-pointer border border-[#D9D1C2] transition-colors"
                            title="Kaydet"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingDeckId(null)}
                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100/80 text-rose-700 cursor-pointer border border-[#D9D1C2] transition-colors"
                            title="İptal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => toggleDeckCollapse(deck.id)}
                        className="flex items-center gap-2.5 cursor-pointer flex-1 select-none group text-left"
                      >
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4 text-[#8B7E66] group-hover:scale-110 transition-transform" />
                        ) : (
                          <ChevronUp className="w-4 h-4 text-[#8B7E66] group-hover:scale-110 transition-transform" />
                        )}
                        <span className="font-extrabold text-slate-850 text-sm tracking-tight group-hover:text-[#8B7E66] transition-colors">
                          {deck.name}
                        </span>
                        <span className="text-[10px] bg-[#8B7E66]/10 text-[#8B7E66] font-bold px-2 py-0.5 rounded-full">
                          {deckBooks.length} Kitap
                        </span>
                      </div>
                    )}

                    {/* Deck Actions */}
                    {editingDeckId !== deck.id && (
                      <div className="flex items-center gap-1">
                        {/* Sort toggle button immediately to the left of rename (edit) button */}
                        <button
                          onClick={() => handleToggleSortMode(deck.id)}
                          className={`p-1.5 rounded-lg border border-transparent transition-all cursor-pointer flex items-center gap-1 ${
                            deckSortModes[deck.id] && deckSortModes[deck.id] !== 'recent'
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-[#D9D1C2]/50'
                              : 'text-[#8B7E66] hover:bg-white/80'
                          }`}
                          title={`Sırala: ${
                            (deckSortModes[deck.id] || 'recent') === 'recent'
                              ? 'Son Okunan'
                              : (deckSortModes[deck.id] === 'name-asc')
                              ? 'İsim (A-Z)'
                              : 'İsim (Z-A)'
                          }`}
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                          {deckSortModes[deck.id] && deckSortModes[deck.id] !== 'recent' && (
                            <span className="text-[9px] font-extrabold text-emerald-800">
                              {deckSortModes[deck.id] === 'name-asc' ? 'A-Z' : 'Z-A'}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setEditingDeckId(deck.id);
                            setEditingDeckName(deck.name);
                          }}
                          className="p-1.5 text-[#8B7E66] hover:bg-white/80 rounded-lg border border-transparent hover:border-[#D9D1C2]/60 cursor-pointer transition-all"
                          title="Yeniden Adlandır"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmDeckId(deck.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50/50 rounded-lg border border-transparent hover:border-rose-100 cursor-pointer transition-all"
                          title="Desteyi Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Deck Body (Books List) */}
                  {!isCollapsed && (
                    <div className="pt-1">
                      {sortedDeckBooks.length > 0 ? (
                        layoutMode === 'detailed' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {sortedDeckBooks.map((book) => renderBookDetailedCard(book))}
                          </div>
                        ) : (
                          <div 
                            className="grid gap-4 justify-items-center justify-center transition-all duration-300"
                            style={{ 
                              gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(135 * gridScale)}px, 1fr))` 
                            }}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                          >
                            {sortedDeckBooks.map((book) => renderBookGridCard(book))}
                          </div>
                        )
                      ) : (
                        <div className="py-8 text-center text-[11px] text-slate-500 italic font-semibold font-sans">
                          Bu destede henüz kitap yok. Kitaplarım sayfasından bu desteyi seçebilirsiniz.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 2. Render Unassigned Books Section (if any count exists) */}
            {(() => {
              const unassignedBooks = filteredBooks.filter(b => !b.deckId || !decks.some(d => d.id === b.deckId));
              if (unassignedBooks.length === 0) return null;
              const sortedUnassignedBooks = getSortedBooks(unassignedBooks, 'unassigned');
              const isCollapsed = collapsedDecks['unassigned'] || false;

              return (
                <div className="bg-[#F5F2EA] rounded-2xl border border-[#D9D1C2] p-4 space-y-4">
                  {/* Section Header */}
                  <div className="flex items-center justify-between border-b border-[#D9D1C2]/45 pb-3">
                    <div 
                      onClick={() => toggleDeckCollapse('unassigned')}
                      className="flex items-center gap-2.5 cursor-pointer flex-1 select-none group text-left"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-[#8B7E66] group-hover:scale-110 transition-transform" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-[#8B7E66] group-hover:scale-110 transition-transform" />
                      )}
                      <span className="font-extrabold text-slate-800 text-sm tracking-tight group-hover:text-[#8B7E66] transition-colors">
                        Destesiz Kitaplar (Kategorisiz)
                      </span>
                      <span className="text-[10px] bg-amber-700/10 text-amber-805 font-bold px-2 py-0.5 rounded-full">
                        {unassignedBooks.length} Kitap
                      </span>
                    </div>

                    {/* Unassigned Sort Action */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleSortMode('unassigned')}
                        className={`p-1.5 rounded-lg border border-transparent transition-all cursor-pointer flex items-center gap-1 ${
                          deckSortModes['unassigned'] && deckSortModes['unassigned'] !== 'recent'
                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-[#D9D1C2]/50'
                            : 'text-[#8B7E66] hover:bg-white/80'
                        }`}
                        title={`Sırala: ${
                          (deckSortModes['unassigned'] || 'recent') === 'recent'
                            ? 'Son Okunan'
                            : (deckSortModes['unassigned'] === 'name-asc')
                            ? 'İsim (A-Z)'
                            : 'İsim (Z-A)'
                        }`}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        {deckSortModes['unassigned'] && deckSortModes['unassigned'] !== 'recent' && (
                          <span className="text-[9px] font-extrabold text-emerald-800">
                            {deckSortModes['unassigned'] === 'name-asc' ? 'A-Z' : 'Z-A'}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Section Body */}
                  {!isCollapsed && (
                    <div className="pt-1">
                      {sortedUnassignedBooks.length > 0 ? (
                        layoutMode === 'detailed' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {sortedUnassignedBooks.map((book) => renderBookDetailedCard(book))}
                          </div>
                        ) : (
                          <div 
                            className="grid gap-4 justify-items-center justify-center transition-all duration-300"
                            style={{ 
                              gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(135 * gridScale)}px, 1fr))` 
                            }}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                          >
                            {sortedUnassignedBooks.map((book) => renderBookGridCard(book))}
                          </div>
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <div id="empty-state-card" className="bg-white/40 backdrop-blur-xl border border-[#D9D1C2] rounded-2xl p-10 py-16 text-center space-y-4 shadow-xs">
            <BookOpen className="w-16 h-16 text-[#8B7E66] opacity-60 mx-auto" />
            <div className="max-w-md mx-auto space-y-1.5">
              <h4 className="font-bold text-slate-800 text-base">Henüz Ekli Kitap Yok</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kendi kitaplarınızı oluşturup okumaya başlayabilirsiniz. Hızlı bir başlangıç için aşağıdaki örnek test kitaplarını yükleyebilirsiniz.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <button
                id="empty-load-demo-btn"
                onClick={onLoadDemoBooks}
                className="px-5 py-2.5 bg-white hover:bg-[#F5F2EA] text-[#8B7E66] rounded-xl text-xs font-bold border border-[#D9D1C2] transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-[#FF8A65]" />
                Örnek Kitapları Yükle (Fatiha & Masal)
              </button>
              
              <button
                onClick={onAddBookTrigger}
                className="px-5 py-2.5 bg-[#8B7E66] hover:bg-[#70644e] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Yeni Kitap Oluştur
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Offline Storage & Backup Control Panel for Android & Web */}
      {books.length === 0 && (
        <div className="bg-[#EAE6DB]/60 border border-[#D9D1C2] rounded-2xl p-5 mt-8 space-y-4 text-left">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#8B7E66]" />
                Android & Web Çevrimdışı Depolama ve Yedekleme
              </h4>
              <p className="text-[11px] text-slate-650 leading-relaxed max-w-2xl">
                Tüm yüklü kitaplarınız ve ayarlarınız tarayıcınızın veya uygulamanızın güvenli hafızasında (IndexedDB) saklanmaktadır. 
                <span className="block mt-1 font-semibold text-[#8B7E66]">
                  APK sürümünde dosya indirme kısıtlamaları olabileceğinden, "Yedek Kodu Kopyala" seçeneğini kullanarak yedeğinizi kopyalayabilir ve "Kodu Yapıştır" butonu ile geri yükleyebilirsiniz.
                </span>
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleBackupAllData}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Tüm kitaplığı JSON yedek dosyası olarak indir"
              >
                <Download className="w-3.5 h-3.5" /> Yedek Dosyası İndir
              </button>

              <button
                onClick={handleCopyBackupToClipboard}
                className={`px-3.5 py-2 ${copiedSuccess ? 'bg-teal-600' : 'bg-stone-600 hover:bg-stone-700'} text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs`}
                title="Yedekleme kodunu panoya kopyalar (Android/APK için en güvenli yöntem)"
              >
                <ClipboardCheck className="w-3.5 h-3.5" /> 
                {copiedSuccess ? 'Kod Kopyalandı!' : 'Yedek Kodu Kopyala'}
              </button>

              {navigator.share && (
                <button
                  onClick={handleShareBackup}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Sistem paylaşım menüsüyle yedeği gönder"
                >
                  <Upload className="w-3.5 h-3.5" /> Paylaş
                </button>
              )}
              
              <label className="px-3.5 py-2 bg-[#8B7E66] hover:bg-[#786c55] text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs relative">
                <Upload className="w-3.5 h-3.5" /> Dosya Yükle
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreAllData}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-[0px]"
                />
              </label>

              <button
                onClick={() => setShowPasteArea(!showPasteArea)}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Kopyaladığınız yedek kodunu yapıştırarak geri yükleyin"
              >
                <Plus className="w-3.5 h-3.5" /> Kodu Yapıştır
              </button>
            </div>
          </div>

          {/* Paste Area for JSON Restore */}
          {showPasteArea && (
            <div className="border border-amber-200 bg-amber-50/50 p-4 rounded-xl space-y-3 mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <span className="text-xs font-extrabold text-amber-850 block">Kopyaladığınız Yedekleme Kodunu Aşağıya Yapıştırın:</span>
              <textarea
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder='{"version": "1.0", "books": [...]}'
                className="w-full h-32 p-3 border border-[#D9D1C2] rounded-xl text-xs font-mono bg-white focus:outline-hidden focus:border-[#8B7E66]"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowPasteArea(false);
                    setPastedJson('');
                  }}
                  className="px-3 py-1.5 bg-white border border-[#D9D1C2] text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-50 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={() => handleRestoreFromText(pastedJson)}
                  disabled={!pastedJson.trim()}
                  className="px-4 py-1.5 bg-[#8B7E66] text-white rounded-lg text-xs font-bold hover:bg-[#786c55] disabled:opacity-40 cursor-pointer"
                >
                  Kodu Çöz ve Yükle
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Styled Custom Delete Confirmation Dialog Backdrop Overlay */}
      <AnimatePresence>
        {deleteConfirmDeckId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-[#F5F2EA] border border-[#D9D1C2] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left"
            >
              <h3 className="font-extrabold text-slate-800 text-base tracking-tight">Desteyi Sil</h3>
              <p className="text-xs text-slate-650 leading-relaxed">
                <strong>"{decks.find(d => d.id === deleteConfirmDeckId)?.name}"</strong> destesini kalıcı olarak silmek üzeresiniz.
                <br /><br />
                Deste silinirken, bu destenin içindeki tüm kitapları da tamamen silmek ister misiniz?
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    onDeleteDeck(deleteConfirmDeckId, true);
                    setDeleteConfirmDeckId(null);
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                >
                  Evet, Tüm İçeriği ve Kitapları Sil
                </button>
                <button
                  onClick={() => {
                    onDeleteDeck(deleteConfirmDeckId, false);
                    setDeleteConfirmDeckId(null);
                  }}
                  className="w-full py-2.5 bg-[#8B7E66] hover:bg-[#736750] text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                >
                  Hayır, Sadece Desteyi Sil
                </button>
                <button
                  onClick={() => setDeleteConfirmDeckId(null)}
                  className="w-full py-2 bg-stone-300 hover:bg-stone-360 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Custom Backup Restore Confirmation Modal */}
      <AnimatePresence>
        {restoreSession && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-[#F5F2EA] border border-[#D9D1C2] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left text-[#2D2D2A] font-sans"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/15 text-amber-700 rounded-lg border border-amber-200">
                  <Upload className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-[#2D2D2A] text-lg tracking-tight">Kütüphane Yedeğini Geri Yükle</h3>
              </div>
              
              <div className="text-xs text-stone-650 leading-relaxed space-y-1.5">
                <p>Seçtiğiniz <strong>"{restoreSession.fileName}"</strong> yedek dosyası başarıyla okundu.</p>
                <span className="text-amber-800 font-bold block bg-[#FF8A65]/10 p-2.5 rounded-lg border border-[#FF8A65]/35">
                  ⚠️ UYARI: Yedeği geri yüklediğinizde mevcut tüm kitaplığınız, desteleriniz ve okuma geçmişiniz silinip bu dosyadaki verilerle değiştirilecektir. Bu işlem geri alınamaz!
                </span>
              </div>

              <div className="bg-white/60 p-3.5 rounded-xl border border-[#D9D1C2] space-y-2 text-xs font-semibold text-stone-700">
                <div className="flex justify-between">
                  <span>Kitap Sayısı:</span>
                  <span className="text-[#8B7E66] font-extrabold">{restoreSession.booksCount} adet</span>
                </div>
                <div className="flex justify-between border-t border-[#D9D1C2]/30 pt-2">
                  <span>Deste (Kategori) Sayısı:</span>
                  <span className="text-[#8B7E66] font-extrabold">{restoreSession.decksCount} adet</span>
                </div>
                <div className="flex justify-between border-t border-[#D9D1C2]/30 pt-2">
                  <span>Kaydedilen Notlar:</span>
                  <span className="text-emerald-700 font-extrabold">{restoreSession.notesCount} adet</span>
                </div>
                <div className="flex justify-between border-t border-[#D9D1C2]/30 pt-2">
                  <span>Metin & Tema Ayarları:</span>
                  <span className="text-indigo-700 font-extrabold">{restoreSession.hasSettings ? 'Mevcut (Dahil)' : 'Varsayılan'}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  onClick={handleConfirmRestore}
                  className="w-full sm:order-2 py-2.5 bg-amber-700 hover:bg-amber-805 text-white font-extrabold rounded-xl text-xs transition-colors shadow-md cursor-pointer"
                >
                  Onayla ve Geri Yükle
                </button>
                <button
                  onClick={() => setRestoreSession(null)}
                  className="w-full sm:order-1 py-2.5 bg-white hover:bg-stone-100 border border-[#D9D1C2] text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled Custom Error Notification Modal */}
      <AnimatePresence>
        {restoreError && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-[#F5F2EA] border border-[#D9D1C2] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left text-[#2D2D2A] font-sans"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-lg border border-rose-200">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-[#2D2D2A] text-base tracking-tight">Yükleme Hatası</h3>
              </div>
              
              <p className="text-xs text-rose-700 font-bold leading-relaxed bg-rose-50/50 p-3 rounded-lg border border-rose-200">
                {restoreError}
              </p>

              <button
                onClick={() => setRestoreError(null)}
                className="w-full py-2 bg-[#8B7E66] hover:bg-[#736750] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Tamam
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled Custom Success Notification Modal */}
      <AnimatePresence>
        {showRestoreSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-[#F5F2EA] border border-[#D9D1C2] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left text-[#2D2D2A] font-sans"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
                  <ClipboardCheck className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base tracking-tight">Başarılı</h3>
              </div>
              
              <p className="text-xs text-stone-650 leading-relaxed">
                Tebrikler! Kütüphane yedek dosyası başarıyla çözümlendi ve tüm verileriniz geri yüklendi.
              </p>

              <button
                onClick={() => setShowRestoreSuccess(false)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Harika
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Custom Add Deck Modal */}
      <AnimatePresence>
        {showAddDeck && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-[#F5F2EA] border border-[#D9D1C2] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left text-[#2D2D2A] font-sans"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 text-amber-800 rounded-lg border border-amber-200/50">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-[#2D2D2A] text-lg tracking-tight">Yeni Deste Ekle</h3>
              </div>
              
              <form onSubmit={handleNewDeckSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-600 block">Deste Adı</label>
                  <input
                    type="text"
                    placeholder="Seçkin kitaplarınız için deste adı yazın..."
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2.5 border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B7E66] bg-white text-stone-850"
                    autoFocus
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewDeckName('');
                      setShowAddDeck(false);
                    }}
                    className="w-1/2 py-2 bg-white hover:bg-stone-100 border border-[#D9D1C2] text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2 bg-[#8B7E66] hover:bg-[#736750] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Deste Ekle
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Storage & Backup Modal */}
      <AnimatePresence>
        {showStorageModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-[#F5F2EA] border border-[#D9D1C2] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-left font-sans"
            >
              <div className="flex items-center justify-between border-b border-[#D9D1C2]/45 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#8B7E66]/10 text-[#8B7E66] rounded-lg border border-[#8B7E66]/20">
                    <Download className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-[#2D2D2A] text-lg tracking-tight">Depolama ve Yedek Yönetimi</h3>
                </div>
                <button
                  onClick={() => setShowStorageModal(false)}
                  className="p-1.5 hover:bg-stone-200 rounded-lg cursor-pointer text-stone-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5 p-3.5 bg-white/60 rounded-xl border border-[#D9D1C2]/60">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#8B7E66]" />
                    Android & Web Çevrimdışı Depolama
                  </h4>
                  <p className="text-[11px] text-stone-650 leading-relaxed">
                    Tüm yüklü kitaplarınız ve ayarlarınız tarayıcınızın veya uygulamanızın güvenli hafızasında (IndexedDB) saklanmaktadır.
                    <span className="block mt-1 font-semibold text-[#8B7E66]">
                      APK sürümünde dosya indirme kısıtlamaları olabileceğinden, "Yedek Kodu Kopyala" seçeneğini kullanarak yedeğinizi kopyalayabilir ve "Kodu Yapıştır" butonu ile geri yükleyebilirsiniz.
                    </span>
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider block">1. Kitaplığı Yedekle</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        handleBackupAllData();
                      }}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      title="Yedek dosyasını indir"
                    >
                      <Download className="w-3.5 h-3.5" /> Dosya İndir
                    </button>

                    <button
                      onClick={handleCopyBackupToClipboard}
                      className={`py-2 px-3 ${copiedSuccess ? 'bg-teal-600' : 'bg-stone-600 hover:bg-stone-700'} text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs`}
                      title="Yedekleme kodunu panoya kopyalar"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> 
                      {copiedSuccess ? 'Kod Kopyalandı!' : 'Yedek Kodu Kopyala'}
                    </button>

                    {navigator.share && (
                      <button
                        onClick={handleShareBackup}
                        className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs sm:col-span-2"
                        title="Sistem paylaşımı ile gönder"
                      >
                        <Upload className="w-3.5 h-3.5" /> Sistem Paylaşımı
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#D9D1C2]/50">
                  <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider block">2. Geri Yükle</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="py-2 px-3 bg-[#8B7E66] hover:bg-[#786c55] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs relative text-center">
                      <Upload className="w-3.5 h-3.5" /> Dosya Yükle
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          handleRestoreAllData(e);
                          setShowStorageModal(false);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-[0px]"
                      />
                    </label>

                    <button
                      onClick={() => setShowPasteArea(!showPasteArea)}
                      className="py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      title="Kodu yapıştır"
                    >
                      <Plus className="w-3.5 h-3.5" /> Kodu Yapıştır
                    </button>
                  </div>
                </div>

                {/* Paste Area inside modal */}
                {showPasteArea && (
                  <div className="border border-amber-200 bg-amber-50/50 p-3 rounded-xl space-y-2.5 mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <span className="text-xs font-extrabold text-amber-850 block">Yedekleme Kodunu Yapıştırın:</span>
                    <textarea
                      value={pastedJson}
                      onChange={(e) => setPastedJson(e.target.value)}
                      placeholder='{"version": "1.0", "books": [...]}'
                      className="w-full h-24 p-2.5 border border-[#D9D1C2] rounded-xl text-xs font-mono bg-white focus:outline-hidden"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setShowPasteArea(false);
                          setPastedJson('');
                        }}
                        className="px-2.5 py-1 bg-white border border-[#D9D1C2] text-stone-600 rounded-lg text-[10px] font-bold hover:bg-stone-50 cursor-pointer"
                      >
                        Vazgeç
                      </button>
                      <button
                        onClick={() => {
                          handleRestoreFromText(pastedJson);
                          setShowStorageModal(false);
                        }}
                        disabled={!pastedJson.trim()}
                        className="px-3.5 py-1 bg-[#8B7E66] text-white rounded-lg text-[10px] font-bold hover:bg-[#786c55] disabled:opacity-40 cursor-pointer"
                      >
                        Yükle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
