import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const DEALER_ZIP = '45601';
const SEARCH_RADIUS_MILES = 250;

const valuationCache = new Map<string, { result: ValuationResponse, at: number }>();

export interface ValuationRequest { 
  vin: string; 
  year: string; 
  make: string; 
  model: string; 
  trim: string; 
  mileage: string; 
  condition: 'excellent' | 'very_good' | 'good' | 'fair'; 
}

export interface ValuationResponse {
  low: string;
  high: string;
  source: string;
  citationUrls: string[];
  notes: string;
}

export async function getTradeValuation(
  request: ValuationRequest, 
  options?: { skipCache?: boolean }
): Promise<ValuationResponse | null> {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  const cacheKey = `${request.vin}|${request.mileage}|${request.condition}`;
  if (!options?.skipCache) {
    const cached = valuationCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 300_000) {
      return cached.result;
    }
  }

  const systemInstruction = `You are a vehicle valuation assistant for a car dealership in Chillicothe, Ohio (ZIP ${DEALER_ZIP}). Given a vehicle's details, find its current TRADE-IN (wholesale) value in the local market — within ${SEARCH_RADIUS_MILES} miles of ZIP ${DEALER_ZIP}.

CRITICAL: Return TRADE-IN / WHOLESALE value, NOT retail and NOT private-party. These are different numbers. The trade-in value is what a dealer would pay the customer for the vehicle.

Sources to consult, in priority order: <KBB.com> (Kelley Blue Book), <Edmunds.com>, NADA Guides (<nadaguides.com>), <CarGurus.com>.

Map the customer's condition tier to each source's terminology:
- 'excellent' → KBB Excellent / Edmunds Outstanding
- 'very_good' → KBB Very Good / Edmunds Clean
- 'good' → KBB Good / Edmunds Average
- 'fair' → KBB Fair / Edmunds Rough

When two or more sources return values, AVERAGE their lows for 'low' and AVERAGE their highs for 'high'. Set 'source' to describe what you averaged (e.g., 'Average of KBB and Edmunds').

If you cannot find data from at least one of the listed sources, return empty strings for low/high/source. DO NOT INVENT NUMBERS.

Always include this exact phrase in 'notes': 'Pending physical inspection — not a binding offer.'

Format low and high as plain numeric strings with no $ or commas (e.g., '12400'). The UI will format display.

Response format MUST be a single JSON object:
{ "low": "string", "high": "string", "source": "string", "notes": "string" }`;

  const userPrompt = `Find the trade-in value for this vehicle in the southern Ohio market (near ${DEALER_ZIP}):
VIN: ${request.vin}
Year: ${request.year}
Make: ${request.make}
Model: ${request.model}
Trim: ${request.trim}
Mileage: ${request.mileage}
Condition: ${request.condition}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      }
    });

    const resultText = response.text || '{}';
    let parsed: { low?: string; high?: string; source?: string; notes?: string } = {};
    try {
      parsed = JSON.parse(resultText);
    } catch (e) {
      console.error("Valuation JSON Parse Error:", e, resultText);
      return null;
    }

    // Citations extraction
    const citationUrls: string[] = [];
    const groundingMetadata = (response as unknown as { 
      candidates?: Array<{ 
        groundingMetadata?: { 
          groundingChunks?: Array<{ 
            web?: { uri?: string } 
          }> 
        } 
      }> 
    }).candidates?.[0]?.groundingMetadata;

    const groundingChunks = groundingMetadata?.groundingChunks;
    if (groundingChunks && Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks) {
        const uri = chunk.web?.uri;
        if (uri && !citationUrls.includes(uri)) {
          citationUrls.push(uri);
          if (citationUrls.length >= 5) break;
        }
      }
    }

    const { low, high, source, notes } = parsed;

    // Sanity checks
    if (low === '' && high === '') return null;

    const lowNum = parseFloat(low || '');
    const highNum = parseFloat(high || '');

    if (isNaN(lowNum) || isNaN(highNum)) return null;
    if (lowNum > highNum) return null;
    if (lowNum > 200000 || highNum > 200000) return null;
    if (highNum > lowNum * 10) return null;

    const result = {
      low: lowNum.toString(),
      high: highNum.toString(),
      source: source || '',
      citationUrls,
      notes: notes || 'Pending physical inspection — not a binding offer.'
    };

    valuationCache.set(cacheKey, { result, at: Date.now() });

    return result;

  } catch (error) {
    console.error("Valuation AI Error:", error);
    return null;
  }
}
