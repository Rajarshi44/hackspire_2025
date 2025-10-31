import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify Slack request signature using signing secret.
 * Returns false if signature/timestamp missing or invalid.
 */
export function verifySlackRequest(body: string, signature: string | null, timestamp: string | null) {
  if (!signature || !timestamp) return false;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.warn('Missing SLACK_SIGNING_SECRET');
    return false;
  }

  const baseString = `v0:${timestamp}:${body}`;
  const expected = `v0=${createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    // Use timingSafeEqual when buffers are same length
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch (err) {
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
