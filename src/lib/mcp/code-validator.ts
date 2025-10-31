import { ValidationResult } from '@/types/mcp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

const TEMP_BASE_DIR = process.env.TEMP || process.env.TMP || '/tmp';
const CLEANUP_DELAY_MS = 24 * 60 * 60 * 1000; // 24 hours
const VALIDATION_TIMEOUT_MS = 60000; // 60 seconds

// ============================================================================
// Temp Directory Management
// ============================================================================

/**
 * Create a unique temp directory for validation
 */
async function createTempDir(jobId: string, failed: boolean = false): Promise<string> {
  const suffix = failed ? '-failed' : '';
  const tempDir = path.join(TEMP_BASE_DIR, `mcp-job-${jobId}${suffix}`);
  
  await fs.mkdir(tempDir, { recursive: true });
  
  return tempDir;
}

/**
 * Schedule cleanup of temp directory
 */
function scheduleCleanup(tempDir: string, delayMs: number): void {
  setTimeout(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up temp directory: ${tempDir}`);
    } catch (error) {
      console.error(`Failed to cleanup temp directory ${tempDir}:`, error);
    }
  }, delayMs);
}

/**
 * Write files to temp directory
 */
async function writeFilesToTemp(
  tempDir: string,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  for (const file of files) {
    const filePath = path.join(tempDir, file.path);
    const fileDir = path.dirname(filePath);
    
    // Create directory if needed
    await fs.mkdir(fileDir, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, file.content, 'utf-8');
  }
}

// ============================================================================
// Import Resolution
// ============================================================================

/**
 * Extract import statements from file content
 */
function extractImports(content: string): string[] {
  const importRegex = /^\s*import\s+.*?from\s+['"]([^'"]+)['"]/gm;
  const imports: string[] = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Resolve relative imports to file paths
 */
function resolveImport(importPath: string, currentFile: string): string | null {
  // Skip node_modules and external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }
  
  const currentDir = path.dirname(currentFile);
  let resolvedPath = path.join(currentDir, importPath);
  
  // Add .ts/.tsx extension if missing
  if (!resolvedPath.match(/\.(ts|tsx|js|jsx)$/)) {
    // Try .ts first, then .tsx
    if (resolvedPath.endsWith('/index')) {
      return resolvedPath + '.ts';
    }
    return resolvedPath + '.ts';
  }
  
  return resolvedPath;
}

/**
 * Resolve direct imports for a set of files (non-recursive for performance)
 */
function resolveScopedImports(
  files: Array<{ path: string; content: string }>
): string[] {
  const fileMap = new Map(files.map(f => [f.path, f.content]));
  const scopedFiles = new Set<string>();
  
  // Add all input files
  files.forEach(f => scopedFiles.add(f.path));
  
  // Resolve direct imports only (not recursive)
  for (const file of files) {
    const imports = extractImports(file.content);
    
    for (const importPath of imports) {
      const resolved = resolveImport(importPath, file.path);
      
      if (resolved && fileMap.has(resolved)) {
        scopedFiles.add(resolved);
      }
    }
  }
  
  return Array.from(scopedFiles);
}

// ============================================================================
// TypeScript Validation
// ============================================================================

/**
 * Run TypeScript compiler on scoped files
 */
async function runTypeScriptValidation(
  tempDir: string,
  files: string[]
): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
  try {
    // Create a minimal tsconfig.json for validation
    const tsConfig = {
      compilerOptions: {
        target: 'ES2017',
        module: 'esnext',
        lib: ['ES2017', 'DOM'],
        jsx: 'react-jsx',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        allowJs: true,
        noEmit: true,
        incremental: true,
      },
      include: files,
      exclude: ['node_modules', '**/*.spec.ts', '**/*.test.ts'],
    };
    
    const tsConfigPath = path.join(tempDir, 'tsconfig.validation.json');
    await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2), 'utf-8');
    
    // Run tsc with timeout
    const command = `npx tsc --project "${tsConfigPath}" --noEmit`;
    
    const { stdout, stderr } = await Promise.race([
      execAsync(command, { cwd: tempDir, maxBuffer: 1024 * 1024 * 10 }), // 10MB buffer
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('TypeScript validation timeout')), VALIDATION_TIMEOUT_MS)
      ),
    ]);
    
    // If we get here, tsc succeeded (exit code 0)
    return {
      success: true,
      errors: [],
      warnings: stderr ? [stderr] : [],
    };
  } catch (error: any) {
    // tsc returns non-zero exit code on errors
    const output = error.stdout || error.stderr || error.message;
    
    // Parse errors from tsc output
    const errorLines = output
      .split('\n')
      .filter((line: string) => line.includes('error TS'))
      .slice(0, 20); // Limit to first 20 errors
    
    return {
      success: false,
      errors: errorLines.length > 0 ? errorLines : [output.slice(0, 500)],
      warnings: [],
    };
  }
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate generated code with scoped TypeScript checking
 * 
 * @param files - Array of files to validate
 * @param jobId - Unique job identifier for temp directory
 * @returns Validation result with errors and temp directory path
 */
export async function validateGeneratedCode(
  files: Array<{ path: string; content: string }>,
  jobId: string
): Promise<ValidationResult> {
  let tempDir: string | undefined;
  
  try {
    // Create temp directory
    tempDir = await createTempDir(jobId, false);
    
    // Write files to temp directory
    await writeFilesToTemp(tempDir, files);
    
    // Resolve scoped imports
    const scopedFiles = resolveScopedImports(files);
    
    console.log(`🔍 Validating ${scopedFiles.length} file(s) with TypeScript...`);
    
    // Run TypeScript validation
    const result = await runTypeScriptValidation(tempDir, scopedFiles);
    
    if (result.success) {
      console.log('✅ TypeScript validation passed');
      
      // Schedule immediate cleanup on success
      scheduleCleanup(tempDir, 0);
      
      return {
        valid: true,
        errors: [],
        warnings: result.warnings,
        tempDir,
      };
    } else {
      console.error('❌ TypeScript validation failed:', result.errors);
      
      // Move to failed directory and schedule delayed cleanup
      const failedTempDir = await createTempDir(jobId, true);
      await fs.cp(tempDir, failedTempDir, { recursive: true });
      await fs.rm(tempDir, { recursive: true, force: true });
      
      scheduleCleanup(failedTempDir, CLEANUP_DELAY_MS);
      
      return {
        valid: false,
        errors: result.errors,
        warnings: result.warnings,
        tempDir: failedTempDir,
      };
    }
  } catch (error: any) {
    console.error('Validation error:', error);
    
    // On error, keep temp directory for debugging
    if (tempDir) {
      const failedTempDir = await createTempDir(jobId, true);
      try {
        await fs.cp(tempDir, failedTempDir, { recursive: true });
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore copy errors
      }
      
      scheduleCleanup(failedTempDir, CLEANUP_DELAY_MS);
      
      return {
        valid: false,
        errors: [error.message || 'Unknown validation error'],
        tempDir: failedTempDir,
      };
    }
    
    return {
      valid: false,
      errors: [error.message || 'Unknown validation error'],
    };
  }
}

/**
 * Manual cleanup function for immediate removal (for testing)
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  await fs.rm(tempDir, { recursive: true, force: true });
}
