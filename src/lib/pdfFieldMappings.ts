import { Customer } from '../types';
import { tradeStockNumberFor } from './tradeStockNumber';
import { buyersGuideForCustomer } from './buyersGuideRules';

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

// Privacy Policy — always included in the Sold packet. The template exposes
// two AcroForm text fields at the bottom for the two "Customer Signature /
// Date" slots: Deal_Date (left) and Deal_Date_2 (right). Both fill with
// dealDate (purchaseDate-if-set-else-today, MM/DD/YYYY), matching how every
// other Sold-packet date field is filled.
export const PRIVACY_POLICY_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: 'Deal_Date', getValue: c => dealDate(c) },
  { pdfFieldName: 'Deal_Date_2', getValue: c => dealDate(c) },
];

// Payoff — included only when hasTradeIn && stillOwe.
// Bank half comes from customer.payoffLender (snapshot of the shared lender
// library, see lib/lenders.ts); deal half (account #, per diem, 20-day payoff)
// is typed on the Trade-in card every deal. The template has the 20-day payoff
// twice ("20DAY_PAYOFF" and "20DAY PAYOFF"); both get the same value.
export const PAYOFF_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: 'FirstName LastName', getValue: c => fullName(c) },
  { pdfFieldName: 'Vehicle_StockNumber', getValue: c => c.vehicleStock ?? '' },
  { pdfFieldName: 'DEAL DATE', getValue: c => dealDate(c) },
  { pdfFieldName: 'Trade-In Vehicle Year', getValue: c => c.tradeYear ?? '' },
  { pdfFieldName: 'Trade-In Vehicle Make', getValue: c => c.tradeMake ?? '' },
  { pdfFieldName: 'Trade-In Vehicle Model', getValue: c => c.tradeModel ?? '' },
  { pdfFieldName: 'Lender_Name', getValue: c => c.lienholder ?? '' },
  { pdfFieldName: 'TODAYS PAYOFF', getValue: c => moneyOrEmpty(c.payoffAmount) },
  { pdfFieldName: 'Lender_PhoneNumber', getValue: c => c.payoffLender?.phone ?? '' },
  { pdfFieldName: 'OVERNIGHT Lender_Address', getValue: c => c.payoffLender?.address ?? '' },
  { pdfFieldName: 'Bank City', getValue: c => c.payoffLender?.city ?? '' },
  { pdfFieldName: 'Bank State', getValue: c => (c.payoffLender?.state ?? '').toUpperCase() },
  { pdfFieldName: 'Bank Zip', getValue: c => c.payoffLender?.zip ?? '' },
  { pdfFieldName: 'Lender_AccountNumber', getValue: c => c.payoffAccountNumber ?? '' },
  { pdfFieldName: 'Lender_PerDiemAmount', getValue: c => moneyOrEmpty(c.payoffPerDiem) },
  { pdfFieldName: '20DAY_PAYOFF', getValue: c => moneyOrEmpty(c.payoff20Day) },
  { pdfFieldName: '20DAY PAYOFF', getValue: c => moneyOrEmpty(c.payoff20Day) },
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

// ---------------------------------------------------------------------------
// Trade packet: Buyers Guide + Trade Check-In Sheet (see pdfService.buildTradePacket)
// ---------------------------------------------------------------------------

function todayLongDate(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Buyers Guide — TEXT fields only. The As-Is / Warranty / Full checkboxes are
// driven by buyersGuideForCustomer() inside pdfService.fillBuyersGuide.
// Dealer name/address are baked into the template and are not mapped.
// Rules: SYSTEMS COVERED 1 and DURATION 1 both carry the warranty text
// ("3 months or 3,000 miles" or the Hyundai remainder); percentages are
// 100 / 100 whenever a warranty applies; Service Contract and
// "See For Complaints" always stay blank.
export const BUYERS_GUIDE_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: 'tiv_yr', getValue: c => c.tradeYear ?? '' },
  { pdfFieldName: 'tiv_make', getValue: c => c.tradeMake ?? '' },
  { pdfFieldName: 'tiv_model', getValue: c => c.tradeModel ?? '' },
  { pdfFieldName: 'tiv_vin', getValue: c => (c.tradeVin ?? '').toUpperCase() },
  { pdfFieldName: 'stock number', getValue: c => tradeStockNumberFor(c) },
  { pdfFieldName: '% if Labor', getValue: c => (buyersGuideForCustomer(c).kind === 'warranty' ? '100' : '') },
  { pdfFieldName: '% of Parts', getValue: c => (buyersGuideForCustomer(c).kind === 'warranty' ? '100' : '') },
  { pdfFieldName: 'SYSTEMS COVERED 1', getValue: c => buyersGuideForCustomer(c).text },
  { pdfFieldName: 'DURATION 1', getValue: c => buyersGuideForCustomer(c).text },
];

// Trade Check-In Sheet — phase 1 fills the profile layer only (identity of the
// trade). Engine / drivetrain / equipment boxes come in later phases.
export const TRADE_CHECK_IN_FIELDS: PdfFieldMapping[] = [
  { pdfFieldName: '_today_', getValue: () => todayLongDate() },
  { pdfFieldName: 'tiv_stock_no', getValue: c => tradeStockNumberFor(c) },
  { pdfFieldName: 'tiv_vin', getValue: c => (c.tradeVin ?? '').toUpperCase() },
  { pdfFieldName: 'tiv_yr', getValue: c => c.tradeYear ?? '' },
  { pdfFieldName: 'tiv_make', getValue: c => c.tradeMake ?? '' },
  { pdfFieldName: 'tiv_model', getValue: c => c.tradeModel ?? '' },
  { pdfFieldName: 'tiv_trim', getValue: c => c.tradeTrim ?? '' },
  { pdfFieldName: 'tiv_mileage', getValue: c => c.tradeMileage ?? '' },
  { pdfFieldName: 'tiv_engine', getValue: c => c.tradeCheckIn?.engine ?? '' },
  { pdfFieldName: 'CYL', getValue: c => c.tradeCheckIn?.cylinders ?? '' },
  { pdfFieldName: 'Transmission Speeds', getValue: c => c.tradeCheckIn?.transmissionSpeeds ?? '' },
  { pdfFieldName: 'tiv_ext_color', getValue: c => c.tradeCheckIn?.extColor ?? '' },
  { pdfFieldName: 'tiv_int_color', getValue: c => c.tradeCheckIn?.intColor ?? '' },
  { pdfFieldName: 'Premium Audio Brand', getValue: c => c.tradeCheckIn?.premiumAudioBrand ?? '' },
  { pdfFieldName: 'Other Smartphone App Name', getValue: c => c.tradeCheckIn?.smartphoneAppName ?? '' },
];
