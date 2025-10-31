'use server';

/**
 * @fileOverview Genkit flow for generating code fixes for GitHub issues.
 * 
 * This flow analyzes issue details and relevant file chunks to generate
 * complete file contents with fixes applied.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  AICodeGenerationInput,
  AICodeGenerationInputSchema,
  AICodeGenerationOutput,
  AICodeGenerationOutputSchema,
  FileChangeSchema,
} from '@/types/mcp';

// ============================================================================
// Prompt Definition
// ============================================================================

const generateCodePrompt = ai.definePrompt({
  name: 'generateCodePrompt',
  input: {
    schema: z.object({
      issueTitle: z.string(),
      issueBody: z.string(),
      files: z.array(z.object({
        path: z.string(),
        content: z.string(),
      })),
    }),
  },
  output: {
    schema: z.object({
      changes: z.array(FileChangeSchema),
      overallSummary: z.string(),
    }),
  },
  prompt: `You are an expert software engineer tasked with fixing a GitHub issue.

ISSUE TITLE:
{{{issueTitle}}}

ISSUE DESCRIPTION:
{{{issueBody}}}

RELEVANT FILES:
{{#each files}}
---
File: {{this.path}}
---
{{{this.content}}}

{{/each}}

YOUR TASK:
1. Analyze the issue description and understand what needs to be fixed or implemented
2. Review the provided file contents carefully
3. Generate complete, fixed versions of the files that address the issue
4. Ensure your code follows best practices and matches the existing code style
5. Make sure all changes are syntactically correct and properly formatted

CRITICAL REQUIREMENTS:
- Return COMPLETE file contents, not diffs or patches
- Include ALL original code that doesn't need changes
- Preserve all imports, exports, and file structure
- Ensure TypeScript/JavaScript syntax is valid
- Follow the existing code style and conventions
- Do NOT add placeholder comments like "// existing code..." or "// rest of file..."
- Each file change must be complete and ready to commit

RESPONSE FORMAT:
Return a JSON object with:
- changes: An array of objects, each containing:
  - path: The file path (exactly as provided)
  - content: The COMPLETE file content with fixes applied
  - summary: A brief description of what was changed in this file
- overallSummary: A brief description of all changes made to resolve the issue

Generate the code fixes now:`,
});

// ============================================================================
// Flow Definition
// ============================================================================

const aiGeneratesCodeDiffFlow = ai.defineFlow(
  {
    name: 'aiGeneratesCodeDiffFlow',
    inputSchema: AICodeGenerationInputSchema,
    outputSchema: AICodeGenerationOutputSchema,
  },
  async (input: AICodeGenerationInput): Promise<AICodeGenerationOutput> => {
    // Flatten chunks into complete file content for the prompt
    const filesForPrompt = input.files.map(file => {
      // If there's only one chunk, use it directly
      if (file.chunks.length === 1) {
        return {
          path: file.path,
          content: file.chunks[0].snippet,
        };
      }

      // If multiple chunks, combine them with markers
      const combinedContent = file.chunks
        .map((chunk, index) => {
          const header = index === 0 
            ? `// Lines ${chunk.startLine}-${chunk.endLine}\n`
            : `\n// ... Lines ${chunk.startLine}-${chunk.endLine} ...\n`;
          return header + chunk.snippet;
        })
        .join('\n');

      return {
        path: file.path,
        content: combinedContent,
      };
    });

    // Call the AI prompt
    const { output } = await generateCodePrompt({
      issueTitle: input.issueTitle,
      issueBody: input.issueBody || 'No description provided.',
      files: filesForPrompt,
    });

    if (!output) {
      throw new Error('AI code generation did not produce an output.');
    }

    // Validate that all changes have complete content
    for (const change of output.changes) {
      if (!change.content || change.content.trim().length === 0) {
        throw new Error(`Generated code for ${change.path} is empty or invalid.`);
      }

      // Check for placeholder comments that indicate incomplete generation
      const hasPlaceholders = 
        change.content.includes('// existing code...') ||
        change.content.includes('// rest of file...') ||
        change.content.includes('... existing code ...') ||
        change.content.includes('/* ... existing code ... */');

      if (hasPlaceholders) {
        throw new Error(
          `Generated code for ${change.path} contains placeholder comments. ` +
          'The AI must return complete file contents.'
        );
      }
    }

    return {
      changes: output.changes,
      overallSummary: output.overallSummary,
    };
  }
);

// ============================================================================
// Exported Function
// ============================================================================

/**
 * Generate code fixes for a GitHub issue
 * 
 * @param input - Issue details and relevant file chunks
 * @returns Complete file contents with fixes applied
 */
export async function aiGeneratesCodeDiff(
  input: AICodeGenerationInput
): Promise<AICodeGenerationOutput> {
  return aiGeneratesCodeDiffFlow(input);
}
