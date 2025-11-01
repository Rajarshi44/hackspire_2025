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
              const analysisResult = await Promise.race([analysisPromise, timeoutPromise]);
              console.log('Analysis completed:', { hasIssue: analysisResult.hasIssue });
              
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
              console.warn('Analysis timed out, returning immediate response');
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

            // User is authenticated - get their repositories
            const userRepos = await slackUserService.getUserRepositories(userId);
            console.log('User repositories:', { userId, repoCount: userRepos.length });
            
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
                    text: '📝 *Create GitHub Issue*\n\nSelect a repository and provide issue details:'
                  }
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `🔗 *Connected as:* Your GitHub account\n📁 *Available repositories:* ${userRepos.length} found`
                  },
                  accessory: {
                    type: 'static_select',
                    placeholder: {
                      type: 'plain_text',
                      text: 'Select repository...'
                    },
                    options: repoOptions,
                    action_id: 'select_repository'
                  }
                },
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '📝 Continue with Issue Details'
                      },
                      action_id: 'show_issue_form',
                      style: 'primary'
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔄 Refresh Repositories'
                      },
                      action_id: 'refresh_repos'
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

            console.log('Fetching issue list for user:', userIdString);
            const { slackUserService } = await import('@/lib/slack-user-service');

            const userRepos = await slackUserService.getUserRepositories(userIdString);
            if (userRepos.length === 0) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '❌ No repositories found. Please connect your GitHub account.',
              });
            }

            // Fetch real data for issues from GitHub
            const issues = await slackUserService.getIssuesForRepository(userRepos[0], userIdString);
            const issueList = issues.map((issue: { number: number; title: string }) => `• #${issue.number}: ${issue.title}`).join('\n');

            return NextResponse.json({
              response_type: 'ephemeral',
              text: `📝 *Issue List for ${userRepos[0]}:*
${issueList}`,
            });
          } catch (error) {
            console.error('Error fetching issue list:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: '❌ Failed to fetch issue list. Please try again.',
            });
          }

        case 'prlist':
          try {
            const userIdString = userId || ''; // Ensure userId is a string

            console.log('Fetching PR list for user:', userIdString);
            const { slackUserService } = await import('@/lib/slack-user-service');

            const userRepos = await slackUserService.getUserRepositories(userIdString);
            if (userRepos.length === 0) {
              return NextResponse.json({
                response_type: 'ephemeral',
                text: '❌ No repositories found. Please connect your GitHub account.',
              });
            }

            // Fetch real data for pull requests from GitHub
            const prs = await slackUserService.getPullRequestsForRepository(userRepos[0], userIdString);
            const prList = prs.map((pr: { number: number; title: string; state: string }) => `• #${pr.number}: ${pr.title} (${pr.state})`).join('\n');

            return NextResponse.json({
              response_type: 'ephemeral',
              text: `🔀 *Pull Request List for ${userRepos[0]}:*
${prList}`,
            });
          } catch (error) {
            console.error('Error fetching PR list:', error);
            return NextResponse.json({
              response_type: 'ephemeral',
              text: '❌ Failed to fetch PR list. Please try again.',
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

        case 'status':
          const statusChecks = {
            slackBotToken: !!process.env.SLACK_BOT_TOKEN,
            slackSigningSecret: !!process.env.SLACK_SIGNING_SECRET,
            googleGenaiApiKey: !!process.env.GOOGLE_GENAI_API_KEY,
            timestamp: new Date().toISOString()
          };
          
          return NextResponse.json({
            response_type: 'ephemeral',
            text: 'Bot Status Check',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `🔧 *Bot Configuration Status*\n\n• Slack Bot Token: ${statusChecks.slackBotToken ? '✅' : '❌'}\n• Slack Signing Secret: ${statusChecks.slackSigningSecret ? '✅' : '❌'}\n• Google GenAI API Key: ${statusChecks.googleGenaiApiKey ? '✅' : '❌'}\n• Server Time: ${statusChecks.timestamp}`
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
                  text: '*GitPulse Commands:*\n\n• `/gitpulse analyze` - Analyze recent channel messages for potential issues\n• `/gitpulse create-issue` - Create a new GitHub issue\n• `/gitpulse issuelist` - List issues in your repository\n• `/gitpulse prlist` - List pull requests in your repository\n• `/gitpulse assign <issueId>` - Assign an issue to MCP\n• `/gitpulse status` - Check bot configuration status\n• `/gitpulse help` - Show this help message\n\nYou can also mention @GitPulse in any channel to get my attention!'
                }
              }
            ]
          });
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