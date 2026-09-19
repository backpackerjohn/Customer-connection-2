import { describe, it, expect } from 'vitest';
import { deriveTradeStockNumber, tradeStockNumberFor } from './tradeStockNumber';

describe('deriveTradeStockNumber', () => {
  it('appends A when the new stock ends in a digit', () => {
    expect(deriveTradeStockNumber('6EL917')).toBe('6EL917A');
  });
  it('steps the letter forward when the new stock already ends in one', () => {
    expect(deriveTradeStockNumber('7PL11A')).toBe('7PL11B');
    expect(deriveTradeStockNumber('7PL11B')).toBe('7PL11C');
    expect(deriveTradeStockNumber('7PL11Y')).toBe('7PL11Z');
  });
  it('starts a second letter after Z (assumption)', () => {
    expect(deriveTradeStockNumber('7PL11Z')).toBe('7PL11ZA');
  });
  it('normalizes case and whitespace', () => {
    expect(deriveTradeStockNumber('  6el917 ')).toBe('6EL917A');
    expect(deriveTradeStockNumber('7pl11a')).toBe('7PL11B');
  });
  it('returns empty for a missing new stock number', () => {
    expect(deriveTradeStockNumber('')).toBe('');
    expect(deriveTradeStockNumber(undefined)).toBe('');
  });
});

describe('tradeStockNumberFor', () => {
  it('derives from the new vehicle when there is no override', () => {
    expect(tradeStockNumberFor({ vehicleStock: '6EL917' })).toBe('6EL917A');
  });
  it('uses the dealer override when set', () => {
    expect(tradeStockNumberFor({ vehicleStock: '6EL917', tradeStockNumber: 'X100' })).toBe('X100');
  });
  it('treats a blank override as unset', () => {
    expect(tradeStockNumberFor({ vehicleStock: '6EL917', tradeStockNumber: '   ' })).toBe('6EL917A');
  });
});
