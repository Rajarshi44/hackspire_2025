import { NextRequest, NextResponse } from 'next/server';
import { verifySlackRequest, isUserAllowed, isChannelAllowed } from '@/lib/slack-utils';

export async function POST(req: NextRequest) {
  console.log('🚀 Slack command received at:', new Date().toISOString());
  
  try {
    // Clone the request to avoid consuming the body twice
    const clonedReq = req.clone();
    const body = await req.text();
    const signature = clonedReq.headers.get('x-slack-signature');
    const timestamp = clonedReq.headers.get('x-slack-request-timestamp');

    console.log('📋 Raw request details:', { 
      method: clonedReq.method,
      url: clonedReq.url,
      bodyLength: body.length,
      bodyPreview: body.substring(0, 200),
      contentType: clonedReq.headers.get('content-type'),
      signature: signature,
      timestamp: timestamp
    });

    // Check for missing environment variables early
    if (!process.env.SLACK_SIGNING_SECRET) {
      console.error('Missing SLACK_SIGNING_SECRET environment variable');
      return NextResponse.json({ 
        response_type: 'ephemeral',
        text: '❌ Bot configuration error. Please contact administrator.' 
      }, { status: 200 }); // Return 200 to prevent dispatch_failed
    }

    if (!signature || !timestamp) {
      console.error('Missing Slack headers:', { signature: !!signature, timestamp: !!timestamp });
      return NextResponse.json({ 
        response_type: 'ephemeral',
        text: '❌ Invalid request headers.' 
      }, { status: 200 });
    }

    // Temporary aggressive debugging mode
    const skipVerification = process.env.NODE_ENV === 'development' || process.env.SLACK_SKIP_VERIFICATION === 'true';
    
    console.log('🔐 Verification settings:', {
      nodeEnv: process.env.NODE_ENV,
      skipVerificationEnv: process.env.SLACK_SKIP_VERIFICATION,
      willSkip: skipVerification,
      hasSigningSecret: !!process.env.SLACK_SIGNING_SECRET,
      signingSecretLength: process.env.SLACK_SIGNING_SECRET?.length
    });
    
    if (!skipVerification) {
      const verificationResult = verifySlackRequest(body, signature, timestamp);
      console.log('🔍 Verification result:', verificationResult);
      
      if (!verificationResult) {
        console.error('❌ Slack signature verification failed');
        
        // Return detailed debug info in development
        const debugInfo = process.env.NODE_ENV === 'development' ? {
          timestamp: new Date().toISOString(),
          hasSignature: !!signature,
          hasTimestamp: !!timestamp,
          signingSecretSet: !!process.env.SLACK_SIGNING_SECRET,
          bodyLength: body.length
        } : {};
        
        return NextResponse.json({ 
          response_type: 'ephemeral',
          text: `❌ Request verification failed. Debug info: ${JSON.stringify(debugInfo)}` 
        }, { status: 200 });
      }
    }
    
    if (skipVerification) {
      console.warn('⚠️ Slack signature verification SKIPPED');
    }

    // Parse form data from Slack
    const formData = new URLSearchParams(body);
    const command = formData.get('command');
    const text = formData.get('text');
    const userId = formData.get('user_id');
    const channelId = formData.get('channel_id');

    console.log('Command details:', { command, text, userId, channelId });

    // Enforce optional allowlists
    if (!isUserAllowed(userId)) {
      console.warn('User not allowed:', userId);
      return NextResponse.json({ 
        response_type: 'ephemeral',
        text: '❌ You are not authorized to use this bot.' 
      }, { status: 200 });
    }

    if (!isChannelAllowed(channelId)) {
      console.warn('Channel not allowed:', channelId);
      return NextResponse.json({ 
        response_type: 'ephemeral',
        text: '❌ This bot is not enabled for this channel.' 
      }, { status: 200 });
    }

    // Handle /gitpulse command
    if (command === '/gitpulse') {
      const subcommand = text?.trim().split(' ')[0] || 'help';

      switch (subcommand) {
        case 'analyze':
          try {
            console.log('Starting analysis for channel:', channelId);
            
            // Check for required environment variables
            if (!process.env.SLACK_BOT_TOKEN) {
              console.error('Missing SLACK_BOT_TOKEN');
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '❌ Bot token not configured. Please contact administrator.',
              });
            }

            if (!process.env.GOOGLE_GENAI_API_KEY) {
              console.error('Missing GOOGLE_GENAI_API_KEY');
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '❌ AI service not configured. Please contact administrator.',
              });
            }

            // Return immediate response and process in background to avoid timeout
            // Slack commands must respond within 3 seconds
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Command timeout')), 2500); // 2.5s timeout
            });

            const analysisPromise = (async () => {
              const { slackAIService } = await import('@/lib/slack-ai-service');
              console.log('AI service imported successfully');
              return await slackAIService.analyzeChannelForIssues(channelId!);
            })();
            try {
              // Race analysis against a short timeout to meet Slack's 3s requirement
              const analysisResult = await Promise.race([analysisPromise, timeoutPromise]);
              console.log('Analysis completed within timeout:', { hasIssue: analysisResult.hasIssue });

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
            } catch (timeoutError) {
              console.warn('Analysis timed out, returning immediate response and will continue in background');

              // Respond immediately to Slack to avoid dispatch_failed
              // Then continue processing in background and send ephemeral follow-up to the invoking user
              (async () => {
                try {
                  const analysisResult = await analysisPromise; // finish analysis
                  const { slackAIService } = await import('@/lib/slack-ai-service');

                  const userIdForEphemeral = userId || undefined;
                  const followupText = analysisResult.hasIssue
                    ? `🔍 Analysis finished — detected potential issue:\n*${analysisResult.issueData?.title}*\n${analysisResult.issueData?.description}\n\nPriority: ${analysisResult.issueData?.priority || 'normal'}`
                    : `🔍 Analysis finished — no actionable issues detected.`;

                  const blocks = analysisResult.hasIssue
                    ? [
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
                              text: { type: 'plain_text', text: 'Create GitHub Issue' },
                              action_id: 'create_github_issue',
                              style: 'primary'
                            }
                          ]
                        }
                      ]
                    : [
                        {
                          type: 'section',
                          text: { type: 'mrkdwn', text: `🔍 *Analysis Complete*\n\n${analysisResult.message}` }
                        }
                      ];

                  // If we have a userId, send ephemeral message to them; otherwise post to channel
                  if (userIdForEphemeral) {
                    await slackAIService.sendEphemeral(channelId!, userIdForEphemeral, followupText, blocks);
                  } else {
                    await slackAIService.sendMessage(channelId!, followupText, blocks);
                  }
                } catch (bgError) {
                  console.error('Background analysis failed:', bgError);
                }
              })();

              return NextResponse.json({
                response_type: 'ephemeral',
                text: '🔍 Analysis started... This may take a moment. I\'ll send you the results shortly.',
              });
            }
          } catch (error) {
            console.error('Error analyzing messages:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Provide specific guidance for auth errors
            if (errorMessage.includes('invalid_auth')) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '🔐 **Authentication Error**\n\nThe bot needs proper permissions to read channel messages.\n\n**Quick fixes:**\n1. Add bot to this channel: `/invite @GitPulse`\n2. Check if bot has `conversations:history` scope\n3. Verify bot token is correct\n\nSee server logs for detailed error info.',
              });
            }
            
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `❌ Error analyzing messages: ${errorMessage}.\n\nTry:\n• \`/gitpulse help\` for available commands\n• Check if bot is added to this channel\n• Contact administrator if issue persists`,
            });
          }

        case 'create-issue':
          try {
            console.log('Creating issue for user:', userId);
            
            // Import user service to check GitHub authentication
            const { slackUserService } = await import('@/lib/slack-user-service');
            
            if (!userId) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '❌ Unable to identify user. Please try again.',
              });
            }
            
            const hasGitHubAuth = await slackUserService.hasGitHubAuth(userId);
            
            console.log('User GitHub auth status:', { userId, hasGitHubAuth });
            
            if (!hasGitHubAuth) {
              // User needs to authenticate with GitHub first
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '� GitHub Authentication Required',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '📝 *Create GitHub Issue*\n\nTo create GitHub issues, you need to connect your GitHub account first.'
                    }
                  },
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '🔑 *Why do I need to sign in?*\n• Create issues in your repositories\n• Assign issues to team members\n• Access private repositories\n• Maintain proper attribution'
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔗 Connect GitHub Account'
                        },
                        action_id: 'connect_github',
                        style: 'primary',
                        url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/api/auth/github/slack?user_id=${userId}&channel_id=${channelId}`
                      },
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '❌ Cancel'
                        },
                        action_id: 'cancel_github_auth'
                      }
                    ]
                  }
                ]
              });
            }

            // User is authenticated - get their repositories and current repo
            const userRepos = await slackUserService.getUserRepositories(userId);
            const currentRepo = await slackUserService.getCurrentRepository(userId);
            console.log('User repositories:', { userId, repoCount: userRepos.length, currentRepo });
            
            if (userRepos.length === 0) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '📁 No Repositories Found',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '📝 *Create GitHub Issue*\n\n📁 No repositories found in your GitHub account, or you may need to refresh your connection.'
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔄 Refresh GitHub Connection'
                        },
                        action_id: 'refresh_github',
                        style: 'primary',
                        url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}api/auth/github/slack?user_id=${userId}&channel_id=${channelId}&refresh=true`
                      },
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '📝 Enter Repository Manually'
                        },
                        action_id: 'manual_repo_entry'
                      }
                    ]
                  }
                ]
              });
            }

            // Create repository selection dropdown
            const repoOptions = userRepos.slice(0, 25).map((repo: string) => ({
              text: {
                type: 'plain_text',
                text: repo.length > 75 ? repo.substring(0, 72) + '...' : repo
              },
              value: repo
            }));

            return NextResponse.json({
              response_type: 'ephemeral',
              text: '📝 Create GitHub Issue',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '📝 *Create GitHub Issue*\n\nSelect a repository to create an issue in:'
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `🔗 *Connected as:* Your GitHub account\n📁 *Available repositories:* ${userRepos.length} found${currentRepo ? `\n🎯 *Current repository:* ${currentRepo}` : ''}`
                  },
                  accessory: {
                    type: 'static_select',
                    placeholder: {
                      type: 'plain_text',
                      text: currentRepo ? `Current: ${currentRepo.split('/')[1] || currentRepo}` : 'Select repository...'
                    },
                    options: repoOptions,
                    action_id: 'select_repository_for_issue',
                    ...(currentRepo && userRepos.includes(currentRepo) && { 
                      initial_option: {
                        text: {
                          type: 'plain_text',
                          text: currentRepo.length > 75 ? currentRepo.substring(0, 72) + '...' : currentRepo
                        },
                        value: currentRepo
                      }
                    })
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '� Refresh Repositories'
                      },
                      action_id: 'refresh_repos'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '� Enter Repository Manually'
                      },
                      action_id: 'manual_repo_entry'
                    }
                  ]
                }
              ]
            });

          } catch (error) {
            console.error('Error in create-issue command:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `❌ Error setting up issue creation: ${error instanceof Error ? error.message : 'Unknown error'}.\n\nPlease try again or contact administrator.`,
            });
          }

        case 'issuelist':
          try {
            const userIdString = userId || ''; // Ensure userId is a string
            const targetRepo = text?.trim().split(' ')[1]; // Optional repo parameter

            console.log('Fetching issue list for user:', userIdString, 'targetRepo:', targetRepo);
            const { slackUserService } = await import('@/lib/slack-user-service');

            // Check authentication first
            const hasGitHubAuth = await slackUserService.hasGitHubAuth(userIdString);
            if (!hasGitHubAuth) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '🔗 GitHub Authentication Required',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '📝 *Issue List*\n\nTo view issues, you need to connect your GitHub account first.'
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔗 Connect GitHub Account'
                        },
                        action_id: 'connect_github',
                        style: 'primary',
                        url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/api/auth/github/slack?user_id=${userIdString}&channel_id=${channelId}`
                      }
                    ]
                  }
                ]
              });
            }

            const userRepos = await slackUserService.getUserRepositories(userIdString);
            const currentRepo = await slackUserService.getCurrentRepository(userIdString);
            
            if (userRepos.length === 0) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '📁 No Repositories Found',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '📝 *Issue List*\n\n📁 No repositories found in your GitHub account.'
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔄 Refresh GitHub Connection'
                        },
                        action_id: 'refresh_github',
                        style: 'primary',
                        url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/api/auth/github/slack?user_id=${userIdString}&channel_id=${channelId}&refresh=true`
                      }
                    ]
                  }
                ]
              });
            }

            // If no specific repo requested, show repository selection
            if (!targetRepo) {
              const repoOptions = userRepos.slice(0, 25).map((repo: string) => ({
                text: {
                  type: 'plain_text',
                  text: repo.length > 75 ? repo.substring(0, 72) + '...' : repo
                },
                value: repo
              }));

              const initialOption = currentRepo && userRepos.includes(currentRepo) ? {
                text: {
                  type: 'plain_text',
                  text: currentRepo.length > 75 ? currentRepo.substring(0, 72) + '...' : currentRepo
                },
                value: currentRepo
              } : undefined;

              return NextResponse.json({
                response_type: 'ephemeral',
                text: '📝 Select Repository for Issue List',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `📝 *Issue List*\n\nSelect a repository to view its issues:${currentRepo ? `\n🎯 *Current repository:* ${currentRepo}` : ''}\n📊 *Available repositories:* ${userRepos.length} found`
                    },
                    accessory: {
                      type: 'static_select',
                      placeholder: {
                        type: 'plain_text',
                        text: currentRepo ? `Current: ${currentRepo.split('/')[1] || currentRepo}` : 'Select repository...'
                      },
                      options: repoOptions,
                      action_id: 'select_repository_for_issues',
                      ...(initialOption && { initial_option: initialOption })
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔄 Refresh Repositories'
                        },
                        action_id: 'refresh_repos'
                      },
                      currentRepo ? {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: `📝 Show Issues for ${currentRepo.split('/')[1] || currentRepo}`
                        },
                        action_id: 'show_current_repo_issues',
                        style: 'primary'
                      } : null
                    ].filter(Boolean)
                  }
                ]
              });
            }

            // Fetch issues for specified or current repository
            const repoToQuery = targetRepo || currentRepo || userRepos[0];
            if (!userRepos.includes(repoToQuery)) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: `❌ Repository "${repoToQuery}" not found in your accessible repositories.`,
              });
            }

            // Fetch real data for issues from GitHub
            const issues = await slackUserService.getIssuesForRepository(repoToQuery, userIdString);
            const issueList = issues.length > 0 
              ? issues
                  .filter((issue): issue is { number: number; title: string; state: string } => !!issue.state)
                  .map((issue) => 
                    `• #${issue.number}: ${issue.title} (${issue.state})`)
                  .join('\n')
              : '📝 No issues found in this repository.';

            return NextResponse.json({
              response_type: 'ephemeral',
              text: `📝 Issue List for ${repoToQuery}`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `📝 *Issue List for ${repoToQuery}*\n\n${issueList}\n\n📊 *Total issues:* ${issues.length}`
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔄 Refresh Issues'
                      },
                      action_id: 'refresh_issues'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '📝 Create New Issue'
                      },
                      action_id: 'create_new_issue'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔄 Switch Repository'
                      },
                      action_id: 'switch_repo_for_issues'
                    }
                  ]
                }
              ]
            });
          } catch (error) {
            console.error('Error fetching issue list:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `❌ Failed to fetch issue list: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
            });
          }

        case 'prlist':
          try {
            const userIdString = userId || ''; // Ensure userId is a string
            const targetRepo = text?.trim().split(' ')[1]; // Optional repo parameter

            console.log('Fetching PR list for user:', userIdString, 'targetRepo:', targetRepo);
            const { slackUserService } = await import('@/lib/slack-user-service');

            // Check authentication first
            const hasGitHubAuth = await slackUserService.hasGitHubAuth(userIdString);
            if (!hasGitHubAuth) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '🔗 GitHub Authentication Required',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '🔀 *Pull Request List*\n\nTo view pull requests, you need to connect your GitHub account first.'
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔗 Connect GitHub Account'
                        },
                        action_id: 'connect_github',
                        style: 'primary',
                        url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/api/auth/github/slack?user_id=${userIdString}&channel_id=${channelId}`
                      }
                    ]
                  }
                ]
              });
            }

            const userRepos = await slackUserService.getUserRepositories(userIdString);
            const currentRepo = await slackUserService.getCurrentRepository(userIdString);
            
            if (userRepos.length === 0) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '📁 No Repositories Found',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '🔀 *Pull Request List*\n\n📁 No repositories found in your GitHub account.'
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔄 Refresh GitHub Connection'
                        },
                        action_id: 'refresh_github',
                        style: 'primary',
                        url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/api/auth/github/slack?user_id=${userIdString}&channel_id=${channelId}&refresh=true`
                      }
                    ]
                  }
                ]
              });
            }

            // If no specific repo requested, show repository selection
            if (!targetRepo) {
              const repoOptions = userRepos.slice(0, 25).map((repo: string) => ({
                text: {
                  type: 'plain_text',
                  text: repo.length > 75 ? repo.substring(0, 72) + '...' : repo
                },
                value: repo
              }));

              const initialOption = currentRepo && userRepos.includes(currentRepo) ? {
                text: {
                  type: 'plain_text',
                  text: currentRepo.length > 75 ? currentRepo.substring(0, 72) + '...' : currentRepo
                },
                value: currentRepo
              } : undefined;

              return NextResponse.json({
                response_type: 'ephemeral',
                text: '🔀 Select Repository for Pull Request List',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `🔀 *Pull Request List*\n\nSelect a repository to view its pull requests:${currentRepo ? `\n🎯 *Current repository:* ${currentRepo}` : ''}\n📊 *Available repositories:* ${userRepos.length} found`
                    },
                    accessory: {
                      type: 'static_select',
                      placeholder: {
                        type: 'plain_text',
                        text: currentRepo ? `Current: ${currentRepo.split('/')[1] || currentRepo}` : 'Select repository...'
                      },
                      options: repoOptions,
                      action_id: 'select_repository_for_prs',
                      ...(initialOption && { initial_option: initialOption })
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔄 Refresh Repositories'
                        },
                        action_id: 'refresh_repos'
                      },
                      currentRepo ? {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: `🔀 Show PRs for ${currentRepo.split('/')[1] || currentRepo}`
                        },
                        action_id: 'show_current_repo_prs',
                        style: 'primary'
                      } : null
                    ].filter(Boolean)
                  }
                ]
              });
            }

            // Fetch PRs for specified or current repository
            const repoToQuery = targetRepo || currentRepo || userRepos[0];
            if (!userRepos.includes(repoToQuery)) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: `❌ Repository "${repoToQuery}" not found in your accessible repositories.`,
              });
            }

            // Fetch real data for pull requests from GitHub
            const prs = await slackUserService.getPullRequestsForRepository(repoToQuery, userIdString);
            const prList = prs.length > 0 
              ? prs.map((pr: { number: number; title: string; state: string }) => 
                  `• #${pr.number}: ${pr.title} (${pr.state})`).join('\n')
              : '🔀 No pull requests found in this repository.';

            return NextResponse.json({
              response_type: 'ephemeral',
              text: `🔀 Pull Request List for ${repoToQuery}`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `🔀 *Pull Request List for ${repoToQuery}*\n\n${prList}\n\n📊 *Total pull requests:* ${prs.length}`
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔄 Refresh PRs'
                      },
                      action_id: 'refresh_prs'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔄 Switch Repository'
                      },
                      action_id: 'switch_repo_for_prs'
                    }
                  ]
                }
              ]
            });
          } catch (error) {
            console.error('Error fetching PR list:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `❌ Failed to fetch PR list: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
            });
          }

        case 'assign':
          try {
            const issueId = text?.split(' ')[1];
            if (!issueId) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '❌ Please provide an issue ID to assign.',
              });
            }

            console.log(`Assigning issue #${issueId} to MCP for user:`, userId);
            const { slackAIService } = await import('@/lib/slack-ai-service');

            const result = await slackAIService.assignIssueToMCP(issueId);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `✅ Issue #${issueId} successfully assigned to MCP.`,
            });
          } catch (error) {
            console.error('Error assigning issue:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: '❌ Failed to assign issue. Please try again.',
            });
          }

        case 'switchrepo':
          try {
            const userIdString = userId || '';
            console.log('Switching repository for user:', userIdString);
            
            const { slackUserService } = await import('@/lib/slack-user-service');
            
            if (!userIdString) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '❌ Unable to identify user. Please try again.',
              });
            }
            
            const hasGitHubAuth = await slackUserService.hasGitHubAuth(userIdString);
            
            if (!hasGitHubAuth) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '🔗 GitHub Authentication Required',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '🔄 *Switch Repository*\n\nTo switch repositories, you need to connect your GitHub account first.'
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔗 Connect GitHub Account'
                        },
                        action_id: 'connect_github',
                        style: 'primary',
                        url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/api/auth/github/slack?user_id=${userIdString}&channel_id=${channelId}`
                      }
                    ]
                  }
                ]
              });
            }

            // Get user repositories
            const userRepos = await slackUserService.getUserRepositories(userIdString);
            console.log('User repositories for switch:', { userId: userIdString, repoCount: userRepos.length });
            
            if (userRepos.length === 0) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '📁 No Repositories Found',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '🔄 *Switch Repository*\n\n📁 No repositories found in your GitHub account.'
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔄 Refresh GitHub Connection'
                        },
                        action_id: 'refresh_github',
                        style: 'primary',
                        url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/api/auth/github/slack?user_id=${userIdString}&channel_id=${channelId}&refresh=true`
                      }
                    ]
                  }
                ]
              });
            }

            // Get current repository (if any)
            const currentRepo = await slackUserService.getCurrentRepository(userIdString);
            
            // Create repository selection dropdown
            const repoOptions = userRepos.slice(0, 25).map((repo: string) => ({
              text: {
                type: 'plain_text',
                text: repo.length > 75 ? repo.substring(0, 72) + '...' : repo
              },
              value: repo
            }));

            return NextResponse.json({
              response_type: 'ephemeral',
              text: '🔄 Switch Repository',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `🔄 *Switch Repository*\n\n${currentRepo ? `📁 **Current repository:** ${currentRepo}` : '📁 **No repository currently selected**'}\n\nSelect a new repository to work with:`
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `📊 *Available repositories:* ${userRepos.length} found`
                  },
                  accessory: {
                    type: 'static_select',
                    placeholder: {
                      type: 'plain_text',
                      text: 'Select repository...'
                    },
                    options: repoOptions,
                    action_id: 'switch_repository'
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '✅ Confirm Switch'
                      },
                      action_id: 'confirm_repo_switch',
                      style: 'primary'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔄 Refresh List'
                      },
                      action_id: 'refresh_repos'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '❌ Cancel'
                      },
                      action_id: 'cancel_repo_switch'
                    }
                  ]
                }
              ]
            });

          } catch (error) {
            console.error('Error in switchrepo command:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `❌ Error switching repository: ${error instanceof Error ? error.message : 'Unknown error'}.\n\nPlease try again or contact administrator.`,
            });
          }

        case 'login':
          try {
            const userIdString = userId || '';
            console.log('Login status check for user:', userIdString);
            
            if (!userIdString) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '❌ Unable to identify user. Please try again.',
              });
            }

            const { slackUserService } = await import('@/lib/slack-user-service');
            const hasGitHubAuth = await slackUserService.hasGitHubAuth(userIdString);
            
            if (hasGitHubAuth) {
              // User is already authenticated - show status
              const userRepos = await slackUserService.getUserRepositories(userIdString);
              const currentRepo = await slackUserService.getCurrentRepository(userIdString);
              
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '✅ Already Connected to GitHub',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `🔗 *GitHub Connection Status*\n\n✅ You are already connected to GitHub!\n\n📊 *Your GitHub data:*\n• Total repositories: ${userRepos.length}\n• Current repository: ${currentRepo || 'None selected'}\n• User ID: ${userIdString}`
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔄 Switch Repository'
                        },
                        action_id: 'switch_repo_from_login'
                      },
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '📝 Create Issue'
                        },
                        action_id: 'create_issue_from_login'
                      },
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔓 Logout'
                        },
                        action_id: 'logout_from_login'
                      }
                    ]
                  }
                ]
              });
            } else {
              // User needs to authenticate
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '🔑 GitHub Authentication Required',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '🔗 *Connect Your GitHub Account*\n\nConnect your GitHub account to start using GitPulse features like creating issues, viewing repositories, and more!'
                    }
                  },
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '🚀 *What you can do after connecting:*\n• Create GitHub issues directly from Slack\n• View your repositories and switch between them\n• List issues and pull requests\n• Assign issues to team members\n• Access both public and private repositories'
                    }
                  },
                  {
                    type: 'actions',
                    elements: [
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '🔗 Connect GitHub Account'
                        },
                        action_id: 'connect_github_from_login',
                        style: 'primary',
                        url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/api/auth/github/slack?user_id=${userIdString}&channel_id=${channelId}&source=login`
                      },
                      {
                        type: 'button',
                        text: {
                          type: 'plain_text',
                          text: '❓ Help'
                        },
                        action_id: 'help_from_login'
                      }
                    ]
                  }
                ]
              });
            }
          } catch (error) {
            console.error('Error in login command:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `❌ Error checking login status: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
            });
          }

        case 'logout':
          try {
            const userIdString = userId || '';
            console.log('Logging out user:', userIdString);
            
            if (!userIdString) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '❌ Unable to identify user. Please try again.',
              });
            }

            const { slackUserService } = await import('@/lib/slack-user-service');
            
            // Check if user is currently authenticated
            const hasGitHubAuth = await slackUserService.hasGitHubAuth(userIdString);
            
            if (!hasGitHubAuth) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '🔓 Already Logged Out',
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '🔓 *Logout Status*\n\nYou are not currently connected to GitHub.\n\nUse `/gitpulse create-issue` or `/gitpulse switchrepo` to connect your account.'
                    }
                  }
                ]
              });
            }

            // Perform logout - disconnect GitHub authentication
            await slackUserService.disconnectGitHubAuth(userIdString);
            console.log('User logged out successfully:', userIdString);

            return NextResponse.json({
              response_type: 'ephemeral',
              text: '🔓 Successfully Logged Out',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '🔓 *Logout Successful*\n\n✅ Your GitHub account has been disconnected from GitPulse.\n\n🔒 **What was removed:**\n• GitHub authentication tokens\n• Repository access permissions\n• Cached repository data\n\n🔗 **To reconnect later:**\nUse `/gitpulse create-issue` or `/gitpulse switchrepo`'
                  }
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: '🛡️ Your data privacy is important to us. All authentication data has been securely removed.'
                    }
                  ]
                }
              ]
            });

          } catch (error) {
            console.error('Error in logout command:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `❌ Error during logout: ${error instanceof Error ? error.message : 'Unknown error'}.\n\nPlease try again or contact administrator.`,
            });
          }

        case 'status':
          try {
            const userIdString = userId || '';
            const systemChecks = {
              slackBotToken: !!process.env.SLACK_BOT_TOKEN,
              slackSigningSecret: !!process.env.SLACK_SIGNING_SECRET,
              googleGenaiApiKey: !!process.env.GOOGLE_GENAI_API_KEY,
              timestamp: new Date().toISOString()
            };

            // Get user-specific status
            let userStatus = {
              isAuthenticated: false,
              currentRepo: null as string | null,
              totalRepos: 0
            };

            if (userIdString) {
              try {
                const { slackUserService } = await import('@/lib/slack-user-service');
                userStatus.isAuthenticated = await slackUserService.hasGitHubAuth(userIdString);
                
                if (userStatus.isAuthenticated) {
                  const userRepos = await slackUserService.getUserRepositories(userIdString);
                  const currentRepo = await slackUserService.getCurrentRepository(userIdString);
                  userStatus.currentRepo = currentRepo;
                  userStatus.totalRepos = userRepos.length;
                }
              } catch (error) {
                console.error('Error getting user status:', error);
              }
            }
            
            return NextResponse.json({
              response_type: 'ephemeral',
              text: 'GitPulse Status',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `🔧 *System Status*\n\n• Slack Bot Token: ${systemChecks.slackBotToken ? '✅' : '❌'}\n• Slack Signing Secret: ${systemChecks.slackSigningSecret ? '✅' : '❌'}\n• Google GenAI API Key: ${systemChecks.googleGenaiApiKey ? '✅' : '❌'}\n• Server Time: ${systemChecks.timestamp}`
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `👤 *Your Status*\n\n• GitHub Authentication: ${userStatus.isAuthenticated ? '✅ Connected' : '❌ Not connected'}\n• Current Repository: ${userStatus.currentRepo || 'None selected'}\n• Total Repositories: ${userStatus.totalRepos}\n• User ID: ${userIdString || 'Unknown'}`
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    !userStatus.isAuthenticated ? {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔗 Connect GitHub'
                      },
                      action_id: 'connect_github',
                      style: 'primary',
                      url: `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/api/auth/github/slack?user_id=${userIdString}&channel_id=${channelId}`
                    } : {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔄 Switch Repository'
                      },
                      action_id: 'switch_repo_from_status'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔄 Refresh Status'
                      },
                      action_id: 'refresh_status'
                    }
                  ]
                }
              ]
            });
          } catch (error) {
            console.error('Error getting status:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `❌ Error getting status: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
          }

        case 'help':
        default:
          try {
            const userIdString = userId || '';
            let userInfo = '';
            
            if (userIdString) {
              try {
                const { slackUserService } = await import('@/lib/slack-user-service');
                const isAuthenticated = await slackUserService.hasGitHubAuth(userIdString);
                const currentRepo = isAuthenticated ? await slackUserService.getCurrentRepository(userIdString) : null;
                
                userInfo = isAuthenticated 
                  ? `\n\n🎯 *Your current status:*\n• ✅ GitHub connected${currentRepo ? `\n• 📁 Current repo: ${currentRepo}` : '\n• 📁 No repository selected'}`
                  : `\n\n🎯 *Your current status:*\n• ❌ GitHub not connected - use \`/gitpulse status\` to connect`;
              } catch (error) {
                console.error('Error getting user info for help:', error);
              }
            }

            return NextResponse.json({
              response_type: 'ephemeral',
              text: 'GitPulse - Your AI Development Assistant',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*GitPulse Commands:*\n\n• \`/gitpulse analyze\` - Analyze recent channel messages for potential issues\n• \`/gitpulse create-issue\` - Create a new GitHub issue (with repo selection)\n• \`/gitpulse issuelist [repo]\` - List issues (interactive repo selection)\n• \`/gitpulse prlist [repo]\` - List pull requests (interactive repo selection)\n• \`/gitpulse assign <issueId>\` - Assign an issue to MCP\n• \`/gitpulse switchrepo\` - Switch to a different repository\n• \`/gitpulse login\` - Connect or check your GitHub authentication\n• \`/gitpulse logout\` - Disconnect your GitHub account\n• \`/gitpulse status\` - Check your connection and repository status\n• \`/gitpulse help\` - Show this help message\n\n💡 *Tips:*\n• Most commands now show interactive repository selection\n• Use \`status\` or \`login\` to see your current GitHub connection\n• You can mention @GitPulse in any channel to get my attention!${userInfo}`
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '📊 Check Status'
                      },
                      action_id: 'check_status_from_help'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔍 Try Analyze'
                      },
                      action_id: 'try_analyze_from_help'
                    }
                  ]
                }
              ]
            });
          } catch (error) {
            console.error('Error in help command:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: 'GitPulse - Your AI Development Assistant\n\n*GitPulse Commands:*\n\n• `/gitpulse analyze` - Analyze recent channel messages for potential issues\n• `/gitpulse create-issue` - Create a new GitHub issue\n• `/gitpulse issuelist` - List issues in your repository\n• `/gitpulse prlist` - List pull requests in your repository\n• `/gitpulse assign <issueId>` - Assign an issue to MCP\n• `/gitpulse switchrepo` - Switch to a different repository\n• `/gitpulse logout` - Disconnect your GitHub account\n• `/gitpulse status` - Check bot configuration status\n• `/gitpulse help` - Show this help message\n\nYou can also mention @GitPulse in any channel to get my attention!',
            });
          }
      }
    }

    console.log('Unknown command received:', command);
    return NextResponse.json({ 
      response_type: 'ephemeral',
      text: `❌ Unknown command: ${command}` 
    });
  } catch (error) {
    console.error('Slash command handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Always return 200 to prevent dispatch_failed, but with error message
    return NextResponse.json({ 
      response_type: 'ephemeral',
      text: `❌ Sorry, something went wrong: ${errorMessage}. Please try again.` 
    }, { status: 200 });
  }
}

// GET handler for health checks
export async function GET() {
  return NextResponse.json({ 
    message: 'Slack commands endpoint is active',
    method: 'POST',
    note: 'This endpoint only accepts POST requests from Slack slash commands'
  });
}