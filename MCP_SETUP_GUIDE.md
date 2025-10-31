# MCP Code Generation Endpoint - Setup Guide

## 🚀 Quick Setup

### 1. Generate GitHub Token

1. Go to **GitHub Settings** → **Developer Settings** → **Personal Access Tokens** → **Tokens (classic)**
   - Direct link: https://github.com/settings/tokens/new

2. Click **"Generate new token (classic)"**

3. Configure the token:
   - **Note**: `MCP Agent Token for GitPulse`
   - **Expiration**: Choose your preferred duration (90 days recommended)
   - **Scopes** (check these boxes):
     - ✅ **`repo`** (Full control of private repositories)
       - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`

4. Click **"Generate token"** at the bottom

5. **IMPORTANT**: Copy the token immediately (it won't be shown again)

### 2. Add Token to Environment Variables

1. Open `.env.local` in your project root

2. Add the following line:
   ```env
   GITHUB_TOKEN=ghp_your_actual_token_here
   ```

3. Replace `ghp_your_actual_token_here` with your copied token

### 3. Restart Development Server

```powershell
# Stop the current server (Ctrl+C)
# Then restart
pnpm run dev
```

---

## 📋 Environment Variable Reference

Your `.env.local` should contain:

```env
GEMINI_API_KEY=your_gemini_key

# GitHub Token for MCP Agent
GITHUB_TOKEN=ghp_your_github_token_here

# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=[API_KEY]
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=[AUTH_DOMAIN]
NEXT_PUBLIC_FIREBASE_PROJECT_ID=[PROJECT_ID]
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=[STORAGE_BUCKET]
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=[MESSAGING_SENDER_ID]
NEXT_PUBLIC_FIREBASE_APP_ID=[APP_ID]
```

---

## 🧪 Testing the Endpoint

### Test with cURL (PowerShell)

```powershell
$body = @{
    owner = "Rajarshi44"
    repo = "hackspire_2025"
    issue_number = 1
    jobId = "test-job-$(Get-Date -Format 'yyyyMMddHHmmss')"
    requested_by = "Rajarshi44"
    related_files = @("src/app/page.tsx")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/mcp/generate-code" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Test with JavaScript (Browser Console)

```javascript
fetch('http://localhost:3000/api/mcp/generate-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    owner: 'Rajarshi44',
    repo: 'hackspire_2025',
    issue_number: 1,
    jobId: `test-job-${Date.now()}`,
    requested_by: 'Rajarshi44',
    related_files: ['src/app/page.tsx']
  })
})
.then(r => r.json())
.then(console.log);
```

---

## 🔒 Security Best Practices

### ✅ Do's

- ✅ Store tokens in `.env.local` (automatically ignored by git)
- ✅ Use fine-grained tokens when possible
- ✅ Set token expiration dates
- ✅ Rotate tokens regularly (every 90 days)
- ✅ Use separate tokens for different environments (dev/staging/production)

### ❌ Don'ts

- ❌ Never commit tokens to git
- ❌ Don't share tokens in chat/email/Slack
- ❌ Don't use personal tokens in production (use GitHub Apps instead)
- ❌ Don't grant more scopes than needed

---

## 🔥 Firestore Setup

### Required Collections

The MCP agent uses these Firestore collections:

```
repos/
  {encodedRepoId}/           # e.g., "Rajarshi44%2Fhackspire_2025"
    mcp_jobs/
      {jobId}/
        - jobId: string
        - status: "pending" | "processing" | "review" | "completed" | "failed"
        - pr_url?: string
        - pr_number?: number
        - branch?: string
        - validated?: boolean
        - created_at: timestamp
        - updated_at: timestamp
        - error?: string
    
    mcp_logs/
      {logId}/
        - message: string
        - requested_by: string
        - timestamp: timestamp
        - issue_number?: number
        - error?: string
```

### Firestore Security Rules

Add these rules to `firestore.rules`:

```javascript
match /repos/{repoId}/mcp_jobs/{jobId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;
}

match /repos/{repoId}/mcp_logs/{logId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;
}
```

---

## 📊 Monitoring & Debugging

### Check GitHub Rate Limits

```powershell
curl -H "Authorization: Bearer $env:GITHUB_TOKEN" https://api.github.com/rate_limit
```

### View MCP Logs

Check the server console for detailed logs:
- `🚀 Starting MCP code generation...`
- `✅ User X is assigned to this issue`
- `🌿 Created branch: gitpulse/issue-N/draft-timestamp`
- `🤖 Generating code fixes with AI...`
- `✅ Validation passed`
- `📝 Created draft PR: https://github.com/...`

### Common Issues

1. **"GitHub token not configured"**
   - Solution: Add `GITHUB_TOKEN` to `.env.local` and restart server

2. **"User X is not assigned to this issue" (403)**
   - Solution: Assign the user to the GitHub issue first

3. **"Rate limit exceeded" (429)**
   - Solution: Wait for rate limit reset or use a different token

4. **"Validation failed" (422)**
   - Solution: Check the TypeScript errors in the response and review AI-generated code

---

## 🎯 API Endpoint Documentation

### POST `/api/mcp/generate-code`

**Request Body:**
```json
{
  "owner": "string (required)",
  "repo": "string (required)",
  "issue_number": "number (required)",
  "jobId": "string (required)",
  "requested_by": "string (required)",
  "related_files": ["string[]"] // optional
}
```

**Responses:**

- **200 Success**
  ```json
  {
    "success": true,
    "jobId": "job-123",
    "pr_url": "https://github.com/owner/repo/pull/42",
    "pr_number": 42,
    "branch": "gitpulse/issue-1/draft-1234567890"
  }
  ```

- **403 Forbidden** - User not assigned to issue
- **422 Validation Failed** - TypeScript validation errors
- **429 Rate Limit** - GitHub API rate limit exceeded
- **500 Internal Error** - Server error

---

## 🚢 Production Deployment

### Environment Variables

Add to your production environment (Vercel/Firebase/etc.):

```env
GITHUB_TOKEN=ghp_production_token_here
GEMINI_API_KEY=your_production_gemini_key
```

### GitHub App (Recommended for Production)

For production, use a GitHub App instead of personal access tokens:

1. Create a GitHub App at https://github.com/settings/apps/new
2. Set permissions:
   - Repository permissions:
     - Contents: Read & Write
     - Issues: Read & Write
     - Pull requests: Read & Write
3. Install the app on your organization/repositories
4. Generate and use the installation token

---

## 📚 Additional Resources

- [GitHub Token Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub API Rate Limits](https://docs.github.com/en/rest/rate-limit)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

## ✨ Features

This MCP endpoint provides:

- ✅ AI-powered code generation for GitHub issues
- ✅ Automatic assignee verification
- ✅ Intelligent file selection (AI + keyword fallback)
- ✅ Smart file chunking (700 lines, function boundaries)
- ✅ TypeScript validation before commit
- ✅ Atomic multi-file commits via Git Tree API
- ✅ Draft PR creation with labels
- ✅ Firestore job tracking
- ✅ Rate-limit aware GitHub API calls
- ✅ Comprehensive error handling

---

**Need help?** Check the server logs or create an issue in the repository.
