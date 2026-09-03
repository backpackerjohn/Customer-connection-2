export type CaptureIntent = 'trade' | 'vehicle' | 'insurance' | 'license' | 'other';

export const INTENT_FIELDS: Record<Exclude<CaptureIntent, 'other'>, readonly string[]> = {
  trade:     ['tradeYear', 'tradeMake', 'tradeModel', 'tradeTrim', 'tradeMileage', 'tradeVin', 'hasTradeIn'],
  vehicle:   ['vehicleStock', 'vehicleYear', 'vehicleMake', 'vehicleModel', 'vehicleVin', 'vehicleMiles'],
  insurance: ['insuranceCompany', 'agentName'],
  license:   ['firstName', 'middleInitial', 'lastName', 'dob', 'address', 'city', 'state', 'zip',
              'dlNumber', 'dlState', 'dlExpiration'],
};

export function filterByIntent(fields: Record<string, unknown>, intent: CaptureIntent) {
  if (intent === 'other') return fields;
  const allowed = new Set(INTENT_FIELDS[intent]);
  return Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.has(k)));
}
