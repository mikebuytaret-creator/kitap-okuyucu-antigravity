/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { App as CapacitorApp } from '@capacitor/app';
import { 
  BookOpen, 
  HelpCircle, 
  Sparkles, 
  Plus, 
  GitBranch, 
  Layers,
  Settings,
  StickyNote
} from 'lucide-react';
import { Book, Page, Deck, Note } from './types';
import { 
  loadBooksFromStorage, 
  saveBooksToStorage, 
  loadDecksFromStorage,
  saveDecksToStorage,
  parseAndNormalizeBookPages 
} from './utils';
import { 
  SAMPLE_JSON_BILINGUAL, 
  SAMPLE_JSON_TURKISH, 
  SAMPLE_JSON_ARABIC 
} from './constants';
import { EMBEDDED_DATA } from './embedded_books';
import LibraryView from './components/LibraryView';
import BookDashboard from './components/BookDashboard';
import ReaderView from './components/ReaderView';
import CreateBookModal from './components/CreateBookModal';
import BookSettingsModal from './components/BookSettingsModal';
import GlobalNotesModal from './components/GlobalNotesModal';

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentView, setCurrentView] = useState<'library' | 'dashboard' | 'reader'>('library');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [initialReaderPage, setInitialReaderPage] = useState<number>(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGlobalNotesOpen, setIsGlobalNotesOpen] = useState(false);
  const [generalNotes, setGeneralNotes] = useState<Note[]>(() => {
    try {
      const saved = localStorage.getItem('dualreader_general_notes');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [globalSettings, setGlobalSettings] = useState<Book['settings']>(() => {
    const saved = localStorage.getItem('dualreader_global_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      themeId: 'cream',
      turkish: {
        fontFamily: 'font-lora',
        fontSize: 18,
        textColor: '#2c2a24'
      },
      arabic: {
        fontFamily: 'font-shaikh-hamdullah-bold',
        fontSize: 26,
        textColor: '#111827',
        separatorColor: '#d97706'
      }
    };
  });

  const handleUpdateGlobalSettings = (newSettings: Book['settings']) => {
    setGlobalSettings(newSettings);
    localStorage.setItem('dualreader_global_settings', JSON.stringify(newSettings));
  };

  const handleApplySettingsToAllBooks = (settingsToApply: Book['settings']) => {
    setGlobalSettings(settingsToApply);
    localStorage.setItem('dualreader_global_settings', JSON.stringify(settingsToApply));
    setBooks(prevBooks => {
      const updatedList = prevBooks.map(b => ({
        ...b,
        settings: JSON.parse(JSON.stringify(settingsToApply))
      }));
      saveBooksToStorage(updatedList);
      return updatedList;
    });
  };

  const virtualSettingsBook: Book = {
    id: 'global_settings_virtual',
    title: 'Görünüm Ayarları',
    createdAt: Date.now(),
    pages: [],
    bookmark: null,
    detectedLanguages: ['turkish', 'arabic'], // Always show both so user can configure both Arabic & Turkish global settings
    settings: globalSettings
  };

  // Hardware back button behavior for Android/Capacitor
  useEffect(() => {
    const handleBackButton = async () => {
      let isHandled = false;
      // 1. Dispatch a custom event to allow modals or deep components to intercept the back button
      const event = new CustomEvent('hardwareBackPress', { 
        cancelable: true,
        detail: {
          setHandled: () => { isHandled = true; }
        }
      });
      const notPrevented = window.dispatchEvent(event);

      // If a component called e.preventDefault(), it means it handled the back action (e.g. closing a drawer)
      if (!notPrevented || event.defaultPrevented || isHandled) {
        return;
      }

      // 2. Otherwise, handle global app routing
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
      } else if (isCreateModalOpen) {
        setIsCreateModalOpen(false);
      } else if (currentView === 'reader') {
        setCurrentView('dashboard'); // specifically asked to return to previous menu in app
      } else if (currentView === 'dashboard') {
        setCurrentView('library');
        setSelectedBookId(null);
      } else {
        // We are at the library. We can just exit the app.
        CapacitorApp.exitApp();
      }
    };

    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      handleBackButton();
    });

    return () => {
      backButtonListener.then(listener => listener.remove());
    };
  }, [currentView, isSettingsOpen, isCreateModalOpen]);

  // Initial hook to load books from phone storage asynchronously (IndexedDB)
  useEffect(() => {
    async function initPhoneStorage() {
      try {
        let loadedBooks = await loadBooksFromStorage();
        let loadedDecks = await loadDecksFromStorage();

        // 1. Sync Permanent Books (User requested: "şuana kadar yüklenen tüm kitapları uygulamaya göm... kalıcı düzenleyebileyim")
        import('./data/permanentBooks').then(async ({ PERMANENT_BOOKS }) => {
          if (PERMANENT_BOOKS && PERMANENT_BOOKS.length > 0) {
            // Update pages from permanent books but keep user's local changes (notes, bookmark, etc)
            const enrichedPermanentBooks = PERMANENT_BOOKS.map(pb => {
              const localCopy = loadedBooks.find(lb => lb.id === pb.id);
              if (localCopy) {
                return {
                  ...localCopy, // Keep user's modified title, cover, notes, deckId, bookmark, settings
                  pages: pb.pages, // Only update the pages from the embedded source
                  detectedLanguages: pb.detectedLanguages
                };
              }
              return pb;
            });

            // Retain local books that are not permanent
            const purelyLocalBooks = loadedBooks.filter(lb => !PERMANENT_BOOKS.some(pb => pb.id === lb.id));
            
            loadedBooks = [...enrichedPermanentBooks, ...purelyLocalBooks];
            await saveBooksToStorage(loadedBooks);
            setBooks(loadedBooks);
          }
        }).catch(err => console.error("Error loading permanent books:", err));

        // 2. Check EMBEDDED_DATA (legacy/fallback support)
        const hasEmbeddedData = EMBEDDED_DATA && Array.isArray(EMBEDDED_DATA.books) && EMBEDDED_DATA.books.length > 0;

        if (loadedBooks.length === 0) {
          if (hasEmbeddedData) {
            loadedBooks = [...EMBEDDED_DATA.books];
            loadedDecks = EMBEDDED_DATA.decks && EMBEDDED_DATA.decks.length > 0 
              ? [...EMBEDDED_DATA.decks] 
              : loadedDecks;
            
            await saveBooksToStorage(loadedBooks);
            await saveDecksToStorage(loadedDecks);
          }
        }

        setBooks(loadedBooks);
        setDecks(loadedDecks);
      } catch (err) {
        console.error('Critical database initialization error:', err);
      } finally {
        setIsInitialized(true);
      }
    }
    initPhoneStorage();
  }, []);

  // Guarantee scrolling to the absolute top of the viewport when changing views or selecting books
  // Handled by AnimatePresence's onExitComplete.

  // Create a new empty book or from direct text/json content
  const handleCreateBook = (title: string, coverImageUrl?: string, content?: string) => {
    let parsedPages: Page[] = [];
    let detectedLangs: ('turkish' | 'arabic')[] = [];
    let hasContent = false;

    if (content) {
      try {
        const result = parseAndNormalizeBookPages(content);
        parsedPages = result.pages;
        detectedLangs = result.detected;
        hasContent = true;
      } catch (err: any) {
        alert("İçerik okunamadı veya ayrıştırılamadı:\n" + err.message);
        return; // Halt creation if parsing fails
      }
    }

    const newBook: Book = {
      id: `book_${Date.now()}`,
      title,
      coverImageUrl,
      createdAt: Date.now(),
      pages: parsedPages,
      bookmark: null,
      detectedLanguages: detectedLangs,
      createdWithContent: hasContent,
      settings: { ...globalSettings }
    };
    
    setBooks(prevBooks => {
      const updatedList = [newBook, ...prevBooks];
      saveBooksToStorage(updatedList);
      return updatedList;
    });
    
    // Auto navigation to the newly created book's dashboard
    setSelectedBookId(newBook.id);
    setCurrentView('dashboard');
  };

  // Update a single book within the collection (preserves all other books' custom settings!)
  const handleUpdateBook = (updatedBook: Book) => {
    setBooks(prevBooks => {
      const updatedList = prevBooks.map(b => b.id === updatedBook.id ? updatedBook : b);
      saveBooksToStorage(updatedList);
      return updatedList;
    });
  };

  // Delete a book
  const handleDeleteBook = (id: string) => {
    setBooks(prevBooks => {
      const updatedList = prevBooks.filter(b => b.id !== id);
      saveBooksToStorage(updatedList);
      return updatedList;
    });
  };

  // Global Notes Handlers
  const handleSaveGlobalNote = (noteToSave: Note, targetBookId?: string) => {
    if (!targetBookId || targetBookId === 'general') {
      setGeneralNotes(prev => {
        const exists = prev.some(n => n.id === noteToSave.id);
        const updated = exists 
          ? prev.map(n => n.id === noteToSave.id ? noteToSave : n) 
          : [noteToSave, ...prev];
        localStorage.setItem('dualreader_general_notes', JSON.stringify(updated));
        return updated;
      });
    } else {
      setBooks(prevBooks => {
        const updatedBooks = prevBooks.map(b => {
          if (b.id === targetBookId) {
            const existingNotes = b.notes || [];
            const exists = existingNotes.some(n => n.id === noteToSave.id);
            const updatedNotes = exists
              ? existingNotes.map(n => n.id === noteToSave.id ? noteToSave : n)
              : [noteToSave, ...existingNotes];
            return { ...b, notes: updatedNotes };
          }
          return b;
        });
        saveBooksToStorage(updatedBooks);
        return updatedBooks;
      });
    }
  };

  const handleDeleteGlobalNote = (noteId: string, targetBookId?: string) => {
    if (!targetBookId || targetBookId === 'general') {
      setGeneralNotes(prev => {
        const updated = prev.filter(n => n.id !== noteId);
        localStorage.setItem('dualreader_general_notes', JSON.stringify(updated));
        return updated;
      });
    } else {
      setBooks(prevBooks => {
        const updatedBooks = prevBooks.map(b => {
          if (b.id === targetBookId) {
            return { ...b, notes: (b.notes || []).filter(n => n.id !== noteId) };
          }
          return b;
        });
        saveBooksToStorage(updatedBooks);
        return updatedBooks;
      });
    }
  };

  // Create a new empty deck
  const handleCreateDeck = (name: string) => {
    const newDeck: Deck = {
      id: `deck_${Date.now()}`,
      name,
      createdAt: Date.now()
    };
    
    setDecks(prevDecks => {
      const updated = [...prevDecks, newDeck];
      saveDecksToStorage(updated);
      return updated;
    });
  };

  // Rename a deck
  const handleRenameDeck = (deckId: string, newName: string) => {
    setDecks(prevDecks => {
      const updated = prevDecks.map(d => d.id === deckId ? { ...d, name: newName } : d);
      saveDecksToStorage(updated);
      return updated;
    });
  };

  // Delete a deck (with child content preservation choice)
  const handleDeleteDeck = (deckId: string, deleteContents: boolean) => {
    // 1. Remove deck from lists
    setDecks(prevDecks => {
      const updatedDecks = prevDecks.filter(d => d.id !== deckId);
      saveDecksToStorage(updatedDecks);
      return updatedDecks;
    });

    if (deleteContents) {
      // Delete containing books
      setBooks(prevBooks => {
        const updatedBooks = prevBooks.filter(b => b.deckId !== deckId);
        saveBooksToStorage(updatedBooks);
        return updatedBooks;
      });
    } else {
      // Just strip the deckId, books move back into unassigned lists (home screen)
      setBooks(prevBooks => {
        const updatedBooks = prevBooks.map(b => b.deckId === deckId ? { ...b, deckId: undefined } : b);
        saveBooksToStorage(updatedBooks);
        return updatedBooks;
      });
    }
  };

  // Restore whole app backup from JSON (Android friendly)
  const handleRestoreBackup = (newBooks: Book[], newDecks: Deck[]) => {
    setBooks(newBooks);
    setDecks(newDecks);
    saveBooksToStorage(newBooks);
    saveDecksToStorage(newDecks);
  };

  // Load demo pages out of the box for instantaneous offline sandbox test
  const handleLoadDemoBooks = () => {
    // 1. Bilingual Amiri + Lora demo
    const fatihaParsed = parseAndNormalizeBookPages(SAMPLE_JSON_BILINGUAL);
    const demoBook1: Book = {
      id: 'demo_fatiha',
      title: 'Fatiha Suresi ve Meali (Örnek Çift Dilli)',
      createdAt: Date.now() - 50000000,
      pages: fatihaParsed.pages,
      bookmark: 1, // Pre-seeded bookmark
      detectedLanguages: fatihaParsed.detected,
      deckId: 'deck_dualar', // Pre-seeded to the 'Dualar' default deck
      settings: {
        themeId: 'cream',
        turkish: {
          fontFamily: 'font-lora',
          fontSize: 18,
          textColor: '#433422'
        },
        arabic: {
          fontFamily: 'font-shaikh-hamdullah-bold',
          fontSize: 28,
          textColor: '#111827'
        }
      }
    };

    // 2. Turkish-only narrative short story demo
    const masalParsed = parseAndNormalizeBookPages(SAMPLE_JSON_TURKISH);
    const demoBook2: Book = {
      id: 'demo_masal',
      title: 'Gizemli Seyyah Kasabası (Örnek Tek Dilli)',
      createdAt: Date.now() - 10000000,
      pages: masalParsed.pages,
      bookmark: null,
      detectedLanguages: masalParsed.detected,
      deckId: 'deck_kitaplar', // Pre-seeded to the 'Kitaplar' default deck
      settings: {
        themeId: 'sepia',
        turkish: {
          fontFamily: 'font-playfair',
          fontSize: 20,
          textColor: '#433422'
        },
        arabic: {
          fontFamily: 'font-shaikh-hamdullah-bold',
          fontSize: 24,
          textColor: '#000000'
        }
      }
    };

    setBooks(prevBooks => {
      const updatedList = [demoBook1, demoBook2, ...prevBooks.filter(b => b.id !== 'demo_fatiha' && b.id !== 'demo_masal')];
      saveBooksToStorage(updatedList);
      return updatedList;
    });
  };

  // Active loaded book details
  const activeBook = books.find(b => b.id === selectedBookId);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#F5F2EA] flex flex-col items-center justify-center p-6 text-center select-none antialiased">
        <div className="flex flex-col items-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#E8E2D2] flex items-center justify-center shadow-inner mb-6 animate-pulse">
            <BookOpen className="w-8 h-8 text-[#8B7E66]" />
          </div>
          <h2 className="text-xl font-bold text-[#2D2D2A] tracking-tight mb-2 font-serif">DualReader</h2>
          <p className="text-sm text-[#706B5F] mb-4">Verileriniz ve kitaplığınız güvenle yükleniyor...</p>
          <div className="w-48 h-1.5 bg-[#E8E2D2] rounded-full overflow-hidden">
            <div className="h-full bg-[#8B7E66] animate-pulse rounded-full" style={{ width: '80%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5F2EA] flex flex-col font-sans antialiased text-[#2D2D2A]">
      
      {/* Immersive Mobile-Optimized Application Container */}
      <div className="flex-1 flex flex-col bg-[#F5F2EA]">
        
        {/* Core Router */}
        <AnimatePresence 
          mode="wait"
          onExitComplete={() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
            document.documentElement.scrollTop = 0;
            if (document.body) {
              document.body.scrollTop = 0;
            }
          }}
        >
          {currentView === 'library' && (
            <motion.div 
              key="library"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="flex-1"
            >
              
              {/* Elegant Frosted Header */}
              <header className="glass-panel-header px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 sticky top-0 z-20 flex items-center justify-between border-b border-[#D9D1C2]">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[#8B7E66] flex items-center justify-center text-white shadow-md shadow-[#8B7E66]/20">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="font-extrabold text-sm tracking-tight text-slate-800 block">
                      DualReader
                    </span>
                    <span className="text-[10px] text-[#8B7E66] font-bold block -mt-1">
                      Frosted Edition
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="library-notes-btn"
                    onClick={() => setIsGlobalNotesOpen(true)}
                    className="text-xs px-3 py-2 font-semibold text-slate-700 bg-white/60 hover:bg-white border border-[#D9D1C2] rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Tüm Notların Havuzu"
                  >
                    <StickyNote className="w-4 h-4 text-[#8B7E66]" /> Notlar
                  </button>
                  <button
                    id="library-create-btn-nav"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="text-xs px-3.5 py-2 font-semibold text-white bg-[#8B7E66] hover:bg-[#7a6e59] active:bg-[#6b5f4c] rounded-xl transition-all shadow-md shadow-[#8B7E66]/10 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Yeni Kitap
                  </button>
                  <button
                    id="library-settings-btn"
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2.5 rounded-xl bg-white/45 border border-[#D9D1C2]/40 hover:bg-white/70 text-stone-650 hover:border-[#8B7E66] transition-all cursor-pointer flex justify-center items-center shadow-xs shrink-0"
                    title="Yazı, Görünüm ve Yedek Ayarları"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </header>

              {/* Library Grid/Deck View */}
              <LibraryView
                books={books}
                decks={decks}
                onSelectBook={(book) => {
                  setSelectedBookId(book.id);
                  setCurrentView('dashboard');
                }}
                onAddBookTrigger={() => setIsCreateModalOpen(true)}
                onLoadDemoBooks={handleLoadDemoBooks}
                onCreateDeck={handleCreateDeck}
                onRenameDeck={handleRenameDeck}
                onDeleteDeck={handleDeleteDeck}
                onRestoreBackup={handleRestoreBackup}
              />
            </motion.div>
          )}

          {currentView === 'dashboard' && activeBook && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="flex-1 flex flex-col"
            >
              <BookDashboard
                book={activeBook}
                decks={decks}
                onBack={() => {
                  setCurrentView('library');
                  setSelectedBookId(null);
                }}
                onStartReading={(pageNum) => {
                  setInitialReaderPage(pageNum);
                  setCurrentView('reader');
                  handleUpdateBook({
                    ...activeBook,
                    lastReadAt: Date.now()
                  });
                }}
                onUpdateBook={handleUpdateBook}
                onDeleteBook={handleDeleteBook}
              />
            </motion.div>
          )}

          {currentView === 'reader' && activeBook && (
            <motion.div 
              key="reader"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="flex-1 flex flex-col"
            >
              <ReaderView
                book={activeBook}
                onBack={() => {
                  // sayfa kapanışında kitaba değil direkt anasayfaya (library) gidilsin
                  setCurrentView('library');
                  setSelectedBookId(null);
                }}
                onUpdateBook={handleUpdateBook}
                initialPageNum={initialReaderPage}
                allBooks={books}
                allDecks={decks}
                onRestoreBackup={handleRestoreBackup}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Floating global footer for library index */}
      {currentView === 'library' && (
        <footer className="bg-white/30 backdrop-blur-md border-t border-[#D9D1C2]/50 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pb-4 pt-4 px-6 text-center text-[10px] text-[#8B7E66] font-semibold">
          Veriler telefonda yerel olarak saklanır. İnternet bağlantısı gerektirmez.
        </footer>
      )}

      {/* Create Book Dialog */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <CreateBookModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onCreate={handleCreateBook}
          />
        )}
      </AnimatePresence>

      {/* Global Book Settings Modal (Accessible directly from Library View) */}
      <AnimatePresence>
        {isSettingsOpen && virtualSettingsBook && (
          <BookSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            book={virtualSettingsBook}
            onUpdateSettings={handleUpdateGlobalSettings}
            onApplyToAllBooks={handleApplySettingsToAllBooks}
            allBooks={books}
            allDecks={decks}
            onRestoreBackup={handleRestoreBackup}
          />
        )}
      </AnimatePresence>

      {/* Global Notes Pool Modal */}
      <AnimatePresence>
        {isGlobalNotesOpen && (
          <GlobalNotesModal
            isOpen={isGlobalNotesOpen}
            onClose={() => setIsGlobalNotesOpen(false)}
            books={books}
            generalNotes={generalNotes}
            onSaveNote={handleSaveGlobalNote}
            onDeleteNote={handleDeleteGlobalNote}
            onSelectBook={(bookId) => {
              setSelectedBookId(bookId);
              setCurrentView('dashboard');
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
