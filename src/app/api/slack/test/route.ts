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
    const body = await req.text();
    
    console.log('Slack webhook test received:', {
      headers: Object.fromEntries(req.headers.entries()),
      body: body.substring(0, 500) // Log first 500 chars
    });
    
    return NextResponse.json({
      response_type: 'ephemeral',
      text: '✅ Test successful! Bot is responding.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🧪 *Test Results*\n\n✅ Bot is running\n✅ API endpoint responding\n✅ Environment: ${process.env.NODE_ENV}\n\nTimestamp: ${new Date().toISOString()}`
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