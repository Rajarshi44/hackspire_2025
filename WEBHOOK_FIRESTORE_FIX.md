# GitHub Webhook Firestore Error Fix

## Problem
The GitHub webhook endpoint was returning the error:
```
{"error":"Internal server error","message":"(0 , u.aU)(...).collection is not a function"}
```

This error indicates that the Firestore instance returned by `getFirestore()` doesn't have the `.collection()` method, which suggests either:
1. Firebase Admin SDK is not properly initialized on Vercel
2. The mock Firestore fallback was being used but missing required methods
3. Environment variables are not properly configured on Vercel

## Root Causes

### 1. Incomplete Mock Firestore Implementation
The `MockFirestore` class in `src/lib/server-firestore.ts` was missing:
- `collection()` method
- `MockCollectionRef` class for handling collection operations
- Query methods like `where()` and `get()`

### 2. Missing Environment Variables on Vercel
The Firebase Admin SDK requires the `FIREBASE_SERVICE_ACCOUNT` environment variable to be set with the full service account JSON.

### 3. No Error Handling for Firestore Initialization
The webhook handlers didn't validate that Firestore was properly initialized before attempting to use it.

## Solutions Applied

### 1. Enhanced Mock Firestore Classes
Updated `src/lib/server-firestore.ts` with complete mock implementations:

```typescript
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
  // Added collection() method
  collection(collectionName: string) {
    return new MockCollectionRef(`${this.path}/${collectionName}`);
  }
  // ... existing methods
}

class MockFirestore {
  // Added collection() method
  collection(name: string) {
    return new MockCollectionRef(name);
  }
  // ... existing methods
}
```

### 2. Added Firestore Validation in Webhook Handlers
All helper functions now validate Firestore before use:

```typescript
async function findMCPJobByPR(repoId: string, prNumber: number) {
  try {
    const db = getFirestore();
    
    // Validate Firestore instance
    if (!db || typeof db.collection !== 'function') {
      console.error('Invalid Firestore instance - collection method not available');
      return null;
    }
    
    // Continue with normal operations...
  } catch (error: any) {
    console.error('Error finding MCP job:', error.message, error.stack);
    return null;
  }
}
```

### 3. Added Diagnostic GET Endpoint
The webhook now has a GET endpoint for debugging:

```bash
curl https://devx-rho.vercel.app/api/webhooks/github
```

Returns diagnostic information about Firestore initialization and configuration.

### 4. Improved Error Handling
- Non-critical operations (like chat notifications) now gracefully handle Firestore errors
- Better logging with error messages and stack traces
- Fallback behavior when Firestore is not available

## Vercel Environment Variable Configuration

To fix the Firestore initialization on Vercel, you need to set these environment variables:

### Required Variables

1. **FIREBASE_SERVICE_ACCOUNT**
   ```
   Set to the complete Firebase service account JSON (minified)
   Example: {"type":"service_account","project_id":"your-project",...}
   ```

2. **GITHUB_WEBHOOK_SECRET**
   ```
   Set to: gH9$zT!vQ3@rL7#xW2^mN0*bE8&uK5%p
   ```

### How to Set Environment Variables on Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `FIREBASE_SERVICE_ACCOUNT` | Your service account JSON | Production, Preview |
   | `GITHUB_WEBHOOK_SECRET` | `gH9$zT!vQ3@rL7#xW2^mN0*bE8&uK5%p` | Production, Preview |

4. Click **Save**
5. Redeploy your application

### Getting Firebase Service Account JSON

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`studio-1512856463-cb519`)
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Minify it (remove all whitespace): `cat service-account.json | jq -c`
7. Copy the minified JSON to Vercel environment variable

## Testing the Fix

### 1. Test Diagnostic Endpoint
```bash
curl https://devx-rho.vercel.app/api/webhooks/github
```

Expected response:
```json
{
  "message": "GitHub webhook endpoint is active",
  "method": "POST",
  "diagnostics": {
    "firestoreInitialized": true,
    "hasCollectionMethod": true,
    "webhookSecretConfigured": true,
    "firebaseServiceAccountConfigured": true,
    "useMockFirestore": false,
    "nodeEnv": "production"
  }
}
```

### 2. Trigger a Test Webhook
Push a commit to your repository and check:
1. Vercel function logs
2. GitHub webhook delivery page
3. Application behavior

## Fallback Behavior

If Firebase credentials are not configured:
- The system will use Mock Firestore
- Webhook events will be processed but not persisted
- Console logs will indicate mock mode: `[MOCK] Returning mock Firestore instance`
- The application will continue to work (no errors) but without database persistence

## Monitoring

Check these locations for debugging:

1. **Vercel Function Logs**
   - Go to your deployment → **Functions** tab
   - View real-time logs for `/api/webhooks/github`

2. **GitHub Webhook Deliveries**
   - Repository → Settings → Webhooks
   - Click on your webhook
   - View recent deliveries and responses

3. **Console Logs**
   Look for these key messages:
   - ✅ `Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT`
   - ✅ `GitHub signature verified`
   - ❌ `Invalid Firestore instance - collection method not available`
   - 🔶 `Using MOCK Firestore`

## Next Steps

1. ✅ Set `FIREBASE_SERVICE_ACCOUNT` on Vercel
2. ✅ Set `GITHUB_WEBHOOK_SECRET` on Vercel
3. ✅ Redeploy the application
4. ✅ Test the diagnostic endpoint
5. ✅ Trigger a test webhook (push a commit)
6. ✅ Verify webhook processing in logs
7. ✅ Confirm Firestore updates in Firebase Console

## Related Files
- `src/lib/server-firestore.ts` - Firebase Admin initialization and mock implementation
- `src/app/api/webhooks/github/route.ts` - Webhook handler with validation
- `.env.local` - Local environment variables (not committed)
- `VERCEL_DEPLOYMENT_GUIDE.md` - General Vercel deployment instructions
