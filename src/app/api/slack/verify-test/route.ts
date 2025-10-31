import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest } from '@/lib/slack-utils';

export async function POST(req: NextRequest) {
  console.log('🧪 Raw verification test');
  
  try {
    // Get the raw body exactly as Slack sends it
    const body = await req.text();
    const signature = req.headers.get('x-slack-signature');
    const timestamp = req.headers.get('x-slack-request-timestamp');
    
    console.log('Raw data:', {
      signature,
      timestamp,
      bodyRaw: body,
      bodyBytes: Buffer.from(body, 'utf8').length,
      headers: Object.fromEntries(req.headers.entries())
    });

    // Manual signature verification for debugging
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (signingSecret && signature && timestamp) {
      const crypto = require('crypto');
      const baseString = `v0:${timestamp}:${body}`;
      const expectedSig = `v0=${crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;
      
      console.log('Manual verification:', {
        baseString: baseString.substring(0, 100) + '...',
        expectedSig,
        receivedSig: signature,
        match: expectedSig === signature
      });
    }

    const isValid = verifySlackRequest(body, signature, timestamp);
    
    return NextResponse.json({
      success: true,
      verified: isValid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Raw test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}