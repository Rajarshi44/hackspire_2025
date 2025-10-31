'use client';

import { useState } from 'react';
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
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

type CreateChannelDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  repoFullName: string;
};

export function CreateChannelDialog({
  isOpen,
  onOpenChange,
  repoFullName,
}: CreateChannelDialogProps) {
  const [channelName, setChannelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleCreateChannel = async () => {
    if (!channelName.trim() || !firestore) return;
    setIsLoading(true);

    const formattedChannelName = channelName.trim().toLowerCase().replace(/\s+/g, '-');
    const encodedRepoFullName = encodeURIComponent(repoFullName);
    const channelRef = doc(firestore, 'repos', encodedRepoFullName, 'channels', formattedChannelName);

    try {
      await setDoc(channelRef, {
        name: formattedChannelName,
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Channel Created!',
        description: `#${formattedChannelName} has been created.`,
      });
      onOpenChange(false);
      setChannelName('');
    } catch (error) {
      console.error('Error creating channel:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create channel. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new channel</DialogTitle>
          <DialogDescription>
            Channels are for focused discussions within the '{repoFullName}' repository.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            id="channel-name"
            placeholder="e.g., feature-x or bug-squashing"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateChannel}
            disabled={isLoading || !channelName.trim()}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    