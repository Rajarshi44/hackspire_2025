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

  if (error) {
    return NextResponse.json({ error: 'GitHub OAuth failed' }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
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

    // Parse state to get Slack user info (you can encode this in the initial OAuth URL)
    const stateData = state ? JSON.parse(decodeURIComponent(state)) : {};
    const slackUserId = stateData.slack_user_id;

    if (slackUserId) {
      // Store the GitHub token and user info in Firestore
      const { slackUserService } = await import('@/lib/slack-user-service');
      await slackUserService.storeGitHubAuth(slackUserId, {
        access_token: tokenData.access_token,
        github_user: userData,
      });

      // Send a success message to the Slack user
      const { slackAIService } = await import('@/lib/slack-ai-service-enhanced');
      await slackAIService.sendMessage(
        slackUserId, // DM the user
        `✅ GitHub connected successfully!\n\nYour GitHub account **${userData.login}** is now linked. I can now help you create issues in your repositories automatically!`
      );
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