import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, User, CreditCard, CarFront, Users, Landmark, FileText, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer } from '../types';
import { CaptureIntent, CAPTURE_SLOTS } from '../lib/captureIntent';

/** One photo waiting in the tray. `slot` is the whitelist it will be extracted under. */
export interface TrayItem {
  file: File;
  preview: string;
  slot: CaptureIntent;
}

interface DocumentTrayProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomer: Customer;
  /** When set, the picker for this slot opens as soon as the tray does. */
  initialSlot?: CaptureIntent | null;
  /** Hand the photos to the chat for extraction. Called once, then the tray empties and closes. */
  onExtract: (items: TrayItem[], note: string) => void;
}

const SLOT_ICON: Record<CaptureIntent, React.ReactNode> = {
  license: <User size={16} />,
  insurance: <CreditCard size={16} />,
  vehicle: <CarFront size={16} />,
  trade: <Users size={16} />,
  payoff: <Landmark size={16} />,
  other: <FileText size={16} />,
};
const SLOT_TINT: Record<CaptureIntent, string> = {
  license: 'bg-blue-100 text-blue-600',
  insurance: 'bg-purple-100 text-purple-600',
  vehicle: 'bg-green-100 text-green-600',
  trade: 'bg-orange-100 text-orange-600',
  payoff: 'bg-rose-100 text-rose-600',
  other: 'bg-gray-100 text-gray-500',
};

export const DocumentTray: React.FC<DocumentTrayProps> = ({ isOpen, onClose, currentCustomer, initialSlot, onExtract }) => {
  const [items, setItems] = useState<TrayItem[]>([]);
  const [note, setNote] = useState('');
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<CaptureIntent | 'sheet' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickingForRef = useRef<CaptureIntent>('other');

  const onFile: Partial<Record<CaptureIntent, boolean>> = {
    license: !!currentCustomer.dlImageUrl,
    insurance: !!currentCustomer.insuranceImageUrl,
  };

  const addFiles = (files: File[], slot: CaptureIntent) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setItems(prev => [...prev, ...images.map(file => ({ file, preview: URL.createObjectURL(file), slot }))]);
  };
  const removeItem = (index: number) => {
    setItems(prev => {
      const victim = prev[index];
      if (victim) URL.revokeObjectURL(victim.preview);
      return prev.filter((_, i) => i !== index);
    });
    setMenuFor(null);
  };
  const moveItem = (index: number, slot: CaptureIntent) => {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, slot } : it)));
    setMenuFor(null);
  };
  const openPicker = (slot: CaptureIntent) => {
    pickingForRef.current = slot;
    // No `capture` attribute: phones offer both camera and library, laptops get the file dialog.
    fileInputRef.current?.removeAttribute('capture');
    fileInputRef.current?.click();
  };

  // A section camera button opened us for a specific slot: go straight to its picker.
  useEffect(() => {
    if (!isOpen || !initialSlot) return;
    openPicker(initialSlot);
  }, [isOpen, initialSlot]);

  // Paste while the tray is open lands in Other (the classifier sorts it). The chat overlay
  // is closed whenever the tray is open, so only one paste handler is live at a time.
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const list = e.clipboardData?.items;
      if (!list) return;
      const files: File[] = [];
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files, 'other');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isOpen]);

  const handleExtract = () => {
    if (items.length === 0) return;
    const out = items;
    setItems([]);
    setNote('');
    setMenuFor(null);
    onExtract(out, note.trim());
  };

  const handleClose = () => {
    setMenuFor(null);
    onClose();
  };

  const countFor = (slot: CaptureIntent) => items.filter(it => it.slot === slot).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 max-h-[92vh] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[640px] md:max-w-[94vw] bg-white rounded-t-[32px] md:rounded-[24px] z-[70] flex flex-col shadow-2xl"
            onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver('sheet'); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              if (e.dataTransfer.getData('text/tray-item')) return;
              addFiles(Array.from(e.dataTransfer.files), 'other');
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(Array.from(e.target.files), pickingForRef.current);
                e.target.value = '';
              }}
            />

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-gray-900">Documents</h3>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {items.length > 0 ? `${items.length} photo${items.length === 1 ? '' : 's'} ready` : 'Tap a slot to add photos'}
                </div>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Tiles */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6" onClick={() => setMenuFor(null)}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CAPTURE_SLOTS.map(slot => {
                  const n = countFor(slot.id);
                  const over = dragOver === slot.id;
                  return (
                    <div
                      key={slot.id}
                      className={`relative rounded-2xl p-3 flex flex-col gap-2 min-h-[116px] transition-colors border-[1.5px] ${
                        over ? 'border-blue-500 bg-blue-50'
                        : n > 0 ? 'border-solid border-gray-200 bg-white'
                        : 'border-dashed border-gray-300 bg-gray-50 hover:border-gray-400'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(slot.id); }}
                      onDragLeave={(e) => { e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                      onDrop={(e) => {
                        e.preventDefault(); e.stopPropagation(); setDragOver(null);
                        const moved = e.dataTransfer.getData('text/tray-item');
                        if (moved) { moveItem(Number(moved), slot.id); return; }
                        addFiles(Array.from(e.dataTransfer.files), slot.id);
                      }}
                    >
                      {onFile[slot.id] && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                          <Check size={10} /> On file
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openPicker(slot.id); }}
                        className="flex items-center gap-2 text-left"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${SLOT_TINT[slot.id]}`}>
                          {SLOT_ICON[slot.id]}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-gray-900 leading-tight">{slot.name}</div>
                          <div className="text-[10px] text-gray-500 leading-tight">
                            {n > 0 ? `${n} photo${n === 1 ? '' : 's'} ready` : slot.hint}
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-wrap gap-1.5 min-h-[44px] items-start">
                        {items.map((it, i) => it.slot === slot.id && (
                          <div key={i} className="relative">
                            <button
                              type="button"
                              draggable
                              onDragStart={(e) => e.dataTransfer.setData('text/tray-item', String(i))}
                              onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === i ? null : i); }}
                              className="w-11 h-11 rounded-lg overflow-hidden bg-gray-200 block cursor-grab"
                              aria-label="Photo options"
                            >
                              <img src={it.preview} alt="" className="w-full h-full object-cover" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeItem(i); }}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center"
                              aria-label="Remove photo"
                            >
                              <X size={9} />
                            </button>
                            {menuFor === i && (
                              <div
                                className="absolute left-0 top-12 z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex flex-wrap gap-1.5 w-52"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="w-full text-[9px] font-bold uppercase tracking-wider text-gray-400 px-1">Move to</span>
                                {CAPTURE_SLOTS.filter(s => s.id !== slot.id).map(s => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => moveItem(i, s.id)}
                                    className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-gray-200 hover:bg-gray-100"
                                  >
                                    {s.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openPicker(slot.id); }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-gray-900 self-start"
                      >
                        <Plus size={12} /> {n > 0 ? 'Add another' : 'Add photo'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 md:p-6 border-t border-gray-100 shrink-0 space-y-3">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note for the AI (optional)"
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-gray-900 outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleExtract}
                disabled={items.length === 0}
                className="w-full bg-gray-900 text-white rounded-2xl py-3.5 text-sm font-bold active:scale-[0.99] disabled:opacity-40 transition-all"
              >
                {items.length > 0 ? `Extract ${items.length} photo${items.length === 1 ? '' : 's'}` : 'Extract'}
              </button>
              <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
                Nothing is written until you tap Extract
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
