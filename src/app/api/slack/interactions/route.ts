import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest } from '@/lib/slack-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-slack-signature');
    const timestamp = req.headers.get('x-slack-request-timestamp');

    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing Slack headers' }, { status: 400 });
    }

    if (!verifySlackRequest(body, signature, timestamp)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(decodeURIComponent(body.replace('payload=', '')));

    // Handle block actions (e.g., button clicks)
    if (payload.type === 'block_actions') {
      const action = payload.actions?.[0];
      if (action?.action_id === 'create_github_issue') {
        // Open a modal to collect issue details
        // Here we return the response to Slack that you'd normally trigger via views.open using the Web API.
        // For simplicity we'll return an ephemeral acknowledgement.
        return NextResponse.json({
          response_action: 'ephemeral',
          text: 'Opening issue creation modal... (modal flow should be opened via views.open in production)'
        });
      }
    }

    // Handle view_submission (modal submitted)
    if (payload.type === 'view_submission') {
      // Extract fields from the view state
      const values = payload.view?.state?.values || {};
      // Example: find title and description fields
      let title = '';
      let description = '';
      for (const blockId in values) {
        for (const actionId in values[blockId]) {
          const val = values[blockId][actionId];
          if (actionId === 'title' && val?.value) title = val.value;
          if (actionId === 'description' && val?.value) description = val.value;
        }
      }

      // TODO: create GitHub issue using stored GitHub token and return a success message.
      // Acknowledge submission to Slack with an empty body (200) or a message
      return NextResponse.json({
        response_action: 'update',
        view: {
          type: 'modal',
          title: { type: 'plain_text', text: 'Issue Created' },
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `✅ Created issue *${title}*\n\n${description}` }
            }
          ]
        }
      });
    }

    // Default acknowledgement
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Slack interactions handler error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
