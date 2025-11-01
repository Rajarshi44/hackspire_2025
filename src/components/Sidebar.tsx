'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Hash, Plus, Settings, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';

interface Channel {
  id: string;
  name: string;
  unreadCount?: number;
}

interface Repository {
  id: string;
  name: string;
  owner: string;
  channels: Channel[];
}

interface SidebarProps {
  repositories: Repository[];
  activeRepo?: string;
  activeChannel?: string;
  onRepoSelectAction: (repoId: string) => void;
  onChannelSelectAction: (repoId: string, channelId: string) => void;
  onAddChannelAction: (repoId: string) => void;
}

export function SlackSidebar({
  repositories,
  activeRepo,
  activeChannel,
  onRepoSelectAction,
  onChannelSelectAction,
  onAddChannelAction,
}: SidebarProps) {
  const { setOpenMobile } = useSidebar();
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(
    () => new Set(activeRepo ? [activeRepo] : [])
  );

  const activeWorkspaceLabel = useMemo(() => {
    if (!activeRepo) {
      return 'GitPulse Workspace';
    }
    const repo = repositories.find((entry) => entry.id === activeRepo);
    return repo ? `${repo.owner}/${repo.name}` : 'GitPulse Workspace';
  }, [activeRepo, repositories]);

  const toggleRepo = (repoId: string) => {
    const next = new Set(expandedRepos);
    if (next.has(repoId)) {
      next.delete(repoId);
    } else {
      next.add(repoId);
    }
    setExpandedRepos(next);
    onRepoSelectAction(repoId);
  };

  useEffect(() => {
    if (!activeRepo) return;
    setExpandedRepos((prev) => {
      if (prev.has(activeRepo)) return prev;
      const next = new Set(prev);
      next.add(activeRepo);
      return next;
    });
  }, [activeRepo]);

  return (
    <div className="flex h-full w-[--sidebar-width] max-w-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-4 pt-5 pb-3 border-b border-sidebar-border">
        <Logo className="text-sidebar-foreground" />
      </div>
      <div className="px-4 py-3 border-b border-sidebar-border">
        <button className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-sidebar-accent/60">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">{activeWorkspaceLabel}</span>
            <span className="text-xs text-sidebar-foreground/60">Workspace</span>
          </div>
          <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 py-3 space-y-6">
          <div>
            <div className="flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">
              <span>Repositories</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="mt-2 space-y-1.5">
              {repositories.map((repo) => {
                const isExpanded = expandedRepos.has(repo.id);
                const isRepoActive = activeRepo === repo.id;

                return (
                  <div key={repo.id}>
                    <button
                      onClick={() => toggleRepo(repo.id)}
                      className={cn(
                        'group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                        isRepoActive && 'bg-sidebar-accent text-sidebar-foreground'
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-sidebar-foreground/50" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-sidebar-foreground/50" />
                      )}
                      <span className="truncate">{repo.name}</span>
                    </button>

                    {isExpanded && (
                      <div className="ml-6 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                        {repo.channels.map((channel) => {
                          const isChannelActive = activeChannel === channel.id;
                          const unread = channel.unreadCount ?? 0;

                          return (
                            <button
                              key={channel.id}
                              onClick={() => {
                                onChannelSelectAction(repo.id, channel.id);
                                setOpenMobile(false);
                              }}
                              className={cn(
                                'flex w-full items-center justify-between rounded-md px-2 py-1 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                                isChannelActive && 'bg-primary/20 text-sidebar-foreground'
                              )}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <Hash className="h-3 w-3 text-sidebar-foreground/40" />
                                <span className="truncate">#{channel.name}</span>
                              </span>
                              {unread > 0 && (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                                  {unread > 99 ? '99+' : unread}
                                </span>
                              )}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => {
                            onAddChannelAction(repo.id);
                            setOpenMobile(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add channel</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">
              Integrations
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60">
                <div className="rounded-md bg-sidebar-accent/60 p-1">
                  <Zap className="h-3.5 w-3.5 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sidebar-foreground">Slack</p>
                  <p className="text-xs text-sidebar-foreground/60">Connected</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-accent" />
              </div>

              <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60">
                <div className="rounded-md bg-sidebar-accent/60 p-1">
                  <Settings className="h-3.5 w-3.5 text-sidebar-foreground/60" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sidebar-foreground">GitHub</p>
                  <p className="text-xs text-sidebar-foreground/60">Configure</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export const slackSampleRepositories: Repository[] = [
  {
    id: 'frontend',
    name: 'frontend-app',
    owner: 'acme-corp',
    channels: [
      { id: 'frontend-general', name: 'general', unreadCount: 3 },
      { id: 'frontend-bugs', name: 'bugs', unreadCount: 1 },
      { id: 'frontend-features', name: 'features' },
    ],
  },
  {
    id: 'backend',
    name: 'api-backend',
    owner: 'acme-corp',
    channels: [
      { id: 'backend-general', name: 'general' },
      { id: 'backend-deploy', name: 'deployment', unreadCount: 2 },
    ],
  },
  {
    id: 'mobile',
    name: 'mobile-app',
    owner: 'acme-corp',
    channels: [
      { id: 'mobile-general', name: 'general' },
      { id: 'mobile-ios', name: 'ios' },
      { id: 'mobile-android', name: 'android' },
    ],
  },
];
