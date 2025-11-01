'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useFirestore } from '@/firebase/provider';
import { collection, getDocs } from 'firebase/firestore';

export type Collaborator = {
  id: string;
  name: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
};

export function useCollaborators(repoFullName: string) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { githubToken } = useAuth();
  const firestore = useFirestore();

  useEffect(() => {
    if (!repoFullName || !githubToken || !firestore) {
      setCollaborators([]);
      return;
    }

    const fetchCollaborators = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const encodedRepoFullName = encodeURIComponent(repoFullName);
        
        // Fetch GitHub repository collaborators
        const [ghResponse, firestoreCollaborators] = await Promise.all([
          fetch(`https://api.github.com/repos/${repoFullName}/collaborators`, {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }),
          getDocs(collection(firestore, 'repos', encodedRepoFullName, 'collaborators'))
        ]);

        const allCollaborators: Collaborator[] = [];

        // Add GitHub collaborators
        if (ghResponse.ok) {
          const ghCollaborators = await ghResponse.json();
          ghCollaborators.forEach((collab: any) => {
            allCollaborators.push({
              id: collab.login,
              name: collab.login,
              username: collab.login,
              avatarUrl: collab.avatar_url,
              role: 'github-collaborator',
            });
          });
        }

        // Add Firestore invited collaborators
        firestoreCollaborators.forEach(doc => {
          const data = doc.data();
          const collaborator: Collaborator = {
            id: doc.id,
            name: data.githubUsername || data.email || doc.id,
            username: data.githubUsername,
            email: data.email,
            role: data.role,
          };
          
          // Only add if not already in the list (from GitHub)
          if (!allCollaborators.find(c => c.username === collaborator.username || c.email === collaborator.email)) {
            allCollaborators.push(collaborator);
          }
        });

        // Sort by name
        allCollaborators.sort((a, b) => a.name.localeCompare(b.name));
        
        setCollaborators(allCollaborators);
      } catch (err) {
        console.error('Error fetching collaborators:', err);
        setError('Failed to fetch collaborators');
        setCollaborators([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollaborators();
  }, [repoFullName, githubToken, firestore]);

  return {
    collaborators,
    isLoading,
    error,
  };
}