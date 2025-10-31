import { FileChunk } from '@/types/mcp';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MAX_LINES = 700;

// Regex patterns to detect boundaries
const FUNCTION_PATTERNS = [
  /^\s*(export\s+)?(async\s+)?function\s+\w+/,
  /^\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/,
  /^\s*(export\s+)?const\s+\w+\s*=\s*(async\s+)?function/,
];

const CLASS_PATTERNS = [
  /^\s*(export\s+)?(abstract\s+)?class\s+\w+/,
  /^\s*(export\s+)?interface\s+\w+/,
  /^\s*(export\s+)?type\s+\w+/,
  /^\s*(export\s+)?enum\s+\w+/,
];

const IMPORT_PATTERN = /^\s*import\s+/;
const EXPORT_PATTERN = /^\s*export\s+[*{]/;

// ============================================================================
// File Chunking Logic
// ============================================================================

/**
 * Check if a line matches any boundary pattern
 */
function isBoundaryLine(line: string): boolean {
  return (
    FUNCTION_PATTERNS.some(pattern => pattern.test(line)) ||
    CLASS_PATTERNS.some(pattern => pattern.test(line))
  );
}

/**
 * Check if a line is an import or export statement
 */
function isImportOrExport(line: string): boolean {
  return IMPORT_PATTERN.test(line) || EXPORT_PATTERN.test(line);
}

/**
 * Extract imports and top-level exports from the beginning of the file
 */
function extractContext(lines: string[]): { context: string; contextEndLine: number } {
  const contextLines: string[] = [];
  let contextEndLine = 0;

  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments at the start
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      contextLines.push(line);
      contextEndLine = i + 1;
      continue;
    }

    // Include imports and exports
    if (isImportOrExport(line)) {
      contextLines.push(line);
      contextEndLine = i + 1;
      continue;
    }

    // Stop when we hit the first non-import/export code
    break;
  }

  return {
    context: contextLines.join('\n'),
    contextEndLine,
  };
}

/**
 * Find logical chunk boundaries based on functions, classes, etc.
 */
function findChunkBoundaries(lines: string[], startLine: number, maxLines: number): number[] {
  const boundaries: number[] = [startLine];
  let currentLine = startLine;

  while (currentLine < lines.length) {
    // Look ahead for the next boundary within maxLines
    let nextBoundary = currentLine + maxLines;
    let foundBoundary = false;

    // Search backwards from maxLines to find a good breaking point
    for (let i = Math.min(nextBoundary, lines.length - 1); i > currentLine + Math.floor(maxLines / 2); i--) {
      if (isBoundaryLine(lines[i])) {
        nextBoundary = i;
        foundBoundary = true;
        break;
      }
    }

    // If no boundary found, just use maxLines (hard limit)
    if (!foundBoundary) {
      nextBoundary = Math.min(currentLine + maxLines, lines.length);
    }

    boundaries.push(nextBoundary);
    currentLine = nextBoundary;

    // Stop if we've reached the end
    if (currentLine >= lines.length) {
      break;
    }
  }

  return boundaries;
}

/**
 * Chunk file content intelligently by function/class boundaries
 * 
 * @param content - The complete file content
 * @param maxLines - Maximum lines per chunk (default 700)
 * @returns Array of file chunks with context preserved
 */
export function chunkFileContent(
  content: string,
  maxLines: number = DEFAULT_MAX_LINES
): FileChunk[] {
  const lines = content.split('\n');

  // For small files, return as single chunk
  if (lines.length <= maxLines) {
    return [{
      snippet: content,
      startLine: 1,
      endLine: lines.length,
      context: undefined,
    }];
  }

  // Extract imports and context from file header
  const { context, contextEndLine } = extractContext(lines);

  // Find chunk boundaries starting after context
  const boundaries = findChunkBoundaries(lines, contextEndLine, maxLines);

  // Create chunks with context prepended
  const chunks: FileChunk[] = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const startLine = boundaries[i];
    const endLine = boundaries[i + 1];
    const chunkLines = lines.slice(startLine, endLine);

    // Prepend context to each chunk (except if it's the first chunk which already has it)
    const snippet = startLine === contextEndLine
      ? chunkLines.join('\n')
      : `${context}\n\n// ... (lines ${contextEndLine + 1}-${startLine} omitted) ...\n\n${chunkLines.join('\n')}`;

    chunks.push({
      snippet,
      startLine: startLine + 1, // Convert to 1-based indexing
      endLine: endLine, // endLine is exclusive in slice, so it's correct
      context: startLine === contextEndLine ? undefined : context,
    });
  }

  return chunks;
}

/**
 * Get a preview of how a file would be chunked (for debugging)
 */
export function previewChunking(
  content: string,
  maxLines: number = DEFAULT_MAX_LINES
): string {
  const chunks = chunkFileContent(content, maxLines);
  
  let preview = `File would be split into ${chunks.length} chunk(s):\n\n`;
  
  chunks.forEach((chunk, index) => {
    preview += `Chunk ${index + 1}:\n`;
    preview += `  Lines: ${chunk.startLine}-${chunk.endLine}\n`;
    preview += `  Length: ${chunk.snippet.split('\n').length} lines\n`;
    preview += `  Has context: ${chunk.context ? 'Yes' : 'No'}\n`;
    preview += `  Preview: ${chunk.snippet.split('\n').slice(0, 3).join('\n')}\n`;
    preview += `  ...\n\n`;
  });
  
  return preview;
}

/**
 * Calculate total token estimate for chunked content
 * (Rough estimate: ~4 characters per token)
 */
export function estimateTokens(chunks: FileChunk[]): number {
  const totalChars = chunks.reduce((sum, chunk) => sum + chunk.snippet.length, 0);
  return Math.ceil(totalChars / 4);
}
