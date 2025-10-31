'use client';

import { ChatInterface } from '@/components/chat-interface';
import { useParams } from 'next/navigation';

export default function RepoPage() {
  const params = useParams();
  
  // e.g. /dashboard/owner/repo-name/channels/general
  // params.repo will be ['owner', 'repo-name', 'channels', 'general']
  const repoSegments = Array.isArray(params.repo) 
    ? params.repo
    : [];

  if (repoSegments.length < 2) {
    // This case should ideally be handled by a more specific page or redirect.
    // For now, it indicates an incomplete path.
    return <div className="p-8 text-center">Invalid repository path.</div>;
  }

  const repoOwner = repoSegments[0];
  const repoName = repoSegments[1];
  const repoFullName = `${repoOwner}/${repoName}`;

  const pageType = repoSegments.length > 2 ? repoSegments[2] : 'channels'; // Default to channels
  const channelId = repoSegments.length > 3 ? repoSegments[3] : 'general';
  
  if (pageType === 'channels' && channelId) {
    // Render the chat interface for a specific channel
    return <ChatInterface repoFullName={repoFullName} channelId={channelId} />;
  }

  // Default to general channel chat view if no specific page is requested
  return <ChatInterface repoFullName={repoFullName} channelId="general" />;
}
