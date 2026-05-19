import { Customer } from '../types';

export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

export function normalizeEmail(email: string | undefined | null): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function normalizeName(name: string | undefined | null): string {
  if (!name) return '';
  let n = name.trim().toLowerCase();
  n = n.replace(/\b(jr|sr|ii|iii)\b\.?/gi, '');
  return n.trim().replace(/\s+/g, ' ');
}

export function normalizeVin(vin: string | undefined | null): string {
  if (!vin) return '';
  return vin.replace(/\s+/g, '').toUpperCase();
}

export function normalizeDl(dl: string | undefined | null): string {
  if (!dl) return '';
  return dl.replace(/\s+/g, '').toUpperCase();
}

export function normalizeZip(zip: string | undefined | null): string {
  if (!zip) return '';
  const digits = zip.replace(/\D/g, '');
  return digits.slice(0, 5);
}

export type MatchLevel = 'strong' | 'household' | 'weak' | 'none';

export interface DuplicateMatch {
  existing: Customer;
  level: MatchLevel;
  reason: string;
}

function hasAnyAnchor(c: Partial<Customer>): boolean {
  const phone = normalizePhone(c.phone);
  const email = normalizeEmail(c.email);
  const dl = normalizeDl(c.dlNumber);
  const tradeVin = normalizeVin(c.tradeVin);
  return phone.length >= 10 || email !== '' || dl !== '' || tradeVin !== '';
}

export function findDuplicates(row: Partial<Customer>, candidates: Customer[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  const rPhone = normalizePhone(row.phone);
  const rEmail = normalizeEmail(row.email);
  const rDlNum = normalizeDl(row.dlNumber);
  const rDlState = (row.dlState || '').trim().toUpperCase();
  const rTradeVin = normalizeVin(row.tradeVin);
  const rDob = (row.dob || '').trim();
  const rLastName = normalizeName(row.lastName);
  const rFirstName = normalizeName(row.firstName);
  const rZip = normalizeZip(row.zip);
  const rCity = normalizeName(row.city);

  const rHasPhone = rPhone.length >= 10;
  const rHasEmail = rEmail !== '';
  const rHasDl = rDlNum !== '' && rDlState !== '';
  const rHasTradeVin = rTradeVin !== '';
  const rHasDob = rDob !== '';

  for (const cand of candidates) {
    // 1. STRONG MATCH CHECKS
    const cPhone = normalizePhone(cand.phone);
    const cEmail = normalizeEmail(cand.email);
    const cDlNum = normalizeDl(cand.dlNumber);
    const cDlState = (cand.dlState || '').trim().toUpperCase();
    const cTradeVin = normalizeVin(cand.tradeVin);
    const cDob = (cand.dob || '').trim();
    const cLastName = normalizeName(cand.lastName);
    const cFirstName = normalizeName(cand.firstName);
    const cZip = normalizeZip(cand.zip);
    const cCity = normalizeName(cand.city);

    const cHasPhone = cPhone.length >= 10;
    const cHasEmail = cEmail !== '';
    const cHasDl = cDlNum !== '' && cDlState !== '';
    const cHasTradeVin = cTradeVin !== '';
    const cHasDob = cDob !== '';

    // Check Phone Match
    if (rHasPhone && cHasPhone && rPhone === cPhone) {
      // Check if it should actually be Household
      const rFirst = rFirstName;
      const cFirst = cFirstName;
      if (rFirst !== '' && cFirst !== '' && rFirst !== cFirst) {
        matches.push({
          existing: cand,
          level: 'household',
          reason: `Household — same phone as ${cand.firstName} ${cand.lastName}`
        });
        continue;
      } else {
        matches.push({
          existing: cand,
          level: 'strong',
          reason: 'Phone number matches'
        });
        continue;
      }
    }

    // Check Email Match
    if (rHasEmail && cHasEmail && rEmail === cEmail) {
      matches.push({
        existing: cand,
        level: 'strong',
        reason: 'Email matches'
      });
      continue;
    }

    // Check DL Match (both dlNumber and dlState must match)
    if (rHasDl && cHasDl && rDlNum === cDlNum && rDlState === cDlState) {
      matches.push({
        existing: cand,
        level: 'strong',
        reason: 'Driver\'s license number and state match'
      });
      continue;
    }

    // Check Trade VIN Match
    if (rHasTradeVin && cHasTradeVin && rTradeVin === cTradeVin) {
      matches.push({
        existing: cand,
        level: 'strong',
        reason: 'Trade-in VIN matches'
      });
      continue;
    }

    // Check DOB + LastName Match
    if (rHasDob && cHasDob && rDob === cDob && rLastName !== '' && rLastName === cLastName) {
      matches.push({
        existing: cand,
        level: 'strong',
        reason: 'Date of birth and last name match'
      });
      continue;
    }

    // 2. WEAK MATCH CHECKS
    const neitherHasStrongAnchor = !hasAnyAnchor(row) && !hasAnyAnchor(cand);
    if (neitherHasStrongAnchor) {
      const nameMatches = rFirstName !== '' && rFirstName === cFirstName && rLastName !== '' && rLastName === cLastName;
      if (nameMatches) {
        const zipMatches = rZip !== '' && rZip === cZip;
        const cityMatches = rCity !== '' && rCity === cCity;
        if (zipMatches || cityMatches) {
          matches.push({
            existing: cand,
            level: 'weak',
            reason: `Possible match: ${cand.firstName} ${cand.lastName}`
          });
          continue;
        }
      }
    }
  }

  return matches;
}
