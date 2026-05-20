import { 
  collection, addDoc, query, where, onSnapshot, 
  serverTimestamp, Unsubscribe 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { FirestoreTimestamp } from '../types';
import { ReminderKind } from '../lib/reminders/engine';

export interface Contact {
  id?: string;
  at: FirestoreTimestamp;
  kinds: ReminderKind[];
  note?: string;
  authorId: string;
  attestedAt?: string;  // ISO date — dealer's claimed text date, for backfill
}

/**
 * Creates a new contact record for a specific customer.
 */
export async function createContact(
  customerId: string,
  contact: Omit<Contact, 'id' | 'at'>
): Promise<string> {
  const path = `customers/${customerId}/contacts`;
  try {
    const { ...cleanContact } = contact;
    const docRef = await addDoc(collection(db, 'customers', customerId, 'contacts'), {
      ...cleanContact,
      at: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Subscribes to contact records for a customer, filtered by author.
 * Returns the Firebase Unsubscribe function.
 */
export function subscribeToContacts(
  customerId: string,
  uid: string,
  onChange: (contacts: Contact[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `customers/${customerId}/contacts`;
  const q = query(
    collection(db, 'customers', customerId, 'contacts'),
    where('authorId', '==', uid)
  );
  
  return onSnapshot(q, 
    (snapshot) => {
      const data = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Contact))
        .sort((a, b) => 
          (b.at?.seconds || 0) - (a.at?.seconds || 0)
        );
      onChange(data);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrappedErr) {
        onError(wrappedErr);
        return;
      }
      onError(error);
    }
  );
}
