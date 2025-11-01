'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  const [isInCommandMode, setIsInCommandMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text, mentions);
      setText('');
      setMentions([]);
      setShowCommandPopover(false);
      setIsInCommandMode(false);
    }
  };

  // Known commands list
  const knownCommands = ['/issue', '/issuelist', '/prlist', '/solved', '/collaborator', '/ask'];

  // Command-specific input change handler
  const handleCommandInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    // Command detection logic - only show popover for incomplete commands
    if (newText.startsWith('/')) {
      // Check if this is a complete command followed by a space
      const hasSpace = newText.includes(' ');
      const firstWord = newText.split(' ')[0];
      const isCompleteCommand = knownCommands.includes(firstWord);
      
      if (!hasSpace || !isCompleteCommand) {
        // Still typing the command, show popover
        setIsInCommandMode(true);
        setShowCommandPopover(true);
      } else {
        // Complete command + space, hide popover but stay in command mode for now
        setShowCommandPopover(false);
        // Don't exit command mode yet, let them finish typing
      }
    } else {
      // Not a command anymore
      setShowCommandPopover(false);
      setIsInCommandMode(false);
      if (newText.includes('@')) {
        // Switch to mention mode if @ is detected
        setIsInCommandMode(false);
      }
    }
  };

  // Mention-specific input change handler 
  const handleMentionInputChange = (newText: string, newMentions: string[]) => {
    console.log('Mention input change:', newText, 'mentions:', newMentions); // Debug log
    setText(newText);
    setMentions(newMentions);
    
    // Check if we need to switch to command mode
    if (newText.startsWith('/') && !isInCommandMode) {
      setIsInCommandMode(true);
      setShowCommandPopover(true);
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleCommandSelect = (command: string) => {
    const newText = command + ' ';
    setText(newText);
    setMentions([]);
    setShowCommandPopover(false);
    setIsInCommandMode(false); // Exit command mode so user can type normally
    
    // Focus back to input and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursorPos = newText.length;
        textareaRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    }, 0);
  };

  useEffect(() => {
    if (disabled) {
        setText('');
        setMentions([]);
        setShowCommandPopover(false);
        setIsInCommandMode(false);
    }
  }, [disabled]);

  // Use command mode for "/" or mention mode for "@" 
  const shouldUseMentionInput = !isInCommandMode && (text.includes('@') || mentions.length > 0);
  
  console.log('Input mode - isInCommandMode:', isInCommandMode, 'shouldUseMentionInput:', shouldUseMentionInput, 'text:', text, 'mentions:', mentions); // Debug log

  return (
    <div className="relative">
      {isInCommandMode ? (
        // Command mode - use regular textarea
        <CommandPopover
          open={showCommandPopover}
          onOpenChange={setShowCommandPopover}
          onCommandSelect={handleCommandSelect}
        >
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={handleCommandInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message, / for commands, or @ to mention someone..."
            className="pr-20"
            rows={1}
            disabled={disabled}
          />
        </CommandPopover>
      ) : shouldUseMentionInput ? (
        // Mention mode - use MentionInput
        <MentionInput
          value={text}
          onChange={handleMentionInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message, / for commands, or @ to mention someone..."
          className="pr-20"
          rows={1}
          disabled={disabled}
          repoFullName={repoFullName}
        />
      ) : (
        // Default mode - regular textarea that can switch modes
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            const newText = e.target.value;
            setText(newText);
            
            // Extract mentions when in default mode
            if (newText.includes('@')) {
              const mentionRegex = /@(\w+)/g;
              const extractedMentions: string[] = [];
              let match;
              while ((match = mentionRegex.exec(newText)) !== null) {
                extractedMentions.push(match[1]);
              }
              setMentions(extractedMentions);
              console.log('Extracted mentions in default mode:', extractedMentions); // Debug log
            } else {
              setMentions([]);
            }
            
            // Smart command detection for default mode
            if (newText.startsWith('/')) {
              // Check if this is just starting to type a command
              const hasSpace = newText.includes(' ');
              const firstWord = newText.split(' ')[0];
              const isCompleteCommand = knownCommands.includes(firstWord);
              
              if (!hasSpace || !isCompleteCommand) {
                // Starting to type a command, switch to command mode
                setIsInCommandMode(true);
                setShowCommandPopover(true);
              }
              // If it's a complete command + space, stay in default mode
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message, / for commands, or @ to mention someone..."
          className="pr-20"
          rows={1}
          disabled={disabled}
        />
      )}
      
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
