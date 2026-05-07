import React, { useEffect, useRef, useState } from 'react';
import { FileText, Upload, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { FORM_SLOTS, FormSlot } from '../../lib/formSlots';
import { 
  uploadFormFile, deleteFormFile, getFormFileMetadata, FormFileMetadata 
} from '../../services/imagesService';

type SlotState = FormFileMetadata & { 
  busy?: 'upload' | 'delete'; 
  error?: string;
};

export function FormsManagerSection() {
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const refreshSlot = async (slot: FormSlot) => {
    const meta = await getFormFileMetadata(slot.filename);
    setSlots(prev => ({ ...prev, [slot.id]: meta }));
  };

  useEffect(() => {
    FORM_SLOTS.forEach(refreshSlot);
  }, []);

  const handlePick = (slot: FormSlot) => {
    fileInputs.current[slot.id]?.click();
  };

  const handleFile = async (slot: FormSlot, file: File) => {
    setSlots(prev => ({ 
      ...prev, 
      [slot.id]: { ...prev[slot.id], busy: 'upload', error: undefined } 
    }));
    try {
      await uploadFormFile(slot.filename, file);
      await refreshSlot(slot);
    } catch (err) {
      setSlots(prev => ({ 
        ...prev, 
        [slot.id]: { 
          ...prev[slot.id], 
          busy: undefined, 
          error: err instanceof Error ? err.message : 'Upload failed' 
        } 
      }));
    }
  };

  const handleDelete = async (slot: FormSlot) => {
    if (!window.confirm(
      `Delete "${slot.label}"? The Test Drive button will fail until this form is re-uploaded.`
    )) return;
    setSlots(prev => ({ 
      ...prev, 
      [slot.id]: { ...prev[slot.id], busy: 'delete', error: undefined } 
    }));
    try {
      await deleteFormFile(slot.filename);
      await refreshSlot(slot);
    } catch (err) {
      setSlots(prev => ({ 
        ...prev, 
        [slot.id]: { 
          ...prev[slot.id], 
          busy: undefined, 
          error: err instanceof Error ? err.message : 'Delete failed' 
        } 
      }));
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (d?: Date) => 
    d ? d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
          <FileText size={18} />
        </div>
        <h2 className="text-xl font-bold">Forms</h2>
      </div>
      <div className="card overflow-hidden divide-y divide-gray-100">
        {FORM_SLOTS.map(slot => {
          const state = slots[slot.id] ?? { exists: false };
          return (
            <div key={slot.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">{slot.label}</p>
                  <p className="text-xs text-gray-500">{slot.description}</p>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-2">
                    {state.exists 
                      ? `Uploaded ${formatDate(state.updated)} · ${formatSize(state.sizeBytes)}` 
                      : 'Not uploaded'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  ref={el => { fileInputs.current[slot.id] = el; }}
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(slot, file);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => handlePick(slot)}
                  disabled={state.busy !== undefined}
                  className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold active:scale-95 disabled:opacity-50 transition-all"
                >
                  {state.busy === 'upload' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : state.exists ? (
                    <RefreshCw size={16} />
                  ) : (
                    <Upload size={16} />
                  )}
                  {state.exists ? 'Replace' : 'Upload'}
                </button>
                {state.exists && (
                  <button
                    onClick={() => handleDelete(slot)}
                    disabled={state.busy !== undefined}
                    className="flex items-center gap-2 text-red-600 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-all"
                  >
                    {state.busy === 'delete' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Delete
                  </button>
                )}
              </div>
              {state.error && (
                <p className="text-xs text-red-600 font-medium">{state.error}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
