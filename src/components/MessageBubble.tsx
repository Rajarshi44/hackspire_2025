'use client';

import { formatDistanceToNow } from 'date-fns';
import { Bot, User, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface Message {
  id: string;
  sender: {
    name: string;
    avatar?: string;
    type: 'developer' | 'ai';
  };
  content: string;
  timestamp: Date;
  type: 'message' | 'suggestion' | 'issue' | 'system';
  metadata?: {
    priority?: 'low' | 'medium' | 'high';
    assignee?: string;
    issueUrl?: string;
    status?: 'pending' | 'approved' | 'rejected';
  };
}

interface MessageBubbleProps {
  message: Message;
  isGrouped?: boolean;
  onActionClickAction?: (messageId: string, action: string) => void;
}

export function MessageBubble({ 
  message, 
  isGrouped = false, 
  onActionClickAction 
}: MessageBubbleProps) {
  const isAI = message.sender.type === 'ai';
  const isDeveloper = message.sender.type === 'developer';

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-accent';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-accent" />;
      case 'rejected': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  return (
    <div className={cn(
      "group flex space-x-3",
      isGrouped && "mt-1",
      !isGrouped && "mt-4"
    )}>
      {/* Avatar */}
      {!isGrouped && (
        <Avatar className={cn(
          "h-8 w-8 ring-2",
          isAI && "ring-primary/30",
          isDeveloper && "ring-accent/30"
        )}>
          <AvatarImage src={message.sender.avatar} alt={message.sender.name} />
          <AvatarFallback className={cn(
            "text-xs font-semibold",
            isAI && "bg-primary/10 text-primary",
            isDeveloper && "bg-accent/10 text-accent"
          )}>
            {isAI ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
      )}
      
      {isGrouped && <div className="w-8" />}

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        {!isGrouped && (
          <div className="flex items-center space-x-2 mb-1">
            <span className={cn(
              "text-sm font-semibold",
              isAI && "text-primary",
              isDeveloper && "text-accent"
            )}>
              {message.sender.name}
            </span>
            
            {isAI && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                AI Assistant
              </Badge>
            )}
            
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(message.timestamp, { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Message Card */}
        <Card className={cn(
          "transition-all duration-200",
          isAI && "border-primary/30 bg-primary/5 shadow-lg shadow-primary/10",
          isDeveloper && "border-accent/30 bg-accent/5 shadow-md shadow-accent/5",
          message.type === 'suggestion' && "border-yellow-500/30 bg-yellow-500/5",
          message.type === 'issue' && "border-destructive/30 bg-destructive/5"
        )}>
          <CardContent className="p-3">
            {/* Message Type Badge */}
            {message.type !== 'message' && (
              <div className="flex items-center space-x-2 mb-2">
                {message.type === 'suggestion' && (
                  <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-500">
                    💡 AI Suggestion
                  </Badge>
                )}
                {message.type === 'issue' && (
                  <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                    🐛 Issue Detected
                  </Badge>
                )}
                {message.type === 'system' && (
                  <Badge variant="outline" className="text-xs">
                    🔔 System
                  </Badge>
                )}
                
                {message.metadata?.status && getStatusIcon(message.metadata.status)}
              </div>
            )}

            {/* Content */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </div>
            </div>

            {/* Metadata */}
            {message.metadata && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                <div className="flex items-center space-x-3">
                  {message.metadata.priority && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-muted-foreground">Priority:</span>
                      <Badge variant="outline" className={cn(
                        "text-xs capitalize",
                        getPriorityColor(message.metadata.priority)
                      )}>
                        {message.metadata.priority}
                      </Badge>
                    </div>
                  )}
                  
                  {message.metadata.assignee && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-muted-foreground">Assignee:</span>
                      <span className="text-xs font-medium">@{message.metadata.assignee}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {message.metadata.issueUrl && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={() => window.open(message.metadata?.issueUrl, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Issue
                    </Button>
                  )}
                  
                  {message.type === 'suggestion' && !message.metadata.issueUrl && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs border-accent/30 text-accent hover:bg-accent/10"
                        onClick={() => onActionClickAction?.(message.id, 'approve')}
                      >
                        Create Issue
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => onActionClickAction?.(message.id, 'reject')}
                      >
                        Dismiss
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Sample messages for demo
export const sampleMessages: Message[] = [
  {
    id: "1",
    sender: { name: "John Doe", type: "developer", avatar: "/avatars/john.jpg" },
    content: "Hey team, I'm seeing some weird behavior with the login form. Users are getting stuck on the loading screen after submitting their credentials.",
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    type: "message"
  },
  {
    id: "2", 
    sender: { name: "GitPulse AI", type: "ai" },
    content: "I've detected a potential issue based on the conversation. This seems like a UI blocking bug that could impact user authentication flow.",
    timestamp: new Date(Date.now() - 9 * 60 * 1000),
    type: "suggestion",
    metadata: {
      priority: "high",
      assignee: "john.doe"
    }
  },
  {
    id: "3",
    sender: { name: "Sarah Chen", type: "developer", avatar: "/avatars/sarah.jpg" },
    content: "I can reproduce this! It happens when the API takes longer than 5 seconds to respond. We should add a timeout.",
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    type: "message"
  },
  {
    id: "4",
    sender: { name: "GitPulse AI", type: "ai" },
    content: "Issue created successfully! 🎉\\n\\n**Login Form Timeout Bug**\\nThe authentication flow gets stuck when API responses exceed 5 seconds. Added timeout handling and user feedback.",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    type: "issue",
    metadata: {
      priority: "high",
      assignee: "john.doe",
      issueUrl: "https://github.com/acme-corp/frontend-app/issues/123",
      status: "approved"
    }
  }
];
