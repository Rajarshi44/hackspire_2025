# 🔐 Complete GitHub OAuth Setup Guide

## Overview
This guide will help you set up GitHub OAuth authentication for your GitPulse Slack bot, so users can connect their GitHub accounts and create issues directly from Slack.

## 🎯 What You'll Achieve
- Users can authenticate with GitHub from Slack
- Create GitHub issues in their repositories 
- Access both public and private repositories
- Secure token storage in Firebase

## 📋 Prerequisites
- GitHub account
- Vercel deployment running at: `https://devx-rho.vercel.app`
- Firebase project configured
- Slack app already set up

## 🚀 Step-by-Step Setup

### Step 1: Create GitHub OAuth App

1. **Go to GitHub Developer Settings:**
   ```
   https://github.com/settings/developers
   ```

2. **Click "New OAuth App"**

3. **Fill in OAuth App Details:**
   ```
   Application name: GitPulse Bot
   Homepage URL: https://devx-rho.vercel.app
   Application description: GitHub integration for GitPulse Slack bot
   Authorization callback URL: https://devx-rho.vercel.app/api/auth/github/slack
   ```

4. **Click "Register application"**

5. **Copy Your Credentials:**
   - **Client ID:** (looks like `Ov23li33WyHSeDnRbSSL`)
   - **Client Secret:** Click "Generate a new client secret" and copy it

### Step 2: Configure Environment Variables

**Update your `.env` file:**
```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_client_id_from_step_1
GITHUB_CLIENT_SECRET=your_client_secret_from_step_1

# Base URL for redirects
NEXTAUTH_URL=https://devx-rho.vercel.app
```

**Update Vercel Environment Variables:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add/Update these variables for **Production**:
   ```
   GITHUB_CLIENT_ID=your_client_id_from_step_1
   GITHUB_CLIENT_SECRET=your_client_secret_from_step_1
   NEXTAUTH_URL=https://devx-rho.vercel.app
   ```

### Step 3: Set Up Development Environment (Optional)

**For Local Development:**

1. **Create a separate GitHub OAuth App for development:**
   ```
   Application name: GitPulse Bot (Development)
   Homepage URL: http://localhost:9002
   Authorization callback URL: http://localhost:9002/api/auth/github/slack
   ```

2. **Update your local `.env` file:**
   ```bash
   # Development GitHub OAuth
   GITHUB_CLIENT_ID=your_dev_client_id
   GITHUB_CLIENT_SECRET=your_dev_client_secret
   NEXTAUTH_URL=http://localhost:9002
   ```

### Step 4: Configure Firebase (Required for Token Storage)

Your GitHub tokens are stored in Firebase. Make sure these are set:

```bash
# Firebase Configuration (already in your .env)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAlySz07mx0GfgZhq9c-X0BMXBe-eBgoDQ
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=studio-1512856463-cb519.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=studio-1512856463-cb519
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=studio-1512856463-cb519.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=809320154283
NEXT_PUBLIC_FIREBASE_APP_ID=1:809320154283:web:eb935fcf5224cd011fe3ee
```

### Step 5: Deploy and Test

1. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "Add GitHub OAuth configuration"
   git push
   ```

2. **Wait for deployment to complete**

3. **Test the OAuth Flow:**
   ```bash
   # In Slack, run:
   /gitpulse create-issue
   
   # If not authenticated, you should see:
   # "🔐 GitHub Authentication Required"
   # [🔗 Connect GitHub Account] button
   ```

## 🔧 OAuth Flow Explanation

### How It Works:
1. **User runs** `/gitpulse create-issue` in Slack
2. **Bot checks** if user has GitHub token in Firebase
3. **If not authenticated:**
   - Shows "Connect GitHub Account" button
   - Button redirects to: `https://devx-rho.vercel.app/api/auth/github/slack?user_id=U123&channel_id=C456`
4. **OAuth redirect** to GitHub with proper parameters
5. **User authorizes** GitPulse app on GitHub
6. **GitHub redirects back** to your callback URL with authorization code
7. **Your app exchanges code** for access token
8. **Token stored** in Firebase with Slack user ID mapping
9. **Success message** sent back to Slack

### OAuth URL Structure:
```
https://github.com/login/oauth/authorize?
  client_id=your_client_id&
  redirect_uri=https://devx-rho.vercel.app/api/auth/github/slack&
  scope=repo,user:email&
  state={"slack_user_id":"U123","channel_id":"C456","timestamp":1234567890}
```

## 🧪 Testing & Debugging

### Test OAuth Configuration:
Visit your debug endpoint to verify settings:
```
https://devx-rho.vercel.app/api/auth/github/debug
```

Expected response:
```json
{
  "environment": "production",
  "baseUrl": "https://devx-rho.vercel.app",
  "redirectUri": "https://devx-rho.vercel.app/api/auth/github/slack",
  "githubClientId": "Ov23li33WyHSeDnRbSSL",
  "hasGithubSecret": true
}
```

### Test Complete Flow:

1. **Run command in Slack:**
   ```
   /gitpulse create-issue
   ```

2. **Expected responses:**
   - **If not authenticated:** Shows GitHub connection button
   - **If authenticated:** Shows repository selection dropdown

3. **Check server logs** in Vercel for any errors

### Common Issues & Solutions:

**1. "redirect_uri_mismatch" Error:**
- Check that your GitHub app's callback URL exactly matches: `https://devx-rho.vercel.app/api/auth/github/slack`
- No trailing slashes
- Correct protocol (https vs http)

**2. "Firebase: No Firebase App '[DEFAULT]'" Error:**
- Verify all Firebase environment variables are set
- Check that Firebase config is correct

**3. "invalid_client" Error:**
- Verify GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are correct
- Check that the GitHub app exists and is not suspended

**4. Tokens not saving:**
- Check Firebase Firestore rules allow writes
- Verify Firebase is initialized properly

## 🎯 OAuth Scopes Explained

Your app requests these GitHub permissions:

- **`repo`** - Full access to repositories (read/write issues, code, etc.)
- **`user:email`** - Access to user's email address

### Why These Scopes?
- **`repo`** - Required to create issues in private repositories
- **`user:email`** - For better user identification and notifications

## 🔒 Security Best Practices

1. **Separate Apps:** Use different GitHub OAuth apps for dev/prod
2. **Environment Variables:** Never commit secrets to git
3. **Token Storage:** Encrypted in Firebase with proper access controls
4. **Scope Limitation:** Only request minimum required permissions
5. **Token Refresh:** Implement token refresh if needed (GitHub tokens don't expire by default)

## 📊 After Setup Success

Once configured, users will be able to:

1. **Connect GitHub** - One-time setup per user
2. **Select Repositories** - Dropdown of their repos
3. **Create Issues** - With title, description, and priority
4. **Auto-assignment** - Issues can be assigned to team members
5. **Secure Access** - Tokens stored safely in Firebase

## 🔄 Next Steps

After GitHub OAuth is working:

1. **Test issue creation** - Complete the form and create actual GitHub issues
2. **Add error handling** - Handle GitHub API rate limits and permissions
3. **Enhance features** - Add labels, assignees, milestones
4. **User management** - Allow users to disconnect/reconnect accounts

Your GitHub OAuth setup should now work perfectly with Slack! 🎉