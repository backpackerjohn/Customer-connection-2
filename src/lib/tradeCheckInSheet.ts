/**
 * The Trade Check-In Sheet's checkboxes, by the EXACT AcroForm field names in
 * trade-check-in.pdf. The customer record stores ticked boxes as a list of
 * these names (customer.tradeCheckIn.equipment), and pdfService ticks a box
 * iff its name is in that list. Rename a box here only if the template changes.
 *
 * Three kinds of box:
 * - VIN facts: decoded deterministically from the VIN (lib/vinDecodeMap.ts).
 * - Equipment: standard-vs-optional for the trim, from the grounded lookup
 *   (services/tradeEquipmentService.ts), confirmed by the dealer on the card.
 * - Hand-filled: Detail, UCI, Salvage. Never touched by the app; signed in person.
 */

export interface SheetGroup {
  id: string;
  label: string;
  /** Exclusive groups tick at most one box (drivetrain, doors, fuel...). */
  exclusive?: boolean;
  /** Show only for pickups (cab, bed, liner...). */
  truckOnly?: boolean;
  boxes: readonly string[];
}

export const VIN_FACT_GROUPS: readonly SheetGroup[] = [
  { id: 'drive', label: 'Drivetrain', exclusive: true, boxes: ['FWD', 'RWD', 'AWD', '4x2', '4x4'] },
  { id: 'doors', label: 'Doors', exclusive: true, boxes: ['2 Doors', '3 Doors', '4 Doors', '5 Doors', '6 Doors'] },
  { id: 'fuel', label: 'Fuel', exclusive: true, boxes: ['Gas', 'Diesel'] },
  { id: 'transmission', label: 'Transmission', exclusive: true, boxes: ['Automatic Transmission', 'Manual Transmission'] },
  { id: 'cab', label: 'Cab', exclusive: true, truckOnly: true, boxes: ['Cabin - Regular', 'Cabin - Extended', 'Cabin - Quad', 'Cabin - Crew'] },
  { id: 'bed', label: 'Bed', exclusive: true, truckOnly: true, boxes: ['Bed - Long', 'Bed - Short'] },
  { id: 'body', label: 'Body', boxes: ['Convertible', 'Hard Top', 'Soft Top'] },
];

export const EQUIPMENT_GROUPS: readonly SheetGroup[] = [
  { id: 'seats', label: 'Seating', boxes: ['Cloth', 'Leather', 'Heated Front Seats', 'Heated Back Seats', 'Cooled Front Seats', 'Cooled Back Seats', 'Power Seats - Driver', 'Power Seats - Passenger', 'Third Row Seating', 'Stow-N-Go Seats'] },
  { id: 'audio', label: 'Audio & connectivity', boxes: ['CD Player', 'XM / Sirius Satellite Radio', 'Premium Audio', 'Entertainment / DVD', 'Touchscreen Control Center', 'iPod / USB Port', 'Auxiliary Port', 'Bluetooth', 'Voice Recognition', 'Apple Carplay', 'AndroidAuto', 'Smartphone App Integration', 'KiaConnect', 'uConnect', 'Bluelink', 'Other Smartphone App', 'GPS / Navigation', 'WiFi Hotspot'] },
  { id: 'safety', label: 'Driver assistance', boxes: ['Back-Up Camera', '360 Degree Camera', 'Lane Keep Assist', 'Blind Spot Monitor', 'Adaptive Cruise Control', 'Cruise Control', 'Collision Avoidance System', 'Active Parking Assist', 'Rear Parking Sensors', 'Heads-Up Display', 'Drowsiness Alert System', 'ABS', 'Anti-Theft System', 'Down Hill Braking Control'] },
  { id: 'comfort', label: 'Comfort & convenience', boxes: ['AC', 'Climate Control', 'Rear Temperature Control', 'Remote Start', 'Remote Keyless Entry', 'Power Locks', 'Power Windows', 'Power Mirrors', 'Power Pedals', 'Power Liftgate', 'Power Sliding Doors', 'Power Sliding Doors - Driver', 'Power Sliding Doors - Passenger', 'Heated Steering Wheel', 'Heated Mirrors', 'Heated Front Window', 'Auto Dim Mirror', 'Automatic Headlights', 'Rear Window', 'Rear Window Defrost', 'Rear Window Wiper'] },
  { id: 'exterior', label: 'Exterior', boxes: ['Sunroof / Moonroof', 'Panoramic Sunroof', 'Fog Lights', 'Spoiler', 'Luggage / Roof Rack', 'Running Boards / Side Step', 'Tow Package', 'Tow Hitch', 'Alloy Wheels', 'Chrome Wheels', 'Steel Wheels', 'Oversized Wheels', 'Lifted Vehicle'] },
  { id: 'truck', label: 'Truck', truckOnly: true, boxes: ['Liner - Plastic', 'Liner - Spray On', 'Tonneau Cover', 'Rear Sliding Window', 'Rear Sliding Window - Manual', 'Rear Sliding Window - Power'] },
];

/** Boxes the app never touches. Kept here so nothing accidentally maps to them. */
export const HAND_FILLED_BOXES: readonly string[] = [
  'Detail - Complete', 'Detail - W/S', 'Detail - None',
  'UCI - A - ACV $10K or Under', 'UCI - B - Miles 36K or Under', 'UCI - C - Herrnstein Certified',
  'Salvage Title - Yes', 'Salvage Title - No',
];

export const ALL_GROUPS: readonly SheetGroup[] = [...VIN_FACT_GROUPS, ...EQUIPMENT_GROUPS];

/** Every box the app may tick. */
export const APP_BOXES: readonly string[] = ALL_GROUPS.flatMap(g => g.boxes);
export const APP_BOX_SET: ReadonlySet<string> = new Set(APP_BOXES);
export const EQUIPMENT_BOXES: readonly string[] = EQUIPMENT_GROUPS.flatMap(g => g.boxes);

/** Text fields on the sheet the app fills beyond the vehicle identity. */
export const SHEET_TEXT_FIELDS = {
  engine: 'tiv_engine',
  cylinders: 'CYL',
  transmissionSpeeds: 'Transmission Speeds',
  extColor: 'tiv_ext_color',
  intColor: 'tiv_int_color',
  premiumAudioBrand: 'Premium Audio Brand',
  smartphoneAppName: 'Other Smartphone App Name',
} as const;

/** Keep only known app boxes, de-duplicated, preserving order. */
export function normalizeBoxes(names: readonly string[] | undefined | null): string[] {
  const out: string[] = [];
  for (const n of names ?? []) {
    if (APP_BOX_SET.has(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

/** The group a box belongs to, or undefined for a hand-filled / unknown name. */
export function groupOf(box: string): SheetGroup | undefined {
  return ALL_GROUPS.find(g => g.boxes.includes(box));
}

/** True when the VIN decode already answered this box's single-choice group (drive, doors, fuel, ...). */
export function factGroupAnswered(box: string, factBoxes: readonly string[]): boolean {
  const group = groupOf(box);
  if (!group?.exclusive || !VIN_FACT_GROUPS.includes(group)) return false;
  return factBoxes.some(b => group.boxes.includes(b));
}

/** Tick one box in an exclusive group, clearing its siblings. Non-exclusive groups just add. */
export function setBox(current: readonly string[], box: string, on: boolean): string[] {
  if (!APP_BOX_SET.has(box)) return [...current];
  const group = ALL_GROUPS.find(g => g.boxes.includes(box));
  let next = current.filter(b => b !== box);
  if (on) {
    if (group?.exclusive) next = next.filter(b => !group.boxes.includes(b));
    next.push(box);
  }
  return next;
}
