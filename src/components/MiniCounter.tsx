import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Minus, 
  RotateCcw, 
  Settings, 
  X, 
  Clock, 
  History, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Trash2,
  Move
} from 'lucide-react';

export interface CounterLogItem {
  id: string;
  count: number;
  timestamp: number;
  timeFormatted: string;
  fullDateFormatted: string;
  deltaMs: number | null;
  deltaFormatted: string;
}

interface MiniCounterProps {
  bookId: string;
  isOpen: boolean;
  onClose: () => void;
}

function formatTimestampWithMs(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

function formatFullDateWithMs(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year} ${formatTimestampWithMs(date)}`;
}

function formatDelta(deltaMs: number | null): string {
  if (deltaMs === null) return 'İlk Basış';
  if (deltaMs < 1000) {
    return `+${deltaMs} ms`;
  }
  const totalSeconds = deltaMs / 1000;
  if (totalSeconds < 60) {
    return `+${totalSeconds.toFixed(2)} sn`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const remSec = (totalSeconds % 60).toFixed(2);
  return `+${mins} dk ${remSec} sn`;
}

let sharedAudioCtx: AudioContext | null = null;

function playCounterClickSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    const ctx = sharedAudioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Natural mechanical tactile click
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch (e) {
    // AudioContext might be blocked until user gesture, ignore
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
  } catch (e) {}
}

export default function MiniCounter({ bookId, isOpen, onClose }: MiniCounterProps) {
  const storageKey = `dualreader_counter_${bookId}`;

  const [count, setCount] = useState<number>(0);
  const [logs, setLogs] = useState<CounterLogItem[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [customInputVal, setCustomInputVal] = useState('');
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const [tapEffect, setTapEffect] = useState(false);

  // Load state from localStorage on mount or when bookId changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCount(typeof parsed.count === 'number' ? parsed.count : 0);
        setLogs(Array.isArray(parsed.logs) ? parsed.logs : []);
      } else {
        setCount(0);
        setLogs([]);
      }
    } catch (e) {
      setCount(0);
      setLogs([]);
    }
  }, [bookId, storageKey]);

  // Persist state to localStorage on changes
  const saveState = (newCount: number, newLogs: CounterLogItem[]) => {
    setCount(newCount);
    setLogs(newLogs);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ count: newCount, logs: newLogs }));
    } catch (e) {
      console.error('Failed to save counter state', e);
    }
  };

  // Main tap handler: increments count by 1 and records precise timestamp with delta
  const handleIncrement = () => {
    const now = Date.now();
    const nowDate = new Date(now);
    const newCount = count + 1;

    let deltaMs: number | null = null;
    if (logs.length > 0) {
      const lastLog = logs[0]; // newest is at index 0
      deltaMs = Math.max(0, now - lastLog.timestamp);
    }

    const newLogItem: CounterLogItem = {
      id: `${now}_${Math.random().toString(36).substring(2, 6)}`,
      count: newCount,
      timestamp: now,
      timeFormatted: formatTimestampWithMs(nowDate),
      fullDateFormatted: formatFullDateWithMs(nowDate),
      deltaMs,
      deltaFormatted: formatDelta(deltaMs)
    };

    const updatedLogs = [newLogItem, ...logs].slice(0, 200); // keep last 200 logs
    saveState(newCount, updatedLogs);

    // Audio click & haptic feedback
    playCounterClickSound();

    // Trigger visual pulse effect
    setTapEffect(true);
    setTimeout(() => setTapEffect(false), 150);
  };

  // Decrement handler (located inside settings)
  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (count <= 0) return;
    const newCount = count - 1;
    // Remove the most recent log item if it matches the current count
    const updatedLogs = logs.length > 0 ? logs.slice(1) : [];
    saveState(newCount, updatedLogs);
  };

  // Reset handler (located inside settings)
  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Sayaç ve tüm zaman kayıtları sıfırlansın mı?')) {
      saveState(0, []);
      setIsSettingsOpen(false);
      setShowHistory(false);
    }
  };

  // Manual custom set (located inside settings)
  const handleSetCustomCount = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customInputVal.trim(), 10);
    if (!isNaN(val) && val >= 0) {
      saveState(val, logs);
      setIsCustomEditing(false);
    }
  };

  if (!isOpen) return null;

  const latestLog = logs[0] || null;

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.85, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="fixed bottom-24 right-4 z-50 select-none touch-none"
        style={{ maxWidth: 'min(92vw, 320px)' }}
      >
        <div className="bg-[#FAF8F5]/95 backdrop-blur-md border border-[#8B7E66]/40 rounded-3xl shadow-2xl overflow-hidden text-slate-800 transition-all flex flex-col ring-1 ring-black/5">
          
          {/* Header Bar: Mini Title, Drag Handle & Settings Toggle */}
          <div className="px-3.5 py-1.5 bg-[#8B7E66]/10 border-b border-[#8B7E66]/20 flex items-center justify-between text-xs cursor-move">
            <div className="flex items-center gap-1.5 text-[#8B7E66] font-bold text-[11px]">
              <Move className="w-3 h-3 opacity-60" />
              <span>Sayaç</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Settings Icon Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSettingsOpen(prev => !prev);
                }}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isSettingsOpen 
                    ? 'bg-[#8B7E66] text-white shadow-xs' 
                    : 'text-stone-600 hover:text-stone-900 hover:bg-black/5'
                }`}
                title="Sayaç Ayarları & Geçmiş (Sıfırla / Eksi)"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1 text-stone-400 hover:text-stone-700 hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
                title="Sayacı Kapat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* MAIN COUNTER TAP AREA (Increments count on click) */}
          <div
            onClick={handleIncrement}
            className={`p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-75 active:scale-95 ${
              tapEffect ? 'bg-[#8B7E66]/25' : 'hover:bg-black/[0.02]'
            }`}
            title="Artırmak için tıklayın"
          >
            {/* Big Count Number */}
            <div className="flex items-center justify-center">
              <span className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-800 tracking-tight drop-shadow-xs">
                {count}
              </span>
            </div>

            {/* Millisecond Timestamp & Interval Information */}
            <div className="mt-2.5 w-full bg-white/80 border border-[#D9D1C2]/80 rounded-xl px-2.5 py-1.5 flex flex-col items-center gap-0.5 text-center shadow-xs">
              {latestLog ? (
                <>
                  <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700">
                    <Clock className="w-3 h-3 text-[#8B7E66]" />
                    <span>{latestLog.timeFormatted}</span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                    <span>Aralık:</span>
                    <span className="font-mono bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                      {latestLog.deltaFormatted}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-stone-400 font-medium py-1">
                  Başlamak için sayaca tıklayın
                </div>
              )}
            </div>

            <div className="text-[9px] text-stone-400 font-semibold mt-1">
              Tıkla ve artır
            </div>
          </div>

          {/* SETTINGS / POPUP PANEL (Contains Reset, -1, Manual Set and History) */}
          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-[#D9D1C2]/80 bg-white/90 p-3 space-y-2.5 text-xs overflow-hidden"
              >
                {/* Actions: Decrement (-1) & Reset Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={count <= 0}
                    className="py-1.5 px-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1 border border-stone-200 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    title="Sayacı 1 azalt"
                  >
                    <Minus className="w-3.5 h-3.5 text-rose-600" />
                    <span>Azalt (-1)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold flex items-center justify-center gap-1 border border-rose-200 cursor-pointer transition-colors"
                    title="Sayacı sıfırla"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Sıfırla</span>
                  </button>
                </div>

                {/* Manual number setting toggle */}
                {isCustomEditing ? (
                  <form onSubmit={handleSetCustomCount} className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={customInputVal}
                      onChange={(e) => setCustomInputVal(e.target.value)}
                      placeholder="Sayı gir..."
                      className="w-full px-2.5 py-1 text-xs border border-[#8B7E66] rounded-lg bg-white focus:outline-hidden font-bold"
                    />
                    <button
                      type="submit"
                      className="p-1.5 bg-[#8B7E66] text-white rounded-lg cursor-pointer"
                      title="Uygula"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCustomEditing(false)}
                      className="p-1.5 bg-stone-200 text-stone-700 rounded-lg cursor-pointer"
                      title="İptal"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomInputVal(String(count));
                      setIsCustomEditing(true);
                    }}
                    className="w-full py-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 border border-dashed border-stone-300 rounded-lg bg-white/50 cursor-pointer"
                  >
                    Değeri Elle Değiştir
                  </button>
                )}

                {/* Detailed History Accordion */}
                <div className="pt-1 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setShowHistory(prev => !prev)}
                    className="w-full flex items-center justify-between text-[11px] font-bold text-slate-700 hover:text-black py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-[#8B7E66]" />
                      <span>Zaman Geçmişi ({logs.length})</span>
                    </span>
                    {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showHistory && (
                    <div className="mt-1.5 max-h-48 overflow-y-auto space-y-1 pr-0.5 text-[10px]">
                      {logs.length === 0 ? (
                        <div className="text-center py-2 text-stone-400 italic">
                          Henüz kayıt yok.
                        </div>
                      ) : (
                        logs.map((log) => (
                          <div 
                            key={log.id}
                            className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 flex items-center justify-between font-mono"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#8B7E66]">#{log.count}</span>
                              <span className="text-slate-600">{log.timeFormatted}</span>
                            </div>
                            <span className="font-bold text-emerald-700 bg-emerald-50/80 px-1 rounded border border-emerald-200/50">
                              {log.deltaFormatted}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
