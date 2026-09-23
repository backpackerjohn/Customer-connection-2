/**
 * Maps a raw NHTSA vPIC "DecodeVinValues" record onto Trade Check-In Sheet
 * boxes and text fields. Pure, tested, no network. Only ticks what the VIN
 * actually says; a blank or "Not Applicable" value leaves the box alone.
 */

/** The subset of the NHTSA record we read. All values are strings, possibly empty. */
export interface VinRecord {
  Make?: string; Model?: string; ModelYear?: string; Trim?: string; Series?: string;
  BodyClass?: string; Doors?: string; DriveType?: string; FuelTypePrimary?: string;
  EngineCylinders?: string; DisplacementL?: string; EngineConfiguration?: string;
  TransmissionStyle?: string; TransmissionSpeeds?: string;
  CabType?: string; BedLengthIN?: string;
  // Safety / assistance features: "Standard", "Optional", "Not Available", or blank.
  ABS?: string; AdaptiveCruiseControl?: string; BlindSpotMon?: string; LaneKeepSystem?: string;
  RearVisibilitySystem?: string; ParkAssist?: string; ForwardCollisionWarning?: string;
  RearCrossTrafficAlert?: string; KeylessIgnition?: string; DaytimeRunningLight?: string;
  [key: string]: string | undefined;
}

export interface VinFacts {
  /** Sheet boxes the VIN proves. */
  boxes: string[];
  engine: string;
  cylinders: string;
  transmissionSpeeds: string;
  trim: string;
  isTruck: boolean;
  /** Lookup boxes NHTSA reports as standard for this model year (ticked, tagged VIN). */
  standardFeatures: string[];
}

const has = (v: string | undefined) => !!v && v.trim() !== '' && !/not applicable/i.test(v);
const lc = (v: string | undefined) => (v ?? '').toLowerCase();

export function vinFactsFromRecord(r: VinRecord): VinFacts {
  const boxes: string[] = [];
  const body = lc(r.BodyClass);
  const isTruck = /pickup|truck/.test(body) && !/cab chassis/.test(body);

  // Drivetrain
  const drive = lc(r.DriveType);
  if (/4wd|4x4|four-wheel/.test(drive)) boxes.push('4x4');
  else if (/awd|all-wheel/.test(drive)) boxes.push('AWD');
  else if (/fwd|front-wheel/.test(drive)) boxes.push('FWD');
  else if (/rwd|rear-wheel/.test(drive)) boxes.push('RWD');
  else if (/4x2|2wd/.test(drive)) boxes.push('4x2');

  // Doors
  const doors = parseInt(r.Doors ?? '', 10);
  if (doors >= 2 && doors <= 6) boxes.push(`${doors} Doors`);

  // Fuel
  const fuel = lc(r.FuelTypePrimary);
  if (/diesel/.test(fuel)) boxes.push('Diesel');
  else if (/gasoline|gas|flex|ethanol|e85/.test(fuel)) boxes.push('Gas');

  // Transmission
  const trans = lc(r.TransmissionStyle);
  if (/manual/.test(trans)) boxes.push('Manual Transmission');
  else if (/automatic|cvt|continuously|dual clutch|automated/.test(trans)) boxes.push('Automatic Transmission');

  // Body
  if (/convertible|cabriolet|roadster/.test(body)) boxes.push('Convertible');

  // Trucks
  if (isTruck) {
    const cab = lc(r.CabType);
    if (/crew/.test(cab)) boxes.push('Cabin - Crew');
    else if (/quad/.test(cab)) boxes.push('Cabin - Quad');
    else if (/extended|super|double|king|access|club/.test(cab)) boxes.push('Cabin - Extended');
    else if (/regular|standard|single/.test(cab)) boxes.push('Cabin - Regular');
    const bed = parseFloat(r.BedLengthIN ?? '');
    if (Number.isFinite(bed) && bed > 0) boxes.push(bed >= 75 ? 'Bed - Long' : 'Bed - Short');
  }

  // Engine text: "3.5L V6" when we have both, else whatever we have
  const liters = parseFloat(r.DisplacementL ?? '');
  const cyl = parseInt(r.EngineCylinders ?? '', 10);
  const config = lc(r.EngineConfiguration);
  const layout = /v-shaped|v /.test(config) ? 'V' : /in-line|inline/.test(config) ? 'I' : /flat|boxer/.test(config) ? 'H' : '';
  const engineParts: string[] = [];
  if (Number.isFinite(liters) && liters > 0) engineParts.push(`${liters.toFixed(1)}L`);
  if (Number.isInteger(cyl) && cyl > 0) engineParts.push(layout ? `${layout}${cyl}` : `${cyl}-cyl`);
  const engine = engineParts.join(' ');
  const cylinders = Number.isInteger(cyl) && cyl > 0 ? String(cyl) : '';
  const speeds = parseInt(r.TransmissionSpeeds ?? '', 10);
  const transmissionSpeeds = Number.isInteger(speeds) && speeds > 0 ? String(speeds) : '';

  // Safety features the manufacturer filed as standard
  const std = (v: string | undefined) => /standard/i.test(v ?? '');
  const standardFeatures: string[] = [];
  if (std(r.ABS)) standardFeatures.push('ABS');
  if (std(r.AdaptiveCruiseControl)) standardFeatures.push('Adaptive Cruise Control');
  if (std(r.BlindSpotMon)) standardFeatures.push('Blind Spot Monitor');
  if (std(r.LaneKeepSystem)) standardFeatures.push('Lane Keep Assist');
  if (std(r.RearVisibilitySystem)) standardFeatures.push('Back-Up Camera');
  if (std(r.ParkAssist)) standardFeatures.push('Rear Parking Sensors');
  if (std(r.ForwardCollisionWarning)) standardFeatures.push('Collision Avoidance System');
  if (std(r.KeylessIgnition)) standardFeatures.push('Remote Keyless Entry');

  const trim = has(r.Trim) ? r.Trim!.trim() : has(r.Series) ? r.Series!.trim() : '';

  return { boxes, engine, cylinders, transmissionSpeeds, trim, isTruck, standardFeatures };
}
