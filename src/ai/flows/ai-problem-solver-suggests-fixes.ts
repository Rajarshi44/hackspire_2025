'use server';

/**
 * @fileOverview This file defines a Genkit flow that analyzes GitHub issues and suggests fixes using the Model Context Protocol (MCP).
 *
 * - aiProblemSolverSuggestsFixes - An async function that triggers the flow to analyze an issue and suggest fixes.
 * - AIProblemSolverSuggestsFixesInput - The input type for the aiProblemSolverSuggestsFixes function.
 * - AIProblemSolverSuggestsFixesOutput - The return type for the aiProblemSolverSuggestsFixes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AIProblemSolverSuggestsFixesInputSchema = z.object({
  issueTitle: z.string().describe('The title of the GitHub issue.'),
  issueBody: z.string().describe('The body of the GitHub issue, containing the problem description.'),
  repoFiles: z.array(z.string()).describe('List of relevant file paths in the repository.'),
  repoContents: z.array(z.string()).describe('Content of each file in repoFiles'),
});

export type AIProblemSolverSuggestsFixesInput = z.infer<typeof AIProblemSolverSuggestsFixesInputSchema>;

const AIProblemSolverSuggestsFixesOutputSchema = z.object({
  suggestion: z.string().describe('The suggested fix or debugging hints for the issue.'),
});

export type AIProblemSolverSuggestsFixesOutput = z.infer<typeof AIProblemSolverSuggestsFixesOutputSchema>;

export async function aiProblemSolverSuggestsFixes(input: AIProblemSolverSuggestsFixesInput): Promise<AIProblemSolverSuggestsFixesOutput> {
  return aiProblemSolverSuggestsFixesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiProblemSolverSuggestsFixesPrompt',
  input: {schema: AIProblemSolverSuggestsFixesInputSchema},
  output: {schema: AIProblemSolverSuggestsFixesOutputSchema},
  prompt: `You are an AI expert in debugging and fixing code issues. Given the title and body of a GitHub issue, along with relevant files from the repository, analyze the issue and suggest a fix or debugging hints.

Issue Title: {{{issueTitle}}}
Issue Body: {{{issueBody}}}

Relevant Repository Files:
{{#each repoFiles}}
  - {{{this}}}
{{/each}}

Relevant File Contents:
{{#each repoContents}}
  - {{{this}}}
{{/each}}

Based on this information, provide a concise suggestion to resolve the issue.
`,
});

const aiProblemSolverSuggestsFixesFlow = ai.defineFlow(
  {
    name: 'aiProblemSolverSuggestsFixesFlow',
    inputSchema: AIProblemSolverSuggestsFixesInputSchema,
    outputSchema: AIProblemSolverSuggestsFixesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
