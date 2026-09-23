import { GoogleGenAI, Type } from '@google/genai';
import { timed } from '../lib/timing';
import { isRetryableGeminiError, summarizeGeminiError } from './tradeEquipmentService';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const MODEL = 'gemini-2.5-flash';

export interface LenderLookupResult {
  /** Official lender name as it appears on lien paperwork. */
  name: string;
  phone?: string;
  /** Overnight / express payoff street address. */
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** Distinct source domains the grounded search cited. Empty when not web-verified. */
  sources: string[];
  verified: boolean;
  notes?: string;
}

export class LenderLookupError extends Error {
  constructor(message: string) { super(message); this.name = 'LenderLookupError'; }
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    phone: { type: Type.STRING },
    address: { type: Type.STRING },
    city: { type: Type.STRING },
    state: { type: Type.STRING },
    zip: { type: Type.STRING },
    notes: { type: Type.STRING },
  },
  propertyOrdering: ['name', 'phone', 'address', 'city', 'state', 'zip', 'notes'],
  required: ['name'],
};

type Parsed = Partial<Omit<LenderLookupResult, 'sources' | 'verified'>>;

const ASK = (bank: string) => `A car dealership is paying off a customer's auto loan with ${bank} and will send the payoff check by overnight courier (FedEx/UPS).
Find, preferring the lender's own website:
1. The official lender name as it appears on auto lien paperwork (use the auto finance division if the company has several).
2. The dealer / lienholder payoff phone line.
3. The OVERNIGHT or express payoff address: a street address a courier can deliver to, not a PO Box. Many lenders list a separate "overnight payoff" address next to their regular payoff PO Box; that is the one wanted. If only a PO Box is published, give it and say so in the notes.
Answer with exactly these lines and nothing else:
Official name: <name>
Payoff phone: <number or unknown>
Overnight address: <street address or unknown>
City: <city or unknown>
State: <2-letter state or unknown>
Zip: <zip or unknown>
Notes: <one line, e.g. "PO Box only" or "overnight address confirmed on lender site", or none>`;

async function researchGrounded(bank: string, timeoutMs: number) {
  const res = await timed('lenderLookup.research (grounded)', () => ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: ASK(bank) }] }],
    config: { tools: [{ googleSearch: {} }], temperature: 0, thinkingConfig: { thinkingBudget: 512 }, httpOptions: { timeout: timeoutMs } },
  }));
  const sources = new Set<string>();
  for (const chunk of res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
    const label = chunk.web?.uri || chunk.web?.title;
    if (!label) continue;
    try { sources.add(new URL(label.startsWith('http') ? label : `https://${label}`).hostname.replace(/^www\./, '')); }
    catch { sources.add(label); }
  }
  return { prose: res.text ?? '', sources: [...sources] };
}

async function structure(prose: string, timeoutMs: number): Promise<Parsed> {
  const res = await timed('lenderLookup.structure (schema)', () => ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Copy these lender details into the schema. Leave a field empty when the text says unknown.\n\n${prose}` }] }],
    config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json', responseSchema, httpOptions: { timeout: timeoutMs } },
  }));
  try { return JSON.parse(res.text || '{}'); } catch { return {}; }
}

async function fastLookup(bank: string, timeoutMs: number): Promise<Parsed> {
  const res = await timed('lenderLookup.fast (no search)', () => ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `${ASK(bank)}\n\nYou have no web access: answer from memory and put "from memory, verify before use" in Notes.` }] }],
    config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json', responseSchema, httpOptions: { timeout: timeoutMs } },
  }));
  try { return JSON.parse(res.text || '{}'); } catch { return {}; }
}

const clean = (v?: string) => { const t = (v ?? '').trim(); return t && !/^(unknown|none|n\/a)$/i.test(t) ? t : undefined; };

function finish(parsed: Parsed, bank: string, sources: string[], verified: boolean): LenderLookupResult {
  return {
    name: clean(parsed.name) ?? bank.trim(),
    phone: clean(parsed.phone),
    address: clean(parsed.address),
    city: clean(parsed.city),
    state: clean(parsed.state)?.toUpperCase().slice(0, 2),
    zip: clean(parsed.zip),
    sources,
    verified,
    notes: clean(parsed.notes),
  };
}

/**
 * Web lookup of a lender's payoff phone and overnight address. Grounded search
 * first (retried once on 503/429/timeout), then model knowledge marked
 * unverified. The dealer confirms the result before it is saved anywhere.
 */
export async function lookupLender(bank: string): Promise<LenderLookupResult> {
  if (!process.env.GEMINI_API_KEY) throw new LenderLookupError('GEMINI_API_KEY is not set');
  const name = bank.trim();
  if (name.length < 2) throw new LenderLookupError('type the lender name first');
  const attempts: string[] = [];
  const note = (label: string, err: unknown) => {
    const summary = summarizeGeminiError(err);
    attempts.push(`${label}: ${summary}`);
    console.warn(`Lender lookup, ${label} failed: ${summary}`, err);
  };

  for (let i = 0; i < 2; i++) {
    try {
      if (i > 0) await new Promise(r => setTimeout(r, 1500));
      const { prose, sources } = await researchGrounded(name, 40_000);
      if (!prose.trim()) throw new Error('empty grounded response');
      const parsed = await structure(prose, 20_000);
      if (!clean(parsed.address) && !clean(parsed.phone)) throw new Error('empty structured response');
      return finish(parsed, name, sources, true);
    } catch (err) {
      note('grounded', err);
      if (!isRetryableGeminiError(err) && !/empty/.test(String(err))) break;
    }
  }
  try {
    const parsed = await fastLookup(name, 30_000);
    if (!clean(parsed.address) && !clean(parsed.phone)) throw new Error('empty fast response');
    return finish(parsed, name, [], false);
  } catch (err) {
    note('fast', err);
  }
  throw new LenderLookupError(attempts.join('; ') + '.');
}
