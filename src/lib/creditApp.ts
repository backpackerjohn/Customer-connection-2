import { CreditApp, CreditApplicant, Customer } from '../types';
import { isoToMMDDYYYY, moneyOrEmpty } from './pdfFieldMappings';

/**
 * Credit application (Hyundai Motor Finance template, credit-app.pdf).
 *
 * Only the applicant / joint applicant halves are filled. The dealer-use box
 * (vehicle, trade, pricing), the retail/lease boxes and the dealer name and
 * contact lines are left blank on purpose. The SSNs come in as a separate
 * argument at print time and are never stored on the customer.
 */

export type CreditType = NonNullable<CreditApp['creditType']>;
export const CREDIT_TYPES: { id: CreditType; label: string }[] = [
  { id: 'individual', label: 'Individual' },
  { id: 'joint-spousal', label: 'Joint · spousal' },
  { id: 'joint-non-spousal', label: 'Joint · non-spousal' },
  { id: 'rely-other-income', label: 'Individual, relying on other income' },
];

export type ResidentialStatus = NonNullable<CreditApplicant['residentialStatus']>;
export const RESIDENTIAL_STATUSES: { id: ResidentialStatus; label: string }[] = [
  { id: 'own', label: 'Own' },
  { id: 'rent', label: 'Rent' },
  { id: 'parents', label: 'Lives with parents' },
  { id: 'other', label: 'Other' },
];

/** Applicant identity fields live on the Customer, not in creditApp.applicant. */
export const IDENTITY_KEYS = ['firstName', 'middleInitial', 'lastName', 'dob', 'phone', 'email', 'address', 'city', 'state', 'zip'] as const;
export type IdentityKey = (typeof IDENTITY_KEYS)[number];

export interface CreditSsns {
  applicant?: string;
  coApplicant?: string;
}

/** The applicant as printed: identity from the profile, everything else from creditApp.applicant. */
export function applicantView(c: Customer): CreditApplicant {
  return {
    ...(c.creditApp?.applicant ?? {}),
    firstName: c.firstName, middleInitial: c.middleInitial, lastName: c.lastName, dob: c.dob,
    phone: c.phone, email: c.email, address: c.address, city: c.city, state: c.state, zip: c.zip,
  };
}

/** "(740) 555-1234" → ["740", "555", "1234"]. Anything that is not 10 digits goes whole into the line field. */
export function splitPhone(v?: string): [string, string, string] {
  let d = (v ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length === 10) return [d.slice(0, 3), d.slice(3, 6), d.slice(6)];
  const t = (v ?? '').trim();
  return ['', '', t];
}

const parseMoney = (v?: string): number | null => {
  const n = parseFloat((v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export interface CreditAppFill {
  text: Record<string, string>;
  checks: Record<string, boolean>;
}

/**
 * Every template field the app fills, by exact AcroForm name. Pure, so it is
 * testable without a PDF. Fields not present here are left untouched.
 */
export function creditAppFill(c: Customer, ssns: CreditSsns = {}): CreditAppFill {
  const app = c.creditApp ?? {};
  const text: Record<string, string> = {};
  const checks: Record<string, boolean> = {};
  const up = (v?: string) => (v ?? '').trim().toUpperCase();
  const str = (v?: string) => (v ?? '').trim();

  const person = (
    p: 'Primary' | 'Secondary',
    a: CreditApplicant,
    ssn: string | undefined,
    boxes: { own: string; rent: string; parents: string; other: string }
  ) => {
    text[`${p} Last Name`] = str(a.lastName);
    text[`${p} First Name`] = str(a.firstName);
    text[`${p} Middle Name`] = str(a.middleInitial);
    text[`${p} Birth Date`] = isoToMMDDYYYY(a.dob);
    text[`${p} Social Security Number`] = str(ssn);

    // Store practice: the "Home Phone Number" box on each side is the
    // applicant's mobile. The template's small "Primary Mobile" cell field on
    // the joint side is not used and stays blank.
    const [ac, prefix, line] = splitPhone(a.phone);
    text[`${p} Evening Home Area Code`] = ac; text[`${p} Evening Home Prefix`] = prefix; text[`${p} Evening Home Line Number`] = line;
    if (p === 'Primary') text['Primary Email'] = str(a.email);

    text[`${p} Current Address Line 1`] = str(a.address);
    text[`${p} Current City`] = str(a.city);
    text[`${p} Current State Abbreviation`] = up(a.state);
    text[`${p} Current Zip`] = str(a.zip);
    text[`${p} Time At Address Year`] = str(a.yearsAtAddress);
    text[`${p} Time At Address Month`] = str(a.monthsAtAddress);
    text[`${p} Current Mortgage or Rent Payment`] = moneyOrEmpty(a.housingPayment);
    checks[boxes.own] = a.residentialStatus === 'own';
    checks[boxes.rent] = a.residentialStatus === 'rent';
    checks[boxes.parents] = a.residentialStatus === 'parents';
    checks[boxes.other] = a.residentialStatus === 'other';

    text[`${p} Previous Address`] = str(a.prevAddress);
    text[`${p} Previous City`] = str(a.prevCity);
    text[`${p} Previous State`] = up(a.prevState);
    text[`${p} Previous Zip`] = str(a.prevZip);
    text[`${p} Previous Time Year`] = str(a.prevYears);
    text[`${p} Previous Time Month`] = str(a.prevMonths);

    text[`${p} Current Employer`] = str(a.employer);
    const [eac, epre, eline] = splitPhone(a.employerPhone);
    text[`${p} Current Employer Area Code`] = eac; text[`${p} Current Employer Prefix`] = epre; text[`${p} Current Employer Line Number`] = eline;
    text[`${p} Current Employment Occupation`] = str(a.jobTitle);
    text[`${p} Current Employment Employed Year`] = str(a.employedYears);
    text[`${p} Current Employment Employed Month`] = str(a.employedMonths);
    text[`${p} Current Employment Salary`] = moneyOrEmpty(a.grossMonthlySalary);
    text[`${p} Current Employer Address Line 1`] = str(a.employerAddress);
    text[`${p} Current Employer City`] = str(a.employerCity);
    text[`${p} Current Employer State`] = up(a.employerState);
    text[`${p} Current Employer Zip`] = str(a.employerZip);

    text[`${p} Previous Employer`] = str(a.prevEmployer);
    const [pac, ppre, pline] = splitPhone(a.prevEmployerPhone);
    text[`${p} Previous Employer Area Code`] = pac; text[`${p} Previous Employer Prefix`] = ppre; text[`${p} Previous Employer Line Number`] = pline;
    text[`${p} Previous Employer Address Line 1`] = str(a.prevEmployerAddress);
    text[`${p} Previous Employer City`] = str(a.prevEmployerCity);
    text[`${p} Previous Employer State`] = up(a.prevEmployerState);
    text[`${p} Previous Employer Zip`] = str(a.prevEmployerZip);
    text[`${p} Previous Employment Employed Year`] = str(a.prevEmployedYears);
    text[`${p} Previous Employment Employed Month`] = str(a.prevEmployedMonths);

    text[`${p} Current Employment Other Income Source`] = str(a.otherIncomeSource);
    text[`${p} Current Employment Other Income`] = moneyOrEmpty(a.otherIncomeMonthly);
  };

  const applicant = applicantView(c);
  person('Primary', applicant, ssns.applicant, { own: 'OwnHome', rent: 'Lease', parents: 'LiveRel', other: 'undefined' });
  const co = app.hasCoApplicant ? app.coApplicant : undefined;
  if (co) person('Secondary', co, ssns.coApplicant, { own: 'Own_2', rent: 'Rent_2', parents: 'Parents_2', other: 'undefined_4' });

  const incomes = [applicant.otherIncomeMonthly, co?.otherIncomeMonthly].map(parseMoney).filter((n): n is number => n !== null);
  text['Total Other Monthly Income'] = incomes.length ? moneyOrEmpty(String(incomes.reduce((a, b) => a + b, 0))) : '';

  const t = app.creditType;
  checks['Individually or'] = t === 'individual';
  checks['With another person'] = t === 'joint-spousal' || t === 'joint-non-spousal';
  checks['Spousal'] = t === 'joint-spousal';
  checks['Non Spousal'] = t === 'joint-non-spousal';
  checks['rely'] = t === 'rely-other-income';

  (app.references ?? []).slice(0, 4).forEach((r, i) => {
    const n = i + 1;
    text[`Primary Reference ${n} Name`] = str(r.name);
    text[`Primary Reference ${n} Address`] = str(r.address);
    text[`Primary Reference ${n} Phone`] = str(r.phone);
    checks[`A${n}`] = r.whose === 'A';
    checks[`B${n}`] = r.whose === 'B';
    checks[`J${n}`] = r.whose === 'J';
  });

  return { text, checks };
}

/** Sanity guard used by the sheet and the rules tests: an SSN must never be inside creditApp. */
export function creditAppHoldsSsn(app: CreditApp | undefined): boolean {
  const has = (o?: object) => !!o && Object.keys(o).some(k => /ssn|social/i.test(k));
  return has(app?.applicant) || has(app?.coApplicant);
}
