import { describe, it, expect } from 'vitest';
import { getDueReminders, rollNextCadence } from './engine';
import { REMINDER_CONFIG } from './config';
import { Customer } from '../../types';

// Use a TEST_CONFIG with empty holidays to guarantee stable isolation for original tests
const TEST_CONFIG = {
  ...REMINDER_CONFIG,
  holidays: () => [] as Array<{ dateISO: string; name: string }>
};

describe('Reminders Engine', () => {
  const baseCustomer: Customer = {
    id: 'cust-123',
    firstName: 'John',
    lastName: 'Doe',
    status: 'lead',
    hasTradeIn: false,
    stillOwe: false,
    payingCash: false
  };

  it('Cadence only -> one DueReminder with reasons=["cadence"]', () => {
    const today = new Date('2026-05-19');
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2026-05-18' // overdue
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    expect(reminders.length).toBe(1);
    expect(reminders[0].reasons).toEqual(['cadence']);
    expect(reminders[0].dueDate).toBe('2026-05-18');
    expect(reminders[0].isOverdue).toBe(true);
  });

  it('Birthday only on the customer\'s MM-DD -> one DueReminder with reasons=["birthday"]', () => {
    const today = new Date('2026-05-19');
    const customer: Customer = {
      ...baseCustomer,
      dob: '1985-05-19', // birthday today!
      nextCadenceDue: '2026-06-20' // not due
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    expect(reminders.length).toBe(1);
    expect(reminders[0].reasons).toEqual(['birthday']);
    expect(reminders[0].dueDate).toBe('2026-05-19');
    expect(reminders[0].isOverdue).toBe(false);
  });

  it('Cadence due Mon + birthday Wed -> ONE combined DueReminder with reasons=["cadence","birthday"]', () => {
    // Mon is 2026-05-18, Wed is 2026-05-20.
    // Let's run on Wed, 2026-05-20, so that both are active.
    const today = new Date('2026-05-20'); // Wed
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2026-05-18', // Mon (overdue on Wed)
      dob: '1990-05-20' // Wed (birthday today)
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    expect(reminders.length).toBe(1);
    expect(reminders[0].reasons).toContain('cadence');
    expect(reminders[0].reasons).toContain('birthday');
    expect(reminders[0].dueDate).toBe('2026-05-18'); // earliest
  });

  it('Manual reminder for today -> appears', () => {
    const today = new Date('2026-05-19');
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2026-06-25', // not due
      manualReminders: [
        { date: '2026-05-19', reason: 'Call to ask about trade' }
      ]
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    expect(reminders.length).toBe(1);
    expect(reminders[0].reasons).toEqual(['manual']);
    expect(reminders[0].labels).toEqual(['Call to ask about trade']);
    expect(reminders[0].dueDate).toBe('2026-05-19');
    expect(reminders[0].isOverdue).toBe(false);
  });

  it('No customer.dob -> no birthday entry ever', () => {
    const today = new Date('2026-05-19');
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2026-06-25' // not due
      // no dob
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    expect(reminders.length).toBe(0);
  });

  it('Yesterday\'s cadence -> isOverdue=true', () => {
    const today = new Date('2026-05-20');
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2026-05-19' // yesterday
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    expect(reminders.length).toBe(1);
    expect(reminders[0].isOverdue).toBe(true);
  });

  it('rollNextCadence("lead") returns a date min..max days out, inclusive', () => {
    const today = new Date('2026-05-19');
    // REMINDER_CONFIG.lead.cadenceDays = { min: 26, max: 30 }
    for (let i = 0; i < 50; i++) {
       const rolledStr = rollNextCadence(today, 'lead', TEST_CONFIG);
       const rolledDate = new Date(rolledStr);
       const diffTime = Math.abs(rolledDate.getTime() - today.getTime());
       const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
       expect(diffDays).toBeGreaterThanOrEqual(26);
       expect(diffDays).toBeLessThanOrEqual(30);
    }
  });

  it('rollNextCadence("buyer") returns a date min..max months out, inclusive', () => {
    const today = new Date('2026-05-19');
    // REMINDER_CONFIG.buyer.cadenceMonths = { min: 3, max: 6 }
    const rolledStr = rollNextCadence(today, 'buyer', TEST_CONFIG);
    const rolledDate = new Date(rolledStr);
    
    // Check difference in months roughly
    let diffMonths = (rolledDate.getFullYear() - today.getFullYear()) * 12 + (rolledDate.getMonth() - today.getMonth());
    expect(diffMonths).toBeGreaterThanOrEqual(3);
    expect(diffMonths).toBeLessThanOrEqual(6);
  });

  it('Fresh buyer Day 1 (within 24 hours) -> followUp24h is active and not combined', () => {
    const today = new Date('2026-05-20T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      purchaseDate: '2026-05-19T12:00:00Z', // 24 hours ago
      lastContactedAt: ''
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    expect(reminders.length).toBe(1);
    expect(reminders[0].reasons).toEqual(['followUp24h']);
    expect(reminders[0].dueDate).toBe('2026-05-20');
  });

  it('Fresh buyer Day 2 (within 48-72h window) -> followUp24h and referral48to72h are active as separate reminders', () => {
    const today = new Date('2026-05-21T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      purchaseDate: '2026-05-19T12:00:00Z', // 48 hours ago
      lastContactedAt: ''
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    // fresh buyers get NO combining, so they are separate individual reminders
    expect(reminders.length).toBe(2);
    
    // Sort reminders by dueDate to assert their properties reliably
    reminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    
    expect(reminders[0].reasons).toEqual(['followUp24h']);
    expect(reminders[1].reasons).toEqual(['referral48to72h']);
  });

  it('Fresh buyer with followUp24h closed -> only referral48to72h fires', () => {
    const today = new Date('2026-05-21T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      purchaseDate: '2026-05-19T12:00:00Z', // 48 hours ago
      lastContactedAt: '2026-05-20T13:00:00Z' // contacted after 24h follow up due date
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    expect(reminders.length).toBe(1);
    expect(reminders[0].reasons).toEqual(['referral48to72h']);
  });

  it('Buyer Day 8 -> rolls into normal buyer mode with combining', () => {
    const today = new Date('2026-05-27T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      purchaseDate: '2026-05-19T12:00:00Z', // 8 days ago
      nextCadenceDue: '2026-05-26', // overdue
      dob: '1985-05-27' // birthday today!
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    // 8 days since purchase means day 8: freshBuyer is false, so it combines
    expect(reminders.length).toBe(1);
    expect(reminders[0].reasons).toContain('cadence');
    expect(reminders[0].reasons).toContain('birthday');
  });

  it('Anniversary fires yearly on calendar MM-DD of purchaseDate, 1+ years later', () => {
    const today = new Date('2027-05-19T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      purchaseDate: '2026-05-19T12:00:00Z' // exactly 1 year ago
    };
    const reminders = getDueReminders(customer, today, TEST_CONFIG);
    const anniversaryReminder = reminders.find(r => r.reasons.includes('anniversary'));
    expect(anniversaryReminder).toBeDefined();
    expect(anniversaryReminder?.dueDate).toBe('2027-05-19');
  });

  // --- NEW HOLIDAY REMINDERS TESTS ---

  it('Customer with dob MM-DD = 12-24 on Dec 24 -> ONE DueReminder with reasons including birthday and holiday, labels containing Birthday and Christmas Eve', () => {
    const today = new Date('2026-12-24T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      dob: '1985-12-24', // birthday today
      nextCadenceDue: '2026-12-31' // not due yet
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    expect(reminders.length).toBe(1);
    expect(reminders[0].reasons).toContain('birthday');
    expect(reminders[0].reasons).toContain('holiday');
    expect(reminders[0].labels).toContain('Birthday');
    expect(reminders[0].labels).toContain('Christmas Eve');
  });

  it('Customer with no other reminders on July 4 -> ONE DueReminder with reasons=["holiday"], label "Independence Day"', () => {
    const today = new Date('2026-07-04T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2026-08-01' // not due
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const hRem = reminders.find(r => r.reasons.includes('holiday'));
    expect(hRem).toBeDefined();
    expect(hRem?.reasons).toEqual(['holiday']);
    expect(hRem?.labels).toContain('Independence Day');
  });

  it('On Dec 30, the upcoming New Year\'s Day reminder appears (year+1 lookup)', () => {
    const today = new Date('2026-12-30T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2027-01-30' // not due
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const hRem = reminders.find(r => r.labels.includes("New Year's Day"));
    expect(hRem).toBeDefined();
  });

  it('Editing config.holidays() to omit Christmas removes it from the engine output', () => {
    const today = new Date('2026-12-24T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2026-12-31' // not due
    };
    const customConfig = {
      ...REMINDER_CONFIG,
      holidays: (year: number) => {
        return REMINDER_CONFIG.holidays(year).filter(h => h.name !== 'Christmas Eve' && h.name !== 'Christmas Day');
      }
    };
    const reminders = getDueReminders(customer, today, customConfig);
    const christmasEveFound = reminders.some(r => r.labels.includes('Christmas Eve'));
    const christmasDayFound = reminders.some(r => r.labels.includes('Christmas Day'));
    expect(christmasEveFound).toBe(false);
    expect(christmasDayFound).toBe(false);
  });

  // --- NEW BUGFIX TESTS (FIX 5 & FIX 6) ---

  it("Birthday yesterday, dealer not texted → reminder appears today with isOverdue=true and dueDate=yesterday's date", () => {
    const today = new Date('2026-05-20T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      dob: '1985-05-19', // birthday was yesterday
      nextCadenceDue: '2026-06-25' // not due
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const bdayRem = reminders.find(r => r.reasons.includes('birthday'));
    expect(bdayRem).toBeDefined();
    expect(bdayRem?.dueDate).toBe('2026-05-19');
    expect(bdayRem?.isOverdue).toBe(true);
  });

  it("Birthday yesterday, dealer texted yesterday → no birthday reminder (handled)", () => {
    const today = new Date('2026-05-20T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      dob: '1985-05-19', // birthday was yesterday
      lastContactedAt: '2026-05-19T15:00:00Z', // texted yesterday
      nextCadenceDue: '2026-06-25'
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const bdayRem = reminders.find(r => r.reasons.includes('birthday'));
    expect(bdayRem).toBeUndefined();
  });

  it("Birthday 8 days ago (past grace) → no birthday reminder", () => {
    const today = new Date('2026-05-20T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      dob: '1985-05-12', // birthday was 8 days ago
      nextCadenceDue: '2026-06-25'
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const bdayRem = reminders.find(r => r.reasons.includes('birthday'));
    expect(bdayRem).toBeUndefined();
  });

  it("Holiday 3 days ago, dealer not texted → reminder appears with isOverdue=true", () => {
    // Let's pick Valentine's Day (02-14) in 2026, and today is Feb 17 (3 days later)
    const today = new Date('2026-02-17T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2026-06-25'
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const holidayRem = reminders.find(r => r.reasons.includes('holiday') && r.labels.includes("Valentine's Day"));
    expect(holidayRem).toBeDefined();
    expect(holidayRem?.dueDate).toBe('2026-02-14');
    expect(holidayRem?.isOverdue).toBe(true);
  });

  it("Holiday 8 days ago → no reminder", () => {
    // Valentine's Day (02-14), today is Feb 22 (8 days later)
    const today = new Date('2026-02-22T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      nextCadenceDue: '2026-06-25'
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const holidayRem = reminders.find(r => r.reasons.includes('holiday') && r.labels.includes("Valentine's Day"));
    expect(holidayRem).toBeUndefined();
  });

  it("Anniversary yesterday, dealer not texted → reminder appears with isOverdue=true and dueDate=yesterday's date", () => {
    const today = new Date('2027-05-20T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      purchaseDate: '2026-05-19T12:00:00Z', // purchase exactly 1 year + 1 day ago
      nextCadenceDue: '2027-06-25'
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const annivRem = reminders.find(r => r.reasons.includes('anniversary'));
    expect(annivRem).toBeDefined();
    expect(annivRem?.dueDate).toBe('2027-05-19');
    expect(annivRem?.isOverdue).toBe(true);
  });

  it("Late-December birthday seen in early January (year boundary)", () => {
    // today=2027-01-03, dob=1985-12-28 → birthday reminder appears with dueDate=2026-12-28, isOverdue=true.
    const today = new Date('2027-01-03T12:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      dob: '1985-12-28', // birthday on Dec 28
      nextCadenceDue: '2027-06-25'
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const bdayRem = reminders.find(r => r.reasons.includes('birthday'));
    expect(bdayRem).toBeDefined();
    expect(bdayRem?.dueDate).toBe('2026-12-28');
    expect(bdayRem?.isOverdue).toBe(true);
  });

  it("Purchase at 9am today, dealer texts at 6pm today → followUp24h does NOT fire", () => {
    // purchase = 2026-05-20T09:00:00Z
    // texted = 2026-05-20T18:00:00Z
    // today = 2026-05-21T10:00:00Z
    const today = new Date('2026-05-21T10:00:00Z');
    const customer: Customer = {
      ...baseCustomer,
      purchaseDate: '2026-05-20T09:00:00Z',
      lastContactedAt: '2026-05-20T18:00:00Z' // texted after purchase on same day, satisfies 24h follow up
    };
    const reminders = getDueReminders(customer, today, REMINDER_CONFIG);
    const followUp = reminders.find(r => r.reasons.includes('followUp24h'));
    expect(followUp).toBeUndefined();
  });
});
