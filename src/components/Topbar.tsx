'use client';

import { useState } from 'react';
import { ChevronDown, Bot, ListTodo, User, Settings, LogOut, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface TopbarProps {
  currentRepo: string;
  currentChannel: string;
  isAiActive: boolean;
  isKanbanOpen: boolean;
  onToggleKanbanAction: () => void;
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  onProfileAction: () => void;
  onLogoutAction: () => void;
}

export function Topbar({
  currentRepo,
  currentChannel,
  isAiActive,
  isKanbanOpen,
  onToggleKanbanAction,
  user,
  onProfileAction,
  onLogoutAction,
}: TopbarProps) {
  return (
    <header className="flex items-center justify-between h-16 px-6 bg-card/30 backdrop-blur-xl border-b border-border/50">
      {/* Left: Current Context */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <h1 className="text-lg font-bold text-foreground">
            {currentRepo}
          </h1>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <div className="text-muted-foreground">/</div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-accent">
            #{currentChannel}
          </span>
        </div>
      </div>

      {/* Center: Status Indicators */}
      <div className="flex items-center space-x-4">
        {/* AI Active Indicator */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Bot className="h-5 w-5 text-primary" />
            {isAiActive && (
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-accent rounded-full animate-pulse" />
            )}
          </div>
          <Badge variant={isAiActive ? "default" : "secondary"} className="text-xs">
            {isAiActive ? "🟢 AI Active" : "⚫ AI Standby"}
          </Badge>
        </div>
      </div>

      {/* Right: Actions & User */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
        </Button>

        {/* Kanban Toggle */}
        <Button
          variant={isKanbanOpen ? "default" : "outline"}
          size="sm"
          onClick={onToggleKanbanAction}
          className="relative overflow-hidden group"
        >
          <ListTodo className="h-4 w-4 mr-2" />
          {isKanbanOpen ? "Hide Kanban" : "Show Kanban"}
          {isKanbanOpen && (
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 opacity-50" />
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent className="w-56 bg-card/90 backdrop-blur-xl border border-border/50" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            
            <DropdownMenuSeparator className="bg-border/50" />
            
            <DropdownMenuItem onClick={onProfileAction} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-border/50" />
            
            <DropdownMenuItem onClick={onLogoutAction} className="cursor-pointer text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
