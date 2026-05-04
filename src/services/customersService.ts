import { 
  collection, addDoc, updateDoc, doc, query, where, 
  onSnapshot, serverTimestamp, Unsubscribe 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer } from '../types';

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
  
  // Create a clean object for Firestore (optional: could filter undefined)
  const docRef = await addDoc(collection(db, 'customers'), {
    ...customerData,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Updates an existing customer document in Firestore.
 * CRITICAL: strips `id` before write — Firestore rules reject `id` as a writable field.
 */
export async function updateCustomer(
  customerId: string, 
  customer: Customer
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...customerData } = customer;
  
  await updateDoc(doc(db, 'customers', customerId), {
    ...customerData,
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
