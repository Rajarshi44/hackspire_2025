import { aiDetectIssue, DetectIssueInput } from '@/ai/flows/ai-detects-potential-issues';
import { aiCreateGithubIssue, AICreateGithubIssueInput } from '@/ai/flows/ai-creates-github-issues';

interface SlackMessage {
  text: string;
  user: string;
  ts: string;
  channel: string;
}

interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
}

export class SlackAIService {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Fetch recent messages from a Slack channel
   */
  async getChannelHistory(channelId: string, limit: number = 10): Promise<SlackMessage[]> {
    const response = await fetch(`https://slack.com/api/conversations.history`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        limit: limit,
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Failed to fetch channel history: ${data.error}`);
    }

    return data.messages.reverse(); // Return in chronological order
  }

  /**
   * Get user information from Slack
   */
  async getUserInfo(userId: string): Promise<SlackUser> {
    const response = await fetch(`https://slack.com/api/users.info`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: userId,
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Failed to fetch user info: ${data.error}`);
    }

    return {
      id: data.user.id,
      name: data.user.name,
      real_name: data.user.real_name,
    };
  }

  /**
   * Extract GitHub usernames from mentions in Slack message text
   */
  extractGitHubMentions(text: string): string[] {
    // Look for patterns like @username or github.com/username
    const mentions: string[] = [];
    
    // Extract @username mentions (assuming they correspond to GitHub usernames)
    const atMentions = text.match(/@(\w+)/g);
    if (atMentions) {
      mentions.push(...atMentions.map(mention => mention.slice(1))); // Remove @ symbol
    }

    // Extract GitHub profile URLs
    const githubUrls = text.match(/github\.com\/([a-zA-Z0-9\-_]+)/g);
    if (githubUrls) {
      mentions.push(...githubUrls.map(url => url.split('/')[1]));
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Analyze Slack channel messages for potential GitHub issues
   */
  async analyzeChannelForIssues(channelId: string): Promise<{
    hasIssue: boolean;
    issueData?: any;
    message?: string;
  }> {
    try {
      // Get recent channel messages
      const messages = await this.getChannelHistory(channelId, 10);
      
      // Convert Slack messages to the format expected by AI
      const formattedMessages = await Promise.all(
        messages.map(async (msg) => {
          const userInfo = await this.getUserInfo(msg.user);
          return {
            sender: userInfo.name || userInfo.real_name || msg.user,
            text: msg.text,
          };
        })
      );

      // Get the latest message for mention extraction
      const latestMessage = messages[messages.length - 1];
      const mentions = this.extractGitHubMentions(latestMessage?.text || '');

      // Prepare input for AI detection
      const detectInput: DetectIssueInput = {
        messages: formattedMessages,
        mentions: mentions.length > 0 ? mentions : undefined,
      };

      // Use AI to detect if there's an issue
      const issueDetection = await aiDetectIssue(detectInput);

      return {
        hasIssue: issueDetection.is_issue,
        issueData: issueDetection.is_issue ? issueDetection : undefined,
        message: issueDetection.is_issue 
          ? `🔍 Detected potential issue: "${issueDetection.title}"` 
          : '✅ No actionable issues detected in recent messages.',
      };
    } catch (error) {
      console.error('Error analyzing channel for issues:', error);
      return {
        hasIssue: false,
        message: '❌ Error analyzing messages. Please try again.',
      };
    }
  }

  /**
   * Create a GitHub issue from Slack interaction
   */
  async createGitHubIssueFromSlack(
    title: string,
    description: string,
    repository: string,
    accessToken: string,
    assignees?: string[]
  ): Promise<{ success: boolean; issueUrl?: string; error?: string }> {
    try {
      // Parse repository string (owner/repo)
      const [repoOwner, repoName] = repository.split('/');
      
      if (!repoOwner || !repoName) {
        return {
          success: false,
          error: 'Invalid repository format. Use "owner/repository-name".',
        };
      }

      // Prepare input for AI GitHub issue creation
      const createInput: AICreateGithubIssueInput = {
        repoOwner,
        repoName,
        issueTitle: title,
        issueDescription: description,
        accessToken,
        assignees,
      };

      // Use AI to create the GitHub issue
      const result = await aiCreateGithubIssue(createInput);

      return {
        success: true,
        issueUrl: result.issueUrl,
      };
    } catch (error) {
      console.error('Error creating GitHub issue:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred.',
      };
    }
  }

  /**
   * Send a message to a Slack channel or user
   */
  async sendMessage(channel: string, text: string, blocks?: any[]): Promise<boolean> {
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          text,
          blocks,
        }),
      });

      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error('Error sending Slack message:', error);
      return false;
    }
  }

  /**
   * Automatically analyze a message and suggest creating an issue if detected
   */
  async autoAnalyzeMessage(
    channelId: string, 
    messageText: string, 
    userId: string
  ): Promise<{
    shouldSuggest: boolean;
    issueData?: any;
    userHasGitHub: boolean;
    userRepos?: string[];
  }> {
    try {
      // Get recent messages including the new one
      const messages = await this.getChannelHistory(channelId, 5);
      
      // Add the current message to analysis
      const userInfo = await this.getUserInfo(userId);
      const formattedMessages = await Promise.all(
        [...messages, { text: messageText, user: userId, ts: Date.now().toString(), channel: channelId }]
        .map(async (msg) => {
          const info = await this.getUserInfo(msg.user);
          return {
            sender: info.name || info.real_name || msg.user,
            text: msg.text,
          };
        })
      );

      // Extract GitHub mentions
      const mentions = this.extractGitHubMentions(messageText);

      // Use AI to detect potential issues
      const issueDetection = await aiDetectIssue({
        messages: formattedMessages,
        mentions: mentions.length > 0 ? mentions : undefined,
      });

      // Check if user has GitHub integration (you'll need to implement this)
      const userHasGitHub = await this.checkUserGitHubAuth(userId);
      const userRepos = userHasGitHub ? await this.getUserRepositories(userId) : [];

      return {
        shouldSuggest: issueDetection.is_issue,
        issueData: issueDetection.is_issue ? issueDetection : undefined,
        userHasGitHub,
        userRepos,
      };
    } catch (error) {
      console.error('Error in auto-analyze message:', error);
      return {
        shouldSuggest: false,
        userHasGitHub: false,
      };
    }
  }

  /**
   * Send a proactive suggestion message to create a GitHub issue
   */
  async sendIssueSuggestion(
    channelId: string,
    userId: string,
    issueData: any,
    userHasGitHub: boolean,
    userRepos: string[] = []
  ): Promise<boolean> {
    try {
      if (!userHasGitHub) {
        // User needs to authenticate with GitHub
        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🤖 *I detected a potential issue:*\n"${issueData.title}"\n\n💡 I can help you create a GitHub issue, but first you need to connect your GitHub account.`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Connect GitHub'
                },
                action_id: 'connect_github',
                style: 'primary',
                url: `${process.env.NEXTAUTH_URL}/auth/github?redirect=slack&user_id=${userId}`
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Dismiss'
                },
                action_id: 'dismiss_suggestion'
              }
            ]
          }
        ];

        return await this.sendMessage(channelId, 'GitHub issue detected - connect to create', blocks);
      }

      if (userRepos.length === 0) {
        // User has GitHub but no repos configured
        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🤖 *I detected a potential issue:*\n"${issueData.title}"\n\n📁 Please select which repository to create this issue in.`
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Select Repository'
                },
                action_id: 'select_repository',
                style: 'primary'
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Dismiss'
                },
                action_id: 'dismiss_suggestion'
              }
            ]
          }
        ];

        return await this.sendMessage(channelId, 'GitHub issue detected - select repository', blocks);
      }

      // User has GitHub and repos - show direct creation option
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🤖 *I detected a potential ${issueData.priority} priority issue:*\n\n**"${issueData.title}"**\n\n${issueData.description.substring(0, 200)}${issueData.description.length > 200 ? '...' : ''}`
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
              action_id: 'create_suggested_issue',
              style: 'primary',
              value: JSON.stringify({
                title: issueData.title,
                description: issueData.description,
                priority: issueData.priority,
                assignees: issueData.assignees
              })
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Not an Issue'
              },
              action_id: 'dismiss_suggestion'
            }
          ]
        }
      ];

      return await this.sendMessage(channelId, 'GitHub issue detected', blocks);
    } catch (error) {
      console.error('Error sending issue suggestion:', error);
      return false;
    }
  }



  /**
   * Check if user has GitHub authentication
   */
  private async checkUserGitHubAuth(slackUserId: string): Promise<boolean> {
    try {
      const { slackUserService } = await import('./slack-user-service');
      return await slackUserService.hasGitHubAuth(slackUserId);
    } catch (error) {
      console.error('Error checking GitHub auth:', error);
      return false;
    }
  }

  /**
   * Get user's available repositories
   */
  private async getUserRepositories(slackUserId: string): Promise<string[]> {
    try {
      const { slackUserService } = await import('./slack-user-service');
      const token = await slackUserService.getGitHubToken(slackUserId);
      
      if (!token) {
        return [];
      }

      // Fetch repositories from GitHub API
      const response = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch repositories from GitHub');
        return [];
      }

      const repos = await response.json();
      return repos
        .filter((repo: any) => !repo.fork && !repo.archived)
        .map((repo: any) => repo.full_name)
        .slice(0, 20); // Limit to 20 most recent
    } catch (error) {
      console.error('Error fetching user repositories:', error);
      return [];
    }
  }
}

// Export a singleton instance
export const slackAIService = new SlackAIService(process.env.SLACK_BOT_TOKEN || '');