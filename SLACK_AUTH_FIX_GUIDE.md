# 🚨 Slack Bot Authentication Fix Guide

## Current Issue
Bot is getting `invalid_auth` error when trying to fetch channel history.

Your current bot token: `xoxb-9809981269347-9812972041685-EcqKm5OissXjLwxxuvLPJcX8`

## Root Causes & Solutions

### 1. **Missing OAuth Scopes** (Most Likely)

Your Slack bot needs specific permissions to read channel messages.

**Required Scopes:**
- `conversations:history` - Read messages from channels
- `users:read` - Get user information
- `channels:read` - Access channel information

**How to Fix:**
1. Go to https://api.slack.com/apps
2. Select your app
3. Go to "OAuth & Permissions"
4. Under "Scopes" → "Bot Token Scopes", add:
   - `conversations:history`
   - `users:read` 
   - `channels:read`
5. **Click "Install to Workspace"** (this regenerates the token)
6. Copy the new bot token and update your environment variables

### 2. **Bot Not Added to Channel**

The bot must be a member of the channel to read messages.

**How to Fix:**
1. Go to the Slack channel where you're testing
2. Type: `/invite @YourBotName`
3. Or mention the bot: `@GitPulse` (this should add it automatically)

### 3. **Wrong Bot Token**

**Verify Your Token:**
- Should start with `xoxb-`
- Should be 50+ characters long
- Your current token looks correct: `xoxb-9809981269347-9812972041685-EcqKm5OissXjLwxxuvLPJcX8`

### 4. **Environment Variable Issues**

**Check Vercel Environment:**
1. Vercel Dashboard → Settings → Environment Variables
2. Verify `SLACK_BOT_TOKEN` matches your Slack app
3. If you updated the token, redeploy the app

## Step-by-Step Fix

### Step 1: Update Slack App Scopes
```
1. https://api.slack.com/apps → Your App
2. OAuth & Permissions → Bot Token Scopes
3. Add: conversations:history, users:read, channels:read
4. Click "Install to Workspace"
5. Copy new bot token
```

### Step 2: Update Environment Variables
```
1. Update .env file locally (for testing)
2. Update Vercel environment variables (for production)
3. Redeploy if needed
```

### Step 3: Add Bot to Channel
```
In your Slack channel:
/invite @GitPulse
or
@GitPulse hello
```

### Step 4: Test
```
/gitpulse analyze
```

## Debugging Commands

**Check bot status:**
```
/gitpulse status
```

**Expected logs after fix:**
```
🔍 Fetching channel history: { channelId: 'C...', hasToken: true }
📄 Slack API response: { ok: true, messageCount: 5 }
```

## Common Slack App Setup Issues

### Missing Event Subscriptions
If you want the bot to respond to mentions:
1. Go to "Event Subscriptions" 
2. Enable Events
3. Add Bot User Events: `app_mention`, `message.channels`
4. Set Request URL: `https://your-app.vercel.app/api/slack/events`

### Wrong App Configuration
Make sure you're configuring the right Slack app:
- Check the app name in Slack settings
- Verify the Request URLs point to your Vercel domain
- Ensure you're testing in the right workspace

## Emergency Testing

If you need to test immediately, temporarily disable auth checks:
1. Set `SLACK_SKIP_VERIFICATION=true` (already set)
2. This bypasses signature verification but NOT API auth
3. You still need the correct bot token and scopes

## Next Steps After Fix

1. Remove `SLACK_SKIP_VERIFICATION=true` from production
2. Test all commands: `/gitpulse help`, `/gitpulse analyze`, `/gitpulse status`
3. Test in different channels
4. Verify proper error handling