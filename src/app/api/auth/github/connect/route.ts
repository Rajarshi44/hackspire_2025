import { NextRequest, NextResponse } from 'next/server';

/**
 * Initiate GitHub OAuth flow from Slack
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slackUserId = searchParams.get('user_id');

  if (!slackUserId) {
    return NextResponse.json({ error: 'Slack user ID required' }, { status: 400 });
  }

  // GitHub OAuth parameters
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/github/slack`;
  
  // Encode Slack user info in state parameter
  const state = encodeURIComponent(JSON.stringify({
    slack_user_id: slackUserId,
    timestamp: Date.now(),
  }));

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', clientId!);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'repo user');
  githubAuthUrl.searchParams.set('state', state);

  // Redirect to GitHub OAuth
  return NextResponse.redirect(githubAuthUrl.toString());
}