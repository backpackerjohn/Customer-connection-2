import React, { useState, useRef, useEffect } from 'react';
import { Camera, Search, Loader2 } from 'lucide-react';
import { decodeVin, readVinFromImage, VinDetails } from '../services/vinService';
import { normalizeImageForVision } from '../lib/imageNormalizer';
import { ImageData } from '../services/aiService';

interface VinLookupButtonsProps {
  vin?: string;
  onResult: (results: Partial<{
    vin: string;
    year: string;
    make: string;
    model: string;
    trim: string;
  }>) => void;
}

export const VinLookupButtons: React.FC<VinLookupButtonsProps> = ({
  vin,
  onResult
}) => {
  const [isLoadingDecoded, setIsLoadingDecoded] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => setError(null), 3000);
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  const handleDecodeTyped = async () => {
    if ((vin ?? '').length !== 17 || isLoadingDecoded || isLoadingCamera) return;

    setIsLoadingDecoded(true);
    setError(null);

    try {
      const details = await decodeVin(vin ?? '');
      if (details) {
        applyResults(details);
      } else {
        showError("Couldn't decode this VIN");
      }
    } catch {
      showError("Couldn't decode this VIN");
    } finally {
      setIsLoadingDecoded(false);
    }
  };

  const handleCamera = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLoadingDecoded || isLoadingCamera) return;

    setIsLoadingCamera(true);
    setError(null);

    try {
      // 1. Normalize
      const normalized = await normalizeImageForVision(file);
      const imageData: ImageData = {
        inlineData: {
          data: normalized.base64,
          mimeType: normalized.mimeType
        }
      };

      // 2. Extract VIN via Gemini
      const ocrResult = await readVinFromImage(imageData);
      
      if (!ocrResult || !ocrResult.vin || ocrResult.confidence === 'low') {
        showError("Couldn't read VIN from image");
        return;
      }

      // 3. Decode via NHTSA
      const details = await decodeVin(ocrResult.vin);
      processCameraResult(ocrResult.vin, details);
    } catch {
      showError("Couldn't read VIN from image");
    } finally {
      setIsLoadingCamera(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyResults = (details: VinDetails) => {
    const results: Partial<{ year: string; make: string; model: string; trim: string }> = {};
    
    if (details.year) results.year = details.year;
    if (details.make) results.make = details.make;
    if (details.model) results.model = details.model;
    if (details.trim) results.trim = details.trim;

    if (Object.keys(results).length > 0) {
      onResult(results);
    } else {
      showError("No new data found for this VIN");
    }
  };

  const processCameraResult = (extractedVin: string, details: VinDetails | null) => {
    const results: Partial<{ vin: string; year: string; make: string; model: string; trim: string }> = {};
    
    // Only fill VIN if current is empty
    if (!vin && extractedVin) results.vin = extractedVin;

    if (details) {
      if (details.year) results.year = details.year;
      if (details.make) results.make = details.make;
      if (details.model) results.model = details.model;
      if (details.trim) results.trim = details.trim;
    }

    if (Object.keys(results).length > 0) {
      onResult(results);
    } else {
      showError(details ? "No new data found" : "Couldn't decode the extracted VIN");
    }
  };

  const isAnyLoading = isLoadingDecoded || isLoadingCamera;

  return (
    <div className="flex flex-col gap-1.5 min-w-[80px]">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDecodeTyped}
          disabled={(vin ?? '').length !== 17 || isAnyLoading}
          className="flex-1 flex items-center justify-center h-10 w-10 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 active:scale-95 disabled:opacity-50 transition-all border border-gray-100 shadow-sm"
          title="Decode typed VIN"
        >
          {isLoadingDecoded ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Search size={18} />
          )}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAnyLoading}
          className="flex-1 flex items-center justify-center h-10 w-10 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 active:scale-95 disabled:opacity-50 transition-all border border-gray-100 shadow-sm"
          title="Scan VIN from photo"
        >
          {isLoadingCamera ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Camera size={18} />
          )}
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleCamera}
          accept="image/*"
          capture="environment"
          className="hidden"
        />
      </div>
      
      {error && (
        <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider text-center animate-pulse">
          {error}
        </div>
      )}
    </div>
  );
};
