import { Customer } from '../types';

export interface PdfFieldMapping {
  pdfFieldName: string;
  getValue: (customer: Customer) => string;
}

function fullName(c: Customer): string {
  const mi = c.middleInitial ? ` ${c.middleInitial}.` : '';
  return `${c.firstName}${mi} ${c.lastName}`.trim();
}

function todayMMDDYYYY(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

function isoToMMDDYYYY(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

export const TEST_DRIVE_AGREEMENT_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: 'Date Out', getValue: () => todayMMDDYYYY() },
  { pdfFieldName: 'Name', getValue: c => fullName(c) },
  { pdfFieldName: 'Street Address', getValue: c => c.address ?? '' },
  { pdfFieldName: 'City Zip', getValue: c => 
    [c.city, c.state ? `, ${c.state.toUpperCase()}` : '', c.zip ? ` ${c.zip}` : '']
      .join('').trim() },
  { pdfFieldName: 'New Vehicle Stock Number', getValue: c => c.vehicleStock ?? '' },
  { pdfFieldName: 'Year', getValue: c => c.vehicleYear ?? '' },
  { pdfFieldName: 'MakeModel', getValue: c => 
    [c.vehicleMake, c.vehicleModel].filter(Boolean).join(' ') },
  { pdfFieldName: 'VIN', getValue: c => (c.vehicleVin ?? '').toUpperCase() },
  { pdfFieldName: 'Odometer', getValue: c => c.vehicleMiles ?? '' },
  { pdfFieldName: 'Phone', getValue: c => c.phone ?? '' },
  { pdfFieldName: 'Drivers License', getValue: c => c.dlNumber ?? '' },
  { pdfFieldName: 'License State [eg. OH]', getValue: c => (c.dlState ?? '').toUpperCase() },
  { pdfFieldName: 'Drivers License Expiration Date', getValue: c => isoToMMDDYYYY(c.dlExpiration) },
  { pdfFieldName: 'Insurance Company', getValue: c => c.insuranceCompany ?? '' },
  { pdfFieldName: 'Insurance Agent', getValue: c => c.agentName ?? '' },
];

function moneyOrEmpty(v?: string): string {
  if (!v) return '';
  const num = parseFloat(v.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return v;
  return `$${num.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

// Interview Sheet — 17 mapped TEXT fields. Plus 3 separate handlers 
// for the trade-in checkbox pair and the undefined_2 radio (handled 
// in pdfService).
export const INTERVIEW_SHEET_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: 'c_fullname', getValue: c => fullName(c) },
  { pdfFieldName: 'c_st_address', getValue: c => c.address ?? '' },
  { pdfFieldName: 'c_city', getValue: c => c.city ?? '' },
  { pdfFieldName: 'c_state', getValue: c => (c.state ?? '').toUpperCase() },
  { pdfFieldName: 'c_zipcode', getValue: c => c.zip ?? '' },
  { pdfFieldName: 'c_email', getValue: c => c.email ?? '' },
  { pdfFieldName: 'c_eve_phone', getValue: c => c.phone ?? '' },
  { pdfFieldName: 'c_cell_phone', getValue: c => c.phone ?? '' },
  { pdfFieldName: 'tiv_yr', getValue: c => c.tradeYear ?? '' },
  { pdfFieldName: 'tiv_make', getValue: c => c.tradeMake ?? '' },
  { pdfFieldName: 'tiv_model', getValue: c => c.tradeModel ?? '' },
  { pdfFieldName: 'Trim', getValue: c => c.tradeTrim ?? '' },
  { pdfFieldName: 'tiv_vin', getValue: c => (c.tradeVin ?? '').toUpperCase() },
  { pdfFieldName: 'tiv_mileage', getValue: c => c.tradeMileage ?? '' },
  { pdfFieldName: 'How much', getValue: c => moneyOrEmpty(c.payoffAmount) },
  { pdfFieldName: 'Current Payments', getValue: c => moneyOrEmpty(c.monthlyPayment) },
  { pdfFieldName: 'What payment range are you looking for', getValue: c => moneyOrEmpty(c.goalsMonthlyPayment) },
];
