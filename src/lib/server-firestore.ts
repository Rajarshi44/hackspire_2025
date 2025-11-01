import admin from 'firebase-admin';

// Mock Firestore for local testing when no credentials available
const USE_MOCK = process.env.USE_MOCK_FIRESTORE === 'true';
const mockStore = new Map<string, any>();

class MockCollectionRef {
  constructor(private collectionPath: string) {}
  
  doc(docId?: string) {
    const path = docId ? `${this.collectionPath}/${docId}` : `${this.collectionPath}/mock-${Date.now()}`;
    return new MockDocRef(path);
  }
  
  async add(data: any) {
    const docId = `mock-${Date.now()}`;
    const ref = this.doc(docId);
    await ref.set(data);
    return ref;
  }
  
  where() {
    // Return a mock query that returns empty results
    return {
      get: async () => ({
        empty: true,
        docs: [],
      }),
    };
  }
}

class MockDocRef {
  constructor(private path: string) {}
  
  collection(collectionName: string) {
    return new MockCollectionRef(`${this.path}/${collectionName}`);
  }
  
  async set(data: any) {
    mockStore.set(this.path, { ...data, _createdAt: new Date() });
    console.log(`[MOCK] Set ${this.path}:`, data);
  }
  
  async update(updates: any) {
    const existing = mockStore.get(this.path) || {};
    mockStore.set(this.path, { ...existing, ...updates, _updatedAt: new Date() });
    console.log(`[MOCK] Update ${this.path}:`, updates);
  }
  
  async get() {
    return { exists: mockStore.has(this.path), data: () => mockStore.get(this.path) };
  }
}

class MockFirestore {
  collection(name: string) {
    return new MockCollectionRef(name);
  }
  
  doc(path: string) {
    return new MockDocRef(path);
  }
}

// Initialize the Admin SDK once per server process
function initAdmin() {
  if (USE_MOCK) {
    console.log('🔶 Using MOCK Firestore (no real Firebase connection)');
    return null; // Return null to signal mock mode
  }

  if (!admin.apps.length) {
    // Prefer explicit service account JSON in env var FIREBASE_SERVICE_ACCOUNT
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

    try {
      if (serviceAccountJson && serviceAccountJson.length > 0) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log('✅ Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT');
      } else if (googleAppCreds && googleAppCreds.length > 0) {
        // Fall back to application default credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS)
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
        console.log('✅ Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS');
      } else {
        // Auto-enable mock mode when no credentials
        console.log('🔶 No Firebase credentials found. Using MOCK Firestore for local testing.');
        console.log('   To use real Firebase, set FIREBASE_SERVICE_ACCOUNT in .env.local');
        console.log('   To explicitly enable mock: USE_MOCK_FIRESTORE=true');
        return null; // Return null to signal mock mode
      }
    } catch (e: any) {
      // If initialization fails, fall back to mock
      console.warn('⚠️ Firebase Admin initialization failed, using MOCK Firestore:', e.message);
      return null;
    }
  }

  return admin;
}

export function getFirestore() {
  const a = initAdmin();
  if (!a) {
    console.log('[MOCK] Returning mock Firestore instance');
    return new MockFirestore() as any; // Return mock when admin is null
  }
  try {
    return a.firestore();
  } catch (error: any) {
    console.error('Failed to get Firestore instance:', error.message);
    console.log('[MOCK] Falling back to mock Firestore');
    return new MockFirestore() as any;
  }
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

export const serverTimestamp = () => {
  if (USE_MOCK) {
    return new Date().toISOString();
  }
  return admin.firestore.FieldValue.serverTimestamp();
};

export default {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
};
