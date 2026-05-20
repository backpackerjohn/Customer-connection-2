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

function dealDate(c: Customer): string {
  if (c.purchaseDate) {
    const datePart = c.purchaseDate.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return isoToMMDDYYYY(datePart);
  }
  return todayMMDDYYYY();
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

// Delivery Report — always included in the Sold packet.
// Skipped: "Check Box5" / "Check Box6" (generic checkbox names, meaning unknown — dealer fills by hand).
export const DELIVERY_REPORT_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: 'FirstName LastName', getValue: c => fullName(c) },
  { pdfFieldName: 'Vehicle_StockNumber', getValue: c => c.vehicleStock ?? '' },
  { pdfFieldName: 'Year', getValue: c => c.vehicleYear ?? '' },
  { pdfFieldName: 'Make', getValue: c => c.vehicleMake ?? '' },
  { pdfFieldName: 'Model', getValue: c => c.vehicleModel ?? '' },
  { pdfFieldName: 'VIN', getValue: c => (c.vehicleVin ?? '').toUpperCase() },
  { pdfFieldName: 'Deal_Date', getValue: c => dealDate(c) },
  { pdfFieldName: 'Phone', getValue: c => c.phone ?? '' },
  { pdfFieldName: 'Street Address', getValue: c => c.address ?? '' },
  { pdfFieldName: 'City', getValue: c => c.city ?? '' },
  { pdfFieldName: 'Zip Code', getValue: c => c.zip ?? '' },
];

// Deal Checklist — always included in the Sold packet.
export const DEAL_CHECKLIST_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: 'FirstName LastName', getValue: c => fullName(c) },
  { pdfFieldName: 'Vehicle_StockNumber', getValue: c => c.vehicleStock ?? '' },
  { pdfFieldName: 'Vehicle_Miles', getValue: c => c.vehicleMiles ?? '' },
  { pdfFieldName: 'Deal_Date', getValue: c => dealDate(c) },
  { pdfFieldName: 'NEW Vehicle_VIN', getValue: c => (c.vehicleVin ?? '').toUpperCase() },
];

// Privacy Policy — always included in the Sold packet. Template PDF was not
// supplied for field-name inspection; treat as static legal text for now.
// If the template has fillable AcroForm fields, enumerate them with pdf-lib
// (form.getFields()) and add entries here.
export const PRIVACY_POLICY_FIELDS: PdfFieldMapping[] = [];

// Payoff — included only when hasTradeIn && stillOwe.
// Skipped (no Customer field; dealer fills at closing with lender-provided data):
//   "Lender_PhoneNumber", "OVERNIGHT Lender_Address", "Lender_AccountNumber",
//   "Lender_PerDiemAmount", "20DAY_PAYOFF", "20DAY PAYOFF",
//   "Bank City", "Bank State", "Bank Zip".
export const PAYOFF_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: 'FirstName LastName', getValue: c => fullName(c) },
  { pdfFieldName: 'Vehicle_StockNumber', getValue: c => c.vehicleStock ?? '' },
  { pdfFieldName: 'DEAL DATE', getValue: c => dealDate(c) },
  { pdfFieldName: 'Trade-In Vehicle Year', getValue: c => c.tradeYear ?? '' },
  { pdfFieldName: 'Trade-In Vehicle Make', getValue: c => c.tradeMake ?? '' },
  { pdfFieldName: 'Trade-In Vehicle Model', getValue: c => c.tradeModel ?? '' },
  { pdfFieldName: 'Lender_Name', getValue: c => c.lienholder ?? '' },
  { pdfFieldName: 'TODAYS PAYOFF', getValue: c => moneyOrEmpty(c.payoffAmount) },
];

// 3-Liner — included only when payingCash.
// Skipped (generic Text* fields with unknown meaning, plus co-customer c2_*
// fields the app does not capture): Text8, Text15, c2_fullname, c2_lname,
// Text18, Text19, Text20, Text21, Text22, Text23, Text24.
export const THREE_LINER_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: 'c_fname', getValue: c => c.firstName ?? '' },
  { pdfFieldName: 'c_lname', getValue: c => c.lastName ?? '' },
  { pdfFieldName: 'c_birthday', getValue: c => isoToMMDDYYYY(c.dob) },
  { pdfFieldName: 'c_st_address', getValue: c => c.address ?? '' },
  { pdfFieldName: 'c_city', getValue: c => c.city ?? '' },
  { pdfFieldName: 'c_state', getValue: c => (c.state ?? '').toUpperCase() },
  { pdfFieldName: 'c_zipcode', getValue: c => c.zip ?? '' },
  { pdfFieldName: 'c_cell_phone', getValue: c => c.phone ?? '' },
  { pdfFieldName: '_today_', getValue: c => dealDate(c) },
];
