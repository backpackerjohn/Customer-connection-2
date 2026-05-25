import { 
  collection, addDoc, updateDoc, doc, query, where, 
  onSnapshot, serverTimestamp, Unsubscribe 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  customer: Customer,
  lastSaved?: Customer
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, createdBy, ...customerData } = customer;
  
  let dataToUpdate: Record<string, unknown> = {};
  if (lastSaved) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, createdAt: __, createdBy: ___, ...lastSavedData } = lastSaved;
    
    const allKeys = new Set([...Object.keys(customerData), ...Object.keys(lastSavedData)]) as Set<keyof typeof customerData>;
    for (const key of allKeys) {
      if (key === 'updatedAt') continue;
      
      const newVal = customerData[key];
      const oldVal = lastSavedData[key];
      
      let changed = false;
      if (key === 'manualReminders') {
        if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
          changed = true;
        }
      } else {
        if (newVal !== oldVal) {
          changed = true;
        }
      }
      
      if (changed) {
        dataToUpdate[key] = newVal === undefined ? null : newVal;
      }
    }
  } else {
    dataToUpdate = customerData;
  }
  
  await updateDoc(doc(db, 'customers', customerId), {
    ...dataToUpdate,
    updatedAt: serverTimestamp()
  });
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
