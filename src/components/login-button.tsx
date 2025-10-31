'use client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { GithubIcon } from '@/components/github-icon';
import { Chrome } from 'lucide-react';

export function LoginButton() {
  const { signInWithGitHub, signInWithGoogle } = useAuth();
  return (
    <div className='flex gap-4'>
      <Button 
        onClick={signInWithGitHub} 
        size="lg" 
        className="font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow duration-300"
      >
        <GithubIcon className="mr-2 h-5 w-5" />
        Login with GitHub
      </Button>
      <Button 
        onClick={signInWithGoogle} 
        size="lg" 
        variant="outline"
        className="font-semibold shadow-lg transition-shadow duration-300"
      >
        <Chrome className="mr-2 h-5 w-5" />
        Login with Google
      </Button>
    </div>
  );
}
