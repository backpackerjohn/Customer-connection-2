import React, { useState, useRef, useEffect, DragEvent } from 'react';
import { 
  Upload, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  Loader2, 
  ArrowLeft,
  Sparkles,
  Play,
  Check,
  AlertCircle
} from 'lucide-react';
import { User } from 'firebase/auth';
import { motion } from 'motion/react';
import { Customer, emptyCustomer } from '../types';
import { extractBulkCustomers } from '../services/bulkIntakeService';
import { findDuplicates, DuplicateMatch } from '../lib/duplicateDetection';
import { createCustomer } from '../services/customersService';
import { EditableChip } from '../components/EditableChip';
import { rollNextCadence } from '../lib/reminders/engine';
import { REMINDER_CONFIG } from '../lib/reminders/config';

function addDaysISO(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function deriveLeadSourceType(leadSource?: string): Customer['leadSourceType'] | undefined {
  // Parse the 3rd slash-separated field of CRM source strings like
  // "Showroom Floor / Manual / Walk-In". Only three auto-derivable
  // values; everything else falls through to dealer chip override.
  if (!leadSource) return undefined;
  const parts = leadSource.split('/').map(p => p.trim());
  if (parts.length < 3) return undefined;
  const third = parts[2].toLowerCase();
  if (third.includes('service customer') || third.includes('vep')) return 'vep';
  if (third.includes('phone up') || third === 'phone') return 'crm';
  if (third.includes('walk')) return 'walk-in';
  return undefined;
}

function followUpFromAction(lastActionType: string | undefined, lastActionDate: string | undefined): string {
  // If the "Last Action" was a Note or Text, treat the action date as
  // the last real customer contact and roll the next follow-up off it.
  // Tasks and missing values fall back to the default "today + 30".
  if ((lastActionType !== 'note' && lastActionType !== 'text') || !lastActionDate) {
    return addDaysISO(30);
  }
  const actionMs = new Date(lastActionDate + 'T00:00:00').getTime();
  const todayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const ageDays = Math.floor((todayMs - actionMs) / (1000 * 60 * 60 * 24));
  if (ageDays > 30) return addDaysISO(0);
  const d = new Date(lastActionDate + 'T00:00:00');
  d.setDate(d.getDate() + 30);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const STATUS_CHIP_OPTIONS = [
  { value: 'lead' as const, label: 'Unsold' },
  { value: 'sold' as const, label: 'Sold' },
  { value: 'inactive' as const, label: 'Inactive' },
];

const SOURCE_CHIP_OPTIONS = [
  { value: 'walk-in' as const, label: 'Walk-In' },
  { value: 'crm' as const, label: 'CRM' },
  { value: 'vep' as const, label: 'VEP' },
  { value: 'dealer-wizard' as const, label: 'Dealer Wizard' },
  { value: 'fb-marketplace' as const, label: 'FB Marketplace' },
];

interface Props {
  customers: Customer[];
  user: User;
  onComplete: (destination?: 'today' | 'dashboard') => void;
}

interface BatchRow {
  customer: Customer;
  action: 'new' | 'duplicate' | 'skip';
  status: 'idle' | 'creating' | 'success' | 'error';
  errorMessage?: string;
  followUpDate: string;       // ISO YYYY-MM-DD
  lastActionType?: 'note' | 'text' | 'task';
  lastActionDate?: string;    // ISO YYYY-MM-DD; transient from "Last Action" column in source CRM
}

interface SelectedImage {
  file: File;
  preview: string;       // data URL for thumbnail rendering
  error?: string;        // set after a failed extraction so the thumbnail can show a badge
}

const MAX_IMAGES = 8;

export function BulkIntakeView({ customers, user, onComplete }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [batchProcessed, setBatchProcessed] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setProcessError(`Limit is ${MAX_IMAGES} images per batch. Remove one before adding more.`);
      return;
    }

    const toAdd = imageFiles.slice(0, remaining);
    if (imageFiles.length > remaining) {
      setProcessError(`Only the first ${remaining} of ${imageFiles.length} added — limit is ${MAX_IMAGES} per batch.`);
    }

    Promise.all(
      toAdd.map(file => new Promise<SelectedImage>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ file, preview: reader.result as string });
        reader.readAsDataURL(file);
      }))
    ).then(newImages => {
      setImages(prev => [...prev, ...newImages]);
    });
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (batchProcessed || isProcessing) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pasted: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) pasted.push(file);
        }
      }
      if (pasted.length > 0) {
        e.preventDefault();
        addFiles(pasted);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [batchProcessed, isProcessing, images.length]);

  // 1. Drag and Drop handlers
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
    // Reset the input so the user can re-select the same file if removed and re-added.
    e.target.value = '';
  };

  const clearAll = () => {
    setImages([]);
    setRows([]);
    setBatchProcessed(false);
    setProcessError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 2. Extractor Call — parallel across all selected images
  const processImages = async () => {
    if (images.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setProcessError(null);
    setRows([]);

    try {
      // Run all images in parallel via allSettled so one failure doesn't kill the batch.
      const results = await Promise.allSettled(
        images.map(async (img) => {
          const imageData = await new Promise<{ data: string; mimeType: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const mimeType = result.split(';')[0].split(':')[1];
              const data = result.split(',')[1];
              resolve({ data, mimeType });
            };
            reader.onerror = reject;
            reader.readAsDataURL(img.file);
          });
          return extractBulkCustomers({ inlineData: imageData });
        })
      );

      // Stamp per-image error status so failed thumbnails can show a badge.
      setImages(prev => prev.map((img, i) => {
        const r = results[i];
        if (r && r.status === 'rejected') {
          return { ...img, error: r.reason instanceof Error ? r.reason.message : 'Extraction failed' };
        }
        return { ...img, error: undefined };
      }));

      // Flatten successful results into one merged extraction array.
      const allExtracted = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      const failedCount = results.filter(r => r.status === 'rejected').length;

      if (allExtracted.length === 0) {
        const msg = failedCount > 0
          ? `Could not extract customers — all ${failedCount} image(s) failed. Check console for details.`
          : 'No customers were detected in these screenshots. Try clearer images.';
        setProcessError(msg);
        return;
      }

      // Construct rows from the merged extraction. Cross-image dedup works
      // naturally because findDuplicates compares each row against existing
      // DB customers + earlier rows already in this batch.
      const initialRows: BatchRow[] = allExtracted.map((extractedCust, index) => {
        const { lastActionType, lastActionDate, ...customerFields } = extractedCust;
        const derivedSourceType = customerFields.leadSourceType ?? deriveLeadSourceType(customerFields.leadSource);
        const rowCust = {
          ...emptyCustomer,
          ...customerFields,
          status: 'lead' as const,
          ...(derivedSourceType ? { leadSourceType: derivedSourceType } : {})
        };

        const priorRows = allExtracted.slice(0, index) as Customer[];
        const matchCandidates = [...customers, ...priorRows];
        const dups = findDuplicates(rowCust, matchCandidates);
        const hasStrong = dups.some(d => d.level === 'strong');

        return {
          customer: rowCust,
          action: hasStrong ? 'duplicate' : 'new',
          status: 'idle',
          followUpDate: followUpFromAction(lastActionType, lastActionDate),
          lastActionType,
          lastActionDate,
        };
      });

      setRows(initialRows);
      setBatchProcessed(true);

      if (failedCount > 0) {
        setProcessError(`${failedCount} of ${images.length} image(s) couldn't be processed; the others were extracted successfully.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setProcessError(`Could not extract customers. ${msg}`);
      console.error("Failed to parse images with Gemini:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Edit Handler for individual fields
  const handleFieldChange = (index: number, field: keyof Customer, value: string | boolean | undefined) => {
    setRows(prev => prev.map((row, idx) => {
      if (idx === index) {
        return {
          ...row,
          customer: {
            ...row.customer,
            [field]: value
          }
        };
      }
      return row;
    }));
  };

  const handleActionChange = (index: number, action: 'new' | 'duplicate' | 'skip') => {
    setRows(prev => prev.map((row, idx) => {
      if (idx === index) {
        return { ...row, action };
      }
      return row;
    }));
  };

  const removeRowFromList = (index: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== index));
  };

  // 4. Reactive duplicate matching on every render
  const getRowDuplicates = (index: number, rowCust: Customer): DuplicateMatch[] => {
    const previousRows = rows.slice(0, index).map(r => r.customer) as Customer[];
    const candidates = [...customers, ...previousRows];
    return findDuplicates(rowCust, candidates);
  };

  // 5. Commit Batch
  const createAllCustomers = async () => {
    setIsCommitting(true);
    const currentRows = [...rows];

    for (let i = 0; i < currentRows.length; i++) {
      const row = currentRows[i];
      if (row.action !== 'new') {
        // If Skip or Duplicate (which acts as skip for v1), mark as success (or keep idle) but don't hit DB
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'success' } : r));
        continue;
      }

      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'creating' } : r));

      try {
        const todayISO = addDaysISO(0);
        let payload: Customer;
        if (row.customer.status === 'sold') {
          // Full Sold flow: stamp purchaseDate, roll buyer cadence, set
          // lastContactedAt to today. Engine then auto-fires followUp24h
          // tomorrow + referral48to72h on day 2/3. The dealer's followUpDate
          // chip is intentionally overridden here.
          const purchaseISO = new Date().toISOString();
          const nextCadence = rollNextCadence(new Date(), 'buyer', REMINDER_CONFIG);
          payload = {
            ...row.customer,
            purchaseDate: purchaseISO,
            nextCadenceDue: nextCadence,
            lastContactedAt: todayISO
          };
        } else {
          // Lead path (default): use the dealer's chip-selected follow-up date.
          // If the AI extracted a Note/Text Last Action, stamp lastContactedAt
          // with that date so the engine treats it as the real last contact.
          const leadLastContactedAt = (row.lastActionType === 'note' || row.lastActionType === 'text') && row.lastActionDate
            ? row.lastActionDate
            : todayISO;
          payload = {
            ...row.customer,
            nextCadenceDue: row.followUpDate,
            lastContactedAt: leadLastContactedAt
          };
        }
        await createCustomer(user.uid, payload);
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'success' } : r));
      } catch (err: unknown) {
        console.error(`Error creating customer at row ${i + 1}:`, err);
        const msg = err instanceof Error ? err.message : 'Database write failed';
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', errorMessage: msg } : r));
      }
    }

    setIsCommitting(false);
  };

  // Helper to count results
  const counts = rows.reduce((acc, current) => {
    if (current.status === 'success') acc.success++;
    if (current.status === 'error') acc.error++;
    if (current.action === 'new') acc.newCount++;
    if (current.action === 'duplicate') acc.duplicateCount++;
    if (current.action === 'skip') acc.skipCount++;
    return acc;
  }, { success: 0, error: 0, newCount: 0, duplicateCount: 0, skipCount: 0 });

  const hasCommitted = rows.some(r => r.status === 'success' || r.status === 'error');

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <header className="flex items-center gap-4">
        <button 
          onClick={() => onComplete('dashboard')}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Bulk Intake</h2>
          <p className="text-sm md:text-base text-gray-500">Upload screenshot listings of customer lists to extract as DB contacts.</p>
        </div>
      </header>

      {processError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            {processError}
          </div>
          <button 
            onClick={() => setProcessError(null)}
            className="text-rose-500 hover:text-rose-700 shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Panel */}
      {!batchProcessed ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* File input / Drag zone */}
          <div 
            className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-all ${
              dragActive 
                ? 'border-gray-900 bg-gray-50/50 scale-[0.99]' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              id="bulk-file-upload" 
              className="hidden" 
              accept="image/*"
              multiple
              onChange={onFileChange}
            />

            <div className="max-w-md mx-auto space-y-6">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Upload className="text-gray-400" size={24} />
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-lg md:text-xl">Upload CRM Screenshot</p>
                <p className="text-gray-400 text-sm">
                  Drag and drop your screenshot image here, or{' '}
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-gray-900 font-semibold underline underline-offset-4 hover:text-gray-700"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-gray-400/80">Supports PNG, JPG, JPEG. Up to {MAX_IMAGES} images per batch.</p>
                <p className="text-xs text-gray-400/80">Tip: paste screenshots directly with Ctrl+V / ⌘V (multiple OK).</p>
              </div>
            </div>
          </div>

          {/* Right Image Preview (thumbnail grid) and Run button */}
          <div className="card p-6 min-h-[16rem] flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-900">Selection Preview</h3>
              {images.length > 0 && (
                <span className="text-xs text-gray-500 font-medium">{images.length} of {MAX_IMAGES}</span>
              )}
            </div>
            {images.length > 0 ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 bg-gray-50 group">
                      <img 
                        src={img.preview} 
                        alt={`Screenshot ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => removeImage(idx)}
                        disabled={isProcessing}
                        className="absolute top-1 right-1 p-1 bg-white/90 backdrop-blur hover:bg-white text-red-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                        aria-label="Remove image"
                      >
                        <Trash2 size={12} />
                      </button>
                      {img.error && (
                        <div className="absolute bottom-1 left-1 right-1 bg-rose-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded text-center">
                          Failed
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={processImages}
                  disabled={isProcessing}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Extracting from {images.length} list{images.length === 1 ? '' : 's'}…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="text-amber-400 fill-amber-400" />
                      <span>Process {images.length} List{images.length === 1 ? '' : 's'} with Gemini</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                <HelpCircle size={36} className="text-gray-200 stroke-[1.5] mb-2" />
                <p className="text-sm">Select, drag, or paste up to {MAX_IMAGES} images.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Review Screen with Editable Rows */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <span className="font-semibold text-gray-900 flex items-center gap-1">
                <Sparkles size={16} className="text-amber-500 fill-amber-500" />
                Extracted: {rows.length} Contacts
              </span>
              <span className="h-4 w-[1px] bg-gray-200" />
              <span>To Create: {counts.newCount}</span>
              <span>Duplicates: {counts.duplicateCount}</span>
              <span>Skipped: {counts.skipCount}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={clearAll}
                disabled={isCommitting}
                className="px-4 py-2 text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 rounded-lg transition-all disabled:opacity-50"
              >
                Reset / Back
              </button>
              <button
                onClick={createAllCustomers}
                disabled={isCommitting || rows.length === 0 || hasCommitted}
                className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 rounded-lg transition-all disabled:opacity-50 shadow-sm flex items-center gap-2 active:scale-95"
              >
                {isCommitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Committing...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-current" />
                    <span>Commit Batch ({counts.newCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Set follow-up for all</span>
            <div className="flex items-center gap-1">
              {[0, 3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setRows(prev => prev.map(r => ({ ...r, followUpDate: addDaysISO(d) })))}
                  disabled={isCommitting || hasCommitted}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md border bg-white text-gray-700 border-gray-200 hover:bg-gray-50 transition-all"
                >
                  {d === 0 ? 'Today' : `${d}d`}
                </button>
              ))}
              <input
                type="date"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setRows(prev => prev.map(r => ({ ...r, followUpDate: v })));
                }}
                disabled={isCommitting || hasCommitted}
                className="text-xs bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-900 ml-1"
              />
            </div>
          </div>

          {/* Core Results Tracker Banner once save is complete */}
          {hasCommitted && !isCommitting && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-rose-200 text-rose-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-base">Batch Import Complete</h4>
                  <p className="text-sm text-gray-600">
                    Import stats: Successfully generated {counts.success} records. Failures: {counts.error}.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  const todayISO = addDaysISO(0);
                  const hasTodayFollowUp = rows.some(r => r.status === 'success' && r.followUpDate === todayISO);
                  onComplete(hasTodayFollowUp ? 'today' : 'dashboard');
                }}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 rounded-lg shadow-sm transition-all shadow-emerald-500/10 active:scale-95"
              >
                {rows.some(r => r.status === 'success' && r.followUpDate === addDaysISO(0)) ? 'Go to Today' : 'Return to Dashboard'}
              </button>
            </div>
          )}

          {/* Table List of extracted rows */}
          <div className="space-y-4">
            {rows.map((row, index) => {
              const duplicates = getRowDuplicates(index, row.customer);
              const topDup = duplicates[0];

              // Styling per row status
              let borderClass = 'border-gray-100';
              if (row.status === 'creating') borderClass = 'border-amber-400 bg-amber-50/20';
              if (row.status === 'success') borderClass = 'border-emerald-200 bg-emerald-50/10';
              if (row.status === 'error') borderClass = 'border-rose-200 bg-rose-50/20';

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={index} 
                  className={`card p-5 border ${borderClass} transition-all space-y-4 relative`}
                >
                  {/* Overlay for success / loading */}
                  {row.status === 'success' && (
                    <div className="absolute inset-y-0 left-0 w-2 bg-emerald-500 rounded-l-2xl" />
                  )}
                  {row.status === 'error' && (
                    <div className="absolute inset-y-0 left-0 w-2 bg-rose-500 rounded-l-2xl" />
                  )}
                  {row.status === 'creating' && (
                    <div className="absolute inset-y-0 left-0 w-2 bg-amber-500 rounded-l-2xl" />
                  )}

                  {/* Card Header & Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                        {index + 1}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900">
                          {row.customer.firstName || '(No first name)'} {row.customer.lastName || '(No last name)'}
                        </span>

                        {/* Top Duplicate Badge matching types */}
                        {topDup && (
                          <>
                            {topDup.level === 'strong' && (
                              <span className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                Matches {topDup.existing.firstName} {topDup.existing.lastName}
                              </span>
                            )}
                            {topDup.level === 'weak' && (
                              <span className="bg-amber-50 border border-amber-100 text-amber-700 text-xs px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5">
                                <AlertTriangle size={12} />
                                Possible match: {topDup.existing.firstName} {topDup.existing.lastName}
                              </span>
                            )}
                            {topDup.level === 'household' && (
                              <span className="bg-gray-100 border border-gray-200 text-gray-700 text-xs px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5">
                                <HelpCircle size={12} />
                                Household — same phone as {topDup.existing.firstName} {topDup.existing.lastName}
                              </span>
                            )}
                          </>
                        )}

                        <EditableChip
                          value={row.customer.status}
                          options={STATUS_CHIP_OPTIONS}
                          onChange={(v) => v && handleFieldChange(index, 'status', v)}
                          color={row.customer.status === 'sold' ? 'emerald' : row.customer.status === 'inactive' ? 'gray' : 'blue'}
                          disabled={isCommitting || row.status === 'success'}
                        />
                        <EditableChip
                          value={row.customer.leadSourceType}
                          options={SOURCE_CHIP_OPTIONS}
                          onChange={(v) => handleFieldChange(index, 'leadSourceType', v)}
                          placeholder={row.customer.leadSource ? row.customer.leadSource : '— Source —'}
                          color="gray"
                          allowClear
                          disabled={isCommitting || row.status === 'success'}
                        />
                      </div>
                    </div>

                    {/* Progress States or Controller */}
                    <div className="flex items-center gap-3">
                      {row.status === 'creating' && (
                        <span className="text-amber-500 text-xs font-semibold flex items-center gap-1 pr-2">
                          <Loader2 size={12} className="animate-spin" />
                          Creating...
                        </span>
                      )}
                      {row.status === 'success' && (
                        <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1 pr-2">
                          <Check size={14} className="stroke-[3]" />
                          Added to CRM
                        </span>
                      )}
                      {row.status === 'error' && (
                        <span className="text-rose-600 text-xs font-semibold flex items-center gap-1 pr-2 title={row.errorMessage}">
                          <AlertCircle size={14} />
                          Failed
                        </span>
                      )}

                      {row.status === 'idle' && (
                        <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-lg p-0.5 shadow-inner">
                          <button
                            onClick={() => handleActionChange(index, 'new')}
                            disabled={isCommitting}
                            className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                              row.action === 'new' 
                                ? 'bg-white text-gray-900 shadow-sm border border-gray-100' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            New Card
                          </button>
                          <button
                            onClick={() => handleActionChange(index, 'duplicate')}
                            disabled={isCommitting}
                            className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                              row.action === 'duplicate' 
                                ? 'bg-white text-gray-900 shadow-sm border border-gray-100' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            Existing Link
                          </button>
                          <button
                            onClick={() => handleActionChange(index, 'skip')}
                            disabled={isCommitting}
                            className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${
                              row.action === 'skip' 
                                ? 'bg-white text-red-600 shadow-sm border border-gray-100' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            Skip
                          </button>
                        </div>
                      )}

                      {/* Remove Button for row cleanup helper */}
                      {row.status === 'idle' && (
                        <button 
                          onClick={() => removeRowFromList(index)}
                          className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Remove row from screen"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Form Grid (Editable for review corrections) */}
                  <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 transition-all ${row.action === 'skip' ? 'opacity-40 select-none pointer-events-none' : ''}`}>
                    {/* First Name & Last Name */}
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prospect Full Name</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={row.customer.firstName}
                          onChange={(e) => handleFieldChange(index, 'firstName', e.target.value)}
                          disabled={isCommitting || row.status === 'success'}
                          placeholder="First Name"
                          className="flex-1 text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                        />
                        <input 
                          type="text"
                          value={row.customer.lastName}
                          onChange={(e) => handleFieldChange(index, 'lastName', e.target.value)}
                          disabled={isCommitting || row.status === 'success'}
                          placeholder="Last Name"
                          className="flex-1 text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                        />
                      </div>
                    </div>

                    {/* Phone & Email */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Phone Contact</label>
                      <input 
                        type="text"
                        value={row.customer.phone || ''}
                        onChange={(e) => handleFieldChange(index, 'phone', e.target.value)}
                        disabled={isCommitting || row.status === 'success'}
                        placeholder="(555) 555-5555"
                        className="w-full text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                      <input 
                        type="email"
                        value={row.customer.email || ''}
                        onChange={(e) => handleFieldChange(index, 'email', e.target.value)}
                        disabled={isCommitting || row.status === 'success'}
                        placeholder="john.smith@gmail.com"
                        className="w-full text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                      />
                    </div>

                    {/* Vehicle of Interest */}
                    <div className="space-y-1 md:col-span-4 grid grid-cols-3 gap-3 pt-3 border-t border-gray-50 mt-1">
                      <div className="space-y-1 col-span-3 flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vehicle of Interest</label>
                      </div>
                      <input 
                        type="text"
                        value={row.customer.vehicleYear || ''}
                        onChange={(e) => handleFieldChange(index, 'vehicleYear', e.target.value)}
                        disabled={isCommitting || row.status === 'success'}
                        placeholder="Year (e.g. 2022)"
                        className="w-full text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                      />
                      <input 
                        type="text"
                        value={row.customer.vehicleMake || ''}
                        onChange={(e) => handleFieldChange(index, 'vehicleMake', e.target.value)}
                        disabled={isCommitting || row.status === 'success'}
                        placeholder="Make (e.g. Honda)"
                        className="w-full text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                      />
                      <input 
                        type="text"
                        value={row.customer.vehicleModel || ''}
                        onChange={(e) => handleFieldChange(index, 'vehicleModel', e.target.value)}
                        disabled={isCommitting || row.status === 'success'}
                        placeholder="Model (e.g. Civic)"
                        className="w-full text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                      />
                    </div>

                    {/* Trade-In */}
                    <div className="space-y-1 md:col-span-4 pt-3 border-t border-gray-50 mt-1">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trade-In</label>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!row.customer.hasTradeIn}
                            onChange={(e) => handleFieldChange(index, 'hasTradeIn', e.target.checked)}
                            disabled={isCommitting || row.status === 'success'}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-gray-900 focus:ring-0"
                          />
                          Has trade-in
                        </label>
                      </div>
                      {row.customer.hasTradeIn && (
                        <div className="grid grid-cols-3 gap-3">
                          <input 
                            type="text"
                            value={row.customer.tradeYear || ''}
                            onChange={(e) => handleFieldChange(index, 'tradeYear', e.target.value)}
                            disabled={isCommitting || row.status === 'success'}
                            placeholder="Year (e.g. 2018)"
                            className="w-full text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                          />
                          <input 
                            type="text"
                            value={row.customer.tradeMake || ''}
                            onChange={(e) => handleFieldChange(index, 'tradeMake', e.target.value)}
                            disabled={isCommitting || row.status === 'success'}
                            placeholder="Make (e.g. Hyundai)"
                            className="w-full text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                          />
                          <input 
                            type="text"
                            value={row.customer.tradeModel || ''}
                            onChange={(e) => handleFieldChange(index, 'tradeModel', e.target.value)}
                            disabled={isCommitting || row.status === 'success'}
                            placeholder="Model (e.g. Elantra)"
                            className="w-full text-sm bg-white border border-gray-200 focus:border-gray-300 focus:outline-none rounded-lg px-3 py-1.5 text-gray-900 h-9"
                          />
                        </div>
                      )}
                    </div>

                    {/* Follow-Up */}
                    <div className="space-y-1 md:col-span-4 pt-3 border-t border-gray-50 mt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Follow-Up Reminder</label>
                        <div className="flex items-center gap-1">
                          {[0, 3, 7, 14, 30].map(d => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setRows(prev => prev.map((r, i) => i === index ? { ...r, followUpDate: addDaysISO(d) } : r))}
                              disabled={isCommitting || row.status === 'success'}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-all ${
                                row.followUpDate === addDaysISO(d)
                                  ? 'bg-gray-900 text-white border-gray-900'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {d === 0 ? 'Today' : `${d}d`}
                            </button>
                          ))}
                          <input
                            type="date"
                            value={row.followUpDate}
                            onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, followUpDate: e.target.value } : r))}
                            disabled={isCommitting || row.status === 'success'}
                            className="text-xs bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-900 ml-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error Notification per-row if failing */}
                  {row.status === 'error' && row.errorMessage && (
                    <div className="text-xs text-rose-600 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 flex items-center gap-2 mt-2">
                      <AlertCircle size={14} />
                      <span>{row.errorMessage}</span>
                    </div>
                  )}

                  {row.customer.pendingInterestNotes && (
                    <div className="text-xs text-amber-800 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 flex items-start gap-2 mt-2">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>Source listed additional interests: {row.customer.pendingInterestNotes}. Add manually after commit.</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
