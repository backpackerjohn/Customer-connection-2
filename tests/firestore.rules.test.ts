import { 
  initializeTestEnvironment, 
  RulesTestEnvironment, 
  assertSucceeds, 
  assertFails 
} from '@firebase/rules-unit-testing';
import { 
  doc, setDoc, updateDoc, getDocs, 
  collection, query, where, serverTimestamp 
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;
const PROJECT_ID = 'demo-customer-connect';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { 
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const validCustomer = (overrides = {}) => ({
  firstName: 'Jane',
  lastName: 'Doe',
  status: 'lead',
  hasTradeIn: false,
  stillOwe: false,
  payingCash: false,
  createdBy: 'user_alice',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastContactedAt: '',
  nextCadenceDue: '',
  manualReminders: [],
  purchaseDate: '',
  referralAskedAt: '',
  ...overrides,
});

const aliceContext = () => testEnv.authenticatedContext('user_alice');
const bobContext = () => testEnv.authenticatedContext('user_bob');
const anonContext = () => testEnv.unauthenticatedContext();

describe('Firestore rules — Customer collection', () => {
  it('1. Identity Spoofing on create — rejects createdBy != auth.uid', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/forged'), 
        validCustomer({ createdBy: 'user_bob' }))
    );
  });

  it('2. Identity Spoofing on update — rejects update by non-owner', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'customers/c1'), 
        validCustomer({ createdBy: 'user_alice' }));
    });
    
    const bobDb = bobContext().firestore();
    await assertFails(
      updateDoc(doc(bobDb, 'customers/c1'), { firstName: 'Bobby' })
    );
  });

  it('3. Privilege Escalation — rejects list without createdBy filter', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(getDocs(collection(aliceDb, 'customers')));
  });

  it('4. Shadow Field Injection — rejects unknown field on create', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/c1'), {
        ...validCustomer(),
        shadowField: 'evil'
      })
    );
  });

  it('5. State Shortcut — rejects updating createdAt after creation', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'customers/c1'), 
        validCustomer({ createdBy: 'user_alice' }));
    });

    const aliceDb = aliceContext().firestore();
    await assertFails(
      updateDoc(doc(aliceDb, 'customers/c1'), { 
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp() 
      })
    );
  });

  it('6. Resource Poisoning (ID) — rejects 2KB document ID', async () => {
    const aliceDb = aliceContext().firestore();
    const longId = 'a'.repeat(2049);
    await assertFails(
      setDoc(doc(aliceDb, `customers/${longId}`), validCustomer())
    );
  });

  it('7. Resource Poisoning (Field) — rejects 1MB firstName string', async () => {
    const aliceDb = aliceContext().firestore();
    const giantString = 'a'.repeat(1024 * 1024);
    await assertFails(
      setDoc(doc(aliceDb, 'customers/c1'), 
        validCustomer({ firstName: giantString }))
    );
  });

  it('8. Resource Poisoning (Type) — rejects boolean firstName', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/c1'), 
        validCustomer({ firstName: true }))
    );
  });

  it('9. Unauthenticated Access — rejects create without auth', async () => {
    const anonDb = anonContext().firestore();
    await assertFails(
      setDoc(doc(anonDb, 'customers/c1'), validCustomer())
    );
  });

  it('10. Partial Update Breach — rejects updating createdBy or createdAt', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'customers/c1'), 
        validCustomer({ createdBy: 'user_alice' }));
    });

    const aliceDb = aliceContext().firestore();
    await assertFails(
      updateDoc(doc(aliceDb, 'customers/c1'), { 
        createdBy: 'user_bob',
        updatedAt: serverTimestamp()
      })
    );
  });

  it.skip('11. Email Spoofing — out of scope, document why skipped', () => {
    // security_spec.md mentions this but rules don't enforce verified email; skip until rules add the check
  });

  it('12. Recursive Cost Attack — rejects list query without filter', async () => {
    const aliceDb = aliceContext().firestore();
    // This is essentially the same as test 3 in terms of current rule implementation
    await assertFails(getDocs(collection(aliceDb, 'customers')));
    
    // Demonstrate success with filter
    const q = query(collection(aliceDb, 'customers'), where('createdBy', '==', 'user_alice'));
    await assertSucceeds(getDocs(q));
  });

  it('13. Trade Equity Fields — owner can write all 6 new fields', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/trade1'), validCustomer({
        tradeValueLow: '15000',
        tradeValueHigh: '17000',
        tradeValueSource: 'KBB',
        tradeValueCondition: 'excellent',
        tradeValueAt: new Date().toISOString(),
        customerDesiredTradeValue: '18000'
      }))
    );
  });

  it('14. New Trade Condition Tiers — owner can write all 8 per-condition fields', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/trade2'), validCustomer({
        tradeValueExcellentLow: '18000',
        tradeValueExcellentHigh: '20000',
        tradeValueVeryGoodLow: '17000',
        tradeValueVeryGoodHigh: '19000',
        tradeValueGoodLow: '16000',
        tradeValueGoodHigh: '18000',
        tradeValueFairLow: '14000',
        tradeValueFairHigh: '16000'
      }))
    );
  });

  it('15. Resource Poisoning (TradeValueSource) — rejects > 100 chars', async () => {
    const aliceDb = aliceContext().firestore();
    const longSource = 'a'.repeat(101);
    await assertFails(
      setDoc(doc(aliceDb, 'customers/trade3'), validCustomer({
        tradeValueSource: longSource
      }))
    );
  });

  it('16. Reminders Fields — owner can write valid reminders fields', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/rem1'), validCustomer({
        lastContactedAt: '2026-05-19T20:59:34Z',
        nextCadenceDue: '2026-06-19',
        manualReminders: [
          { date: '2026-05-25', reason: 'Follow up' }
        ]
      }))
    );
  });

  it('17. Reminders Rules — oversized lastContactedAt rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/rem2'), validCustomer({
        lastContactedAt: 'a'.repeat(31)
      }))
    );
  });

  it('18. Reminders Rules — non-list manualReminders rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/rem3'), validCustomer({
        manualReminders: 'not-a-list'
      }))
    );
  });

  it('19. Reminders Rules — list of 51+ manualReminders rejected', async () => {
    const aliceDb = aliceContext().firestore();
    const oversizedList = Array(51).fill({ date: '2026-05-20', reason: 'test' });
    await assertFails(
      setDoc(doc(aliceDb, 'customers/rem4'), validCustomer({
        manualReminders: oversizedList
      }))
    );
  });

  it('20. Contacts subcollection — owner can create, others are rejected', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'customers/c1'), 
        validCustomer({ createdBy: 'user_alice' }));
    });

    const aliceDb = aliceContext().firestore();
    const bobDb = bobContext().firestore();

    // Owner (Alice) can create a contact
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/c1/contacts/con1'), {
        authorId: 'user_alice',
        kinds: ['cadence'],
        note: 'Texted client',
        at: serverTimestamp()
      })
    );

    // Non-owner (Bob) is rejected when trying to create a contact
    await assertFails(
      setDoc(doc(bobDb, 'customers/c1/contacts/con2'), {
        authorId: 'user_bob',
        kinds: ['cadence'],
        note: 'Texted client',
        at: serverTimestamp()
      })
    );

    // Wrong authorId (not self) is rejected even for Owner
    await assertFails(
      setDoc(doc(aliceDb, 'customers/c1/contacts/con3'), {
        authorId: 'user_bob', // Alice tries to forge authorId
        kinds: ['cadence'],
        note: 'Texted',
        at: serverTimestamp()
      })
    );

    // Oversized note is rejected
    await assertFails(
      setDoc(doc(aliceDb, 'customers/c1/contacts/con4'), {
        authorId: 'user_alice',
        kinds: ['cadence'],
        note: 'a'.repeat(1001),
        at: serverTimestamp()
      })
    );
  });

  it('21. New Fields — oversized purchaseDate (> 30 chars) rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/v2_1'), validCustomer({
        purchaseDate: '2026-05-19T21:33:13Z_extra_characters_to_exceed_thirty_characters'
      }))
    );
  });

  it('22. New Fields — unknown field is still rejected on create', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/v2_2'), {
        ...validCustomer(),
        unsupportedField99: 'unsupported'
      })
    );
  });

  it('23. Owner can create a contact with a valid attestedAt string', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'customers/c1'), 
        validCustomer({ createdBy: 'user_alice' }));
    });

    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/c1/contacts/con23'), {
        authorId: 'user_alice',
        kinds: ['cadence'],
        note: 'Texted client',
        at: serverTimestamp(),
        attestedAt: '2026-05-20T00:30:19Z'
      })
    );
  });

  it('24. Contact with attestedAt > 30 chars is rejected', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'customers/c1'), 
        validCustomer({ createdBy: 'user_alice' }));
    });

    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/c1/contacts/con24'), {
        authorId: 'user_alice',
        kinds: ['cadence'],
        note: 'Texted client',
        at: serverTimestamp(),
        attestedAt: '2026-05-20T00:30:19Z_extra_characters_to_exceed_thirty_characters'
      })
    );
  });

  it('25. Valid leadSource and leadGeneratedDate and pendingInterestNotes accepted', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/lead25'), validCustomer({
        leadSource: 'Showroom Floor / Manual / Walk-In',
        leadGeneratedDate: '2025-05-31',
        pendingInterestNotes: 'Also interested in 2017 Ram 1500 (Used)'
      }))
    );
  });

  it('26. leadSource over 200 chars rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/lead26'), validCustomer({
        leadSource: 'x'.repeat(201)
      }))
    );
  });

  it('27. leadGeneratedDate over 20 chars rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/lead27'), validCustomer({
        leadGeneratedDate: '2025-05-31T00:00:00.000Z_extra'
      }))
    );
  });

  it('28. pendingInterestNotes over 500 chars rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/lead28'), validCustomer({
        pendingInterestNotes: 'x'.repeat(501)
      }))
    );
  });

  it('29. leadSource of wrong type (number) rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/lead29'), validCustomer({
        leadSource: 12345 as unknown as string
      }))
    );
  });

  it('30. status="sold" accepted on create', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/v30'), validCustomer({
        status: 'sold'
      }))
    );
  });

  it('31. status="active" (legacy value) rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/v31'), validCustomer({
        status: 'active' as unknown as 'lead'
      }))
    );
  });

  it('32. Valid leadSourceType accepted', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/v32'), validCustomer({
        leadSourceType: 'walk-in'
      }))
    );
  });

  it('33. leadSourceType over 30 chars rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/v33'), validCustomer({
        leadSourceType: 'x'.repeat(31)
      }))
    );
  });

  it('34. Valid contactChannel accepted', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/v34'), validCustomer({
        contactChannel: 'text'
      }))
    );
  });

  it('35. contactChannel over 30 chars rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/v35'), validCustomer({
        contactChannel: 'x'.repeat(31)
      }))
    );
  });

  it('36. Valid tradeIsBLine and tradeStockNumber accepted', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/v36'), validCustomer({
        tradeIsBLine: true,
        tradeStockNumber: '6EL917A'
      }))
    );
  });

  it('37. tradeStockNumber over 20 chars rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/v37'), validCustomer({
        tradeStockNumber: 'x'.repeat(21)
      }))
    );
  });

  it('38. tradeIsBLine must be a boolean', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/v38'), validCustomer({
        tradeIsBLine: 'yes'
      }))
    );
  });

  it('39. Valid tradeCheckIn map accepted', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'customers/v39'), validCustomer({
        tradeCheckIn: { equipment: ['AWD', '4 Doors', 'Leather'], unsure: ['Tow Package'], engine: '3.5L V6', extColor: 'White' }
      }))
    );
  });

  it('40. tradeCheckIn equipment list over 150 entries rejected', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/v40'), validCustomer({
        tradeCheckIn: { equipment: Array.from({ length: 151 }, (_, i) => `Box ${i}`), unsure: [] }
      }))
    );
  });

  it('41. tradeCheckIn must be a map with list fields', async () => {
    const aliceDb = aliceContext().firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'customers/v41'), validCustomer({
        tradeCheckIn: { equipment: 'AWD', unsure: [] }
      }))
    );
  });
  // --- Rules evaluation budget ---
  // Firestore evaluates at most 1000 expressions per rule. A dealer's real
  // customer doc has most of these keys populated; before the validator was
  // rewritten in the cheap `data.get('x', '').size() <= N` form, ~40 populated
  // keys was enough to be denied with "maximum of 1000 expressions". This test
  // populates EVERY key the create rule allows and must keep passing.
  it('42. fully populated customer (every allowed key) creates and updates within the rules budget', async () => {
    const keyList = readFileSync('firestore.rules', 'utf8').match(/keys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
    if (!keyList) throw new Error('create rule hasOnly list not found');
    const keys = [...keyList[1].matchAll(/'(\w+)'/g)].map(m => m[1]);
    if (keys.length < 60) throw new Error(`expected the full key list, got ${keys.length}`);
    const bools = new Set(['hasTradeIn', 'stillOwe', 'payingCash', 'working', 'tradeIsBLine']);
    const full: Record<string, unknown> = {};
    for (const k of keys) {
      if (bools.has(k)) full[k] = true;
      else if (k === 'createdBy') full[k] = 'user_alice';
      else if (k === 'createdAt' || k === 'updatedAt') full[k] = serverTimestamp();
      else if (k === 'status') full[k] = 'lead';
      else if (k === 'manualReminders') full[k] = [{ date: '2026-10-01', reason: 'call' }];
      else if (k === 'creditApp') full[k] = { creditType: 'joint-spousal', applicant: { employer: 'Acme', yearsAtAddress: '3' }, hasCoApplicant: true, coApplicant: { firstName: 'John', lastName: 'Doe' }, references: [{ name: 'Mom', whose: 'A' }] };
      else if (k === 'payoffLender') full[k] = { lenderId: 'abc', phone: '888-925-2559', address: '4000 Monroe Rd', city: 'Charlotte', state: 'NC', zip: '28205' };
      else if (k === 'tradeCheckIn') full[k] = {
        equipment: Array.from({ length: 60 }, (_, i) => `Box ${i}`), unsure: ['A', 'B'],
        engine: '3.5L V6', cylinders: '6', transmissionSpeeds: '10', extColor: 'White', intColor: 'Black',
        premiumAudioBrand: 'Bose', smartphoneAppName: 'FordPass', trim: 'XLT', sources: 'ford.com', lookedUpAt: '2026-09-20T00:00:00.000Z',
      };
      else full[k] = '2023'; // short enough for every string cap
    }
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(setDoc(doc(aliceDb, 'customers/full'), full));
    await assertSucceeds(updateDoc(doc(aliceDb, 'customers/full'), { phone: '555-000-0000', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(aliceDb, 'customers/full'), {
      tradeCheckIn: { ...(full.tradeCheckIn as object), extColor: 'Red' }, updatedAt: serverTimestamp(),
    }));
  });
  // --- Payoff sheet fields on the customer ---
  it('43. payoffLender must be a small map; per-deal payoff strings are size-capped', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(setDoc(doc(aliceDb, 'customers/p1'), validCustomer({
      payoffLender: { lenderId: 'x', phone: '888', address: '1 Main St', city: 'Akron', state: 'OH', zip: '44301' },
      payoffAccountNumber: 'ACCT-1', payoffPerDiem: '3.10', payoff20Day: '18250.50',
    })));
    await assertFails(setDoc(doc(aliceDb, 'customers/p2'), validCustomer({ payoffLender: 'Ally' })));
    await assertFails(setDoc(doc(aliceDb, 'customers/p3'), validCustomer({ payoffAccountNumber: 'x'.repeat(51) })));
    await assertFails(setDoc(doc(aliceDb, 'customers/p4'), validCustomer({ payoff20Day: 'x'.repeat(21) })));
  });

  // --- Shared lender library ---
  const validLender = (overrides = {}) => ({
    name: 'Ally Financial', nameKey: 'ally financial', phone: '888-925-2559',
    address: '4000 Monroe Rd', city: 'Charlotte', state: 'NC', zip: '28205',
    sources: 'ally.com', verified: true, createdBy: 'user_alice',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides,
  });

  it('44. any signed-in dealer can add a lender; anonymous cannot; createdBy cannot be spoofed', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(setDoc(doc(aliceDb, 'lenders/l1'), validLender()));
    await assertFails(setDoc(doc(anonContext().firestore(), 'lenders/l2'), validLender()));
    await assertFails(setDoc(doc(aliceDb, 'lenders/l3'), validLender({ createdBy: 'user_bob' })));
    await assertFails(setDoc(doc(aliceDb, 'lenders/l4'), validLender({ name: '' })));
    await assertFails(setDoc(doc(aliceDb, 'lenders/l5'), validLender({ address: 'x'.repeat(201) })));
    await assertFails(setDoc(doc(aliceDb, 'lenders/l6'), validLender({ routing: '123' })));
  });

  it('45. the library is shared: another dealer reads and corrects a lender, but cannot change createdBy', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'lenders/l1'), validLender());
    });
    const bobDb = bobContext().firestore();
    await assertSucceeds(getDocs(query(collection(bobDb, 'lenders'))));
    await assertSucceeds(updateDoc(doc(bobDb, 'lenders/l1'), { phone: '800-000-0000', verified: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(bobDb, 'lenders/l1'), { createdBy: 'user_bob' }));
    await assertFails(updateDoc(doc(bobDb, 'lenders/l1'), { verified: 'yes' }));
    await assertFails(getDocs(query(collection(anonContext().firestore(), 'lenders'))));
  });
  // --- Credit application ---
  it('46. creditApp is one map and can never carry an SSN', async () => {
    const aliceDb = aliceContext().firestore();
    await assertSucceeds(setDoc(doc(aliceDb, 'customers/ca1'), validCustomer({
      creditApp: { creditType: 'individual', applicant: { employer: 'Acme', grossMonthlySalary: '4500' }, hasCoApplicant: false, references: [{ name: 'Mom', phone: '555', whose: 'A' }] },
    })));
    await assertFails(setDoc(doc(aliceDb, 'customers/ca2'), validCustomer({ creditApp: 'individual' })));
    await assertFails(setDoc(doc(aliceDb, 'customers/ca3'), validCustomer({ creditApp: { applicant: { ssn: '123-45-6789' } } })));
    await assertFails(setDoc(doc(aliceDb, 'customers/ca4'), validCustomer({ creditApp: { hasCoApplicant: true, coApplicant: { firstName: 'J', ssn: '987-65-4321' } } })));
    await assertFails(setDoc(doc(aliceDb, 'customers/ca5'), validCustomer({ creditApp: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 } })));
  });
});



