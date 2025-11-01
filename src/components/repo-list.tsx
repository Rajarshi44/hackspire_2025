'use client';

import { useAuth } from '@/lib/auth';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { CreateChannelDialog } from './create-channel-dialog';
import { SlackSidebar, slackSampleRepositories } from './Sidebar';

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
  unreadCount?: number;
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

export function RepoList() {
  const { user, githubToken } = useAuth();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateChannelOpen, setCreateChannelOpen] = useState(false);
  const [selectedRepoForChannel, setSelectedRepoForChannel] = useState<string | null>(null);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [channelMap, setChannelMap] = useState<Record<string, Channel[]>>({});
  const [highlightRepo, setHighlightRepo] = useState<string | undefined>();
  
  const pathname = usePathname();
  const router = useRouter();
  const firestore = useFirestore();

  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 3 && segments[0] === 'dashboard') {
      const repoFullName = decodeURIComponent(`${segments[1]}/${segments[2]}`);
      setExpandedRepo(repoFullName);
      setHighlightRepo(repoFullName);
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

  const handleCreateChannelClick = (repoFullName: string) => {
    setSelectedRepoForChannel(repoFullName);
    setCreateChannelOpen(true);
  };

  const activeRepoFullName = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 3 && segments[0] === 'dashboard') {
      return decodeURIComponent(`${segments[1]}/${segments[2]}`);
    }
    return undefined;
  }, [pathname]);

  const activeChannelId = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 5 && segments[3] === 'channels') {
      return segments[4];
    }
    return undefined;
  }, [pathname]);

  const encodedExpandedRepo = useMemo(() => (
    expandedRepo ? encodeURIComponent(expandedRepo) : null
  ), [expandedRepo]);

  const channelsQuery = useMemoFirebase(() => (
    firestore && encodedExpandedRepo
      ? collection(firestore, 'repos', encodedExpandedRepo, 'channels')
      : null
  ), [firestore, encodedExpandedRepo]);

  const { data: expandedRepoChannels } = useCollection<Channel>(channelsQuery);

  useEffect(() => {
    if (!expandedRepo || !expandedRepoChannels) return;
    setChannelMap((prev) => ({
      ...prev,
      [expandedRepo]: expandedRepoChannels,
    }));
  }, [expandedRepo, expandedRepoChannels]);

  const sidebarRepositories = useMemo(() => {
    return repos.map((repo) => ({
      id: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      channels: channelMap[repo.full_name] ?? [],
    }));
  }, [repos, channelMap]);

  const handleRepoToggle = (repoId: string) => {
    const repo = repos.find((entry) => entry.full_name === repoId);
    const isCurrentlyExpanded = expandedRepo === repoId;

    setExpandedRepo(isCurrentlyExpanded ? null : repoId);
    setHighlightRepo(repoId);

    if (!isCurrentlyExpanded && repo) {
      void handleRepoSelect(repo);
    }
  };

  const handleChannelSelect = (repoId: string, channelId: string) => {
    const repo = repos.find((entry) => entry.full_name === repoId);
    const [fallbackOwner, fallbackRepo] = repoId.split('/');
    const ownerSegment = encodeURIComponent(repo?.owner.login ?? fallbackOwner ?? repoId);
    const repoSegment = encodeURIComponent(repo?.name ?? fallbackRepo ?? repoId);
    const channelSegment = encodeURIComponent(channelId);
    router.push(`/dashboard/${ownerSegment}/${repoSegment}/channels/${channelSegment}`);
  };

  const fallbackSidebarData = sidebarRepositories.length ? sidebarRepositories : slackSampleRepositories;

  if (loading) {
    return (
      <SlackSidebar
        repositories={fallbackSidebarData}
        activeRepo={activeRepoFullName}
        activeChannel={activeChannelId}
        onRepoSelectAction={handleRepoToggle}
        onChannelSelectAction={handleChannelSelect}
        onAddChannelAction={handleCreateChannelClick}
      />
    );
  }
  
  if (!githubToken || repos.length === 0) {
    return (
      <SlackSidebar
        repositories={fallbackSidebarData}
        activeRepo={activeRepoFullName}
        activeChannel={activeChannelId}
        onRepoSelectAction={handleRepoToggle}
        onChannelSelectAction={handleChannelSelect}
        onAddChannelAction={handleCreateChannelClick}
      />
    );
  }

  return (
    <>
      <SlackSidebar
        repositories={sidebarRepositories}
        activeRepo={highlightRepo ?? activeRepoFullName}
        activeChannel={activeChannelId}
        onRepoSelectAction={handleRepoToggle}
        onChannelSelectAction={handleChannelSelect}
        onAddChannelAction={handleCreateChannelClick}
      />
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
