'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

export type Message = {
    id: string;
    sender: string;
    senderId: string;
    avatarUrl: string;
    text: string;
    timestamp: {
      seconds: number;
      nanoseconds: number;
    } | null;
    mentions?: string[]; // Array of mentioned usernames
    isIssue?: boolean;
    issueDetails?: {
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
      assignees?: string[]; // Array of GitHub usernames to assign
    };
    issueUrl?: string; // URL of the created GitHub issue
    status?: 'pending' | 'completed'; // Status of the AI suggestion
    isSystemMessage?: boolean;
    systemMessageType?: 'issue-list' | 'pr-list' | 'pr-verification';
    systemMessageData?: any[];
    tempId?: string; // temporary Id for optimistic updates
};

type ChatMessageProps = {
  message: Message;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const { sender, avatarUrl, text, timestamp, mentions } = message;

  const timeAgo = timestamp
    ? formatDistanceToNow(new Date(timestamp.seconds * 1000), { addSuffix: true })
    : 'just now';
  
  const isAI = sender === 'GitPulse AI';

  // Function to render text with highlighted mentions
  const renderTextWithMentions = (text: string) => {
    if (!mentions || mentions.length === 0) {
      return text;
    }

    // Create a regex to match @mentions
    const mentionRegex = /@(\w+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // Add the highlighted mention
      const mentionedUser = match[1];
      if (mentions.includes(mentionedUser)) {
        parts.push(
          <span
            key={match.index}
            className="bg-primary/10 text-primary font-medium px-1 rounded"
          >
            @{mentionedUser}
          </span>
        );
      } else {
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="flex items-start gap-3">
      <Avatar className={`h-10 w-10 ${isAI ? 'border-2 border-primary' : ''}`}>
        <AvatarImage src={avatarUrl} alt={sender} />
        <AvatarFallback>{sender.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{sender}</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <div className="text-sm text-foreground/90 whitespace-pre-wrap">
          {renderTextWithMentions(text)}
        </div>
      </div>
    </div>
  );
}
