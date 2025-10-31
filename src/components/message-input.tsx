'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SendHorizonal } from 'lucide-react';
import { CommandPopover } from './command-popover';
import { MentionInput } from './mention-input';

type MessageInputProps = {
  onSendMessage: (text: string, mentions?: string[]) => void;
  disabled?: boolean;
  repoFullName: string;
};

export function MessageInput({ onSendMessage, disabled, repoFullName }: MessageInputProps) {
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);
  const [showCommandPopover, setShowCommandPopover] = useState(false);

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text, mentions);
      setText('');
      setMentions([]);
      setShowCommandPopover(false);
    }
  };

  const handleInputChange = (newText: string, newMentions: string[]) => {
    setText(newText);
    setMentions(newMentions);
    
    // Only show popover if the user types '/' as the first character
    if (newText === '/') {
        setShowCommandPopover(true);
    } else if (showCommandPopover && !newText.startsWith('/')) {
        setShowCommandPopover(false);
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleCommandSelect = (command: string) => {
    // Replace the entire text with the selected command
    setText(command + ' ');
    setMentions([]);
    setShowCommandPopover(false);
  };

  useEffect(() => {
    if (disabled) {
        setText('');
        setMentions([]);
    }
  }, [disabled]);

  return (
    <div className="relative">
       <CommandPopover
        open={showCommandPopover}
        onOpenChange={setShowCommandPopover}
        onCommandSelect={handleCommandSelect}
      >
        <MentionInput
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message, / for commands, or @ to mention someone..."
            className="pr-20"
            rows={1}
            disabled={disabled}
            repoFullName={repoFullName}
        />
      </CommandPopover>
      <Button
        type="submit"
        size="icon"
        className="absolute bottom-2 right-2 h-8 w-12"
        onClick={handleSend}
        disabled={!text.trim() || disabled}
      >
        <SendHorizonal className="h-4 w-4" />
        <span className="sr-only">Send</span>
      </Button>
    </div>
  );
}
