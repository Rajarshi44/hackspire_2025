# Vercel Deployment Guide for GitPulse Slack Bot

## Prerequisites
- Vercel account
- GitHub repository connected to Vercel
- Slack app configured
- Google AI Studio API key
- Firebase project set up

## 1. Environment Variables Setup

In your Vercel dashboard (Project Settings → Environment Variables), add these:

### Required Environment Variables:

```bash
# Slack Configuration
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
SLACK_BOT_TOKEN=xoxb-your-bot-token-here

# Optional Slack Allowlists (leave empty to allow all)
SLACK_USER_ALLOWLIST=
SLACK_CHANNEL_ALLOWLIST=

# Google AI Configuration
GOOGLE_GENAI_API_KEY=your_google_genai_api_key_here

# Next.js Configuration
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=your-secure-random-string-here

# GitHub Configuration (for OAuth)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 2. Build Configuration

The `vercel.json` file has been configured with:
- Proper build commands for pnpm
- Extended timeout for Slack API routes (30 seconds)
- CORS headers for Slack webhooks
- Next.js framework optimization

## 3. Slack App Configuration Updates

After deployment, update these URLs in your Slack app:

### Slash Commands:
- Request URL: `https://your-app-name.vercel.app/api/slack/commands`

### Event Subscriptions:
- Request URL: `https://your-app-name.vercel.app/api/slack/events`

### Interactive Components:
- Request URL: `https://your-app-name.vercel.app/api/slack/interactions`

## 4. Deployment Steps

1. **Connect Repository to Vercel:**
   ```bash
   # Install Vercel CLI (optional)
   npm i -g vercel
   
   # Deploy from CLI (optional)
   vercel --prod
   ```

2. **Or deploy via Vercel Dashboard:**
   - Go to vercel.com/dashboard
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

3. **Update Slack App Settings:**
   - Go to https://api.slack.com/apps
   - Select your app
   - Update all webhook URLs to use your Vercel domain
   - Save changes

## 5. Post-Deployment Testing

1. **Test bot configuration:**
   ```
   /gitpulse status
   ```

2. **Test basic functionality:**
   ```
   /gitpulse help
   ```

3. **Test AI analysis (if configured):**
   ```
   /gitpulse analyze
   ```

## 6. Environment-Specific Considerations

### Production Secrets:
- Generate a strong NEXTAUTH_SECRET: `openssl rand -base64 32`
- Use production Firebase project
- Use production Google AI API key with proper quotas

### Security:
- Consider setting SLACK_USER_ALLOWLIST for production
- Consider setting SLACK_CHANNEL_ALLOWLIST for specific channels
- Ensure Firebase rules are properly configured

### Monitoring:
- Check Vercel function logs for errors
- Monitor API usage in Google AI Studio
- Monitor Firebase usage

## 7. Common Issues & Solutions

### Dispatch Failed Errors:
- Verify all environment variables are set
- Check function timeout (increased to 30s in vercel.json)
- Verify Slack signing secret is correct

### Build Errors:
- Ensure pnpm-lock.yaml is committed
- Check TypeScript errors with `npm run typecheck`
- Verify all dependencies are in package.json

### Function Timeouts:
- Slack webhooks have 30-second timeout configured
- AI operations have 2.5-second internal timeout with fallback

## 8. Scaling Considerations

- Vercel Hobby plan: 100GB-hrs/month function execution
- Vercel Pro plan: 1000GB-hrs/month function execution
- Google AI Studio has usage quotas - monitor in dashboard
- Firebase has usage limits - upgrade plan if needed

## 9. Development vs Production

- Use different Slack apps for dev/prod environments
- Separate Firebase projects for dev/prod
- Different Google AI API keys (optional)
- Update NEXTAUTH_URL for each environment