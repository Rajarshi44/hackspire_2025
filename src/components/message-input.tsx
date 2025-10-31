'use client';

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SendHorizonal } from 'lucide-react';
import { CommandPopover } from './command-popover';

type MessageInputProps = {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
};

export function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [text, setText] = useState('');
  const [showCommandPopover, setShowCommandPopover] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text);
      setText('');
      setShowCommandPopover(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    
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
    setShowCommandPopover(false);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    if (disabled) {
        setText('');
    }
  }, [disabled]);

  return (
    <div className="relative">
       <CommandPopover
        open={showCommandPopover}
        onOpenChange={setShowCommandPopover}
        onCommandSelect={handleCommandSelect}
      >
        <Textarea
            ref={textareaRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or / for commands..."
            className="pr-20"
            rows={1}
            disabled={disabled}
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
