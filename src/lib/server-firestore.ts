import admin from 'firebase-admin';

// Initialize the Admin SDK once per server process
function initAdmin() {
  if (!admin.apps.length) {
    // Prefer explicit service account JSON in env var FIREBASE_SERVICE_ACCOUNT
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    try {
      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else {
        // Fall back to application default credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS)
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
      }
    } catch (e) {
      // If initialization fails, log for visibility and rethrow
      console.error('Failed to initialize firebase-admin:', e);
      throw e;
    }
  }

  return admin;
}

export function getFirestore() {
  const a = initAdmin();
  return a.firestore();
}

// Compatibility helpers that mimic the client SDK signatures used in server code.
export function doc(firestore: any, ...pathParts: string[]) {
  const path = pathParts.join('/');
  return firestore.doc(path);
}

export async function setDoc(ref: any, data: any) {
  // admin SDK set returns a Promise<void>
  return ref.set(data);
}

export async function updateDoc(ref: any, updates: any) {
  return ref.update(updates);
}

export const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

export default {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
};
