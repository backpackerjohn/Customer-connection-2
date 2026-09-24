import { describe, it, expect } from 'vitest';
import { applicantView, creditAppFill, creditAppHoldsSsn, splitPhone } from './creditApp';
import { Customer, emptyCustomer } from '../types';

const base: Customer = {
  ...emptyCustomer,
  firstName: 'Jane', middleInitial: 'Q', lastName: 'Doe', dob: '1990-02-03', phone: '(740) 555-1234', email: 'jane@example.com',
  address: '1 Main St', city: 'Chillicothe', state: 'oh', zip: '45601',
  creditApp: {
    creditType: 'joint-spousal',
    applicant: { yearsAtAddress: '3', monthsAtAddress: '4', housingPayment: '1200', residentialStatus: 'rent', employer: 'Acme', employerPhone: '7405559999', jobTitle: 'Tech', employedYears: '2', grossMonthlySalary: '4500.5', otherIncomeMonthly: '200' },
    hasCoApplicant: true,
    coApplicant: { firstName: 'John', lastName: 'Doe', dob: '1988-12-25', phone: '740-555-0000', residentialStatus: 'own', otherIncomeMonthly: '100.25' },
    references: [{ name: 'Mom', address: '2 Elm', phone: '555', whose: 'A' }, { name: 'Pal', whose: 'J' }],
  },
};

describe('splitPhone', () => {
  it('splits 10 and 11 digit numbers and keeps odd input in the line field', () => {
    expect(splitPhone('(740) 555-1234')).toEqual(['740', '555', '1234']);
    expect(splitPhone('1-740-555-1234')).toEqual(['740', '555', '1234']);
    expect(splitPhone('ext 12')).toEqual(['', '', 'ext 12']);
    expect(splitPhone(undefined)).toEqual(['', '', '']);
  });
});

describe('applicantView', () => {
  it('takes identity from the profile and the rest from creditApp.applicant', () => {
    const v = applicantView(base);
    expect(v.firstName).toBe('Jane');
    expect(v.employer).toBe('Acme');
  });
});

describe('creditAppFill', () => {
  const { text, checks } = creditAppFill(base, { applicant: '123-45-6789', coApplicant: '987-65-4321' });
  it('fills the applicant half from the profile, mobile only, SSN from the argument', () => {
    expect(text['Primary Last Name']).toBe('Doe');
    expect(text['Primary Middle Name']).toBe('Q');
    expect(text['Primary Birth Date']).toBe('02/03/1990');
    expect(text['Primary Social Security Number']).toBe('123-45-6789');
    expect(text['Primary Mobile Area Code']).toBe('740');
    expect(text['Primary Mobile Line Number']).toBe('1234');
    expect(text['Primary Evening Home Area Code']).toBeUndefined();
    expect(text['Primary Current State Abbreviation']).toBe('OH');
    expect(text['Primary Current Mortgage or Rent Payment']).toBe('$1,200');
    expect(text['Primary Current Employment Salary']).toBe('$4,500.5');
    expect(text['Primary Current Employer Area Code']).toBe('740');
    expect(checks['Lease']).toBe(true);
    expect(checks['OwnHome']).toBe(false);
  });
  it('fills the joint half, using the home phone box for the mobile number', () => {
    expect(text['Secondary First Name']).toBe('John');
    expect(text['Secondary Social Security Number']).toBe('987-65-4321');
    expect(text['Secondary Evening Home Area Code']).toBe('740');
    expect(checks['Own_2']).toBe(true);
    expect(text['Total Other Monthly Income']).toBe('$300.25');
  });
  it('ticks credit type and reference boxes', () => {
    expect(checks['With another person']).toBe(true);
    expect(checks['Spousal']).toBe(true);
    expect(checks['Individually or']).toBe(false);
    expect(text['Primary Reference 1 Name']).toBe('Mom');
    expect(checks['A1']).toBe(true);
    expect(checks['J2']).toBe(true);
    expect(checks['B2']).toBe(false);
  });
  it('leaves the joint half and the dealer box alone when there is no co-applicant', () => {
    const solo = creditAppFill({ ...base, creditApp: { ...base.creditApp, hasCoApplicant: false } });
    expect(solo.text['Secondary First Name']).toBeUndefined();
    expect(solo.text['Primary Social Security Number']).toBe('');
    expect(solo.text['Dealer Name']).toBeUndefined();
    expect(solo.text['Cash Price']).toBeUndefined();
    expect(solo.checks['retail']).toBeUndefined();
  });
});

describe('creditAppHoldsSsn', () => {
  it('flags any ssn-like key inside the stored map', () => {
    expect(creditAppHoldsSsn(base.creditApp)).toBe(false);
    expect(creditAppHoldsSsn({ applicant: { ssn: '1' } as never })).toBe(true);
  });
});
