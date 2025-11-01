'use client';

import { useState } from 'react';
import { FolderGit2, MessageSquare, Plus, Settings, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Repository {
  id: string;
  name: string;
  owner: string;
  channels: Channel[];
}

interface Channel {
  id: string;
  name: string;
  unreadCount?: number;
}

interface SidebarProps {
  repositories: Repository[];
  activeRepo?: string;
  activeChannel?: string;
  onRepoSelectAction: (repoId: string) => void;
  onChannelSelectAction: (channelId: string) => void;
  onAddChannelAction: (repoId: string) => void;
}

export function Sidebar({
  repositories,
  activeRepo,
  activeChannel,
  onRepoSelectAction,
  onChannelSelectAction,
  onAddChannelAction,
}: SidebarProps) {
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set(activeRepo ? [activeRepo] : []));

  const toggleRepo = (repoId: string) => {
    const newExpanded = new Set(expandedRepos);
    if (newExpanded.has(repoId)) {
      newExpanded.delete(repoId);
    } else {
      newExpanded.add(repoId);
    }
    setExpandedRepos(newExpanded);
    onRepoSelectAction(repoId);
  };

  return (
    <div className="flex flex-col h-full w-80 bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg">
            <FolderGit2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              GitPulse
            </h1>
            <p className="text-xs text-muted-foreground">AI-Powered Development</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Repositories Section */}
          <div>
            <div className="flex items-center justify-between mb-2 px-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Repositories
              </h2>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="space-y-1">
              {repositories.map((repo) => {
                const isExpanded = expandedRepos.has(repo.id);
                const isActive = activeRepo === repo.id;
                
                return (
                  <div key={repo.id} className="space-y-1">
                    {/* Repository Header */}
                    <button
                      onClick={() => toggleRepo(repo.id)}
                      className={cn(
                        "w-full flex items-center space-x-2 px-3 py-2.5 text-left transition-colors border",
                        isActive 
                          ? "bg-primary/10 border-primary/30 text-foreground" 
                          : "bg-card border-border hover:bg-muted/50"
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="p-1 bg-muted border border-border rounded">
                        <FolderGit2 className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {repo.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {repo.owner}
                        </p>
                      </div>
                    </button>

                    {/* Channels */}
                    {isExpanded && (
                      <div className="ml-4 space-y-1 border-l border-border pl-2">
                        {repo.channels.map((channel) => {
                          const isChannelActive = activeChannel === channel.id;
                          
                          return (
                            <button
                              key={channel.id}
                              onClick={() => onChannelSelectAction(channel.id)}
                              className={cn(
                                "w-full flex items-center justify-between px-2 py-1.5 text-left transition-colors border",
                                isChannelActive
                                  ? "bg-accent/10 border-accent/30 text-foreground"
                                  : "bg-card border-border hover:bg-muted/50"
                              )}
                            >
                              <div className="flex items-center space-x-2">
                                <div className="p-0.5 bg-muted border border-border rounded">
                                  <MessageSquare className="h-2.5 w-2.5 text-accent" />
                                </div>
                                <span className="text-xs font-medium">
                                  #{channel.name}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-1">
                                {channel.unreadCount && channel.unreadCount > 0 && (
                                  <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded font-medium border border-primary/30">
                                    {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                                  </span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddChannelAction(repo.id);
                                  }}
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            </button>
                          );
                        })}
                        
                        {/* Add Channel Button */}
                        <button
                          onClick={() => onAddChannelAction(repo.id)}
                          className="w-full flex items-center space-x-2 px-2 py-1.5 text-left transition-colors border border-dashed border-border hover:bg-muted/50 hover:border-accent/50 group"
                        >
                          <div className="p-0.5 bg-muted border border-border rounded group-hover:border-accent/50">
                            <Plus className="h-2.5 w-2.5 text-muted-foreground group-hover:text-accent transition-colors" />
                          </div>
                          <span className="text-xs text-muted-foreground group-hover:text-accent transition-colors">
                            Add channel
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Integrations Section */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Integrations
            </h2>
            <div className="space-y-1">
              <div className="flex items-center space-x-3 px-3 py-2 bg-card border border-border">
                <div className="p-1 bg-primary/10 border border-primary/20 rounded">
                  <Zap className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Slack</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
                <div className="h-2 w-2 bg-accent border border-accent/50 rounded-full" />
              </div>
              
              <button className="w-full flex items-center space-x-3 px-3 py-2 bg-card border border-border hover:bg-muted/50 transition-colors">
                <div className="p-1 bg-muted border border-border rounded">
                  <Settings className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">GitHub</p>
                  <p className="text-xs text-muted-foreground">Configure</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// Sample data for demo
export const sampleRepositories: Repository[] = [
  {
    id: "1",
    name: "frontend-app",
    owner: "acme-corp",
    channels: [
      { id: "general", name: "general", unreadCount: 3 },
      { id: "bugs", name: "bugs", unreadCount: 1 },
      { id: "features", name: "features" },
    ],
  },
  {
    id: "2", 
    name: "api-backend",
    owner: "acme-corp",
    channels: [
      { id: "general-2", name: "general" },
      { id: "deployment", name: "deployment", unreadCount: 2 },
    ],
  },
  {
    id: "3",
    name: "mobile-app",
    owner: "acme-corp", 
    channels: [
      { id: "general-3", name: "general" },
      { id: "ios", name: "ios" },
      { id: "android", name: "android" },
    ],
  },
];
