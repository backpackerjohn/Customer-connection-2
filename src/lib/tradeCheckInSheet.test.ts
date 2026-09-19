import { describe, it, expect } from 'vitest';
import { ALL_GROUPS, APP_BOXES, HAND_FILLED_BOXES, EQUIPMENT_BOXES, normalizeBoxes, setBox } from './tradeCheckInSheet';

describe('tradeCheckInSheet registry', () => {
  it('has no duplicate box names across groups', () => {
    expect(new Set(APP_BOXES).size).toBe(APP_BOXES.length);
  });
  it('never lets the app touch the hand-filled boxes', () => {
    for (const b of HAND_FILLED_BOXES) expect(APP_BOXES).not.toContain(b);
  });
  it('covers every checkbox on the template: 23 VIN-fact boxes + 82 equipment boxes + 8 hand-filled = 113', () => {
    const vinFactCount = ALL_GROUPS.filter(g => !EQUIPMENT_BOXES.includes(g.boxes[0])).reduce((n, g) => n + g.boxes.length, 0);
    expect(vinFactCount).toBe(23);
    expect(EQUIPMENT_BOXES).toHaveLength(82);
    expect(APP_BOXES.length + HAND_FILLED_BOXES.length).toBe(113);
  });
});

describe('normalizeBoxes', () => {
  it('drops unknown names and duplicates, keeps order', () => {
    expect(normalizeBoxes(['Leather', 'Bogus', 'Leather', 'AWD'])).toEqual(['Leather', 'AWD']);
    expect(normalizeBoxes(undefined)).toEqual([]);
  });
});

describe('setBox', () => {
  it('ticking a box in an exclusive group clears its siblings', () => {
    expect(setBox(['FWD', 'Leather'], 'AWD', true)).toEqual(['Leather', 'AWD']);
  });
  it('non-exclusive groups just add and remove', () => {
    const on = setBox(['Leather'], 'Heated Front Seats', true);
    expect(on).toEqual(['Leather', 'Heated Front Seats']);
    expect(setBox(on, 'Leather', false)).toEqual(['Heated Front Seats']);
  });
  it('ignores names that are not app boxes', () => {
    expect(setBox(['Leather'], 'Salvage Title - Yes', true)).toEqual(['Leather']);
  });
});
