import { describe, it, expect } from 'vitest';
import { renderTemplate, getDefaultModelYear } from './templateRenderer';
import { Customer, emptyCustomer } from '../types';

function makeCustomer(overrides: Partial<Customer>): Customer {
  return { ...emptyCustomer, ...overrides };
}

describe('renderTemplate', () => {
  const YEAR = '2026';

  it('returns empty string for empty template', () => {
    expect(renderTemplate('', makeCustomer({}), YEAR)).toBe('');
  });

  it('returns unchanged template when no placeholders present', () => {
    expect(renderTemplate('Hello there', makeCustomer({}), YEAR)).toBe('Hello there');
  });

  it('substitutes [name] with firstName', () => {
    expect(renderTemplate('Hey [name]', makeCustomer({ firstName: 'Bob' }), YEAR)).toBe('Hey Bob');
  });

  it('leaves [name] visible when firstName empty', () => {
    expect(renderTemplate('Hey [name]', makeCustomer({ firstName: '' }), YEAR)).toBe('Hey [name]');
  });

  it('substitutes [trade model] with tradeModel', () => {
    expect(renderTemplate('Your [trade model]', makeCustomer({ tradeModel: 'Elantra' }), YEAR))
      .toBe('Your Elantra');
  });

  it('leaves [trade model] visible when tradeModel missing', () => {
    expect(renderTemplate('Your [trade model]', makeCustomer({}), YEAR)).toBe('Your [trade model]');
  });

  it('substitutes [trade year] with tradeYear', () => {
    expect(renderTemplate('Your [trade year]', makeCustomer({ tradeYear: '2018' }), YEAR))
      .toBe('Your 2018');
  });

  it('leaves [trade year] visible when tradeYear missing', () => {
    expect(renderTemplate('Your [trade year]', makeCustomer({}), YEAR)).toBe('Your [trade year]');
  });

  it('substitutes [vehicle model] with vehicleModel when present', () => {
    expect(renderTemplate('New [vehicle model]', makeCustomer({ vehicleModel: 'Tucson', tradeModel: 'Elantra' }), YEAR))
      .toBe('New Tucson');
  });

  it('falls back [vehicle model] to tradeModel when vehicleModel missing', () => {
    expect(renderTemplate('New [vehicle model]', makeCustomer({ tradeModel: 'Elantra' }), YEAR))
      .toBe('New Elantra');
  });

  it('leaves [vehicle model] visible when both vehicleModel and tradeModel missing', () => {
    expect(renderTemplate('New [vehicle model]', makeCustomer({}), YEAR)).toBe('New [vehicle model]');
  });

  it('substitutes [vehicle year] with vehicleYear when stored', () => {
    expect(renderTemplate('New [vehicle year]', makeCustomer({ vehicleYear: '2025' }), YEAR))
      .toBe('New 2025');
  });

  it('falls back [vehicle year] to modelYear setting when vehicleYear missing', () => {
    expect(renderTemplate('New [vehicle year]', makeCustomer({}), YEAR)).toBe('New 2026');
  });

  it('substitutes [latest model year] with modelYear', () => {
    expect(renderTemplate('The [latest model year] are here', makeCustomer({}), YEAR))
      .toBe('The 2026 are here');
  });

  it('[latest model year] ignores stored vehicleYear', () => {
    expect(renderTemplate('[latest model year]', makeCustomer({ vehicleYear: '2099' }), YEAR))
      .toBe('2026');
  });

  it('matches placeholders case-insensitively', () => {
    const c = makeCustomer({ firstName: 'Bob' });
    expect(renderTemplate('[NAME]', c, YEAR)).toBe('Bob');
    expect(renderTemplate('[Name]', c, YEAR)).toBe('Bob');
    expect(renderTemplate('[name]', c, YEAR)).toBe('Bob');
  });

  it('tolerates extra whitespace inside placeholder brackets', () => {
    const c = makeCustomer({ tradeModel: 'Elantra' });
    expect(renderTemplate('[ trade model ]', c, YEAR)).toBe('Elantra');
    expect(renderTemplate('[Trade  Model]', c, YEAR)).toBe('Elantra');
  });

  it('leaves unknown placeholders as-is', () => {
    expect(renderTemplate('Some [unknown] tag', makeCustomer({}), YEAR)).toBe('Some [unknown] tag');
  });

  const FULL_TEMPLATE = 'Hey, [name], quick question about your [trade year] [trade model]. Asking because we have new [vehicle year] [vehicle model].';

  it('renders the Bob example (no vehicle of interest)', () => {
    const bob = makeCustomer({ firstName: 'Bob', tradeYear: '2018', tradeModel: 'Elantra' });
    expect(renderTemplate(FULL_TEMPLATE, bob, YEAR))
      .toBe('Hey, Bob, quick question about your 2018 Elantra. Asking because we have new 2026 Elantra.');
  });

  it('renders the Frank example (no vehicle of interest)', () => {
    const frank = makeCustomer({ firstName: 'Frank', tradeYear: '2020', tradeModel: 'Tucson' });
    expect(renderTemplate(FULL_TEMPLATE, frank, YEAR))
      .toBe('Hey, Frank, quick question about your 2020 Tucson. Asking because we have new 2026 Tucson.');
  });

  it('renders the Betty example (vehicle of interest stored)', () => {
    const betty = makeCustomer({ firstName: 'Betty', tradeYear: '2021', tradeModel: 'Palisade', vehicleModel: 'Elantra' });
    expect(renderTemplate(FULL_TEMPLATE, betty, YEAR))
      .toBe('Hey, Betty, quick question about your 2021 Palisade. Asking because we have new 2026 Elantra.');
  });

  it('renders the [Latest Model Year] arrival example', () => {
    const betty = makeCustomer({ firstName: 'Betty' });
    expect(renderTemplate('Hey [name] did you know that the [Latest Model Year] Elantras just arrived.', betty, YEAR))
      .toBe('Hey Betty did you know that the 2026 Elantras just arrived.');
  });
});

describe('getDefaultModelYear', () => {
  it('returns current year for months January through August', () => {
    for (let m = 0; m < 8; m++) {
      const d = new Date(2026, m, 15);
      expect(getDefaultModelYear(d)).toBe('2026');
    }
  });

  it('returns next year for months September through December', () => {
    for (let m = 8; m < 12; m++) {
      const d = new Date(2026, m, 15);
      expect(getDefaultModelYear(d)).toBe('2027');
    }
  });

  it('returns current year for May 2026 specifically', () => {
    expect(getDefaultModelYear(new Date(2026, 4, 22))).toBe('2026');
  });

  it('returns next year for October 2026 specifically', () => {
    expect(getDefaultModelYear(new Date(2026, 9, 1))).toBe('2027');
  });
});
