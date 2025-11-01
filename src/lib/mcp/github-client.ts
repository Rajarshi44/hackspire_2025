import {
  GitHubIssue,
  GitHubRateLimitHeaders,
  GitHubTreeObject,
  GitHubTreeResponse,
  GitHubCommitResponse,
  GitHubRefResponse,
  GitHubPullRequest,
  GitHubFileContent,
  GitHubAPIError,
  RateLimitError,
} from '@/types/mcp';

// ============================================================================
// Configuration
// ============================================================================

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.warn('⚠️ GITHUB_TOKEN environment variable is not set. GitHub API calls will fail.');
}

// ============================================================================
// Rate Limit Utilities
// ============================================================================

function extractRateLimitHeaders(headers: Headers): GitHubRateLimitHeaders {
  return {
    limit: headers.get('X-RateLimit-Limit') ? Number(headers.get('X-RateLimit-Limit')) : undefined,
    remaining: headers.get('X-RateLimit-Remaining') ? Number(headers.get('X-RateLimit-Remaining')) : undefined,
    reset: headers.get('X-RateLimit-Reset') ? Number(headers.get('X-RateLimit-Reset')) : undefined,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wraps GitHub API calls with rate limit handling and retry logic
 */
export async function safeGithubCall<T>(
  fn: () => Promise<Response>,
  retries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fn();
      const rateLimitHeaders = extractRateLimitHeaders(response.headers);

      // Handle rate limiting
      if (response.status === 403 && rateLimitHeaders.remaining === 0 && rateLimitHeaders.reset) {
        const resetTime = rateLimitHeaders.reset * 1000;
        const waitMs = Math.max(0, resetTime - Date.now()) + 1000; // Add 1s buffer
        
        console.warn(`⏳ GitHub rate limit exceeded. Waiting ${Math.round(waitMs / 1000)}s until reset...`);
        
        if (attempt === retries - 1) {
          throw new RateLimitError(rateLimitHeaders.reset);
        }
        
        await sleep(waitMs);
        continue;
      }

      // Handle server errors with exponential backoff
      if (response.status >= 500) {
        const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.warn(`⚠️ GitHub API server error (${response.status}). Retrying in ${backoffMs}ms...`);
        
        if (attempt === retries - 1) {
          const errorText = await response.text();
          throw new GitHubAPIError(
            `GitHub API server error: ${errorText}`,
            response.status,
            { attempt: attempt + 1 }
          );
        }
        
        await sleep(backoffMs);
        continue;
      }

      // Handle client errors (4xx)
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `GitHub API error: ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new GitHubAPIError(errorMessage, response.status, { errorText });
      }

      // Success - parse JSON response
      const data = await response.json();
      
      // Log remaining rate limit if low
      if (rateLimitHeaders.remaining !== undefined && rateLimitHeaders.remaining < 100) {
        console.warn(`⚠️ GitHub API rate limit low: ${rateLimitHeaders.remaining} remaining`);
      }
      
      return data as T;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors (except rate limit)
      if (error instanceof GitHubAPIError && error.statusCode < 500 && error.code !== 'RATE_LIMIT') {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === retries - 1) {
        throw error;
      }
    }
  }

  throw lastError || new Error('GitHub API call failed after retries');
}

// ============================================================================
// GitHub API Functions
// ============================================================================

/**
 * Fetch issue details including assignees
 */
export async function fetchIssueWithAssignees(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubIssue> {
  return safeGithubCall<GitHubIssue>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  );
}

/**
 * Get the default branch name for a repository
 */
export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const data = await safeGithubCall<{ default_branch: string }>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  );
  
  return data.default_branch;
}

/**
 * Get the SHA of a branch
 */
export async function getBranchSHA(owner: string, repo: string, branch: string): Promise<string> {
  const data = await safeGithubCall<GitHubRefResponse>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  );
  
  return data.object.sha;
}

/**
 * Create a new branch from a base branch
 */
export async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  baseSHA: string
): Promise<GitHubRefResponse> {
  return safeGithubCall<GitHubRefResponse>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSHA,
      }),
    })
  );
}

/**
 * Get file content from repository
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<GitHubFileContent> {
  const url = new URL(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`);
  if (ref) {
    url.searchParams.set('ref', ref);
  }
  
  return safeGithubCall<GitHubFileContent>(() =>
    fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  );
}

/**
 * Create a Git tree with multiple files (atomic multi-file commit)
 */
export async function createGitTree(
  owner: string,
  repo: string,
  baseTreeSHA: string,
  files: GitHubTreeObject[]
): Promise<GitHubTreeResponse> {
  return safeGithubCall<GitHubTreeResponse>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base_tree: baseTreeSHA,
        tree: files.map(file => ({
          path: file.path,
          mode: file.mode,
          type: file.type,
          content: file.content,
        })),
      }),
    })
  );
}

/**
 * Create a Git commit
 */
export async function createCommit(
  owner: string,
  repo: string,
  message: string,
  treeSHA: string,
  parentSHA: string
): Promise<GitHubCommitResponse> {
  return safeGithubCall<GitHubCommitResponse>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        tree: treeSHA,
        parents: [parentSHA],
      }),
    })
  );
}

/**
 * Update a branch reference to point to a new commit
 */
export async function updateRef(
  owner: string,
  repo: string,
  branch: string,
  commitSHA: string
): Promise<GitHubRefResponse> {
  return safeGithubCall<GitHubRefResponse>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sha: commitSHA,
        force: false,
      }),
    })
  );
}

/**
 * Create a draft pull request
 */
export async function createDraftPR(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
  labels: string[]
): Promise<GitHubPullRequest> {
  const pr = await safeGithubCall<GitHubPullRequest>(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        head,
        base,
        draft: true,
      }),
    })
  );

  // Add labels to the PR
  if (labels.length > 0) {
    await safeGithubCall(() =>
      fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${pr.number}/labels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labels,
        }),
      })
    );
  }

  return pr;
}

/**
 * Post a comment on an issue
 */
export async function postIssueComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  await safeGithubCall(() =>
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body,
      }),
    })
  );
}
