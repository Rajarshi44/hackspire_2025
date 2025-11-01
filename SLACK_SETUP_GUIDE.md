# Slack App Setup Guide

This guide will help you set up the GitPulse Slack app to work with your workspace.

## Step 1: Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Enter app name: "GitPulse" 
4. Select your workspace
5. Click "Create App"

## Step 2: Configure Bot User

1. In your app settings, go to **Features** → **OAuth & Permissions**
2. Scroll to **Scopes** section
3. Add the following **Bot Token Scopes**:
   - `app_mentions:read` - Listen for mentions
   - `chat:write` - Send messages
   - `channels:history` - Read channel message history
   - `channels:read` - Access channel information
   - `commands` - Use slash commands
   - `users:read` - Access user information
   - `im:write` - Send direct messages

## Step 3: Set Up Slash Commands

1. Go to **Features** → **Slash Commands**
2. Click **Create New Command**
3. Configure the command:
   - **Command**: `/gitpulse`
   - **Request URL**: `https://your-domain.com/api/slack/commands`
   - **Short Description**: "GitPulse AI assistant commands"
   - **Usage Hint**: `analyze | create-issue | help`
4. Click **Save**

## Step 4: Configure Events

1. Go to **Features** → **Event Subscriptions**
2. Turn on **Enable Events**
3. Set **Request URL**: `https://your-domain.com/api/slack/events`
4. Under **Subscribe to bot events**, add:
   - `app_mention` - When users mention your app
   - `message.channels` - Messages in channels (if auto-monitoring enabled)

## Step 5: Configure Interactive Components

1. Go to **Features** → **Interactivity & Shortcuts**
2. Turn on **Interactivity**
3. Set **Request URL**: `https://your-domain.com/api/slack/interactive`

## Step 6: Install the App

1. Go to **Settings** → **Install App**
2. Click **Install to Workspace**
3. Review permissions and click **Allow**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

## Step 7: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Get from Settings → Basic Information
SLACK_SIGNING_SECRET=your_signing_secret_here

# Get from OAuth & Permissions after installation
SLACK_BOT_TOKEN=xoxb-your-bot-token-here

# Optional: For Socket Mode (recommended for development)
SLACK_APP_TOKEN=xapp-your-app-token-here
```

## Step 8: Enable Socket Mode (Recommended for Development)

1. Go to **Settings** → **Socket Mode**
2. Turn on **Enable Socket Mode**
3. Create an App-Level Token:
   - Token Name: "GitPulse Socket"
   - Scopes: `connections:write`
4. Copy the token (starts with `xapp-`)
5. Add to your `.env.local` as `SLACK_APP_TOKEN`

## Step 9: Test the Integration

1. Add your bot to a channel: `/invite @gitpulse`
2. Test commands:
   - `@gitpulse` - Mention the bot
   - `/gitpulse help` - Show help
   - `/gitpulse analyze` - Analyze messages

## Deployment Notes

### For Production:

- Replace localhost URLs with your production domain
- Use HTTPS endpoints (required by Slack)
- Set up proper error handling and logging
- Consider rate limiting for API endpoints

### Security:

- Always verify Slack request signatures
- Store tokens securely (use environment variables)
- Implement proper error handling
- Add request validation

## Available Commands

Once set up, users can:

- **Mention the bot**: `@gitpulse help me create an issue`
- **Use slash commands**: 
  - `/gitpulse analyze` - Analyze recent channel messages
  - `/gitpulse create-issue` - Create a new GitHub issue
  - `/gitpulse help` - Show available commands
- **Interactive components**: Use buttons and modals for rich interactions

## Troubleshooting

### Common Issues:

1. **"url_verification failed"** - Check that your endpoint returns the challenge
2. **"Invalid signature"** - Verify signing secret and signature validation
3. **"Missing scopes"** - Ensure all required OAuth scopes are added
4. **"App not responding"** - Check endpoint URLs and HTTPS configuration

### Logs to Check:

- Server logs for API endpoint errors
- Slack app Event Subscriptions page for delivery status
- Browser network tab for failed requests

## Next Steps

- Customize AI prompts for your team's needs
- Add team-specific GitHub repositories
- Configure auto-detection settings
- Train team members on available commands