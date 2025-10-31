'use client';

import { ChatInterface } from '@/components/chat-interface';
import { RepoDetailView } from '@/components/repo-detail-view';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RepoPage() {
  const params = useParams();
  const router = useRouter();
  
  // e.g., /dashboard/owner/repo-name/channels/general
  // params.repo will be ['owner', 'repo-name', 'channels', 'general']
  const repoSegments = Array.isArray(params.repo) 
    ? params.repo.map(decodeURIComponent)
    : [];

  if (repoSegments.length < 2) {
    return <div className="p-8 text-center">Invalid repository path.</div>;
  }

  const repoOwner = repoSegments[0];
  const repoName = repoSegments[1];
  const repoFullName = `${repoOwner}/${repoName}`;

  const pageType = repoSegments.length > 2 ? repoSegments[2] : 'info'; // Default to info
  const channelId = repoSegments.length > 3 ? repoSegments[3] : 'general';

  // Redirect from /dashboard/owner/repo to /dashboard/owner/repo/info
  useEffect(() => {
    if (repoSegments.length === 2) {
        router.replace(`/dashboard/${repoFullName}/info`);
    }
  }, [repoSegments, repoFullName, router]);


  if (repoSegments.length === 2) {
      // While redirecting, show a loader or null
      return <div className="p-8 text-center">Loading...</div>;;
  }

  if (pageType === 'channels') {
    return <ChatInterface repoFullName={repoFullName} channelId={channelId} />;
  }

  if (pageType === 'info') {
    return <RepoDetailView repoFullName={repoFullName} />;
  }
  
  // Fallback for any other unexpected URL structure
  return <div className="p-8 text-center">Page not found.</div>;
}
