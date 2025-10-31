'use client';

import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { UserNav } from '@/components/user-nav';
import { Logo } from '@/components/logo';
import { RepoList } from '@/components/repo-list';
import { Button } from './ui/button';
import { Bell, UserPlus, ArrowLeft } from 'lucide-react';
import { Separator } from './ui/separator';
import { InviteCollaboratorDialog } from './invite-collaborator';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isInviteOpen, setInviteOpen] = useState(false);
  const pathname = usePathname();
  
  const pathSegments = pathname.split('/').filter(Boolean);
  // pathSegments: ['dashboard', 'owner', 'repo', 'channels', 'general']
  // or ['dashboard', 'owner', 'repo', 'info']
  const isRepoView = pathSegments.length >= 3 && pathSegments[0] === 'dashboard';

  const repoOwner = isRepoView ? pathSegments[1] : null;
  const repoName = isRepoView ? pathSegments[2] : null;
  const repoFullName = repoOwner && repoName ? `${repoOwner}/${repoName}` : null;
  
  const pageType = pathSegments.length > 3 ? pathSegments[3] : null; // 'channels' or 'info'
  const pageId = pathSegments.length > 4 ? pathSegments[4] : null; // 'general' or null

  let headerTitle = "Select a Repository";
  if (repoName) {
      if (pageType === 'info') {
          headerTitle = `${repoName} - Info`;
      } else if (pageType === 'channels' && pageId) {
          headerTitle = `# ${pageId}`;
      } else {
          headerTitle = repoName;
      }
  }


  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar collapsible={isRepoView ? "offcanvas" : "icon"}>
          <SidebarHeader>
            <Logo />
          </SidebarHeader>
          <SidebarContent className="p-0">
            <SidebarGroup>
                <SidebarGroupLabel>Repositories</SidebarGroupLabel>
                <div className="max-h-[70vh] overflow-y-auto">
                    <RepoList />
                </div>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            {/* Future content for sidebar footer */}
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
            <div className="flex items-center gap-2">
              {isRepoView ? (
                  <Link href="/dashboard">
                    <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden">
                      <ArrowLeft className="h-5 w-5" />
                      <span className="sr-only">Back to repositories</span>
                    </Button>
                  </Link>
              ) : (
                <SidebarTrigger className="md:hidden" />
              )}
              <h1 className="text-lg font-semibold truncate">{headerTitle}</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2 text-sm text-accent font-medium">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                  </div>
                  <span className="hidden sm:inline">AI Active</span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              {repoFullName && (
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-5 w-5" />
                  <span className="sr-only">Invite Collaborators</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Bell className="h-5 w-5" />
                  <span className="sr-only">Notifications</span>
              </Button>
              <UserNav />
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </SidebarInset>
      </div>
      {repoFullName && <InviteCollaboratorDialog isOpen={isInviteOpen} onOpenChange={setInviteOpen} repoFullName={repoFullName} />}
    </SidebarProvider>
  );
}
