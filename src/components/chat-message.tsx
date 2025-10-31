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
    isIssue?: boolean;
    issueDetails?: {
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
    };
    issueUrl?: string; // URL of the created GitHub issue
    status?: 'pending' | 'completed'; // Status of the AI suggestion
    isSystemMessage?: boolean;
    systemMessageType?: 'issue-list' | 'pr-list';
    systemMessageData?: any[];
    tempId?: string; // temporary Id for optimistic updates
};

type ChatMessageProps = {
  message: Message;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const { sender, avatarUrl, text, timestamp } = message;

  const timeAgo = timestamp
    ? formatDistanceToNow(new Date(timestamp.seconds * 1000), { addSuffix: true })
    : 'just now';
  
  const isAI = sender === 'GitPulse AI';

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
        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
