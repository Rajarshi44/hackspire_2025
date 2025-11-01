import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest, isUserAllowed, isChannelAllowed } from '@/lib/slack-utils';

/**
 * Fetch user's GitHub repositories for Slack integration
 */
export async function POST(req: NextRequest) {
  try {
    const { slackUserId } = await req.json();

    if (!slackUserId) {
      return NextResponse.json({ error: 'Slack user ID required' }, { status: 400 });
    }

    // Enforce allowlists
    if (!isUserAllowed(slackUserId)) {
      return NextResponse.json({ error: 'User not allowed' }, { status: 403 });
    }

    // Get user's GitHub token from Firestore
    const { slackUserService } = await import('@/lib/slack-user-service');
    const githubToken = await slackUserService.getGitHubToken(slackUserId);
    
    if (!githubToken) {
      return NextResponse.json({ error: 'User not connected to GitHub' }, { status: 401 });
    }

    // Fetch user's repositories from GitHub
    const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!reposResponse.ok) {
      throw new Error('Failed to fetch repositories from GitHub');
    }

    const repos = await reposResponse.json();

    // Format repositories for Slack selection
    const formattedRepos = repos
      .filter((repo: any) => !repo.fork && !repo.archived) // Only show non-forked, non-archived repos
      .map((repo: any) => ({
        value: repo.full_name,
        text: {
          type: 'plain_text',
          text: `${repo.full_name} ${repo.private ? '🔒' : '🌐'}`,
        },
        description: {
          type: 'plain_text',
          text: repo.description || 'No description',
        },
      }))
      .slice(0, 20); // Limit to 20 repos for UI purposes

    return NextResponse.json({
      repositories: formattedRepos,
      total: repos.length,
    });

  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch repositories',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET handler for health checks
export async function GET() {
  return NextResponse.json({ 
    message: 'Slack repositories endpoint is active',
    method: 'POST',
    note: 'This endpoint only accepts POST requests'
  });
}

// Function removed - now using slackUserService