import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, where,
  onSnapshot, serverTimestamp, Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Todo } from '../types';

const COLLECTION = 'todos';

export async function createTodo(
  uid: string,
  input: { text: string; customerId?: string; customerName?: string }
): Promise<string> {
  const data: Record<string, unknown> = {
    text: input.text,
    done: false,
    createdBy: uid,
    createdAt: serverTimestamp(),
    completedAt: null,
  };
  if (input.customerId) data.customerId = input.customerId;
  if (input.customerName) data.customerName = input.customerName;
  const ref = await addDoc(collection(db, COLLECTION), data);
  return ref.id;
}

export function subscribeToTodos(
  uid: string,
  onChange: (todos: Todo[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(db, COLLECTION), where('createdBy', '==', uid));
  return onSnapshot(q,
    (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Todo))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      onChange(data);
    },
    onError
  );
}

export async function setTodoDone(todoId: string, done: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTION, todoId), {
    done,
    completedAt: done ? serverTimestamp() : null,
  });
}

export async function updateTodoText(todoId: string, text: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, todoId), { text });
}

export async function deleteTodo(todoId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, todoId));
}
