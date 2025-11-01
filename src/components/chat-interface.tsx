'use client';

import { useAuth } from '@/lib/auth';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, orderBy, query, updateDoc, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useState, useEffect, useRef, useMemo } from 'react';
import { ChatMessage, type Message } from '@/components/chat-message';
import { MessageInput } from '@/components/message-input';
import { aiDetectIssue } from '@/ai/flows/ai-detects-potential-issues';
import { aiDetectIssueResolution } from '@/ai/flows/ai-detects-issue-resolution';
import { aiMatchPullRequestWithIssue } from '@/ai/flows/ai-matches-pr-with-issue';
import { Button } from './ui/button';
import { Github, Sparkles, ExternalLink, GitPullRequest, ListTodo, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { aiCreateGithubIssue } from '@/ai/flows/ai-creates-github-issues';
import { aiListGithubIssues } from '@/ai/flows/ai-list-github-issues';
import { aiListGithubPRs } from '@/ai/flows/ai-list-github-prs';
import Link from 'next/link';
import KanbanBoard, { KanbanIssue } from '@/components/kanban-board';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { usePathname } from 'next/navigation';

type ChatInterfaceProps = {
  repoFullName: string;
  channelId: string;
};

export function ChatInterface({ repoFullName, channelId }: ChatInterfaceProps) {
  const { user, githubToken } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const pathname = usePathname();
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [isKanbanOpen, setIsKanbanOpen] = useState(false);
  const [isMdUp, setIsMdUp] = useState(false);
  const gitpulseAvatarUrl = 'https://i.postimg.cc/bvnz3hxH/Gemini-Generated-Image-s0q3tjs0q3tjs0q3.png';

  // Determine if we're in a repo view to calculate sidebar width
  const pathSegments = pathname.split('/').filter(Boolean);
  const isRepoView = pathSegments.length >= 3 && pathSegments[0] === 'dashboard';
  
  // Calculate left margin based on sidebar state
  const getLeftMargin = () => {
    if (!isMdUp) return 'left-4'; // Mobile: no sidebar offset
    // In repo view, sidebar is in offcanvas mode but still visible on desktop
    // In dashboard view, sidebar is in icon mode (narrower)
    return 'left-[17rem]'; // Both cases: account for full sidebar width (16rem + 1rem margin)
  };

  const encodedRepoFullName = encodeURIComponent(repoFullName);

  const messagesRef = useMemoFirebase(() => 
    firestore ? collection(firestore, 'repos', encodedRepoFullName, 'channels', channelId, 'messages') : null
  , [firestore, encodedRepoFullName, channelId]);

  const messagesQuery = useMemoFirebase(() =>
    messagesRef ? query(messagesRef, orderBy('timestamp', 'asc')) : null
  , [messagesRef]);

  const { data: serverMessages, isLoading } = useCollection<Message>(messagesQuery);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  const messages = useMemo(() => {
    const messageMap = new Map<string, Message>();

    // Add server messages to the map first
    (serverMessages || []).forEach(msg => {
      messageMap.set(msg.id, msg);
    });

    // Add optimistic messages, replacing server messages if a tempId matches
    optimisticMessages.forEach(optMsg => {
      // If an optimistic message has a tempId, see if a server message also has it.
      // If so, the server message in the map is the 'real' one, so we don't add the optimistic one.
      const serverMsgWithTempId = Array.from(messageMap.values()).find(sm => sm.tempId === optMsg.tempId);

      if (optMsg.tempId && serverMsgWithTempId) {
        // The optimistic message has been confirmed by the server.
        // The server version is already in the map, so do nothing.
      } else {
        // This is a new optimistic message, or one that hasn't been confirmed yet.
        messageMap.set(optMsg.id, optMsg);
      }
    });

    return Array.from(messageMap.values()).sort((a, b) => (a.timestamp?.seconds ?? 0) - (b.timestamp?.seconds ?? 0));
  }, [serverMessages, optimisticMessages]);


  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  // Track viewport for responsive Kanban behavior (md breakpoint: 768px)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMdUp('matches' in e ? e.matches : (e as MediaQueryList).matches);
    // Initialize
    setIsMdUp(mq.matches);
    // Subscribe
    try {
      mq.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
      return () => mq.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
    } catch {
      // Safari fallback
      mq.addListener(handler as any);
      return () => mq.removeListener(handler as any);
    }
  }, []);

  const sendBotMessage = async (text: string, type: 'issue-list' | 'pr-list' | 'pr-verification', data: any[]) => {
    if (!messagesRef) return;
    const tempId = `temp_${Date.now()}`;
    const botMessage: Omit<Message, 'id' | 'timestamp'> = {
      sender: 'GitPulse AI',
      senderId: 'ai_assistant',
      avatarUrl: gitpulseAvatarUrl,
      text: text,
      isSystemMessage: true,
      systemMessageType: type,
      systemMessageData: data,
    };
    const finalBotMessage = { ...botMessage, timestamp: serverTimestamp(), tempId: tempId };
    
    const tempOptimisticMessage: Message = {
      ...botMessage,
      id: tempId,
      timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 },
      tempId: tempId,
    }
    setOptimisticMessages(prev => [...prev, tempOptimisticMessage]);

    try {
        await addDoc(messagesRef, finalBotMessage);
    } catch(e) {
        console.error("Error sending bot message:", e);
        // Optionally remove the optimistic message on failure
        setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }

  const handleListIssues = async () => {
    if (!githubToken) return;
    setIsBotThinking(true);
    try {
      const [repoOwner, repoName] = repoFullName.split('/');
      const { issues } = await aiListGithubIssues({ repoOwner, repoName, accessToken: githubToken });
      if (issues.length > 0) {
        const text = `Here are the open issues for ${repoFullName}:`;
        await sendBotMessage(text, 'issue-list', issues);
      } else {
        await sendBotMessage(`There are no open issues for ${repoFullName}.`, 'issue-list', []);
      }
    } catch(e) {
      console.error(e);
      await sendBotMessage('Sorry, I was unable to fetch the list of issues.', 'issue-list', []);
    } finally {
      setIsBotThinking(false);
    }
  }

  const handleListPRs = async () => {
    if (!githubToken) return;
    setIsBotThinking(true);
    try {
        const [repoOwner, repoName] = repoFullName.split('/');
        const { prs } = await aiListGithubPRs({ repoOwner, repoName, accessToken: githubToken });
        if (prs.length > 0) {
            const text = `Here are the open pull requests for ${repoFullName}:`;
            await sendBotMessage(text, 'pr-list', prs);
        } else {
            await sendBotMessage(`There are no open pull requests for ${repoFullName}.`, 'pr-list', []);
        }
    } catch(e) {
        console.error(e);
        await sendBotMessage('Sorry, I was unable to fetch the list of pull requests.', 'pr-list', []);
    } finally {
      setIsBotThinking(false);
    }
  }

  const handleManualPRVerification = async (issueRef: string) => {
    if (!githubToken || !user) return;
    setIsBotThinking(true);
    
    try {
      const [repoOwner, repoName] = repoFullName.split('/');
      const matchResult = await aiMatchPullRequestWithIssue({
        repoOwner,
        repoName,
        issueReference: issueRef,
        claimedBy: user.displayName || user.uid,
        accessToken: githubToken,
      });

      const text = matchResult.matchFound 
        ? `✅ **PR Verification**: Found ${matchResult.matchingPRs.length} matching pull request${matchResult.matchingPRs.length > 1 ? 's' : ''} for "${issueRef}"` 
        : `❌ **PR Verification**: No matching pull requests found for "${issueRef}".`;
        
      await sendBotMessage(text, 'pr-verification', matchResult.matchingPRs);
    } catch(e) {
      console.error(e);
      await sendBotMessage('Sorry, I was unable to verify pull requests.', 'pr-verification', []);
    } finally {
      setIsBotThinking(false);
    }
  }

  const handleSendMessage = async (text: string, mentions: string[] = []) => {
    if (!text.trim() || !user || !messagesRef) return;

    if (text.trim() === '/issuelist') {
      await handleListIssues();
      return;
    }
    if (text.trim() === '/prlist') {
      await handleListPRs();
      return;
    }
    if (text.trim().startsWith('/solved')) {
      const issueRef = text.trim().replace('/solved', '').trim() || 'recent issue';
      await handleManualPRVerification(issueRef);
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const newMessage: Omit<Message, 'id' | 'timestamp'> = {
      sender: user.displayName || 'Anonymous',
      senderId: user.uid,
      avatarUrl: user.photoURL || '',
      text: text,
      isIssue: false,
      ...(mentions.length > 0 && { mentions }),
    };
    
    const finalNewMessage = { ...newMessage, timestamp: serverTimestamp(), tempId: tempId };

    const tempOptimisticMessage: Message = {
      ...newMessage,
      id: tempId,
      timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 },
      tempId: tempId,
    }
    setOptimisticMessages(prev => [...prev, tempOptimisticMessage]);


    try {
      const newDocRef = await addDoc(messagesRef, finalNewMessage);
      
      const recentMessages = (serverMessages ?? []).slice(-9).map(m => ({ 
        sender: m.sender, 
        text: m.text,
        senderId: m.senderId 
      }));
      recentMessages.push({ 
        sender: newMessage.sender, 
        text: newMessage.text, 
        senderId: newMessage.senderId 
      });
      
      // Check for issue resolution claims
      const resolutionResult = await aiDetectIssueResolution({
        messages: recentMessages,
        currentUserId: user.uid,
      });

      if (resolutionResult.isResolutionClaim && resolutionResult.issueReference && githubToken) {
        // User claims to have resolved an issue - check for matching PRs
        const [repoOwner, repoName] = repoFullName.split('/');
        const matchResult = await aiMatchPullRequestWithIssue({
          repoOwner,
          repoName,
          issueReference: resolutionResult.issueReference,
          claimedBy: user.displayName || user.uid,
          accessToken: githubToken,
        });

        // Send AI response about PR verification
        const verificationTempId = `temp_verification_${Date.now()}`;
      const verificationMessage: Omit<Message, 'id' | 'timestamp'> = {
          sender: 'GitPulse AI',
          senderId: 'ai_assistant',
        avatarUrl: gitpulseAvatarUrl,
          text: matchResult.matchFound 
            ? `✅ **PR Verification**: I found ${matchResult.matchingPRs.length} matching pull request${matchResult.matchingPRs.length > 1 ? 's' : ''} for "${resolutionResult.issueReference}"` 
            : `❌ **PR Verification**: No matching pull requests found for "${resolutionResult.issueReference}". ${resolutionResult.resolutionMethod === 'pull_request' ? 'You mentioned creating a PR - it might not be visible yet or may need different keywords.' : ''}`,
          isSystemMessage: true,
          systemMessageType: 'pr-verification',
          systemMessageData: matchResult.matchingPRs,
        };

        const finalVerificationMessage = { ...verificationMessage, timestamp: serverTimestamp(), tempId: verificationTempId };
        const tempOptimisticVerificationMessage: Message = {
          ...verificationMessage,
          id: verificationTempId,
          timestamp: { seconds: Date.now() / 1000 + 2, nanoseconds: 0 },
          tempId: verificationTempId,
        };

        setOptimisticMessages(prev => [...prev, tempOptimisticVerificationMessage]);
        await addDoc(messagesRef, finalVerificationMessage);
      }
      
      const detectionResult = await aiDetectIssue({ 
        messages: recentMessages.map(m => ({ sender: m.sender, text: m.text })),
        ...(mentions.length > 0 && { mentions })
      });
      
      if (detectionResult.is_issue) {
          const aiTempId = `temp_ai_${Date.now()}`;
      const aiMessage: Omit<Message, 'id' | 'timestamp'> = {
              sender: 'GitPulse AI',
              senderId: 'ai_assistant',
        avatarUrl: gitpulseAvatarUrl,
              text: `I've detected a potential issue: **${detectionResult.title}**${detectionResult.assignees && detectionResult.assignees.length > 0 ? `\n\nSuggested assignees: ${detectionResult.assignees.map(a => `@${a}`).join(', ')}` : ''}`,
              isIssue: true,
              issueDetails: {
                  title: detectionResult.title,
                  description: detectionResult.description,
                  priority: detectionResult.priority,
                  ...(detectionResult.assignees && detectionResult.assignees.length > 0 && { assignees: detectionResult.assignees }),
              },
              status: 'pending'
          };
          const finalAiMessage = { ...aiMessage, timestamp: serverTimestamp(), tempId: aiTempId };

          const tempOptimisticAiMessage: Message = {
            ...aiMessage,
            id: aiTempId,
            timestamp: { seconds: Date.now() / 1000 + 1, nanoseconds: 0 },
            tempId: aiTempId,
          }
          setOptimisticMessages(prev => [...prev, tempOptimisticAiMessage]);
          await addDoc(messagesRef, finalAiMessage);
      }
    } catch (error) {
      console.error('Error sending message or detecting issue:', error);
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not send message.',
      });
    }
  };

  const handleCreateIssue = async (message: Message) => {
    if (!message.issueDetails || !githubToken || !repoFullName || !firestore || !messagesRef) return;
    setIsCreatingIssue(true);
    try {
        const [repoOwner, repoName] = repoFullName.split('/');
        const result = await aiCreateGithubIssue({
            repoOwner,
            repoName,
            issueTitle: message.issueDetails.title,
            issueDescription: message.issueDetails.description,
            accessToken: githubToken,
            ...(message.issueDetails.assignees && message.issueDetails.assignees.length > 0 && { assignees: message.issueDetails.assignees }),
        });

        const messageRef = doc(messagesRef, message.id);
        await updateDoc(messageRef, {
            issueUrl: result.issueUrl,
            status: 'completed'
        });

        setOptimisticMessages(prevMessages => prevMessages.map(msg => 
            msg.id === message.id 
                ? { ...msg, issueUrl: result.issueUrl, status: 'completed' } 
                : msg
        ));


        toast({
            title: 'GitHub Issue Created!',
            description: (
                <a href={result.issueUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    Click here to view the issue.
                </a>
            ),
        });
    } catch (error) {
        console.error('Failed to create GitHub issue:', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to create GitHub issue.',
        });
    } finally {
        setIsCreatingIssue(false);
    }
  };

  const renderSystemMessage = (msg: Message) => {
    if (msg.systemMessageType === 'issue-list' || msg.systemMessageType === 'pr-list') {
      const Icon = msg.systemMessageType === 'issue-list' ? ListTodo : GitPullRequest;
      return (
        <div className='ml-12 mt-2 space-y-2'>
          {msg.systemMessageData?.map((item: any) => (
            <Link href={item.html_url} key={item.id} target="_blank">
                <div  className='flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors'>
                    <Icon className='h-5 w-5 text-primary' />
                    <div className='flex-1 truncate'>
                        <span className='font-medium'>#{item.number} {item.title}</span>
                        <p className='text-xs text-muted-foreground'>
                            Opened by {item.user.login}
                        </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
            </Link>
          ))}
        </div>
      )
    }
    
    if (msg.systemMessageType === 'pr-verification') {
      const matchingPRs = msg.systemMessageData || [];
      return (
        <div className='ml-12 mt-2 space-y-2'>
          {matchingPRs.length > 0 ? (
            matchingPRs.map((pr: any) => (
              <Link href={pr.url} key={pr.number} target="_blank">
                <div className='flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors'>
                  <div className='flex items-center gap-2'>
                    <GitPullRequest className='h-5 w-5 text-green-600' />
                    {pr.matchConfidence === 'high' && <CheckCircle className='h-4 w-4 text-green-600' />}
                    {pr.matchConfidence === 'medium' && <CheckCircle className='h-4 w-4 text-yellow-600' />}
                    {pr.matchConfidence === 'low' && <AlertCircle className='h-4 w-4 text-orange-600' />}
                  </div>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>#{pr.number} {pr.title}</span>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        pr.matchConfidence === 'high' ? 'bg-green-100 text-green-800' :
                        pr.matchConfidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {pr.matchConfidence} confidence
                      </span>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      By {pr.author} • {pr.matchReason}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          ) : (
            <div className='flex items-center gap-3 p-2 rounded-md border bg-muted/50'>
              <AlertCircle className='h-5 w-5 text-muted-foreground' />
              <div className='flex-1'>
                <span className='text-sm text-muted-foreground'>
                  No matching pull requests found. The PR might be in a different repository or use different keywords.
                </span>
              </div>
            </div>
          )}
        </div>
      )
    }
    
    return null;
  }

  // Derive AI-created issues from chat messages (for Kanban intake)
  const aiIssuesForKanban: Array<Pick<KanbanIssue, 'id' | 'title' | 'summary' | 'priority' | 'assignee'>> = useMemo(() => {
    const issues: Array<Pick<KanbanIssue, 'id' | 'title' | 'summary' | 'priority' | 'assignee'>> = [];
    for (const msg of messages) {
      if (msg.isIssue && msg.issueDetails?.title) {
        const priority: any = (msg.issueDetails.priority || 'medium').toString().toLowerCase();
        const normalized: 'high' | 'medium' | 'low' = ['high','medium','low'].includes(priority) ? priority : 'medium';
        const assigneeName = msg.issueDetails.assignees && msg.issueDetails.assignees.length > 0 ? msg.issueDetails.assignees[0] : undefined;
        issues.push({
          id: msg.id,
          title: msg.issueDetails.title,
          summary: msg.issueDetails.description || undefined,
          priority: normalized,
          assignee: assigneeName ? { name: assigneeName } : undefined,
        });
      }
    }
    return issues;
  }, [messages]);

  const sidePanelOpen = isKanbanOpen && isMdUp;
  const sheetOpen = isKanbanOpen && !isMdUp;

  return (
    <div className="fixed left-4 right-4 top-20 bottom-4 flex max-h-[calc(100vh-6rem)] overflow-hidden bg-black md:left-[calc(16rem+1rem)] md:flex-row z-40">
      {/* Chat panel: full width by default, halves when Kanban is open (desktop) */}
      <div
        className={
          sidePanelOpen
            ? 'flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 bg-card/90 backdrop-blur-lg shadow-2xl rounded-lg border border-border/50 md:w-1/2'
            : 'flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 bg-card/90 backdrop-blur-lg shadow-2xl rounded-lg border border-border/50'
        }
      >
  {/* Header */}
  <div className="sticky top-0 z-10 px-4 py-3 border-b border-border/60 flex items-center justify-between bg-gradient-to-r from-primary/10 to-accent/10 rounded-t-lg backdrop-blur">
          <div className="font-bold text-lg text-primary tracking-wide">Chat</div>
          <Button variant="outline" size="sm" onClick={() => setIsKanbanOpen(v => !v)} className="font-semibold">
            <ListTodo className="h-4 w-4 mr-2" />
            {isKanbanOpen ? 'Hide Kanban Board' : 'Show Kanban Board'}
          </Button>
        </div>
        {/* Messages */}
        <div 
          ref={scrollAreaRef} 
          className="flex-1 min-h-0 overflow-y-auto max-h-[60vh] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border"
        >
          <div className="p-2 sm:p-4 space-y-4 pt-6">
            {isLoading && messages.length === 0 && (
              <div className="flex justify-center items-center h-full">
                <p className="text-muted-foreground font-medium">Loading messages...</p>
              </div>
            )}
            {messages.map((msg) => {
              const isAIMessage = msg.sender === 'GitPulse AI';
              const displayMessage = isAIMessage ? { ...msg, avatarUrl: gitpulseAvatarUrl } : msg;

              return (
                <div key={msg.id} className="space-y-2">
                  <ChatMessage message={displayMessage} />
                  {msg.isIssue && (
                    <div className="ml-12 mt-1 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <span className="text-sm font-semibold text-primary">AI Suggestion</span>
                      {msg.issueUrl ? (
                        <Button asChild size="sm" variant="outline" className="font-semibold">
                          <Link href={msg.issueUrl} target="_blank">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Issue
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleCreateIssue(msg)}
                          disabled={isCreatingIssue || msg.status === 'completed'}
                          className="font-semibold"
                        >
                          <Github className="mr-2 h-4 w-4" />
                          {isCreatingIssue ? 'Creating...' : 'Create GitHub Issue'}
                        </Button>
                      )}
                    </div>
                  )}
                  {msg.isSystemMessage && renderSystemMessage(msg)}
                </div>
              );
            })}
            {isBotThinking && (
              <div className="flex justify-center items-center">
                <ChatMessage message={{
                  id: 'thinking',
                  sender: 'GitPulse AI',
                  senderId: 'ai_assistant',
                  avatarUrl: gitpulseAvatarUrl,
                  text: 'Thinking...',
                  timestamp: null,
                }} />
              </div>
            )}
          </div>
        </div>
        {/* Input */}
        <div className="p-2 sm:p-4 border-t bg-gradient-to-r from-primary/10 to-accent/10 rounded-b-lg">
          <MessageInput onSendMessage={handleSendMessage} disabled={isBotThinking} repoFullName={repoFullName} />
        </div>
      </div>
      {/* Kanban board: desktop (side panel), mobile (Sheet) */}
      {sidePanelOpen && (
        <div className="hidden min-h-0 min-w-0 md:flex md:w-1/2 border-l bg-background/90 backdrop-blur-lg rounded-r-lg shadow-2xl overflow-hidden">
          <div className="h-full w-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border">
            <KanbanBoard repoFullName={repoFullName} aiIssues={aiIssuesForKanban} className="h-full w-full" />
          </div>
        </div>
      )}
      {/* Mobile Kanban as a Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => setIsKanbanOpen(open)}>
        <SheetContent side="right" className="w-full sm:max-w-lg md:hidden">
          <SheetHeader>
            <SheetTitle>Kanban Board</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <KanbanBoard repoFullName={repoFullName} aiIssues={aiIssuesForKanban} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
