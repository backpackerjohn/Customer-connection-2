import { collection, addDoc, doc, updateDoc, onSnapshot, serverTimestamp, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Lender } from '../types';
import { stripUndefined } from '../lib/lenders';

/**
 * Chokepoint for the shared `lenders` collection (the payoff lender library).
 * Every signed-in dealer reads and writes the same list; see firestore.rules.
 */

export function subscribeToLenders(onChange: (lenders: Lender[]) => void, onError: (error: unknown) => void): Unsubscribe {
  return onSnapshot(collection(db, 'lenders'),
    snapshot => {
      const data = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Lender))
        .sort((a, b) => a.name.localeCompare(b.name));
      onChange(data);
    },
    onError
  );
}

export async function createLender(lender: Omit<Lender, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'lenders'), {
    ...stripUndefined(lender),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLender(id: string, patch: Partial<Omit<Lender, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  await updateDoc(doc(db, 'lenders', id), { ...stripUndefined(patch), updatedAt: serverTimestamp() });
}
