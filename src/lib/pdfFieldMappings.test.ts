import { describe, it, expect } from 'vitest';
import { TEST_DRIVE_AGREEMENT_FIELDS, INTERVIEW_SHEET_FIELDS } from './pdfFieldMappings';
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
