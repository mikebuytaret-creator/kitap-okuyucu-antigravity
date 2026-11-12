import { Book } from '../types';
import { SAMPLE_JSON_BILINGUAL, SAMPLE_JSON_TURKISH, SAMPLE_JSON_ARABIC } from '../constants';

const FatihaSuresi: Book = {
  id: 'perm_book_1',
  title: 'El-Fatiha Suresi',
  createdAt: 0,
  pages: JSON.parse(SAMPLE_JSON_BILINGUAL),
  bookmark: null,
  detectedLanguages: ['arabic', 'turkish'],
  settings: {
    themeId: 'cream',
    turkish: {
      fontSize: 18,
      fontFamily: 'font-sans',
      textColor: '#2c2a24'
    },
    arabic: {
      fontSize: 28,
      fontFamily: 'font-shaikh-hamdullah',
      textColor: '#2c2a24'
    }
  }
};

const Masallar: Book = {
  id: 'perm_book_2',
  title: 'Türkçe Masallar',
  createdAt: 1,
  pages: JSON.parse(SAMPLE_JSON_TURKISH),
  bookmark: null,
  detectedLanguages: ['turkish'],
  settings: {
    themeId: 'cream',
    turkish: {
      fontSize: 18,
      fontFamily: 'font-sans',
      textColor: '#2c2a24'
    },
    arabic: {
      fontSize: 28,
      fontFamily: 'font-shaikh-hamdullah',
      textColor: '#2c2a24'
    }
  }
};

const ArapcaHikayeler: Book = {
  id: 'perm_book_3',
  title: 'Arapça Hikayeler',
  createdAt: 2,
  pages: JSON.parse(SAMPLE_JSON_ARABIC),
  bookmark: null,
  detectedLanguages: ['arabic'],
  settings: {
    themeId: 'cream',
    turkish: {
      fontSize: 18,
      fontFamily: 'font-sans',
      textColor: '#2c2a24'
    },
    arabic: {
      fontSize: 28,
      fontFamily: 'font-shaikh-hamdullah',
      textColor: '#2c2a24'
    }
  }
};

// Buraya kalıcı kitaplarınızı ekleyebilirsiniz.
export const PERMANENT_BOOKS: Book[] = [];
