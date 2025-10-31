# 🚨 URGENT: Slack Signature Verification Fix

## What I Found
Your logs show the signature verification is failing:
- Expected: `v0=e9d90e1...`  
- Received: `v0=ca9fb1c...`

This means the signing secret doesn't match what Slack is using.

## Immediate Steps to Fix

### 1. Double-Check Your Signing Secret

**Go to your Slack App:**
1. Visit https://api.slack.com/apps
2. Click on your app
3. Go to "Basic Information" 
4. Under "App Credentials", find "Signing Secret"
5. Click "Show" and copy the EXACT value

**Current secret in your .env:** `11e4b76b51d28e2ccafdd2c690374499`

### 2. Common Issues:

#### Wrong App
- Are you using the correct Slack app?
- Do you have multiple apps (dev/prod)?
- Check the app name matches what you're testing

#### Wrong Secret Type  
- Make sure you're copying "Signing Secret" NOT "Client Secret"
- Signing Secret is usually 32 hex characters
- Client Secret is longer and different

#### Copy/Paste Errors
- No extra spaces before/after
- No newlines or hidden characters  
- Copy exactly from Slack dashboard

### 3. Quick Test

I've added a test endpoint. Update your Slack command URL temporarily to:
```
https://your-domain/api/slack/verify-test
```

This will show detailed verification info without other processing.

### 4. If Still Failing

Try these debugging steps:

**A. Verify you're testing the right app:**
- Check the Request URL in Slack App settings
- Make sure it points to your correct domain
- Verify the command name matches

**B. Check for environment variable issues:**
- In Vercel: Settings → Environment Variables
- Make sure SLACK_SIGNING_SECRET is set correctly
- Redeploy after changing environment variables

**C. Test with curl (if you have request details):**
```bash
curl -X POST https://your-domain/api/slack/verify-test \
  -H "x-slack-signature: v0=ca9fb1c..." \
  -H "x-slack-request-timestamp: 1761932389" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "your_request_body"
```

### 5. Emergency Fix

If you need to test functionality immediately:
1. Set `SLACK_SKIP_VERIFICATION=true` in environment
2. Test your bot commands
3. Fix the signing secret properly
4. Remove the skip flag

**⚠️ Never leave verification disabled in production!**

## Next Steps
1. Get the correct signing secret from Slack
2. Update your environment variables  
3. Test with `/gitpulse help`
4. Check server logs for verification success