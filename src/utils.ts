/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, Page, Deck, AppBackupData } from './types';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/**
 * Normalizes user-supplied JSON structures to ensure smooth rendering of Arabic and Turkish text.
 * It searches for standard synonyms for pages, arabic text, and turkish text.
 */
export function parseAndNormalizeBookPages(jsonString: string): { pages: Page[]; detected: ('turkish' | 'arabic')[] } {
  try {
    const rawData = JSON.parse(jsonString);
    if (!Array.isArray(rawData)) {
      throw new Error('JSON girdisi bir liste (array) olmalıdır. Örn: [ { "page": 1, ... } ]');
    }

    const pages: Page[] = [];
    const detectedSet = new Set<'turkish' | 'arabic'>();

    rawData.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) return;

      // Find page number
      let pageNum: string | number = index + 1;
      const pageKey = Object.keys(item).find(k => 
        k.toLowerCase() === 'page' || 
        k.toLowerCase() === 'sayfa' || 
        k.toLowerCase() === 'no' || 
        k.toLowerCase() === 'sira'
      );
      if (pageKey && item[pageKey] !== undefined && item[pageKey] !== null) {
        const val = item[pageKey];
        if (typeof val === 'number') {
          pageNum = val;
        } else {
          pageNum = String(val).trim();
        }
      }

      // Find Turkish text
      let turkishText: string | undefined;
      const turkishKey = Object.keys(item).find(k => 
        k.toLowerCase() === 'turkish' || 
        k.toLowerCase() === 'turkce' || 
        k.toLowerCase() === 'türkçe' || 
        k.toLowerCase() === 'tr' ||
        k.toLowerCase() === 'turko'
      );
      if (turkishKey && item[turkishKey]) {
        turkishText = String(item[turkishKey]).trim();
        if (turkishText) detectedSet.add('turkish');
      }

      // Find Arabic/Arabish text
      let arabicText: string | undefined;
      const arabicKey = Object.keys(item).find(k => 
        k.toLowerCase() === 'arabic' || 
        k.toLowerCase() === 'arabish' || 
        k.toLowerCase() === 'arapca' || 
        k.toLowerCase() === 'arapça' || 
        k.toLowerCase() === 'ar' ||
        k.toLowerCase() === 'arabictext'
      );
      if (arabicKey && item[arabicKey]) {
        arabicText = String(item[arabicKey]).trim();
        if (arabicText) detectedSet.add('arabic');
      }

      // Only add page if it has some content
      if (turkishText || arabicText) {
        pages.push({
          page: pageNum,
          turkish: turkishText,
          arabic: arabicText
        });
      }
    });

    // Sort pages by page representation: numerically if possible, otherwise alphanumerically
    pages.sort((a, b) => {
      const numA = Number(a.page);
      const numB = Number(b.page);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return String(a.page).localeCompare(String(b.page), undefined, { numeric: true, sensitivity: 'base' });
    });

    return {
      pages,
      detected: Array.from(detectedSet)
    };
  } catch (error: any) {
    // If the input is empty or just whitespace, rethrow error
    if (!jsonString || !jsonString.trim()) {
      throw new Error('Girilen metin boş veya okunabilir karakter içermiyor.');
    }

    // Treat the input as plain text and parse as a single page
    const lines = jsonString.split(/\r?\n/);
    const turkishLines: string[] = [];
    const arabicLines: string[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const possessesArabic = /[\u0600-\u06FF]/.test(trimmed);
      if (possessesArabic) {
        arabicLines.push(trimmed);
      } else {
        turkishLines.push(trimmed);
      }
    });

    const turkishText = turkishLines.join('\n');
    const arabicText = arabicLines.join('\n');

    if (!turkishText && !arabicText) {
      throw new Error('İçerik ayrıştırılamadı. Lütfen geçerli bir metin veya JSON girin.');
    }

    const detectedSet = new Set<'turkish' | 'arabic'>();
    if (turkishText) detectedSet.add('turkish');
    if (arabicText) detectedSet.add('arabic');

    return {
      pages: [
        {
          page: 1,
          turkish: turkishText || undefined,
          arabic: arabicText || undefined
        }
      ],
      detected: Array.from(detectedSet)
    };
  }
}

/**
 * Generate a random soft visual color for a custom book cover pattern design.
 */
export function getRandomCoverGradient(id: string): string {
  const gradients = [
    'from-amber-600 to-amber-900',
    'from-emerald-600 to-emerald-900',
    'from-teal-600 to-teal-900',
    'from-indigo-600 to-indigo-900',
    'from-slate-600 to-slate-900',
    'from-rose-600 to-rose-900',
    'from-cyan-600 to-cyan-900',
    'from-amber-700 to-[#433422]',
  ];
  
  // Deterministic select based on id hash
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

/**
 * Core database configurations & helpers using asynchronous IndexedDB.
 * This guarantees unlimited local storage space (up to hundreds of MBs on mobile & desktop WebViews),
 * resolving the 5MB browser QuotaExceededError completely.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported on this platform/browser.'));
      return;
    }

    const request = indexedDB.open('KitapOkuyucuDB', 2); // Version 2

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('decks')) {
        db.createObjectStore('decks', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error || new Error('Failed to open database'));
    };
  });
}

/**
 * Migration helper to smoothly port any existing books and decks from localStorage to IndexedDB
 * during the migration phase on client devices, deleting the localStorage items only after success.
 */
async function migrateLocalStorageIfAny(db: IDBDatabase): Promise<void> {
  const localBooksStr = localStorage.getItem('kitap_okuyucu_books');
  const localDecksStr = localStorage.getItem('kitap_okuyucu_decks');

  if (localBooksStr) {
    try {
      const books = JSON.parse(localBooksStr);
      if (Array.isArray(books) && books.length > 0) {
        await saveBooksToIndexedDB(db, books);
        localStorage.removeItem('kitap_okuyucu_books');
        console.info('Successfully migrated all books from localStorage to IndexedDB storage.');
      } else {
        localStorage.removeItem('kitap_okuyucu_books');
      }
    } catch (e) {
      console.error('Failed to migrate books from localStorage', e);
    }
  }

  if (localDecksStr) {
    try {
      const decks = JSON.parse(localDecksStr);
      if (Array.isArray(decks) && decks.length > 0) {
        await saveDecksToIndexedDB(db, decks);
        localStorage.removeItem('kitap_okuyucu_decks');
        console.info('Successfully migrated all collections/decks from localStorage to IndexedDB storage.');
      } else {
        localStorage.removeItem('kitap_okuyucu_decks');
      }
    } catch (e) {
      console.error('Failed to migrate decks from localStorage', e);
    }
  }
}

async function saveBooksToIndexedDB(db: IDBDatabase, books: Book[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('books', 'readwrite');
    const store = transaction.objectStore('books');

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    store.clear();
    for (const book of books) {
      store.put(book);
    }
  });
}

async function saveDecksToIndexedDB(db: IDBDatabase, decks: Deck[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('decks', 'readwrite');
    const store = transaction.objectStore('decks');

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    store.clear();
    for (const deck of decks) {
      store.put(deck);
    }
  });
}

/**
 * Persists high value books to IndexedDB database asynchronously.
 */
export async function loadBooksFromStorage(): Promise<Book[]> {
  try {
    const db = await openDB();
    await migrateLocalStorageIfAny(db);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('books', 'readonly');
      const store = transaction.objectStore('books');
      const request = store.getAll();

      request.onsuccess = () => {
        const books = request.result || [];
        // Sort books by createdAt descending so newest is first
        books.sort((a: Book, b: Book) => b.createdAt - a.createdAt);
        resolve(books);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to retrieve books from IndexedDB.'));
      };
    });
  } catch (e) {
    console.error('Error loading books from IndexedDB storage, trying fallback', e);
    try {
      const data = localStorage.getItem('kitap_okuyucu_books');
      if (data) {
        return JSON.parse(data);
      }
    } catch (localErr) {
      console.error('LocalStorage fallback load failed', localErr);
    }
    return [];
  }
}

export async function saveBooksToStorage(books: Book[]): Promise<void> {
  try {
    const db = await openDB();
    await saveBooksToIndexedDB(db, books);
  } catch (e: any) {
    console.error('Error saving books to database storage', e);
    // Graceful fallback to localStorage if IndexedDB is blocked
    try {
      localStorage.setItem('kitap_okuyucu_books', JSON.stringify(books));
    } catch (localErr) {
      console.error('Local storage backup save failed (potentially exceeded quota):', localErr);
      throw new Error('Depolama kotası doldu! Kitap boyutu çok büyük olduğu için kaydedilemedi.');
    }
  }
}

/**
 * Persists high value decks/collections to IndexedDB database asynchronously.
 */
export async function loadDecksFromStorage(): Promise<Deck[]> {
  try {
    const db = await openDB();
    await migrateLocalStorageIfAny(db);
    const decks = await new Promise<Deck[]>((resolve, reject) => {
      const transaction = db.transaction('decks', 'readonly');
      const store = transaction.objectStore('decks');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to retrieve decks.'));
      };
    });

    if (decks.length > 0) {
      const hasSureler = decks.some(d => d.id === 'deck_sureler');
      if (!hasSureler) {
        decks.push({ id: 'deck_sureler', name: 'Sureler', createdAt: Date.now() });
        await saveDecksToStorage(decks).catch(console.error);
      }
      return decks;
    }
  } catch (e) {
    console.error('Error loading decks from storage, trying fallback', e);
    try {
      const data = localStorage.getItem('kitap_okuyucu_decks');
      if (data) {
        const parsedDecks = JSON.parse(data);
        if (Array.isArray(parsedDecks)) {
          const hasSureler = parsedDecks.some(d => d.id === 'deck_sureler');
          if (!hasSureler) {
            parsedDecks.push({ id: 'deck_sureler', name: 'Sureler', createdAt: Date.now() });
            localStorage.setItem('kitap_okuyucu_decks', JSON.stringify(parsedDecks));
          }
          return parsedDecks;
        }
      }
    } catch (localErr) {
      console.error('LocalStorage fallback count failed', localErr);
    }
  }

  // Seed default decks (Dualar and Kitaplar and Sureler)
  const defaultDecks: Deck[] = [
    { id: 'deck_dualar', name: 'Dualar', createdAt: Date.now() - 10000 },
    { id: 'deck_kitaplar', name: 'Kitaplar', createdAt: Date.now() - 5000 },
    { id: 'deck_sureler', name: 'Sureler', createdAt: Date.now() - 2000 }
  ];
  try {
    await saveDecksToStorage(defaultDecks);
  } catch (saveErr) {
    console.error('Failed to save default seeded decks', saveErr);
  }
  return defaultDecks;
}

export async function saveDecksToStorage(decks: Deck[]): Promise<void> {
  try {
    const db = await openDB();
    await saveDecksToIndexedDB(db, decks);
  } catch (e) {
    console.error('Error saving decks to database storage', e);
    try {
      localStorage.setItem('kitap_okuyucu_decks', JSON.stringify(decks));
    } catch (localErr) {
      console.error('LocalStorage fallback write for decks failed', localErr);
    }
  }
}

/**
 * Compresses a user-uploaded cover image to a maximum dimension of 300x450 jpeg,
 * keeping its base64 footprint extremely small (typically ~10KB - 30KB) instead of several megabytes.
 * This guarantees we will never hit the localStorage quota.
 */
export function compressCoverImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 450;
        
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl); // Fallback to raw if canvas context is not available
          return;
        }
        
        // Use high-quality resizing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export as compressed JPEG
        const compressed = canvas.toDataURL('image/jpeg', 0.75);
        resolve(compressed);
      };
      img.onerror = () => {
        resolve(dataUrl); // Fallback on image error
      };
      img.src = dataUrl;
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Normalizes strings by lowercasing and replacing Turkish/Arabic circumflexed/special chars
 * with standard basic characters to allow fuzzy/flexible searching.
 * Examples: â -> a, î -> i, û -> u, Kur’ân -> kuran, te’vil -> tevil, hafî -> hafi
 */
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[âäàáã]/g, 'a')
    .replace(/[îïìí]/g, 'i')
    .replace(/[ûüùú]/g, 'u')
    .replace(/[öòóõ]/g, 'o')
    .replace(/[ş]/g, 's')
    .replace(/[ğ]/g, 'g')
    .replace(/[ç]/g, 'c')
    .replace(/[ıìíïî]/g, 'i')
    .replace(/[êëèé]/g, 'e')
    // remove all kinds of apostrophes, quotation marks, and similar punctuation
    .replace(/['’‘`"„“‟]/g, '')
    // remove Arabic diacritics / tashkeel / harakah / tanween / keshida / tatweel if any
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .trim();
}

/**
 * Finds start and end indices of matches in the original string using normalized string matching.
 * This is incredibly robust because it preserves formatting, casing, and special letters in the output while
 * matching the simplified search query from the user.
 */
export function findNormalizedMatches(originalText: string, query: string): { start: number; end: number }[] {
  const normQuery = normalizeText(query);
  if (!normQuery) return [];
  
  // Build the normalized version character by character and track original indices
  let normalizedText = '';
  const origIndices: number[] = [];
  
  for (let i = 0; i < originalText.length; i++) {
    const char = originalText[i];
    const normChar = normalizeText(char);
    if (normChar !== '') {
      for (let j = 0; j < normChar.length; j++) {
        normalizedText += normChar[j];
        origIndices.push(i);
      }
    }
  }
  
  const matches: { start: number; end: number }[] = [];
  let pos = normalizedText.indexOf(normQuery);
  while (pos !== -1) {
    const normStart = pos;
    const normEnd = pos + normQuery.length - 1;
    
    // Map back to original indices safely
    const origStart = origIndices[normStart];
    // For end, map to the character index. Since slice is exclusive, we use origIndices[normEnd] + 1
    const origEnd = origIndices[normEnd] + 1;
    
    matches.push({ start: origStart, end: origEnd });
    pos = normalizedText.indexOf(normQuery, pos + 1);
  }
  
  return matches;
}

/**
 * Robustly copies text to the system clipboard, with full backward compatibility fallback for 
 * WebViews / non-secure contexts (e.g., inside hybrid Android APK containers).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try fallback first for robust synchronous execution in WebViews/Safari
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {
    console.warn("Fallback copy failed, trying modern API:", err);
  }

  // Modern API as a second attempt
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.error("Modern clipboard API failed:", e);
    }
  }

  return false;
}

/**
 * Robustly downloads a file using Blob. 
 * Note: Data URIs and File Sharing are avoided here because large JSON files
 * can crash Android WebViews (TransactionTooLargeException) or run out of memory.
 */
export async function downloadFile(content: string, filename: string): Promise<boolean> {
  // Try to use Capacitor Filesystem if running natively on Android/iOS
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      console.log('File successfully saved with Capacitor:', result.uri);
      
      // Fallback for user notification about where the file went (since standard downloads show a prompt)
      try {
        alert('Yedek dosyası kaydedildi: ' + result.uri);
      } catch (e) {
        // Ignore alert errors if it's somehow not available
      }
      return true;
    } catch (error) {
      console.error('Error saving file with Capacitor:', error);
      return false;
    }
  }

  // Web fallback (Blob download)
  try {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    return true;
  } catch (err) {
    console.warn("Blob download failed", err);
    return false;
  }
}

/**
 * Creates a comprehensive backup payload containing books, decks, bookmarks,
 * book notes, general notes pool, individual/global text settings, themes, and counters.
 */
export function createFullBackupPayload(books: Book[], decks: Deck[]): AppBackupData {
  let generalNotes: any[] = [];
  try {
    const rawNotes = localStorage.getItem('dualreader_general_notes');
    if (rawNotes) generalNotes = JSON.parse(rawNotes);
  } catch (e) {}

  let globalSettings: any = undefined;
  try {
    const rawSettings = localStorage.getItem('dualreader_global_settings');
    if (rawSettings) globalSettings = JSON.parse(rawSettings);
  } catch (e) {}

  let favoriteThemes: string[] = [];
  try {
    const rawFav = localStorage.getItem('favorite_themes');
    if (rawFav) favoriteThemes = JSON.parse(rawFav);
  } catch (e) {}

  // Collect mini counters for each book
  const counters: Record<string, any> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dualreader_counter_')) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            counters[key] = JSON.parse(val);
          } catch (e) {
            counters[key] = val;
          }
        }
      }
    }
  } catch (e) {}

  return {
    version: '2.0',
    books,
    decks: decks || [],
    generalNotes,
    globalSettings,
    favoriteThemes,
    counters,
    exportedAt: Date.now()
  };
}

/**
 * Restores full backup metadata (general notes, global settings, favorite themes, counters)
 * into localStorage when importing a backup file.
 */
export function restoreBackupMetadata(data: AppBackupData): void {
  if (data.generalNotes && Array.isArray(data.generalNotes)) {
    try {
      localStorage.setItem('dualreader_general_notes', JSON.stringify(data.generalNotes));
    } catch (e) {}
  }
  if (data.globalSettings) {
    try {
      localStorage.setItem('dualreader_global_settings', JSON.stringify(data.globalSettings));
    } catch (e) {}
  }
  if (data.favoriteThemes && Array.isArray(data.favoriteThemes)) {
    try {
      localStorage.setItem('favorite_themes', JSON.stringify(data.favoriteThemes));
    } catch (e) {}
  }
  if (data.counters && typeof data.counters === 'object') {
    try {
      Object.entries(data.counters).forEach(([key, val]) => {
        if (typeof val === 'string') {
          localStorage.setItem(key, val);
        } else {
          localStorage.setItem(key, JSON.stringify(val));
        }
      });
    } catch (e) {}
  }
}

/**
 * Regex matching Arabic sentence separators, verse markers, circled digits, and ornate symbols
 */
export const ARABIC_SEPARATOR_REGEX = /(۝[\u0660-\u0669\u06F0-\u06F9\d]*|[﴿﴾\(\[\{][\s]*[\u0660-\u0669\u06F0-\u06F9\d]+[\s]*[﴿﴾\)\]\}]|[\u2460-\u24FF\u3251-\u32BF]|[۞۩❖✦✧♦★✪])/gu;

export function isArabicSeparator(str: string): boolean {
  if (!str) return false;
  return /^(۝[\u0660-\u0669\u06F0-\u06F9\d]*|[﴿﴾\(\[\{][\s]*[\u0660-\u0669\u06F0-\u06F9\d]+[\s]*[﴿﴾\)\]\}]|[\u2460-\u24FF\u3251-\u32BF]|[۞۩❖✦✧♦★✪])$/u.test(str.trim());
}

