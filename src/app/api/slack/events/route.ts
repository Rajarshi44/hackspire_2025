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
      
      console.log('🗣️ App mention received:', {
        channel: event.channel,
        user: event.user,
        text: event.text?.substring(0, 100),
        hasBot: !!event.bot_id
      });
      
      // Send a response back to Slack
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: event.channel,
          text: `Hi <@${event.user}>! I'm GitPulse, your AI teammate. I can help you create GitHub issues from your conversations. Try using slash commands like \`/gitpulse analyze\`!\n\n🧪 Debug: I'm also monitoring all messages for potential issues to suggest.`,
        }),
      });

      if (!response.ok) {
        console.error('❌ Failed to send app mention response:', await response.text());
      } else {
        console.log('✅ App mention response sent successfully');
      }
    }

    // Handle message events in channels where the bot is added
    if (data.type === 'event_callback' && data.event.type === 'message' && !data.event.subtype) {
      const event = data.event;
      
      console.log('📨 Received message event:', {
        channel: event.channel,
        user: event.user,
        text: event.text?.substring(0, 100) + (event.text?.length > 100 ? '...' : ''),
        hasBot: !!event.bot_id,
        hasUser: !!event.user,
        messageLength: event.text?.length
      });
      
      // Skip bot messages
      if (event.bot_id) {
        console.log('⏭️ Skipping bot message');
        return NextResponse.json({ ok: true });
      }

      // Skip messages without text
      if (!event.text || event.text.trim().length === 0) {
        console.log('⏭️ Skipping empty message');
        return NextResponse.json({ ok: true });
      }

      try {
        console.log('🤖 Starting AI analysis for message...');
        
        // Import the enhanced Slack AI service
        const { slackAIService } = await import('@/lib/slack-ai-service-enhanced');
        
        // Automatically analyze the message for potential issues
        const analysis = await slackAIService.autoAnalyzeMessage(
          event.channel,
          event.text,
          event.user
        );

        console.log('🔍 AI Analysis result:', {
          shouldSuggest: analysis.shouldSuggest,
          hasIssueData: !!analysis.issueData,
          userHasGitHub: analysis.userHasGitHub,
          userReposCount: analysis.userRepos?.length || 0,
          issueTitle: analysis.issueData?.title || 'N/A'
        });

        // If AI detects a potential issue, send a suggestion
        if (analysis.shouldSuggest && analysis.issueData) {
          console.log('📢 Sending issue suggestion to user...');
          const suggestionSent = await slackAIService.sendIssueSuggestion(
            event.channel,
            event.user,
            analysis.issueData,
            analysis.userHasGitHub,
            analysis.userRepos
          );
          
          console.log('✅ Issue suggestion sent:', suggestionSent);
        } else {
          console.log('ℹ️ No issue detected or suggestion not needed');
        }
      } catch (error) {
        console.error('❌ Error in automatic message analysis:', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          channel: event.channel,
          user: event.user
        });
        
        // Send a simple test message to verify bot connectivity
        try {
          const testResponse = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: event.channel,
              text: `🔧 Debug: I received your message but had an issue with AI analysis. Message: "${event.text?.substring(0, 50)}..."`
            }),
          });
          
          if (!testResponse.ok) {
            console.error('❌ Test message also failed:', await testResponse.text());
          } else {
            console.log('✅ Test message sent successfully');
          }
        } catch (testError) {
          console.error('❌ Test message error:', testError);
        }
        
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