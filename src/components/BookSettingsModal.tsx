/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, Paintbrush, Eye, ChevronDown, ChevronUp, Download, Upload, AlertCircle, ClipboardCheck, Star, Plus, Copy, Share2, RotateCcw, CheckCheck, BookOpen, AlignLeft, Check, Trash2 } from 'lucide-react';
import { 
  READING_THEMES, 
  LATIN_FONTS, 
  ARABIC_FONTS, 
  FONT_SIZES, 
  TEXT_COLORS, 
  ARABIC_TEXT_COLORS,
  ARABIC_SEPARATOR_COLORS 
} from '../constants';
import { Book, LanguageSettings, Deck, AppBackupData, ReadingTheme } from '../types';
import { copyToClipboard, downloadFile, createFullBackupPayload, restoreBackupMetadata, getCustomThemes, addCustomTheme, removeCustomTheme, isDarkHex } from '../utils';

interface BookSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  onUpdateSettings: (newSettings: Book['settings']) => void;
  onApplyToAllBooks?: (settings: Book['settings']) => void;
  onResetToDefaults?: () => void;
  allBooks?: Book[];
  allDecks?: Deck[];
  onRestoreBackup?: (books: Book[], decks: Deck[]) => void;
}

const MODAL_QUICK_COLORS = [
  { hex: '#000000', name: 'Siyah' },
  { hex: '#1e1e1e', name: 'Kömür Siyahı' },
  { hex: '#2d2d2d', name: 'Koyu Gri' },
  { hex: '#444444', name: 'Nötr Füme' },
  { hex: '#5c5c5c', name: 'Kurşun Gri' },
  { hex: '#7a7a7a', name: 'Nötr Gri' },
  { hex: '#9e9e9e', name: 'Uçuk Gri' },
  { hex: '#cbd5e1', name: 'Açık Bulut' },
  { hex: '#ffffff', name: 'Beyaz' },
  { hex: '#433422', name: 'Sepya Kahve' }
];

const themeShortNames: Record<string, string> = {
  cream: 'Krem',
  mushroom: 'Mantar',
  cappuccino: 'Kapuçino',
  butter: 'Tereyağı',
  vanilla: 'Vanilya',
  sepia: 'Sepya',
  night: 'Gece',
  slate: 'Arduvaz',
  peach: 'Şeftali',
  ivory: 'Fildişi',
  amber: 'Kehribar',
  linen: 'Keten',
  ocean: 'Okyanus',
  nordic: 'Kuzey',
  parchment: 'Parşömen',
  classic: 'Klasik'
};

export default function BookSettingsModal({ 
  isOpen, 
  onClose, 
  book, 
  onUpdateSettings, 
  onApplyToAllBooks,
  onResetToDefaults,
  allBooks,
  allDecks,
  onRestoreBackup
}: BookSettingsModalProps) {
  const isGlobalModal = book.id === 'global_settings_virtual';
  const [appliedAllNotice, setAppliedAllNotice] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isArabicOpen, setIsArabicOpen] = useState(false);
  const [isTurkishOpen, setIsTurkishOpen] = useState(false);
  const [isBackupSectionOpen, setIsBackupSectionOpen] = useState(false);

  // Backup / Restore states
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

  const [favoriteThemes, setFavoriteThemes] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('favorite_themes');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [
      'classic', 'sepia', 'night',
      'cream_1', 'cream_2', 'cream_3',
      'mushroom_1', 'mushroom_2', 'mushroom_3',
      'cappuccino_1', 'cappuccino_2', 'cappuccino_3',
      'butter_1', 'butter_2', 'butter_3',
      'vanilla_1', 'vanilla_2', 'vanilla_3'
    ];
  });

  const toggleFavorite = (id: string) => {
    setFavoriteThemes((prev) => {
      const next = prev.includes(id) 
        ? prev.filter((t) => t !== id) 
        : [...prev, id];
      localStorage.setItem('favorite_themes', JSON.stringify(next));
      return next;
    });
  };

  // We let parent AnimatePresence handle the mount/unmount logic
  const hasTurkish = book.detectedLanguages.includes('turkish');
  const hasArabic = book.detectedLanguages.includes('arabic');

  const { themeId, customThemeColor, turkish, arabic } = book.settings;
  const baseTheme = READING_THEMES.find(t => t.id === themeId) || READING_THEMES[0];
  const currentTheme: ReadingTheme = customThemeColor ? {
    ...baseTheme,
    bgHex: customThemeColor,
    bgColor: '',
  } : baseTheme;

  const [hexInput, setHexInput] = useState(customThemeColor || baseTheme.bgHex || '#ffffff');
  const [customThemes, setCustomThemes] = useState<string[]>(() => getCustomThemes());
  const [colorToDelete, setColorToDelete] = useState<string | null>(null);
  const [themeAddedToast, setThemeAddedToast] = useState(false);
  const longPressTimerRef = useRef<any>(null);

  const startLongPress = (hex: string) => {
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setColorToDelete(hex);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleUpdateTheme = (newThemeId: string) => {
    const selected = READING_THEMES.find(t => t.id === newThemeId);
    onUpdateSettings({
      ...book.settings,
      themeId: newThemeId,
      customThemeColor: undefined
    });
    if (isGlobalModal && onApplyToAllBooks) {
      onApplyToAllBooks({
        ...book.settings,
        themeId: newThemeId,
        customThemeColor: undefined
      });
    }
    if (selected?.bgHex) {
      setHexInput(selected.bgHex);
    }
  };

  const handleAddNewCustomColor = (colorHex: string) => {
    let clean = colorHex.trim();
    if (!clean.startsWith('#')) clean = '#' + clean;
    if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(clean)) return;

    clean = clean.toLowerCase();
    const updated = addCustomTheme(clean);
    setCustomThemes(updated);
    setHexInput(clean);

    onUpdateSettings({
      ...book.settings,
      customThemeColor: clean
    });

    if (isGlobalModal && onApplyToAllBooks) {
      onApplyToAllBooks({
        ...book.settings,
        customThemeColor: clean
      });
    }

    setThemeAddedToast(true);
    setTimeout(() => setThemeAddedToast(false), 2500);
  };

  const handleDeleteCustomColor = (hexToDelete: string) => {
    const updated = removeCustomTheme(hexToDelete);
    setCustomThemes(updated);
    setColorToDelete(null);

    // If current active color is the deleted one, revert to default theme
    if (customThemeColor?.toLowerCase() === hexToDelete.toLowerCase()) {
      handleUpdateTheme('cream_1');
      if (isGlobalModal && onApplyToAllBooks) {
        onApplyToAllBooks({
          ...book.settings,
          themeId: 'cream_1',
          customThemeColor: undefined
        });
      }
    }
  };

  const handleUpdateCustomThemeColor = (colorHex: string) => {
    setHexInput(colorHex);
    onUpdateSettings({
      ...book.settings,
      customThemeColor: colorHex
    });
    if (isGlobalModal && onApplyToAllBooks) {
      onApplyToAllBooks({
        ...book.settings,
        customThemeColor: colorHex
      });
    }
  };

  const handleUpdateLanguage = (lang: 'turkish' | 'arabic', key: keyof LanguageSettings, value: any) => {
    onUpdateSettings({
      ...book.settings,
      [lang]: {
        ...book.settings[lang],
        [key]: value
      }
    });
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex justify-end bg-black/15 backdrop-blur-xs" 
        onClick={onClose}
      >
        <motion.div 
          id="settings-modal-card"
          onClick={(e) => e.stopPropagation()}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
          className={`w-full sm:w-[380px] h-full ${currentTheme.cardBg} ${currentTheme.textColor} border-l ${currentTheme.borderColor} shadow-2xl flex flex-col`}
        >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 pb-4 pt-[calc(2.5rem+env(safe-area-inset-top))] sm:pt-[calc(2rem+env(safe-area-inset-top))] border-b ${currentTheme.borderColor} bg-black/5`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg border bg-black/5 ${currentTheme.borderColor} shrink-0`}>
              {isGlobalModal ? <Settings className="w-4 h-4 opacity-80" /> : <BookOpen className="w-4 h-4 text-[#8B7E66]" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-xs uppercase tracking-wider opacity-95 truncate max-w-[200px]">
                  {isGlobalModal ? 'Varsayılan Metin Ayarları' : book.title}
                </h3>
                {!isGlobalModal && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#8B7E66]/15 text-[#8B7E66] rounded-md shrink-0">
                    Kitaba Özel
                  </span>
                )}
              </div>
              <p className="text-[10px] opacity-75 font-semibold truncate">
                {isGlobalModal 
                  ? 'Yeni kitaplar için temel ayarlar' 
                  : 'Sadece bu kitabın ayarlarını değiştirir'}
              </p>
            </div>
          </div>
          <button 
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-full opacity-60 hover:opacity-100 hover:bg-black/5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Strip: Reset or Apply to all books */}
        {appliedAllNotice ? (
          <div className="px-5 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-800 text-[11px] font-bold flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <CheckCheck className="w-4 h-4" /> Tüm kitaplara başarıyla uygulandı!
            </span>
          </div>
        ) : (
          <div className={`px-5 py-2 bg-black/[0.03] border-b ${currentTheme.borderColor} flex items-center justify-between gap-2 text-[10px]`}>
            {onResetToDefaults && !isGlobalModal && (
              <button
                type="button"
                onClick={onResetToDefaults}
                className="flex items-center gap-1 font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
                title="Kitabın ayarlarını varsayılan ayarlara döndürür"
              >
                <RotateCcw className="w-3 h-3" /> Varsayılana Sıfırla
              </button>
            )}
            {onApplyToAllBooks && (
              <button
                type="button"
                onClick={() => {
                  onApplyToAllBooks(book.settings);
                  setAppliedAllNotice(true);
                  setTimeout(() => setAppliedAllNotice(false), 2500);
                }}
                className="flex items-center gap-1 font-bold text-[#8B7E66] hover:text-[#70644e] cursor-pointer ml-auto"
                title="Bu ayarları kitaplıktaki tüm kitaplara uygula"
              >
                <CheckCheck className="w-3 h-3" /> Tüm Kitaplara Uygula
              </button>
            )}
          </div>
        )}

        {/* Scrollable Settings Panel */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col">
          
          {/* Theme Selection Accordion */}
          <div className={`border-b ${currentTheme.borderColor} pb-3`}>
            <button
              onClick={() => setIsThemeOpen(!isThemeOpen)}
              className="w-full flex items-center justify-between py-2 text-left cursor-pointer group focus:outline-hidden"
            >
              <span className="text-[11px] font-extrabold opacity-80 group-hover:opacity-100 flex items-center gap-2 uppercase tracking-wider transition-opacity">
                <Paintbrush className="w-4 h-4 text-[#8B7E66]" />
                Okuma Teması
              </span>
              {isThemeOpen ? (
                <ChevronUp className="w-4 h-4 opacity-75" />
              ) : (
                <ChevronDown className="w-4 h-4 opacity-75" />
              )}
            </button>
            {isThemeOpen && (
              <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <div id="theme-color-palette" className="space-y-2.5">
                  {/* User-added Custom Themes (if any) */}
                  {customThemes.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-extrabold text-stone-500 uppercase tracking-wider block px-1">
                        Eklediğiniz Özel Renkler (Silmek için basılı tutun)
                      </span>
                      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2.5 bg-amber-50/40 rounded-2xl border border-amber-200/50">
                        {customThemes.map((hex) => {
                          const isSelected = customThemeColor?.toLowerCase() === hex.toLowerCase();
                          const isDark = isDarkHex(hex);
                          return (
                            <div 
                              key={hex} 
                              className="relative group flex items-center justify-center p-0.5"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateSettings({
                                    ...book.settings,
                                    customThemeColor: hex
                                  });
                                  if (isGlobalModal && onApplyToAllBooks) {
                                    onApplyToAllBooks({
                                      ...book.settings,
                                      customThemeColor: hex
                                    });
                                  }
                                  setHexInput(hex);
                                }}
                                onTouchStart={() => startLongPress(hex)}
                                onTouchEnd={cancelLongPress}
                                onTouchMove={cancelLongPress}
                                onMouseDown={() => startLongPress(hex)}
                                onMouseUp={cancelLongPress}
                                onMouseLeave={cancelLongPress}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setColorToDelete(hex);
                                }}
                                className={`w-9 sm:w-10 h-9 sm:h-10 rounded-full border shadow-xs transition-all cursor-pointer flex items-center justify-center relative ${
                                  isSelected 
                                    ? 'ring-2 ring-[#8B7E66] ring-offset-1 border-[#8B7E66] scale-110 shadow-sm z-10' 
                                    : 'border-stone-300 hover:scale-110 hover:border-stone-400'
                                }`}
                                style={{ backgroundColor: hex }}
                                title={`Özel Renk: ${hex.toUpperCase()} (Silmek için basılı tutun)`}
                              >
                                {isSelected && (
                                  <span className={`text-[10px] font-extrabold ${isDark ? 'text-white' : 'text-[#8B7E66]'}`}>✓</span>
                                )}
                              </button>
                              {/* Quick delete icon on hover for desktop */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setColorToDelete(hex);
                                }}
                                className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-all cursor-pointer z-10 opacity-0 group-hover:opacity-100 shadow-2xs"
                                title="Bu özel rengi sil"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Standard Built-in Themes */}
                  <div className="space-y-1">
                    {customThemes.length > 0 && (
                      <span className="text-[9px] font-extrabold text-stone-500 uppercase tracking-wider block px-1">
                        Hazır Okuma Temaları
                      </span>
                    )}
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2.5 bg-stone-100/50 rounded-2xl border border-stone-200/50">
                      {READING_THEMES.map((theme) => {
                        const isFav = favoriteThemes.includes(theme.id);
                        const isSelected = !customThemeColor && themeId === theme.id;
                        const isDark = ['night', 'slate', 'ocean', 'nordic'].includes(theme.id);
                        return (
                          <div 
                            key={theme.id} 
                            className="relative group flex items-center justify-center p-0.5"
                          >
                            <button
                              id={`theme-btn-${theme.id}`}
                              type="button"
                              onClick={() => handleUpdateTheme(theme.id)}
                              className={`w-9 sm:w-10 h-9 sm:h-10 rounded-full border shadow-xs transition-all cursor-pointer flex items-center justify-center relative ${
                                isSelected 
                                  ? 'ring-2 ring-[#8B7E66] ring-offset-1 border-[#8B7E66] scale-110 shadow-sm z-10' 
                                  : 'border-stone-300 hover:scale-110 hover:border-stone-400'
                              }`}
                              style={{ backgroundColor: theme.bgHex }}
                              title={theme.name}
                            >
                              {isSelected && (
                                <span className={`text-[10px] font-extrabold ${isDark ? 'text-white' : 'text-[#8B7E66]'}`}>✓</span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(theme.id);
                              }}
                              className={`absolute -top-1 -right-1 p-0.5 rounded-full transition-all cursor-pointer z-10 ${
                                isFav ? 'text-amber-500 scale-110 animate-scale-up' : 'text-stone-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                              }`}
                              title={isFav ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Manuel Renk Kodu Girişi ve Renk Seçici (Color Picker) */}
                <div className="p-3 bg-stone-100/70 rounded-2xl border border-stone-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Paintbrush className="w-3.5 h-3.5 text-[#8B7E66]" />
                      Özel Manuel Renk (Hex/Renk Paleti)
                    </span>
                    {customThemeColor && (
                      <button
                        type="button"
                        onClick={() => handleUpdateTheme(themeId || 'cream_1')}
                        className="text-[9px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                      >
                        Temaya Sıfırla
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Native color picker circle */}
                    <div className="relative w-8 h-8 rounded-full border-2 border-white shadow-xs overflow-hidden shrink-0 cursor-pointer">
                      <input
                        type="color"
                        value={hexInput.startsWith('#') && hexInput.length === 7 ? hexInput : (customThemeColor || currentTheme.bgHex || '#ffffff')}
                        onChange={(e) => {
                          setHexInput(e.target.value);
                        }}
                        className="absolute inset-0 w-12 h-12 -top-2 -left-2 cursor-pointer border-0 p-0"
                        title="Renk Paletinden Seç"
                      />
                    </div>

                    {/* Manuel HEX Text Input */}
                    <div className="relative flex-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={hexInput}
                        placeholder="#f5f2ea"
                        onChange={(e) => setHexInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddNewCustomColor(hexInput);
                          }
                        }}
                        className="w-full text-xs font-mono font-bold px-3 py-1.5 bg-white border border-stone-300 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#8B7E66] text-stone-800 uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddNewCustomColor(hexInput)}
                        className="px-3 py-1.5 bg-[#8B7E66] text-white text-[11px] font-bold rounded-xl hover:bg-[#746852] active:scale-95 cursor-pointer shrink-0 transition shadow-xs flex items-center gap-1"
                        title="Bu rengi temalarınıza ekleyin ve seçin"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ekle
                      </button>
                    </div>

                    {/* Canlı Önizleme Kutucuğu */}
                    <div 
                      onClick={() => handleAddNewCustomColor(hexInput)}
                      className="w-8 h-8 rounded-xl border border-stone-300 shadow-2xs shrink-0 flex items-center justify-center text-[10px] font-bold select-none cursor-pointer hover:scale-105 transition"
                      style={{ 
                        backgroundColor: hexInput.startsWith('#') ? hexInput : (customThemeColor || currentTheme.bgHex || '#ffffff'),
                        color: isDarkHex(hexInput.startsWith('#') ? hexInput : (customThemeColor || '#ffffff')) ? '#ffffff' : '#2D2D2A'
                      }}
                      title="Seçili Arka Plan Önizlemesi - Eklemek için tıklayın"
                    >
                      Aa
                    </div>
                  </div>

                  {themeAddedToast && (
                    <p className="text-[10px] font-bold text-emerald-600 animate-in fade-in duration-150 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Renk temalara eklendi ve seçildi!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Yazı Rengi Selection (Synchronized with Quick Settings colors) */}
          <div className={`border-b ${currentTheme.borderColor} pb-3`}>
            <div className="flex flex-col gap-2 py-1">
              <span className="text-[11px] font-extrabold opacity-80 flex items-center gap-2 uppercase tracking-wider">
                <Paintbrush className="w-4 h-4 text-[#8B7E66]" />
                Yazı Rengi
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {MODAL_QUICK_COLORS.map((col) => {
                  const isSelected = turkish.textColor === col.hex || arabic.textColor === col.hex;
                  return (
                    <button
                      key={col.hex}
                      onClick={() => {
                        onUpdateSettings({
                          ...book.settings,
                          turkish: { ...turkish, textColor: col.hex },
                          arabic: { ...arabic, textColor: col.hex }
                        });
                      }}
                      style={{ backgroundColor: col.hex }}
                      title={col.name}
                      className={`w-6 h-6 rounded-full border border-stone-300 transition-all cursor-pointer relative ${
                        isSelected 
                          ? 'ring-2 ring-[#8B7E66] ring-offset-1 scale-115 shadow-xs' 
                          : 'hover:scale-110'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white mix-blend-difference font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cümle / Ayet Düzeni: Yan Yana / Alt Alta */}
          <div className={`border-b ${currentTheme.borderColor} pb-3`}>
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] font-extrabold opacity-80 flex items-center gap-2 uppercase tracking-wider">
                <AlignLeft className="w-4 h-4 text-[#8B7E66]" />
                Cümle / Ayet Düzeni
              </span>
              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({
                    ...book.settings,
                    lineByLine: !book.settings.lineByLine
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  book.settings.lineByLine
                    ? 'bg-[#8B7E66] text-white shadow-xs'
                    : 'bg-black/5 hover:bg-black/10 border border-stone-250'
                }`}
              >
                <span>{book.settings.lineByLine ? 'Cümleler Alt Alta' : 'Yan Yana (Paragraf)'}</span>
              </button>
            </div>
            <p className="text-[10px] opacity-65 mt-1 font-medium">
              {book.settings.lineByLine
                ? 'Ayetler ve Türkçe cümleler alt alta satır satır sıralanır.'
                : 'Metinler doğal paragraf ve satır akışında gösterilir.'}
            </p>
          </div>

          {/* Arabic settings section Accordion */}
          {hasArabic && (
            <div className={`border-b ${currentTheme.borderColor} pb-3`}>
              <button
                onClick={() => setIsArabicOpen(!isArabicOpen)}
                className="w-full flex items-center justify-between py-2 text-left cursor-pointer group focus:outline-hidden"
              >
                <span className="text-[11px] font-extrabold opacity-80 group-hover:opacity-100 flex items-center gap-2 uppercase tracking-wider transition-opacity">
                  <span className="text-[9px] uppercase font-mono font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">AR</span>
                  Arapça Metin Ayarları
                </span>
                {isArabicOpen ? (
                  <ChevronUp className="w-4 h-4 opacity-75" />
                ) : (
                  <ChevronDown className="w-4 h-4 opacity-75" />
                )}
              </button>
              {isArabicOpen && (
                <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Font selection */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold opacity-75">Yazı Tipi (Font)</label>
                      <select
                        id="arabic-font-family"
                        value={arabic.fontFamily}
                        onChange={(e) => handleUpdateLanguage('arabic', 'fontFamily', e.target.value)}
                        className={`w-full text-xs p-2 rounded-lg border ${currentTheme.borderColor} bg-black/5 text-current focus:ring-1 focus:ring-[#8B7E66] focus:outline-hidden font-bold`}
                      >
                        {ARABIC_FONTS.map(f => (
                          <option key={f.id} value={f.id} className="text-stone-900 bg-white">{f.name.replace(' (Geleneksel Nesih)', '').replace(' (Modern Sans)', '').replace(' (Klasik Hat)', '').replace(' (Kufi Sanat)', '').replace(' (Okunaklı Hat)', '').replace(' (Minimal Sans)', '')}</option>
                        ))}
                      </select>
                    </div>

                    {/* Font size selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold opacity-75">Yazı Büyüklüğü</label>
                      <select
                        id="arabic-font-size"
                        value={arabic.fontSize}
                        onChange={(e) => handleUpdateLanguage('arabic', 'fontSize', Number(e.target.value))}
                        className={`w-full text-xs p-2 rounded-lg border ${currentTheme.borderColor} bg-black/5 text-current focus:ring-1 focus:ring-[#8B7E66] focus:outline-hidden font-bold`}
                      >
                        {FONT_SIZES.map(size => (
                          <option key={size} value={size} className="text-stone-900 bg-white">{size} px</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Cümle / Ayet Ayraç Rengi (Numaralar ve Şekiller) */}
                  <div className="space-y-2 pt-2 border-t border-black/10">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold opacity-85 flex items-center gap-1.5 uppercase tracking-wider">
                        <span className="text-[#8B7E66]">✦</span> Cümle / Ayet Ayraç Rengi
                      </label>
                      <span className="text-[9px] font-mono opacity-60">
                        {arabic.separatorColor || '#d97706'}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {ARABIC_SEPARATOR_COLORS.map((col) => {
                        const isSelected = (arabic.separatorColor || '#d97706').toLowerCase() === col.hex.toLowerCase();
                        return (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => handleUpdateLanguage('arabic', 'separatorColor', col.hex)}
                            style={{ backgroundColor: col.hex }}
                            title={col.name}
                            className={`w-6 h-6 rounded-full border border-black/25 transition-all cursor-pointer relative ${
                              isSelected ? 'ring-2 ring-[#8B7E66] ring-offset-2 scale-115 shadow-sm' : 'hover:scale-110 opacity-90'
                            }`}
                          >
                            {isSelected && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold drop-shadow">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="color"
                          value={arabic.separatorColor || '#d97706'}
                          onChange={(e) => handleUpdateLanguage('arabic', 'separatorColor', e.target.value)}
                          className="w-6 h-6 rounded-full border-0 cursor-pointer p-0 bg-transparent"
                          title="Özel Renk Seç"
                        />
                        <span className="text-[9px] opacity-70 font-semibold">Özel</span>
                      </div>
                    </div>

                    {/* Canlı Ayraç Önizlemesi */}
                    <div className="p-2.5 rounded-xl bg-black/5 text-right font-arabic text-base dir-rtl leading-relaxed select-none border border-black/5">
                      <span>فَرْدٌ حَيٌّ قَيُّومٌ</span>
                      <span 
                        className="inline-block mx-1.5 font-bold transition-colors duration-150"
                        style={{ color: arabic.separatorColor || '#d97706' }}
                      >
                        ۝١
                      </span>
                      <span>سَيَجْعَلُ اللّٰهُ بَعْدَ عُسْرٍ يُسْرًا</span>
                      <span 
                        className="inline-block mx-1.5 font-bold transition-colors duration-150"
                        style={{ color: arabic.separatorColor || '#d97706' }}
                      >
                        ۝٢
                      </span>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* Turkish settings section Accordion */}
          {hasTurkish && (
            <div className={`border-b ${currentTheme.borderColor} pb-3`}>
              <button
                onClick={() => setIsTurkishOpen(!isTurkishOpen)}
                className="w-full flex items-center justify-between py-2 text-left cursor-pointer group focus:outline-hidden"
              >
                <span className="text-[11px] font-extrabold opacity-80 group-hover:opacity-100 flex items-center gap-2 uppercase tracking-wider transition-opacity">
                  <span className="text-[9px] uppercase font-mono font-black px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-200">TR</span>
                  Türkçe Metin Ayarları
                </span>
                {isTurkishOpen ? (
                  <ChevronUp className="w-4 h-4 opacity-75" />
                ) : (
                  <ChevronDown className="w-4 h-4 opacity-75" />
                )}
              </button>
              {isTurkishOpen && (
                <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Font selection */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold opacity-75">Yazı Tipi (Font)</label>
                      <select
                        id="turkish-font-family"
                        value={turkish.fontFamily}
                        onChange={(e) => handleUpdateLanguage('turkish', 'fontFamily', e.target.value)}
                        className={`w-full text-xs p-2 rounded-lg border ${currentTheme.borderColor} bg-black/5 text-current focus:ring-1 focus:ring-[#8B7E66] focus:outline-hidden font-bold`}
                      >
                        {LATIN_FONTS.map(f => (
                          <option key={f.id} value={f.id} className="text-stone-900 bg-white">{f.name.replace(' (Düz/Modern)', '').replace(' (Kitap Serif)', '').replace(' (Zarif Başlık)', '')}</option>
                        ))}
                      </select>
                    </div>

                    {/* Font size selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold opacity-75">Yazı Büyüklüğü</label>
                      <select
                        id="turkish-font-size"
                        value={turkish.fontSize}
                        onChange={(e) => handleUpdateLanguage('turkish', 'fontSize', Number(e.target.value))}
                        className={`w-full text-xs p-2 rounded-lg border ${currentTheme.borderColor} bg-black/5 text-current focus:ring-1 focus:ring-[#8B7E66] focus:outline-hidden font-bold`}
                      >
                        {FONT_SIZES.map(size => (
                          <option key={size} value={size} className="text-stone-900 bg-white">{size} px</option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* Storage & Backup Management Dropdown/Accordion */}
          {allBooks && onRestoreBackup && (
            <div className={`border-b ${currentTheme.borderColor} pb-3`}>
              <button
                type="button"
                onClick={() => setIsBackupSectionOpen(!isBackupSectionOpen)}
                className="w-full flex items-center justify-between py-2 text-left cursor-pointer group focus:outline-hidden"
              >
                <span className="text-[11px] font-extrabold opacity-85 group-hover:opacity-100 flex items-center gap-2 uppercase tracking-wider transition-opacity">
                  <Download className="w-4 h-4 text-[#8B7E66]" />
                  Depolama ve Yedek Yönetimi
                </span>
                {isBackupSectionOpen ? (
                  <ChevronUp className="w-4 h-4 opacity-75" />
                ) : (
                  <ChevronDown className="w-4 h-4 opacity-75" />
                )}
              </button>
              
              {isBackupSectionOpen && (
                <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-1 duration-150 text-xs font-medium space-y-2.5">
                  <div className="p-3 bg-black/5 rounded-xl space-y-1.5 text-[10px] leading-relaxed opacity-90">
                    <p>
                      Mevcut durumda kütüphanenizde <strong>{allBooks.length} kitap</strong> ve <strong>{allDecks?.length || 0} kategori</strong> bulunmaktadır.
                    </p>
                    <p className="opacity-75">
                      Verileriniz çevrimdışı yerel depolama alanında saklanır. Yedek alıp istediğiniz zaman aynı haliyle geri yükleyebilirsiniz.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const backupData = createFullBackupPayload(allBooks || [], allDecks || []);
                          const json = JSON.stringify(backupData, null, 2);
                          const filename = `dual_reader_tam_yedek_${new Date().toISOString().split('T')[0]}.json`;
                          const success = await downloadFile(json, filename);
                          if (!success) {
                            setRestoreError('Dosya indirme başlatılamadı. Cihazınızda sistem paylaşımı veya yedek kodu kopyalama seçeneklerini kullanmayı deneyin.');
                          }
                        } catch (err: any) {
                          setRestoreError('Yedekleme sırasında hata oluştu: ' + err.message);
                        }
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Tam Yedek Dosyası İndir (Kitaplar, Notlar, Ayarlar)
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const backupData = createFullBackupPayload(allBooks || [], allDecks || []);
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
                      }}
                      className={`w-full py-2.5 ${copiedSuccess ? 'bg-teal-600' : 'bg-stone-600 hover:bg-stone-700'} text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-xs`}
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> 
                      {copiedSuccess ? 'Yedek Kodu Kopyalandı!' : 'Yedek Kodu Kopyala'}
                    </button>

                    {navigator.share && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const backupData = createFullBackupPayload(allBooks || [], allDecks || []);
                            const json = JSON.stringify(backupData, null, 2);
                            const dateStr = new Date().toISOString().split('T')[0];
                            try {
                              const file = new File([json], `dual_reader_tam_yedek_${dateStr}.json`, { type: 'application/json' });
                              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                await navigator.share({
                                  files: [file],
                                  title: 'Dual Reader Tam Kütüphane Yedeği',
                                  text: 'Dual Reader yedek dosyası'
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
                            } catch (shErr) {
                              if (json.length > 50000) {
                                setRestoreError('Dosya paylaşımı reddedildi veya desteklenmiyor. Yedek kodu metin olarak paylaşmak için çok büyük. Lütfen kopyalama veya indirme seçeneğini kullanın.');
                                return;
                              }
                              await navigator.share({
                                title: 'Dual Reader Tam Kütüphane Yedeği',
                                text: json
                              });
                            }
                          } catch (err: any) {
                            setRestoreError('Yedek paylaşılırken hata oluştu: ' + err.message);
                          }
                        }}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-xs"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Yedek Kodunu Paylaş
                      </button>
                    )}

                    <div className="border-t border-stone-200/40 my-1 pt-2"></div>

                    <label className="w-full py-2.5 bg-[#8B7E66]/10 hover:bg-[#8B7E66]/20 border border-[#8B7E66]/20 text-[#8B7E66] rounded-xl font-extrabold flex items-center justify-center gap-1.5 relative text-center text-xs transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> Yedek Dosyası Yükle
                      <input
                        type="file"
                        accept=".json"
                        onChange={(event) => {
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
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-[0px]"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowPasteArea(!showPasteArea)}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Yedek Kodu Yapıştır
                    </button>
                  </div>

                  {/* Paste Area inside Settings Modal */}
                  {showPasteArea && (
                    <div className="border border-amber-200 bg-amber-50/50 p-3 rounded-xl space-y-2.5 mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      <span className="text-[10px] font-extrabold text-amber-850 block uppercase tracking-wider">Yedekleme Kodunu Yapıştırın:</span>
                      <textarea
                        value={pastedJson}
                        onChange={(e) => setPastedJson(e.target.value)}
                        placeholder='{"version": "1.0", "books": [...]}'
                        className="w-full h-24 p-2.5 border border-[#D9D1C2] rounded-xl text-xs font-mono bg-white focus:outline-hidden text-stone-850"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasteArea(false);
                            setPastedJson('');
                          }}
                          className="px-2.5 py-1 bg-white border border-[#D9D1C2] text-stone-600 rounded-lg text-[10px] font-bold hover:bg-stone-50 cursor-pointer"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!pastedJson.trim()) return;
                            try {
                              const data = JSON.parse(pastedJson);
                              if (!data || !Array.isArray(data.books)) {
                                throw new Error('Yedek verisi formatı geçersiz (kitap listesi bulunamadı).');
                              }
                              const totalNotes = (Array.isArray(data.generalNotes) ? data.generalNotes.length : 0) + 
                                data.books.reduce((acc: number, b: any) => acc + (Array.isArray(b.notes) ? b.notes.length : 0), 0);

                              setRestoreSession({
                                fileName: 'Yapıştırılan Metin Yedeği',
                                booksCount: data.books.length,
                                decksCount: Array.isArray(data.decks) ? data.decks.length : 0,
                                notesCount: totalNotes,
                                hasSettings: !!data.globalSettings || data.books.some((b: any) => !!b.settings),
                                fullBackup: data
                              });
                              setRestoreError(null);
                              setShowPasteArea(false);
                              setPastedJson('');
                            } catch (err: any) {
                              setRestoreError('Geçersiz yedekleme kodu: ' + err.message);
                            }
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
              )}
            </div>
          )}

          {/* Micro Preview Area */}
          <div className={`space-y-2 pt-4 border-t ${currentTheme.borderColor} mt-auto`}>
            <span className="text-[10px] font-extrabold uppercase tracking-widest block flex items-center gap-1 opacity-80">
              <Eye className="w-3.5 h-3.5" />
              Canlı Panel Önizlemesi
            </span>
            <div className={`p-4 rounded-xl border border-dashed ${currentTheme.borderColor} bg-black/10 space-y-2 text-center`}>
              {hasArabic && (
                <div 
                  className={`text-right leading-relaxed break-words font-medium ${arabic.fontFamily}`}
                  style={{ fontSize: `${Math.min(22, arabic.fontSize)}px`, color: arabic.textColor, direction: 'rtl' }}
                >
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ (١)
                </div>
              )}
              {hasTurkish && (
                <div 
                  className={`text-left leading-snug break-words font-medium text-xs ${turkish.fontFamily}`}
                  style={{ color: turkish.textColor }}
                >
                  Canlı önizleme örneğidir. Değişiklikler arka plana anında yansır.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer with clean direct back link */}
        <div className={`px-4 pt-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pb-4 border-t ${currentTheme.borderColor} bg-black/5`}>
          <button
            id="close-settings-save-btn"
            onClick={onClose}
            className="w-full py-2.5 bg-[#8B7E66] hover:bg-[#70644e] active:bg-[#594f3d] text-xs font-extrabold text-white rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer text-center"
          >
            Tamamdır, Sayfaya Dön
          </button>
        </div>
      </motion.div>
    </motion.div>

    {/* Sleek Custom Backup Restore Confirmation Modal inside Settings */}
    <AnimatePresence>
      {restoreSession && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-[#F5F2EA] border border-[#D9D1C2] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left text-[#2D2D2A] font-sans"
          >
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/15 text-amber-700 rounded-lg border border-amber-200">
                <Upload className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="font-extrabold text-[#2D2D2A] text-base tracking-tight">Kütüphane Yedeğini Geri Yükle</h3>
            </div>
            
            <div className="text-xs text-stone-600 leading-relaxed space-y-1.55">
              <p>Seçtiğiniz <strong>"{restoreSession.fileName}"</strong> yedek dosyası okundu.</p>
              <span className="text-amber-850 font-bold block bg-[#FF8A65]/10 p-2.5 rounded-lg border border-[#FF8A65]/35">
                ⚠️ UYARI: Mevcut tüm kitaplığınız, desteleriniz ve okuma geçmişiniz silinip bu dosyadaki verilerle değiştirilecektir. Bu işlem geri alınamaz!
              </span>
            </div>

            <div className="bg-white/60 p-3.5 rounded-xl border border-[#D9D1C2] space-y-2 text-xs font-semibold text-[#2D2D2A]">
              <div className="flex justify-between">
                <span>Kitap Sayısı:</span>
                <span className="text-[#8B7E66] font-extrabold">{restoreSession.booksCount} adet</span>
              </div>
              <div className="flex justify-between border-t border-[#D9D1C2]/30 pt-2">
                <span>Deste Sayısı:</span>
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

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  restoreBackupMetadata(restoreSession.fullBackup);
                  if (onRestoreBackup) {
                    onRestoreBackup(restoreSession.fullBackup.books, restoreSession.fullBackup.decks || []);
                  }
                  setRestoreSession(null);
                  setShowRestoreSuccess(true);
                }}
                className="w-1/2 py-2.5 bg-[#8B7E66] hover:bg-[#7a6e59] text-white font-extrabold rounded-xl text-xs transition-colors shadow-md cursor-pointer"
              >
                Onayla ve Yükle
              </button>
              <button
                type="button"
                onClick={() => setRestoreSession(null)}
                className="w-1/2 py-2.5 bg-white hover:bg-stone-100 border border-[#D9D1C2] text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
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
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]"
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
              <h3 className="font-extrabold text-[#2D2D2A] text-sm tracking-tight">Yükleme Hatası</h3>
            </div>
            
            <p className="text-xs text-rose-700 font-bold leading-relaxed bg-rose-50/50 p-3 rounded-lg border border-rose-200">
              {restoreError}
            </p>

            <button
              type="button"
              onClick={() => setRestoreError(null)}
              className="w-full py-2 bg-[#8B7E66] hover:bg-[#7a6e59] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
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
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[60]"
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
              <h3 className="font-extrabold text-[#2D2D2A] text-sm tracking-tight">Geri Yükleme Başarılı</h3>
            </div>
            
            <p className="text-xs text-stone-605 leading-relaxed">
              Harika! Kütüphane yedeğiniz başarıyla yüklendi ve tüm kitaplığınız güncellendi.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowRestoreSuccess(false);
                onClose();
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Tamam
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Custom Theme Color Delete Confirmation Dialog */}
    <AnimatePresence>
      {colorToDelete && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setColorToDelete(null)}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="bg-[#FAF8F5] rounded-3xl border border-[#D9D1C2] p-5 max-w-xs w-full shadow-2xl flex flex-col items-center gap-3 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="w-12 h-12 rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: colorToDelete }}
            >
              <span className={isDarkHex(colorToDelete) ? 'text-white' : 'text-stone-800'}>Aa</span>
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-stone-800">Özel Rengi Sil</h4>
              <p className="text-xs text-stone-500 font-mono mt-0.5 uppercase">{colorToDelete}</p>
              <p className="text-[11px] text-stone-600 mt-1.5 leading-normal">Bu rengi tema listenizden silmek istediğinize emin misiniz?</p>
            </div>
            <div className="flex items-center gap-2 w-full pt-1">
              <button
                type="button"
                onClick={() => setColorToDelete(null)}
                className="flex-1 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomColor(colorToDelete)}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Sil
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
