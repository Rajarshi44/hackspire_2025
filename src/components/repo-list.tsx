'use client';

import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { FolderGit2, Plus, Hash, Info } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuAction,
} from './ui/sidebar';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { CreateChannelDialog } from './create-channel-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

type Repo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string;
  html_url: string;
  owner: {
    login: string;
  }
};

type Channel = {
  id: string;
  name: string;
};

async function getRepos(token: string): Promise<Repo[]> {
  const response = await fetch('https://api.github.com/user/repos?sort=pushed&per_page=50', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!response.ok) {
    console.error('Failed to fetch repositories:', response.statusText);
    return [];
  }
  return response.json();
}

function RepoChannels({ repoFullName }: { repoFullName: string }) {
    const firestore = useFirestore();
    const encodedRepoFullName = encodeURIComponent(repoFullName);
    const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const router = useRouter();
  
    const channelsQuery = useMemoFirebase(() => 
      firestore ? collection(firestore, 'repos', encodedRepoFullName, 'channels') : null,
      [firestore, encodedRepoFullName]
    );
  
    const { data: channels, isLoading } = useCollection<Channel>(channelsQuery);

    if (isLoading) {
        return <SidebarMenuSkeleton showIcon={false} />;
    }

    return (
        <SidebarMenuSub>
      {channels?.map(channel => (
        <SidebarMenuSubItem key={channel.id}>
          <SidebarMenuSubButton
            isActive={pathname === `/dashboard/${repoFullName}/channels/${channel.id}`}
            onClick={() => {
              setOpenMobile(false);
              router.push(`/dashboard/${repoFullName}/channels/${channel.id}`);
            }}
          >
            <Hash />
            <span>{channel.name}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
        </SidebarMenuSub>
    )
}

export function RepoList() {
  const { user, githubToken } = useAuth();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateChannelOpen, setCreateChannelOpen] = useState(false);
  const [selectedRepoForChannel, setSelectedRepoForChannel] = useState<string | null>(null);
  const [openRepo, setOpenRepo] = useState<string | null>(null);
  
  const pathname = usePathname();
  const router = useRouter();
  const firestore = useFirestore();
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 3 && segments[0] === 'dashboard') {
        const repoFullName = decodeURIComponent(`${segments[1]}/${segments[2]}`);
        setOpenRepo(repoFullName);
    }
  }, [pathname]);

  useEffect(() => {
    if (githubToken) {
      setLoading(true);
      getRepos(githubToken)
        .then(data => {
          setRepos(data);
        })
        .catch(error => {
          console.error(error);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [githubToken]);

  const handleRepoSelect = async (repo: Repo) => {
    if (!firestore || !user || !githubToken) return;
    
    const encodedRepoFullName = encodeURIComponent(repo.full_name);
    const repoRef = doc(firestore, 'repos', encodedRepoFullName);
    const members = { [user.uid]: 'developer' };

    try {
      await setDoc(repoRef, {
        id: repo.id.toString(),
        ownerId: user.uid,
        githubRepoId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        createdAt: serverTimestamp(),
        members: members,
      }, { merge: true });
      
      const generalChannelRef = doc(firestore, 'repos', encodedRepoFullName, 'channels', 'general');
      await setDoc(generalChannelRef, { name: 'general', createdAt: serverTimestamp() }, { merge: true });
      
    } catch (error) {
      console.error("Error during repo selection:", error);
    }
  };

  const handleCreateChannelClick = (e: React.MouseEvent, repoFullName: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedRepoForChannel(repoFullName);
    setCreateChannelOpen(true);
  };

  const handleRepoClick = (repo: Repo) => {
    handleRepoSelect(repo);
    router.push(`/dashboard/${repo.full_name}/channels/general`);
    setOpenMobile(false);
  }
  
  const handleInfoClick = (e: React.MouseEvent, repoFullName: string) => {
    e.stopPropagation();
    e.preventDefault();
    router.push(`/dashboard/${repoFullName}/info`);
    setOpenMobile(false);
  }

  const handleToggleRepo = (repoFullName: string) => {
    setOpenRepo(prev => prev === repoFullName ? null : repoFullName);
  }


  if (loading) {
    return (
      <div className="p-2 space-y-1">
        {[...Array(8)].map((_, i) => <SidebarMenuSkeleton key={i} showIcon />)}
      </div>
    );
  }
  
  if (!githubToken) {
     return (
       <div className="p-4 text-center text-sm text-muted-foreground">
         Could not load repositories. Please log in with GitHub to see your repos.
       </div>
     )
  }
  
  if (repos.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No repositories found.
      </div>
    )
  }

  const activeRepoFullName = pathname.split('/')[2] && pathname.split('/')[3] ? `${pathname.split('/')[2]}/${pathname.split('/')[3]}` : '';

  return (
    <>
    <SidebarMenu>
      {repos.map(repo => (
        <Collapsible asChild key={repo.id} open={openRepo === repo.full_name} onOpenChange={() => handleToggleRepo(repo.full_name)}>
            <SidebarMenuItem>
                <div className="flex items-center">
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                            isActive={decodeURIComponent(activeRepoFullName) === repo.full_name && !pathname.includes('/info')}
                            tooltip={repo.full_name}
                            className="w-full"
                            onClick={() => handleRepoClick(repo)}
                            asChild={false}
                        >
                            <FolderGit2 />
                            <span className="truncate flex-1 text-left">{repo.name}</span>
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <div className='flex items-center absolute right-0.5'>
                        <SidebarMenuAction onClick={(e) => handleInfoClick(e, repo.full_name)} tooltip={{children: 'Repository Info'}}>
                            <Info />
                        </SidebarMenuAction>
                        <SidebarMenuAction onClick={(e) => handleCreateChannelClick(e, repo.full_name)} tooltip={{children: 'Create Channel'}}>
                            <Plus />
                        </SidebarMenuAction>
                    </div>
                </div>
                <CollapsibleContent>
                    <RepoChannels repoFullName={repo.full_name} />
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
      ))}
    </SidebarMenu>
    {selectedRepoForChannel && (
        <CreateChannelDialog 
            isOpen={isCreateChannelOpen}
            onOpenChange={setCreateChannelOpen}
            repoFullName={selectedRepoForChannel}
        />
    )}
    </>
  );
}
