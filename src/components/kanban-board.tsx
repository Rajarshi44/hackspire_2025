"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, DropResult } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Filter, X, ChevronRight, ClipboardList, Loader, CheckCircle } from "lucide-react";
import { useAuth } from '@/lib/auth';

// Data contracts
export type Priority = "high" | "medium" | "low";

export type KanbanIssue = {
  id: string;               // unique id (message id or github issue id)
  number?: number;          // optional GitHub issue number
  title: string;
  summary?: string;         // short description (<= 80 chars)
  assignee?: {
    name?: string;
    avatarUrl?: string;
  } | null;
  priority: Priority;
  column: "todo" | "in_progress" | "done";
  source?: "ai" | "github"; // where this came from
};

export type KanbanBoardProps = {
  repoFullName: string;
  // Optional: AI issues derived from chat messages. The board will merge unseen ones into To Do.
  aiIssues?: Array<Pick<KanbanIssue, "id" | "title" | "summary" | "priority" | "assignee">>;
  className?: string;
};

// Utility: clamp summary to 80 chars
function clampSummary(text?: string, max = 80): string | undefined {
  if (!text) return text;
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

// Priority color badges
function PriorityBadge({ priority }: { priority: Priority }) {
  const color = priority === "high" ? "bg-red-500" : priority === "medium" ? "bg-yellow-500" : "bg-green-500";
  const label = priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// Mock placeholder issues to demonstrate layout
const MOCK_ISSUES: KanbanIssue[] = [
  {
    id: "gh-101",
    number: 101,
    title: "Improve onboarding docs for new contributors",
    summary: "Add step-by-step guide and screenshots for initial setup.",
    assignee: { name: "Alex", avatarUrl: "https://i.pravatar.cc/100?img=3" },
    priority: "medium",
    column: "todo",
    source: "github",
  },
  {
    id: "ai-1",
    title: "AI: Race condition in message feed on slow networks",
    summary: "Observed duplicate renders when switching channels quickly.",
    assignee: null,
    priority: "high",
    column: "in_progress",
    source: "ai",
  },
  {
    id: "gh-88",
    number: 88,
    title: "UI: Align avatars in chat bubbles",
    summary: "Left margin inconsistent in Firefox vs Chrome.",
    assignee: { name: "Sam", avatarUrl: "https://i.pravatar.cc/100?img=5" },
    priority: "low",
    column: "done",
    source: "github",
  },
];

export function KanbanBoard({ repoFullName, aiIssues = [], className }: KanbanBoardProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [activeColumn, setActiveColumn] = useState<'todo' | 'in_progress' | 'done' | null>(null);

  // Internal board state
  const [board, setBoard] = useState(() => {
    // Start with mock issues, sorted into columns
    const initial = { todo: [], in_progress: [], done: [] } as Record<string, KanbanIssue[]>;
    for (const issue of MOCK_ISSUES) {
      initial[issue.column].push(issue);
    }
    return initial;
  });

  // Track seen issue IDs to avoid duplicates
  const seenIds = useRef<Set<string>>(new Set(MOCK_ISSUES.map(i => i.id)));

  // Merge incoming AI issues (from chat) into To Do if unseen
  useEffect(() => {
    if (!aiIssues || aiIssues.length === 0) return;
    setBoard(prev => {
      const next = { ...prev, todo: [...prev.todo] };
      let changed = false;
      for (const ai of aiIssues) {
        if (!seenIds.current.has(ai.id)) {
          seenIds.current.add(ai.id);
          next.todo.unshift({
            id: ai.id,
            title: ai.title,
            summary: clampSummary(ai.summary),
            assignee: ai.assignee || null,
            priority: ai.priority || "medium",
            column: "todo",
            source: "ai",
          });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [aiIssues]);

  // Simple client-side filter by title or priority
  const filterFn = (issue: KanbanIssue) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      issue.title.toLowerCase().includes(q) ||
      (issue.priority && issue.priority.toLowerCase().includes(q))
    );
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    if (!destination) return;
    const srcCol = source.droppableId as keyof typeof board;
    const dstCol = destination.droppableId as keyof typeof board;

    if (srcCol === dstCol && source.index === destination.index) return;

    const srcItems = Array.from(board[srcCol]);
    const [moved] = srcItems.splice(source.index, 1);
    const dstItems = Array.from(board[dstCol]);
    dstItems.splice(destination.index, 0, { ...moved, column: dstCol });

    setBoard({
      ...board,
      [srcCol]: srcItems,
      [dstCol]: dstItems,
    });
  };

  // Placeholder for GitHub sync (optional)
  async function syncWithGithub() {
    await fetchAndMergeGithubIssues();
  }

  // Fetch issues from GitHub and merge into board state.
  const { githubToken } = useAuth();

  async function fetchGithubIssuesOnce(page = 1, per_page = 100) {
    if (!repoFullName) return { issues: [], hasMore: false };
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) return { issues: [], hasMore: false };

    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=${per_page}&page=${page}`;
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
    if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn('[Kanban] Failed to fetch issues from GitHub', res.status);
      return { issues: [], hasMore: false };
    }

    const data = await res.json();
    // GitHub returns pull requests in this endpoint as well (they include pull_request key). Filter those out.
    const issues = Array.isArray(data) ? data.filter((i: any) => !i.pull_request) : [];

    // simple pagination detection: if returned length === per_page, there might be more
    const hasMore = Array.isArray(data) && data.length === per_page;
    return { issues, hasMore };
  }

  async function fetchAndMergeGithubIssues() {
    try {
      let page = 1;
      const per_page = 100;
      const allFetched: any[] = [];
      while (true) {
        const { issues, hasMore } = await fetchGithubIssuesOnce(page, per_page);
        if (!issues || issues.length === 0) break;
        allFetched.push(...issues);
        if (!hasMore) break;
        page += 1;
        // safety: avoid infinite loops
        if (page > 5) break;
      }

      if (allFetched.length === 0) return;

      // Merge into board: add new issues, update existing ones, move closed -> done
      setBoard(prev => {
        const next = { todo: [...(prev.todo ?? [])], in_progress: [...(prev.in_progress ?? [])], done: [...(prev.done ?? [])] } as Record<string, KanbanIssue[]>;

        for (const gh of allFetched) {
          const ghId = `gh-${gh.id}`;
          // detect priority from labels (label names containing 'priority' or high/low)
          let priority: Priority = 'medium';
          if (gh.labels && Array.isArray(gh.labels)) {
            const labelNames = gh.labels.map((l: any) => (l.name || '').toString().toLowerCase());
            if (labelNames.some((n: string) => n.includes('high') || n.includes('priority: high'))) priority = 'high';
            else if (labelNames.some((n: string) => n.includes('low') || n.includes('priority: low'))) priority = 'low';
            else if (labelNames.some((n: string) => n.includes('in-progress') || n.includes('doing'))) {
              // treat as in_progress
            }
          }

          const mapped: KanbanIssue = {
            id: ghId,
            number: gh.number,
            title: gh.title,
            summary: clampSummary(gh.body || ''),
            assignee: gh.assignee ? { name: gh.assignee.login, avatarUrl: gh.assignee.avatar_url } : null,
            priority,
            column: gh.state === 'closed' ? 'done' : 'todo',
            source: 'github',
          };

          // If we have seen it before (either in any column), update/move
          const existsIn = (col: string) => (next[col] ?? []).findIndex(i => i.id === ghId);
          const idxTodo = existsIn('todo');
          const idxProgress = existsIn('in_progress');
          const idxDone = existsIn('done');

          // remove from wherever it exists
          if (idxTodo !== -1) next.todo.splice(idxTodo, 1);
          if (idxProgress !== -1) next.in_progress.splice(idxProgress, 1);
          if (idxDone !== -1) next.done.splice(idxDone, 1);

          // push into appropriate column (closed -> done)
          if (mapped.column === 'done') {
            // push to top of done
            next.done.unshift(mapped);
          } else {
            // if labels indicate in-progress, put there
            const labelNames = (gh.labels || []).map((l: any) => (l.name || '').toString().toLowerCase());
            if (labelNames.some((n: string) => n.includes('in-progress') || n.includes('doing') || n.includes('wip'))) {
              mapped.column = 'in_progress';
              next.in_progress.unshift(mapped);
            } else {
              next.todo.unshift(mapped);
            }
          }

          // mark seen
          seenIds.current.add(mapped.id);
        }

        return next;
      });
    } catch (e) {
      console.error('[Kanban] Error fetching GitHub issues', e);
    }
  }

  // Auto-sync on mount and when repoFullName or githubToken changes, and poll every 60s
  useEffect(() => {
    let mounted = true;
    if (!repoFullName) return;
    // run an initial sync
    fetchAndMergeGithubIssues();
    const iv = setInterval(() => {
      if (!mounted) return;
      fetchAndMergeGithubIssues();
    }, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [repoFullName, githubToken]);

  // Column Renderer
  const Column: React.FC<{ id: keyof typeof board; title: string }> = ({ id, title }) => {
    if (activeColumn !== id) return null;
    const items = (board[id] ?? []).filter(filterFn);
    return (
      <Card className="flex flex-col h-full">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>{title}</span>
            <Badge variant="secondary" className="ml-2">{items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[calc(100vh-16rem)] pr-2">
            <Droppable droppableId={id}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                  {items.map((issue, index) => (
                    <Draggable key={issue.id} draggableId={issue.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={cn(
                            "rounded-md border bg-card p-3 shadow-sm transition-colors",
                            snapshot.isDragging ? "ring-2 ring-primary" : ""
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 w-full">
                              <div className="font-medium break-words whitespace-normal text-sm">{issue.title}</div>
                              <div className="text-xs text-muted-foreground mt-1">{issue.number ? `#${issue.number}` : issue.id}</div>
                              {issue.summary && (
                                <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                                  {issue.summary}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <PriorityBadge priority={issue.priority} />
                              <Avatar className="h-6 w-6">
                                {issue.assignee?.avatarUrl ? (
                                  <AvatarImage src={issue.assignee.avatarUrl} alt={issue.assignee?.name || "Assignee"} />
                                ) : (
                                  <AvatarFallback>U</AvatarFallback>
                                )}
                              </Avatar>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("relative h-full border-l bg-background flex flex-col", className)}>
      {/* Navbar for board status */}
      <nav className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/10">
        <div className="flex-1 flex items-center justify-center gap-6">
          <button
            aria-pressed={activeColumn === 'todo'}
            onClick={() => setActiveColumn(prev => prev === 'todo' ? null : 'todo')}
            className={`flex flex-col items-center group focus:outline-none ${activeColumn === 'todo' ? 'scale-110' : ''}`}
          >
            <ClipboardList className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-xs mt-1 font-medium">To Do</span>
          </button>

          <button
            aria-pressed={activeColumn === 'in_progress'}
            onClick={() => setActiveColumn(prev => prev === 'in_progress' ? null : 'in_progress')}
            className={`flex flex-col items-center group focus:outline-none ${activeColumn === 'in_progress' ? 'scale-110' : ''}`}
          >
            <Loader className="h-6 w-6 text-yellow-500 animate-spin group-hover:scale-110 transition-transform" />
            <span className="text-xs mt-1 font-medium">In Progress</span>
          </button>

          <button
            aria-pressed={activeColumn === 'done'}
            onClick={() => setActiveColumn(prev => prev === 'done' ? null : 'done')}
            className={`flex flex-col items-center group focus:outline-none ${activeColumn === 'done' ? 'scale-110' : ''}`}
          >
            <CheckCircle className="h-6 w-6 text-green-500 group-hover:scale-110 transition-transform" />
            <span className="text-xs mt-1 font-medium">Done</span>
          </button>
        </div>
      </nav>

      {/* Header controls (always visible) */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/20">
        <div className="relative flex-1">
          <Input
            placeholder="Search by title or priority (high/medium/low)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
          <Filter className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setQuery("")}> 
          <X className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={syncWithGithub}>
          Sync
        </Button>
      </div>

      {/* Columns: show only the active column */}
      <div className="grid grid-cols-1 gap-3 p-3 flex-1 min-h-0 w-full">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Column id="todo" title="To Do" />
          <Column id="in_progress" title="In Progress" />
          <Column id="done" title="Done" />
        </DragDropContext>
      </div>
    </div>
  );
}

export default KanbanBoard;
