import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest, isUserAllowed, isChannelAllowed } from '@/lib/slack-utils';
import { ai } from '@/ai/genkit';
import { aiCreateGithubIssue } from '@/ai/flows/ai-creates-github-issues';

/**
 * Process a message for potential GitHub issues using Gemini AI
 */
async function processMessageForIssues(
  channelId: string,
  messageText: string,
  userId: string
): Promise<void> {
  try {
    // Check for issue keywords first
    const issueKeywords = ['bug', 'error', 'broken', 'fix', 'issue', 'problem', 'crash', 'feature', 'add', 'need', 'should', 'implement', 'todo'];
    const hasIssueKeywords = issueKeywords.some(keyword => 
      messageText.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!hasIssueKeywords) {
      return;
    }

    // Use Gemini AI to analyze the message
    const issueAnalysis = await analyzeMessageWithGemini(messageText);
    
    if (!issueAnalysis.isIssue) {
      return;
    }

    // Check user's GitHub integration
    const { slackUserService } = await import('@/lib/slack-user-service');
    const hasGitHub = await slackUserService.hasGitHubAuth(userId);
    
    if (hasGitHub) {
      // Create issue directly if user preferences allow
      await createIssueFromAnalysis(
        channelId,
        userId,
        issueAnalysis,
        await slackUserService.getGitHubToken(userId)
      );
    } else {
      // Send suggestion to connect GitHub
      await sendGitHubConnectionSuggestion(channelId, userId, issueAnalysis);
    }
  } catch (error) {
    console.error('Error in processMessageForIssues:', error);
  }
}

/**
 * Analyze message using Gemini AI to detect potential issues
 */
async function analyzeMessageWithGemini(messageText: string): Promise<{
  isIssue: boolean;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  type?: 'bug' | 'feature' | 'enhancement';
}> {
  try {
    const prompt = `
Analyze this message to determine if it describes a software issue, bug report, or feature request:

"${messageText}"

Respond with JSON in this exact format:
{
  "isIssue": boolean,
  "title": "Brief title if it's an issue",
  "description": "Detailed description if it's an issue",
  "priority": "low|medium|high",
  "type": "bug|feature|enhancement"
}

Only set isIssue to true if the message clearly describes:
- A bug or error
- A feature request
- An enhancement suggestion
- A technical problem

Do not detect issues for:
- General conversation
- Questions
- Status updates
- Greetings`;

    const response = await (ai as any).chat({ 
      messages: [{ role: 'user', content: [{ text: prompt }] }]
    });
    
    const content = response.text();
    const jsonMatch = content.match(/\{[^}]+\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { isIssue: false };
  } catch (error) {
    console.error('Error in Gemini analysis:', error);
    return { isIssue: false };
  }
}

/**
 * Create a GitHub issue from the AI analysis
 */
async function createIssueFromAnalysis(
  channelId: string,
  userId: string,
  analysis: any,
  githubToken: string | null
): Promise<void> {
  try {
    if (!githubToken) {
      return;
    }

    // Get user's repositories
    const repos = await getUserRepositories(githubToken);
    
    if (repos.length === 0) {
      await sendNoRepositoriesMessage(channelId, userId, analysis);
      return;
    }

    // For now, use the first repository (could be enhanced with user selection)
    const [repoOwner, repoName] = repos[0].split('/');
    
    // Create the GitHub issue
    const result = await aiCreateGithubIssue({
      repoOwner,
      repoName,
      issueTitle: analysis.title,
      issueDescription: analysis.description,
      accessToken: githubToken
    });

    // Send success message
    await sendSuccessMessage(channelId, analysis.title, result.issueUrl);
  } catch (error) {
    console.error('Error creating issue from analysis:', error);
    await sendErrorMessage(channelId, 'Failed to create GitHub issue');
  }
}

/**
 * Get user's GitHub repositories
 */
async function getUserRepositories(githubToken: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=10&sort=updated', {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return [];
    }

    const repos = await response.json();
    return repos
      .filter((repo: any) => !repo.fork && !repo.archived)
      .map((repo: any) => repo.full_name);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return [];
  }
}

/**
 * Send a message suggesting GitHub connection
 */
async function sendGitHubConnectionSuggestion(
  channelId: string,
  userId: string,
  analysis: any
): Promise<void> {
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        text: `🤖 I detected a potential ${analysis.type}: "${analysis.title}"\n\nConnect your GitHub account to automatically create issues from your messages.`,
        blocks: [{
          type: 'actions',
          elements: [{
            type: 'button',
            text: { type: 'plain_text', text: 'Connect GitHub' },
            url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/github?redirect=slack&user_id=${userId}`
          }]
        }]
      }),
    });
  } catch (error) {
    console.error('Error sending GitHub connection suggestion:', error);
  }
}

/**
 * Send success message after creating an issue
 */
async function sendSuccessMessage(
  channelId: string,
  issueTitle: string,
  issueUrl: string
): Promise<void> {
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        text: `✅ Created GitHub issue: "${issueTitle}"\n${issueUrl}`,
      }),
    });
  } catch (error) {
    console.error('Error sending success message:', error);
  }
}

/**
 * Send error message
 */
async function sendErrorMessage(channelId: string, message: string): Promise<void> {
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        text: `❌ ${message}`,
      }),
    });
  } catch (error) {
    console.error('Error sending error message:', error);
  }
}

/**
 * Send message when user has no repositories
 */
async function sendNoRepositoriesMessage(
  channelId: string,
  userId: string,
  analysis: any
): Promise<void> {
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        text: `🤖 I detected a potential ${analysis.type}: "${analysis.title}"\n\nI couldn't find any repositories in your GitHub account to create this issue.`,
      }),
    });
  } catch (error) {
    console.error('Error sending no repositories message:', error);
  }
}

// Handle Slack events
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-slack-signature');
    const timestamp = req.headers.get('x-slack-request-timestamp');

    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing Slack headers' }, { status: 400 });
    }

    // Verify the request is from Slack
    if (!verifySlackRequest(body, signature, timestamp)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const data = JSON.parse(body);

    // Handle URL verification challenge (respond with raw challenge string as text/plain)
    if (data.type === 'url_verification') {
      return new NextResponse(data.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Enforce allowlists (best-effort - event payload shapes vary)
    const eventUser = data.event?.user ?? data.event?.bot_user_id ?? null;
    const eventChannel = data.event?.channel ?? null;
    if (!isUserAllowed(eventUser)) return NextResponse.json({ error: 'User not allowed' }, { status: 403 });
    if (!isChannelAllowed(eventChannel)) return NextResponse.json({ error: 'Channel not allowed' }, { status: 403 });

    // Handle app mention events
    if (data.type === 'event_callback' && data.event.type === 'app_mention') {
      const event = data.event;
      
      // Send a response back to Slack
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: event.channel,
          text: `Hi <@${event.user}>! I'm GitPulse, your AI teammate. I can help you create GitHub issues from your conversations. Try using slash commands like \`/gitpulse analyze\`!`,
        }),
      });

      if (!response.ok) {
        console.error('Failed to send app mention response:', await response.text());
      }
    }

    // Handle message events in channels where the bot is added
    if (data.type === 'event_callback' && data.event.type === 'message' && !data.event.subtype) {
      const event = data.event;
      
      // Skip bot messages and empty messages
      if (event.bot_id || !event.text || event.text.trim().length === 0) {
        return NextResponse.json({ ok: true });
      }

      // Process message for potential issues in background
      processMessageForIssues(event.channel, event.text, event.user).catch((error) => {
        console.error('Error processing message for issues:', error);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Slack event handler error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Slack app is running!' });
}