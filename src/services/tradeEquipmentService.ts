import { GoogleGenAI, Type } from '@google/genai';
import { timed } from '../lib/timing';
import { EQUIPMENT_BOXES } from '../lib/tradeCheckInSheet';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export type EquipmentStatus = 'standard' | 'optional' | 'no' | 'unknown';

export interface EquipmentLookupResult {
  /** Box name → status for the trim, as researched. */
  statuses: Record<string, EquipmentStatus>;
  /** Free-text extras the sheet has a line for. */
  premiumAudioBrand?: string;
  smartphoneAppName?: string;
  /** Distinct source domains the grounded call cited. */
  sources: string[];
  /** The model's own notes, e.g. "trim not found, used base trim". */
  notes?: string;
}

/**
 * Two calls on purpose: the Gemini API does not reliably combine live Google
 * Search grounding with strict JSON output in one request. Call 1 researches
 * with search and returns prose plus source URLs. Call 2 turns that prose into
 * the exact sheet box names with a strict schema.
 */
export async function lookupTradeEquipment(input: {
  year: string; make: string; model: string; trim?: string;
}): Promise<EquipmentLookupResult | null> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const vehicle = [input.year, input.make, input.model, input.trim].filter(Boolean).join(' ').trim();
  if (!input.year || !input.make || !input.model) return null;

  const checklist = EQUIPMENT_BOXES.map(b => `- ${b}`).join('\n');

  // ---- Call 1: grounded research ----
  const research = await timed('tradeEquipment.research (grounded)', async () => {
    return await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text:
`Research the factory equipment of the ${vehicle} (US market)${input.trim ? '' : ' (trim unknown: use the base trim and say so)'}.
Use the manufacturer's site and reputable spec sites (Edmunds, KBB, Cars.com, Car and Driver).

For EACH item on this dealer check-in checklist, answer exactly one of: STANDARD (came on every ${input.trim ? 'unit of this trim' : 'base-trim unit'}), OPTIONAL (available as a package or option on this trim), NO (not offered on this trim), or UNKNOWN (could not verify).
Also give: the premium audio brand if any (e.g. Bose, Harman Kardon, Bang & Olufsen), and the manufacturer's smartphone app name if it is not KiaConnect, uConnect, or Bluelink.

Notes for judging:
- "Cloth" and "Leather" describe the seat material of the trim.
- "Rear Window" means a rear window on a truck cab; "Rear Window Defrost" and "Rear Window Wiper" are separate.
- "Smartphone App Integration" means the maker's remote app (e.g. HondaLink, FordPass, MySubaru, Toyota app).
- Tick "AC" for any air conditioning; "Climate Control" only for automatic/dual-zone climate control.

Checklist:
${checklist}

Answer as a plain list, one line per item: "<item>: <STANDARD|OPTIONAL|NO|UNKNOWN> - <short reason>". Then two final lines: "Premium audio brand: <brand or none>" and "Smartphone app: <name or none>". Be concrete and do not skip items.` }],
      }],
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0,
      },
    });
  });

  const prose = research.text ?? '';
  if (!prose.trim()) return null;
  const sources = new Set<string>();
  for (const chunk of research.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title;
    const label = title && /\./.test(title) ? title : uri;
    if (label) {
      try { sources.add(new URL(label.startsWith('http') ? label : `https://${label}`).hostname.replace(/^www\./, '')); }
      catch { sources.add(label); }
    }
  }

  // ---- Call 2: strict structure ----
  const structured = await timed('tradeEquipment.structure (schema)', async () => {
    return await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Convert this research into the schema. Use the exact item names from the checklist. Any item not mentioned is "unknown".\n\nCHECKLIST ITEMS:\n${checklist}\n\nRESEARCH:\n${prose}` }] }],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING, enum: [...EQUIPMENT_BOXES] },
                  status: { type: Type.STRING, enum: ['standard', 'optional', 'no', 'unknown'] },
                },
                propertyOrdering: ['item', 'status'],
                required: ['item', 'status'],
              },
            },
            premiumAudioBrand: { type: Type.STRING },
            smartphoneAppName: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          propertyOrdering: ['items', 'premiumAudioBrand', 'smartphoneAppName', 'notes'],
          required: ['items'],
        },
      },
    });
  });

  let parsed: { items?: { item: string; status: EquipmentStatus }[]; premiumAudioBrand?: string; smartphoneAppName?: string; notes?: string };
  try { parsed = JSON.parse(structured.text || '{}'); } catch { return null; }

  const statuses: Record<string, EquipmentStatus> = {};
  for (const row of parsed.items ?? []) {
    if (EQUIPMENT_BOXES.includes(row.item)) statuses[row.item] = row.status;
  }
  const clean = (v?: string) => { const t = (v ?? '').trim(); return t && !/^(none|n\/a|no)$/i.test(t) ? t : undefined; };

  return {
    statuses,
    premiumAudioBrand: clean(parsed.premiumAudioBrand),
    smartphoneAppName: clean(parsed.smartphoneAppName),
    sources: [...sources],
    notes: clean(parsed.notes),
  };
}
