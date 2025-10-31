'use client';

import { useEffect, useState } from 'react';
import { aiAnalyzeRepository, AIAnalyzeRepositoryOutput } from '@/ai/flows/ai-analyze-repository';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Loader2, MessageCircle, GitBranch, BookText, UserPlus, ShieldCheck, Eye } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import Link from 'next/link';
import { InviteCollaboratorDialog } from './invite-collaborator';

type RepoDetailViewProps = {
  repoFullName: string;
};

export function RepoDetailView({ repoFullName }: RepoDetailViewProps) {
  const { githubToken } = useAuth();
  const [analysis, setAnalysis] = useState<AIAnalyzeRepositoryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    const analyzeRepo = async () => {
      if (!githubToken || !repoFullName) return;
        
      if (!repoFullName.includes('/')) {
        setError(`Invalid repository name format: ${repoFullName}`);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const [repoOwner, repoName] = repoFullName.split('/');
        
        if (!repoOwner || !repoName) {
            throw new Error("Invalid repository name.");
        }

        const result = await aiAnalyzeRepository({
          repoOwner,
          repoName,
          accessToken: githubToken,
        });
        setAnalysis(result);
      } catch (err: any) {
        console.error('Error analyzing repository:', err);
        setError(err.message || 'Failed to analyze the repository. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    analyzeRepo();
  }, [repoFullName, githubToken]);
  
  const [owner, name] = repoFullName.split('/');

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 p-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="text-2xl font-semibold">Analyzing {name}...</h2>
        <p className="text-muted-foreground max-w-md">
          The GitPulse AI is currently inspecting the repository structure and documentation to get up to speed. This may take a moment.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="max-w-lg w-full text-center border-destructive">
            <CardHeader>
                <CardTitle>Analysis Failed</CardTitle>
                <CardDescription>{error}</CardDescription>
            </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-1 justify-center p-4 sm:p-8 bg-muted/20">
      <div className="w-full max-w-5xl space-y-6">
          <div className='text-center'>
            <h1 className="text-4xl font-bold">Repository Info: <span className='text-primary'>{name}</span></h1>
            <p className="text-muted-foreground mt-2">AI-generated summary and details about your repository.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className='md:col-span-1'>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                        Invite Your Team
                    </CardTitle>
                    <CardDescription>
                        Bring collaborators into the loop.
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                   <div className='p-4 rounded-lg bg-secondary/30 border'>
                        <h4 className='font-semibold flex items-center gap-2'><ShieldCheck className='text-primary'/> Developer Role</h4>
                        <p className='text-xs text-muted-foreground mt-1'>Can view channels, send messages, and create GitHub issues.</p>
                   </div>
                   <div className='p-4 rounded-lg bg-secondary/30 border'>
                        <h4 className='font-semibold flex items-center gap-2'><Eye className='text-primary'/> Viewer Role</h4>
                        <p className='text-xs text-muted-foreground mt-1'>Can only view channels and messages. For stakeholders.</p>
                   </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full" onClick={() => setInviteOpen(true)}>
                        <UserPlus className="mr-2 h-5 w-5"/>
                        Invite Collaborators
                    </Button>
                </CardFooter>
            </Card>

            <Card className='md:col-span-2'>
                 <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                        AI Analysis
                    </CardTitle>
                    <CardDescription>
                        This is the AI's understanding of your repository.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><BookText className="h-5 w-5 text-primary" /> AI Summary</h3>
                        <ScrollArea className="h-48 rounded-md border bg-secondary/30 p-4">
                            <p className="text-sm text-muted-foreground">
                                {analysis?.summary}
                            </p>
                        </ScrollArea>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" /> File Structure</h3>
                        <ScrollArea className="h-48 rounded-md border bg-secondary/30">
                            <div className="p-4 text-sm">
                                {analysis?.fileTree && analysis.fileTree.length > 0 ? (
                                analysis.fileTree.map((file) => (
                                    <div key={file.path} className="font-mono text-xs truncate py-1">
                                    {file.path}
                                    </div>
                                ))
                                ) : (
                                    <p className="text-muted-foreground">No files found.</p>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
          </div>
      </div>
    </div>
    <InviteCollaboratorDialog isOpen={isInviteOpen} onOpenChange={setInviteOpen} repoFullName={repoFullName} />
    </>
  );
}
