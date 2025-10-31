import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// Verify Slack request signature
function verifySlackRequest(body: string, signature: string, timestamp: string) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;
  const baseString = `v0:${timestamp}:${body}`;
  const expectedSignature = `v0=${createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;
  return signature === expectedSignature;
}

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

    // Parse form data from Slack
    const formData = new URLSearchParams(body);
    const command = formData.get('command');
    const text = formData.get('text');
    const userId = formData.get('user_id');
    const channelId = formData.get('channel_id');

    // Handle /gitpulse command
    if (command === '/gitpulse') {
      const subcommand = text?.trim().split(' ')[0] || 'help';

      switch (subcommand) {
        case 'analyze':
          try {
            // Import and use the Slack AI service
            const { slackAIService } = await import('@/lib/slack-ai-service');
            const analysisResult = await slackAIService.analyzeChannelForIssues(channelId!);
            
            if (analysisResult.hasIssue) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: analysisResult.message,
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `🔍 *Analysis Complete*\n\n${analysisResult.message}\n\n**Priority:** ${analysisResult.issueData?.priority}\n**Description:** ${analysisResult.issueData?.description}`
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: 'Create GitHub Issue'
                        },
                        action_id: 'create_github_issue',
                        style: 'primary'
                      }
                    ]
                  }
                ]
              });
            } else {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: analysisResult.message,
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `🔍 *Analysis Complete*\n\n${analysisResult.message}`
                    }
                  }
                ]
              });
            }
          } catch (error) {
            console.error('Error analyzing messages:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: '❌ Error analyzing messages. Please try again.',
            });
          }

        case 'create-issue':
          return NextResponse.json({
            response_type: 'ephemeral',
            text: '📝 Let\'s create a GitHub issue!',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '📝 *Create GitHub Issue*\n\nI can help you turn your ideas into actionable GitHub issues. What would you like to work on?'
                }
              },
              {
                type: 'input',
                block_id: 'issue_title',
                element: {
                  type: 'plain_text_input',
                  action_id: 'title',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Enter issue title...'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: 'Issue Title'
                }
              }
            ]
          });

        case 'help':
        default:
          return NextResponse.json({
            response_type: 'ephemeral',
            text: 'GitPulse - Your AI Development Assistant',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '*GitPulse Commands:*\n\n• `/gitpulse analyze` - Analyze recent channel messages for potential issues\n• `/gitpulse create-issue` - Create a new GitHub issue\n• `/gitpulse help` - Show this help message\n\nYou can also mention @GitPulse in any channel to get my attention!'
                }
              }
            ]
          });
      }
    }

    return NextResponse.json({ text: 'Unknown command' });
  } catch (error) {
    console.error('Slash command handler error:', error);
    return NextResponse.json({ 
      response_type: 'ephemeral',
      text: 'Sorry, something went wrong. Please try again.' 
    }, { status: 500 });
  }
}