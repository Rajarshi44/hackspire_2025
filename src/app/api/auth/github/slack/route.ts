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
    
    // If we don't have a direct user_id (button URL), try to extract it from a provided `state` query
    let finalSlackUserId = slackUserId;
    let finalChannelId = channelId;

    if (!finalSlackUserId && state) {
      try {
        const parsed = JSON.parse(state);
        finalSlackUserId = parsed.slack_user_id || finalSlackUserId;
        finalChannelId = parsed.channel_id || finalChannelId;
      } catch (e) {
        // ignore parse errors - we'll handle missing user below
      }
    }

    if (!finalSlackUserId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    // ALWAYS use production URL for OAuth callback
    // This ensures consistency with GitHub OAuth app registration
    const redirectUri = 'https://devx-rho.vercel.app/api/auth/github/slack';
    
    console.log('🔗 GitHub OAuth redirect setup:', {
      redirectUri,
      clientId: process.env.GITHUB_CLIENT_ID
    });

    const githubOAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubOAuthUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!);
    githubOAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubOAuthUrl.searchParams.set('scope', 'repo,user:email');

    // Build state payload with Slack user info
    const statePayload = {
      slack_user_id: finalSlackUserId,
      channel_id: finalChannelId,
      timestamp: Date.now(),
    };

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
          const targetChannel = channelId || slackUserId;
          
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
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              text-align: center; 
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container { 
              max-width: 400px;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }
            .success { 
              color: #28a745;
              font-size: 48px;
              margin: 0 0 20px 0;
            }
            h1 {
              color: #333;
              margin: 20px 0;
            }
            p {
              color: #666;
              line-height: 1.6;
            }
            .github-info {
              background: #f6f8fa;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .github-info strong {
              color: #333;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h1>GitHub Connected!</h1>
            <div class="github-info">
              <strong>${userData.login}</strong><br>
              ${userData.email ? `📧 ${userData.email}` : ''}
            </div>
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
    
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head><title>Connection Error</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Connection Error</h1>
          <p>Failed to authenticate with GitHub</p>
          <p style="color: #666; font-size: 14px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
          <p>Please try again from Slack.</p>
          <script>setTimeout(() => window.close(), 5000);</script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
      status: 500
    });
  }
}