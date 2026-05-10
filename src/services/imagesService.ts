import { 
  ref, uploadBytes, getDownloadURL, getMetadata, deleteObject 
} from 'firebase/storage';
import { storage } from '../lib/firebase';

export type CustomerImageType = 'license' | 'insurance';

export async function uploadCustomerImage(
  userId: string,
  customerId: string,
  type: CustomerImageType,
  file: File
): Promise<string> {
  const ext = (file.type === 'image/png') ? 'png' : 'jpg';
  const path = `customer-images/${userId}/${customerId}/${type}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return await getDownloadURL(storageRef);
}

export async function getBlankFormUrl(formName: string): Promise<string> {
  const storageRef = ref(storage, `forms/${formName}`);
  return await getDownloadURL(storageRef);
}

export interface FormFileMetadata {
  exists: boolean;
  updated?: Date;
  sizeBytes?: number;
}

export async function uploadFormFile(
  filename: string, file: File
): Promise<void> {
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are accepted.');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('File too large (max 25 MB).');
  }
  const storageRef = ref(storage, `forms/${filename}`);
  await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
}

export async function deleteFormFile(filename: string): Promise<void> {
  const storageRef = ref(storage, `forms/${filename}`);
  await deleteObject(storageRef);
}

export async function getFormFileMetadata(
  filename: string
): Promise<FormFileMetadata> {
  try {
    const storageRef = ref(storage, `forms/${filename}`);
    const meta = await getMetadata(storageRef);
    return {
      exists: true,
      updated: meta.updated ? new Date(meta.updated) : undefined,
      sizeBytes: meta.size,
    };
  } catch (err) {
    const code = (err && typeof err === 'object' && 'code' in err) ? (err as { code: string }).code : 'unknown';
    console.warn(`[getFormFileMetadata] failed for forms/${filename}: code=${code}`, err);
    return { exists: false };
  }
}
