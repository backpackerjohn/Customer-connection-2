import { describe, it, expect } from 'vitest';
import { exactLender, lenderNameKey, matchLenders, snapshotDiffersFromLender, snapshotFromLender } from './lenders';
import { Lender } from '../types';

const L = (id: string, name: string, extra: Partial<Lender> = {}): Lender => ({ id, name, nameKey: lenderNameKey(name), verified: true, createdBy: 'u', ...extra });
const lib = [L('1', 'Ally Financial', { phone: '888', city: 'Charlotte' }), L('2', 'Capital One Auto Finance'), L('3', 'Toyota Financial Services'), L('4', 'Ohio Valley Bank')];

describe('lenderNameKey', () => {
  it('ignores case, punctuation and filler words', () => {
    expect(lenderNameKey('Ally Financial, Inc.')).toBe('ally financial');
    expect(lenderNameKey('THE Ohio Valley Bank Co')).toBe('ohio valley bank');
    expect(lenderNameKey('Wells Fargo Dealer Services N.A.')).toBe('wells fargo dealer services');
    expect(lenderNameKey('')).toBe('');
  });
});

describe('exactLender / matchLenders', () => {
  it('finds the exact record regardless of punctuation', () => {
    expect(exactLender(lib, 'ally financial inc')?.id).toBe('1');
    expect(exactLender(lib, 'Ally')).toBeNull();
  });
  it('ranks exact, then prefix, then contains, and caps the list', () => {
    expect(matchLenders(lib, 'ally').map(l => l.id)).toEqual(['1']);
    expect(matchLenders(lib, 'financial').map(l => l.id)).toEqual(['1', '3']);
    expect(matchLenders(lib, 'a')).toEqual([]);
    expect(matchLenders(lib, 'Capital One Auto Finance LLC')[0].id).toBe('2');
  });
});

describe('snapshot round trip', () => {
  it('copies only filled fields and detects drift', () => {
    const snap = snapshotFromLender(lib[0]);
    expect(snap).toEqual({ lenderId: '1', phone: '888', city: 'Charlotte' });
    expect(snapshotDiffersFromLender('Ally Financial', snap, lib[0])).toBe(false);
    expect(snapshotDiffersFromLender('Ally Financial', { ...snap, phone: '999' }, lib[0])).toBe(true);
    expect(snapshotDiffersFromLender('Ally Bank', snap, lib[0])).toBe(true);
  });
});
