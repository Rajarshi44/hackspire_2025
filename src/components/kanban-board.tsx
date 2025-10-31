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
    // In a real implementation, fetch issues via GitHub API using repoFullName
    // and merge them into the board state.
    // This is a placeholder to demonstrate structure.
    console.log("[Kanban] Sync placeholder for", repoFullName);
  }

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
