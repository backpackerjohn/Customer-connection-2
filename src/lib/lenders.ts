import { Lender, PayoffLender } from '../types';

/**
 * Lender library helpers (pure). The library is the shared `lenders`
 * collection; these functions match a typed lienholder name against it and
 * move details between a library record and the customer's payoff snapshot.
 */

/** Words that do not help tell banks apart. "bank", "credit union", "financial" are kept: they do. */
const STOP_WORDS = new Set(['the', 'inc', 'llc', 'na', 'corp', 'corporation', 'co', 'company', 'of']);

/** Normalized matching key: lower case, letters and digits only, filler words dropped. */
export function lenderNameKey(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w && !STOP_WORDS.has(w))
    .join(' ');
}

/** The saved lender whose key equals the typed name's key, or null. */
export function exactLender(lenders: readonly Lender[], typedName: string): Lender | null {
  const key = lenderNameKey(typedName);
  if (!key) return null;
  return lenders.find(l => l.nameKey === key) ?? null;
}

/**
 * Saved lenders that plausibly match what the dealer is typing, best first:
 * exact key, then key prefix, then contains (either direction). At most `limit`.
 */
export function matchLenders(lenders: readonly Lender[], typedName: string, limit = 6): Lender[] {
  const key = lenderNameKey(typedName);
  if (key.length < 2) return [];
  const rank = (l: Lender): number => {
    if (l.nameKey === key) return 0;
    if (l.nameKey.startsWith(key)) return 1;
    if (key.startsWith(l.nameKey) && l.nameKey.length >= 3) return 2;
    if (l.nameKey.includes(key) || key.includes(l.nameKey)) return 3;
    return -1;
  };
  return lenders
    .map(l => ({ l, r: rank(l) }))
    .filter(x => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.l.name.localeCompare(b.l.name))
    .slice(0, limit)
    .map(x => x.l);
}

const clean = (v?: string) => { const t = (v ?? '').trim(); return t ? t : undefined; };

/** Customer snapshot from a library record. Undefined values are dropped so Firestore never sees them. */
export function snapshotFromLender(l: Lender): PayoffLender {
  const snap: PayoffLender = { lenderId: l.id, phone: clean(l.phone), address: clean(l.address), city: clean(l.city), state: clean(l.state), zip: clean(l.zip) };
  return stripUndefined(snap);
}

/** The library fields from a customer snapshot plus the typed name. */
export function lenderFromSnapshot(name: string, snap: PayoffLender | undefined, createdBy: string, extra: { sources?: string; verified: boolean }): Omit<Lender, 'id' | 'createdAt' | 'updatedAt'> {
  return stripUndefined({
    name: name.trim(),
    nameKey: lenderNameKey(name),
    phone: clean(snap?.phone), address: clean(snap?.address), city: clean(snap?.city), state: clean(snap?.state)?.toUpperCase(), zip: clean(snap?.zip),
    sources: clean(extra.sources),
    verified: extra.verified,
    createdBy,
  });
}

/** True when the customer's snapshot or typed name differs from the saved record it points to. */
export function snapshotDiffersFromLender(name: string, snap: PayoffLender | undefined, l: Lender): boolean {
  const fields: (keyof PayoffLender & keyof Lender)[] = ['phone', 'address', 'city', 'state', 'zip'];
  if (lenderNameKey(name) !== l.nameKey) return true;
  return fields.some(f => (clean(snap?.[f]) ?? '') !== (clean(l[f]) ?? ''));
}

export function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
