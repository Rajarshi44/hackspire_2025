/**
 * Patch Utils Module
 * 
 * Provides utilities for parsing unified diff strings and applying patches to GitHub repositories.
 * 
 * Features:
 * - Parse unified diff format (git diff output)
 * - Extract file changes (additions, modifications)
 * - Apply patches to GitHub repositories
 * - Content size limiting to prevent huge uploads
 * - Batch file commits with error handling
 */

const { createOrUpdateFile } = require('../src/lib/mcp/github-tools');

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 2000; // Maximum characters per file content
const DIFF_FILE_HEADER = /^diff --git a\/(.*?) b\/(.*?)$/;
const FILE_MODE_NEW = /^new file mode \d+$/;
const FILE_MODE_DELETED = /^deleted file mode \d+$/;
const INDEX_LINE = /^index [a-f0-9]+\.\.[a-f0-9]+/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const BINARY_FILE = /^Binary files? /;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate content to maximum size with ellipsis indicator
 * 
 * @param {string} content - File content to truncate
 * @param {number} maxSize - Maximum size in characters (default: 2000)
 * @returns {string} Truncated content
 */
function truncateContent(content, maxSize = MAX_FILE_SIZE) {
  if (!content || content.length <= maxSize) {
    return content;
  }
  
  const truncated = content.substring(0, maxSize);
  const lastNewline = truncated.lastIndexOf('\n');
  
  // Try to truncate at a line boundary for cleaner output
  if (lastNewline > maxSize * 0.8) {
    return truncated.substring(0, lastNewline) + '\n\n... (truncated)';
  }
  
  return truncated + '\n\n... (truncated)';
}

/**
 * Apply a hunk to original content lines
 * 
 * @param {string[]} originalLines - Original file lines
 * @param {object} hunk - Hunk object with oldStart, newStart, and changes
 * @returns {string[]} Modified lines
 */
function applyHunk(originalLines, hunk) {
  const result = [];
  let originalIndex = 0;
  let hunkOldLine = hunk.oldStart - 1; // Convert to 0-based index
  
  // Copy lines before the hunk
  while (originalIndex < hunkOldLine && originalIndex < originalLines.length) {
    result.push(originalLines[originalIndex]);
    originalIndex++;
  }
  
  // Apply hunk changes
  for (const change of hunk.changes) {
    if (change.type === 'add') {
      result.push(change.content);
    } else if (change.type === 'remove') {
      originalIndex++; // Skip the removed line
    } else if (change.type === 'context') {
      result.push(change.content);
      originalIndex++;
    }
  }
  
  // Copy remaining lines after the hunk
  while (originalIndex < originalLines.length) {
    result.push(originalLines[originalIndex]);
    originalIndex++;
  }
  
  return result;
}

/**
 * Parse a single file's diff
 * 
 * @param {string[]} diffLines - Lines of the diff for a single file
 * @returns {object|null} Parsed file change object or null if invalid
 */
function parseFileDiff(diffLines) {
  if (diffLines.length === 0) return null;
  
  const file = {
    path: null,
    isNew: false,
    isDeleted: false,
    isBinary: false,
    hunks: [],
  };
  
  let currentHunk = null;
  let i = 0;
  
  // Parse header lines
  while (i < diffLines.length) {
    const line = diffLines[i];
    
    // Extract file path from diff header
    const diffMatch = line.match(DIFF_FILE_HEADER);
    if (diffMatch) {
      file.path = diffMatch[2]; // Use the b/ path (new file path)
      i++;
      continue;
    }
    
    // Check for new file
    if (FILE_MODE_NEW.test(line)) {
      file.isNew = true;
      i++;
      continue;
    }
    
    // Check for deleted file
    if (FILE_MODE_DELETED.test(line)) {
      file.isDeleted = true;
      i++;
      continue;
    }
    
    // Check for binary file
    if (BINARY_FILE.test(line)) {
      file.isBinary = true;
      i++;
      continue;
    }
    
    // Skip index lines
    if (INDEX_LINE.test(line)) {
      i++;
      continue;
    }
    
    // Skip --- and +++ lines
    if (line.startsWith('---') || line.startsWith('+++')) {
      i++;
      continue;
    }
    
    // Parse hunk header
    const hunkMatch = line.match(HUNK_HEADER);
    if (hunkMatch) {
      // Save previous hunk if exists
      if (currentHunk) {
        file.hunks.push(currentHunk);
      }
      
      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: parseInt(hunkMatch[3], 10),
        newLines: parseInt(hunkMatch[4] || '1', 10),
        changes: [],
      };
      i++;
      continue;
    }
    
    // Parse hunk content
    if (currentHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.changes.push({
          type: 'add',
          content: line.substring(1),
        });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.changes.push({
          type: 'remove',
          content: line.substring(1),
        });
      } else if (line.startsWith(' ')) {
        currentHunk.changes.push({
          type: 'context',
          content: line.substring(1),
        });
      }
    }
    
    i++;
  }
  
  // Save last hunk
  if (currentHunk) {
    file.hunks.push(currentHunk);
  }
  
  return file.path ? file : null;
}

/**
 * Reconstruct full file content from hunks
 * 
 * @param {object} fileDiff - Parsed file diff object
 * @param {string} originalContent - Original file content (empty string for new files)
 * @returns {string} New file content
 */
function reconstructFileContent(fileDiff, originalContent = '') {
  if (fileDiff.isDeleted) {
    return null; // Deleted files should not be recreated
  }
  
  if (fileDiff.isBinary) {
    console.warn(`⚠️ Binary file detected: ${fileDiff.path}. Skipping.`);
    return null;
  }
  
  // For new files with no original content, build from hunks
  if (fileDiff.isNew && !originalContent) {
    const lines = [];
    for (const hunk of fileDiff.hunks) {
      for (const change of hunk.changes) {
        if (change.type === 'add' || change.type === 'context') {
          lines.push(change.content);
        }
      }
    }
    return lines.join('\n');
  }
  
  // For modified files, apply hunks sequentially
  let lines = originalContent.split('\n');
  
  for (const hunk of fileDiff.hunks) {
    lines = applyHunk(lines, hunk);
  }
  
  return lines.join('\n');
}

// ============================================================================
// Main Exported Functions
// ============================================================================

/**
 * Parse a unified diff string and extract file changes
 * 
 * @param {string} diffString - Unified diff string (output from git diff)
 * @returns {Array<{path: string, newContent: string}>} Array of file changes
 * 
 * @example
 * const diff = `
 * diff --git a/file.js b/file.js
 * index abc123..def456 100644
 * --- a/file.js
 * +++ b/file.js
 * @@ -1,3 +1,4 @@
 *  line 1
 * +line 2 added
 *  line 3
 * `;
 * 
 * const changes = applyUnifiedDiff(diff);
 * // [{ path: 'file.js', newContent: 'line 1\nline 2 added\nline 3' }]
 */
function applyUnifiedDiff(diffString) {
  if (!diffString || typeof diffString !== 'string') {
    throw new Error('diffString must be a non-empty string');
  }
  
  const lines = diffString.split('\n');
  const files = [];
  const fileChanges = [];
  
  // Split diff into individual file diffs
  let currentFileDiff = [];
  
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentFileDiff.length > 0) {
        files.push(currentFileDiff);
      }
      currentFileDiff = [line];
    } else if (currentFileDiff.length > 0) {
      currentFileDiff.push(line);
    }
  }
  
  // Don't forget the last file
  if (currentFileDiff.length > 0) {
    files.push(currentFileDiff);
  }
  
  // Parse each file diff
  for (const fileDiffLines of files) {
    const fileDiff = parseFileDiff(fileDiffLines);
    
    if (!fileDiff || !fileDiff.path) {
      continue;
    }
    
    // Skip deleted files
    if (fileDiff.isDeleted) {
      console.log(`⏭️  Skipping deleted file: ${fileDiff.path}`);
      continue;
    }
    
    // Skip binary files
    if (fileDiff.isBinary) {
      console.log(`⏭️  Skipping binary file: ${fileDiff.path}`);
      continue;
    }
    
    // Reconstruct file content
    const newContent = reconstructFileContent(fileDiff);
    
    if (newContent !== null) {
      const truncatedContent = truncateContent(newContent);
      
      fileChanges.push({
        path: fileDiff.path,
        newContent: truncatedContent,
        isNew: fileDiff.isNew,
        isTruncated: truncatedContent.length < newContent.length,
        originalSize: newContent.length,
        truncatedSize: truncatedContent.length,
      });
    }
  }
  
  return fileChanges;
}

/**
 * Apply a patch (diff) to a GitHub repository
 * 
 * Parses the diff string and commits each changed file to the specified branch
 * using the GitHub API.
 * 
 * @param {object} options - Patch options
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @param {string} options.branch - Target branch name
 * @param {string} options.diffString - Unified diff string
 * @param {string} [options.commitMessage] - Optional commit message template
 * @returns {Promise<Array<{path: string, success: boolean, error?: string}>>} Results for each file
 * 
 * @example
 * const results = await applyPatchToRepo({
 *   owner: 'Rajarshi44',
 *   repo: 'hackspire_2025',
 *   branch: 'feature/new-feature',
 *   diffString: gitDiffOutput,
 *   commitMessage: 'Apply automated fixes',
 * });
 */
async function applyPatchToRepo({ owner, repo, branch, diffString, commitMessage = 'Apply patch' }) {
  if (!owner || !repo || !branch || !diffString) {
    throw new Error('owner, repo, branch, and diffString are required parameters');
  }
  
  console.log(`\n🔧 Applying patch to ${owner}/${repo} on branch ${branch}...\n`);
  
  // Parse the diff
  const fileChanges = applyUnifiedDiff(diffString);
  
  if (fileChanges.length === 0) {
    console.log('ℹ️  No file changes detected in diff');
    return [];
  }
  
  console.log(`📝 Found ${fileChanges.length} file(s) to update:\n`);
  fileChanges.forEach((file, index) => {
    const sizeInfo = file.isTruncated 
      ? ` (truncated from ${file.originalSize} to ${file.truncatedSize} chars)`
      : '';
    const newFlag = file.isNew ? ' [NEW]' : '';
    console.log(`   ${index + 1}. ${file.path}${newFlag}${sizeInfo}`);
  });
  console.log('');
  
  // Apply each file change
  const results = [];
  
  for (let i = 0; i < fileChanges.length; i++) {
    const file = fileChanges[i];
    const fileCommitMessage = `${commitMessage}: ${file.path}`;
    
    try {
      console.log(`📤 [${i + 1}/${fileChanges.length}] Committing ${file.path}...`);
      
      await createOrUpdateFile({
        owner,
        repo,
        path: file.path,
        content: file.newContent,
        branch,
        commitMessage: fileCommitMessage,
      });
      
      console.log(`   ✅ Success`);
      
      results.push({
        path: file.path,
        success: true,
        isNew: file.isNew,
        isTruncated: file.isTruncated,
      });
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      
      results.push({
        path: file.path,
        success: false,
        error: error.message,
        statusCode: error.statusCode || null,
      });
    }
  }
  
  // Summary
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 PATCH SUMMARY:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📁 Total files: ${results.length}`);
  console.log('='.repeat(60) + '\n');
  
  return results;
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  applyUnifiedDiff,
  applyPatchToRepo,
  truncateContent,
  
  // Export for testing purposes
  __internal: {
    parseFileDiff,
    reconstructFileContent,
    applyHunk,
  },
};
