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
  const body = await req.text();
  
  console.log('Slack webhook test received:', {
    headers: Object.fromEntries(req.headers.entries()),
    body: body.substring(0, 500) // Log first 500 chars
  });
  
  return NextResponse.json({ 
    received: true,
    message: 'Test webhook received successfully' 
  });
}