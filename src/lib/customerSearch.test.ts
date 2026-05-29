import { describe, it, expect } from 'vitest';
import { Customer } from '../types';
import {
  resolveVehicles,
  applyFilters,
  FilterCriteria
} from './customerSearch';

describe('customerSearch - resolveVehicles', () => {
  it('handles lead & inactive: owns=trade (if hasTradeIn), wants=vehicle (if present)', () => {
    // 1. Lead with trade and wanted vehicle
    const leadWithBoth: Customer = {
      firstName: 'John',
      lastName: 'Doe',
      status: 'lead',
      hasTradeIn: true,
      tradeYear: '2015',
      tradeMake: 'Toyota',
      tradeModel: 'Camry',
      tradeTrim: 'LE',
      vehicleYear: '2022',
      vehicleMake: 'Ford',
      vehicleModel: 'Explorer',
      stillOwe: false,
      payingCash: true
    };
    const resBoth = resolveVehicles(leadWithBoth);
    expect(resBoth.owns).toEqual([{ year: '2015', make: 'Toyota', model: 'Camry', trim: 'LE' }]);
    expect(resBoth.wants).toEqual([{ year: '2022', make: 'Ford', model: 'Explorer' }]);

    // 2. Lead with trade but no wanted vehicle
    const leadWithTradeOnly: Customer = {
      firstName: 'Jane',
      lastName: 'Doe',
      status: 'lead',
      hasTradeIn: true,
      tradeYear: '2012',
      tradeMake: 'Nissan',
      tradeModel: 'Rogue',
      tradeTrim: 'SV',
      stillOwe: false,
      payingCash: true
    };
    const resTradeOnly = resolveVehicles(leadWithTradeOnly);
    expect(resTradeOnly.owns).toEqual([{ year: '2012', make: 'Nissan', model: 'Rogue', trim: 'SV' }]);
    expect(resTradeOnly.wants).toEqual([]);

    // 3. Lead with wanted vehicle but no trade-in (hasTradeIn is false)
    const leadWithWantsOnly: Customer = {
      firstName: 'Tom',
      lastName: 'Smith',
      status: 'lead',
      hasTradeIn: false,
      vehicleYear: '2023',
      vehicleMake: 'Honda',
      vehicleModel: 'Civic',
      stillOwe: false,
      payingCash: true
    };
    const resWantsOnly = resolveVehicles(leadWithWantsOnly);
    expect(resWantsOnly.owns).toEqual([]);
    expect(resWantsOnly.wants).toEqual([{ year: '2023', make: 'Honda', model: 'Civic' }]);
  });

  it('handles sold: owns=vehicle, wants=[]', () => {
    const soldCustomer: Customer = {
      firstName: 'Buyer',
      lastName: 'One',
      status: 'sold',
      hasTradeIn: true, // should be ignored for owned vehicles in 'sold' status
      tradeYear: '2010',
      tradeMake: 'GMC',
      tradeModel: 'Yukon',
      vehicleYear: '2024',
      vehicleMake: 'Chevrolet',
      vehicleModel: 'Tahoe',
      stillOwe: false,
      payingCash: true
    };
    const res = resolveVehicles(soldCustomer);
    expect(res.owns).toEqual([{ year: '2024', make: 'Chevrolet', model: 'Tahoe' }]);
    expect(res.wants).toEqual([]);
  });
});

describe('customerSearch - applyFilters', () => {
  const mockToday = new Date('2026-05-29T12:00:00Z');

  const customers: Customer[] = [
    {
      id: '1',
      firstName: 'Alice',
      lastName: 'Smith',
      status: 'lead',
      email: 'alice@example.com',
      phone: '555-0100',
      leadSourceType: 'walk-in',
      hasTradeIn: true,
      tradeYear: '2018',
      tradeMake: 'Ford',
      tradeModel: 'F150',
      vehicleYear: '2024',
      vehicleMake: 'Ram',
      vehicleModel: '1500',
      stillOwe: false,
      payingCash: true
    },
    {
      id: '2',
      firstName: 'Bob',
      lastName: 'Jones',
      status: 'sold',
      email: 'bob@example.com',
      phone: '555-0200',
      leadSourceType: 'crm',
      purchaseDate: '2026-05-01',
      hasTradeIn: false,
      vehicleYear: '2020',
      vehicleMake: 'Toyota',
      vehicleModel: 'RAV4',
      stillOwe: false,
      payingCash: true
    },
    {
      id: '3',
      firstName: 'Charlie',
      lastName: 'Brown',
      status: 'inactive',
      email: 'charlie@example.com',
      phone: '555-0300',
      leadSourceType: 'social',
      hasTradeIn: false,
      stillOwe: false,
      payingCash: true
    },
    {
      id: '4',
      firstName: 'Diana',
      lastName: 'Prince',
      status: 'lead',
      email: 'diana@example.com',
      phone: '555-0400',
      leadSourceType: 'referral',
      hasTradeIn: true, // has trade-in listed but details missing (represents unresolvable)
      stillOwe: false,
      payingCash: true
    }
  ];

  it('empty criteria returns all in matched', () => {
    const criteria: FilterCriteria = {};
    const res = applyFilters(customers, criteria, mockToday);
    expect(res.matched.length).toBe(4);
    expect(res.unclassified.length).toBe(0);
  });

  it('filters by status (OR within facet)', () => {
    const criteria: FilterCriteria = {
      status: ['lead', 'inactive']
    };
    const res = applyFilters(customers, criteria, mockToday);
    expect(res.matched.map(c => c.id)).toEqual(['1', '3', '4']);
    expect(res.unclassified.length).toBe(0);
  });

  it('filters by leadSourceType (OR within facet)', () => {
    const criteria: FilterCriteria = {
      leadSourceType: ['walk-in', 'crm']
    };
    const res = applyFilters(customers, criteria, mockToday);
    expect(res.matched.map(c => c.id)).toEqual(['1', '2']);
  });

  it('filters across multiple facets (AND across facets)', () => {
    const criteria: FilterCriteria = {
      status: ['lead'],
      leadSourceType: ['walk-in']
    };
    const res = applyFilters(customers, criteria, mockToday);
    expect(res.matched.map(c => c.id)).toEqual(['1']);
  });

  it('let leads pass the purchase-window facet (time-since-purchase)', () => {
    const criteria: FilterCriteria = {
      purchasedWithinDaysMin: 0,
      purchasedWithinDaysMax: 30
    };
    const res = applyFilters(customers, criteria, mockToday);
    // Bob should match (purchased May 1, which is within 30 days of May 29).
    // Alice, Charlie, Diana also have status 'lead' or 'inactive' and no purchaseDate, so they should PASS this validation.
    expect(res.matched.map(c => c.id)).toContain('1'); // Lead, passes
    expect(res.matched.map(c => c.id)).toContain('2'); // Sold within 30 days, passes
    expect(res.matched.map(c => c.id)).toContain('3'); // Inactive, passes
    expect(res.matched.map(c => c.id)).toContain('4'); // Lead, passes
  });

  it('handles recency fields correctly', () => {
    const recentCustomers: Customer[] = [
      {
        id: '10',
        firstName: 'Recent',
        lastName: 'Contact',
        status: 'lead',
        lastContactedAt: '2026-05-20T10:00:00Z',
        hasTradeIn: false,
        stillOwe: false,
        payingCash: true
      },
      {
        id: '11',
        firstName: 'Old',
        lastName: 'Contact',
        status: 'lead',
        lastContactedAt: '2026-04-15T12:00:00Z',
        hasTradeIn: false,
        stillOwe: false,
        payingCash: true
      }
    ];

    const criteria: FilterCriteria = {
      recencyField: 'lastContactedAt',
      recencyMin: '2026-05-01',
      recencyMax: '2026-05-25'
    };

    const res = applyFilters(recentCustomers, criteria, mockToday);
    expect(res.matched.map(c => c.id)).toEqual(['10']);
  });

  it('handles recall substring matching (case-insensitive across designated fields)', () => {
    // Search by firstName
    let res = applyFilters(customers, { recall: 'AlI' }, mockToday);
    expect(res.matched.map(c => c.id)).toEqual(['1']);

    // Search by email
    res = applyFilters(customers, { recall: '@example' }, mockToday);
    expect(res.matched.length).toBe(4);

    // Search by trade model
    res = applyFilters(customers, { recall: 'f150' }, mockToday);
    expect(res.matched.map(c => c.id)).toEqual(['1']);
  });

  it('groups unclassifiable customer into unclassified list when vehicle filters are active', () => {
    // 1. Vehicle filter by make: 'Ford' in 'owns' scope.
    // Alice owns a Ford F150. Matches.
    // Bob owns a Toyota RAV4. Excluded (definite mismatch).
    // Charlie has no vehicles. Unclassified (empty vehicles list in active owns scope).
    // Diana has trade but tradeMake is empty, so wants/owns evaluated as unknown make. Unclassified.
    const criteria: FilterCriteria = {
      vehicleScope: 'owns',
      make: ['Ford']
    };

    const res = applyFilters(customers, criteria, mockToday);
    expect(res.matched.map(c => c.id)).toEqual(['1']);
    // Charlie page has no vehicle, Diana has trade option true but no make/model/year filled.
    expect(res.unclassified.map(c => c.id)).toContain('3');
    expect(res.unclassified.map(c => c.id)).toContain('4');
    expect(res.unclassified.map(c => c.id)).not.toContain('2'); // Bob is definite mismatch
  });

  it('filters by carAge limits', () => {
    const criteria: FilterCriteria = {
      carAgeMin: 5,
      carAgeMax: 10,
      vehicleScope: 'owns'
    };

    // Bob has a 2020 Toyota. 2026 - 2020 = 6 years old (within min=5, max=10). Match!
    // Alice has a 2018 Ford trade-in (owns in 'lead' status since trade). 2026 - 2018 = 8 years old. Match!
    const res = applyFilters(customers, criteria, mockToday);
    expect(res.matched.map(c => c.id)).toContain('1');
    expect(res.matched.map(c => c.id)).toContain('2');
  });

  it('filters by recall within notesByCustomer', () => {
    const notesByCustomer = {
      '1': ['Is looking for a red truck', 'Has 3 kids'],
      '2': ['Needs financing approval', 'Prefers email only'],
    };

    // Searching 'financing' should match Bob (id '2')
    const resFilters = applyFilters(customers, { recall: 'financing' }, mockToday, notesByCustomer);
    expect(resFilters.matched.map(c => c.id)).toEqual(['2']);

    // Searching 'red truck' should match Alice (id '1')
    const resFilters2 = applyFilters(customers, { recall: 'ReD tRuCk' }, mockToday, notesByCustomer);
    expect(resFilters2.matched.map(c => c.id)).toEqual(['1']);
  });
});
