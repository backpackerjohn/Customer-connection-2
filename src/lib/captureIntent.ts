export type CaptureIntent = 'trade' | 'vehicle' | 'insurance' | 'license' | 'payoff' | 'other';

export const INTENT_FIELDS: Record<Exclude<CaptureIntent, 'other'>, readonly string[]> = {
  trade:     ['tradeYear', 'tradeMake', 'tradeModel', 'tradeTrim', 'tradeMileage', 'tradeVin', 'hasTradeIn'],
  vehicle:   ['vehicleStock', 'vehicleYear', 'vehicleMake', 'vehicleModel', 'vehicleVin', 'vehicleMiles'],
  insurance: ['insuranceCompany', 'agentName'],
  license:   ['firstName', 'middleInitial', 'lastName', 'dob', 'address', 'city', 'state', 'zip',
              'dlNumber', 'dlState', 'dlExpiration'],
  payoff:    ['stillOwe', 'lienholder', 'payoffAmount', 'monthlyPayment', 'monthsRemaining'],
};

export function filterByIntent(fields: Record<string, unknown>, intent: CaptureIntent) {
  if (intent === 'other') return fields;
  const allowed = new Set(INTENT_FIELDS[intent]);
  return Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.has(k)));
}

/**
 * What the model says a photo is. Extends the original three-value
 * documentType so a vehicle photo can be routed without a chip:
 * - trade_vehicle / new_vehicle: the dealer's words (or the photo) made it clear
 * - vehicle: a VIN/vehicle photo where nobody said which one it is (chat asks)
 * - window_sticker: a Monroney sticker, always the vehicle being bought
 */
export type DocumentType =
  | 'license' | 'insurance' | 'trade_vehicle' | 'new_vehicle' | 'vehicle' | 'window_sticker' | 'payoff' | 'other';

export const DOCUMENT_TYPES: readonly DocumentType[] =
  ['license', 'insurance', 'trade_vehicle', 'new_vehicle', 'vehicle', 'window_sticker', 'payoff', 'other'];

/** Maps a classified document onto a whitelist. `null` means "ambiguous, ask". */
export function intentFromDocumentType(docType: string | undefined): CaptureIntent | null {
  switch (docType) {
    case 'license': return 'license';
    case 'insurance': return 'insurance';
    case 'trade_vehicle': return 'trade';
    case 'new_vehicle':
    case 'window_sticker': return 'vehicle';
    case 'payoff': return 'payoff';
    case 'vehicle': return null;
    default: return 'other';
  }
}

export const INTENT_SECTION_LABEL: Record<Exclude<CaptureIntent, 'other'>, string> = {
  trade: 'Trade-in',
  vehicle: 'New Vehicle',
  insurance: 'Insurance',
  license: 'Customer Info',
  payoff: 'Trade-in · Payoff',
};

/**
 * The document tray's slots, in display order. The slot IS the tag: a photo
 * dropped in a slot is extracted under that slot's whitelist and nothing else.
 * `other` means "let the model classify it" (see intentFromDocumentType).
 */
export interface CaptureSlot {
  id: CaptureIntent;
  name: string;
  hint: string;
  /** Framing tip shown in the camera view. */
  frame: string;
}
export const CAPTURE_SLOTS: readonly CaptureSlot[] = [
  { id: 'license',   name: 'License',     hint: "Driver's license",          frame: 'Fill the frame with the license' },
  { id: 'insurance', name: 'Insurance',   hint: 'Insurance ID card',         frame: 'Whole card, flat, no glare' },
  { id: 'vehicle',   name: 'New Vehicle', hint: 'Window sticker, stock tag', frame: 'Sticker or stock tag, close up' },
  { id: 'trade',     name: 'Trade-in',    hint: 'VIN label, odometer',       frame: 'VIN label or odometer, close up' },
  { id: 'payoff',    name: 'Payoff',      hint: 'Lender letter or app',      frame: 'Whole page' },
  { id: 'other',     name: 'Other',       hint: "Anything else, we'll sort it", frame: '' },
];

/** Fields a vehicle photo can produce, under either section's names. Used to hold them while the chat asks. */
export const VEHICLE_PHOTO_FIELDS: readonly string[] = [...INTENT_FIELDS.vehicle, ...INTENT_FIELDS.trade];
