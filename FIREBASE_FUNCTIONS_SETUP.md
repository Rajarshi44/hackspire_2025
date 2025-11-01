# Firebase Functions Setup Guide

## Overview

Firebase Cloud Functions for AI-powered issue resolution. This setup enables your frontend to trigger AI code generation by calling a secure, authenticated Cloud Function.

## Architecture

```
Frontend (React) → requestAIForIssue (Cloud Function) → Firestore Job Document → MCP API
```

## Setup Steps

### 1. Install Firebase CLI (if not already installed)

```powershell
npm install -g firebase-tools
```

### 2. Login to Firebase

```powershell
firebase login
```

### 3. Initialize Firebase (if not already done)

```powershell
firebase init
```

Select:
- **Functions**: Configure Cloud Functions
- **Firestore**: If not already configured
- Choose your existing project or create a new one
- Select **TypeScript**
- Use **ESLint**: Yes
- Install dependencies: Yes

### 4. Configure MCP URL

#### For Local Development

Create `functions/.env`:

```bash
MCP_URL=http://localhost:9002
```

#### For Production

Set Firebase Functions config:

```powershell
firebase functions:config:set mcp.url="https://your-production-domain.com"
```

Verify configuration:

```powershell
firebase functions:config:get
```

### 5. Build and Test Locally

```powershell
cd functions
npm run build
```

Test with Firebase Emulator:

```powershell
npm run serve
```

This starts the Functions emulator on http://localhost:5001

### 6. Deploy to Firebase

```powershell
npm run deploy
```

Or from project root:

```powershell
firebase deploy --only functions
```

### 7. Verify Deployment

Check Firebase Console:
- Go to https://console.firebase.google.com
- Select your project
- Navigate to **Functions** section
- Verify `requestAIForIssue`, `healthCheck`, and `onMCPJobUpdate` are deployed

Test health check:

```powershell
$region = "us-central1"  # Your Firebase region
$projectId = "your-project-id"
Invoke-RestMethod -Uri "https://$region-$projectId.cloudfunctions.net/healthCheck"
```

## Frontend Integration

### Using Firebase SDK

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const requestAIForIssue = httpsCallable(functions, 'requestAIForIssue');

// Call the function
const result = await requestAIForIssue({
  repoId: 'repo123',
  issueId: 'issue456',
  issueNumber: 42,
  owner: 'Rajarshi44',
  repo: 'hackspire_2025',
  relatedFiles: ['src/app/page.tsx', 'src/lib/utils.ts'] // Optional
});

console.log(result.data);
// {
//   success: true,
//   jobId: 'auto-generated-id',
//   status: 'pending',
//   message: 'AI code generation request submitted successfully',
//   issueId: 'issue456',
//   mcpEndpoint: 'http://localhost:9002/api/mcp/generate-code'
// }
```

### React Component Example

```tsx
import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '@/lib/auth';

export function AIRequestButton({ repoId, issueId, issueNumber, owner, repo }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);

  const handleRequestAI = async () => {
    if (!user) {
      alert('Please login first');
      return;
    }

    setLoading(true);
    try {
      const functions = getFunctions();
      const requestAIForIssue = httpsCallable(functions, 'requestAIForIssue');
      
      const result = await requestAIForIssue({
        repoId,
        issueId,
        issueNumber,
        owner,
        repo
      });

      setJobId(result.data.jobId);
      alert(`AI request submitted! Job ID: ${result.data.jobId}`);
    } catch (error) {
      console.error('Error requesting AI:', error);
      alert(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleRequestAI} disabled={loading}>
      {loading ? 'Requesting...' : 'Request AI Assistance'}
    </button>
  );
}
```

## Firestore Structure

Jobs are stored at:

```
/repos/{repoId}/mcp_jobs/{jobId}
```

Document fields:
```typescript
{
  issueId: string;
  issueNumber: number;
  owner: string;
  repo: string;
  requested_by: string; // User UID
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  relatedFiles?: string[]; // Optional
  error?: string; // If status === 'failed'
}
```

## Monitoring Jobs

### Listen to Job Updates in Frontend

```typescript
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';

function monitorJob(repoId: string, jobId: string) {
  const jobRef = doc(db, `repos/${repoId}/mcp_jobs/${jobId}`);
  
  const unsubscribe = onSnapshot(jobRef, (snapshot) => {
    const job = snapshot.data();
    console.log('Job status:', job?.status);
    
    if (job?.status === 'completed') {
      console.log('AI code generation completed!');
      // Refresh PR list or show notification
    } else if (job?.status === 'failed') {
      console.error('Job failed:', job?.error);
    }
  });

  return unsubscribe; // Call this to stop listening
}
```

### View Logs

```powershell
# View all logs
firebase functions:log

# View specific function logs
firebase functions:log --only requestAIForIssue

# Tail logs (follow mode)
firebase functions:log --only requestAIForIssue --limit 50
```

## Security Rules

Ensure Firestore security rules allow authenticated users to read/write their job documents:

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /repos/{repoId}/mcp_jobs/{jobId} {
      // Users can create their own jobs
      allow create: if request.auth != null 
                    && request.resource.data.requested_by == request.auth.uid;
      
      // Users can read their own jobs
      allow read: if request.auth != null 
                  && resource.data.requested_by == request.auth.uid;
      
      // Only server can update job status (via Cloud Functions)
      allow update: if false;
    }
  }
}
```

## Troubleshooting

### Function Not Responding

1. Check Firebase Functions logs:
   ```powershell
   firebase functions:log
   ```

2. Verify MCP_URL is configured:
   ```powershell
   firebase functions:config:get
   ```

3. Test locally with emulator:
   ```powershell
   cd functions
   npm run serve
   ```

### Authentication Errors

- Ensure user is logged in before calling function
- Check Firebase Authentication is enabled in console
- Verify security rules allow the operation

### MCP Endpoint Unreachable

- Verify MCP service is running on configured URL
- Check network connectivity
- Review MCP endpoint logs

## Environment Variables

### Local Development (.env)

```bash
MCP_URL=http://localhost:9002
```

### Production (Firebase Config)

```powershell
firebase functions:config:set mcp.url="https://your-domain.com"
```

## Deployed Functions

1. **requestAIForIssue** (Callable)
   - Authenticates user
   - Creates Firestore job document
   - Triggers MCP code generation
   - Returns job ID for tracking

2. **healthCheck** (HTTP)
   - Simple health check endpoint
   - Returns service status and timestamp

3. **onMCPJobUpdate** (Firestore Trigger)
   - Monitors job status changes
   - Logs status updates
   - Extensible for notifications/webhooks

## Next Steps

1. **Configure MCP_URL** for your environment
2. **Deploy functions**: `npm run deploy`
3. **Update frontend** to call `requestAIForIssue`
4. **Set up Firestore listeners** to monitor job status
5. **Configure security rules** for production

## Resources

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Cloud Functions for Firebase](https://firebase.google.com/docs/functions/callable)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
