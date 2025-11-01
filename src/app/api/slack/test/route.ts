import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'GitPulse Slack Integration is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      events: '/api/slack/events',
      commands: '/api/slack/commands', 
      interactive: '/api/slack/interactive'
    }
  });
}

export async function POST(req: NextRequest) {
  console.log('🧪 Test endpoint called');
  
  try {
    const contentType = req.headers.get('content-type');
    let body, params;
    
    if (contentType?.includes('application/json')) {
      // JSON request for manual testing
      const jsonBody = await req.json();
      const { message, userId, channelId } = jsonBody;

      console.log('🧪 Manual test request:', { message, userId, channelId });

      if (message) {
        // Import the enhanced Slack AI service
        const { slackAIService } = await import('@/lib/slack-ai-service-enhanced');
        
        // Test the auto-analyze functionality
        const analysis = await slackAIService.autoAnalyzeMessage(
          channelId || 'C1234567890', // Default test channel
          message,
          userId || 'U1234567890' // Default test user
        );

        console.log('🧪 Test analysis result:', analysis);

        return NextResponse.json({
          success: true,
          analysis,
          message: 'Analysis completed',
          testMode: true
        });
      }
    } else {
      // Slack webhook format
      body = await req.text();
      console.log('Slack webhook test received:', {
        headers: Object.fromEntries(req.headers.entries()),
        body: body.substring(0, 500) // Log first 500 chars
      });
    }
    
    return NextResponse.json({
      response_type: 'ephemeral',
      text: '✅ Test successful! Bot is responding.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🧪 *Test Results*\n\n✅ Bot is running\n✅ API endpoint responding\n✅ Environment: ${process.env.NODE_ENV}\n\nTo test AI analysis, send a JSON POST with:\n\`\`\`\n{\n  "message": "This bug needs to be fixed",\n  "userId": "U123",\n  "channelId": "C123"\n}\n\`\`\`\n\nTimestamp: ${new Date().toISOString()}`
          }
        }
      ]
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      response_type: 'ephemeral',
      text: '❌ Test failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}