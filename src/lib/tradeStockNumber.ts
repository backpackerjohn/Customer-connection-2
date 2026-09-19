import { Customer } from '../types';

/**
 * Trade-in stock number rule.
 *
 * The trade takes the NEW car's stock number plus a letter suffix that walks
 * the alphabet: a stock that ends in a digit gets "A"; one that already ends
 * in a letter (because that car was itself a trade) steps the letter forward.
 *
 *   6EL917  -> 6EL917A
 *   7PL11A  -> 7PL11B
 *
 * After Z we start a second letter ("7PL11Z" -> "7PL11ZA"). That case has not
 * come up at the store yet, so it is an assumption, isolated here.
 */
export function deriveTradeStockNumber(newVehicleStock: string | undefined | null): string {
  const stock = (newVehicleStock ?? '').trim().toUpperCase();
  if (!stock) return '';
  const last = stock[stock.length - 1];
  if (/[0-9]/.test(last)) return `${stock}A`;
  if (/[A-Y]/.test(last)) return stock.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
  if (last === 'Z') return `${stock}A`;
  return `${stock}A`;
}

/** The stock number to print: the dealer's override if set, otherwise derived from the new car. */
export function tradeStockNumberFor(customer: Pick<Customer, 'vehicleStock' | 'tradeStockNumber'>): string {
  const override = (customer.tradeStockNumber ?? '').trim();
  return override || deriveTradeStockNumber(customer.vehicleStock);
}
