import { describe, it, expect } from 'vitest';
import { decideBuyersGuide, buyersGuideForCustomer, DEALER_WARRANTY_TEXT, HYUNDAI_REMAINDER_TEXT } from './buyersGuideRules';

const TODAY = new Date('2026-09-19T12:00:00');
const decide = (make: string, modelYear: number | string, mileage: number | string) =>
  decideBuyersGuide({ make, modelYear, mileage }, TODAY);

describe('decideBuyersGuide: As-Is triggers', () => {
  it('8 or more model years old is As-Is regardless of miles or make', () => {
    expect(decide('Toyota', 2018, 12_000).kind).toBe('as-is');
    expect(decide('Hyundai', 2018, 12_000).kind).toBe('as-is');
    expect(decide('Toyota', 2010, 50_000).kind).toBe('as-is');
  });
  it('80,000 miles or more is As-Is regardless of age or make', () => {
    expect(decide('Toyota', 2022, 80_000).kind).toBe('as-is');
    expect(decide('Toyota', 2022, 80_100).kind).toBe('as-is');
    expect(decide('Hyundai', 2024, 95_000).kind).toBe('as-is');
  });
  it('either trigger alone is enough', () => {
    // 4 years old but 80,100 miles
    expect(decide('Kia', 2022, 80_100).kind).toBe('as-is');
    // 50,000 miles but 8 years old
    expect(decide('Kia', 2018, 50_000).kind).toBe('as-is');
  });
  it('missing year or mileage cannot earn a warranty', () => {
    expect(decideBuyersGuide({ make: 'Toyota', modelYear: '', mileage: 20_000 }, TODAY).kind).toBe('as-is');
    expect(decideBuyersGuide({ make: 'Toyota', modelYear: 2023, mileage: '' }, TODAY).kind).toBe('as-is');
    expect(decideBuyersGuide({ make: 'Toyota', modelYear: 2023 }, TODAY).reason).toMatch(/mileage missing/);
  });
});

describe('decideBuyersGuide: dealer 3 months / 3,000 miles', () => {
  it('7 model years old with under 80,000 miles gets the 3/3 warranty', () => {
    const d = decide('Toyota', 2019, 79_999);
    expect(d.kind).toBe('warranty');
    expect(d.coverage).toBe('dealer-3-3');
    expect(d.text).toBe(DEALER_WARRANTY_TEXT);
  });
  it('a new-ish non-Hyundai gets the 3/3, not the factory remainder', () => {
    const d = decide('Honda', 2024, 10_000);
    expect(d.coverage).toBe('dealer-3-3');
  });
  it('Hyundai over 60,000 miles but under 80,000 drops to the 3/3', () => {
    expect(decide('Hyundai', 2024, 60_000).coverage).toBe('dealer-3-3');
    expect(decide('Hyundai', 2024, 75_000).coverage).toBe('dealer-3-3');
  });
  it('Hyundai 6 or 7 model years old drops to the 3/3', () => {
    expect(decide('Hyundai', 2020, 30_000).coverage).toBe('dealer-3-3');
    expect(decide('Hyundai', 2019, 30_000).coverage).toBe('dealer-3-3');
  });
});

describe('decideBuyersGuide: Hyundai factory remainder', () => {
  it('Hyundai 5 model years old or newer with under 60,000 miles gets the remainder', () => {
    const d = decide('Hyundai', 2021, 40_000);
    expect(d.kind).toBe('warranty');
    expect(d.coverage).toBe('hyundai-remainder');
    expect(d.text).toBe(HYUNDAI_REMAINDER_TEXT);
    expect(decide('HYUNDAI', 2025, 59_999).coverage).toBe('hyundai-remainder');
  });
  it('make matching is case-insensitive and tolerant of extra words', () => {
    expect(decide('hyundai motor', 2023, 5_000).coverage).toBe('hyundai-remainder');
  });
});

describe('buyersGuideForCustomer', () => {
  it('reads the trade fields off the customer and parses formatted mileage', () => {
    const d = buyersGuideForCustomer({ tradeMake: 'Hyundai', tradeYear: '2022', tradeMileage: '41,250 mi' }, TODAY);
    expect(d.coverage).toBe('hyundai-remainder');
  });
});
