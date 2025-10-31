# 🚨 URGENT: Slack Bot Authentication Fix

## Current Problem
Your Slack bot is failing with `invalid_auth` error because:

1. **Invalid SLACK_BOT_TOKEN format** - Token should start with `xoxb-`
2. **Missing OAuth scopes** - Bot needs `conversations:history` and other permissions
3. **Bot not added to channels** - Must be invited to channels where it's used

## 🔧 Quick Fix Steps

### Step 1: Get Correct Bot Token

1. **Go to your Slack app settings:**
   ```
   https://api.slack.com/apps
   ```

2. **Select your GitPulse app**

3. **Go to "OAuth & Permissions" in the left sidebar**

4. **Copy the "Bot User OAuth Token"** - It should look like:
   ```
   xoxb-[numbers]-[numbers]-[letters]
   ```

5. **Update your environment variables:**
   ```bash
   SLACK_BOT_TOKEN=xoxb-[your-actual-bot-token-here]
   ```

### Step 2: Verify OAuth Scopes

**Required scopes for your bot:**
- `app_mentions:read` - Respond to @mentions
- `channels:history` - Read public channel messages
- `channels:read` - Access channel information
- `chat:write` - Send messages
- `commands` - Handle slash commands
- `conversations:history` - Read conversation messages (CRITICAL for /gitpulse analyze)
- `users:read` - Read user information

**To check/add scopes:**
1. In your Slack app settings → "OAuth & Permissions"
2. Scroll to "Scopes" → "Bot Token Scopes"
3. Add any missing scopes from the list above
4. **Important:** After adding scopes, you MUST reinstall the app to your workspace

### Step 3: Reinstall Bot (Required after scope changes)

1. In Slack app settings → "Install App"
2. Click "Reinstall to Workspace"
3. **Copy the NEW bot token** (it will change after reinstall)
4. Update your environment variables with the new token

### Step 4: Add Bot to Channels

**For each channel where you want to use `/gitpulse`:**
```
/invite @GitPulse
```

Or manually add it:
1. Go to the channel
2. Click channel name → "Settings" → "Integrations"
3. Click "Add apps" → Select "GitPulse"

## 🔍 Environment Variable Check

**Update these in Vercel:**

```bash
# Slack Configuration (CRITICAL)
SLACK_BOT_TOKEN=xoxb-[your-bot-token-from-slack-app]
SLACK_SIGNING_SECRET=[your-signing-secret-from-slack-app]

# Other required variables
SLACK_SKIP_VERIFICATION=true  # Only for testing, remove in production
GOOGLE_GENAI_API_KEY=[your-genai-api-key]
```

**In Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Update `SLACK_BOT_TOKEN` with the correct `xoxb-` token
3. Make sure `SLACK_SIGNING_SECRET` is also set
4. Redeploy after updating variables

## 🧪 Test the Fix

1. **After updating environment variables, redeploy:**
   ```bash
   git push  # This will trigger Vercel deployment
   ```

2. **Test in Slack:**
   ```
   /gitpulse status
   ```
   Should show: ✅ Slack Bot Token: ✅

3. **Test analysis command:**
   ```
   /gitpulse analyze
   ```
   Should work without `invalid_auth` error

## 🚨 Common Issues & Solutions

**Issue:** "Token should start with xoxb-"
- **Fix:** You're using the wrong token. Get the "Bot User OAuth Token", not the "User OAuth Token" or "App Token"

**Issue:** Still getting `invalid_auth` after fixing token
- **Fix:** Bot needs to be added to the channel: `/invite @GitPulse`

**Issue:** "missing_scope" error
- **Fix:** Add `conversations:history` scope and reinstall the app

**Issue:** Bot responds but can't read messages
- **Fix:** Ensure `conversations:history` and `channels:history` scopes are added

## 📝 Verification Checklist

- [ ] Bot token starts with `xoxb-`
- [ ] All required scopes are added to the bot
- [ ] App has been reinstalled after scope changes
- [ ] Environment variables updated in Vercel
- [ ] Bot added to test channels with `/invite @GitPulse`
- [ ] `/gitpulse status` returns all ✅
- [ ] `/gitpulse analyze` works without auth errors

## 🎯 Expected Result

After fixing these issues, your logs should show:
```
✅ Slack signature verification PASSED
✅ Slack API response: { ok: true, messageCount: 5, hasMessages: true }
✅ Analysis completed successfully
```

**Next step:** Once Slack authentication is fixed, we can proceed with GitHub OAuth setup! 🚀