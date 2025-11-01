import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest, isUserAllowed, isChannelAllowed } from '@/lib/slack-utils';

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

    // Parse the payload from Slack
    const formData = new URLSearchParams(body);
    const payload = JSON.parse(formData.get('payload') || '{}');

    // Enforce allowlists when configured
    const slackUserId = payload.user?.id ?? payload.user_id ?? null;
    const slackChannelId = payload.channel?.id ?? payload.channel_id ?? null;
    if (!isUserAllowed(slackUserId)) return NextResponse.json({ error: 'User not allowed' }, { status: 403 });
    if (!isChannelAllowed(slackChannelId)) return NextResponse.json({ error: 'Channel not allowed' }, { status: 403 });

    // Handle button interactions
    if (payload.type === 'block_actions') {
      const action = payload.actions[0];

      // Handle GitHub connection
      if (action.action_id === 'connect_github') {
        // The URL is already set in the button, Slack will handle the redirect
        return NextResponse.json({});
      }

      // Handle repository selection
      if (action.action_id === 'select_repository') {
        try {
          // Fetch user's repositories
          const reposResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/slack/repositories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slackUserId: payload.user.id }),
          });

          if (!reposResponse.ok) {
            throw new Error('Failed to fetch repositories');
          }

          const { repositories } = await reposResponse.json();

          if (repositories.length === 0) {
            // No repositories found
            const response = await fetch('https://slack.com/api/chat.postEphemeral', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                channel: payload.channel.id,
                user: payload.user.id,
                text: 'No repositories found. Make sure you have GitHub repositories and they are accessible.',
              }),
            });
            return NextResponse.json({});
          }

          // Open modal with repository selection
          const modalView = {
            type: 'modal',
            callback_id: 'select_repository_modal',
            title: {
              type: 'plain_text',
              text: 'Select Repository'
            },
            submit: {
              type: 'plain_text',
              text: 'Continue'
            },
            close: {
              type: 'plain_text',
              text: 'Cancel'
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: 'Choose which repository to create the issue in:'
                }
              },
              {
                type: 'input',
                block_id: 'repository_selection',
                element: {
                  type: 'static_select',
                  action_id: 'selected_repo',
                  placeholder: {
                    type: 'plain_text',
                    text: 'Select a repository...'
                  },
                  options: repositories
                },
                label: {
                  type: 'plain_text',
                  text: 'Repository'
                }
              }
            ]
          };

          const response = await fetch('https://slack.com/api/views.open', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              trigger_id: payload.trigger_id,
              view: modalView
            }),
          });

          if (!response.ok) {
            console.error('Failed to open repository selection modal:', await response.text());
          }
        } catch (error) {
          console.error('Error handling repository selection:', error);
        }

        return NextResponse.json({});
      }

      // Handle suggestion dismissal
      if (action.action_id === 'dismiss_suggestion') {
        // Update the original message to show it was dismissed
        const response = await fetch('https://slack.com/api/chat.update', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: payload.channel.id,
            ts: payload.message.ts,
            text: '~~Issue suggestion dismissed~~',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '~~Issue suggestion dismissed by user~~'
                }
              }
            ]
          }),
        });
        return NextResponse.json({});
      }

      // Handle suggested issue creation
      if (action.action_id === 'create_suggested_issue') {
        try {
          const issueData = JSON.parse(action.value);
          
          // Open modal with pre-filled data
          const modalView = {
            type: 'modal',
            callback_id: 'suggested_github_issue_modal',
            title: {
              type: 'plain_text',
              text: 'Create GitHub Issue'
            },
            submit: {
              type: 'plain_text',
              text: 'Create Issue'
            },
            close: {
              type: 'plain_text',
              text: 'Cancel'
            },
            private_metadata: JSON.stringify({ original_message_ts: payload.message.ts }),
            blocks: [
              {
                type: 'input',
                block_id: 'issue_title',
                element: {
                  type: 'plain_text_input',
                  action_id: 'title',
                  initial_value: issueData.title,
                },
                label: {
                  type: 'plain_text',
                  text: 'Issue Title'
                }
              },
              {
                type: 'input',
                block_id: 'issue_description',
                element: {
                  type: 'plain_text_input',
                  action_id: 'description',
                  multiline: true,
                  initial_value: issueData.description,
                },
                label: {
                  type: 'plain_text',
                  text: 'Description'
                }
              },
              {
                type: 'input',
                block_id: 'repository',
                element: {
                  type: 'plain_text_input',
                  action_id: 'repo',
                  placeholder: {
                    type: 'plain_text',
                    text: 'owner/repository-name'
                  }
                },
                label: {
                  type: 'plain_text',
                  text: 'GitHub Repository'
                }
              }
            ]
          };

          const response = await fetch('https://slack.com/api/views.open', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              trigger_id: payload.trigger_id,
              view: modalView
            }),
          });

          if (!response.ok) {
            console.error('Failed to open modal:', await response.text());
          }
        } catch (error) {
          console.error('Error handling suggested issue creation:', error);
        }

        return NextResponse.json({});
      }

      if (action.action_id === 'create_github_issue') {
        // Open a modal for GitHub issue creation
        const modalView = {
          type: 'modal',
          callback_id: 'github_issue_modal',
          title: {
            type: 'plain_text',
            text: 'Create GitHub Issue'
          },
          submit: {
            type: 'plain_text',
            text: 'Create Issue'
          },
          close: {
            type: 'plain_text',
            text: 'Cancel'
          },
          blocks: [
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
            },
            {
              type: 'input',
              block_id: 'issue_description',
              element: {
                type: 'plain_text_input',
                action_id: 'description',
                multiline: true,
                placeholder: {
                  type: 'plain_text',
                  text: 'Describe the issue or feature request...'
                }
              },
              label: {
                type: 'plain_text',
                text: 'Description'
              }
            },
            {
              type: 'input',
              block_id: 'repository',
              element: {
                type: 'plain_text_input',
                action_id: 'repo',
                placeholder: {
                  type: 'plain_text',
                  text: 'owner/repository-name'
                }
              },
              label: {
                type: 'plain_text',
                text: 'GitHub Repository'
              }
            }
          ]
        };

        // Open the modal
        const response = await fetch('https://slack.com/api/views.open', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trigger_id: payload.trigger_id,
            view: modalView
          }),
        });

        if (!response.ok) {
          console.error('Failed to open modal:', await response.text());
        }

        return NextResponse.json({});
      }
    }

    // Handle modal submissions
    if (payload.type === 'view_submission' && 
        (payload.view.callback_id === 'github_issue_modal' || payload.view.callback_id === 'suggested_github_issue_modal')) {
      const values = payload.view.state.values;
      const title = values.issue_title.title.value;
      const description = values.issue_description.description.value;
      const repository = values.repository.repo.value;

      // Import the Slack AI service
      const { slackAIService } = await import('@/lib/slack-ai-service');

      // Note: In a real implementation, you'd need to get the user's GitHub token
      // For now, we'll use a placeholder or environment variable
      const githubToken = process.env.GITHUB_TOKEN || 'placeholder';
      
      try {
        const result = await slackAIService.createGitHubIssueFromSlack(
          title,
          description,
          repository,
          githubToken
        );

        if (result.success) {
          await slackAIService.sendMessage(
            payload.user.id, // DM the user
            `✅ GitHub issue created successfully!\n\n**Title:** ${title}\n**Repository:** ${repository}\n**Issue URL:** ${result.issueUrl}`
          );
        } else {
          await slackAIService.sendMessage(
            payload.user.id,
            `❌ Failed to create GitHub issue: ${result.error}`
          );
        }
      } catch (error) {
        console.error('Error creating GitHub issue:', error);
        await slackAIService.sendMessage(
          payload.user.id,
          `❌ Error creating GitHub issue. Please try again or contact support.`
        );
      }

      return NextResponse.json({});
    }

    return NextResponse.json({});
  } catch (error) {
    console.error('Interactive handler error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET handler for health checks
export async function GET() {
  return NextResponse.json({ 
    message: 'Slack interactive endpoint is active',
    method: 'POST',
    note: 'This endpoint only accepts POST requests from Slack interactive components'
  });
}