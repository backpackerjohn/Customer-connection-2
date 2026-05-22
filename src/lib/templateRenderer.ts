import { Customer } from '../types';

const PLACEHOLDER_REGEX = /\[([^\]]+)\]/g;

function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Substitutes [placeholder] tokens in `template` with values from `customer`.
 * Falls back to `modelYear` for [vehicle year] when customer has none, and
 * always uses `modelYear` for [latest model year]. Missing data leaves the
 * literal placeholder visible (e.g. "[trade model]") so the dealer sees
 * which customers don't fit the template.
 *
 * Matching is case-insensitive, internal whitespace is collapsed:
 * [Name], [ name ], [NAME], and [N A M E] all match.
 */
export function renderTemplate(template: string, customer: Customer, modelYear: string): string {
  return template.replace(PLACEHOLDER_REGEX, (match, rawName) => {
    const name = normalizeName(rawName);
    switch (name) {
      case 'name':
        return customer.firstName || match;
      case 'trade model':
        return customer.tradeModel || match;
      case 'trade year':
        return customer.tradeYear || match;
      case 'vehicle model':
        return customer.vehicleModel || customer.tradeModel || match;
      case 'vehicle year':
        return customer.vehicleYear || modelYear;
      case 'latest model year':
        return modelYear;
      default:
        return match;
    }
  });
}

/**
 * Auto-suggested default model year. Jan–Aug returns calendar year;
 * Sep–Dec returns calendar year + 1 (when most dealerships have started
 * pushing next-year inventory). Dealer can override at any time; this is
 * only used as the initial value when localStorage is empty.
 */
export function getDefaultModelYear(today: Date = new Date()): string {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return month <= 8 ? String(year) : String(year + 1);
}
