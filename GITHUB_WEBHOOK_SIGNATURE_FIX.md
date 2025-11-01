# GitHub Webhook "Invalid Signature" Fix

## Problem
GitHub webhook endpoint is returning `{"error":"Invalid signature"}` error.

## Root Cause
The `GITHUB_WEBHOOK_SECRET` environment variable is not configured in Vercel, even though it exists in your local `.env.local` file.

## Solution Steps

### 1. Add Environment Variable to Vercel

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Navigate to your project (`hackspire_2025`)
3. Go to **Settings** → **Environment Variables**
4. Add a new environment variable:
   - **Key**: `GITHUB_WEBHOOK_SECRET`
   - **Value**: `gH9$zT!vQ3@rL7#xW2^mN0*bE8&uK5%p`
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**

### 2. Redeploy Your Application

After adding the environment variable, you need to redeploy:

**Option A: Via Vercel Dashboard**
1. Go to **Deployments** tab
2. Click the three dots menu on the latest deployment
3. Click **Redeploy**

**Option B: Via Git Push**
```bash
git commit --allow-empty -m "Trigger redeployment after env var update"
git push origin main
```

### 3. Verify the Configuration

After redeployment, test the webhook:

1. Go to your GitHub repository: https://github.com/Rajarshi44/hackspire_2025
2. Navigate to **Settings** → **Webhooks**
3. Click on your webhook (https://devx-rho.vercel.app/api/webhooks/github)
4. Scroll down to **Recent Deliveries**
5. Click **Redeliver** on any recent delivery
6. Check the response - it should now show a success message

### 4. Check Logs in Vercel

1. Go to Vercel Dashboard → Your Project → **Logs**
2. Look for the webhook requests
3. You should see detailed logging like:
   ```
   Webhook debug info: { event: 'pull_request', delivery: '...', hasSignature: true, ... }
   Signature comparison: { receivedHashPrefix: '...', expectedHashPrefix: '...', ... }
   GitHub signature verification result: true
   ```

## Verification Commands

### Test webhook locally (if needed):
```powershell
# Create a test payload
$payload = '{"action":"opened","number":1,"pull_request":{"id":1}}'
$secret = 'gH9$zT!vQ3@rL7#xW2^mN0*bE8&uK5%p'

# Generate signature
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$signature = [BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))).Replace('-','').ToLower()
$signatureHeader = "sha256=$signature"

# Test the endpoint
Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks/github" `
  -Method POST `
  -Headers @{
    "x-hub-signature-256" = $signatureHeader
    "x-github-event" = "pull_request"
    "x-github-delivery" = "test-123"
  } `
  -Body $payload `
  -ContentType "application/json"
```

## Important Notes

1. **Security**: The webhook secret must match exactly between:
   - GitHub webhook configuration
   - Vercel environment variable
   - Local `.env.local` (for development)

2. **Case Sensitivity**: Environment variable names are case-sensitive

3. **Special Characters**: The secret contains special characters. In Vercel UI, paste it exactly as shown without quotes

4. **Redeployment Required**: Environment variable changes require a redeployment to take effect

## Current Configuration

- **Webhook URL**: https://devx-rho.vercel.app/api/webhooks/github
- **Secret**: `gH9$zT!vQ3@rL7#xW2^mN0*bE8&uK5%p`
- **Events**: pull_request, pull_request_review, issues, push

## Enhanced Logging

The webhook endpoint now includes detailed logging to help diagnose signature verification issues:
- Request headers and body info
- Signature comparison details
- Secret configuration status
- Hash comparison results

Check Vercel logs after the fix to see these details.
