import { MCPGenerateCodeRequest, NotAssigneeError, ValidationError, MCPLog, MCPJob } from '@/types/mcp';
import {
  fetchIssueWithAssignees,
  getDefaultBranch,
  getBranchSHA,
  createBranch,
  getFileContent,
  createGitTree,
  createCommit,
  updateRef,
  createDraftPR,
  postIssueComment,
} from '@/lib/mcp/github-client';
import { selectRelatedFiles } from '@/lib/mcp/file-selector';
import { chunkFileContent } from '@/lib/mcp/file-chunker';
import { validateGeneratedCode } from '@/lib/mcp/code-validator';
import { aiGeneratesCodeDiff } from '@/ai/flows/ai-generates-code-diff';
import { getFirestore, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

// ============================================================================
// Configuration
// ============================================================================

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable is not set');
}

// ============================================================================
// Firestore Helpers
// ============================================================================

/**
 * Get Firestore instance
 */
function getFirestoreInstance() {
  const { firestore } = initializeFirebase();
  return firestore;
}

/**
 * Encode repository full name for Firestore
 */
function encodeRepoId(owner: string, repo: string): string {
  return encodeURIComponent(`${owner}/${repo}`);
}

/**
 * Log MCP operation to Firestore
 */
async function logMCPOperation(
  owner: string,
  repo: string,
  log: MCPLog
): Promise<void> {
  const firestore = getFirestoreInstance();
  const repoId = encodeRepoId(owner, repo);
  const logId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const logRef = doc(firestore, 'repos', repoId, 'mcp_logs', logId);
  
  await setDoc(logRef, {
    ...log,
    timestamp: log.timestamp || Date.now(),
  });
}

/**
 * Update MCP job status in Firestore
 */
async function updateMCPJob(
  owner: string,
  repo: string,
  jobId: string,
  updates: Partial<MCPJob>
): Promise<void> {
  const firestore = getFirestoreInstance();
  const repoId = encodeRepoId(owner, repo);
  
  const jobRef = doc(firestore, 'repos', repoId, 'mcp_jobs', jobId);
  
  await updateDoc(jobRef, {
    ...updates,
    updated_at: Date.now(),
  });
}

// ============================================================================
// Main Service Function
// ============================================================================

export interface CodeGenerationResult {
  success: true;
  jobId: string;
  pr_url: string;
  pr_number: number;
  branch: string;
}

/**
 * Execute the complete MCP code generation workflow
 */
export async function executeCodeGeneration(
  request: MCPGenerateCodeRequest
): Promise<CodeGenerationResult> {
  const { owner, repo, issue_number, jobId, requested_by, related_files } = request;
  
  console.log(`🚀 Starting MCP code generation for ${owner}/${repo}#${issue_number}`);
  
  if (!GITHUB_TOKEN) {
    throw new Error('GitHub token not configured. Set GITHUB_TOKEN environment variable.');
  }
  
  try {
    // ========================================================================
    // Step 1: Fetch issue and verify assignee
    // ========================================================================
    console.log('📋 Fetching issue details...');
    const issue = await fetchIssueWithAssignees(owner, repo, issue_number);
    
    console.log(`✅ Issue: ${issue.title}`);
    console.log(`   Assignees: ${issue.assignees.map(a => a.login).join(', ') || 'none'}`);
    
    // Check if requested_by is an assignee
    const isAssignee = issue.assignees.some(assignee => assignee.login === requested_by);
    
    if (!isAssignee) {
      const assigneeLogins = issue.assignees.map(a => a.login);
      
      // Log to Firestore
      await logMCPOperation(owner, repo, {
        message: 'not-assignee',
        requested_by,
        timestamp: Date.now(),
        issue_number,
        error: `User ${requested_by} is not assigned to issue #${issue_number}`,
      });
      
      throw new NotAssigneeError(requested_by, assigneeLogins);
    }
    
    console.log(`✅ User ${requested_by} is assigned to this issue`);
    
    // ========================================================================
    // Step 2: Create branch
    // ========================================================================
    console.log('🌿 Creating branch...');
    const defaultBranch = await getDefaultBranch(owner, repo);
    const baseSHA = await getBranchSHA(owner, repo, defaultBranch);
    
    const timestamp = Date.now();
    const branchName = `gitpulse/issue-${issue_number}/draft-${timestamp}`;
    
    await createBranch(owner, repo, branchName, baseSHA);
    console.log(`✅ Created branch: ${branchName}`);
    
    // ========================================================================
    // Step 3: Select and fetch files
    // ========================================================================
    console.log('📁 Selecting relevant files...');
    const selectedFiles = await selectRelatedFiles(
      owner,
      repo,
      GITHUB_TOKEN,
      issue.body || '',
      related_files
    );
    
    console.log(`✅ Selected ${selectedFiles.length} file(s):`, selectedFiles);
    
    // Fetch file contents
    console.log('📥 Fetching file contents...');
    const filesWithContent = await Promise.all(
      selectedFiles.map(async (filePath) => {
        const fileData = await getFileContent(owner, repo, filePath, defaultBranch);
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        return { path: filePath, content };
      })
    );
    
    // ========================================================================
    // Step 4: Chunk files
    // ========================================================================
    console.log('✂️ Chunking files...');
    const filesWithChunks = filesWithContent.map(file => ({
      path: file.path,
      chunks: chunkFileContent(file.content),
    }));
    
    const totalChunks = filesWithChunks.reduce((sum, f) => sum + f.chunks.length, 0);
    console.log(`✅ Created ${totalChunks} chunk(s) from ${filesWithContent.length} file(s)`);
    
    // ========================================================================
    // Step 5: Generate code with AI
    // ========================================================================
    console.log('🤖 Generating code fixes with AI...');
    const aiResult = await aiGeneratesCodeDiff({
      issueTitle: issue.title,
      issueBody: issue.body || '',
      files: filesWithChunks,
    });
    
    console.log(`✅ AI generated ${aiResult.changes.length} file change(s)`);
    console.log(`   Summary: ${aiResult.overallSummary}`);
    
    // ========================================================================
    // Step 6: Validate generated code
    // ========================================================================
    console.log('🔍 Validating generated code...');
    const validationResult = await validateGeneratedCode(
      aiResult.changes.map(change => ({
        path: change.path,
        content: change.content,
      })),
      jobId
    );
    
    if (!validationResult.valid) {
      console.error('❌ Validation failed:', validationResult.errors);
      
      // Post comment on issue about validation failure
      const errorComment = `⚠️ **AI Code Generation Failed - Validation Errors**\n\n` +
        `The AI-generated code for this issue failed TypeScript validation:\n\n` +
        validationResult.errors.map(err => `- ${err}`).join('\n') +
        `\n\nPlease review the issue requirements and try again.`;
      
      await postIssueComment(owner, repo, issue_number, errorComment);
      
      throw new ValidationError(validationResult.errors);
    }
    
    console.log('✅ Validation passed');
    
    // ========================================================================
    // Step 7: Commit changes atomically via Tree API
    // ========================================================================
    console.log('💾 Committing changes...');
    
    // Get the base tree SHA from the branch
    const branchSHA = await getBranchSHA(owner, repo, branchName);
    
    // Create tree with all file changes
    const tree = await createGitTree(
      owner,
      repo,
      branchSHA,
      aiResult.changes.map(change => ({
        path: change.path,
        mode: '100644',
        type: 'blob' as const,
        content: change.content,
      }))
    );
    
    // Create commit
    const commit = await createCommit(
      owner,
      repo,
      `AI: auto-generated fix for issue #${issue_number}\n\n${aiResult.overallSummary}`,
      tree.sha,
      branchSHA
    );
    
    // Update branch reference
    await updateRef(owner, repo, branchName, commit.sha);
    
    console.log(`✅ Committed ${aiResult.changes.length} file(s) to ${branchName}`);
    
    // ========================================================================
    // Step 8: Create draft PR
    // ========================================================================
    console.log('📝 Creating draft pull request...');
    
    const prTitle = `AI: Fix for #${issue_number} - ${issue.title}`;
    const prBody = `## 🤖 AI-Generated Fix\n\n` +
      `This PR was automatically generated by the MCP agent to address issue #${issue_number}.\n\n` +
      `### Changes Summary\n${aiResult.overallSummary}\n\n` +
      `### Files Modified\n` +
      aiResult.changes.map(change => `- \`${change.path}\`: ${change.summary || 'Updated'}`).join('\n') +
      `\n\n### ⚠️ Review Required\n` +
      `This code was generated by AI and requires human review before merging.\n` +
      `Please verify:\n` +
      `- ✅ Logic is correct\n` +
      `- ✅ Edge cases are handled\n` +
      `- ✅ Tests pass\n` +
      `- ✅ Code follows project conventions\n\n` +
      `Closes #${issue_number}`;
    
    const pr = await createDraftPR(
      owner,
      repo,
      prTitle,
      prBody,
      branchName,
      defaultBranch,
      ['ai-generated', 'needs-review']
    );
    
    console.log(`✅ Created draft PR: ${pr.html_url}`);
    
    // ========================================================================
    // Step 9: Update Firestore job
    // ========================================================================
    console.log('📊 Updating job status...');
    await updateMCPJob(owner, repo, jobId, {
      status: 'review',
      pr_url: pr.html_url,
      pr_number: pr.number,
      branch: branchName,
      validated: true,
    });
    
    // ========================================================================
    // Step 10: Post comment on issue
    // ========================================================================
    console.log('💬 Posting comment on issue...');
    
    const issueComment = `🤖 **AI Code Generation Complete**\n\n` +
      `@${requested_by} A draft pull request has been created with AI-generated fixes for this issue.\n\n` +
      `📝 **Pull Request**: ${pr.html_url}\n` +
      `🌿 **Branch**: \`${branchName}\`\n\n` +
      `### Changes Summary\n${aiResult.overallSummary}\n\n` +
      `⚠️ **Please review the changes carefully before merging.**`;
    
    await postIssueComment(owner, repo, issue_number, issueComment);
    
    console.log('✅ Posted comment on issue');
    
    // ========================================================================
    // Done!
    // ========================================================================
    console.log(`🎉 MCP code generation completed successfully!`);
    
    return {
      success: true,
      jobId,
      pr_url: pr.html_url,
      pr_number: pr.number,
      branch: branchName,
    };
  } catch (error: any) {
    console.error('❌ MCP code generation failed:', error);
    
    // Update job status to failed
    try {
      await updateMCPJob(owner, repo, jobId, {
        status: 'failed',
        error: error.message || 'Unknown error',
      });
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
    
    // Re-throw the error to be handled by the API route
    throw error;
  }
}
