import { describe, it, expect } from 'vitest';
import {
  TEST_DRIVE_AGREEMENT_FIELDS,
  INTERVIEW_SHEET_FIELDS,
  DELIVERY_REPORT_FIELDS,
  DEAL_CHECKLIST_FIELDS,
  PRIVACY_POLICY_FIELDS,
  PAYOFF_FIELDS,
  THREE_LINER_FIELDS,
  BUYERS_GUIDE_FIELDS,
  TRADE_CHECK_IN_FIELDS,
} from './pdfFieldMappings';
import { Customer } from '../types';

const sample: Customer = {
  firstName: 'Sarah', middleInitial: 'M', lastName: 'Adams',
  status: 'lead', hasTradeIn: false, stillOwe: false, payingCash: false,
  address: '123 Main St', city: 'Cleveland', state: 'oh', zip: '44114',
  phone: '(555) 123-4567',
  dlNumber: 'AB1234567', dlState: 'oh', dlExpiration: '2027-08-22',
  vehicleStock: '6EL669', vehicleYear: '2026',
  vehicleMake: 'Hyundai', vehicleModel: 'Elantra N',
  vehicleVin: 'kmhlw4dk9tu041041', vehicleMiles: '0',
  insuranceCompany: 'Progressive', agentName: 'John Smith',
};

describe('TEST_DRIVE_AGREEMENT_FIELDS', () => {
  it('has 15 mappings', () => {
    expect(TEST_DRIVE_AGREEMENT_FIELDS).toHaveLength(15);
  });
  it('Name concatenates first + middle initial + last', () => {
    const m = TEST_DRIVE_AGREEMENT_FIELDS.find(x => x.pdfFieldName === 'Name')!;
    expect(m.getValue(sample)).toBe('Sarah M. Adams');
  });
  it('VIN uppercased', () => {
    const m = TEST_DRIVE_AGREEMENT_FIELDS.find(x => x.pdfFieldName === 'VIN')!;
    expect(m.getValue(sample)).toBe('KMHLW4DK9TU041041');
  });
  it('License State uppercased', () => {
    const m = TEST_DRIVE_AGREEMENT_FIELDS.find(x => x.pdfFieldName === 'License State [eg. OH]')!;
    expect(m.getValue(sample)).toBe('OH');
  });
  it('DL expiration ISO → MM/DD/YYYY', () => {
    const m = TEST_DRIVE_AGREEMENT_FIELDS.find(x => x.pdfFieldName === 'Drivers License Expiration Date')!;
    expect(m.getValue(sample)).toBe('08/22/2027');
  });
  it('City Zip concatenates', () => {
    const m = TEST_DRIVE_AGREEMENT_FIELDS.find(x => x.pdfFieldName === 'City Zip')!;
    expect(m.getValue(sample)).toBe('Cleveland, OH 44114');
  });
  it('Date Out is today MM/DD/YYYY', () => {
    const m = TEST_DRIVE_AGREEMENT_FIELDS.find(x => x.pdfFieldName === 'Date Out')!;
    expect(m.getValue(sample)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('INTERVIEW_SHEET_FIELDS', () => {
  it('has 17 text mappings', () => {
    expect(INTERVIEW_SHEET_FIELDS).toHaveLength(17);
  });
  it('c_state uppercased', () => {
    const m = INTERVIEW_SHEET_FIELDS.find(x => x.pdfFieldName === 'c_state')!;
    expect(m.getValue(sample)).toBe('OH');
  });
  it('tiv_vin uppercased', () => {
    const m = INTERVIEW_SHEET_FIELDS.find(x => x.pdfFieldName === 'tiv_vin')!;
    expect(m.getValue({ ...sample, tradeVin: 'abc123' })).toBe('ABC123');
  });
  it('How much formats as currency', () => {
    const m = INTERVIEW_SHEET_FIELDS.find(x => x.pdfFieldName === 'How much')!;
    expect(m.getValue({ ...sample, payoffAmount: '12500' })).toBe('$12,500');
  });
  it('does NOT include the misnamed `Do you owe a balance on your vehicle` text field', () => {
    expect(INTERVIEW_SHEET_FIELDS.find(
      x => x.pdfFieldName === 'Do you owe a balance on your vehicle'
    )).toBeUndefined();
  });
});

describe('DELIVERY_REPORT_FIELDS', () => {
  it('has 11 mappings', () => {
    expect(DELIVERY_REPORT_FIELDS).toHaveLength(11);
  });
  it('FirstName LastName concatenates first + middle initial + last', () => {
    const m = DELIVERY_REPORT_FIELDS.find(x => x.pdfFieldName === 'FirstName LastName')!;
    expect(m.getValue(sample)).toBe('Sarah M. Adams');
  });
  it('VIN uppercased', () => {
    const m = DELIVERY_REPORT_FIELDS.find(x => x.pdfFieldName === 'VIN')!;
    expect(m.getValue(sample)).toBe('KMHLW4DK9TU041041');
  });
  it('Deal_Date is today MM/DD/YYYY when purchaseDate is unset', () => {
    const m = DELIVERY_REPORT_FIELDS.find(x => x.pdfFieldName === 'Deal_Date')!;
    expect(m.getValue(sample)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
  it('Deal_Date uses purchaseDate when set (full ISO timestamp)', () => {
    const m = DELIVERY_REPORT_FIELDS.find(x => x.pdfFieldName === 'Deal_Date')!;
    expect(m.getValue({ ...sample, purchaseDate: '2026-03-15T14:22:09.000Z' })).toBe('03/15/2026');
  });
});

describe('DEAL_CHECKLIST_FIELDS', () => {
  it('has 5 mappings', () => {
    expect(DEAL_CHECKLIST_FIELDS).toHaveLength(5);
  });
  it('NEW Vehicle_VIN uppercased', () => {
    const m = DEAL_CHECKLIST_FIELDS.find(x => x.pdfFieldName === 'NEW Vehicle_VIN')!;
    expect(m.getValue(sample)).toBe('KMHLW4DK9TU041041');
  });
});

describe('PRIVACY_POLICY_FIELDS', () => {
  it('is intentionally empty (template not supplied / static legal text)', () => {
    expect(PRIVACY_POLICY_FIELDS).toEqual([]);
  });
});

describe('PAYOFF_FIELDS', () => {
  it('has 8 mappings (lender/bank info skipped — filled at closing)', () => {
    expect(PAYOFF_FIELDS).toHaveLength(8);
  });
  it('Lender_Name comes from customer.lienholder', () => {
    const m = PAYOFF_FIELDS.find(x => x.pdfFieldName === 'Lender_Name')!;
    expect(m.getValue({ ...sample, lienholder: 'Honda Financial' })).toBe('Honda Financial');
  });
  it('TODAYS PAYOFF formats as currency', () => {
    const m = PAYOFF_FIELDS.find(x => x.pdfFieldName === 'TODAYS PAYOFF')!;
    expect(m.getValue({ ...sample, payoffAmount: '18750' })).toBe('$18,750');
  });
  it('Trade-In Vehicle Year/Make/Model map to trade* fields', () => {
    const yr = PAYOFF_FIELDS.find(x => x.pdfFieldName === 'Trade-In Vehicle Year')!;
    const mk = PAYOFF_FIELDS.find(x => x.pdfFieldName === 'Trade-In Vehicle Make')!;
    const md = PAYOFF_FIELDS.find(x => x.pdfFieldName === 'Trade-In Vehicle Model')!;
    const withTrade = { ...sample, tradeYear: '2018', tradeMake: 'Honda', tradeModel: 'Civic' };
    expect(yr.getValue(withTrade)).toBe('2018');
    expect(mk.getValue(withTrade)).toBe('Honda');
    expect(md.getValue(withTrade)).toBe('Civic');
  });
});

describe('THREE_LINER_FIELDS', () => {
  it('has 9 mappings (Text* and c2_* skipped)', () => {
    expect(THREE_LINER_FIELDS).toHaveLength(9);
  });
  it('c_state uppercased', () => {
    const m = THREE_LINER_FIELDS.find(x => x.pdfFieldName === 'c_state')!;
    expect(m.getValue(sample)).toBe('OH');
  });
  it('c_birthday formats DOB ISO → MM/DD/YYYY', () => {
    const m = THREE_LINER_FIELDS.find(x => x.pdfFieldName === 'c_birthday')!;
    expect(m.getValue({ ...sample, dob: '1985-07-04' })).toBe('07/04/1985');
  });
  it('_today_ uses dealDate (today when purchaseDate unset)', () => {
    const m = THREE_LINER_FIELDS.find(x => x.pdfFieldName === '_today_')!;
    expect(m.getValue(sample)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

const tradeSample: Customer = {
  ...sample,
  hasTradeIn: true,
  tradeYear: '2021', tradeMake: 'Hyundai', tradeModel: 'Santa Fe', tradeTrim: 'SEL',
  tradeMileage: '41,250', tradeVin: '5nmS3dajxmh123456',
};
const get = (fields: typeof BUYERS_GUIDE_FIELDS, name: string, c: Customer) =>
  fields.find(x => x.pdfFieldName === name)!.getValue(c);

describe('BUYERS_GUIDE_FIELDS', () => {
  it('has 9 mappings (checkboxes handled in pdfService)', () => {
    expect(BUYERS_GUIDE_FIELDS).toHaveLength(9);
  });
  it('vehicle fields come from the trade, VIN uppercased, stock derived from the new car', () => {
    expect(get(BUYERS_GUIDE_FIELDS, 'tiv_yr', tradeSample)).toBe('2021');
    expect(get(BUYERS_GUIDE_FIELDS, 'tiv_make', tradeSample)).toBe('Hyundai');
    expect(get(BUYERS_GUIDE_FIELDS, 'tiv_vin', tradeSample)).toBe('5NMS3DAJXMH123456');
    expect(get(BUYERS_GUIDE_FIELDS, 'stock number', tradeSample)).toBe('6EL669A');
  });
  it('a dealer override wins for the stock number', () => {
    expect(get(BUYERS_GUIDE_FIELDS, 'stock number', { ...tradeSample, tradeStockNumber: '7PL11B' })).toBe('7PL11B');
  });
  it('warranty rows are 100 / 100 with the warranty text when a warranty applies', () => {
    // 2021 Hyundai, 41,250 miles: factory remainder (relative to the current year this may age out;
    // use a trade that is always inside the 3/3 window instead).
    const recent: Customer = { ...tradeSample, tradeMake: 'Toyota', tradeYear: String(new Date().getFullYear() - 1), tradeMileage: '12000' };
    expect(get(BUYERS_GUIDE_FIELDS, '% if Labor', recent)).toBe('100');
    expect(get(BUYERS_GUIDE_FIELDS, '% of Parts', recent)).toBe('100');
    expect(get(BUYERS_GUIDE_FIELDS, 'SYSTEMS COVERED 1', recent)).toBe('3 months or 3,000 miles');
    expect(get(BUYERS_GUIDE_FIELDS, 'DURATION 1', recent)).toBe('3 months or 3,000 miles');
  });
  it('As-Is leaves the warranty rows blank', () => {
    const old: Customer = { ...tradeSample, tradeYear: '2010', tradeMileage: '150000' };
    expect(get(BUYERS_GUIDE_FIELDS, '% if Labor', old)).toBe('');
    expect(get(BUYERS_GUIDE_FIELDS, 'SYSTEMS COVERED 1', old)).toBe('');
  });
});

describe('TRADE_CHECK_IN_FIELDS', () => {
  it('has 8 mappings (profile layer only in phase 1)', () => {
    expect(TRADE_CHECK_IN_FIELDS).toHaveLength(8);
  });
  it('fills the trade identity and the derived stock number', () => {
    expect(get(TRADE_CHECK_IN_FIELDS, 'tiv_stock_no', tradeSample)).toBe('6EL669A');
    expect(get(TRADE_CHECK_IN_FIELDS, 'tiv_trim', tradeSample)).toBe('SEL');
    expect(get(TRADE_CHECK_IN_FIELDS, 'tiv_mileage', tradeSample)).toBe('41,250');
    expect(get(TRADE_CHECK_IN_FIELDS, '_today_', tradeSample)).toMatch(/\d{4}$/);
  });
});
