import { GoogleGenAI } from "@google/genai";
import { timed } from "../lib/timing";

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
}

export interface ValuationResponse {
  excellent: { low: string; high: string };
  veryGood: { low: string; high: string };
  good: { low: string; high: string };
  fair: { low: string; high: string };
  source: string;
  citationUrls: string[];
  notes: string;
}

interface RawValuationResult {
  excellent: { low: string; high: string };
  very_good: { low: string; high: string };
  good: { low: string; high: string };
  fair: { low: string; high: string };
  source: string;
  notes: string;
}

export async function getTradeValuation(
  request: ValuationRequest, 
  options?: { skipCache?: boolean }
): Promise<ValuationResponse | null> {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  const cacheKey = `${request.vin}|${request.mileage}`;
  if (!options?.skipCache) {
    const cached = valuationCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 300_000) {
      return cached.result;
    }
  }

  const systemInstruction = `You are a vehicle valuation assistant for a car dealership in Chillicothe, Ohio (ZIP ${DEALER_ZIP}). Given a vehicle's details, find its current TRADE-IN (wholesale) values across ALL FOUR condition tiers in the local market — within ${SEARCH_RADIUS_MILES} miles of ZIP ${DEALER_ZIP}.

CRITICAL: Return TRADE-IN / WHOLESALE values, NOT retail and NOT private-party. These are different numbers. The trade-in value is what a dealer would pay the customer for the vehicle.

Return a price range (low and high) for EACH of the four condition tiers:

excellent: KBB Excellent / Edmunds Outstanding

very_good: KBB Very Good / Edmunds Clean

good: KBB Good / Edmunds Average

fair: KBB Fair / Edmunds Rough

The four ranges MUST be MONOTONIC. excellent.low ≥ very_good.low ≥ good.low ≥ fair.low; the same ordering must hold for the high values. A vehicle in better condition is always worth at least as much as the same vehicle in worse condition. If your sources disagree such that this monotonicity would be violated, return empty strings for all four tiers — do not produce inconsistent results.

Sources to consult, in priority order: <KBB.com>, <Edmunds.com>, NADA Guides (<nadaguides.com>), <CarGurus.com>.

When two or more sources return values for the same condition tier, AVERAGE their lows and AVERAGE their highs. Set 'source' to describe what you averaged (e.g., 'Average of KBB and Edmunds').

If you cannot find data from at least one of the listed sources, return empty strings for low/high across all four tiers. DO NOT INVENT NUMBERS.

Always include this exact phrase in 'notes': 'Pending physical inspection — not a binding offer.'

Format low and high as plain numeric strings with no $ or commas (e.g., '12400'). The UI handles display formatting.

Format output as JSON:
{ "excellent": {"low":"...","high":"..."}, "very_good": {"low":"...","high":"..."}, "good": {"low":"...","high":"..."}, "fair": {"low":"...","high":"..."}, "source":"...", "notes":"..." }`;

  const userPrompt = `Find the trade-in values for this vehicle in the southern Ohio market (near ${DEALER_ZIP}):
VIN: ${request.vin}
Year: ${request.year}
Make: ${request.make}
Model: ${request.model}
Trim: ${request.trim}
Mileage: ${request.mileage}`;

  try {
    const response = await timed('valuationService.getTradeValuation (grounded)', async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        }
      });
    });

    const resultText = response.text || '{}';
    let parsed: RawValuationResult;
    const extractJson = (text: string): string => {
      const fencedJson = text.match(/```json\s*([\s\S]*?)\s*```/i);
      if (fencedJson) return fencedJson[1];
      const fencedAny = text.match(/```\s*([\s\S]*?)\s*```/);
      if (fencedAny) return fencedAny[1];
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end > start) return text.substring(start, end + 1);
      return text;
    };

    try {
      const cleaned = extractJson(resultText).trim();
      parsed = JSON.parse(cleaned);
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

    const { excellent, very_good: very_good, good, fair, source, notes } = parsed;

    // Sanity check helper
    const validateTier = (tier: { low: string; high: string } | undefined) => {
      if (!tier || !tier.low || !tier.high) return null;
      const lowNum = parseFloat(tier.low);
      const highNum = parseFloat(tier.high);
      if (isNaN(lowNum) || isNaN(highNum)) return null;
      if (lowNum > highNum) return null;
      if (lowNum > 200000 || highNum > 200000) return null;
      if (highNum > lowNum * 10) return null;
      return { low: lowNum, high: highNum };
    };

    const e = validateTier(excellent);
    const vg = validateTier(very_good);
    const g = validateTier(good);
    const f = validateTier(fair);

    if (!e || !vg || !g || !f) return null;

    // Cross-tier monotonicity checks
    if (!(e.low >= vg.low && vg.low >= g.low && g.low >= f.low)) return null;
    if (!(e.high >= vg.high && vg.high >= g.high && g.high >= f.high)) return null;

    const result: ValuationResponse = {
      excellent: { low: e.low.toString(), high: e.high.toString() },
      veryGood: { low: vg.low.toString(), high: vg.high.toString() },
      good: { low: g.low.toString(), high: g.high.toString() },
      fair: { low: f.low.toString(), high: f.high.toString() },
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
