import { Customer } from '../types';

/**
 * Buyers Guide warranty rules (store policy, confirmed 2026-09).
 *
 * Age is this calendar year minus the model year. "Still 7" gets a warranty;
 * 8 or more is As-Is. Miles at or above 80,000 is As-Is.
 *
 *   Any make    age >= 8 OR miles >= 80,000          -> As-Is
 *   Hyundai     age <= 5 AND miles < 60,000          -> Full, remainder of 5yr/60k factory warranty
 *   Any make    age <= 7 AND miles < 80,000          -> Full, 100% parts, 100% labor, 3 months or 3,000 miles
 *
 * Missing or unreadable year/mileage cannot qualify for a warranty, so it
 * falls to As-Is and says why, rather than printing a warranty by accident.
 */
export type BuyersGuideCoverage = 'dealer-3-3' | 'hyundai-remainder';

export interface BuyersGuideDecision {
  kind: 'as-is' | 'warranty';
  coverage?: BuyersGuideCoverage;
  /** Text that goes in the Systems Covered / Duration line. Empty for As-Is. */
  text: string;
  /** Human explanation for the profile card and the packet reply. */
  reason: string;
}

export const DEALER_WARRANTY_TEXT = '3 months or 3,000 miles';
export const HYUNDAI_REMAINDER_TEXT = 'Remainder of 5 year / 60,000 mile factory warranty';

export const AS_IS_AGE_YEARS = 8;      // age >= 8 is As-Is
export const AS_IS_MILES = 80_000;      // miles >= 80,000 is As-Is
export const HYUNDAI_MAX_AGE_YEARS = 5; // age <= 5 keeps the factory remainder
export const HYUNDAI_MAX_MILES = 60_000; // miles < 60,000 keeps the factory remainder

export function parseMiles(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const digits = v.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  const n = parseFloat(digits);
  return Number.isFinite(n) ? n : null;
}

export function parseModelYear(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const n = typeof v === 'number' ? v : parseInt(v.trim(), 10);
  return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null;
}

export function decideBuyersGuide(
  input: { make?: string; modelYear?: string | number; mileage?: string | number },
  today: Date = new Date()
): BuyersGuideDecision {
  const year = parseModelYear(input.modelYear);
  const miles = parseMiles(input.mileage);
  if (year === null || miles === null) {
    const missing = [year === null ? 'model year' : '', miles === null ? 'mileage' : ''].filter(Boolean).join(' and ');
    return { kind: 'as-is', text: '', reason: `As-Is: ${missing} missing, so the trade cannot qualify for a warranty.` };
  }

  const age = today.getFullYear() - year;
  if (age >= AS_IS_AGE_YEARS) {
    return { kind: 'as-is', text: '', reason: `As-Is: ${age} model years old (8 or more).` };
  }
  if (miles >= AS_IS_MILES) {
    return { kind: 'as-is', text: '', reason: `As-Is: ${miles.toLocaleString('en-US')} miles (80,000 or more).` };
  }

  const isHyundai = (input.make ?? '').trim().toLowerCase().includes('hyundai');
  if (isHyundai && age <= HYUNDAI_MAX_AGE_YEARS && miles < HYUNDAI_MAX_MILES) {
    return {
      kind: 'warranty',
      coverage: 'hyundai-remainder',
      text: HYUNDAI_REMAINDER_TEXT,
      reason: `Full warranty: Hyundai, ${age} model years old and ${miles.toLocaleString('en-US')} miles, still inside the 5 year / 60,000 mile factory warranty.`,
    };
  }
  return {
    kind: 'warranty',
    coverage: 'dealer-3-3',
    text: DEALER_WARRANTY_TEXT,
    reason: `Full warranty, 100% parts and labor, ${DEALER_WARRANTY_TEXT}: ${age} model years old and ${miles.toLocaleString('en-US')} miles.`,
  };
}

/** Convenience for the profile and PDF fill: decide from the customer's trade fields. */
export function buyersGuideForCustomer(
  customer: Pick<Customer, 'tradeMake' | 'tradeYear' | 'tradeMileage'>,
  today: Date = new Date()
): BuyersGuideDecision {
  return decideBuyersGuide({ make: customer.tradeMake, modelYear: customer.tradeYear, mileage: customer.tradeMileage }, today);
}
