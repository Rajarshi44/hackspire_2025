import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest, isUserAllowed, isChannelAllowed } from '@/lib/slack-utils';

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
        console.error('Failed to send Slack message:', await response.text());
      }
    }

    // Handle message events in channels where the bot is added
    if (data.type === 'event_callback' && data.event.type === 'message' && !data.event.subtype) {
      const event = data.event;
      
      // Skip bot messages
      if (event.bot_id) {
        return NextResponse.json({ ok: true });
      }

      try {
        // Import the enhanced Slack AI service
        const { slackAIService } = await import('@/lib/slack-ai-service-enhanced');
        
        // Automatically analyze the message for potential issues
        const analysis = await slackAIService.autoAnalyzeMessage(
          event.channel,
          event.text,
          event.user
        );

        // If AI detects a potential issue, send a suggestion
        if (analysis.shouldSuggest && analysis.issueData) {
          await slackAIService.sendIssueSuggestion(
            event.channel,
            event.user,
            analysis.issueData,
            analysis.userHasGitHub,
            analysis.userRepos
          );
        }
      } catch (error) {
        console.error('Error in automatic message analysis:', error);
        // Don't fail the webhook if AI analysis fails
      }
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