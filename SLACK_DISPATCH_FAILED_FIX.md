# GitPulse Slack Bot - Troubleshooting dispatch_failed Error

## Problem
The `/gitpulse` command is failing with "dispatch_failed" error in Slack.

## Root Causes & Solutions

### 1. Missing Environment Variables
The most common cause is missing or incorrect environment variables.

**Required Variables:**
```bash
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
GOOGLE_GENAI_API_KEY=your_google_genai_api_key_here
```

**How to Fix:**
1. Copy `.env.example` to `.env.local`
2. Fill in your actual values from:
   - Slack App Settings → Basic Information → App Credentials (for signing secret)
   - Slack App Settings → OAuth & Permissions → Bot User OAuth Token
   - Google AI Studio → API Keys

### 2. Request Timeout
Slack commands must respond within 3 seconds. Our improvements include:
- Timeout handling with 2.5s limit
- Immediate response for long operations
- Better error messages

### 3. Signature Verification Failure
The bot verifies requests from Slack using the signing secret.

**Debugging Steps:**
1. Use `/gitpulse status` to check configuration
2. Check server logs for signature verification errors
3. Ensure your signing secret matches exactly (no extra spaces)

### 4. Server Errors
Any unhandled exception can cause dispatch_failed.

**Improvements Made:**
- Better error handling and logging
- Always return HTTP 200 to Slack (even for errors)
- Detailed error messages for debugging

## Testing Steps

1. **Check Configuration:**
   ```bash
   /gitpulse status
   ```

2. **Test Basic Functionality:**
   ```bash
   /gitpulse help
   ```

3. **Test Analysis (if environment is set up):**
   ```bash
   /gitpulse analyze
   ```

## Environment Setup

1. Create `.env.local` file:
   ```bash
   cp .env.example .env.local
   ```

2. Get your Slack credentials:
   - Go to https://api.slack.com/apps
   - Select your app
   - Get signing secret and bot token

3. Get Google AI API key:
   - Go to https://aistudio.google.com/app/apikey
   - Create new API key

4. Restart your development server:
   ```bash
   npm run dev
   ```

## Additional Debugging

Check server logs when running commands:
- Look for console.log messages showing request flow
- Environment variable validation messages
- Error details with stack traces

If issues persist, the `/gitpulse status` command will show exactly which configuration is missing.