import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest } from '@/lib/slack-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-slack-signature');
    const timestamp = req.headers.get('x-slack-request-timestamp');

    console.log('🎛️ Slack interaction received');

    // Skip verification in development if bypass is enabled
    const skipVerification = process.env.NODE_ENV === 'development' || process.env.SLACK_SKIP_VERIFICATION === 'true';
    
    if (!skipVerification) {
      if (!signature || !timestamp) {
        return NextResponse.json({ error: 'Missing Slack headers' }, { status: 400 });
      }

      if (!verifySlackRequest(body, signature, timestamp)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(decodeURIComponent(body.replace('payload=', '')));
    const userId = payload.user?.id;
    const channelId = payload.channel?.id;

    console.log('Interaction payload:', {
      type: payload.type,
      actionId: payload.actions?.[0]?.action_id,
      userId,
      channelId
    });

    // Handle block actions (e.g., button clicks, dropdowns)
    if (payload.type === 'block_actions') {
      const action = payload.actions?.[0];
      
      // Repository selection from dropdown
      if (action?.action_id === 'select_repository') {
        const selectedRepo = action.selected_option?.value;
        console.log('Repository selected:', selectedRepo);
        
        return NextResponse.json({
          response_type: 'ephemeral',
          replace_original: true,
          text: '📝 Repository Selected',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `📁 **Selected Repository:** \`${selectedRepo}\`\n\n📝 Now provide the issue details:`
              }
            },
            {
              type: 'input',
              block_id: 'issue_title_block',
              element: {
                type: 'plain_text_input',
                action_id: 'issue_title_input',
                placeholder: {
                  type: 'plain_text',
                  text: 'e.g., Fix login bug on mobile devices'
                }
              },
              label: {
                type: 'plain_text',
                text: 'Issue Title *'
              }
            },
            {
              type: 'input',
              block_id: 'issue_description_block',
              element: {
                type: 'plain_text_input',
                action_id: 'issue_description_input',
                multiline: true,
                placeholder: {
                  type: 'plain_text',
                  text: 'Describe the issue, steps to reproduce, expected behavior, etc.'
                }
              },
              label: {
                type: 'plain_text',
                text: 'Issue Description'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Priority Level:*'
              },
              accessory: {
                type: 'static_select',
                action_id: 'issue_priority_select',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select priority...'
                },
                options: [
                  {
                    text: { type: 'plain_text', text: '🔴 High Priority' },
                    value: 'high'
                  },
                  {
                    text: { type: 'plain_text', text: '🟡 Medium Priority' },
                    value: 'medium'
                  },
                  {
                    text: { type: 'plain_text', text: '🟢 Low Priority' },
                    value: 'low'
                  }
                ]
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🚀 Create Issue'
                  },
                  action_id: 'create_issue_submit',
                  style: 'primary',
                  value: JSON.stringify({ repository: selectedRepo })
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '↩️ Back to Repository Selection'
                  },
                  action_id: 'back_to_repo_selection'
                }
              ]
            }
          ]
        });
      }

      // Handle issue creation submission
      if (action?.action_id === 'create_issue_submit') {
        try {
          const repoData = JSON.parse(action.value || '{}');
          const repository = repoData.repository;

          // Get form data from the current message state (this is a simplified approach)
          // In production, you'd want to use Slack modals for better form handling
          return NextResponse.json({
            response_type: 'ephemeral',
            replace_original: true,
            text: '🔄 Creating GitHub Issue...',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `🔄 **Creating issue in:** \`${repository}\`\n\n⏳ Please wait while I create the GitHub issue...`
                }
              }
            ]
          });
        } catch (error) {
          console.error('Error creating issue:', error);
          return NextResponse.json({
            response_type: 'ephemeral',
            replace_original: true,
            text: '❌ Failed to create issue. Please try again.'
          });
        }
      }

      // Show issue creation form button click
      if (action?.action_id === 'show_issue_form') {
        return NextResponse.json({
          response_type: 'ephemeral',
          replace_original: true,
          text: '📝 Create GitHub Issue - Step 1',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '📝 *Create GitHub Issue*\n\n👆 First, select a repository from the dropdown above, then I\'ll show you the issue creation form.'
              }
            }
          ]
        });
      }

      // Cancel GitHub authentication
      if (action?.action_id === 'cancel_github_auth') {
        return NextResponse.json({
          response_type: 'ephemeral',
          replace_original: true,
          text: '❌ GitHub authentication cancelled. Use `/gitpulse create-issue` when you\'re ready to connect.'
        });
      }

      // Manual repository entry
      if (action?.action_id === 'manual_repo_entry') {
        return NextResponse.json({
          response_type: 'ephemeral',
          replace_original: true,
          text: '📝 Manual Repository Entry',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '📁 *Enter Repository Manually*\n\nPlease provide the full repository name in the format: `owner/repository-name`\n\nExample: `facebook/react` or `microsoft/vscode`'
              }
            },
            {
              type: 'input',
              block_id: 'manual_repo_block',
              element: {
                type: 'plain_text_input',
                action_id: 'manual_repo_input',
                placeholder: {
                  type: 'plain_text',
                  text: 'e.g., your-username/your-repository'
                }
              },
              label: {
                type: 'plain_text',
                text: 'Repository Name (owner/repo)'
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '✅ Use This Repository'
                  },
                  action_id: 'confirm_manual_repo',
                  style: 'primary'
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '🔄 Refresh GitHub Connection'
                  },
                  action_id: 'refresh_github'
                }
              ]
            }
          ]
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
