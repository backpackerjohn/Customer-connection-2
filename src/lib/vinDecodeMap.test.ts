import { describe, it, expect } from 'vitest';
import { vinFactsFromRecord } from './vinDecodeMap';

// Shaped like NHTSA DecodeVinValues output for a 2023 Honda Pilot EX-L.
const pilot = {
  Make: 'HONDA', Model: 'Pilot', ModelYear: '2023', Trim: 'EX-L',
  BodyClass: 'Sport Utility Vehicle (SUV)/Multipurpose Passenger Vehicle (MPV)',
  Doors: '4', DriveType: 'AWD/All-Wheel Drive', FuelTypePrimary: 'Gasoline',
  EngineCylinders: '6', DisplacementL: '3.5', EngineConfiguration: 'V-Shaped',
  TransmissionStyle: 'Automatic', TransmissionSpeeds: '10',
  ABS: 'Standard', AdaptiveCruiseControl: 'Standard', BlindSpotMon: 'Standard',
  LaneKeepSystem: 'Standard', RearVisibilitySystem: 'Standard', ParkAssist: '',
  ForwardCollisionWarning: 'Standard', KeylessIgnition: 'Standard',
};

describe('vinFactsFromRecord', () => {
  it('ticks drivetrain, doors, fuel, and transmission from the VIN', () => {
    const f = vinFactsFromRecord(pilot);
    expect(f.boxes).toEqual(expect.arrayContaining(['AWD', '4 Doors', 'Gas', 'Automatic Transmission']));
    expect(f.boxes).not.toContain('Convertible');
    expect(f.isTruck).toBe(false);
  });
  it('builds the engine text and copies cylinders and speeds', () => {
    const f = vinFactsFromRecord(pilot);
    expect(f.engine).toBe('3.5L V6');
    expect(f.cylinders).toBe('6');
    expect(f.transmissionSpeeds).toBe('10');
    expect(f.trim).toBe('EX-L');
  });
  it('maps manufacturer-reported standard safety features and skips blanks', () => {
    const f = vinFactsFromRecord(pilot);
    expect(f.standardFeatures).toEqual(expect.arrayContaining(['ABS', 'Adaptive Cruise Control', 'Blind Spot Monitor', 'Lane Keep Assist', 'Back-Up Camera', 'Collision Avoidance System', 'Remote Keyless Entry']));
    expect(f.standardFeatures).not.toContain('Rear Parking Sensors');
  });
  it('handles a pickup: 4x4, crew cab, bed length, diesel, manual', () => {
    const f = vinFactsFromRecord({
      BodyClass: 'Pickup', Doors: '4', DriveType: '4WD/4-Wheel Drive/4x4', FuelTypePrimary: 'Diesel',
      CabType: 'Crew/ Super Crew/ Crew Max', BedLengthIN: '69.3', TransmissionStyle: 'Manual/Standard',
      EngineCylinders: '8', DisplacementL: '6.7', EngineConfiguration: 'V-Shaped',
    });
    expect(f.isTruck).toBe(true);
    expect(f.boxes).toEqual(expect.arrayContaining(['4x4', 'Cabin - Crew', 'Bed - Short', 'Diesel', 'Manual Transmission', '4 Doors']));
    expect(f.engine).toBe('6.7L V8');
  });
  it('long bed at 75 inches or more, CVT counts as automatic, FWD and 2 doors', () => {
    const f = vinFactsFromRecord({
      BodyClass: 'Pickup', CabType: 'Regular', BedLengthIN: '96.0', DriveType: 'FWD/Front-Wheel Drive',
      Doors: '2', TransmissionStyle: 'Continuously Variable Transmission (CVT)', FuelTypePrimary: 'Gasoline',
    });
    expect(f.boxes).toEqual(expect.arrayContaining(['Bed - Long', 'Cabin - Regular', 'FWD', '2 Doors', 'Automatic Transmission', 'Gas']));
  });
  it('leaves everything blank when the record is empty or Not Applicable', () => {
    const f = vinFactsFromRecord({ DriveType: 'Not Applicable', Doors: '', FuelTypePrimary: '', Trim: 'Not Applicable' });
    expect(f.boxes).toEqual([]);
    expect(f.engine).toBe('');
    expect(f.trim).toBe('');
    expect(f.standardFeatures).toEqual([]);
  });
  it('falls back to Series when Trim is missing and flags convertibles', () => {
    const f = vinFactsFromRecord({ Series: 'GT Premium', BodyClass: 'Convertible/Cabriolet', DriveType: 'RWD/Rear-Wheel Drive' });
    expect(f.trim).toBe('GT Premium');
    expect(f.boxes).toEqual(expect.arrayContaining(['Convertible', 'RWD']));
  });
});

describe('engine text without a layout', () => {
  it('reads "2.0L 4-cyl" when NHTSA gives no engine configuration', () => {
    const f = vinFactsFromRecord({ DisplacementL: '2.0', EngineCylinders: '4' });
    expect(f.engine).toBe('2.0L 4-cyl');
    expect(f.cylinders).toBe('4');
  });
});
