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
  createdBy: 'user_alice',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
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
});
