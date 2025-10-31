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
import { ScrollArea } from './ui/scroll-area';
import Link from 'next/link';

type ChatInterfaceProps = {
  repoFullName: string;
  channelId: string;
};

export function ChatInterface({ repoFullName, channelId }: ChatInterfaceProps) {
  const { user, githubToken } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isBotThinking, setIsBotThinking] = useState(false);

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
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  const sendBotMessage = async (text: string, type: 'issue-list' | 'pr-list' | 'pr-verification', data: any[]) => {
    if (!messagesRef) return;
    const tempId = `temp_${Date.now()}`;
    const botMessage: Omit<Message, 'id' | 'timestamp'> = {
      sender: 'GitPulse AI',
      senderId: 'ai_assistant',
      avatarUrl: '/brain-circuit.svg',
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
          avatarUrl: '/brain-circuit.svg',
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
              avatarUrl: '/brain-circuit.svg',
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

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
            <div className="p-4 space-y-4">
                {isLoading && messages.length === 0 && (
                    <div className="flex justify-center items-center h-full">
                        <p>Loading messages...</p>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id}>
                        <ChatMessage message={msg} />
                        {msg.isIssue && (
                            <div className="ml-12 mt-2 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <span className="text-sm font-semibold text-primary">AI Suggestion</span>
                                {msg.issueUrl ? (
                                    <Button asChild size="sm" variant="outline">
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
                                    >
                                        <Github className="mr-2 h-4 w-4" />
                                        {isCreatingIssue ? 'Creating...' : 'Create GitHub Issue'}
                                    </Button>
                                )}
                            </div>
                        )}
                        {msg.isSystemMessage && renderSystemMessage(msg)}
                    </div>
                ))}
                {isBotThinking && (
                     <ChatMessage message={{
                        id: 'thinking',
                        sender: 'GitPulse AI',
                        senderId: 'ai_assistant',
                        avatarUrl: '/brain-circuit.svg',
                        text: 'Thinking...',
                        timestamp: null,
                    }} />
                )}
            </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <MessageInput onSendMessage={handleSendMessage} disabled={isBotThinking} repoFullName={repoFullName} />
      </div>
    </div>
  );
}
