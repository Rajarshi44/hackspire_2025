import { NextRequest, NextResponse } from 'next/server';

/**
 * GitHub OAuth callback specifically for Slack integrations
 * This handles the OAuth flow when users connect GitHub from Slack
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const user_id = searchParams.get('user_id'); // Direct from button URL
  const channel_id = searchParams.get('channel_id'); // Direct from button URL

  console.log('GitHub OAuth callback:', { 
    hasCode: !!code, 
    hasState: !!state, 
    error, 
    user_id, 
    channel_id 
  });

  if (error) {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head><title>GitHub Connection Failed</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ GitHub Connection Failed</h1>
          <p>Error: ${error}</p>
          <p>Please try again from Slack.</p>
          <script>setTimeout(() => window.close(), 5000);</script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }

  // If no code, redirect to GitHub OAuth
  if (!code) {
    const slackUserId = user_id;
    const channelId = channel_id;
    
    if (!slackUserId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    // Build GitHub OAuth URL with correct redirect URI
    // Prefer the request origin (works for Vercel previews / deployments). Fall back to env vars.
    const origin = req.headers.get('origin') || req.headers.get('referer') || '';
    const baseUrl = origin
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      || process.env.NEXTAUTH_URL
      || 'http://localhost:9002';

    const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/auth/github/slack`;
    
    console.log('🔗 GitHub OAuth redirect setup:', {
      baseUrl,
      redirectUri,
      vercelUrl: process.env.VERCEL_URL,
      nextAuthUrl: process.env.NEXTAUTH_URL
    });

    const githubOAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubOAuthUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!);
    // ensure redirect_uri is an absolute URL and URL-encoded by the URL API
    githubOAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubOAuthUrl.searchParams.set('scope', 'repo,user:email'); // Permissions needed

    // Build a defensively-encoded state payload. Always include slack ids we have.
    const statePayload = {
      slack_user_id: slackUserId,
      channel_id: channelId,
      timestamp: Date.now(),
    } as Record<string, any>;

    githubOAuthUrl.searchParams.set('state', JSON.stringify(statePayload));

    console.log('Redirecting to GitHub OAuth:', githubOAuthUrl.toString());
    return NextResponse.redirect(githubOAuthUrl.toString());
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || 'Failed to get access token');
    }

    // Get user information from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    // Parse state to get Slack user info
    const stateData = state ? JSON.parse(state) : {};
    const slackUserId = stateData.slack_user_id || user_id;
    const channelId = stateData.channel_id || channel_id;

    console.log('Processing GitHub OAuth success:', { 
      slackUserId, 
      channelId, 
      githubUsername: userData.login 
    });

    if (slackUserId) {
      try {
        // Store the GitHub token and user info in Firestore
        const { slackUserService } = await import('@/lib/slack-user-service');
        await slackUserService.storeGitHubAuth(slackUserId, {
          access_token: tokenData.access_token,
          github_user: userData,
        });

        console.log('GitHub auth stored successfully for user:', slackUserId);

        // Send a success message to the Slack channel or user
        try {
          const { slackAIService } = await import('@/lib/slack-ai-service');
          const targetChannel = channelId || slackUserId; // Send to channel if available, otherwise DM
          
          await slackAIService.sendMessage(
            targetChannel,
            '',
            [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `✅ *GitHub Connected Successfully!*\n\n🔗 **Account:** ${userData.login}\n📧 **Email:** ${userData.email || 'Not provided'}\n📁 **Public Repos:** ${userData.public_repos || 0}`
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn', 
                  text: '🎉 You can now create GitHub issues directly from Slack!\n\nTry: `/gitpulse create-issue`'
                }
              }
            ]
          );
          console.log('Success message sent to Slack');
        } catch (slackError) {
          console.error('Failed to send Slack message:', slackError);
          // Don't fail the whole process if Slack message fails
        }
      } catch (storageError) {
        console.error('Failed to store GitHub auth:', storageError);
        throw storageError;
      }
    }

    // Return a success page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GitHub Connected - GitPulse</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; }
            .container { max-width: 400px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✅ GitHub Connected!</h1>
            <p>Your GitHub account has been successfully connected to GitPulse.</p>
            <p>You can now close this window and return to Slack.</p>
            <script>
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.json({ 
      error: 'Failed to authenticate with GitHub',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Store user GitHub authentication data
 * TODO: Implement with Firestore
 */
async function storeUserGitHubAuth(slackUserId: string, githubData: any) {
  // This is a placeholder - implement with your Firestore setup
  console.log('TODO: Store GitHub auth for Slack user', slackUserId, {
    github_username: githubData.github_user.login,
    has_token: !!githubData.access_token,
  });
  
  // Example Firestore implementation:
  /*
  const db = getFirestore();
  await db.collection('slack_users').doc(slackUserId).set({
    github_token: githubData.access_token,
    github_user: githubData.github_user,
    connected_at: new Date(),
  }, { merge: true });
  */
}