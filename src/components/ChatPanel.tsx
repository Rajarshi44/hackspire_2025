'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, AtSign, Hash, Smile, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageBubble, sampleMessages, type Message } from '@/components/MessageBubble';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  messages?: Message[];
  onSendMessageAction: (content: string, mentions?: string[]) => void;
  onMessageActionClickAction?: (messageId: string, action: string) => void;
  isLoading?: boolean;
}

export function ChatPanel({
  messages = sampleMessages,
  onSendMessageAction,
  onMessageActionClickAction,
  isLoading = false
}: ChatPanelProps) {
  const [messageInput, setMessageInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    // Extract mentions (@username)
    const mentions = messageInput.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
    
    onSendMessageAction(messageInput, mentions);
    setMessageInput('');
    setShowMentions(false);
    setShowCommands(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessageInput(value);

    // Show command suggestions when typing /
    if (value.endsWith('/') || value.includes('/')) {
      setShowCommands(true);
      setShowMentions(false);
    }
    // Show mention suggestions when typing @
    else if (value.endsWith('@') || value.includes('@')) {
      setShowMentions(true);
      setShowCommands(false);
    } else {
      setShowCommands(false);
      setShowMentions(false);
    }
  };

  const insertCommand = (command: string) => {
    const newValue = messageInput.replace(/\/\w*$/, command);
    setMessageInput(newValue);
    setShowCommands(false);
    inputRef.current?.focus();
  };

  const insertMention = (username: string) => {
    const newValue = messageInput.replace(/@\w*$/, `@${username} `);
    setMessageInput(newValue);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Group messages by time proximity
  const groupedMessages = messages.reduce((groups: Message[][], message, index) => {
    if (index === 0) {
      groups.push([message]);
      return groups;
    }

    const lastGroup = groups[groups.length - 1];
    const lastMessage = lastGroup[lastGroup.length - 1];
    const timeDiff = message.timestamp.getTime() - lastMessage.timestamp.getTime();
    const sameSender = message.sender.name === lastMessage.sender.name;

    // Group if same sender and within 5 minutes
    if (sameSender && timeDiff < 5 * 60 * 1000) {
      lastGroup.push(message);
    } else {
      groups.push([message]);
    }

    return groups;
  }, []);

  const commands = [
    { name: '/ai-analyze', description: 'Analyze conversation for issues' },
    { name: '/create-issue', description: 'Create GitHub issue manually' },
    { name: '/list-issues', description: 'Show open GitHub issues' },
    { name: '/assign', description: 'Assign task to team member' },
  ];

  const teamMembers = [
    { username: 'john.doe', name: 'John Doe' },
    { username: 'sarah.chen', name: 'Sarah Chen' },
    { username: 'mike.wilson', name: 'Mike Wilson' },
    { username: 'alex.kim', name: 'Alex Kim' },
  ];

  return (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-xl">
      {/* Header */}
      <div className="border-b border-border/50 p-4">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/30">
            <TabsTrigger value="chat" className="text-sm">Chat</TabsTrigger>
            <TabsTrigger value="suggestions" className="text-sm">AI Suggestions</TabsTrigger>
            <TabsTrigger value="issues" className="text-sm">View Issues</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-1">
          {groupedMessages.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-1">
              {group.map((message, messageIndex) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isGrouped={messageIndex > 0}
                  onActionClickAction={onMessageActionClickAction}
                />
              ))}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-center space-x-2 text-muted-foreground animate-pulse">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
              <span className="text-sm">GitPulse AI is thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border/50 p-4 relative">
        {/* Command/Mention Suggestions */}
        {(showCommands || showMentions) && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-card/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl z-10">
            {showCommands && (
              <div className="p-2">
                <div className="text-xs text-muted-foreground mb-2 px-2">Commands</div>
                {commands.map((command) => (
                  <button
                    key={command.name}
                    onClick={() => insertCommand(command.name)}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-sm font-medium text-primary">{command.name}</div>
                    <div className="text-xs text-muted-foreground">{command.description}</div>
                  </button>
                ))}
              </div>
            )}
            
            {showMentions && (
              <div className="p-2">
                <div className="text-xs text-muted-foreground mb-2 px-2">Team Members</div>
                {teamMembers.map((member) => (
                  <button
                    key={member.username}
                    onClick={() => insertMention(member.username)}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-sm font-medium text-accent">@{member.username}</div>
                    <div className="text-xs text-muted-foreground">{member.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={messageInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message, / for commands, or @ to mention someone…"
              className={cn(
                "pl-4 pr-20 py-3 bg-muted/30 border-border/50 rounded-xl",
                "focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                "placeholder:text-muted-foreground"
              )}
            />
            
            {/* Input Actions */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <AtSign className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Hash className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Smile className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Send Button */}
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isLoading}
            className={cn(
              "h-12 w-12 rounded-xl relative overflow-hidden",
              "bg-gradient-to-r from-primary to-accent",
              "hover:shadow-lg hover:shadow-primary/25",
              "transition-all duration-200"
            )}
          >
            <Send className="h-5 w-5" />
            {messageInput.trim() && (
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 animate-pulse" />
            )}
          </Button>
        </div>

        {/* Input Helper Text */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>Press <kbd className="px-1 py-0.5 bg-muted/50 rounded">Enter</kbd> to send</span>
            <span>Use <kbd className="px-1 py-0.5 bg-muted/50 rounded">/</kbd> for commands</span>
            <span>Use <kbd className="px-1 py-0.5 bg-muted/50 rounded">@</kbd> to mention</span>
          </div>
          <div>
            {messageInput.length}/1000
          </div>
        </div>
      </div>
    </div>
  );
}
