import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getFirestore, doc, updateDoc, serverTimestamp } from '@/lib/server-firestore';

/**
 * GitHub Webhook Handler
 * 
 * Handles GitHub webhook events for:
 * - Pull request merged: Update MCP job status and notify channel
 * - Pull request review: Handle change requests and trigger MCP updates
 * - Issues: Track issue lifecycle and link to MCP jobs
 * - Push: Monitor code commits and trigger related actions
 * 
 * Webhook Configuration:
 * - URL: https://devx-rho.vercel.app/api/webhooks/github
 * - Secret: gH9$zT!vQ3@rL7#xW2^mN0*bE8&uK5%p
 * - Events: pull_request, pull_request_review, issues, push
 */

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    console.error('Missing GitHub signature header');
    return false;
  }

  try {
    // GitHub sends signature as "sha256=<hash>"
    if (!signature.startsWith('sha256=')) {
      console.error('Invalid signature format (missing sha256= prefix)');
      return false;
    }

    const receivedHash = signature.replace('sha256=', '');
    const expectedHash = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    console.log('Signature comparison:', {
      receivedHashPrefix: receivedHash.substring(0, 16) + '...',
      expectedHashPrefix: expectedHash.substring(0, 16) + '...',
      receivedLength: receivedHash.length,
      expectedLength: expectedHash.length,
      payloadLength: payload.length
    });

    // Convert to buffers for timing-safe comparison
    const signatureBuffer = Buffer.from(receivedHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    // Use timing-safe comparison to prevent timing attacks
    if (signatureBuffer.length !== expectedBuffer.length) {
      console.error('Signature length mismatch:', {
        received: signatureBuffer.length,
        expected: expectedBuffer.length
      });
      return false;
    }

    const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);
    
    console.log('GitHub signature verification result:', isValid);

    return isValid;
  } catch (error: any) {
    console.error('Error during signature verification:', error.message);
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find MCP job by PR number
 */
async function findMCPJobByPR(
  repoId: string,
  prNumber: number
): Promise<{ jobId: string; jobData: any } | null> {
  try {
    const db = getFirestore();
    const jobsRef = db.collection('repos').doc(repoId).collection('mcp_jobs');
    const querySnapshot = await jobsRef.where('pr_number', '==', prNumber).get();

    if (querySnapshot.empty) {
      console.log(`No MCP job found for PR #${prNumber} in repo ${repoId}`);
      return null;
    }

    // Return first matching job
    const jobDoc = querySnapshot.docs[0];
    return {
      jobId: jobDoc.id,
      jobData: jobDoc.data()
    };
  } catch (error) {
    console.error('Error finding MCP job:', error);
    return null;
  }
}

/**
 * Find MCP job by issue number
 */
async function findMCPJobByIssue(
  repoId: string,
  issueNumber: number
): Promise<{ jobId: string; jobData: any } | null> {
  try {
    const db = getFirestore();
    const jobsRef = db.collection('repos').doc(repoId).collection('mcp_jobs');
    const querySnapshot = await jobsRef.where('issueNumber', '==', issueNumber).get();

    if (querySnapshot.empty) {
      console.log(`No MCP job found for Issue #${issueNumber} in repo ${repoId}`);
      return null;
    }

    // Return first matching job
    const jobDoc = querySnapshot.docs[0];
    return {
      jobId: jobDoc.id,
      jobData: jobDoc.data()
    };
  } catch (error) {
    console.error('Error finding MCP job:', error);
    return null;
  }
}

/**
 * Update MCP job status
 */
async function updateMCPJobStatus(
  repoId: string,
  jobId: string,
  updates: Record<string, any>
): Promise<void> {
  try {
    const db = getFirestore();
    const jobRef = doc(db, 'repos', repoId, 'mcp_jobs', jobId);
    
    await updateDoc(jobRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log(`Updated MCP job ${jobId}:`, updates);
  } catch (error) {
    console.error('Error updating MCP job:', error);
    throw error;
  }
}

/**
 * Post notification message to Firestore chat
 */
async function postChatNotification(
  repoId: string,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const db = getFirestore();
    const messagesRef = db.collection('repos').doc(repoId).collection('messages');

    await messagesRef.add({
      sender: 'GitPulse AI',
      senderId: 'ai_assistant',
      avatarUrl: '/brain-circuit.svg',
      text: message,
      isSystemMessage: true,
      systemMessageType: 'webhook-notification',
      timestamp: serverTimestamp(),
      ...metadata
    });

    console.log('Posted chat notification:', message);
  } catch (error) {
    console.error('Error posting chat notification:', error);
    throw error;
  }
}

/**
 * Call MCP handle-review endpoint
 */
async function callMCPHandleReview(
  reviewData: {
    owner: string;
    repo: string;
    pr_number: number;
    jobId: string;
    review: {
      user: { login: string };
      state: string;
      body: string;
      submitted_at: string;
    };
  }
): Promise<void> {
  try {
    const mcpUrl = process.env.MCP_URL || 'https://requestaiforissue-kmz2rgbu4q-uc.a.run.app';
    const endpoint = `${mcpUrl}/api/mcp/handle-review`;

    console.log('Calling MCP handle-review endpoint:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MCP handle-review failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`MCP endpoint returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('MCP handle-review success:', result);
  } catch (error: any) {
    console.error('Error calling MCP handle-review:', error.message);
    throw error;
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle pull_request event with merged PR
 */
async function handlePullRequestMerged(payload: any): Promise<void> {
  const {
    pull_request: pr,
    repository: repo,
  } = payload;

  console.log('Processing merged PR:', {
    prNumber: pr.number,
    prTitle: pr.title,
    repo: repo.full_name,
    mergedBy: pr.merged_by?.login,
    mergeCommitSha: pr.merge_commit_sha
  });

  // Construct repoId (usually "owner/repo")
  const repoId = repo.full_name;

  // Find associated MCP job
  const jobInfo = await findMCPJobByPR(repoId, pr.number);

  if (!jobInfo) {
    console.log('No MCP job found for this PR, skipping updates');
    return;
  }

  const { jobId, jobData } = jobInfo;

  // Update MCP job status to 'merged'
  await updateMCPJobStatus(repoId, jobId, {
    status: 'merged',
    mergedBy: pr.merged_by?.login || 'unknown',
    mergedAt: pr.merged_at,
    mergeCommitSha: pr.merge_commit_sha,
  });

  // Get issue number and assignee from job data
  const issueNumber = jobData.issueNumber || jobData.issue_number || 'N/A';
  const assignee = jobData.assignee || pr.user?.login || 'unknown';

  // Post notification to chat
  const notificationMessage = `✅ **Issue #${issueNumber} resolved by AI under @${assignee}** — PR #${pr.number} merged by @${pr.merged_by?.login || 'unknown'}`;

  await postChatNotification(repoId, notificationMessage, {
    prNumber: pr.number,
    prUrl: pr.html_url,
    issueNumber,
    jobId,
    mergedBy: pr.merged_by?.login,
    mergeCommitSha: pr.merge_commit_sha,
    systemMessageType: 'pr-merged'
  });

  console.log('Successfully processed merged PR');
}

/**
 * Handle pull_request_review event with changes requested
 */
async function handlePullRequestReview(payload: any): Promise<void> {
  const {
    review,
    pull_request: pr,
    repository: repo,
  } = payload;

  console.log('Processing PR review:', {
    prNumber: pr.number,
    reviewer: review.user?.login,
    state: review.state,
    repo: repo.full_name
  });

  // Only handle "changes_requested" reviews
  if (review.state !== 'changes_requested') {
    console.log('Review state is not "changes_requested", skipping');
    return;
  }

  const repoId = repo.full_name;

  // Find associated MCP job
  const jobInfo = await findMCPJobByPR(repoId, pr.number);

  if (!jobInfo) {
    console.log('No MCP job found for this PR, skipping updates');
    return;
  }

  const { jobId, jobData } = jobInfo;

  // Check if reviewer is the assignee
  const assignee = jobData.assignee || pr.user?.login;
  const isAssigneeReview = review.user?.login === assignee;

  console.log('Review assignee check:', {
    reviewer: review.user?.login,
    assignee,
    isAssigneeReview
  });

  if (!isAssigneeReview) {
    console.log('Reviewer is not the assignee, skipping MCP update');
    return;
  }

  // Update MCP job status to 'update_requested'
  await updateMCPJobStatus(repoId, jobId, {
    status: 'update_requested',
    lastReview: {
      reviewer: review.user?.login,
      state: review.state,
      body: review.body,
      submitted_at: review.submitted_at,
      review_url: review.html_url
    }
  });

  // Call MCP endpoint to handle the review
  try {
    await callMCPHandleReview({
      owner: repo.owner.login,
      repo: repo.name,
      pr_number: pr.number,
      jobId,
      review: {
        user: { login: review.user?.login },
        state: review.state,
        body: review.body || '',
        submitted_at: review.submitted_at
      }
    });

    console.log('Successfully triggered MCP handle-review');
  } catch (error: any) {
    console.error('Failed to call MCP handle-review:', error.message);
    
    // Update job with error
    await updateMCPJobStatus(repoId, jobId, {
      status: 'update_failed',
      lastError: error.message
    });
  }
}

/**
 * Handle issues event (opened, closed, assigned, etc.)
 */
async function handleIssuesEvent(payload: any): Promise<void> {
  const {
    action,
    issue,
    repository: repo,
  } = payload;

  console.log('Processing issues event:', {
    action,
    issueNumber: issue.number,
    issueTitle: issue.title,
    repo: repo.full_name,
    state: issue.state
  });

  const repoId = repo.full_name;

  // Find associated MCP job
  const jobInfo = await findMCPJobByIssue(repoId, issue.number);

  // Handle different issue actions
  switch (action) {
    case 'closed':
      if (jobInfo) {
        await updateMCPJobStatus(repoId, jobInfo.jobId, {
          issueStatus: 'closed',
          issueClosed: true,
          issueClosedAt: issue.closed_at,
          issueClosedBy: issue.closed_by?.login || 'unknown'
        });

        // Only notify if closed without merging a PR
        if (!jobInfo.jobData.pr_number) {
          await postChatNotification(
            repoId,
            `🔒 Issue #${issue.number} "${issue.title}" was closed`,
            {
              issueNumber: issue.number,
              issueUrl: issue.html_url,
              jobId: jobInfo.jobId,
              systemMessageType: 'issue-closed'
            }
          );
        }
      }
      break;

    case 'reopened':
      if (jobInfo) {
        await updateMCPJobStatus(repoId, jobInfo.jobId, {
          issueStatus: 'open',
          issueClosed: false,
          issueReopenedAt: new Date().toISOString()
        });

        await postChatNotification(
          repoId,
          `🔓 Issue #${issue.number} "${issue.title}" was reopened`,
          {
            issueNumber: issue.number,
            issueUrl: issue.html_url,
            jobId: jobInfo.jobId,
            systemMessageType: 'issue-reopened'
          }
        );
      }
      break;

    case 'assigned':
      if (jobInfo) {
        const assignee = payload.assignee?.login;
        await updateMCPJobStatus(repoId, jobInfo.jobId, {
          assignee,
          assignedAt: new Date().toISOString()
        });

        await postChatNotification(
          repoId,
          `👤 Issue #${issue.number} assigned to @${assignee}`,
          {
            issueNumber: issue.number,
            issueUrl: issue.html_url,
            assignee,
            jobId: jobInfo.jobId,
            systemMessageType: 'issue-assigned'
          }
        );
      }
      break;

    case 'labeled':
      if (jobInfo) {
        const label = payload.label?.name;
        await updateMCPJobStatus(repoId, jobInfo.jobId, {
          labels: issue.labels.map((l: any) => l.name)
        });

        console.log(`Issue #${issue.number} labeled with "${label}"`);
      }
      break;

    default:
      console.log(`Issue action "${action}" not specifically handled`);
  }
}

/**
 * Handle push event
 */
async function handlePushEvent(payload: any): Promise<void> {
  const {
    ref,
    repository: repo,
    pusher,
    commits,
    head_commit,
  } = payload;

  const branch = ref.replace('refs/heads/', '');

  console.log('Processing push event:', {
    repo: repo.full_name,
    branch,
    pusher: pusher.name,
    commitsCount: commits.length,
    headCommit: head_commit?.id?.substring(0, 7)
  });

  const repoId = repo.full_name;

  // Check if any commits reference issues (e.g., "fixes #123", "closes #456")
  const issueReferences = new Set<number>();
  const issuePatterns = [
    /(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s+#(\d+)/gi,
    /#(\d+)/g
  ];

  commits.forEach((commit: any) => {
    const message = commit.message;
    issuePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        issueReferences.add(parseInt(match[1]));
      }
    });
  });

  // Update MCP jobs for referenced issues
  for (const issueNumber of issueReferences) {
    const jobInfo = await findMCPJobByIssue(repoId, issueNumber);
    if (jobInfo) {
      await updateMCPJobStatus(repoId, jobInfo.jobId, {
        lastPush: {
          branch,
          commitSha: head_commit?.id,
          commitMessage: head_commit?.message,
          pusher: pusher.name,
          timestamp: head_commit?.timestamp,
        }
      });

      console.log(`Updated MCP job for issue #${issueNumber} with push info`);
    }
  }

  // Notify for significant pushes (to main/master or with multiple commits)
  if (['main', 'master', 'develop'].includes(branch) && commits.length > 0) {
    const commitSummary = commits.length === 1
      ? `1 commit`
      : `${commits.length} commits`;

    await postChatNotification(
      repoId,
      `📝 ${commitSummary} pushed to **${branch}** by @${pusher.name}`,
      {
        branch,
        commitCount: commits.length,
        headCommit: head_commit?.id,
        pusher: pusher.name,
        systemMessageType: 'push-notification'
      }
    );
  }
}

// ============================================================================
// Main POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  console.log('📨 GitHub webhook received');

  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('GITHUB_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Get headers
    const signature = req.headers.get('x-hub-signature-256');
    const event = req.headers.get('x-github-event');
    const delivery = req.headers.get('x-github-delivery');

    console.log('Webhook debug info:', {
      event,
      delivery,
      hasSignature: !!signature,
      signatureLength: signature?.length || 0,
      webhookSecretConfigured: !!webhookSecret,
      webhookSecretLength: webhookSecret?.length || 0
    });

    // Get raw body for signature verification
    const rawBody = await req.text();
    
    console.log('Request body info:', {
      bodyLength: rawBody.length,
      bodyPreview: rawBody.substring(0, 100)
    });

    // Verify signature
    const isValid = verifyGitHubSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error('❌ GitHub signature verification failed', {
        receivedSignature: signature,
        bodyLength: rawBody.length,
        secretLength: webhookSecret.length
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    console.log('✅ GitHub signature verified');

    // Parse payload
    const payload = JSON.parse(rawBody);

    // Route to appropriate handler based on event type
    switch (event) {
      case 'pull_request':
        if (payload.action === 'closed' && payload.pull_request?.merged === true) {
          await handlePullRequestMerged(payload);
          return NextResponse.json({ 
            success: true, 
            message: 'Pull request merged event processed' 
          });
        } else {
          console.log('Pull request event ignored:', {
            action: payload.action,
            merged: payload.pull_request?.merged
          });
          return NextResponse.json({ 
            success: true, 
            message: 'Event ignored (not a merged PR)' 
          });
        }

      case 'pull_request_review':
        if (payload.action === 'submitted' && payload.review?.state === 'changes_requested') {
          await handlePullRequestReview(payload);
          return NextResponse.json({ 
            success: true, 
            message: 'Pull request review processed' 
          });
        } else {
          console.log('Pull request review ignored:', {
            action: payload.action,
            state: payload.review?.state
          });
          return NextResponse.json({ 
            success: true, 
            message: 'Event ignored (not changes_requested review)' 
          });
        }

      case 'issues':
        await handleIssuesEvent(payload);
        return NextResponse.json({ 
          success: true, 
          message: `Issues event (${payload.action}) processed` 
        });

      case 'push':
        await handlePushEvent(payload);
        return NextResponse.json({ 
          success: true, 
          message: 'Push event processed' 
        });

      case 'ping':
        console.log('Ping event received');
        return NextResponse.json({ 
          success: true, 
          message: 'Pong! Webhook is configured correctly',
          zen: payload.zen
        });

      default:
        console.log('Unhandled event type:', event);
        return NextResponse.json({ 
          success: true, 
          message: `Event type "${event}" not handled` 
        });
    }

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

// Verify that this is a POST-only endpoint
export async function GET() {
  return NextResponse.json({ 
    message: 'GitHub webhook endpoint is active',
    method: 'POST',
    note: 'This endpoint accepts POST requests from GitHub webhooks'
  });
}
