import { describe, it, expect } from 'vitest';
import { DEALER_HOME, employerPatch, searchCenter } from './employers';

describe('employerPatch', () => {
  const e = { name: 'Kenworth', phone: '740-555-0100', address: '1 Kenworth Dr', city: 'Chillicothe', state: 'oh', zip: '45601' };
  it('fills the current job fields', () => {
    const p = employerPatch('current', e);
    expect(p.employer).toBe('Kenworth');
    expect(p.employerState).toBe('OH');
    expect(p.prevEmployer).toBeUndefined();
  });
  it('fills the previous job fields', () => {
    const p = employerPatch('previous', e);
    expect(p.prevEmployer).toBe('Kenworth');
    expect(p.prevEmployerZip).toBe('45601');
    expect(p.employer).toBeUndefined();
  });
});

describe('searchCenter', () => {
  it('centers on the home address, then the previous address, then the store', () => {
    expect(searchCenter({ city: 'Huntington', state: 'WV' })).toEqual({ city: 'Huntington', state: 'WV', zip: undefined });
    expect(searchCenter({ prevCity: 'Ashland', prevState: 'KY' })).toEqual({ city: 'Ashland', state: 'KY' });
    expect(searchCenter({})).toEqual(DEALER_HOME);
  });
});
