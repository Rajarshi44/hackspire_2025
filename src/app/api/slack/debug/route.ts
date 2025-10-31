import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('Debug endpoint called');
  
  try {
    const body = await req.text();
    const signature = req.headers.get('x-slack-signature');
    const timestamp = req.headers.get('x-slack-request-timestamp');
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        hasSlackSigningSecret: !!process.env.SLACK_SIGNING_SECRET,
        hasSlackBotToken: !!process.env.SLACK_BOT_TOKEN,
        hasGoogleGenaiApiKey: !!process.env.GOOGLE_GENAI_API_KEY,
        nodeEnv: process.env.NODE_ENV,
      },
      request: {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        signatureLength: signature?.length,
        timestampValue: timestamp,
        bodyLength: body.length,
        contentType: req.headers.get('content-type'),
        userAgent: req.headers.get('user-agent'),
      },
      headers: Object.fromEntries(req.headers.entries()),
    };

    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      message: 'Debug information logged. Check server logs for details.'
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Slack Debug Endpoint',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    status: 'ok'
  });
}