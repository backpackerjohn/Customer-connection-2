import { GoogleGenAI, Type } from "@google/genai";
import { ImageData } from "./aiService";
import { timed } from "../lib/timing";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface VinDetails {
  year: string;
  make: string;
  model: string;
  trim: string;
}

export interface VinImageResult {
  vin: string;
  confidence: "high" | "low";
}

/**
 * Decodes a 17-character VIN using the NHTSA API.
 */
export async function decodeVin(vin: string): Promise<VinDetails | null> {
  if (!vin || vin.length !== 17) return null;

  try {
    const response = await timed('vinService.decodeVin (NHTSA)', async () => {
      return await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`);
    });
    if (!response.ok) return null;

    const data = await response.json();
    const result = data.Results?.[0];

    if (!result || !result.Make?.trim() || !result.ModelYear?.trim()) {
      return null;
    }

    return {
      year: result.ModelYear || "",
      make: result.Make || "",
      model: result.Model || "",
      trim: result.Trim || ""
    };
  } catch (error) {
    console.error("VIN Decode Error:", error);
    return null;
  }
}

/**
 * Reads a VIN from an image using Gemini.
 */
export async function readVinFromImage(image: ImageData): Promise<VinImageResult | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set");
    return null;
  }

  const systemInstruction = "You read VINs off photographs. A VIN is exactly 17 characters, uppercase letters and digits, and never contains the letters I, O, or Q (those positions are always digits). Return only the VIN string you can read with confidence. If the image is blurry, partially obscured, or you cannot read 17 valid characters, return an empty string. Do not guess.";

  try {
    const response = await timed('vinService.readVinFromImage (Gemini OCR)', async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: 'user', parts: [image] }
        ],
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vin: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ["high", "low"] }
            },
            propertyOrdering: ["vin", "confidence"],
            required: ["vin", "confidence"]
          }
        }
      });
    });

    const resultText = response.text || "{}";
    const parsedResult = JSON.parse(resultText);
    
    return {
      vin: parsedResult.vin || "",
      confidence: parsedResult.confidence || "low"
    };
  } catch (error) {
    console.error("VIN Image OCR Error:", error);
    return null;
  }
}
