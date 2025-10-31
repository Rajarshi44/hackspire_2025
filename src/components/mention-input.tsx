'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useCollaborators, type Collaborator } from '@/hooks/use-collaborators';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

type MentionInputProps = {
  value: string;
  onChange: (value: string, mentions: string[]) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  repoFullName: string;
  className?: string;
  rows?: number;
};

type MentionSuggestion = {
  collaborator: Collaborator;
  startIndex: number;
  query: string;
};

export function MentionInput({
  value,
  onChange,
  onKeyDown,
  placeholder = "Type a message or @ to mention someone...",
  disabled,
  repoFullName,
  className,
  rows = 1,
}: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { collaborators } = useCollaborators(repoFullName);

  const extractMentions = useCallback((text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }, []);

  const findMentionQuery = useCallback((text: string, cursorPosition: number) => {
    const beforeCursor = text.slice(0, cursorPosition);
    const atIndex = beforeCursor.lastIndexOf('@');
    
    if (atIndex === -1) return null;
    
    const afterAt = beforeCursor.slice(atIndex + 1);
    const spaceIndex = afterAt.indexOf(' ');
    
    if (spaceIndex !== -1) return null;
    
    return {
      query: afterAt,
      startIndex: atIndex,
    };
  }, []);

  const updateSuggestions = useCallback(() => {
    if (!textareaRef.current || !collaborators.length) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const cursorPosition = textareaRef.current.selectionStart;
    const mentionInfo = findMentionQuery(value, cursorPosition);

    if (!mentionInfo) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const { query, startIndex } = mentionInfo;
    const filteredCollaborators = collaborators.filter(collab =>
      collab.username?.toLowerCase().includes(query.toLowerCase()) ||
      collab.name.toLowerCase().includes(query.toLowerCase())
    );

    if (filteredCollaborators.length > 0) {
      setSuggestions(
        filteredCollaborators.map(collaborator => ({
          collaborator,
          startIndex,
          query,
        }))
      );
      setShowSuggestions(true);
      setSelectedSuggestionIndex(0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, collaborators, findMentionQuery]);

  useEffect(() => {
    updateSuggestions();
  }, [updateSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const mentions = extractMentions(newValue);
    onChange(newValue, mentions);
  };

  const insertMention = (collaborator: Collaborator) => {
    if (!textareaRef.current) return;

    const cursorPosition = textareaRef.current.selectionStart;
    const mentionInfo = findMentionQuery(value, cursorPosition);
    
    if (!mentionInfo) return;

    const { startIndex } = mentionInfo;
    const username = collaborator.username || collaborator.name;
    const beforeMention = value.slice(0, startIndex);
    const afterMention = value.slice(cursorPosition);
    
    const newValue = `${beforeMention}@${username} ${afterMention}`;
    const mentions = extractMentions(newValue);
    
    onChange(newValue, mentions);
    setShowSuggestions(false);
    
    // Set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = startIndex + username.length + 2; // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
        case 'Tab':
          event.preventDefault();
          insertMention(suggestions[selectedSuggestionIndex].collaborator);
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    }
    
    if (onKeyDown) {
      onKeyDown(event);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={rows}
        disabled={disabled}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-md shadow-md z-50 max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.collaborator.id}
              className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-accent ${
                index === selectedSuggestionIndex ? 'bg-accent' : ''
              }`}
              onClick={() => insertMention(suggestion.collaborator)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={suggestion.collaborator.avatarUrl} />
                <AvatarFallback className="text-xs">
                  {suggestion.collaborator.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  @{suggestion.collaborator.username || suggestion.collaborator.name}
                </div>
                {suggestion.collaborator.username && suggestion.collaborator.username !== suggestion.collaborator.name && (
                  <div className="text-xs text-muted-foreground truncate">
                    {suggestion.collaborator.name}
                  </div>
                )}
              </div>
              {suggestion.collaborator.role && (
                <div className="text-xs text-muted-foreground capitalize">
                  {suggestion.collaborator.role.replace('-', ' ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}