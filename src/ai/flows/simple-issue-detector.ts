'use server';

/**
 * Simple fallback issue detector without complex AI prompts
 */

export interface SimpleDetectIssueInput {
  messages: Array<{
    sender: string;
    text: string;
  }>;
  mentions?: string[];
}

export interface SimpleDetectIssueOutput {
  is_issue: boolean;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignees: string[];
}

export async function simpleDetectIssue(input: SimpleDetectIssueInput): Promise<SimpleDetectIssueOutput> {
  try {
    console.log('🔍 Simple issue detector starting:', {
      messagesCount: input.messages?.length,
      mentionsCount: input.mentions?.length
    });

    // Get the latest message
    const latestMessage = input.messages[input.messages.length - 1];
    const messageText = latestMessage?.text?.toLowerCase() || '';

    // Simple keyword-based detection
    const issueKeywords = {
      high: ['bug', 'error', 'crash', 'broken', 'urgent', 'critical', 'fail'],
      medium: ['feature', 'add', 'need', 'should', 'improve', 'enhance'],
      low: ['question', 'help', 'clarify', 'discuss']
    };

    let priority: 'low' | 'medium' | 'high' = 'low';
    let isIssue = false;

    // Check for high priority keywords
    if (issueKeywords.high.some(keyword => messageText.includes(keyword))) {
      priority = 'high';
      isIssue = true;
    } else if (issueKeywords.medium.some(keyword => messageText.includes(keyword))) {
      priority = 'medium';
      isIssue = true;
    } else if (issueKeywords.low.some(keyword => messageText.includes(keyword))) {
      priority = 'low';
      isIssue = true;
    }

    // Check for specific issue patterns
    const issuePatterns = [
      /let'?s?\s+(add|create|fix|implement)/i,
      /we\s+(need|should|could)\s+/i,
      /can\s+we\s+/i,
      /add\s+a?\s+/i,
      /create\s+a?\s+/i,
    ];

    if (!isIssue) {
      isIssue = issuePatterns.some(pattern => pattern.test(latestMessage?.text || ''));
      if (isIssue) {
        priority = 'medium';
      }
    }

    const result: SimpleDetectIssueOutput = {
      is_issue: isIssue,
      title: isIssue ? generateTitle(latestMessage?.text || '') : '',
      description: isIssue ? generateDescription(input.messages) : '',
      priority,
      assignees: input.mentions || []
    };

    console.log('🔍 Simple issue detector result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in simple issue detector:', error);
    return {
      is_issue: false,
      title: '',
      description: '',
      priority: 'low',
      assignees: []
    };
  }
}

function generateTitle(messageText: string): string {
  // Extract a reasonable title from the message
  const cleaned = messageText.replace(/<@[^>]+>/g, '').trim();
  const words = cleaned.split(' ').slice(0, 8);
  let title = words.join(' ');
  
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }
  
  return title || 'Issue from Slack';
}

function generateDescription(messages: Array<{sender: string; text: string}>): string {
  const contextMessages = messages.slice(-3);
  let description = 'Issue reported from Slack conversation:\n\n';
  
  contextMessages.forEach(msg => {
    description += `**${msg.sender}**: ${msg.text}\n\n`;
  });
  
  description += '\n---\n_Created by GitPulse AI from Slack_';
  
  return description;
}