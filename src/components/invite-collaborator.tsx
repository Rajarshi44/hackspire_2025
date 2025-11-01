'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { Loader2, UserPlus, Check, Github, PlusCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type InviteCollaboratorDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  repoFullName: string;
};

type GitHubCollaborator = {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
};

type Role = 'developer';

export function InviteCollaboratorDialog({
  isOpen,
  onOpenChange,
  repoFullName,
}: InviteCollaboratorDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('developer');
  const [isLoading, setIsLoading] = useState(false);
  const [collaborators, setCollaborators] = useState<GitHubCollaborator[]>([]);
  const [isFetchingCollaborators, setIsFetchingCollaborators] = useState(false);
  const [addedCollaborators, setAddedCollaborators] = useState<Set<string>>(new Set());
  const [existingInvites, setExistingInvites] = useState<Array<{ id: string; email?: string; role?: string }>>([]);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, githubToken } = useAuth();
  
  const encodedRepoFullName = encodeURIComponent(repoFullName);

  const repoRef = useMemoFirebase(() => 
    firestore ? doc(firestore, 'repos', encodedRepoFullName) : null
  , [firestore, encodedRepoFullName]);

  useEffect(() => {
    if (!isOpen) {
      setAddedCollaborators(new Set());
      return;
    }
    
    const fetchCollaborators = async () => {
      if (!githubToken || !repoFullName || !repoRef || !firestore) return;
      setIsFetchingCollaborators(true);
      try {
        const collaboratorsColRef = collection(firestore, 'repos', encodedRepoFullName, 'collaborators');
        
        const [ghResponse, existingInvitesSnap] = await Promise.all([
          fetch(`https://api.github.com/repos/${repoFullName}/collaborators`, {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }),
          getDocs(collaboratorsColRef)
        ]);

        if (!ghResponse.ok) {
          throw new Error('Failed to fetch collaborators from GitHub.');
        }
        
        const ghCollaborators = await ghResponse.json();
        setCollaborators(ghCollaborators);

    const alreadyInvited = new Set<string>();
    const invites: Array<{ id: string; email?: string; role?: string }> = [];
    existingInvitesSnap.forEach(d => {
      // d.id could be an email or a GitHub username (login)
      alreadyInvited.add(d.id);
      const data = d.data() as any;
      invites.push({ id: d.id, email: data?.email, role: data?.role });
    });
    setAddedCollaborators(alreadyInvited);
    setExistingInvites(invites);
        
      } catch (error) {
        console.error('Error fetching collaborators:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not load collaborators.',
        });
      } finally {
        setIsFetchingCollaborators(false);
      }
    };

    fetchCollaborators();
  }, [isOpen, githubToken, repoFullName, toast, repoRef, firestore, encodedRepoFullName]);

  const handleInviteByEmail = async () => {
    if (!email.trim() || !firestore) return;
    setIsLoading(true);

    const collaboratorId = email.trim();

    try {
      const collaboratorRef = doc(firestore, 'repos', encodedRepoFullName, 'collaborators', collaboratorId);
      
      await setDoc(collaboratorRef, {
        email: collaboratorId,
        role: role,
        invitedAt: serverTimestamp(),
      });

      setAddedCollaborators(prev => new Set(prev).add(collaboratorId));
      
      toast({
        title: 'Invitation Sent!',
        description: `An invitation to join as a ${role} has been recorded for ${collaboratorId}.`,
      });
      
      setEmail('');
    } catch (error) {
      console.error('Error inviting collaborator:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send invitation. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCollaborator = async (collaborator: GitHubCollaborator) => {
    if (!repoRef || !firestore) return;
    
    const collaboratorId = collaborator.login;
      
    try {
      const collaboratorRef = doc(firestore, 'repos', encodedRepoFullName, 'collaborators', collaboratorId);
      
      await setDoc(collaboratorRef, {
        githubUsername: collaborator.login,
        role: 'developer', // Assume github collaborators are developers
        invitedAt: serverTimestamp(),
      }, { merge: true });

      setAddedCollaborators(prev => new Set(prev).add(collaboratorId));
      setExistingInvites(prev => {
        if (prev.find(p => p.id === collaboratorId)) return prev;
        return [...prev, { id: collaboratorId, role: 'developer' }];
      });
      toast({
        title: 'Collaborator Invited',
        description: `${collaborator.login} has been invited. They'll get access once they sign in to GitPulse.`,
      });
    } catch(e) {
       console.error('Error inviting collaborator:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to invite collaborator.',
      });
    }
  };

  const handleRemoveCollaborator = async (id: string) => {
    if (!firestore) return;
    try {
      const collaboratorRef = doc(firestore, 'repos', encodedRepoFullName, 'collaborators', id);
      await deleteDoc(collaboratorRef);
      setAddedCollaborators(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setExistingInvites(prev => prev.filter(inv => inv.id !== id));
      toast({
        title: 'Access removed',
        description: `${id} no longer has access to ${repoFullName}.`,
      });
    } catch (e) {
      console.error('Error removing collaborator:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove collaborator.',
      });
    } finally {
      setConfirmRemoveId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Collaborators</DialogTitle>
          <DialogDescription>
            Invite users by email and assign a role. Non-technical users can log in with Google.
          </DialogDescription>
        </DialogHeader>
        
  <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Input
              id="email"
              type="email"
              placeholder="collaborator@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              disabled={addedCollaborators.has(email.trim())}
            />
            <Select value={role} onValueChange={(value: Role) => setRole(value)}>
                <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="developer">Developer</SelectItem>
                </SelectContent>
            </Select>
            <Button
              type="submit"
              onClick={handleInviteByEmail}
              disabled={isLoading || !email.trim() || addedCollaborators.has(email.trim())}
              className="w-28"
            >
              {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
              ) : addedCollaborators.has(email.trim()) ? (
                  <><Check className="mr-2 h-4 w-4" /> Invited</>
              ) : (
                  <> <UserPlus className="mr-2 h-4 w-4" /> Invite</>
              )}
            </Button>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or add from GitHub</span>
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {isFetchingCollaborators ? (
              <div className="flex justify-center items-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : collaborators.length > 1 ? (
              collaborators.filter(c => c.login !== user?.displayName).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.avatar_url} alt={c.login} />
                      <AvatarFallback>{c.login.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{c.login}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant={addedCollaborators.has(c.login) ? "secondary" : "outline"}
                      size="sm" 
                      className="h-8 w-24"
                      onClick={() => handleAddCollaborator(c)}
                      disabled={addedCollaborators.has(c.login)}
                    >
                      {addedCollaborators.has(c.login) ? (
                        <><Check className="mr-2 h-4 w-4" /> Added</>
                      ) : (
                        <><PlusCircle className="mr-2 h-4 w-4" /> Add</>
                      )}
                    </Button>
                    <a href={c.html_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Github className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">No other collaborators found on GitHub.</p>
            )}
          </div>

          <div className="relative pt-2">
            <div aria-hidden="true" className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Current access & invitations</span>
            </div>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
            {existingInvites.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-3">No collaborators invited yet.</p>
            ) : (
              existingInvites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback>{invite.id.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{invite.email || invite.id}</p>
                      {invite.role && (
                        <p className="text-xs text-muted-foreground">{invite.role}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8"
                      onClick={() => setConfirmRemoveId(invite.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={!!confirmRemoveId} onOpenChange={(open) => !open && setConfirmRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove collaborator?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access for {confirmRemoveId}. You can always invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmRemoveId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRemoveId && handleRemoveCollaborator(confirmRemoveId)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
