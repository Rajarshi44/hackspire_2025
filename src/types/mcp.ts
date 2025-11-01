import { z } from 'zod';

// ============================================================================
// Request/Response Schemas
// ============================================================================

export const MCPGenerateCodeRequestSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  issue_number: z.number().int().positive('Issue number must be positive'),
  jobId: z.string().min(1, 'Job ID is required'),
  requested_by: z.string().min(1, 'Requested by is required'),
  related_files: z.array(z.string()).optional(),
});

export type MCPGenerateCodeRequest = z.infer<typeof MCPGenerateCodeRequestSchema>;

export const MCPGenerateCodeResponseSchema = z.object({
  success: z.boolean(),
  jobId: z.string(),
  pr_url: z.string().optional(),
  pr_number: z.number().optional(),
  branch: z.string().optional(),
  error: z.string().optional(),
  details: z.string().optional(),
});

export type MCPGenerateCodeResponse = z.infer<typeof MCPGenerateCodeResponseSchema>;

// ============================================================================
// File Change Schemas
// ============================================================================

export const FileChangeSchema = z.object({
  path: z.string(),
  content: z.string(),
  mode: z.enum(['100644', '100755', '040000', '160000', '120000']).default('100644'),
  summary: z.string().optional(),
});

export type FileChange = z.infer<typeof FileChangeSchema>;

export const FileChunkSchema = z.object({
  snippet: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  context: z.string().optional(),
});

export type FileChunk = z.infer<typeof FileChunkSchema>;

// ============================================================================
// GitHub API Schemas
// ============================================================================

export const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().optional(),
  html_url: z.string().optional(),
});

export type GitHubUser = z.infer<typeof GitHubUserSchema>;

export const GitHubIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  html_url: z.string(),
  user: GitHubUserSchema,
  assignees: z.array(GitHubUserSchema),
  labels: z.array(z.object({
    name: z.string(),
    color: z.string().optional(),
  })),
});

export type GitHubIssue = z.infer<typeof GitHubIssueSchema>;

export const GitHubTreeObjectSchema = z.object({
  path: z.string(),
  mode: z.enum(['100644', '100755', '040000', '160000', '120000']),
  type: z.enum(['blob', 'tree', 'commit']),
  content: z.string().optional(),
  sha: z.string().optional(),
});

export type GitHubTreeObject = z.infer<typeof GitHubTreeObjectSchema>;

export const GitHubTreeResponseSchema = z.object({
  sha: z.string(),
  url: z.string(),
  tree: z.array(z.object({
    path: z.string(),
    mode: z.string(),
    type: z.string(),
    sha: z.string(),
  })),
});

export type GitHubTreeResponse = z.infer<typeof GitHubTreeResponseSchema>;

export const GitHubCommitResponseSchema = z.object({
  sha: z.string(),
  url: z.string(),
  message: z.string(),
});

export type GitHubCommitResponse = z.infer<typeof GitHubCommitResponseSchema>;

export const GitHubRefResponseSchema = z.object({
  ref: z.string(),
  url: z.string(),
  object: z.object({
    sha: z.string(),
    type: z.string(),
    url: z.string(),
  }),
});

export type GitHubRefResponse = z.infer<typeof GitHubRefResponseSchema>;

export const GitHubPullRequestSchema = z.object({
  number: z.number(),
  html_url: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean(),
});

export type GitHubPullRequest = z.infer<typeof GitHubPullRequestSchema>;

export const GitHubRateLimitHeadersSchema = z.object({
  limit: z.number().optional(),
  remaining: z.number().optional(),
  reset: z.number().optional(),
});

export type GitHubRateLimitHeaders = z.infer<typeof GitHubRateLimitHeadersSchema>;

export const GitHubFileContentSchema = z.object({
  content: z.string(),
  encoding: z.string(),
  sha: z.string(),
  size: z.number(),
  path: z.string(),
});

export type GitHubFileContent = z.infer<typeof GitHubFileContentSchema>;

// ============================================================================
// Validation Schemas
// ============================================================================

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()).optional(),
  tempDir: z.string().optional(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// ============================================================================
// AI Flow Schemas
// ============================================================================

export const AICodeGenerationInputSchema = z.object({
  issueTitle: z.string(),
  issueBody: z.string(),
  files: z.array(z.object({
    path: z.string(),
    chunks: z.array(FileChunkSchema),
  })),
});

export type AICodeGenerationInput = z.infer<typeof AICodeGenerationInputSchema>;

export const AICodeGenerationOutputSchema = z.object({
  changes: z.array(FileChangeSchema),
  overallSummary: z.string(),
});

export type AICodeGenerationOutput = z.infer<typeof AICodeGenerationOutputSchema>;

// ============================================================================
// Firestore Schemas
// ============================================================================

export const MCPLogSchema = z.object({
  message: z.string(),
  requested_by: z.string(),
  timestamp: z.number(),
  issue_number: z.number().optional(),
  error: z.string().optional(),
});

export type MCPLog = z.infer<typeof MCPLogSchema>;

export const MCPJobSchema = z.object({
  jobId: z.string(),
  status: z.enum(['pending', 'processing', 'review', 'completed', 'failed']),
  pr_url: z.string().optional(),
  pr_number: z.number().optional(),
  branch: z.string().optional(),
  validated: z.boolean().optional(),
  created_at: z.number(),
  updated_at: z.number(),
  error: z.string().optional(),
});

export type MCPJob = z.infer<typeof MCPJobSchema>;

// ============================================================================
// Error Types
// ============================================================================

export class MCPError extends Error {
  constructor(
    message: string,
    public code: 'NOT_ASSIGNEE' | 'VALIDATION_FAILED' | 'GITHUB_ERROR' | 'AI_ERROR' | 'RATE_LIMIT' | 'INTERNAL_ERROR',
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class NotAssigneeError extends MCPError {
  constructor(requestedBy: string, assignees: string[]) {
    super(
      `User ${requestedBy} is not assigned to this issue. Assignees: ${assignees.join(', ')}`,
      'NOT_ASSIGNEE',
      403,
      { requestedBy, assignees }
    );
    this.name = 'NotAssigneeError';
  }
}

export class ValidationError extends MCPError {
  constructor(errors: string[]) {
    super(
      `TypeScript validation failed: ${errors.join('; ')}`,
      'VALIDATION_FAILED',
      422,
      { errors }
    );
    this.name = 'ValidationError';
  }
}

export class GitHubAPIError extends MCPError {
  constructor(message: string, statusCode: number, details?: unknown) {
    super(message, 'GITHUB_ERROR', statusCode, details);
    this.name = 'GitHubAPIError';
  }
}

export class RateLimitError extends MCPError {
  constructor(resetTime: number) {
    super(
      `GitHub API rate limit exceeded. Resets at ${new Date(resetTime * 1000).toISOString()}`,
      'RATE_LIMIT',
      429,
      { resetTime }
    );
    this.name = 'RateLimitError';
  }
}
