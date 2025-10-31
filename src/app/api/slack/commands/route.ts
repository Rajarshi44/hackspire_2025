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
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `❌ Error analyzing messages: ${errorMessage}. Please try again.`,
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
                  text: '*GitPulse Commands:*\n\n• `/gitpulse analyze` - Analyze recent channel messages for potential issues\n• `/gitpulse create-issue` - Create a new GitHub issue\n• `/gitpulse status` - Check bot configuration status\n• `/gitpulse help` - Show this help message\n\nYou can also mention @GitPulse in any channel to get my attention!'
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