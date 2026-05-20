import { 
  collection, addDoc, updateDoc, doc, query, where, 
  onSnapshot, serverTimestamp, Unsubscribe 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Customer } from '../types';
import { rollNextCadence } from '../lib/reminders/engine';
import { REMINDER_CONFIG } from '../lib/reminders/config';

/**
 * Creates a new customer document in Firestore.
 * Strips `id` and any undefined fields, sets createdBy/createdAt/updatedAt to server values.
 * Returns the new document id.
 */
export async function createCustomer(
  uid: string, 
  customer: Customer
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...customerData } = customer;
  
  const initialCadenceDue = customer.nextCadenceDue || rollNextCadence(new Date(), 'lead', REMINDER_CONFIG);

  // Create a clean object for Firestore (optional: could filter undefined)
  const docRef = await addDoc(collection(db, 'customers'), {
    ...customerData,
    nextCadenceDue: initialCadenceDue,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Updates an existing customer document in Firestore.
 * CRITICAL: strips `id`, `createdAt`, and `createdBy` before write. 
 * Firestore rules reject `id` as a writable field, and treat `createdAt`/`createdBy` as immutable.
 */
export async function updateCustomer(
  customerId: string, 
  customer: Customer
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, createdBy, ...customerData } = customer;
  
  const payload = { ...customerData, updatedAt: 'SERVER_TIMESTAMP_SENTINEL' };

  console.group('🔍 updateCustomer DEBUG');
  console.log('customerId:', customerId);
  console.log('current uid:', auth.currentUser?.uid);
  console.log('payload field count:', Object.keys(payload).length);
  console.log('payload keys:', Object.keys(payload).sort());
  console.log('payload JSON:', JSON.stringify(payload, null, 2));
  console.log('field types:', Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [
      k, 
      v === null ? 'NULL' : v === undefined ? 'UNDEFINED' : typeof v
    ])
  ));
  console.groupEnd();

  try {
    await updateDoc(doc(db, 'customers', customerId), {
      ...customerData,
      updatedAt: serverTimestamp()
    });
    console.log('✅ updateDoc succeeded');
  } catch (err) {
    console.error('❌ updateDoc threw:', err);
    throw err;
  }
}

/**
 * Subscribes to all customers owned by uid.
 * Returns the Firebase Unsubscribe function.
 */
export function subscribeToCustomers(
  uid: string,
  onChange: (customers: Customer[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, 'customers'),
    where('createdBy', '==', uid)
  );
  
  return onSnapshot(q, 
    (snapshot) => {
      const data = snapshot.docs.map(d => 
        ({ id: d.id, ...d.data() } as Customer)
      );
      onChange(data);
    }, 
    onError
  );
}
