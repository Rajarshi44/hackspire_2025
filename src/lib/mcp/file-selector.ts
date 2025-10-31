import { aiAnalyzeRepository } from '@/ai/flows/ai-analyze-repository';
import { getFileContent } from '@/lib/mcp/github-client';

// ============================================================================
// Configuration
// ============================================================================

const FILE_EXTENSIONS_PATTERN = /\.(tsx?|jsx?|json|ya?ml|md|css|scss|less)$/i;
const DEFAULT_MAX_FILES = 10;

// ============================================================================
// File Selection Logic
// ============================================================================

/**
 * Extract potential file paths from issue body using keywords
 */
function extractFilePathsFromText(text: string): string[] {
  const filePaths: string[] = [];
  
  // Match file paths with extensions
  const filePathRegex = /[\w/-]+\.(tsx?|jsx?|json|ya?ml|md|css|scss|less)/gi;
  const matches = text.match(filePathRegex);
  
  if (matches) {
    filePaths.push(...matches.map(m => m.trim()));
  }
  
  // Match code blocks that might contain file references
  const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
  let codeMatch;
  
  while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
    const codeContent = codeMatch[1];
    const codeFilePaths = codeContent.match(filePathRegex);
    
    if (codeFilePaths) {
      filePaths.push(...codeFilePaths.map(m => m.trim()));
    }
  }
  
  return [...new Set(filePaths)]; // Remove duplicates
}

/**
 * Use AI to analyze repository and select relevant files
 */
async function selectFilesWithAI(
  owner: string,
  repo: string,
  githubToken: string,
  issueBody: string
): Promise<string[]> {
  try {
    console.log('🤖 Using AI to select relevant files...');
    
    // Call existing AI analyze repository flow
    const analysis = await aiAnalyzeRepository({
      repoOwner: owner,
      repoName: repo,
      accessToken: githubToken,
    });
    
    // Extract file paths from the file tree
    const allFiles = analysis.fileTree.map(f => f.path);
    
    // Filter for relevant source files (not node_modules, dist, etc.)
    const sourceFiles = allFiles.filter(path => {
      // Skip common ignore patterns
      if (
        path.includes('node_modules/') ||
        path.includes('dist/') ||
        path.includes('build/') ||
        path.includes('.next/') ||
        path.includes('coverage/') ||
        path.includes('.git/')
      ) {
        return false;
      }
      
      // Include files with relevant extensions
      return FILE_EXTENSIONS_PATTERN.test(path);
    });
    
    // Try to match files based on keywords in issue body
    const keywords = issueBody.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    const scoredFiles = sourceFiles.map(path => {
      const lowerPath = path.toLowerCase();
      let score = 0;
      
      // Score based on keyword matches
      keywords.forEach(keyword => {
        if (lowerPath.includes(keyword)) {
          score += 2;
        }
      });
      
      // Prefer certain file types
      if (path.match(/\.(tsx?|jsx?)$/)) {
        score += 1;
      }
      
      // Prefer files in src or app directories
      if (path.startsWith('src/') || path.startsWith('app/')) {
        score += 1;
      }
      
      return { path, score };
    });
    
    // Sort by score and take top files
    const topFiles = scoredFiles
      .sort((a, b) => b.score - a.score)
      .slice(0, DEFAULT_MAX_FILES)
      .map(f => f.path);
    
    console.log(`✅ AI selected ${topFiles.length} file(s):`, topFiles);
    
    return topFiles;
  } catch (error) {
    console.error('AI file selection failed:', error);
    throw error;
  }
}

/**
 * Fallback: Use keyword matching to find relevant files
 */
function selectFilesWithKeywords(
  owner: string,
  repo: string,
  issueBody: string
): string[] {
  console.log('🔍 Using keyword matching for file selection (fallback)...');
  
  // Extract file paths mentioned in the issue
  const files = extractFilePathsFromText(issueBody);
  
  if (files.length === 0) {
    console.warn('⚠️ No files found in issue body. Cannot select files automatically.');
  } else {
    console.log(`✅ Found ${files.length} file(s) mentioned in issue:`, files);
  }
  
  return files;
}

/**
 * Verify that selected files exist in the repository
 */
async function verifyFilesExist(
  owner: string,
  repo: string,
  githubToken: string,
  files: string[]
): Promise<string[]> {
  const validFiles: string[] = [];
  
  for (const file of files) {
    try {
      await getFileContent(owner, repo, file);
      validFiles.push(file);
    } catch (error) {
      console.warn(`⚠️ File not found or inaccessible: ${file}`);
    }
  }
  
  return validFiles;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Select related files for code generation
 * 
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param githubToken - GitHub access token
 * @param issueBody - Issue description text
 * @param relatedFiles - Optional pre-selected files
 * @returns Array of file paths to analyze
 */
export async function selectRelatedFiles(
  owner: string,
  repo: string,
  githubToken: string,
  issueBody: string,
  relatedFiles?: string[]
): Promise<string[]> {
  // If files are provided, use them directly
  if (relatedFiles && relatedFiles.length > 0) {
    console.log(`✅ Using ${relatedFiles.length} provided file(s):`, relatedFiles);
    
    // Verify files exist
    const validFiles = await verifyFilesExist(owner, repo, githubToken, relatedFiles);
    
    if (validFiles.length === 0) {
      throw new Error('None of the provided files exist in the repository.');
    }
    
    if (validFiles.length < relatedFiles.length) {
      console.warn(`⚠️ Some provided files were not found. Using ${validFiles.length} valid file(s).`);
    }
    
    return validFiles;
  }
  
  // Try AI-based selection first
  try {
    const aiSelectedFiles = await selectFilesWithAI(owner, repo, githubToken, issueBody);
    
    if (aiSelectedFiles.length > 0) {
      return aiSelectedFiles;
    }
  } catch (error) {
    console.warn('AI file selection failed, falling back to keyword matching:', error);
  }
  
  // Fallback to keyword matching
  const keywordFiles = selectFilesWithKeywords(owner, repo, issueBody);
  
  if (keywordFiles.length > 0) {
    // Verify files exist
    const validFiles = await verifyFilesExist(owner, repo, githubToken, keywordFiles);
    return validFiles;
  }
  
  // If all else fails, return empty array (caller should handle this)
  throw new Error(
    'Could not automatically select relevant files. ' +
    'Please provide specific files in the related_files parameter.'
  );
}
