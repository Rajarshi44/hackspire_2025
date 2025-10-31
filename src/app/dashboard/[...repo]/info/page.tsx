'use client';

import { useParams } from 'next/navigation';
import { RepoDetailView } from '@/components/repo-detail-view';

export default function RepoInfoPage() {
  const params = useParams();
  
  const repoSegments = Array.isArray(params.repo) 
    ? params.repo.map(decodeURIComponent) 
    : [];

  if (repoSegments.length < 2) {
    return <div className="p-8 text-center text-red-500">Invalid repository path.</div>;
  }
  
  const repoOwner = repoSegments[0];
  const repoName = repoSegments[1];
  const repoFullName = `${repoOwner}/${repoName}`;

  return <RepoDetailView repoFullName={repoFullName} />;
}
