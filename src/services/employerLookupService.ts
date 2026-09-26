import { GoogleGenAI, Type } from '@google/genai';
import { timed } from '../lib/timing';
import { Near, DEALER_HOME } from '../lib/employers';
import { isRetryableGeminiError, summarizeGeminiError } from './tradeEquipmentService';

/**
 * "Find this business near this place." Two engines behind one interface:
 *   - Google Places (Text Search): authoritative listings ranked by distance,
 *     used when GOOGLE_PLACES_API_KEY is set on the server.
 *   - Gemini with Google Search grounding: no setup, slower, occasionally
 *     imperfect; also the fallback if Places fails.
 * Runs server-side via /api/lookup-employer (the browser preview cannot call
 * Google directly); the browser wrapper falls back to a direct call outside it.
 */

export interface EmployerCandidate {
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  note?: string;
}

export interface EmployerLookupResult {
  candidates: EmployerCandidate[];
  /** Source domains (Gemini) or ["places"] (Places). Empty when from model knowledge. */
  sources: string[];
  verified: boolean;
  engine: 'places' | 'gemini';
}

export class EmployerLookupError extends Error {
  constructor(message: string) { super(message); this.name = 'EmployerLookupError'; }
}

const MODEL = 'gemini-2.5-flash';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const placesKey = (): string | undefined => (typeof process !== 'undefined' && process.env ? process.env.GOOGLE_PLACES_API_KEY : undefined);

export function nearLabel(near: Near): string {
  const n = near.city ? near : DEALER_HOME;
  return [n.city, n.state].filter(Boolean).join(', ');
}

const clean = (v?: string) => { const t = (v ?? '').trim(); return t && !/^(unknown|none|n\/a)$/i.test(t) ? t : undefined; };

// ---------------------------------------------------------------- Places
interface PlacesAddressComponent { longText?: string; shortText?: string; types?: string[] }
interface PlacesPlace { displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; addressComponents?: PlacesAddressComponent[] }

async function searchPlaces(query: string, near: Near, key: string): Promise<EmployerLookupResult> {
  const res = await timed('employerLookup.places', () => fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.addressComponents',
    },
    body: JSON.stringify({ textQuery: `${query} near ${nearLabel(near)}`, regionCode: 'US', maxResultCount: 5, languageCode: 'en' }),
  }));
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { places?: PlacesPlace[] };
  const candidates: EmployerCandidate[] = (data.places ?? []).map(p => {
    const comp = (type: string, short = false) => p.addressComponents?.find(c => c.types?.includes(type))?.[short ? 'shortText' : 'longText'];
    const street = [comp('street_number'), comp('route')].filter(Boolean).join(' ');
    return {
      name: p.displayName?.text ?? query,
      phone: p.nationalPhoneNumber,
      address: street || p.formattedAddress?.split(',')[0],
      city: comp('locality') ?? comp('sublocality') ?? comp('administrative_area_level_3'),
      state: comp('administrative_area_level_1', true),
      zip: comp('postal_code'),
    };
  });
  return { candidates, sources: ['places'], verified: true, engine: 'places' };
}

// ---------------------------------------------------------------- Gemini
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    candidates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING }, phone: { type: Type.STRING }, address: { type: Type.STRING },
          city: { type: Type.STRING }, state: { type: Type.STRING }, zip: { type: Type.STRING }, note: { type: Type.STRING },
        },
        propertyOrdering: ['name', 'phone', 'address', 'city', 'state', 'zip', 'note'],
        required: ['name'],
      },
    },
  },
  propertyOrdering: ['candidates'],
  required: ['candidates'],
};

const ASK = (query: string, near: Near) => `A car dealership is completing a credit application and needs the workplace details for an applicant who says they work at "${query}". The applicant lives in ${nearLabel(near)}${near.zip ? ` ${near.zip}` : ''}.
Find the business locations with that name within roughly 60 miles of ${nearLabel(near)} (people commute across the Ohio / Kentucky / West Virginia lines). If none are that close, widen to 150 miles. Do NOT return a same-named business in another part of the country. If the company has one plant, hospital, office or store in the area, return that one; if it is a chain, return up to 4 locations, closest first.
For each: the name as listed, street address (no PO Box), city, 2-letter state, zip, and the main phone number for that location. Prefer the business's own site or its Google listing.
Answer with one block per location, exactly these lines:
Name: <name>
Phone: <number or unknown>
Street: <street or unknown>
City: <city>
State: <ST>
Zip: <zip or unknown>
Note: <one short line, e.g. "plant, not HQ" or "HQ phone, local line not listed", or none>`;

async function researchGrounded(query: string, near: Near, timeoutMs: number) {
  const res = await timed('employerLookup.research (grounded)', () => ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: ASK(query, near) }] }],
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

async function structure(prose: string, timeoutMs: number): Promise<{ candidates?: EmployerCandidate[] }> {
  const res = await timed('employerLookup.structure (schema)', () => ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Copy these business locations into the schema, in the same order. Leave a field empty when the text says unknown.\n\n${prose}` }] }],
    config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json', responseSchema, httpOptions: { timeout: timeoutMs } },
  }));
  try { return JSON.parse(res.text || '{}'); } catch { return {}; }
}

async function fastLookup(query: string, near: Near, timeoutMs: number): Promise<{ candidates?: EmployerCandidate[] }> {
  const res = await timed('employerLookup.fast (no search)', () => ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `${ASK(query, near)}\n\nYou have no web access: answer from memory and put "from memory, verify before use" in every Note.` }] }],
    config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json', responseSchema, httpOptions: { timeout: timeoutMs } },
  }));
  try { return JSON.parse(res.text || '{}'); } catch { return {}; }
}

function finish(parsed: { candidates?: EmployerCandidate[] }, sources: string[], verified: boolean): EmployerLookupResult {
  const candidates = (parsed.candidates ?? [])
    .map(c => ({ name: clean(c.name) ?? '', phone: clean(c.phone), address: clean(c.address), city: clean(c.city), state: clean(c.state)?.toUpperCase().slice(0, 2), zip: clean(c.zip), note: clean(c.note) }))
    .filter(c => c.name && (c.address || c.phone || c.city))
    .slice(0, 4);
  return { candidates, sources, verified, engine: 'gemini' };
}

async function searchGemini(query: string, near: Near): Promise<EmployerLookupResult> {
  const attempts: string[] = [];
  const note = (label: string, err: unknown) => { const s = summarizeGeminiError(err); attempts.push(`${label}: ${s}`); console.warn(`Employer lookup, ${label} failed: ${s}`, err); };
  for (let i = 0; i < 2; i++) {
    try {
      if (i > 0) await new Promise(r => setTimeout(r, 1500));
      const { prose, sources } = await researchGrounded(query, near, 40_000);
      if (!prose.trim()) throw new Error('empty grounded response');
      const result = finish(await structure(prose, 20_000), sources, true);
      if (!result.candidates.length) throw new Error('empty structured response');
      return result;
    } catch (err) {
      note('grounded', err);
      if (!isRetryableGeminiError(err) && !/empty/.test(String(err))) break;
    }
  }
  try {
    const result = finish(await fastLookup(query, near, 30_000), [], false);
    if (!result.candidates.length) throw new Error('empty fast response');
    return result;
  } catch (err) { note('fast', err); }
  throw new EmployerLookupError(attempts.join('; ') + '.');
}

/** Server-side entry: Places when configured (Gemini as its fallback), else Gemini. */
export async function lookupEmployerDirect(query: string, near: Near): Promise<EmployerLookupResult> {
  const q = query.trim();
  if (q.length < 2) throw new EmployerLookupError('type the employer name first');
  const key = placesKey();
  if (key) {
    try { return await searchPlaces(q, near, key); }
    catch (err) { console.warn('Places lookup failed, falling back to Gemini:', err); }
  }
  if (!process.env.GEMINI_API_KEY) throw new EmployerLookupError('GEMINI_API_KEY is not set');
  return searchGemini(q, near);
}

/** Browser entry: goes through the server route; falls back to a direct call when there is no server. */
export async function lookupEmployer(query: string, near: Near): Promise<EmployerLookupResult> {
  const q = query.trim();
  if (q.length < 2) throw new EmployerLookupError('type the employer name first');
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/lookup-employer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, near }) });
      if (res.ok) return (await res.json()) as EmployerLookupResult;
      const body = await res.json().catch(() => ({}));
      if (res.status !== 404) throw new EmployerLookupError(body.error || `server ${res.status}`);
    } catch (err) {
      if (err instanceof EmployerLookupError) throw err;
      console.warn('Employer lookup: server route unavailable, calling directly:', err);
    }
  }
  return lookupEmployerDirect(q, near);
}
