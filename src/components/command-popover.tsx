'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bot, GitPullRequest, Github, UserPlus, ListTodo, GitPullRequestArrow } from 'lucide-react';

const commands = [
  { name: '/issue', description: 'Create a new GitHub issue. Use @username to assign.', icon: <Github className="w-4 h-4" /> },
  { name: '/issuelist', description: 'List open issues.', icon: <ListTodo className="w-4 h-4" /> },
  { name: '/prlist', description: 'List open pull requests.', icon: <GitPullRequestArrow className="w-4 h-4" /> },
  { name: '/solved', description: 'Mark an issue as solved and verify PRs.', icon: <GitPullRequest className="w-4 h-4" /> },
  { name: '/collaborator', description: 'Invite a collaborator.', icon: <UserPlus className="w-4 h-4" /> },
  { name: '/ask', description: 'Ask the AI a question.', icon: <Bot className="w-4 h-4" /> },
];

type CommandPopoverProps = {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommandSelect: (command: string) => void;
};

export function CommandPopover({ children, open, onOpenChange, onCommandSelect }: CommandPopoverProps) {
  console.log('CommandPopover render - open:', open); // Debug log

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-1" align="start" side="top">
        <div className="p-2 text-sm font-semibold">Commands</div>
        <div className="flex flex-col">
          {commands.map((command, index) => (
            <button
              key={command.name}
              onClick={() => {
                console.log('Command selected:', command.name); // Debug log
                onCommandSelect(command.name);
              }}
              className="flex items-center gap-2 p-2 rounded-md text-left hover:bg-accent transition-colors"
            >
              <div className="p-1.5 bg-secondary rounded-md">{command.icon}</div>
              <div>
                <div className="font-medium">{command.name}</div>
                <div className="text-xs text-muted-foreground">{command.description}</div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
