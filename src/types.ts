/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Page {
  page: string | number;
  turkish?: string;
  arabic?: string; // Normalized from arabic/arabish
}

export interface LanguageSettings {
  fontFamily: string;
  fontSize: number; // in pixels (e.g. 16, 18, 20, 24, 28, 32)
  textColor: string; // hex or color class
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number; // relative line-height multiplier e.g. 1.4, 1.8, 2.2, 2.6
  separatorColor?: string; // Hex or color value for Arabic sentence separators / verse markers
}

export interface ReadingTheme {
  id: string;
  name: string;
  bgColor: string; // Tailwind bg class
  cardBg: string; // Tailwind card background
  textColor: string; // Default text color class for general UI
  borderColor: string;
  bgHex?: string; // Hex color for immediate background styling
}

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  bookId?: string;
  bookTitle?: string;
}

export interface Book {
  id: string;
  title: string;
  coverImageUrl?: string; // Small thumbnail image url chosen by user
  createdAt: number;
  lastReadAt?: number;
  pages: Page[];
  bookmark: string | number | null; // Page number currently bookmarked
  detectedLanguages: ('turkish' | 'arabic')[];
  deckId?: string; // ID of the deck/collection it belongs to
  createdWithContent?: boolean; // True if content (JSON/Plaintext) was loaded during book creation
  notes?: Note[];
  settings: {
    themeId: string;
    customThemeColor?: string; // Optional custom hex background color (e.g. #FAF0E6, #1A1A24)
    lineByLine?: boolean; // When true: renders sentences / verses stacked vertically line-by-line
    turkish: LanguageSettings;
    arabic: LanguageSettings;
  };
}

export interface AppBackupData {
  version: string;
  books: Book[];
  decks: Deck[];
  generalNotes?: Note[];
  globalSettings?: Book['settings'];
  favoriteThemes?: string[];
  customThemes?: string[]; // User-added custom theme hex codes
  counters?: Record<string, any>;
  exportedAt: number;
}
