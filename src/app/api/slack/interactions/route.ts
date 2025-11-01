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
      
      // Direct repository selection for issue creation
      if (action?.action_id === 'create_issue_in_repo') {
        const selectedRepo = action.value;
        console.log('Direct repository selection for issue creation:', selectedRepo);
        
        // Open a modal for issue details
        const modalView = {
          type: 'modal',
          callback_id: 'create_issue_modal',
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
          private_metadata: JSON.stringify({ repository: selectedRepo }),
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `📁 *Repository:* \`${selectedRepo}\`\n\n📝 Fill in the issue details below:`
              }
            },
            {
              type: 'input',
              block_id: 'issue_title',
              label: {
                type: 'plain_text',
                text: 'Issue Title *'
              },
              element: {
                type: 'plain_text_input',
                action_id: 'title',
                placeholder: {
                  type: 'plain_text',
                  text: 'e.g., Fix login bug on mobile devices'
                }
              }
            },
            {
              type: 'input',
              block_id: 'issue_description',
              label: {
                type: 'plain_text',
                text: 'Issue Description'
              },
              element: {
                type: 'plain_text_input',
                action_id: 'description',
                multiline: true,
                placeholder: {
                  type: 'plain_text',
                  text: 'Describe the issue, steps to reproduce, expected behavior, etc.'
                }
              },
              optional: true
            },
            {
              type: 'input',
              block_id: 'issue_priority',
              label: {
                type: 'plain_text',
                text: 'Priority Level'
              },
              element: {
                type: 'static_select',
                action_id: 'priority',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select priority...'
                },
                initial_option: {
                  text: { type: 'plain_text', text: '🟡 Medium Priority' },
                  value: 'medium'
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
              },
              optional: true
            }
          ]
        };

        // Open the modal
        try {
          const response = await fetch('https://slack.com/api/views.open', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              trigger_id: payload.trigger_id,
              view: modalView
            })
          });

          if (response.ok) {
            return NextResponse.json({ ok: true });
          } else {
            console.error('Failed to open modal:', await response.text());
            return NextResponse.json({
              response_type: 'ephemeral',
              text: '❌ Failed to open issue creation form. Please try again.'
            });
          }
        } catch (error) {
          console.error('Error opening modal:', error);
          return NextResponse.json({
            response_type: 'ephemeral',
            text: '❌ Failed to open issue creation form. Please try again.'
          });
        }
      }

      // Repository selection from dropdown for issue creation
      if (action?.action_id === 'select_repository_for_issue') {
        const selectedRepo = action.selected_option?.value;
        console.log('Repository selected for issue creation:', selectedRepo);
        
        // Open a modal for issue details
        const modalView = {
          type: 'modal',
          callback_id: 'create_issue_modal',
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
          private_metadata: JSON.stringify({ repository: selectedRepo }),
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `📁 *Repository:* \`${selectedRepo}\`\n\n📝 Fill in the issue details below:`
              }
            },
            {
              type: 'input',
              block_id: 'issue_title',
              label: {
                type: 'plain_text',
                text: 'Issue Title *'
              },
              element: {
                type: 'plain_text_input',
                action_id: 'title',
                placeholder: {
                  type: 'plain_text',
                  text: 'e.g., Fix login bug on mobile devices'
                }
              }
            },
            {
              type: 'input',
              block_id: 'issue_description',
              label: {
                type: 'plain_text',
                text: 'Issue Description'
              },
              element: {
                type: 'plain_text_input',
                action_id: 'description',
                multiline: true,
                placeholder: {
                  type: 'plain_text',
                  text: 'Describe the issue, steps to reproduce, expected behavior, etc.'
                }
              },
              optional: true
            },
            {
              type: 'input',
              block_id: 'issue_priority',
              label: {
                type: 'plain_text',
                text: 'Priority Level'
              },
              element: {
                type: 'static_select',
                action_id: 'priority',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select priority...'
                },
                initial_option: {
                  text: { type: 'plain_text', text: '🟡 Medium Priority' },
                  value: 'medium'
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
              },
              optional: true
            }
          ]
        };

        // Open the modal
        try {
          const response = await fetch('https://slack.com/api/views.open', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              trigger_id: payload.trigger_id,
              view: modalView
            })
          });

          if (response.ok) {
            return NextResponse.json({ ok: true });
          } else {
            console.error('Failed to open modal:', await response.text());
            return NextResponse.json({
              response_type: 'ephemeral',
              text: '❌ Failed to open issue creation form. Please try again.'
            });
          }
        } catch (error) {
          console.error('Error opening modal:', error);
          return NextResponse.json({
            response_type: 'ephemeral',
            text: '❌ Failed to open issue creation form. Please try again.'
          });
        }
      }

      // Handle issue creation submission
      if (action?.action_id === 'create_issue_submit') {
        try {
          const repoData = JSON.parse(action.value || '{}');
          const repository = repoData.repository;

          // Try to extract title/description from the message blocks or fallback placeholders
          let title = 'New issue from GitPulse';
          let description = '';
          try {
            const blocks = payload.message?.blocks || [];
            // Look for a section or input that may contain a title/description
            for (const block of blocks) {
              if (!title && block?.text?.text) title = block.text.text;
              if (block?.block_id === 'issue_description_block' && block?.element?.initial_value) {
                description = block.element.initial_value;
              }
            }
          } catch (e) {
            // ignore
          }

          const { slackUserService } = await import('@/lib/slack-user-service');
          const created = await slackUserService.createIssueForRepository(repository, title, description, userId || '');

          if (!created) {
            return NextResponse.json({
              response_type: 'ephemeral',
              replace_original: true,
              text: '❌ Failed to create issue. Please ensure your GitHub account is connected and try again.'
            });
          }

          return NextResponse.json({
            response_type: 'ephemeral',
            replace_original: true,
            text: `✅ Created issue #${created.number}: ${created.title}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `✅ Created issue <${created.url}|#${created.number} - ${created.title}> in \`${repository}\``
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
      console.log('Modal submission received:', payload.view?.callback_id);
      
      if (payload.view?.callback_id === 'create_issue_modal') {
        try {
          // Extract fields from the view state
          const values = payload.view?.state?.values || {};
          
          const title = values.issue_title?.title?.value || 'New issue from GitPulse';
          const description = values.issue_description?.description?.value || '';
          const priority = values.issue_priority?.priority?.selected_option?.value || 'medium';
          
          // Get repository from private_metadata
          let repository = '';
          try {
            const meta = payload.view?.private_metadata;
            if (meta) {
              const parsed = JSON.parse(meta);
              repository = parsed.repository;
            }
          } catch (e) {
            console.error('Error parsing private_metadata:', e);
          }

          if (!repository) {
            return NextResponse.json({
              response_action: 'errors',
              errors: {
                'issue_title': 'Repository not specified. Please try again.'
              }
            });
          }

          console.log('Creating GitHub issue:', { repository, title, priority, userId });

          // Create the issue
          const { slackUserService } = await import('@/lib/slack-user-service');
          
          // Add priority to description if specified
          let fullDescription = description;
          if (priority && priority !== 'medium') {
            const priorityLabel = priority === 'high' ? '🔴 HIGH PRIORITY' : priority === 'low' ? '🟢 Low Priority' : '🟡 Medium Priority';
            fullDescription = `**Priority:** ${priorityLabel}\n\n${description}`;
          }
          
          const created = await slackUserService.createIssueForRepository(repository, title, fullDescription, userId);

          if (!created) {
            return NextResponse.json({
              response_action: 'errors',
              errors: {
                'issue_title': 'Failed to create issue. Check your GitHub permissions and try again.'
              }
            });
          }

          console.log('GitHub issue created successfully:', created);

          // Send a follow-up message to the user
          try {
            await fetch('https://slack.com/api/chat.postEphemeral', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                channel: channelId,
                user: userId,
                text: `✅ GitHub issue created successfully!`,
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `✅ *Issue Created Successfully!*\n\n🔗 <${created.url}|#${created.number} - ${created.title}>\n📁 Repository: \`${repository}\`\n🏷️ Priority: ${priority === 'high' ? '🔴 High' : priority === 'low' ? '🟢 Low' : '🟡 Medium'}`
                    }
                  }
                ]
              })
            });
          } catch (msgError) {
            console.error('Failed to send follow-up message:', msgError);
          }

          // Close modal
          return NextResponse.json({
            response_action: 'clear'
          });
          
        } catch (error) {
          console.error('Error creating issue from modal submission:', error);
          return NextResponse.json({
            response_action: 'errors',
            errors: {
              'issue_title': 'An error occurred while creating the issue. Please try again.'
            }
          });
        }
      }
    }

    // Default acknowledgement
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Slack interactions handler error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET handler for health checks and webhook verification
export async function GET() {
  return NextResponse.json({ 
    message: 'Slack interactions endpoint is active',
    method: 'POST',
    note: 'This endpoint only accepts POST requests from Slack'
  });
}
