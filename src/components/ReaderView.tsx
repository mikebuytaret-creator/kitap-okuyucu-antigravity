/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Bookmark, 
  Settings, 
  List, 
  BookOpen, 
  Layers,
  Search,
  X,
  Minus,
  Plus,
  AlignJustify,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Edit3,
  ArrowDownUp,
  Trash2,
  FileEdit,
  Timer,
  MoreVertical
} from 'lucide-react';
import { Book, Page, Deck } from '../types';
import { READING_THEMES, LATIN_FONTS, ARABIC_FONTS } from '../constants';
import BookSettingsModal from './BookSettingsModal';
import EditPageModal from './EditPageModal';
import MiniCounter from './MiniCounter';
import { normalizeText, findNormalizedMatches, ARABIC_SEPARATOR_REGEX, isArabicSeparator } from '../utils';

interface ReaderViewProps {
  book: Book;
  onBack: () => void;
  onUpdateBook: (updatedBook: Book) => void;
  initialPageNum?: string | number;
  allBooks?: Book[];
  allDecks?: Deck[];
  onRestoreBackup?: (books: Book[], decks: Deck[]) => void;
}

export default function ReaderView({ 
  book, 
  onBack, 
  onUpdateBook, 
  initialPageNum,
  allBooks,
  allDecks,
  onRestoreBackup
}: ReaderViewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [hasSetInitial, setHasSetInitial] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPagesDrawerOpen, setIsPagesDrawerOpen] = useState(false);
  const [isEditPageModalOpen, setIsEditPageModalOpen] = useState(false);
  const [isCounterOpen, setIsCounterOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // States for search & highlighting
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);
  const [notesSearchQuery, setNotesSearchQuery] = useState('');
  const [notesSortOrder, setNotesSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  const [noteActionMenu, setNoteActionMenu] = useState<{id: string, title: string, content: string, createdAt: number} | null>(null);
  const [editingNote, setEditingNote] = useState<{id: string, title: string, content: string} | null>(null);

  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [pagesSearchQuery, setPagesSearchQuery] = useState('');

  const handleSaveEditedNote = () => {
    if (!editingNote || !editingNote.title.trim()) return;
    onUpdateBook({
      ...book,
      notes: book.notes?.map(n => n.id === editingNote.id ? { ...n, title: editingNote.title, content: editingNote.content } : n)
    });
    setEditingNote(null);
  };

  // States for quick settings panel
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const quickSettingsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const noteLongPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const noteLongPressTriggeredRef = useRef<boolean>(false);

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

  // States for inline custom font size text fields
  const [editingArabicSize, setEditingArabicSize] = useState(false);
  const [editingTurkishSize, setEditingTurkishSize] = useState(false);
  const [tempArabicSize, setTempArabicSize] = useState('');
  const [tempTurkishSize, setTempTurkishSize] = useState('');

  // Close tools menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    if (isToolsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isToolsMenuOpen]);

  // Hardware Back Button Interception for Modals in Reader
  useEffect(() => {
    const handleHardwareBack = (e: any) => {
      const markHandled = () => {
        if (e.detail && typeof e.detail.setHandled === 'function') {
          e.detail.setHandled();
        }
        e.preventDefault();
      };

      // Prioritize closing the topmost overlays first
      if (isNotesOpen) {
        setIsNotesOpen(false);
        markHandled();
        return;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        markHandled();
        return;
      }
      if (showExitConfirm) {
        setShowExitConfirm(false);
        markHandled();
        return;
      }
      if (isPagesDrawerOpen) {
        setIsPagesDrawerOpen(false);
        markHandled();
        return;
      }
      if (showQuickSettings) {
        setShowQuickSettings(false);
        markHandled();
        return;
      }
      if (isSearchOpen) {
        setIsSearchOpen(false);
        markHandled();
        return;
      }

      // No modal open, trigger App exit attempt
      markHandled(); // Stop App.tsx from forcefully skipping
      
      const hookPages = book.pages || [];
      const hookCurrentPage = hookPages[currentPageIndex] || hookPages[0];

      if (hookCurrentPage && String(hookCurrentPage.page) !== String(book.bookmark)) {
        setShowExitConfirm(true);
      } else {
        onBack();
      }
    };

    window.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => window.removeEventListener('hardwareBackPress', handleHardwareBack);
  }, [
    isSettingsOpen, 
    isNotesOpen,
    showExitConfirm, 
    isPagesDrawerOpen, 
    showQuickSettings, 
    isSearchOpen,
    currentPageIndex,
    book.pages,
    book.bookmark,
    onBack
  ]);

  const startQuickSettingsTimer = () => {
    if (quickSettingsTimerRef.current) {
      clearTimeout(quickSettingsTimerRef.current);
    }
    quickSettingsTimerRef.current = setTimeout(() => {
      setShowQuickSettings(false);
    }, 6000);
  };

  const handleQuickSettingsInteraction = () => {
    startQuickSettingsTimer();
  };

  useEffect(() => {
    return () => {
      if (quickSettingsTimerRef.current) {
        clearTimeout(quickSettingsTimerRef.current);
      }
      if (noteLongPressTimeoutRef.current) {
        clearTimeout(noteLongPressTimeoutRef.current);
      }
    };
  }, []);

  const { pages, settings } = book;
  const baseTheme = READING_THEMES.find(t => t.id === settings.themeId) || READING_THEMES[0];
  const currentTheme = settings.customThemeColor ? {
    ...baseTheme,
    bgHex: settings.customThemeColor,
    bgColor: '',
  } : baseTheme;

  // Local font size states to avoid heavy global react saves during drag gestures & wheel zooms
  const [localArabicFontSize, setLocalArabicFontSize] = useState(settings.arabic.fontSize);
  const [localTurkishFontSize, setLocalTurkishFontSize] = useState(settings.turkish.fontSize);

  useEffect(() => {
    setLocalArabicFontSize(settings.arabic.fontSize);
  }, [settings.arabic.fontSize]);

  useEffect(() => {
    setLocalTurkishFontSize(settings.turkish.fontSize);
  }, [settings.turkish.fontSize]);

  const lastArabicSizeRef = useRef(settings.arabic.fontSize);
  const lastTurkishSizeRef = useRef(settings.turkish.fontSize);

  useEffect(() => {
    lastArabicSizeRef.current = localArabicFontSize;
  }, [localArabicFontSize]);

  useEffect(() => {
    lastTurkishSizeRef.current = localTurkishFontSize;
  }, [localTurkishFontSize]);

  const adjustFontSize = (lang: 'arabic' | 'turkish', delta: number) => {
    const currentSize = lang === 'arabic' ? localArabicFontSize : localTurkishFontSize;
    const newSize = Math.max(10, Math.min(70, currentSize + delta));
    
    if (lang === 'arabic') {
      setLocalArabicFontSize(newSize);
    } else {
      setLocalTurkishFontSize(newSize);
    }

    onUpdateBook({
      ...book,
      settings: {
        ...settings,
        [lang]: {
          ...settings[lang],
          fontSize: newSize
        }
      }
    });
    handleQuickSettingsInteraction();
  };

  // References for touch/wheel pinching
  const arabicRef = useRef<HTMLDivElement>(null);
  const turkishRef = useRef<HTMLDivElement>(null);

  const renderHighlightedText = (text: string, query: string, isArabic = false) => {
    if (!query.trim() || !text) return text;
    
    // Find start/end match offsets using fuzzy/flexible normalization mapper
    const matches = findNormalizedMatches(text, query);
    if (matches.length === 0) return text;
    
    matches.sort((a, b) => a.start - b.start);
    const mergedMatches: { start: number; end: number }[] = [];
    let current = matches[0];
    for (let i = 1; i < matches.length; i++) {
      const next = matches[i];
      if (next.start < current.end) {
        current.end = Math.max(current.end, next.end);
      } else {
        mergedMatches.push(current);
        current = next;
      }
    }
    mergedMatches.push(current);
    
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    
    const highlightBg = isArabic 
      ? 'bg-emerald-200 text-emerald-950 font-bold px-0.5 rounded shadow-xs' 
      : 'bg-amber-200 text-stone-900 font-bold px-0.5 rounded shadow-xs';
      
    mergedMatches.forEach((m, idx) => {
      if (m.start > lastIndex) {
        result.push(text.slice(lastIndex, m.start));
      }
      result.push(
        <mark key={idx} className={highlightBg}>
          {text.slice(m.start, m.end)}
        </mark>
      );
      lastIndex = m.end;
    });
    
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }
    
    return <>{result}</>;
  };

  const renderArabicWithSeparators = (text: string, sepColor: string = '#d97706', query: string = '') => {
    if (!text) return null;
    const parts = text.split(ARABIC_SEPARATOR_REGEX);
    return (
      <>
        {parts.map((part, idx) => {
          if (!part) return null;
          if (isArabicSeparator(part)) {
            return (
              <span
                key={`sep-${idx}`}
                className="arabic-separator inline-block mx-1 font-bold select-none cursor-default transition-colors duration-150"
                style={{ color: sepColor }}
              >
                {part}
              </span>
            );
          }
          return (
            <React.Fragment key={`text-${idx}`}>
              {query ? renderHighlightedText(part, query, true) : part}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  const splitTextIntoSentenceLines = (text: string, isArabic: boolean): string[] => {
    if (!text) return [];

    // Split by user's explicit manual line breaks first
    const rawLines = text.split(/\r?\n/);
    const result: string[] = [];

    rawLines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        result.push('');
        return;
      }

      if (isArabic) {
        // For Arabic: split after verse separators (۝, (١), ﴿١﴾, etc.) if lineByLine is enabled
        const parts = trimmed.split(/(?<=(?:۝[\u0660-\u0669\u06F0-\u06F9\d]*|[﴿﴾\(\[\{][\s]*[\u0660-\u0669\u06F0-\u06F9\d]+[\s]*[﴿﴾\)\]\}]|[\u2460-\u24FF\u3251-\u32BF]|[۞۩❖✦✧♦★✪]))\s+/gu);
        parts.forEach(p => {
          if (p.trim()) result.push(p.trim());
        });
      } else {
        // For Turkish/Latin: split after sentence-ending punctuation (.!?) followed by space
        const parts = trimmed.split(/(?<=[.!?…])\s+/g);
        parts.forEach(p => {
          if (p.trim()) result.push(p.trim());
        });
      }
    });

    return result;
  };

  const renderFormattedText = (
    text: string, 
    isArabic = false, 
    textAlign?: 'left' | 'center' | 'right' | 'justify',
    lineHeight?: number
  ) => {
    if (!text) return null;
    const sepColor = settings.arabic.separatorColor || '#d97706';
    const isLineByLine = !!settings.lineByLine;
    const customLineHeight = lineHeight || (isArabic ? 2.4 : 1.75);

    const renderContent = (content: string) => {
      if (isArabic) {
        return renderArabicWithSeparators(content, sepColor, pageSearchQuery);
      }
      return renderHighlightedText(content, pageSearchQuery, false);
    };

    if (isLineByLine) {
      // Line-by-line sentence mode: each sentence / verse is rendered on its own stacked line!
      const sentences = splitTextIntoSentenceLines(text, isArabic);
      const alignClass = textAlign === 'center' 
        ? 'text-center' 
        : textAlign === 'left' 
        ? 'text-left' 
        : textAlign === 'right' 
        ? 'text-right' 
        : 'text-justify';

      return (
        <div className="space-y-2 py-0.5">
          {sentences.map((sentence, idx) => {
            if (!sentence.trim()) return <div key={idx} className="h-1.5" />;
            return (
              <p
                key={idx}
                className={alignClass}
                style={{ 
                  direction: isArabic ? 'rtl' : 'ltr',
                  lineHeight: customLineHeight
                }}
              >
                {renderContent(sentence)}
              </p>
            );
          })}
        </div>
      );
    }

    // Normal mode: preserves manual newlines entered by user!
    const manualLines = text.split(/\r?\n/);
    const alignClass = textAlign === 'center' 
      ? 'text-center' 
      : textAlign === 'left' 
      ? 'text-left' 
      : textAlign === 'right' 
      ? 'text-right' 
      : 'text-justify';

    return (
      <div className="space-y-1.5 py-0.5">
        {manualLines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-2" />;
          return (
            <p
              key={idx}
              className={`${alignClass} ${isArabic || textAlign === 'center' || textAlign === 'right' ? '' : idx === 0 ? 'indent-6 sm:indent-8' : ''}`}
              style={{ 
                direction: isArabic ? 'rtl' : 'ltr',
                lineHeight: customLineHeight
              }}
            >
              {renderContent(line.trim())}
            </p>
          );
        })}
      </div>
    );
  };

  const handleSavePageFromReader = (pageIndex: number, updatedPage: Page) => {
    const updatedPages = [...pages];
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

  const handleDeletePageFromReader = (pageIndex: number) => {
    const updatedPages = pages.filter((_, idx) => idx !== pageIndex);
    if (updatedPages.length === 0) {
      onBack();
      return;
    }
    
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

    if (currentPageIndex >= updatedPages.length) {
      setCurrentPageIndex(Math.max(0, updatedPages.length - 1));
    }
  };

  const handleInsertPageFromReader = (insertIndex: number, newPage: Page) => {
    const updatedPages = [...pages];
    updatedPages.splice(insertIndex, 0, newPage);

    const detected = new Set<'turkish' | 'arabic'>(book.detectedLanguages);
    if (newPage.turkish && newPage.turkish.trim()) detected.add('turkish');
    if (newPage.arabic && newPage.arabic.trim()) detected.add('arabic');

    onUpdateBook({
      ...book,
      pages: updatedPages,
      detectedLanguages: Array.from(detected)
    });

    setCurrentPageIndex(insertIndex);
  };

  // Set initial page index once on load
  useEffect(() => {
    if (pages.length > 0 && !hasSetInitial) {
      // Prioritize: initialPageNum, book.bookmark, or first page
      const targetPageNum = initialPageNum !== undefined ? initialPageNum : (book.bookmark || pages[0].page);
      const idx = pages.findIndex(p => String(p.page) === String(targetPageNum));
      if (idx !== -1) {
        setCurrentPageIndex(idx);
      } else {
        setCurrentPageIndex(0);
      }
      setHasSetInitial(true);
    }
  }, [initialPageNum, pages, book.bookmark, hasSetInitial]);

  // Handle Ctrl + Scroll Wheel Zooming
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const readerContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleRawWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const langElement = target.closest('[data-lang]');
      const lang = langElement ? langElement.getAttribute('data-lang') as 'arabic' | 'turkish' : null;
      
      if (e.ctrlKey && lang) {
        e.preventDefault();
        const delta = e.deltaY;
        const scaleFactor = delta > 0 ? -1 : 1;
        
        const currentSize = lang === 'arabic' ? lastArabicSizeRef.current : lastTurkishSizeRef.current;
        const newSize = Math.max(10, Math.min(70, currentSize + scaleFactor));
        
        if (lang === 'arabic') {
          setLocalArabicFontSize(newSize);
        } else {
          setLocalTurkishFontSize(newSize);
        }

        if (wheelTimeoutRef.current) {
          clearTimeout(wheelTimeoutRef.current);
        }
        wheelTimeoutRef.current = setTimeout(() => {
          onUpdateBook({
            ...book,
            settings: {
              ...settings,
              [lang]: {
                ...settings[lang],
                fontSize: newSize
              }
            }
          });
        }, 250);
      }
    };

    const containerEl = readerContentRef.current;

    if (containerEl) {
      containerEl.addEventListener('wheel', handleRawWheel, { passive: false });
    }

    return () => {
      if (containerEl) {
        containerEl.removeEventListener('wheel', handleRawWheel);
      }
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, [book, settings, onUpdateBook]);

  // Synchronize document.body styling with selected reading theme instantly
  useEffect(() => {
    const oldBg = document.body.style.backgroundColor;
    const oldTransition = document.body.style.transition;
    
    // Grant immediate, fast color response
    document.body.style.transition = 'background-color 75ms ease-out';
    if (currentTheme.bgHex) {
      document.body.style.backgroundColor = currentTheme.bgHex;
    }
    
    return () => {
      document.body.style.backgroundColor = oldBg;
      document.body.style.transition = oldTransition;
    };
  }, [currentTheme]);

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <BookOpen className="w-16 h-16 text-slate-300 mb-4 animate-pulse" />
        <p className="text-slate-600 font-semibold mb-2">Bu kitapta henüz sayfa bulunmuyor.</p>
        <p className="text-slate-400 text-xs mb-4">Lütfen öncelikle girdi kısmından sayfa eklemek için JSON içe aktarın.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          Geri Dön
        </button>
      </div>
    );
  }

  const currentPage = pages[currentPageIndex] || pages[0];
  const totalPages = pages.length;
  // "Sureler" is defined locally as a continuous scroll deck
  const isContinuous = book.deckId === 'deck_sureler';

  // Use lenient string conversion for safety on mixed page keys
  const isBookmarked = book.bookmark !== null && String(book.bookmark) === String(currentPage.page);

  useEffect(() => {
    if (!isContinuous) return;
    
    // Smooth check when scrolling through continuous layout
    const observer = new IntersectionObserver((entries) => {
      let mostVisible = null;
      let maxRatio = 0;
      entries.forEach(entry => {
        if (entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          mostVisible = entry.target;
        }
      });

      if (mostVisible) {
        const idxStr = (mostVisible as HTMLElement).getAttribute('data-index');
        if (idxStr !== null) {
          const idx = Number(idxStr);
          if (!isNaN(idx) && idx !== currentPageIndex) {
            setCurrentPageIndex(idx);
          }
        }
      }
    }, { threshold: [0.1, 0.4, 0.6, 0.8] });

    pages.forEach((p, idx) => {
      const el = document.getElementById(`continuous-page-${idx}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isContinuous, pages, currentPageIndex]);

  // Jump to loaded bookmark on mount if continuous
  useEffect(() => {
    if (isContinuous && hasSetInitial) {
      if (initialPageNum !== undefined || book.bookmark !== null) {
         // Attempt to find the index and scroll to it slightly after mount
         const target = initialPageNum !== undefined ? initialPageNum : book.bookmark;
         const idx = pages.findIndex(p => String(p.page) === String(target));
         if (idx !== -1) {
             const el = document.getElementById(`continuous-page-${idx}`);
             if (el) {
                 setTimeout(() => {
                     el.scrollIntoView({ behavior: 'instant', block: 'start' });
                 }, 50);
             }
         }
      }
    }
  }, [isContinuous, hasSetInitial]);

  const handleToggleBookmark = () => {
    const newBookmark = isBookmarked ? null : currentPage.page;
    onUpdateBook({
      ...book,
      bookmark: newBookmark
    });
  };

  // Safe checks if bookmark/page numbers is changed on exit
  const handleBackAttempt = () => {
    if (String(currentPage.page) !== String(book.bookmark)) {
      setShowExitConfirm(true);
    } else {
      onBack();
    }
  };

  const handleNextPage = () => {
    if (isContinuous) {
      if (currentPageIndex < totalPages - 1) {
        const el = document.getElementById(`continuous-page-${currentPageIndex + 1}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      if (currentPageIndex < totalPages - 1) {
        setCurrentPageIndex(prev => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handlePrevPage = () => {
    if (isContinuous) {
      if (currentPageIndex > 0) {
        const el = document.getElementById(`continuous-page-${currentPageIndex - 1}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      if (currentPageIndex > 0) {
        setCurrentPageIndex(prev => prev - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleJumpToPage = (pageNum: string | number) => {
    const idx = pages.findIndex(p => String(p.page) === String(pageNum));
    if (idx !== -1) {
      if (isContinuous) {
        setIsPagesDrawerOpen(false);
        const el = document.getElementById(`continuous-page-${idx}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        setCurrentPageIndex(idx);
        setIsPagesDrawerOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const hasArabic = book.detectedLanguages.includes('arabic') && currentPage.arabic;
  const hasTurkish = book.detectedLanguages.includes('turkish') && currentPage.turkish;

  const renderPageContent = (page: Page, idx: number) => {
    const pHasArabic = book.detectedLanguages.includes('arabic') && page.arabic && page.arabic.trim().length > 0;
    const pHasTurkish = book.detectedLanguages.includes('turkish') && page.turkish && page.turkish.trim().length > 0;

    return (
      <div 
        key={`page-${idx}-${page.page}`} 
        id={isContinuous ? `continuous-page-${idx}` : undefined} 
        data-index={idx}
        className=""
      >
        {/* 1. ARABIC DISPLAY (TOP) */}
        {pHasArabic ? (
          <div 
            data-lang="arabic"
            className={`break-words py-1 whitespace-normal transition-[font-size] duration-75 select-none touch-pan-y bg-black/0 rounded-xl px-2 ${settings.arabic.fontFamily}`}
            style={{ 
              fontSize: `${localArabicFontSize}px`, 
              color: settings.arabic.textColor,
              direction: 'rtl',
              textAlign: settings.arabic.textAlign || 'justify',
              textJustify: (settings.arabic.textAlign === 'justify' || !settings.arabic.textAlign) ? 'inter-word' : undefined,
              wordSpacing: (settings.arabic.textAlign === 'justify' || !settings.arabic.textAlign) ? 'normal' : undefined,
              lineHeight: settings.arabic.lineHeight || 2.4,
            }}
          >
            {renderFormattedText(page.arabic || '', true, settings.arabic.textAlign, settings.arabic.lineHeight)}
          </div>
        ) : (
          book.detectedLanguages.includes('arabic') && (
            <div className="text-right italic opacity-35 text-[11px] font-mono">
              [Bu sayfada Arapça metin bulunmuyor]
            </div>
          )
        )}

        {/* Separation Divider if both languages are present on current page */}
        {pHasArabic && pHasTurkish && !isContinuous && (
          <div className="flex items-center justify-center py-2">
            <span className="w-16 h-[1px] bg-[#8B7E66]/25"></span>
            <span className="mx-2 text-[#8B7E66]/40 text-xs">✦</span>
            <span className="w-16 h-[1px] bg-[#8B7E66]/25"></span>
          </div>
        )}

        {/* 2. TURKISH DISPLAY (UNDERNEATH) */}
        {pHasTurkish ? (
          <div 
            data-lang="turkish"
            className={`break-words py-1 whitespace-normal transition-[font-size] duration-75 select-text touch-pan-y bg-black/0 rounded-xl px-2 ${settings.turkish.fontFamily}`}
            style={{ 
              fontSize: `${localTurkishFontSize}px`, 
              color: settings.turkish.textColor,
              textAlign: settings.turkish.textAlign || 'justify',
              textJustify: (settings.turkish.textAlign === 'justify' || !settings.turkish.textAlign) ? 'inter-word' : undefined,
              lineHeight: settings.turkish.lineHeight || 1.75,
            }}
          >
            {renderFormattedText(page.turkish || '', false, settings.turkish.textAlign, settings.turkish.lineHeight)}
          </div>
        ) : (
          book.detectedLanguages.includes('turkish') && (
            <div className="text-left italic opacity-35 text-[11px] font-mono">
              [Bu sayfada Türkçe metin bulunmuyor]
            </div>
          )
        )}
        
        {isContinuous && idx < pages.length - 1 && (
          <div className="py-2 flex items-center justify-center opacity-70">
            <div className="flex items-center gap-2 text-[#8B7E66]">
              <span className="w-24 sm:w-32 h-[1px] rounded-full bg-gradient-to-r from-transparent to-[#8B7E66]"></span>
              <span className="text-lg">۞</span>
              <span className="w-24 sm:w-32 h-[1px] rounded-full bg-gradient-to-l from-transparent to-[#8B7E66]"></span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`min-h-[100dvh] transition-all duration-75 flex flex-col pb-24 overflow-x-hidden max-w-full ${currentTheme.bgColor || ''}`}
      style={{ backgroundColor: currentTheme.bgHex }}
    >
      
      {/* Top Floating bar */}
      <header className={`sticky top-0 z-40 backdrop-blur-md bg-white/35 border-b border-[#D9D1C2]/60 ${currentTheme.textColor} px-3 sm:px-4 pb-3 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:pt-[calc(0.75rem+env(safe-area-inset-top))] flex flex-col gap-2.5 shadow-xs w-full max-w-full overflow-hidden`}>
        <div className="flex items-center justify-between w-full gap-2">
          {/* Left section: Back button & Title (flex-1 to take available space and truncate gracefully) */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              id="reader-back-btn"
              onClick={handleBackAttempt}
              className="p-2 sm:p-2.5 rounded-xl bg-white/40 border border-[#D9D1C2]/40 hover:bg-white/70 hover:border-[#8B7E66] text-[#8B7E66] transition-all cursor-pointer shrink-0"
              title="Kitaptan Çık"
            >
              <ArrowLeft className="w-5 h-5 sm:w-[22px] sm:h-[22px]" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold text-xs sm:text-sm tracking-tight truncate" title={book.title}>
                {book.title}
              </h2>
              <p className="text-[10px] font-mono font-bold opacity-75 text-stone-600 truncate">
                Sayfa {currentPage.page} / {pages[totalPages - 1].page}
              </p>
            </div>
          </div>

          {/* Quick buttons section: Bookmark & Notes always visible, others inside 3-dots on mobile */}
          <div className="flex items-center gap-1 sm:gap-1.5 font-sans shrink-0">
            {/* Bookmark Button (Always Visible) */}
            <button
              id="reader-bookmark-btn"
              onClick={handleToggleBookmark}
              className={`p-2 sm:p-2.5 rounded-xl border transition-all relative cursor-pointer ${
                isBookmarked 
                  ? 'bg-[#FF8A65]/20 border-[#FF8A65] text-[#FF8A65] scale-105 shadow-xs' 
                  : 'bg-white/40 border-[#D9D1C2]/40 hover:bg-white/70 text-stone-500'
              }`}
              title={isBookmarked ? "Ayraç Kaldır" : "Buraya Ayraç Koy"}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-[#FF8A65]' : ''}`} />
              {isBookmarked && (
                <span className="absolute -top-1 -right-1 bg-[#FF8A65] text-white text-[7px] px-1 rounded-full animate-ping">
                  ●
                </span>
              )}
            </button>

            {/* Notes Button (Always Visible) */}
            <button
              id="reader-notes-btn"
              onClick={() => setIsNotesOpen(true)}
              className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer ${
                isNotesOpen
                  ? 'bg-[#8B7E66]/25 border-[#8B7E66] text-[#8B7E66] scale-105' 
                  : 'bg-white/40 border-[#D9D1C2]/40 hover:bg-white/70 text-stone-600'
              }`}
              title="Notlarım"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {/* Desktop Only buttons (Search, Pages Drawer, Edit Page, Counter) */}
            <div className="hidden md:flex items-center gap-1.5">
              {/* In-page Word Search */}
              <button
                id="reader-search-toggle-btn"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSearchOpen 
                    ? 'bg-[#8B7E66]/25 border-[#8B7E66] text-[#8B7E66] scale-105' 
                    : 'bg-white/40 border-[#D9D1C2]/40 hover:bg-white/70 text-stone-600'
                }`}
                title="Sayfa İçi Kelime Ara"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Pages drawer */}
              <button
                id="reader-pages-drawer-btn"
                onClick={() => setIsPagesDrawerOpen(true)}
                className="p-2.5 rounded-xl bg-white/40 border border-[#D9D1C2]/40 hover:bg-white/70 text-stone-600 hover:border-[#8B7E66] transition-all cursor-pointer"
                title="Tüm Sayfalar"
              >
                <Layers className="w-4 h-4" />
              </button>

              {/* Edit Page */}
              <button
                id="reader-edit-page-btn"
                onClick={() => setIsEditPageModalOpen(true)}
                className="p-2.5 rounded-xl bg-white/40 border border-[#D9D1C2]/40 hover:bg-white/70 hover:border-[#8B7E66] text-stone-600 hover:text-[#8B7E66] transition-all cursor-pointer"
                title="Bu Sayfayı Düzenle / Araya Ekle"
              >
                <FileEdit className="w-4 h-4" />
              </button>

              {/* Counter */}
              <button
                id="reader-counter-btn"
                onClick={() => setIsCounterOpen(prev => !prev)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isCounterOpen 
                    ? 'bg-[#8B7E66]/25 border-[#8B7E66] text-[#8B7E66] scale-105' 
                    : 'bg-white/40 border-[#D9D1C2]/40 hover:bg-white/70 text-stone-600'
                }`}
                title="Mini Sayaç (Zaman & Aralık Ölçer)"
              >
                <Timer className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile "More Tools" (3 Dots / ⋯) Dropdown Menu */}
            <div className="relative md:hidden" ref={toolsMenuRef}>
              <button
                id="reader-more-tools-btn"
                onClick={() => setIsToolsMenuOpen(prev => !prev)}
                className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isToolsMenuOpen || isSearchOpen || isCounterOpen
                    ? 'bg-[#8B7E66]/25 border-[#8B7E66] text-[#8B7E66]' 
                    : 'bg-white/40 border-[#D9D1C2]/40 hover:bg-white/70 text-stone-600'
                }`}
                title="Diğer Araçlar"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {isToolsMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-white/95 backdrop-blur-md rounded-2xl border border-[#D9D1C2] shadow-xl p-1.5 z-50 flex flex-col gap-0.5 text-stone-700"
                  >
                    {/* Kelime Ara */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(prev => !prev);
                        setIsToolsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold hover:bg-[#8B7E66]/10 hover:text-[#8B7E66] transition text-left cursor-pointer"
                    >
                      <Search className="w-4 h-4 text-[#8B7E66]" />
                      <span>{isSearchOpen ? 'Aramayı Kapat' : 'Sayfada Ara'}</span>
                    </button>

                    {/* Tüm Sayfalar */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsPagesDrawerOpen(true);
                        setIsToolsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold hover:bg-[#8B7E66]/10 hover:text-[#8B7E66] transition text-left cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-[#8B7E66]" />
                      <span>Tüm Sayfalar</span>
                    </button>

                    {/* Sayfayı Düzenle */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditPageModalOpen(true);
                        setIsToolsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold hover:bg-[#8B7E66]/10 hover:text-[#8B7E66] transition text-left cursor-pointer"
                    >
                      <FileEdit className="w-4 h-4 text-[#8B7E66]" />
                      <span>Sayfayı Düzenle</span>
                    </button>

                    {/* Mini Sayaç */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCounterOpen(prev => !prev);
                        setIsToolsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold hover:bg-[#8B7E66]/10 hover:text-[#8B7E66] transition text-left cursor-pointer"
                    >
                      <Timer className="w-4 h-4 text-[#8B7E66]" />
                      <span>{isCounterOpen ? 'Sayacı Kapat' : 'Mini Sayaç'}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* Word Search Bar (Request #1: Sticky, floating, top-anchored layout) */}
        {isSearchOpen && (
          <div className="w-full max-w-xl sm:max-w-2xl mx-auto pb-1 flex items-center gap-2.5 animate-in slide-in-from-top duration-150">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                id="reader-word-search-input"
                type="text"
                placeholder="Bu sayfada kelime ara..."
                value={pageSearchQuery}
                onChange={(e) => setPageSearchQuery(e.target.value)}
                className="w-full text-xs font-semibold pl-9 pr-9 py-2 bg-white border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#8B7E66] text-slate-800"
                autoFocus
              />
              {pageSearchQuery && (
                <button
                  onClick={() => setPageSearchQuery('')}
                  className="absolute inset-y-0 right-1 pr-2.5 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              id="close-word-search-btn"
              onClick={() => {
                setPageSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="p-1.5 rounded-xl bg-white/55 border border-[#D9D1C2] hover:bg-stone-100 text-stone-600 hover:text-stone-800 transition shadow-xs cursor-pointer"
              title="Aramayı Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Pages quick jump drawer */}
      <AnimatePresence>
        {isPagesDrawerOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs" 
            onClick={() => setIsPagesDrawerOpen(false)}
          >
            <motion.div 
              id="pages-jump-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="w-80 max-w-full h-full p-6 shadow-2xl flex flex-col bg-white/95 border-l border-[#D9D1C2]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#D9D1C2]">
                <h3 className="font-extrabold text-sm text-[#8B7E66] flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  Sayfalar Arası Atla
                </h3>
                <button 
                  onClick={() => setIsPagesDrawerOpen(false)}
                  className="px-3 py-1 bg-white/60 border border-[#D9D1C2] text-xs font-bold rounded-lg text-stone-600 hover:bg-white transition-colors cursor-pointer"
                >
                  Kapat
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto py-4">
                <p className="text-xs text-stone-500 font-bold mb-3">Gitmek istediğiniz sayfayı seçin:</p>
                
                {/* Jump drawer search functionality (Request #1) */}
                <div className="relative mb-4">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    id="drawer-pages-search-input"
                    type="text"
                    placeholder="Sayfa no veya kelime ara..."
                    value={pagesSearchQuery}
                    onChange={(e) => setPagesSearchQuery(e.target.value)}
                    className="w-full text-xs font-semibold pl-8.5 pr-8 py-2 bg-white border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#8B7E66]"
                  />
                  {pagesSearchQuery && (
                    <button
                      onClick={() => setPagesSearchQuery('')}
                      className="absolute inset-y-0 right-1 pr-2.5 flex items-center text-stone-405 hover:text-stone-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {(() => {
                  const filteredDrawerPages = pages.filter(p => {
                    const q = pagesSearchQuery.trim();
                    if (!q) return true;
                    
                    const isQueryNumeric = /^\d+$/.test(q);
                    if (isQueryNumeric) {
                      return String(p.page) === q || String(p.page).startsWith(q);
                    }
                    
                    const normQ = normalizeText(q);
                    return String(p.page).includes(normQ) || 
                           normalizeText(p.turkish || '').includes(normQ) || 
                           normalizeText(p.arabic || '').includes(normQ);
                  });

                  if (filteredDrawerPages.length === 0) {
                    return (
                      <div className="py-8 text-center text-xs font-semibold text-stone-550 italic bg-stone-100/50 rounded-xl border border-dashed border-[#D9D1C2]">
                        Bulunamadı
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-4 gap-2">
                      {filteredDrawerPages.map((p) => {
                        const originalIdx = pages.findIndex(op => op.page === p.page);
                        const isCurrent = originalIdx === currentPageIndex;
                        const isPageMarked = book.bookmark !== null && String(book.bookmark) === String(p.page);
                        return (
                          <button
                            key={p.page}
                            id={`drawer-jump-page-${p.page}`}
                            onClick={() => handleJumpToPage(p.page)}
                            className={`py-2 rounded-lg text-center font-mono text-xs font-bold relative transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-[#8B7E66] text-white shadow-md font-extrabold border border-[#8B7E66]'
                                : isPageMarked
                                  ? 'bg-[#FF8A65]/15 text-[#FF8A65] border border-[#FF8A65]'
                                  : 'bg-white/60 border border-[#D9D1C2]/60 hover:bg-white'
                            }`}
                          >
                            {p.page}
                            {isPageMarked && (
                              <span className="absolute -top-1 -right-1 flex w-2.5 h-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF8A65]/70 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF8A65]"></span>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div className="pt-4 border-t border-[#D9D1C2] text-[11px] font-mono text-stone-500 flex justify-between">
                <span>Toplam: {totalPages} sayfa</span>
                <span>Kaldığım yer: {book.bookmark || 'Yok'}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Drawer */}
      <AnimatePresence>
        {isNotesOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs" 
            onClick={() => setIsNotesOpen(false)}
          >
            <motion.div 
              id="notes-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="w-80 max-w-full h-full p-6 shadow-2xl flex flex-col bg-[#F5F2EA] border-l border-[#D9D1C2]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#D9D1C2]">
                <h3 className="font-extrabold text-sm text-[#8B7E66] flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4" />
                  Notlarım
                </h3>
                <button 
                  onClick={() => setIsNotesOpen(false)}
                  className="px-3 py-1 bg-white/60 border border-[#D9D1C2] text-xs font-bold rounded-lg text-stone-600 hover:bg-white transition-colors cursor-pointer"
                >
                  Kapat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {isAddingNote ? (
                  <div className="bg-white/80 p-3 rounded-xl border border-[#8B7E66] shadow-sm flex flex-col gap-2">
                    <textarea
                      placeholder="Not Başlığı (Zorunlu)"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      className="w-full text-sm font-bold text-slate-800 bg-transparent border-b border-[#D9D1C2] pb-1 focus:outline-hidden focus:border-[#8B7E66] resize-none h-16 whitespace-pre-wrap break-words"
                      autoFocus
                    />
                    <textarea
                      placeholder="Not Detayları (İsteğe bağlı)"
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="w-full text-xs text-slate-600 bg-transparent resize-none h-20 focus:outline-hidden whitespace-pre-wrap break-words"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          if (!newNoteTitle.trim()) return;
                          const newNote = {
                            id: `note_${Date.now()}`,
                            title: newNoteTitle.trim(),
                            content: newNoteContent.trim(),
                            createdAt: Date.now()
                          };
                          const updatedNotes = [...(book.notes || []), newNote];
                          onUpdateBook({
                            ...book,
                            notes: updatedNotes
                          });
                          setNewNoteTitle('');
                          setNewNoteContent('');
                          setIsAddingNote(false);
                        }}
                        disabled={!newNoteTitle.trim()}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          newNoteTitle.trim() ? 'bg-[#8B7E66] text-white' : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                        }`}
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingNote(false);
                          setNewNoteTitle('');
                          setNewNoteContent('');
                        }}
                        className="flex-1 py-1.5 bg-white border border-[#D9D1C2] rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-50"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingNote(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-3 border border-dashed border-[#8B7E66] text-[#8B7E66] rounded-xl hover:bg-[#8B7E66]/5 transition-colors cursor-pointer text-xs font-bold"
                  >
                    <Plus className="w-4 h-4" /> Yeni Not Ekle
                  </button>
                )}

                <div className="space-y-3">
                  {(book.notes && book.notes.length > 0) && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          placeholder="Notlarda ara..."
                          value={notesSearchQuery}
                          onChange={(e) => setNotesSearchQuery(e.target.value)}
                          className="w-full text-xs font-medium pl-8 pr-8 py-1.5 border border-[#D9D1C2] rounded-lg focus:outline-hidden focus:border-[#8B7E66] bg-white/60"
                        />
                        {notesSearchQuery && (
                          <button
                            onClick={() => setNotesSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setNotesSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/60 border border-[#D9D1C2] rounded-lg text-xs font-medium text-slate-600 hover:bg-white transition-colors cursor-pointer"
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
                    
                    if (filteredNotes.length === 0 && notesSearchQuery) {
                      return <div className="text-center py-4 text-xs text-stone-500 italic">Not bulunamadı.</div>;
                    }

                    if (filteredNotes.length > 0) {
                      return filteredNotes.map(note => {
                        const isExpanded = expandedNotes.includes(note.id);
                        return (
                          <div 
                            key={note.id} 
                            className="p-3 bg-white border border-[#D9D1C2] rounded-xl shadow-xs relative group cursor-pointer hover:border-[#8B7E66] transition-colors select-none"
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
                                setExpandedNotes(prev => prev.filter(id => id !== note.id));
                              } else {
                                setExpandedNotes(prev => [...prev, note.id]);
                              }
                            }}
                          >
                            <div className="pr-6">
                              <h4 className={`font-bold text-sm text-slate-800 whitespace-pre-wrap break-words leading-snug ${isExpanded ? '' : 'line-clamp-3'}`}>
                                {note.title}
                              </h4>
                              {isExpanded && note.content && (
                                <p className="text-xs text-slate-600 mt-2 pt-2 border-t border-[#D9D1C2]/40 whitespace-pre-wrap break-words">
                                  {note.content}
                                </p>
                              )}
                            </div>
                            <span className="block text-[10px] text-slate-400 mt-2">
                              {new Date(note.createdAt).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        );
                      });
                    } else if (!isAddingNote) {
                      return (
                        <div className="text-center py-8 text-xs text-stone-500 font-medium italic">
                          Henüz hiç not eklemediniz.
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Reading content layout */}
      <main 
        className="flex-1 mx-auto w-full flex flex-col justify-between transition-all duration-300 max-w-none px-3.5 sm:px-6 py-3 sm:py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        {!isContinuous && (
          <div className="grid grid-cols-3 items-center mb-8 pb-4 border-b border-dashed border-[#D9D1C2]/60 w-full">
            <div className="justify-self-start">
              <button
                id="prev-btn-top"
                onClick={handlePrevPage}
                disabled={currentPageIndex === 0}
                className={`flex items-center gap-1 py-1.5 px-3 rounded-xl border border-stone-300 text-[10px] sm:text-xs font-extrabold text-[#8B7E66] bg-white/45 hover:bg-white hover:border-[#8B7E66] transition-all cursor-pointer ${
                  currentPageIndex === 0 
                    ? 'opacity-30 cursor-not-allowed' 
                    : 'active:scale-95 shadow-2xs'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Geri
              </button>
            </div>
            
            <div className="justify-self-center text-center font-mono text-stone-500 text-[10px] sm:text-xs font-bold whitespace-nowrap bg-[#8B7E66]/10 px-3 py-1 rounded-full border border-[#8B7E66]/15">
              SAYFA {currentPage.page} / {pages[totalPages-1].page}
            </div>
            
            <div className="justify-self-end">
              <button
                id="next-btn-top"
                onClick={handleNextPage}
                disabled={currentPageIndex === totalPages - 1}
                className={`flex items-center gap-1 py-1.5 px-3 rounded-xl border border-stone-300 text-[10px] sm:text-xs font-extrabold text-[#8B7E66] bg-white/45 hover:bg-white hover:border-[#8B7E66] transition-all cursor-pointer ${
                  currentPageIndex === totalPages - 1 
                    ? 'opacity-30 cursor-not-allowed' 
                    : 'active:scale-95 shadow-2xs'
                }`}
              >
                İleri <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE TEXT AREA WITH MOUSE SCROLL ZOOM */}
        <div ref={readerContentRef} className="space-y-2 py-4 sm:py-8 flex-1 flex flex-col justify-center">
          {isContinuous ? pages.map((p, idx) => renderPageContent(p, idx)) : renderPageContent(currentPage, currentPageIndex)}
        </div>

        {!isContinuous && (
          <div className="grid grid-cols-3 gap-2.5 items-center mt-8 pt-6 border-t border-dashed border-[#D9D1C2]/60 w-full">
            <div className="justify-self-stretch w-full">
              <button
                id="prev-btn-bottom"
                onClick={handlePrevPage}
                disabled={currentPageIndex === 0}
                className={`flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-stone-300 text-xs sm:text-sm font-extrabold text-[#8B7E66] bg-white/45 hover:bg-white hover:border-[#8B7E66] transition-all cursor-pointer w-full ${
                  currentPageIndex === 0 
                    ? 'opacity-30 cursor-not-allowed' 
                    : 'active:scale-95 shadow-2xs'
                }`}
              >
                <ChevronLeft className="w-4 h-4 shrink-0" /> Geri
              </button>
            </div>
            
            <div className="justify-self-center text-center font-mono text-stone-500 text-[10px] sm:text-xs font-bold whitespace-nowrap bg-[#8B7E66]/10 px-3 py-1 rounded-full border border-[#8B7E66]/15">
              {currentPageIndex + 1} / {totalPages}
            </div>
            
            <div className="justify-self-stretch w-full">
              <button
                id="next-btn-bottom"
                onClick={handleNextPage}
                disabled={currentPageIndex === totalPages - 1}
                className={`flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-stone-300 text-xs sm:text-sm font-extrabold text-[#8B7E66] bg-white/45 hover:bg-white hover:border-[#8B7E66] transition-all cursor-pointer w-full ${
                  currentPageIndex === totalPages - 1 
                    ? 'opacity-30 cursor-not-allowed' 
                    : 'active:scale-95 shadow-2xs'
                }`}
              >
                İleri <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Mini Quick Font Settings Tooltip / Popup (Auto-hidden after 4 seconds of inoperation) */}
      <AnimatePresence>
        {showQuickSettings && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.94, y: 16, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.94, y: 16, x: '-50%' }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={handleQuickSettingsInteraction}
            className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] md:bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 bg-[#FAF8F5]/98 backdrop-blur-xl rounded-3xl border border-[#D9D1C2]/80 shadow-[0_20px_50px_rgba(0,0,0,0.18)] p-3.5 sm:p-4 flex flex-col gap-2.5 select-none w-[345px] sm:w-[385px] max-h-[80vh] overflow-y-auto"
          >
            {/* Header: Title & Close Button */}
            <div className="flex items-center justify-between pb-2 border-b border-[#D9D1C2]/50">
              <div className="flex items-center gap-1.5 text-stone-700">
                <Settings className="w-3.5 h-3.5 text-[#8B7E66]" />
                <span className="text-[11px] font-black uppercase tracking-wider">Hızlı Görünüm Ayarları</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickSettings(false)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Section 1: Tema Seçimi (Reading Theme) */}
            <div className="bg-white/80 p-2.5 rounded-2xl border border-stone-200/60 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider">Okuma Teması</span>
                <span className="text-[9px] font-mono text-stone-400">
                  {READING_THEMES.find(t => t.id === settings.themeId)?.name || 'Tema'}
                </span>
              </div>
              {(() => {
                const favoriteThemes = (() => {
                  try {
                    const stored = localStorage.getItem('favorite_themes');
                    if (stored) {
                      const parsed = JSON.parse(stored);
                      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                    }
                  } catch (e) {}
                  return [
                    'classic', 'sepia', 'night',
                    'cream_1', 'cream_2', 'cream_3',
                    'mushroom_1', 'mushroom_2', 'mushroom_3',
                    'cappuccino_1', 'cappuccino_2', 'cappuccino_3',
                    'butter_1', 'butter_2', 'butter_3',
                    'vanilla_1', 'vanilla_2', 'vanilla_3'
                  ];
                })();
                const filteredThemes = READING_THEMES.filter(t => favoriteThemes.includes(t.id));

                return (
                  <div className="flex flex-wrap gap-2 pt-0.5 justify-start">
                    {filteredThemes.map(t => {
                      const isSelected = settings.themeId === t.id;
                      const isDark = ['night', 'slate', 'ocean', 'nordic'].includes(t.id);
                      return (
                        <button
                          key={t.id}
                          id={`quick-theme-${t.id}`}
                          onClick={() => {
                            onUpdateBook({
                              ...book,
                              settings: { ...settings, themeId: t.id }
                            });
                            handleQuickSettingsInteraction();
                          }}
                          className={`w-6 h-6 rounded-full border transition-all cursor-pointer relative ${
                            isSelected 
                              ? 'ring-2 ring-[#8B7E66] ring-offset-2 border-[#8B7E66] scale-110 shadow-xs' 
                              : isDark ? 'border-zinc-750 hover:scale-105' : 'border-stone-300 hover:scale-105'
                          }`}
                          style={{ backgroundColor: t.bgHex || '#ffffff' }}
                          title={t.name}
                        >
                          {isSelected && (
                            <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${isDark ? 'text-white' : 'text-[#8B7E66]'}`}>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Section 2: Yazı Rengi Seçimi */}
            <div className="bg-white/80 p-2.5 rounded-2xl border border-stone-200/60 shadow-2xs space-y-1.5">
              <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider block">Yazı Rengi</span>
              <div className="flex flex-wrap gap-2 pt-0.5 justify-start">
                {[
                  { hex: '#000000', title: 'Siyah' },
                  { hex: '#1e1e1e', title: 'Kömür Siyahı' },
                  { hex: '#2d2d2d', title: 'Koyu Gri' },
                  { hex: '#444444', title: 'Nötr Füme' },
                  { hex: '#5c5c5c', title: 'Kurşun Gri' },
                  { hex: '#7a7a7a', title: 'Nötr Gri' },
                  { hex: '#9e9e9e', title: 'Uçuk Gri' },
                  { hex: '#cbd5e1', title: 'Açık Bulut' },
                  { hex: '#ffffff', title: 'Beyaz' },
                  { hex: '#433422', title: 'Sepya Kahve' }
                ].map(c => {
                  const isSelected = settings.turkish.textColor === c.hex || settings.arabic.textColor === c.hex;
                  return (
                    <button
                      key={c.hex}
                      onClick={() => {
                        onUpdateBook({
                          ...book,
                          settings: {
                            ...settings,
                            turkish: { ...settings.turkish, textColor: c.hex },
                            arabic: { ...settings.arabic, textColor: c.hex }
                          }
                        });
                        handleQuickSettingsInteraction();
                      }}
                      className={`w-5 h-5 rounded-full border border-stone-300 transition-all cursor-pointer relative ${
                        isSelected 
                          ? 'ring-2 ring-[#8B7E66] ring-offset-1 border-[#8B7E66] scale-110 shadow-xs' 
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.title}
                    >
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white mix-blend-difference font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Arabic Font Config Card */}
            {book.detectedLanguages.includes('arabic') && (
              <div className="bg-emerald-50/40 p-2.5 rounded-2xl border border-emerald-200/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-emerald-600 text-white rounded-md uppercase tracking-wider">AR</span>
                    <span className="text-[11px] font-black text-emerald-900">Arapça Metin</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Font selection */}
                    {ARABIC_FONTS.map(f => {
                      const isSelected = settings.arabic.fontFamily === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            onUpdateBook({
                              ...book,
                              settings: {
                                ...settings,
                                arabic: { ...settings.arabic, fontFamily: f.id }
                              }
                            });
                            handleQuickSettingsInteraction();
                          }}
                          className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-700 text-white border-emerald-700 scale-105 shadow-xs' 
                              : 'bg-white text-stone-700 border-emerald-200 hover:border-emerald-300'
                          } ${f.id}`}
                          title={f.name}
                        >
                          ع
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Controls grid: Boyut, Satır Aralığı, Hizalama */}
                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                  {/* 1. Boyut */}
                  <div className="bg-white/90 p-1.5 rounded-xl border border-emerald-100 flex flex-col items-center justify-between">
                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-tight">Boyut</span>
                    <div className="flex items-center justify-between w-full pt-1">
                      <button
                        onClick={() => adjustFontSize('arabic', -1)}
                        disabled={localArabicFontSize <= 10}
                        className="w-5 h-5 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-30 cursor-pointer"
                      >
                        <Minus className="w-3 h-3 stroke-[2.5]" />
                      </button>
                      {editingArabicSize ? (
                        <input
                          type="number"
                          min={10}
                          max={70}
                          value={tempArabicSize}
                          onChange={(e) => {
                            setTempArabicSize(e.target.value);
                            handleQuickSettingsInteraction();
                          }}
                          onBlur={() => {
                            setEditingArabicSize(false);
                            const val = parseInt(tempArabicSize, 10);
                            if (!isNaN(val)) {
                              adjustFontSize('arabic', Math.max(10, Math.min(70, val)) - localArabicFontSize);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setEditingArabicSize(false);
                              const val = parseInt(tempArabicSize, 10);
                              if (!isNaN(val)) {
                                adjustFontSize('arabic', Math.max(10, Math.min(70, val)) - localArabicFontSize);
                              }
                            } else if (e.key === 'Escape') {
                              setEditingArabicSize(false);
                            }
                          }}
                          autoFocus
                          className="text-xs font-mono font-bold text-stone-700 w-7 text-center bg-stone-50 rounded py-0.5 border border-emerald-500 focus:outline-hidden"
                        />
                      ) : (
                        <span 
                          onClick={() => {
                            setTempArabicSize(String(localArabicFontSize));
                            setEditingArabicSize(true);
                            handleQuickSettingsInteraction();
                          }}
                          className="text-[11px] font-mono font-black text-stone-800 cursor-pointer px-1 hover:bg-stone-100 rounded"
                          title="Manual değer girin"
                        >
                          {localArabicFontSize}
                        </span>
                      )}
                      <button
                        onClick={() => adjustFontSize('arabic', 1)}
                        disabled={localArabicFontSize >= 70}
                        className="w-5 h-5 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-30 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* 2. Satır Aralığı */}
                  <div className="bg-white/90 p-1.5 rounded-xl border border-emerald-100 flex flex-col items-center justify-between">
                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-tight">Satır Boşluğu</span>
                    <div className="flex items-center justify-between w-full pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = settings.arabic.lineHeight || 2.4;
                          const next = Math.max(1.4, Number((cur - 0.2).toFixed(1)));
                          onUpdateBook({
                            ...book,
                            settings: {
                              ...settings,
                              arabic: { ...settings.arabic, lineHeight: next }
                            }
                          });
                          handleQuickSettingsInteraction();
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-[11px] font-mono font-black text-emerald-800">
                        {(settings.arabic.lineHeight || 2.4).toFixed(1)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = settings.arabic.lineHeight || 2.4;
                          const next = Math.min(4.0, Number((cur + 0.2).toFixed(1)));
                          onUpdateBook({
                            ...book,
                            settings: {
                              ...settings,
                              arabic: { ...settings.arabic, lineHeight: next }
                            }
                          });
                          handleQuickSettingsInteraction();
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 3. Hizalama */}
                  <div className="bg-white/90 p-1.5 rounded-xl border border-emerald-100 flex flex-col items-center justify-between">
                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-tight">Hizalama</span>
                    <div className="flex items-center justify-center gap-0.5 pt-1 w-full">
                      {[
                        { mode: 'right', icon: AlignRight, title: 'Sağa Yasla' },
                        { mode: 'center', icon: AlignCenter, title: 'Ortala' },
                        { mode: 'left', icon: AlignLeft, title: 'Sola Yasla' },
                        { mode: 'justify', icon: AlignJustify, title: 'İki Yana Yasla' },
                      ].map(item => {
                        const Icon = item.icon;
                        const isCurrent = (settings.arabic.textAlign || 'justify') === item.mode;
                        return (
                          <button
                            key={item.mode}
                            onClick={() => {
                              onUpdateBook({
                                ...book,
                                settings: {
                                  ...settings,
                                  arabic: { ...settings.arabic, textAlign: item.mode as any }
                                }
                              });
                              handleQuickSettingsInteraction();
                            }}
                            className={`w-5 h-5 flex items-center justify-center rounded transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-700 text-white shadow-2xs'
                                : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                            }`}
                            title={item.title}
                          >
                            <Icon className="w-3 h-3" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Latin/Turkish Font Config Card */}
            <div className="bg-amber-50/40 p-2.5 rounded-2xl border border-amber-200/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black px-1.5 py-0.5 bg-[#8B7E66] text-white rounded-md uppercase tracking-wider">TR</span>
                  <span className="text-[11px] font-black text-amber-950">Türkçe Metin</span>
                </div>
                <div className="flex items-center gap-1">
                  {LATIN_FONTS.map(f => {
                    const isSelected = settings.turkish.fontFamily === f.id;
                    let label = 'Aa';
                    if (f.id === 'font-sans') label = 'S';
                    else if (f.id === 'font-eb-garamond') label = 'G';
                    else if (f.id === 'font-lora') label = 'L';
                    else if (f.id === 'font-roboto-slab') label = 'R';
                    else if (f.id === 'font-serif') label = 'Y';

                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          onUpdateBook({
                            ...book,
                            settings: { ...settings, turkish: { ...settings.turkish, fontFamily: f.id } }
                          });
                          handleQuickSettingsInteraction();
                        }}
                        className={`w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded-md border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-[#8B7E66] text-white border-[#8B7E66] scale-105 shadow-xs' 
                            : 'bg-white text-stone-600 border-amber-200 hover:border-amber-300'
                        } ${f.id}`}
                        title={f.name}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Controls grid: Boyut, Satır Aralığı, Hizalama */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {/* 1. Boyut */}
                <div className="bg-white/90 p-1.5 rounded-xl border border-amber-100 flex flex-col items-center justify-between">
                  <span className="text-[9px] font-bold text-stone-500 uppercase tracking-tight">Boyut</span>
                  <div className="flex items-center justify-between w-full pt-1">
                    <button
                      onClick={() => adjustFontSize('turkish', -1)}
                      disabled={localTurkishFontSize <= 10}
                      className="w-5 h-5 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-30 cursor-pointer"
                    >
                      <Minus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                    {editingTurkishSize ? (
                      <input
                        type="number"
                        min={10}
                        max={70}
                        value={tempTurkishSize}
                        onChange={(e) => {
                          setTempTurkishSize(e.target.value);
                          handleQuickSettingsInteraction();
                        }}
                        onBlur={() => {
                          setEditingTurkishSize(false);
                          const val = parseInt(tempTurkishSize, 10);
                          if (!isNaN(val)) {
                            adjustFontSize('turkish', Math.max(10, Math.min(70, val)) - localTurkishFontSize);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setEditingTurkishSize(false);
                            const val = parseInt(tempTurkishSize, 10);
                            if (!isNaN(val)) {
                              adjustFontSize('turkish', Math.max(10, Math.min(70, val)) - localTurkishFontSize);
                            }
                          } else if (e.key === 'Escape') {
                            setEditingTurkishSize(false);
                          }
                        }}
                        autoFocus
                        className="text-xs font-mono font-bold text-stone-700 w-7 text-center bg-stone-50 rounded py-0.5 border border-[#8B7E66] focus:outline-hidden"
                      />
                    ) : (
                      <span 
                        onClick={() => {
                          setTempTurkishSize(String(localTurkishFontSize));
                          setEditingTurkishSize(true);
                          handleQuickSettingsInteraction();
                        }}
                        className="text-[11px] font-mono font-black text-stone-800 cursor-pointer px-1 hover:bg-stone-100 rounded"
                        title="Manual değer girin"
                      >
                        {localTurkishFontSize}
                      </span>
                    )}
                    <button
                      onClick={() => adjustFontSize('turkish', 1)}
                      disabled={localTurkishFontSize >= 70}
                      className="w-5 h-5 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-30 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* 2. Satır Aralığı */}
                <div className="bg-white/90 p-1.5 rounded-xl border border-amber-100 flex flex-col items-center justify-between">
                  <span className="text-[9px] font-bold text-stone-500 uppercase tracking-tight">Satır Boşluğu</span>
                  <div className="flex items-center justify-between w-full pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = settings.turkish.lineHeight || 1.75;
                        const next = Math.max(1.2, Number((cur - 0.15).toFixed(2)));
                        onUpdateBook({
                          ...book,
                          settings: {
                            ...settings,
                            turkish: { ...settings.turkish, lineHeight: next }
                          }
                        });
                        handleQuickSettingsInteraction();
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-[11px] font-mono font-black text-amber-900">
                      {(settings.turkish.lineHeight || 1.75).toFixed(1)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = settings.turkish.lineHeight || 1.75;
                        const next = Math.min(3.5, Number((cur + 0.15).toFixed(2)));
                        onUpdateBook({
                          ...book,
                          settings: {
                            ...settings,
                            turkish: { ...settings.turkish, lineHeight: next }
                          }
                        });
                        handleQuickSettingsInteraction();
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono font-bold text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 3. Hizalama */}
                <div className="bg-white/90 p-1.5 rounded-xl border border-amber-100 flex flex-col items-center justify-between">
                  <span className="text-[9px] font-bold text-stone-500 uppercase tracking-tight">Hizalama</span>
                  <div className="flex items-center justify-center gap-0.5 pt-1 w-full">
                    {[
                      { mode: 'left', icon: AlignLeft, title: 'Sola Yasla' },
                      { mode: 'center', icon: AlignCenter, title: 'Ortala' },
                      { mode: 'right', icon: AlignRight, title: 'Sağa Yasla' },
                      { mode: 'justify', icon: AlignJustify, title: 'İki Yana Yasla' },
                    ].map(item => {
                      const Icon = item.icon;
                      const isCurrent = (settings.turkish.textAlign || 'justify') === item.mode;
                      return (
                        <button
                          key={item.mode}
                          onClick={() => {
                            onUpdateBook({
                              ...book,
                              settings: {
                                ...settings,
                                turkish: { ...settings.turkish, textAlign: item.mode as any }
                              }
                            });
                            handleQuickSettingsInteraction();
                          }}
                          className={`w-5 h-5 flex items-center justify-center rounded transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-[#8B7E66] text-white shadow-2xs'
                              : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                          }`}
                          title={item.title}
                        >
                          <Icon className="w-3 h-3" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Cümle Düzeni (Yan Yana / Alt Alta) */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => {
                  onUpdateBook({
                    ...book,
                    settings: {
                      ...settings,
                      lineByLine: !settings.lineByLine
                    }
                  });
                  handleQuickSettingsInteraction();
                }}
                className={`w-full py-2 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs border ${
                  settings.lineByLine
                    ? 'bg-[#8B7E66] text-white border-[#8B7E66]'
                    : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-250'
                }`}
                title={settings.lineByLine ? "Paragraf akışına dön" : "Cümle ve ayetleri alt alta satır satır yaz"}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>{settings.lineByLine ? 'Cümleler Alt Alta Sıralı' : 'Paragraf Düzeni (Yan Yana)'}</span>
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Absolute floating helper at screen bottom center for easy quick flip */}
      <div className="fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] md:bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-35 flex items-center bg-white/70 shadow-2xl border border-[#D9D1C2] rounded-full p-2 px-3.5 backdrop-blur-md scale-100 select-none text-[#2D2D2A] gap-1">
        {!isContinuous && (
          <button
            onClick={handlePrevPage}
            disabled={currentPageIndex === 0}
            className="flex items-center gap-1.5 py-2.5 px-4 text-stone-700 bg-white/70 hover:bg-white active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed rounded-full cursor-pointer font-bold text-xs sm:text-sm transition-all shadow-xs border border-stone-250"
            title="Önceki Sayfa (Geri)"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            <span className="hidden xs:inline">Geri</span>
          </button>
        )}
        
        {/* Quick Settings Middle Trigger */}
        <button
          onClick={() => {
            setShowQuickSettings(prev => !prev);
            if (!showQuickSettings) {
              startQuickSettingsTimer();
            } else {
              if (quickSettingsTimerRef.current) {
                clearTimeout(quickSettingsTimerRef.current);
              }
            }
          }}
          className="flex items-center justify-center px-4 py-2 rounded-full hover:bg-[#8B7E66]/15 text-[#8B7E66] hover:text-stone-800 transition-all cursor-pointer bg-white/40 border border-[#D9D1C2]/60 mx-1"
          title="Hızlı Görünüm Ayarları (Yazı, Hizalama, Tema)"
        >
          <Settings className={`w-5 h-5 transition-transform duration-300 ${showQuickSettings ? 'rotate-90 text-[#8B7E66]' : 'text-[#8B7E66]'}`} />
        </button>

        {!isContinuous && (
          <button
            onClick={handleNextPage}
            disabled={currentPageIndex === totalPages - 1}
            className="flex items-center gap-1.5 py-2.5 px-4 text-stone-700 bg-white/70 hover:bg-white active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed rounded-full cursor-pointer font-bold text-xs sm:text-sm transition-all shadow-xs border border-stone-250"
            title="Sonraki Sayfa (İleri)"
          >
            <span className="hidden xs:inline">İleri</span>
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Book Settings Modal (Redesigned compact sidebar drawer) */}
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
            allBooks={allBooks}
            allDecks={allDecks}
            onRestoreBackup={onRestoreBackup}
          />
        )}
      </AnimatePresence>

      {/* Edit Page Modal */}
      {isEditPageModalOpen && currentPage && (
        <EditPageModal
          isOpen={isEditPageModalOpen}
          onClose={() => setIsEditPageModalOpen(false)}
          page={currentPage}
          pageIndex={currentPageIndex}
          totalPages={totalPages}
          separatorColor={settings.arabic.separatorColor || '#d97706'}
          onSavePage={handleSavePageFromReader}
          onDeletePage={handleDeletePageFromReader}
          onInsertPage={handleInsertPageFromReader}
        />
      )}

      {/* Mini Floating Counter Widget */}
      <MiniCounter
        bookId={book.id}
        isOpen={isCounterOpen}
        onClose={() => setIsCounterOpen(false)}
      />

      {/* Note Action Menu Modal */}
      <AnimatePresence>
        {noteActionMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm sm:items-center"
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
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
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
                    className="flex-1 py-2.5 bg-[#8B7E66] text-white rounded-xl text-sm font-bold hover:bg-[#7A6E59] transition-colors disabled:opacity-50 cursor-pointer"
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

      {/* Popup Confirmation Modal for exits (Request #2) */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <motion.div 
              id="reader-exit-modal"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="glass-panel-deep rounded-2xl p-6 max-w-sm w-full border border-[#D9D1C2] shadow-2xl space-y-4 text-center text-[#2D2D2A]"
            >
              <div className="mx-auto w-10 h-10 rounded-full bg-[#FF8A65]/10 flex items-center justify-center text-[#FF8A65] border border-[#FF8A65]/20 animate-bounce">
                <Bookmark className="w-5 h-5 fill-[#FF8A65]" />
              </div>
              
              <div className="space-y-1">
                <h4 className="font-extrabold text-stone-800 text-sm">Harika bir okuma seansı!</h4>
                <h4 className="font-extrabold text-stone-800 text-sm">Kaydedilmiş sayfanızı güncellemek ister misiniz?</h4>
              </div>

              <p className="text-[11px] text-stone-500 font-medium select-none">
                Kaydedilen sayfanız şu anda <span className="font-bold text-[#FF8A65]">{book.bookmark || 'Yok'}</span> olarak ayarlı. Sayfa <span className="font-bold text-[#8B7E66]">{currentPage.page}</span> olarak güncellensin mi?
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  id="confirm-no-update-exit-btn"
                  onClick={() => {
                    setShowExitConfirm(false);
                    onBack();
                  }}
                  className="px-4 py-2.5 bg-white/60 hover:bg-white border border-[#D9D1C2] rounded-xl text-stone-650 text-xs font-bold cursor-pointer transition-all active:scale-95"
                >
                  Hayır
                </button>
                <button
                  id="confirm-yes-update-exit-btn"
                  onClick={() => {
                    setShowExitConfirm(false);
                    onUpdateBook({
                      ...book,
                      bookmark: currentPage.page
                    });
                    // Trigger direct callback transition cleanly
                    setTimeout(() => {
                      onBack();
                    }, 30);
                  }}
                  className="px-4 py-2.5 bg-[#8B7E66] hover:bg-[#70644e] text-white rounded-xl text-xs font-extrabold shadow-md hover:shadow-lg cursor-pointer transition-all active:scale-95"
                >
                  Evet
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
