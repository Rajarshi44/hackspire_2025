# Slack "Request Verification Failed" Troubleshooting Guide

## The Problem
Your Slack bot is returning "❌ Request verification failed." when processing commands.

## Root Cause Analysis
Slack signature verification fails when:
1. **Wrong Signing Secret** - Most common cause
2. **Missing Environment Variable** - SLACK_SIGNING_SECRET not set
3. **Timestamp Issues** - Request too old (>5 minutes) or server time drift
4. **Body Parsing Issues** - Request body modified before verification
5. **Character Encoding Issues** - Signing secret contains special characters

## Quick Fixes

### 1. Verify Your Signing Secret
```bash
# In Vercel Dashboard → Settings → Environment Variables
# Make sure SLACK_SIGNING_SECRET exactly matches your Slack App
```

**Get the correct signing secret:**
1. Go to https://api.slack.com/apps
2. Select your app
3. Go to "Basic Information"
4. Copy "Signing Secret" (NOT the Client Secret)

### 2. Check Environment Variables
Use the debug command to verify configuration:
```
/gitpulse status
```

Or visit your debug endpoint:
```
https://your-app.vercel.app/api/slack/debug
```

### 3. Development Bypass (Local Testing Only)
Add to your local `.env.local`:
```bash
NODE_ENV=development
SLACK_SKIP_VERIFICATION=true
```
**⚠️ Never use this in production!**

## Detailed Debugging Steps

### Step 1: Check Vercel Environment Variables
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify these are set:
   - `SLACK_SIGNING_SECRET` 
   - `SLACK_BOT_TOKEN`
   - `GOOGLE_GENAI_API_KEY`

### Step 2: Verify Signing Secret Format
The signing secret should be a 32-character hex string like:
```
a1b2c3d4e5f6789012345678901234567890abcd
```

Common mistakes:
- Using Client Secret instead of Signing Secret
- Extra spaces or newlines
- Wrong app (dev vs prod)

### Step 3: Check Server Logs
1. Go to Vercel Dashboard → Your Project → Functions
2. Click on a recent `/api/slack/commands` execution
3. Look for detailed verification logs

Expected log output:
```
Verifying Slack request: {
  hasSignature: true,
  hasTimestamp: true,
  timestampValue: "1698786123",
  bodyLength: 145
}
Signature verification result: true
```

### Step 4: Test Different Commands
Try these in order:
```
/gitpulse help        # Simplest test
/gitpulse status      # Shows configuration
/gitpulse analyze     # Full functionality test
```

## Common Error Patterns

### Error: "Missing SLACK_SIGNING_SECRET"
**Fix:** Add the environment variable in Vercel

### Error: "Request timestamp too old"
**Fix:** Check server time synchronization or reduce request delay

### Error: "Signature length mismatch"
**Fix:** Verify signing secret is exactly 32 hex characters

### Error: "Signature verification result: false"
**Fix:** Double-check signing secret matches your Slack app

## Production vs Development

### Development Setup
```bash
# .env.local
NODE_ENV=development
SLACK_SIGNING_SECRET=your_dev_signing_secret
SLACK_SKIP_VERIFICATION=true  # Optional bypass
```

### Production Setup
```bash
# Vercel Environment Variables
NODE_ENV=production
SLACK_SIGNING_SECRET=your_prod_signing_secret
# Never set SLACK_SKIP_VERIFICATION in production
```

## Testing the Fix

### 1. Deploy Changes
```bash
git add .
git commit -m "Fix Slack signature verification"
git push
```

### 2. Test Commands
Start with the simplest:
```
/gitpulse help
```

### 3. Check Logs
Monitor Vercel function logs for verification details.

### 4. Verify All Environment Variables
```
/gitpulse status
```

## Still Not Working?

### Debug Checklist
- [ ] Signing secret copied exactly from Slack App settings
- [ ] Environment variable set in Vercel (not just locally)
- [ ] Using correct Slack app (dev vs prod)
- [ ] No extra spaces in environment variables
- [ ] Slack app URL points to your Vercel domain
- [ ] Function logs show detailed verification steps

### Advanced Debugging
1. **Compare signatures manually:**
   - Check server logs for expected vs received signature
   - Verify the base string format: `v0:timestamp:body`

2. **Test with curl:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/slack/debug \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "test=data"
   ```

3. **Verify Slack app configuration:**
   - Request URL: `https://your-app.vercel.app/api/slack/commands`
   - Method: POST
   - Content-Type: application/x-www-form-urlencoded

## Emergency Workaround
For immediate testing (development only):
1. Set `SLACK_SKIP_VERIFICATION=true` in Vercel
2. Test functionality
3. Remove bypass and fix signing secret
4. Redeploy with proper verification

**⚠️ Never leave verification disabled in production!**