import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  BookOpen, 
  Check, 
  StickyNote, 
  ArrowDownUp, 
  FileText,
  Filter,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { Book, Note } from '../types';

export interface EnrichedNote extends Note {
  bookId?: string;
  bookTitle?: string;
}

interface GlobalNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  generalNotes: Note[];
  onSaveNote: (note: Note, targetBookId?: string) => void;
  onDeleteNote: (noteId: string, targetBookId?: string) => void;
  onSelectBook: (bookId: string) => void;
}

export default function GlobalNotesModal({
  isOpen,
  onClose,
  books,
  generalNotes,
  onSaveNote,
  onDeleteNote,
  onSelectBook
}: GlobalNotesModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  // Note creation / editing state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<EnrichedNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [targetBookId, setTargetBookId] = useState<string>('general');
  const [deleteConfirmId, setDeleteConfirmId] = useState<{ id: string; bookId?: string } | null>(null);

  // Aggregate all notes from all books plus general notes
  const allNotes = useMemo(() => {
    const list: EnrichedNote[] = [];

    // 1. General independent notes
    generalNotes.forEach(gn => {
      list.push({
        ...gn,
        bookId: 'general',
        bookTitle: 'Genel Notlar'
      });
    });

    // 2. Book-specific notes
    books.forEach(b => {
      if (b.notes && Array.isArray(b.notes)) {
        b.notes.forEach(bn => {
          list.push({
            ...bn,
            bookId: b.id,
            bookTitle: b.title
          });
        });
      }
    });

    return list;
  }, [books, generalNotes]);

  // Filtered and sorted notes
  const filteredNotes = useMemo(() => {
    let result = allNotes;

    // Filter by book dropdown
    if (selectedBookFilter !== 'all') {
      result = result.filter(n => n.bookId === selectedBookFilter);
    }

    // Filter by global search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.content.toLowerCase().includes(q) ||
        (n.bookTitle && n.bookTitle.toLowerCase().includes(q))
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortOrder === 'newest') return b.createdAt - a.createdAt;
      return a.createdAt - b.createdAt;
    });
  }, [allNotes, selectedBookFilter, searchQuery, sortOrder]);

  if (!isOpen) return null;

  const handleOpenCreateForm = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setTargetBookId(selectedBookFilter !== 'all' ? selectedBookFilter : 'general');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (note: EnrichedNote) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setTargetBookId(note.bookId || 'general');
    setIsFormOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    const noteToSave: Note = {
      id: editingNote ? editingNote.id : `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: noteTitle.trim(),
      content: noteContent.trim(),
      createdAt: editingNote ? editingNote.createdAt : Date.now(),
      bookId: targetBookId !== 'general' ? targetBookId : undefined
    };

    onSaveNote(noteToSave, targetBookId);
    setIsFormOpen(false);
    setEditingNote(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-3xl bg-[#FAF8F5] rounded-3xl shadow-2xl border border-[#D9D1C2] overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#D9D1C2]/60 bg-white/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B7E66]/15 flex items-center justify-center text-[#8B7E66]">
                <StickyNote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <span>Not Havuzu</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#8B7E66]/10 text-[#8B7E66] font-mono font-bold">
                    {allNotes.length} Not
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Tüm kitaplardaki ve genel havuzdaki notlarınız</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCreateForm}
                className="px-3.5 py-2 text-xs font-bold text-white bg-[#8B7E66] hover:bg-[#746852] rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Yeni Not
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 bg-white/40 border-b border-[#D9D1C2]/50 flex flex-col sm:flex-row items-center gap-2.5">
            {/* Global Search Input */}
            <div className="relative flex-1 w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Tüm notlarda başlık veya içerik ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-medium pl-9 pr-8 py-2 bg-white border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:border-[#8B7E66] focus:ring-1 focus:ring-[#8B7E66]/20 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Book Filter Dropdown */}
              <div className="relative flex-1 sm:w-56">
                <select
                  value={selectedBookFilter}
                  onChange={(e) => setSelectedBookFilter(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-[#D9D1C2] rounded-xl text-slate-700 focus:outline-hidden focus:border-[#8B7E66] cursor-pointer shadow-xs truncate"
                >
                  <option value="all">Tüm Kitaplar & Notlar ({allNotes.length})</option>
                  <option value="general">Genel Notlar ({generalNotes.length})</option>
                  {books.map(b => {
                    const count = b.notes?.length || 0;
                    return (
                      <option key={b.id} value={b.id}>
                        {b.title} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Sort toggle */}
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                className="px-3 py-2 bg-white border border-[#D9D1C2] rounded-xl text-xs font-semibold text-slate-600 hover:text-black flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                title="Sıralamayı değiştir"
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-[#8B7E66]" />
                <span>{sortOrder === 'newest' ? 'Yeni' : 'Eski'}</span>
              </button>
            </div>
          </div>

          {/* Notes Content Area */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
            
            {/* Create / Edit Form Modal inside */}
            {isFormOpen && (
              <form 
                onSubmit={handleSubmitForm} 
                className="p-4 bg-white rounded-2xl border-2 border-[#8B7E66]/40 shadow-md space-y-3 animate-in fade-in"
              >
                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-[#8B7E66]" />
                    {editingNote ? 'Notu Düzenle' : 'Yeni Not Ekle'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingNote(null);
                    }}
                    className="text-xs text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    Vazgeç
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Ait Olduğu Kitap</label>
                  <select
                    value={targetBookId}
                    onChange={(e) => setTargetBookId(e.target.value)}
                    className="w-full text-xs font-semibold p-2 bg-stone-50 border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:border-[#8B7E66]"
                  >
                    <option value="general">Genel / Bağımsız Not</option>
                    {books.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Not Başlığı</label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Not başlığını girin..."
                    className="w-full text-xs font-bold p-2.5 bg-stone-50 border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:border-[#8B7E66]"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Not İçeriği</label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={4}
                    placeholder="Not detaylarını buraya yazın..."
                    className="w-full text-xs p-2.5 bg-stone-50 border border-[#D9D1C2] rounded-xl focus:outline-hidden focus:border-[#8B7E66] resize-none leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingNote(null);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-stone-100 rounded-xl hover:bg-stone-200 cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={!noteTitle.trim()}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-[#8B7E66] hover:bg-[#746852] disabled:opacity-50 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Kaydet
                  </button>
                </div>
              </form>
            )}

            {/* Note Cards List */}
            {filteredNotes.length === 0 ? (
              <div className="py-16 text-center rounded-2xl border border-dashed border-[#D9D1C2] bg-white/20 flex flex-col items-center justify-center space-y-2">
                <StickyNote className="w-10 h-10 text-[#8B7E66] opacity-40 animate-pulse" />
                <p className="text-xs font-bold text-slate-600">
                  {searchQuery ? 'Aramaya uygun not bulunamadı.' : 'Henüz not eklenmemiş.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Yukarıdaki "Yeni Not" butonuna basarak ilk notunuzu ekleyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredNotes.map((note) => {
                  const isGeneral = !note.bookId || note.bookId === 'general';
                  const isDeleting = deleteConfirmId?.id === note.id;

                  return (
                    <div
                      key={note.id}
                      className="p-4 bg-white/70 hover:bg-white border border-[#D9D1C2] hover:border-[#8B7E66] transition-all rounded-2xl shadow-xs flex flex-col justify-between gap-3 group"
                    >
                      <div className="space-y-1.5">
                        {/* Book Badge & Actions */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[200px] ${
                            isGeneral 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-[#8B7E66]/10 text-[#8B7E66] border border-[#8B7E66]/20'
                          }`}>
                            {note.bookTitle || 'Genel Not'}
                          </span>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(note)}
                              className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg cursor-pointer"
                              title="Notu Düzenle"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId({ id: note.id, bookId: note.bookId })}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Notu Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="font-bold text-sm text-slate-800 leading-snug whitespace-pre-wrap break-words">
                          {note.title}
                        </h4>

                        {/* Content */}
                        {note.content && (
                          <p className="text-xs text-slate-600 whitespace-pre-wrap break-words leading-relaxed pt-1 border-t border-stone-100">
                            {note.content}
                          </p>
                        )}
                      </div>

                      {/* Footer: Date & Jump to book button */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#D9D1C2]/40 text-[10px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#8B7E66]" />
                          {new Date(note.createdAt).toLocaleDateString('tr-TR', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>

                        {!isGeneral && note.bookId && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onSelectBook(note.bookId!);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-[#8B7E66] hover:text-[#6a5e4b] cursor-pointer"
                            title="Bu Kitabı Aç"
                          >
                            <span>Kitaba Git</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Delete Confirmation mini overlay */}
                      {isDeleting && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 mt-1 animate-in fade-in">
                          <p className="text-[11px] font-bold text-rose-800">Bu not silinsin mi?</p>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2.5 py-1 text-[10px] font-bold bg-white text-slate-700 rounded-lg border border-rose-200 cursor-pointer"
                            >
                              İptal
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteNote(note.id, note.bookId);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-lg cursor-pointer"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[#D9D1C2]/60 bg-white/60 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>
              Gösterilen: <b className="text-slate-800 font-bold">{filteredNotes.length}</b> / {allNotes.length} Not
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-stone-100 border border-[#D9D1C2] rounded-xl text-slate-700 font-bold cursor-pointer transition-colors"
            >
              Kapat
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
