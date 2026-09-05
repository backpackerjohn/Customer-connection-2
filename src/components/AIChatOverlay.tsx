import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, MessageSquare, User, Camera, Image as ImageIcon, Loader2, Plus, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { processCustomerChat, ImageData, ChatResponse } from '../services/aiService';
import { lookupVehicleByStock } from '../services/inventoryService';
import { normalizeImageForVision } from '../lib/imageNormalizer';
import { Customer } from '../types';
import { CaptureIntent, INTENT_SECTION_LABEL } from '../lib/captureIntent';

const INTENT_LABELS: Record<Exclude<CaptureIntent, 'other'>, string> = {
  trade: 'Trade-in',
  vehicle: 'New vehicle',
  license: 'License',
  insurance: 'Insurance',
};

const INTENT_CHIP_ORDER = ['trade', 'vehicle', 'license', 'insurance'] as const;

const DOC_LABEL: Record<string, string> = {
  license: 'License', insurance: 'Insurance card', trade_vehicle: 'Trade-in photo',
  new_vehicle: 'Vehicle photo', window_sticker: 'Window sticker', vehicle: 'Vehicle photo', other: 'Photo',
};

interface PendingImage { file: File; preview: string | null; }
interface Suggestion { label: string; action: () => void; }

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}

const SpeechRecognition = typeof window !== 'undefined'
  ? ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
     (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition)
  : undefined;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  suggestions?: Suggestion[];
}

interface AIChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomer: Customer;
  onFieldsExtracted: (
    fields: Record<string, unknown>,
    notesSummary?: string,
    image?: { type: 'license' | 'insurance', file: File }
  ) => void;
  initialIntent?: CaptureIntent;
  autoOpenPicker?: boolean;
}

export const AIChatOverlay: React.FC<AIChatOverlayProps> = ({
  isOpen,
  onClose,
  currentCustomer,
  onFieldsExtracted,
  initialIntent,
  autoOpenPicker
}) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your AI assistant. Tell me anything about the customer, or snap a photo of their ID/Insurance, and I'll fill out the fields for you." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [pendingIntent, setPendingIntent] = useState<CaptureIntent>('other');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const toggleListening = () => {
    if (!SpeechRecognition || isTyping || isUploading) return;

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.error("Stop error:", err);
      }
      setIsListening(false);
    } else {
      try {
        if (!recognitionRef.current) {
          const recognition = new SpeechRecognition();
          recognition.lang = 'en-US';
          recognition.interimResults = false;
          recognition.continuous = false;

          recognition.onresult = (e: SpeechRecognitionEvent) => {
            setInput(prev => (prev ? prev + ' ' : '') + e.results[0][0].transcript);
          };
          recognition.onend = () => {
            setIsListening(false);
          };
          recognition.onerror = () => {
            setIsListening(false);
          };
          recognitionRef.current = recognition;
        }
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Speech Recognition start error:", err);
        setIsListening(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Reset the pending attachment whenever the overlay (re)opens, adopting the
  // intent it was opened with. Render-time adjustment instead of an effect.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setPendingImages([]);
      setPendingIntent(initialIntent ?? 'other');
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    if (autoOpenPicker && initialIntent && initialIntent !== 'other') {
      // Open the native picker WITHOUT the capture attribute so phones offer
      // both "Take Photo" and "Photo Library" instead of forcing the camera.
      fileInputRef.current?.removeAttribute('capture');
      fileInputRef.current?.click();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const attachImages = (files: File[]) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setPendingImages(prev => [...prev, ...images.map(file => ({ file, preview: null }))]);
    images.forEach(file => {
      fileToBase64(file)
        .then(preview => setPendingImages(prev => prev.map(p => p.file === file ? { ...p, preview } : p)))
        .catch(() => { /* thumbnail is optional */ });
    });
  };

  const discardPendingImage = (index?: number) => {
    if (index === undefined) {
      setPendingImages([]);
      setPendingIntent(initialIntent ?? 'other');
      return;
    }
    setPendingImages(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setPendingIntent(initialIntent ?? 'other');
      return next;
    });
  };

  const applyAndConfirm = (data: Record<string, unknown>, confirm: string) => {
    onFieldsExtracted(data);
    setMessages(p => [...p, { role: 'assistant', content: confirm }]);
  };

  /** Sends one message (with at most one photo) and applies the result. Returns the reply text and any chips. */
  const processOne = async (
    text: string,
    history: { role: 'user' | 'model'; parts: { text: string }[] }[],
    intent: CaptureIntent,
    imageFile?: File,
    imageData?: ImageData
  ): Promise<{ text: string; suggestions: Suggestion[] }> => {
    const response: ChatResponse = await processCustomerChat(text, currentCustomer, history, imageData, intent);
    let finalMessage = response.message;
    const suggestions: Suggestion[] = [];

    // Inventory lookup if a stock number was found
    if (response.inventoryStockFound) {
      const vehicle = await lookupVehicleByStock(response.inventoryStockFound);
      if (vehicle) {
        finalMessage = `I found Stock #${vehicle.stock} in our inventory:\n\n` +
          `• ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}\n` +
          `• VIN: ${vehicle.vin}\n` +
          `• MSRP: ${vehicle.msrp}\n` +
          `• Color: ${vehicle.exteriorColor} / ${vehicle.interiorColor}\n\n` +
          `Would you like me to add this vehicle to the profile?`;
        suggestions.push({
          label: `Add ${vehicle.year} ${vehicle.model} to Profile`,
          action: () => applyAndConfirm({
            vehicleStock: vehicle.stock, vehicleYear: vehicle.year, vehicleMake: vehicle.make,
            vehicleModel: vehicle.model, vehicleVin: vehicle.vin
          }, "✅ Vehicle added to profile!")
        });
      }
    }

    // Insurance cards list the insured vehicle. Offer it as the trade-in; nothing is written until tapped.
    if (response.insuredVehicle) {
      const { year, make, model, vin } = response.insuredVehicle;
      if (year || make || model) {
        const desc = [year, make, model].filter(Boolean).join(' ');
        suggestions.push({
          label: `Add ${desc} as trade?`,
          action: () => applyAndConfirm({
            hasTradeIn: true,
            ...(year ? { tradeYear: year } : {}), ...(make ? { tradeMake: make } : {}),
            ...(model ? { tradeModel: model } : {}), ...(vin ? { tradeVin: vin } : {})
          }, "✅ Trade-in added to profile!")
        });
      }
    }

    // A vehicle photo where nobody said which one: ask, and hold the data until answered.
    if (response.pendingVehicle) {
      const v = response.pendingVehicle;
      const desc = [v.year, v.make, v.model].filter(Boolean).join(' ') || (v.vin ? `VIN ${v.vin}` : 'this vehicle');
      finalMessage = `I read ${desc}${v.vin && desc !== `VIN ${v.vin}` ? ` (VIN ${v.vin})` : ''}. Is this the trade-in or the new vehicle?`;
      suggestions.push(
        {
          label: 'Trade-in',
          action: () => applyAndConfirm({
            hasTradeIn: true,
            ...(v.year ? { tradeYear: v.year } : {}), ...(v.make ? { tradeMake: v.make } : {}),
            ...(v.model ? { tradeModel: v.model } : {}), ...(v.trim ? { tradeTrim: v.trim } : {}),
            ...(v.vin ? { tradeVin: v.vin } : {}), ...(v.miles ? { tradeMileage: v.miles } : {})
          }, "✅ Saved to Trade-in.")
        },
        {
          label: 'New vehicle',
          action: () => applyAndConfirm({
            ...(v.stock ? { vehicleStock: v.stock } : {}), ...(v.year ? { vehicleYear: v.year } : {}),
            ...(v.make ? { vehicleMake: v.make } : {}), ...(v.model ? { vehicleModel: v.model } : {}),
            ...(v.vin ? { vehicleVin: v.vin } : {}), ...(v.miles ? { vehicleMiles: v.miles } : {})
          }, "✅ Saved to New Vehicle.")
        }
      );
    }

    // Filter out null/undefined from updatedFields to prevent erasing data
    const cleanFields = Object.entries(response.updatedFields).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined) acc[key] = value;
      return acc;
    }, {} as Record<string, unknown>);

    if (response.inventoryStockFound && !cleanFields.vehicleStock) {
      cleanFields.vehicleStock = response.inventoryStockFound;
    }

    if (Object.keys(cleanFields).length > 0 || response.hasGoodNotes) {
      onFieldsExtracted(cleanFields, response.notesSummary);
    }

    if (imageFile && (response.documentType === 'license' || response.documentType === 'insurance')) {
      onFieldsExtracted({}, undefined, { type: response.documentType, file: imageFile });
    }

    // Say exactly what was written and where, so the dealer knows what to check.
    if (imageFile && !response.pendingVehicle) {
      const intentUsed = intent !== 'other' ? intent : response.appliedIntent;
      const doc = DOC_LABEL[response.documentType ?? 'other'] ?? 'Photo';
      const n = Object.keys(cleanFields).length;
      const count = `${n} field${n === 1 ? '' : 's'} filled`;
      finalMessage += intentUsed && intentUsed !== 'other'
        ? `\n\n${doc} → ${INTENT_SECTION_LABEL[intentUsed]}: ${count}.`
        : `\n\n${doc}: ${count}.`;
    }

    if (response.unreadFields && response.unreadFields.length > 0) {
      finalMessage += `\nCouldn't read: ${response.unreadFields.join(', ')} — please add manually.`;
    }

    return { text: finalMessage, suggestions };
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingImages.length === 0) || isTyping || isUploading) return;

    const userMessage = input.trim();
    const files = pendingImages.map(p => p.file);
    const intent = pendingIntent;
    setInput('');
    discardPendingImage();

    let prepared: { file: File; data: ImageData; preview: string }[] = [];
    if (files.length > 0) {
      setIsUploading(true);
      try {
        prepared = await Promise.all(files.map(async file => {
          // High-fidelity normalization for AI extraction (handles EXIF, HEIC, downscaling)
          const normalized = await normalizeImageForVision(file);
          const preview = await fileToBase64(file);
          return { file, data: { inlineData: { data: normalized.base64, mimeType: normalized.mimeType } }, preview };
        }));
      } catch (error) {
        console.error("Image processing error:", error);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage || (prepared.length > 1 ? `Sent ${prepared.length} photos` : prepared.length === 1 ? "Sent a photo" : ""),
      images: prepared.map(p => p.preview)
    }]);
    setIsTyping(true);

    try {
      // Map history to Gemini format
      const history = messages.slice(1).map(m => ({
        role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
        parts: [{ text: m.content }]
      }));
      const text = userMessage || "Extracted from image";

      // One call per photo, all in parallel, same words with each. Text-only is a single call.
      const jobs = prepared.length > 0
        ? prepared.map(p => processOne(text, history, intent, p.file, p.data))
        : [processOne(text, history, intent)];
      const results = await Promise.allSettled(jobs);

      const texts: string[] = [];
      const suggestions: Suggestion[] = [];
      let failed = 0;
      results.forEach(r => {
        if (r.status === 'fulfilled') { texts.push(r.value.text); suggestions.push(...r.value.suggestions); }
        else { failed++; console.error("Chat Error:", r.reason); }
      });
      if (failed > 0) {
        texts.push(failed === results.length
          ? "Sorry, I ran into an error. Please check your internet connection or try a smaller image."
          : `${failed} photo${failed === 1 ? '' : 's'} couldn't be processed. Try again with a sharper or smaller photo.`);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: texts.join('\n\n'), suggestions }]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I ran into an error. Please check your internet connection or try a smaller image." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      attachImages(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping || isUploading) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        attachImages(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isOpen, isTyping, isUploading]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />

          {/* Chat Sheet (Mobile) */}
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 top-20 bg-white rounded-t-[32px] z-[70] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-white">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">AI Assistant</h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-bold uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Online
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {messages.map((m, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                      m.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {m.role === 'user' ? <User size={16} /> : <MessageSquare size={16} />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-gray-50 text-gray-800 rounded-tl-none'
                    }`}>
                      {m.images && m.images.length > 0 && (
                        <div className={`mb-2 grid gap-1.5 ${m.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {m.images.map((src, j) => (
                            <div key={j} className="rounded-lg overflow-hidden border border-white/20">
                              <img src={src} alt="Upload" className="max-w-full h-auto" />
                            </div>
                          ))}
                        </div>
                      )}
                      <span className="whitespace-pre-line">{m.content}</span>

                      {m.suggestions && m.suggestions.length > 0 && (
                        <div className={`mt-3 grid gap-2 ${m.suggestions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {m.suggestions.map((sg, j) => (
                            <button
                              key={j}
                              onClick={sg.action}
                              className="w-full flex items-center justify-center gap-2 bg-white text-blue-600 border border-blue-100 py-2.5 px-4 rounded-xl text-xs font-bold shadow-sm hover:bg-blue-50 active:scale-95 transition-all"
                            >
                              <Plus size={14} />
                              {sg.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                    <Sparkles size={16} className="animate-pulse" />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl rounded-tl-none">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 bg-white border-t border-gray-100 shrink-0 space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onFileChange}
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
              />

              {pendingImages.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
                  <div className="flex gap-1.5 shrink-0 max-w-[45%] overflow-x-auto">
                    {pendingImages.map((p, i) => (
                      <div key={i} className="relative shrink-0">
                        {p.preview ? (
                          <img src={p.preview} alt="Attached" className="w-14 h-14 rounded-xl object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gray-200" />
                        )}
                        <button
                          type="button"
                          onClick={() => discardPendingImage(i)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center shadow"
                          aria-label="Remove photo"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0 self-center">
                    {initialIntent && initialIntent !== 'other' && pendingIntent !== 'other' ? (
                      <span className="text-xs font-bold text-gray-600">
                        {INTENT_LABELS[pendingIntent]} photo{pendingImages.length > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {INTENT_CHIP_ORDER.map(k => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setPendingIntent(prev => prev === k ? 'other' : k)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              pendingIntent === k
                                ? 'bg-gray-900 text-white'
                                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {INTENT_LABELS[k]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => discardPendingImage()}
                    className="p-1.5 hover:bg-gray-200 rounded-full transition-colors shrink-0"
                    aria-label="Discard photos"
                  >
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
              )}

              <div className="relative">
                <input 
                  type="text"
                  placeholder="Tell me about John or upload ID..."
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 pr-12 text-sm focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                {SpeechRecognition && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={isTyping || isUploading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                  >
                    <Mic 
                      size={18} 
                      className={isListening ? "text-red-500 animate-pulse" : "text-gray-400 hover:text-gray-600"} 
                    />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => {
                    // Trigger standard upload
                    fileInputRef.current!.removeAttribute('capture');
                    fileInputRef.current?.click();
                  }}
                  disabled={isTyping || isUploading}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 text-gray-600 rounded-2xl hover:bg-gray-100 active:scale-95 disabled:opacity-50 transition-all font-bold text-[10px] uppercase tracking-wider"
                >
                  <ImageIcon size={20} />
                  Upload
                </button>
                <button 
                  onClick={() => {
                    // Trigger camera
                    fileInputRef.current!.setAttribute('capture', 'environment');
                    fileInputRef.current?.click();
                  }}
                  disabled={isTyping || isUploading}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-50 text-gray-600 rounded-2xl hover:bg-gray-100 active:scale-95 disabled:opacity-50 transition-all font-bold text-[10px] uppercase tracking-wider"
                >
                  <Camera size={20} />
                  Camera
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && pendingImages.length === 0) || isTyping || isUploading}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 bg-gray-900 text-white rounded-2xl active:scale-95 disabled:opacity-50 transition-all font-bold text-[10px] uppercase tracking-wider"
                >
                  {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  Enter
                </button>
              </div>

              <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
                Auto-magically Extracts DL, VIN & more
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
