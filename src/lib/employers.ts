import { CreditApplicant } from '../types';

/**
 * Employer search helpers (pure): where to center a search and how a picked
 * location fills the current or the previous job on the credit application.
 */

export interface Near { city?: string; state?: string; zip?: string }

/** Last-resort search center when the applicant has no address on file. */
export const DEALER_HOME: Near = { city: 'Chillicothe', state: 'OH' };

export interface EmployerDetails { name: string; phone?: string; address?: string; city?: string; state?: string; zip?: string }

export type EmployerTarget = 'current' | 'previous';

/** The applicant fields a picked location fills, for the current or the previous job. */
export function employerPatch(target: EmployerTarget, e: EmployerDetails): Partial<CreditApplicant> {
  const clean = (v?: string) => (v ?? '').trim();
  return target === 'current'
    ? { employer: clean(e.name), employerPhone: clean(e.phone), employerAddress: clean(e.address), employerCity: clean(e.city), employerState: clean(e.state).toUpperCase(), employerZip: clean(e.zip) }
    : { prevEmployer: clean(e.name), prevEmployerPhone: clean(e.phone), prevEmployerAddress: clean(e.address), prevEmployerCity: clean(e.city), prevEmployerState: clean(e.state).toUpperCase(), prevEmployerZip: clean(e.zip) };
}

/** Where to center a search: the applicant's home first, then their previous address, then the store. */
export function searchCenter(a: Pick<CreditApplicant, 'city' | 'state' | 'zip' | 'prevCity' | 'prevState'>): Near {
  if (a.city?.trim()) return { city: a.city.trim(), state: a.state?.trim() || undefined, zip: a.zip?.trim() || undefined };
  if (a.prevCity?.trim()) return { city: a.prevCity.trim(), state: a.prevState?.trim() || undefined };
  return DEALER_HOME;
}
