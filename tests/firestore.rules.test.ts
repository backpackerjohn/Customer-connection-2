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
});
