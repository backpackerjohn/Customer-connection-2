import { GoogleGenAI, Type } from '@google/genai';
import { timed } from '../lib/timing';
import { APP_BOXES, APP_BOX_SET } from '../lib/tradeCheckInSheet';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export type EquipmentStatus = 'standard' | 'optional' | 'no' | 'unknown';

export interface EquipmentLookupResult {
  /** Box name → status for the trim, as researched. */
  statuses: Record<string, EquipmentStatus>;
  /** Free-text extras the sheet has a line for. */
  premiumAudioBrand?: string;
  smartphoneAppName?: string;
  /** Number of forward gears on the standard transmission, e.g. "6". Used only when the VIN decode has none. */
  transmissionSpeeds?: string;
  /** Distinct source domains the grounded call cited. Empty when not web-verified. */
  sources: string[];
  /** True when the answer came from a live web search; false when it came from model knowledge only. */
  verified: boolean;
  /** Which path produced the answer, for the log. */
  via: 'grounded' | 'fast';
  notes?: string;
}

/** Stored in tradeCheckIn.sources when the answer came from model knowledge only. */
export const UNVERIFIED_SOURCES = 'model knowledge, not web-verified';

export interface LookupOptions {
  /**
   * Quick mode is for print time: one grounded attempt with a short timeout,
   * then the fast fallback. Full mode (the card's Look up button) also tries
   * the second grounded model before falling back.
   */
  quick?: boolean;
}

/**
 * Only the model the rest of the app already proves works. A second model id
 * (gemini-2.5-flash-lite) returned 404 on the dealer's key, so no guessing:
 * resilience comes from retries, thinking budgets, and the ungrounded fallback,
 * not from other model ids.
 */
const MODEL = 'gemini-2.5-flash';
/** Thinking makes an 82-item answer take a minute; the research needs a little, the schema calls need none. */
const RESEARCH_THINKING = { thinkingBudget: 512 };
const NO_THINKING = { thinkingBudget: 0 };

const checklist = () => APP_BOXES.map(b => `- ${b}`).join('\n');
const vehicleName = (i: { year: string; make: string; model: string; trim?: string }) =>
  [i.year, i.make, i.model, i.trim].filter(Boolean).join(' ').trim();

const JUDGING_NOTES = `Notes for judging:
- "Cloth" and "Leather" describe the seat material of the trim.
- "Rear Window" means a rear window on a truck cab; "Rear Window Defrost" and "Rear Window Wiper" are separate.
- "Smartphone App Integration" means the maker's remote app (e.g. HondaLink, FordPass, MySubaru, Toyota app).
- Tick "AC" for any air conditioning; "Climate Control" only for automatic/dual-zone climate control.
- Drivetrain, Transmission, Doors, Fuel, Cab and Bed are single-choice groups: answer S for the configuration that is standard on this trim and O for a factory option (a front-drive SUV with optional AWD is "FWD: S" and "AWD: O"). "4x4" and "4x2" are for trucks and body-on-frame SUVs; cars and crossovers use FWD/RWD/AWD.
- Doors counts passenger doors only; a hatch or tailgate does not count, so most sedans, hatchbacks and SUVs are "4 Doors".
- "Transmission speeds" is the number of forward gears of the standard transmission (a CVT is "CVT").`;

/** 503 / 429 / timeouts are worth retrying or falling back on; 400s are not. */
export function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /"code":\s*(503|429|500|504)|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE|high demand|overloaded|timed? ?out|aborted|fetch failed|network/i.test(msg);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING, enum: [...APP_BOXES] },
          status: { type: Type.STRING, enum: ['standard', 'optional', 'no', 'unknown'] },
        },
        propertyOrdering: ['item', 'status'],
        required: ['item', 'status'],
      },
    },
    premiumAudioBrand: { type: Type.STRING },
    smartphoneAppName: { type: Type.STRING },
    transmissionSpeeds: { type: Type.STRING },
    notes: { type: Type.STRING },
  },
  propertyOrdering: ['items', 'premiumAudioBrand', 'smartphoneAppName', 'transmissionSpeeds', 'notes'],
  required: ['items'],
};

interface Parsed { items?: { item: string; status: EquipmentStatus }[]; premiumAudioBrand?: string; smartphoneAppName?: string; transmissionSpeeds?: string; notes?: string }

function finish(parsed: Parsed, sources: string[], verified: boolean, via: EquipmentLookupResult['via']): EquipmentLookupResult {
  const statuses: Record<string, EquipmentStatus> = {};
  for (const row of parsed.items ?? []) {
    if (APP_BOX_SET.has(row.item)) statuses[row.item] = row.status;
  }
  const clean = (v?: string) => { const t = (v ?? '').trim(); return t && !/^(none|n\/a|no|unknown)$/i.test(t) ? t : undefined; };
  return {
    statuses,
    premiumAudioBrand: clean(parsed.premiumAudioBrand),
    smartphoneAppName: clean(parsed.smartphoneAppName),
    transmissionSpeeds: clean(parsed.transmissionSpeeds)?.replace(/[^0-9A-Za-z]/g, '').slice(0, 4),
    sources,
    verified,
    via,
    notes: clean(parsed.notes),
  };
}

/**
 * Call 1 of the grounded path: research with Google Search, terse output so it
 * finishes in a reasonable time. Returns prose plus cited source domains.
 */
async function researchGrounded(input: { year: string; make: string; model: string; trim?: string }, model: string, timeoutMs: number) {
  const vehicle = vehicleName(input);
  const res = await timed(`tradeEquipment.research (${model}, grounded)`, () => ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text:
`Research the factory equipment of the ${vehicle} (US market)${input.trim ? '' : ' (trim unknown: use the base trim and say so)'}.
Use the manufacturer's site and reputable spec sites (Edmunds, KBB, Cars.com, Car and Driver).

For EACH item below answer exactly one letter: S (standard on every ${input.trim ? 'unit of this trim' : 'base-trim unit'}), O (optional package or option on this trim), N (not offered on this trim), U (could not verify).
Then three final lines: "Premium audio brand: <brand or none>", "Smartphone app: <name or none>", "Transmission speeds: <number or CVT>".

${JUDGING_NOTES}

Checklist:
${checklist()}

Output format, one line per item, nothing else: "<item>: <S|O|N|U>". Do not skip items. No explanations.` }] }],
    config: { tools: [{ googleSearch: {} }], temperature: 0, thinkingConfig: RESEARCH_THINKING, httpOptions: { timeout: timeoutMs } },
  }));
  const prose = res.text ?? '';
  const sources = new Set<string>();
  for (const chunk of res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
    const label = chunk.web?.uri || chunk.web?.title;
    if (!label) continue;
    try { sources.add(new URL(label.startsWith('http') ? label : `https://${label}`).hostname.replace(/^www\./, '')); }
    catch { sources.add(label); }
  }
  return { prose, sources: [...sources] };
}

/** Call 2 of the grounded path: turn the letter list into the strict schema. Cheap and fast. */
async function structure(prose: string, timeoutMs: number): Promise<Parsed> {
  const res = await timed('tradeEquipment.structure (schema)', () => ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Convert this research into the schema. S=standard, O=optional, N=no, U=unknown. Use the exact item names from the checklist; any item not mentioned is "unknown". Copy the premium audio brand, smartphone app and transmission speeds lines into their fields.\n\nCHECKLIST ITEMS:\n${checklist()}\n\nRESEARCH:\n${prose}` }] }],
    config: { temperature: 0, thinkingConfig: NO_THINKING, responseMimeType: 'application/json', responseSchema, httpOptions: { timeout: timeoutMs } },
  }));
  try { return JSON.parse(res.text || '{}'); } catch { return {}; }
}

/**
 * Fallback path: one structured call from model knowledge, no web search.
 * Roughly the 85-90% tier. Marked unverified so the card says so.
 */
async function fastLookup(input: { year: string; make: string; model: string; trim?: string }, timeoutMs: number): Promise<Parsed> {
  const vehicle = vehicleName(input);
  const res = await timed('tradeEquipment.fast (no search)', () => ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text:
`From your knowledge of the ${vehicle} (US market)${input.trim ? '' : ' (trim unknown: use the base trim)'}, classify each checklist item as standard on this trim, optional on this trim, not offered, or unknown. When you are not sure whether something was standard or an option, answer "optional", never "standard". Also give the premium audio brand if any, the maker's smartphone app name if it is not KiaConnect, uConnect, or Bluelink, and the number of speeds of the standard transmission.

${JUDGING_NOTES}

Checklist:
${checklist()}` }] }],
    config: { temperature: 0, thinkingConfig: NO_THINKING, responseMimeType: 'application/json', responseSchema, httpOptions: { timeout: timeoutMs } },
  }));
  try { return JSON.parse(res.text || '{}'); } catch { return {}; }
}

/**
 * Best available answer for the trim's equipment:
 *   1. grounded research (Google Search) + schema conversion; retried once on
 *      503/429/timeout in full mode
 *   2. fast, ungrounded structured call from model knowledge (marked unverified);
 *      retried once in full mode
 * Returns null only when the input is incomplete; throws EquipmentLookupError
 * listing what every attempt said, so the dealer (and the log) can tell why.
 */
export async function lookupTradeEquipmentDirect(
  input: { year: string; make: string; model: string; trim?: string },
  options: LookupOptions = {}
): Promise<EquipmentLookupResult | null> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  if (!input.year || !input.make || !input.model) return null;
  const quick = !!options.quick;
  const groundedTimeout = quick ? 35_000 : 50_000;
  const groundedTries = quick ? 1 : 2;
  const fastTries = quick ? 1 : 2;

  /** "grounded: Gemini is overloaded (503)" for each failed attempt, in order. */
  const attempts: string[] = [];
  const note = (label: string, err: unknown) => {
    const summary = summarizeGeminiError(err);
    attempts.push(`${label}: ${summary}`);
    console.warn(`Trade equipment lookup, ${label} failed: ${summary}`, err);
  };

  for (let i = 0; i < groundedTries; i++) {
    try {
      if (i > 0) await sleep(1500);
      const { prose, sources } = await researchGrounded(input, MODEL, groundedTimeout);
      if (!prose.trim()) throw new Error('empty grounded response');
      const parsed = await structure(prose, 25_000);
      if (!parsed.items?.length) throw new Error('empty structured response');
      return finish(parsed, sources, true, 'grounded');
    } catch (err) {
      note('grounded', err);
      if (!isRetryableGeminiError(err) && !/empty/.test(String(err))) break;
    }
  }

  for (let i = 0; i < fastTries; i++) {
    try {
      if (i > 0) await sleep(1500);
      const parsed = await fastLookup(input, 40_000);
      if (!parsed.items?.length) throw new Error('empty fast response');
      return finish(parsed, [], false, 'fast');
    } catch (err) {
      note('fast', err);
      if (!isRetryableGeminiError(err) && !/empty/.test(String(err))) break;
    }
  }

  console.error('Every trade equipment lookup path failed:', attempts);
  throw new EquipmentLookupError(attempts.join('; ') + '.');
}

/**
 * Look up factory equipment for a trade-in vehicle.
 * In the browser, this routes through the /api/lookup-trade-equipment server proxy
 * so that Google API calls execute server-side in Node with full search grounding.
 */
export async function lookupTradeEquipment(
  input: { year: string; make: string; model: string; trim?: string },
  options: LookupOptions = {}
): Promise<EquipmentLookupResult | null> {
  if (!input.year || !input.make || !input.model) return null;

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/lookup-trade-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, options }),
      });
      if (res.ok) {
        return (await res.json()) as EquipmentLookupResult;
      }
      const data = await res.json().catch(() => ({}));
      if (data && typeof data.error === 'string') {
        throw new EquipmentLookupError(data.error);
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err: unknown) {
      if (err instanceof EquipmentLookupError) throw err;
      console.warn('Server trade equipment lookup failed, falling back to direct:', err);
    }
  }

  return lookupTradeEquipmentDirect(input, options);
}

/** Thrown when every Gemini path failed; the message is short enough for the card. */
export class EquipmentLookupError extends Error {
  constructor(message: string) { super(message); this.name = 'EquipmentLookupError'; }
}

/** One line a dealer can read, e.g. "Gemini is overloaded (503)". */
export function summarizeGeminiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code = msg.match(/"code":\s*(\d{3})/)?.[1];
  if (code === '503' || /high demand|overloaded|UNAVAILABLE/i.test(msg)) return 'Gemini overloaded (503)';
  if (code === '429' || /RESOURCE_EXHAUSTED/i.test(msg)) return 'Gemini rate limit (429)';
  if (/timed? ?out|aborted/i.test(msg)) return 'no answer in time';
  if (/^empty /.test(msg)) return msg;
  if (code === '400' && /tool|googleSearch|grounding/i.test(msg)) return 'this API key cannot use Google Search grounding (400)';
  if (code === '400') return `Gemini rejected the request (400): ${(msg.match(/"message":\s*"([^"]{0,80})/)?.[1] ?? '').trim()}`.trim();
  if (code === '403' || /API key|PERMISSION_DENIED/i.test(msg)) return 'Gemini rejected the API key (403)';
  if (code === '404' || /not found/i.test(msg)) return `Gemini 404: ${(msg.match(/"message":\s*"([^"]{0,120})/)?.[1] ?? msg.slice(0, 120)).trim()}`;
  const status = msg.match(/"status":\s*"([A-Z_]+)"/)?.[1];
  return status ? `Gemini error ${code ?? ''} ${status}`.replace(/\s+/g, ' ').trim() : msg.slice(0, 120);
}
