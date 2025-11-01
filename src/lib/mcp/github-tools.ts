/**
 * GitHub Tools Module
 * 
 * Provides robust GitHub API utility functions with:
 * - Automatic retry logic for 5xx errors
 * - Rate limit handling
 * - Detailed error messages for 403/404
 * - Automatic base64 encoding for file content
 * - Token management via process.env.GITHUB_TOKEN
 */

import {
  GitHubIssue,
  GitHubRefResponse,
  GitHubPullRequest,
  GitHubAPIError,
} from '@/types/mcp';
import { safeGithubCall } from './github-client';

// ============================================================================
// Configuration
// ============================================================================

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  throw new Error(
    '❌ GITHUB_TOKEN environment variable is required for GitHub API operations. ' +
    'Please set it in your .env.local file or environment configuration.'
  );
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface GetIssueContextParams {
  owner: string;
  repo: string;
  issue_number: number;
}

export interface CreateBranchParams {
  owner: string;
  repo: string;
  newBranch: string;
  baseBranch: string;
}

export interface CreateOrUpdateFileParams {
  owner: string;
  repo: string;
  path: string;
  content: string | Buffer;
  branch: string;
  commitMessage: string;
}

export interface CreateDraftPRParams {
  owner: string;
  repo: string;
  headBranch: string;
  baseBranch: string;
  title: string;
  body: string;
}

export interface ListPRReviewCommentsParams {
  owner: string;
  repo: string;
  pr_number: number;
}

export interface PostPRCommentParams {
  owner: string;
  repo: string;
  pr_number: number;
  body: string;
}

export interface PostIssueCommentParams {
  owner: string;
  repo: string;
  issue_number: number;
  body: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  user: {
    login: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubReviewComment extends GitHubComment {
  path: string;
  position?: number;
  line?: number;
  commit_id: string;
  diff_hunk: string;
}

interface GitHubFileContentResponse {
  content: string;
  encoding: string;
  sha: string;
  size: number;
  path: string;
}

interface GitHubBranchRef {
  ref: string;
  node_id: string;
  url: string;
  object: {
    sha: string;
    type: string;
    url: string;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Encode content to base64, handling both strings and Buffers
 */
function encodeContent(content: string | Buffer): string {
  if (Buffer.isBuffer(content)) {
    return content.toString('base64');
  }
  return Buffer.from(content, 'utf-8').toString('base64');
}

/**
 * Create standard GitHub API headers
 */
function getHeaders(): HeadersInit {
  return {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'GitPulse-GitHub-Tools/1.0',
  };
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get issue context including title, body, labels, assignees, and comments
 * 
 * @throws {GitHubAPIError} with statusCode 404 if issue not found
 * @throws {GitHubAPIError} with statusCode 403 if access denied
 */
export async function getIssueContext(params: GetIssueContextParams): Promise<{
  issue: GitHubIssue;
  comments: GitHubComment[];
}> {
  const { owner, repo, issue_number } = params;

  // Fetch issue details
  const issue = await safeGithubCall<GitHubIssue>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issue_number}`, {
      headers: getHeaders(),
    })
  );

  // Fetch issue comments
  const comments = await safeGithubCall<GitHubComment[]>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issue_number}/comments`, {
      headers: getHeaders(),
    })
  );

  return { issue, comments };
}

/**
 * Create a new branch from a base branch
 * 
 * @throws {GitHubAPIError} with statusCode 404 if base branch not found
 * @throws {GitHubAPIError} with statusCode 422 if branch already exists
 */
export async function createBranch(params: CreateBranchParams): Promise<GitHubRefResponse> {
  const { owner, repo, newBranch, baseBranch } = params;

  // First, get the SHA of the base branch
  const baseRef = await safeGithubCall<GitHubBranchRef>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`, {
      headers: getHeaders(),
    })
  );

  const baseSHA = baseRef.object.sha;

  // Create the new branch
  const newRef = await safeGithubCall<GitHubRefResponse>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ref: `refs/heads/${newBranch}`,
        sha: baseSHA,
      }),
    })
  );

  return newRef;
}

/**
 * Create or update a file in a repository
 * 
 * Automatically handles base64 encoding for both text and binary content.
 * If the file exists, it will be updated; otherwise, it will be created.
 * 
 * @throws {GitHubAPIError} with statusCode 404 if repository or branch not found
 * @throws {GitHubAPIError} with statusCode 409 if there's a conflict
 */
export async function createOrUpdateFile(params: CreateOrUpdateFileParams): Promise<{
  content: {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
  };
  commit: {
    sha: string;
    url: string;
    html_url: string;
    message: string;
  };
}> {
  const { owner, repo, path, content, branch, commitMessage } = params;

  // Encode content to base64
  const encodedContent = encodeContent(content);

  // Check if file exists to get its SHA (required for updates)
  let existingFileSha: string | undefined;
  try {
    const existingFile = await safeGithubCall<GitHubFileContentResponse>(() =>
      fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
        headers: getHeaders(),
      })
    );
    existingFileSha = existingFile.sha;
  } catch (error) {
    // File doesn't exist, that's okay - we'll create it
    if (error instanceof GitHubAPIError && error.statusCode === 404) {
      existingFileSha = undefined;
    } else {
      throw error;
    }
  }

  // Create or update the file
  const response = await safeGithubCall<{
    content: {
      name: string;
      path: string;
      sha: string;
      size: number;
      url: string;
      html_url: string;
    };
    commit: {
      sha: string;
      url: string;
      html_url: string;
      message: string;
    };
  }>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        message: commitMessage,
        content: encodedContent,
        branch: branch,
        ...(existingFileSha && { sha: existingFileSha }),
      }),
    })
  );

  return response;
}

/**
 * Create a draft pull request
 * 
 * @throws {GitHubAPIError} with statusCode 404 if repository or branches not found
 * @throws {GitHubAPIError} with statusCode 422 if PR already exists or validation fails
 */
export async function createDraftPR(params: CreateDraftPRParams): Promise<GitHubPullRequest> {
  const { owner, repo, headBranch, baseBranch, title, body } = params;

  const pr = await safeGithubCall<GitHubPullRequest>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        title,
        body,
        head: headBranch,
        base: baseBranch,
        draft: true,
      }),
    })
  );

  return pr;
}

/**
 * List all review comments on a pull request
 * 
 * @throws {GitHubAPIError} with statusCode 404 if PR not found
 */
export async function listPRReviewComments(params: ListPRReviewCommentsParams): Promise<GitHubReviewComment[]> {
  const { owner, repo, pr_number } = params;

  const comments = await safeGithubCall<GitHubReviewComment[]>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr_number}/comments`, {
      headers: getHeaders(),
    })
  );

  return comments;
}

/**
 * Post a comment on a pull request (issue comment, not review comment)
 * 
 * @throws {GitHubAPIError} with statusCode 404 if PR not found
 */
export async function postPRComment(params: PostPRCommentParams): Promise<GitHubComment> {
  const { owner, repo, pr_number, body } = params;

  const comment = await safeGithubCall<GitHubComment>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${pr_number}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ body }),
    })
  );

  return comment;
}

/**
 * Post a comment on an issue
 * 
 * @throws {GitHubAPIError} with statusCode 404 if issue not found
 * @throws {GitHubAPIError} with statusCode 403 if access denied
 */
export async function postIssueComment(params: PostIssueCommentParams): Promise<GitHubComment> {
  const { owner, repo, issue_number, body } = params;

  const comment = await safeGithubCall<GitHubComment>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issue_number}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ body }),
    })
  );

  return comment;
}
