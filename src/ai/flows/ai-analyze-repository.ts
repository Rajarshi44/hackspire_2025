'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing a GitHub repository's contents.
 *
 * - aiAnalyzeRepository - An async function that triggers the flow to fetch and analyze a repository.
 * - AIAnalyzeRepositoryInput - The input type for the function.
 * - AIAnalyzeRepositoryOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AIAnalyzeRepositoryInputSchema = z.object({
  repoOwner: z.string().describe('The owner of the GitHub repository.'),
  repoName: z.string().describe('The name of the GitHub repository.'),
  accessToken: z.string().describe('The GitHub access token for the user.'),
});

export type AIAnalyzeRepositoryInput = z.infer<typeof AIAnalyzeRepositoryInputSchema>;

const FileSchema = z.object({
  path: z.string(),
  content: z.string().optional(),
});

const AIAnalyzeRepositoryOutputSchema = z.object({
  summary: z.string().describe('A summary of the repository\'s purpose and structure.'),
  fileTree: z.array(z.object({ path: z.string() })).describe('The file structure of the repository.'),
});

export type AIAnalyzeRepositoryOutput = z.infer<typeof AIAnalyzeRepositoryOutputSchema>;

async function getRepoDetails(repoOwner: string, repoName: string, accessToken: string) {
    const url = `https://api.github.com/repos/${repoOwner}/${repoName}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
        },
    });
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Repository not found. Please check the owner and repository name.');
        }
        throw new Error(`Failed to fetch repository details: ${response.statusText}`);
    }
    return response.json();
}


// Helper function to fetch file tree
async function getFileTree(repoOwner: string, repoName: string, accessToken: string): Promise<{ path: string; type: string }[]> {
    const url = `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/main?recursive=1`;
    const response = await fetch(url, {
        headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        },
    });
    if (!response.ok) {
        if (response.status === 404) {
             // This can happen for private repos if token lacks scope, or empty repos.
            return [];
        }
        if (response.status === 409) { // 409 Conflict for empty repos
            return [];
        }
        throw new Error(`Failed to fetch file tree: ${response.statusText}`);
    }
    const { tree } = await response.json();
    return tree.filter((file: { type: string }) => file.type === 'blob'); // Only include files
}


// Helper function to get file content
async function getFileContent(repoOwner: string, repoName: string, path: string, accessToken: string): Promise<string | null> {
    const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
        },
    });
    if (!response.ok) {
        console.error(`Failed to fetch file content for ${path}: ${response.statusText}`);
        return null;
    }
    const data = await response.json();
    // Content is base64 encoded
    return Buffer.from(data.content, 'base64').toString('utf-8');
}
6

export async function aiAnalyzeRepository(input: AIAnalyzeRepositoryInput): Promise<AIAnalyzeRepositoryOutput> {
    return aiAnalyzeRepositoryFlow(input);
}

const analyzeRepoPrompt = ai.definePrompt({
    name: 'analyzeRepoPrompt',
    input: { schema: z.object({ readmeContent: z.string().optional(), fileTree: z.array(z.object({ path: z.string() })) }) },
    output: { schema: z.object({ summary: z.string() }) },
    prompt: `You are a senior software engineer. Analyze the provided README file and file tree of a GitHub repository and provide a concise summary of its purpose, technology stack, and structure.

    If the README is not available, summarize based on the file structure. If both are empty, state that you couldn't analyze the repository.

    README Content:
    {{{readmeContent}}}

    File Tree:
    {{#each fileTree}}
    - {{this.path}}
    {{/each}}

    Provide your summary.`,
});

const aiAnalyzeRepositoryFlow = ai.defineFlow(
  {
    name: 'aiAnalyzeRepositoryFlow',
    inputSchema: AIAnalyzeRepositoryInputSchema,
    outputSchema: AIAnalyzeRepositoryOutputSchema,
  },
  async (input) => {
    
    const repoDetails = await getRepoDetails(input.repoOwner, input.repoName, input.accessToken);
    
    try {
        const fileTree = await getFileTree(input.repoOwner, input.repoName, input.accessToken);

        if (repoDetails.private && fileTree.length === 0) {
            throw new Error("This is a private repository. To perform AI analysis, please ensure GitPulse has been granted access to it on GitHub.");
        }

        const readmePath = fileTree.find(f => f.path.toLowerCase() === 'readme.md')?.path;
        const readmeContent = readmePath ? await getFileContent(input.repoOwner, input.repoName, readmePath, input.accessToken) : 'No README file found.';

        const { output } = await analyzeRepoPrompt({
            readmeContent: readmeContent ?? undefined,
            fileTree: fileTree.map(f => ({ path: f.path })) // Only pass paths to the prompt
        });

        if (!output) {
            throw new Error("AI analysis did not produce an output.");
        }

        return {
        summary: output.summary,
        fileTree: fileTree.map(f => ({ path: f.path })) // Return the file tree with paths
        };
    } catch(e: any) {
        if (repoDetails.private) {
             throw new Error("This is a private repository. To perform AI analysis, please ensure GitPulse has been granted access to it on GitHub.");
        }
        throw e;
    }
  }
);
