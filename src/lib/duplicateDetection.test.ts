import { describe, it, expect } from 'vitest';
import { 
  normalizePhone, 
  normalizeEmail, 
  normalizeName, 
  normalizeVin, 
  normalizeDl, 
  normalizeZip, 
  findDuplicates 
} from './duplicateDetection';
import { Customer } from '../types';

describe('Duplicate Detection Normalizers', () => {
  it('should normalize phone numbers to last 10 digits', () => {
    expect(normalizePhone('(212) 555-1234')).toBe('2125551234');
    expect(normalizePhone('212.555.1234')).toBe('2125551234');
    expect(normalizePhone('1-212-555-1234')).toBe('2125551234');
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
  });

  it('should normalize email to lowercase and trimmed', () => {
    expect(normalizeEmail('  John.Smith@gmail.com ')).toBe('john.smith@gmail.com');
    expect(normalizeEmail('')).toBe('');
  });

  it('should normalize name by trimming, collapsing spaces, and stripping suffixes', () => {
    expect(normalizeName('John Smith Jr.')).toBe('john smith');
    expect(normalizeName('John Smith Sr.')).toBe('john smith');
    expect(normalizeName('John Smith II')).toBe('john smith');
    expect(normalizeName('John Smith III')).toBe('john smith');
    expect(normalizeName('  John    Smith  ')).toBe('john smith');
  });

  it('should normalize VIN to uppercase and remove spaces', () => {
    expect(normalizeVin(' 1hgcr2f83ha000000 ')).toBe('1HGCR2F83HA000000');
  });

  it('should normalize DL and Zip codes', () => {
    expect(normalizeDl(' d1234567 ')).toBe('D1234567');
    expect(normalizeZip('90210-1234')).toBe('90210');
  });
});

describe('findDuplicates Match Logic', () => {
  const baseCandidate: Customer = {
    firstName: 'John',
    lastName: 'Smith',
    phone: '2125551234',
    email: 'john.smith@gmail.com',
    zip: '10001',
    city: 'New York',
    hasTradeIn: false,
    stillOwe: false,
    payingCash: false,
    status: 'lead'
  };

  it('should match phone strong: "(212) 555-1234" matches "212.555.1234"', () => {
    const row = { phone: '(212) 555-1234' };
    const candidates = [baseCandidate];
    const results = findDuplicates(row, candidates);
    expect(results.length).toBe(1);
    expect(results[0].level).toBe('strong');
    expect(results[0].reason).toContain('Phone');
  });

  it('should match email strong: "John.Smith@gmail.com" matches "john.smith@gmail.com"', () => {
    const row = { email: 'John.Smith@gmail.com' };
    const candidates = [baseCandidate];
    const results = findDuplicates(row, candidates);
    expect(results.length).toBe(1);
    expect(results[0].level).toBe('strong');
  });

  it('should detect household when phone matches but firstNames are "John" vs "Jane"', () => {
    const row = { firstName: 'Jane', lastName: 'Smith', phone: '2125551234' };
    const candidates = [baseCandidate];
    const results = findDuplicates(row, candidates);
    expect(results.length).toBe(1);
    expect(results[0].level).toBe('household');
    expect(results[0].reason).toContain('Household');
  });

  it('should detect weak match when "Maria Garcia + zip 90210" matches "Maria Garcia + zip 90210" with no phones', () => {
    const candidateMaria: Customer = {
      firstName: 'Maria',
      lastName: 'Garcia',
      zip: '90210',
      hasTradeIn: false,
      stillOwe: false,
      payingCash: false,
      status: 'lead'
    };
    const row = { firstName: 'Maria', lastName: 'Garcia', zip: '90210' };
    const results = findDuplicates(row, [candidateMaria]);
    expect(results.length).toBe(1);
    expect(results[0].level).toBe('weak');
  });

  it('should result in none when "Maria Garcia + zip 90210" matches "Maria Garcia + zip 90210" but candidate has a phone and row does not', () => {
    const candidateMariaWithPhone: Customer = {
      firstName: 'Maria',
      lastName: 'Garcia',
      zip: '90210',
      phone: '3105551234',
      hasTradeIn: false,
      stillOwe: false,
      payingCash: false,
      status: 'lead'
    };
    const row = { firstName: 'Maria', lastName: 'Garcia', zip: '90210' };
    const results = findDuplicates(row, [candidateMariaWithPhone]);
    expect(results.length).toBe(0); // none
  });

  it('should result in none for name alone', () => {
    const row = { firstName: 'John', lastName: 'Smith' };
    const results = findDuplicates(row, [baseCandidate]);
    expect(results.length).toBe(0);
  });

  it('should result in none for vehicle-interest alone', () => {
    const candidateWithVehicle: Customer = {
      ...baseCandidate,
      vehicleMake: 'Honda',
      vehicleModel: 'Civic'
    };
    const row = { vehicleMake: 'Honda', vehicleModel: 'Civic' };
    const results = findDuplicates(row, [candidateWithVehicle]);
    expect(results.length).toBe(0);
  });

  it('should result in none on name alone for suffix variations, but strong if phone also matches', () => {
    // Suffix variations alone (name alone) -> none
    const rowNameOnly = { firstName: 'John', lastName: 'Smith Jr.' };
    const candidates = [baseCandidate];
    expect(findDuplicates(rowNameOnly, candidates).length).toBe(0);

    // If phone matches as well -> strong
    const rowWithPhone = { firstName: 'John', lastName: 'Smith Jr.', phone: '2125551234' };
    const results = findDuplicates(rowWithPhone, candidates);
    expect(results.length).toBe(1);
    expect(results[0].level).toBe('strong');
  });
});
