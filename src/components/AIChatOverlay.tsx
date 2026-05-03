import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, MessageSquare, User, Camera, Image as ImageIcon, Loader2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { processCustomerChat, ChatResponse, ImageData } from '../services/aiService';
import { lookupVehicleByStock, Vehicle } from '../services/inventoryService';
import { normalizeImageForVision } from '../lib/imageNormalizer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  suggestion?: {
    label: string;
    action: () => void;
    data: any;
  };
}

interface AIChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomer: any;
  onFieldsExtracted: (fields: any, notesSummary?: string) => void;
}

export const AIChatOverlay: React.FC<AIChatOverlayProps> = ({ 
  isOpen, 
  onClose, 
  currentCustomer, 
  onFieldsExtracted 
}) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your AI assistant. Tell me anything about the customer, or snap a photo of their ID/Insurance, and I'll fill out the fields for you." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (imageFile?: File) => {
    if ((!input.trim() && !imageFile) || isTyping || isUploading) return;

    const userMessage = input.trim();
    setInput('');
    
    let imageData: ImageData | undefined;
    let imagePreview: string | undefined;

    if (imageFile) {
      setIsUploading(true);
      try {
        // High-fidelity normalization for AI extraction (handles EXIF, HEIC, Downscaling)
        const normalized = await normalizeImageForVision(imageFile);
        
        // original base64 for user UI preview (fastest, keeps original look)
        const originalBase64 = await fileToBase64(imageFile);
        
        imageData = {
          inlineData: {
            data: normalized.base64,
            mimeType: normalized.mimeType
          }
        };
        imagePreview = originalBase64;
      } catch (error) {
        console.error("Image processing error:", error);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage || (imageFile ? "Sent an image" : ""), 
      image: imagePreview 
    }]);
    setIsTyping(true);

    try {
      console.log("Starting AI chat process...", { userMessage, hasImage: !!imageFile });
      
      // Map history to Gemini format
      const history = messages.slice(1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user' as any,
        parts: [{ text: m.content }]
      }));

      const response = await processCustomerChat(userMessage || "Extracted from image", currentCustomer, history, imageData);
      console.log("AI Response received:", response);
      
      let finalMessage = response.message;
      let suggestionData: any = null;

      // Handle Inventory Lookup if stock found
      if (response.inventoryStockFound) {
        const vehicle = await lookupVehicleByStock(response.inventoryStockFound);
        if (vehicle) {
          finalMessage = `I found Stock #${vehicle.stock} in our inventory:\n\n` +
            `• ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}\n` +
            `• VIN: ${vehicle.vin}\n` +
            `• MSRP: ${vehicle.msrp}\n` +
            `• Color: ${vehicle.exteriorColor} / ${vehicle.interiorColor}\n\n` +
            `Would you like me to add this vehicle to the profile?`;
          
          suggestionData = {
            label: `Add ${vehicle.year} ${vehicle.model} to Profile`,
            data: {
              vehicleStock: vehicle.stock,
              vehicleYear: vehicle.year,
              vehicleMake: vehicle.make,
              vehicleModel: vehicle.model,
              vehicleVin: vehicle.vin
            }
          };
        }
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: finalMessage,
        suggestion: suggestionData ? {
          label: suggestionData.label,
          data: suggestionData.data,
          action: () => {
            onFieldsExtracted(suggestionData.data);
            setMessages(p => [...p, { role: 'assistant', content: "✅ Vehicle added to profile!" }]);
          }
        } : undefined
      }]);
      
      // Filter out null/undefined from updatedFields to prevent erasing data
      const cleanFields = Object.entries(response.updatedFields).reduce((acc, [key, value]) => {
        if (value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      if ((Object.keys(cleanFields).length > 0 || response.hasGoodNotes) && !suggestionData) {
        onFieldsExtracted(cleanFields, response.notesSummary);
      }
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
    const file = e.target.files?.[0];
    if (file) {
      handleSend(file);
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] md:hidden"
          />

          {/* Chat Sheet (Mobile) */}
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 top-20 bg-white rounded-t-[32px] z-[70] flex flex-col shadow-2xl md:hidden"
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
                      {m.image && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                          <img src={m.image} alt="Upload" className="max-w-full h-auto" />
                        </div>
                      )}
                      {m.content}
                      
                      {m.suggestion && (
                        <button
                          onClick={m.suggestion.action}
                          className="mt-3 w-full flex items-center justify-center gap-2 bg-white text-blue-600 border border-blue-100 py-2.5 px-4 rounded-xl text-xs font-bold shadow-sm hover:bg-blue-50 active:scale-95 transition-all"
                        >
                          <Plus size={14} />
                          {m.suggestion.label}
                        </button>
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
                capture="environment"
                className="hidden" 
              />
              
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Tell me about John or upload ID..."
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
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
                  disabled={(!input.trim() && !isUploading) || isTyping}
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
