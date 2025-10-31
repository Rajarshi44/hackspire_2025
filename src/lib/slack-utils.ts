import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify Slack request signature using signing secret.
 * Returns false if signature/timestamp missing or invalid.
 */
export function verifySlackRequest(body: string, signature: string | null, timestamp: string | null) {
  console.log('Verifying Slack request:', {
    hasSignature: !!signature,
    hasTimestamp: !!timestamp,
    timestampValue: timestamp,
    bodyLength: body?.length,
    signaturePrefix: signature?.substring(0, 10)
  });

  if (!signature || !timestamp) {
    console.error('Missing signature or timestamp');
    return false;
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('Missing SLACK_SIGNING_SECRET environment variable');
    return false;
  }

  // Validate timestamp (prevent replay attacks)
  const timestampNum = parseInt(timestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(currentTime - timestampNum);
  
  console.log('Timestamp validation:', {
    requestTimestamp: timestampNum,
    currentTimestamp: currentTime,
    timeDifference: timeDiff,
    maxAllowed: 300 // 5 minutes
  });

  // Allow up to 5 minutes difference (Slack requirement)
  if (timeDiff > 300) {
    console.error('Request timestamp too old:', { timeDiff, maxAllowed: 300 });
    return false;
  }

  // Build the signature string
  const baseString = `v0:${timestamp}:${body}`;
  const expected = `v0=${createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;

  console.log('🔐 Signature calculation details:', {
    signingSecretLength: signingSecret.length,
    signingSecretPrefix: signingSecret.substring(0, 8) + '...',
    timestampValue: timestamp,
    bodyLength: body.length,
    bodyHash: createHmac('sha256', 'test').update(body).digest('hex').substring(0, 8) + '...',
    baseStringLength: baseString.length,
    baseStringPrefix: baseString.substring(0, 50) + '...'
  });

  console.log('Signature comparison:', {
    expectedLength: expected.length,
    receivedLength: signature.length,
    expectedFull: expected,
    receivedFull: signature,
    match: expected === signature
  });

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    
    // Use timingSafeEqual when buffers are same length
    if (a.length !== b.length) {
      console.error('Signature length mismatch:', { expected: a.length, received: b.length });
      return false;
    }
    
    const isValid = timingSafeEqual(a, b);
    console.log('Signature verification result:', isValid);
    return isValid;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

/**
 * Check whether a Slack user is allowed to perform actions.
 * If SLACK_USER_ALLOWLIST is empty or unset, all users are allowed.
 * Otherwise it should be a comma-separated list of Slack user IDs (e.g. U12345,U67890).
 */
export function isUserAllowed(userId?: string | null) {
  const list = process.env.SLACK_USER_ALLOWLIST || '';
  if (!list) return true; // no allowlist configured -> allow all
  const allowed = list.split(',').map(s => s.trim()).filter(Boolean);
  if (!userId) return false;
  return allowed.includes(userId);
}

/**
 * Check whether a Slack channel is allowed. Optional. If unset, all channels allowed.
 */
export function isChannelAllowed(channelId?: string | null) {
  const list = process.env.SLACK_CHANNEL_ALLOWLIST || '';
  if (!list) return true;
  const allowed = list.split(',').map(s => s.trim()).filter(Boolean);
  if (!channelId) return false;
  return allowed.includes(channelId);
}
