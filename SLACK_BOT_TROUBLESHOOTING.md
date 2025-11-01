# Slack Bot Issue Detection - Troubleshooting Guide

## 🔍 Debugging the Issue Detection Feature

The bot should automatically analyze messages in channels where it's present and suggest creating GitHub issues when it detects potential problems or feature requests.

### 📋 Checklist - Environment Setup

1. **Environment Variables** (required)
   - [ ] `SLACK_BOT_TOKEN` - Bot token from Slack app (starts with `xoxb-`)
   - [ ] `SLACK_SIGNING_SECRET` - For verifying requests from Slack
   - [ ] `NEXTAUTH_URL` or `VERCEL_URL` - For GitHub OAuth redirects

2. **Optional Environment Variables**
   - [ ] `SLACK_USER_ALLOWLIST` - Comma-separated Slack user IDs (if empty, all users allowed)
   - [ ] `SLACK_CHANNEL_ALLOWLIST` - Comma-separated channel IDs (if empty, all channels allowed)

### 🤖 Slack App Configuration

1. **Bot Token Scopes** (OAuth & Permissions)
   - [ ] `chat:write` - Send messages
   - [ ] `channels:history` - Read channel messages
   - [ ] `users:read` - Get user information
   - [ ] `app_mentions:read` - Respond to mentions

2. **Event Subscriptions**
   - [ ] Enable Events: ON
   - [ ] Request URL: `https://your-domain.com/api/slack/events`
   - [ ] Subscribe to events:
     - [ ] `message.channels` - Message posted to channel
     - [ ] `app_mention` - App mention in channel

3. **Interactive Components**
   - [ ] Request URL: `https://your-domain.com/api/slack/interactive`

### 🧪 Testing Steps

#### Step 1: Basic Bot Test
```bash
# Run the bot test script
node test-slack-bot.js
```

#### Step 2: Manual API Test
```bash
# Test the analysis endpoint
curl -X POST https://your-domain.com/api/slack/test \
  -H "Content-Type: application/json" \
  -d '{"message": "This feature is broken and needs to be fixed", "userId": "U123", "channelId": "C123"}'
```

#### Step 3: Test in Slack
1. **Mention the bot**: `@GitPulse hello` - should get a response
2. **Send issue-like messages**:
   - "This feature is broken"
   - "Let's add a header"
   - "We need to fix the login bug"
   - "Can we implement dark mode?"

### 🔍 Common Issues & Solutions

#### Issue: Bot doesn't respond to mentions
- **Check**: Bot token has `chat:write` permission
- **Check**: Bot is added to the channel
- **Check**: `SLACK_BOT_TOKEN` environment variable is set

#### Issue: Bot doesn't analyze regular messages
- **Check**: Bot has `channels:history` permission
- **Check**: Event subscription for `message.channels` is active
- **Check**: Webhook URL is correct and accessible

#### Issue: AI analysis fails
- **Check**: Genkit/AI service is properly configured
- **Check**: Console logs for specific AI errors
- **Check**: Message contains issue-indicating keywords

#### Issue: GitHub integration doesn't work
- **Check**: User has connected GitHub account via the bot
- **Check**: GitHub token is valid and has repository permissions
- **Check**: Firebase/database is properly configured

### 📊 Monitoring & Logs

#### Key Log Messages to Look For:
- `🗣️ App mention received:` - Bot receives mentions
- `📨 Received message event:` - Bot processes channel messages
- `🔍 Starting autoAnalyzeMessage:` - AI analysis begins
- `🤖 AI detection result:` - AI analysis completes
- `📤 Sending issue suggestion:` - Bot sends suggestion to user

#### Debug Mode:
The enhanced implementation includes comprehensive logging. Check your deployment logs for these emojis to trace the flow.

### 🚀 Quick Fix Commands

```bash
# Restart the bot (if using PM2)
pm2 restart gitpulse-bot

# Check logs
pm2 logs gitpulse-bot

# Test webhook connectivity
curl -X POST https://your-domain.com/api/slack/test \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "test=true"
```

### 📝 Expected Flow

1. **User sends message** in channel with bot
2. **Bot receives webhook** at `/api/slack/events`
3. **Message is analyzed** for issue keywords
4. **AI processes** message context
5. **If issue detected**, bot sends interactive suggestion
6. **User can click** buttons to create GitHub issue

### 🎯 Testing Phrases

Try these messages to test detection:
- ✅ "This login feature is broken"
- ✅ "Let's add a dark mode"
- ✅ "We need to fix the API bug"
- ✅ "Can we implement user profiles?"
- ❌ "Hello everyone!"
- ❌ "How's your day going?"

---

If the bot still doesn't work after checking these items, review the console logs for specific error messages and check the Slack app configuration in your Slack workspace.