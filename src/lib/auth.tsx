'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, signOut, User, GithubAuthProvider, GoogleAuthProvider } from 'firebase/auth';
import { useFirebase } from '@/firebase/provider';
import { githubProvider, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  githubToken: string | null;
  signInWithGitHub: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, auth } = useFirebase();
  const [githubToken, setGithubToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('github_token');
    }
    return null;
  });
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user && typeof window !== 'undefined') {
      sessionStorage.removeItem('github_token');
      setGithubToken(null);
    }
  }, [user, isUserLoading]);

  const signInWithGitHub = async () => {
    if (!auth) return;
    try {
      const result = await signInWithPopup(auth, githubProvider);
      const credential = GithubAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        const token = credential.accessToken;
        setGithubToken(token);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('github_token', token);
        }
      }
      router.push('/dashboard');
    } catch (error) {
      console.error("Authentication Error", error);
    }
  };

  const signInWithGoogle = async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard');
    } catch (error) {
      console.error("Authentication Error", error);
    }
  };

  const signOutAndRedirect = async () => {
    if (!auth) return;
    await signOut(auth);
    setGithubToken(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('github_token');
    }
    router.push('/');
  };

  const value = { user, loading: isUserLoading, githubToken, signInWithGitHub, signInWithGoogle, signOut: signOutAndRedirect };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
