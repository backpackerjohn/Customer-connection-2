import { 
  collection, addDoc, query, where, onSnapshot, 
  serverTimestamp, Unsubscribe, collectionGroup
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Note } from '../types';

/**
 * Creates a new note for a specific customer.
 */
export async function createNote(
  customerId: string,
  note: Omit<Note, 'id' | 'createdAt'>
): Promise<void> {
  await addDoc(collection(db, 'customers', customerId, 'notes'), {
    ...note,
    createdAt: serverTimestamp()
  });
}

/**
 * Subscribes to notes for a customer, filtered by author.
 * Returns the Firebase Unsubscribe function.
 */
export function subscribeToNotes(
  customerId: string,
  authorId: string,
  onChange: (notes: Note[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, 'customers', customerId, 'notes'),
    where('authorId', '==', authorId)
  );
  
  return onSnapshot(q, 
    (snapshot) => {
      const data = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Note))
        .sort((a, b) => 
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
      onChange(data);
    },
    onError
  );
}

/**
 * Subscribes to all notes authored by the specified user across all customers.
 * Returns each note carrying its parent customer ID.
 */
export function subscribeToAllNotes(
  uid: string,
  onChange: (notes: { id: string; content: string; customerId: string }[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const q = query(
    collectionGroup(db, 'notes'),
    where('authorId', '==', uid)
  );
  
  return onSnapshot(q,
    (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const parentId = doc.ref.parent?.parent?.id || '';
        const d = doc.data();
        return {
          id: doc.id,
          content: (d.content as string) || '',
          customerId: parentId
        };
      });
      onChange(data);
    },
    onError
  );
}
