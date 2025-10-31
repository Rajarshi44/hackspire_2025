# Slack Bot Setup (GitPulse)

This document explains how to configure and run the Slack bot portion of this project locally and in production.

## Overview

The app includes Slack endpoints under `src/app/api/slack/*` to handle slash commands, interactive components, events, and repository list fetching. Incoming requests are verified using `SLACK_SIGNING_SECRET`. The app currently uses a GitHub token stored in `GITHUB_TOKEN` for creating issues — consider using OAuth or a GitHub App for per-user actions.

## 1) Create a Slack App

1. Open https://api.slack.com/apps and click "Create New App".
2. Choose "From scratch", give it a name (e.g. GitPulse), and select the workspace to install it to.
3. In "Add features and functionality":
   - Enable "OAuth & Permissions"
     - Add Bot Token Scopes the bot needs, for example:
       - chat:write, chat:write.public
       - commands
       - users:read (optional)
       - im:write (if you send DMs)
       - channels:read (optional)
     - Save and Install the app to the workspace. Copy the Bot User OAuth Token (starts with `xoxb-`) into your `.env` as `SLACK_BOT_TOKEN`.
   - Enable "Interactivity & Shortcuts"
     - Set Request URL to `https://<your-host>/api/slack/interactive` (use ngrok / local proxy for local testing). This is used for button clicks and modals.
   - Create a Slash Command (optional)
     - Command: `/gitpulse`
     - Request URL: `https://<your-host>/api/slack/commands`
     - Short description and usage hint as desired.
   - Enable "Event Subscriptions" (optional)
     - Turn on events and set Request URL to `https://<your-host>/api/slack/events`.
     - Subscribe to workspace events like `app_mention` and `message.channels` if you want automatic message analysis.

4. In "Basic Information" copy the "Signing Secret" and put it in your `.env` as `SLACK_SIGNING_SECRET`.

5. (Optional) If you use Socket Mode instead of public endpoints, set up `SLACK_APP_TOKEN` and configure the bot accordingly.

## 2) Environment variables

Create a `.env` file in the project root (this repository already has `.env` ignored in `.gitignore`). Minimum variables for Slack + GitHub:

```env
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...   # optional (Socket Mode)

# Allowlist (leave empty to allow all Slack users/channels)
SLACK_USER_ALLOWLIST=
SLACK_CHANNEL_ALLOWLIST=

# GitHub
GITHUB_TOKEN=ghp_...      # or leave empty if using per-user tokens via OAuth

# Next.js
NEXTAUTH_URL=http://localhost:9002
```

Notes:
- If `SLACK_USER_ALLOWLIST` or `SLACK_CHANNEL_ALLOWLIST` are empty, the bot allows all users and channels (useful for development).
- For production, prefer storing these in your cloud provider's secrets manager or GitHub Actions secrets, not in plain `.env`.

## 3) Local testing (recommended)

1. Expose your local server to Slack using ngrok or similar. Example (PowerShell):

```powershell
# Install ngrok and run
ngrok http 9002
# Note the https forwarding URL that ngrok provides (e.g. https://abcd1234.ngrok.io)
```

2. Update the Slack App Request URLs to point at `https://<ngrok-id>.ngrok.io/api/slack/commands`, `/interactive`, and `/events`.

3. Start the Next.js dev server:

```powershell
# from project root
pnpm dev
# or
pnpm run dev
```

4. Test the slash command or mention the bot in a channel. Watch the server logs for incoming requests and signature verification messages.

## 4) Security & best practices

- Never commit `.env` to git; use your platform's secret store for production.
- Use a least-privilege GitHub token or a GitHub App/OAuth to avoid actions being executed as a single user.
- Rotate tokens regularly.
- Enable monitoring and logs for actions the bot performs on GitHub.

## 5) Troubleshooting

- 401 Invalid signature: ensure the `SLACK_SIGNING_SECRET` is correct and that your request URL receives the raw body (our endpoints compute signature using the exact request body text).
- 403 User not allowed: `SLACK_USER_ALLOWLIST` is set and does not include the triggering user.
- Events not delivered: ensure Slack receives a successful 200/200-like response during URL verification and challenge flow.

## 6) Next improvements (optional)

- Implement OAuth flow so each Slack user connects their GitHub account (recommended for per-user GitHub actions).
- Replace Personal Access Token with a GitHub App for better security and installation-based permissions.
- Add request/response logging and per-user auditing of actions that touch GitHub.

---
If you want, I can also add a short README entry to the project `README.md` or create a step-by-step script to automate parts of the Slack app setup.
