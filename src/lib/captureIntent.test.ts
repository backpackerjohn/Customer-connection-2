import { describe, it, expect } from 'vitest';
import { filterByIntent, INTENT_FIELDS, intentFromDocumentType, VEHICLE_PHOTO_FIELDS } from './captureIntent';

describe('filterByIntent', () => {
  it('insurance intent keeps only insurance fields and drops vehicleVin / lastName', () => {
    const raw = {
      insuranceCompany: 'State Farm',
      agentName: 'Jane Smith',
      vehicleVin: '1HGCM82633A004352',
      lastName: 'Johnson',
      tradeYear: '2019',
    };
    expect(filterByIntent(raw, 'insurance')).toEqual({
      insuranceCompany: 'State Farm',
      agentName: 'Jane Smith',
    });
  });

  it('trade intent drops vehicle* fields but keeps trade fields and hasTradeIn', () => {
    const raw = {
      tradeYear: '2018',
      tradeMake: 'Honda',
      tradeModel: 'Civic',
      tradeVin: '2HGFC2F59JH512345',
      hasTradeIn: true,
      vehicleYear: '2024',
      vehicleMake: 'Toyota',
      vehicleModel: 'Camry',
      vehicleVin: '4T1B11HK5KU123456',
    };
    expect(filterByIntent(raw, 'trade')).toEqual({
      tradeYear: '2018',
      tradeMake: 'Honda',
      tradeModel: 'Civic',
      tradeVin: '2HGFC2F59JH512345',
      hasTradeIn: true,
    });
  });

  it('license intent drops trade and vehicle fields', () => {
    const raw = {
      firstName: 'John',
      lastName: 'Doe',
      dlNumber: 'D1234567',
      tradeYear: '2018',
      vehicleStock: 'P1234',
      insuranceCompany: 'Geico',
    };
    expect(filterByIntent(raw, 'license')).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      dlNumber: 'D1234567',
    });
  });

  it('vehicle intent keeps only vehicle* fields', () => {
    const raw = {
      vehicleStock: 'N5678',
      vehicleYear: '2025',
      vehicleVin: '4T1B11HK5KU123456',
      tradeVin: '2HGFC2F59JH512345',
      firstName: 'John',
    };
    expect(filterByIntent(raw, 'vehicle')).toEqual({
      vehicleStock: 'N5678',
      vehicleYear: '2025',
      vehicleVin: '4T1B11HK5KU123456',
    });
  });

  it('other intent passes everything through untouched', () => {
    const raw = {
      firstName: 'John',
      vehicleVin: '4T1B11HK5KU123456',
      tradeYear: '2018',
      payoffAmount: '12000',
      anythingElse: 'kept',
    };
    expect(filterByIntent(raw, 'other')).toBe(raw);
  });

  it('empty input returns empty output for every scoped intent', () => {
    for (const intent of Object.keys(INTENT_FIELDS) as (keyof typeof INTENT_FIELDS)[]) {
      expect(filterByIntent({}, intent)).toEqual({});
    }
  });
});

describe('intentFromDocumentType', () => {
  it('maps clear document types onto whitelists', () => {
    expect(intentFromDocumentType('license')).toBe('license');
    expect(intentFromDocumentType('insurance')).toBe('insurance');
    expect(intentFromDocumentType('trade_vehicle')).toBe('trade');
    expect(intentFromDocumentType('new_vehicle')).toBe('vehicle');
    expect(intentFromDocumentType('window_sticker')).toBe('vehicle');
  });

  it('returns null for an ambiguous vehicle photo so the chat can ask', () => {
    expect(intentFromDocumentType('vehicle')).toBeNull();
  });

  it('falls back to other (passthrough) for unknown or missing types', () => {
    expect(intentFromDocumentType('other')).toBe('other');
    expect(intentFromDocumentType(undefined)).toBe('other');
    expect(intentFromDocumentType('receipt')).toBe('other');
  });

  it('VEHICLE_PHOTO_FIELDS covers both sections', () => {
    expect(VEHICLE_PHOTO_FIELDS).toContain('vehicleVin');
    expect(VEHICLE_PHOTO_FIELDS).toContain('tradeVin');
    expect(VEHICLE_PHOTO_FIELDS).toContain('hasTradeIn');
  });
});
