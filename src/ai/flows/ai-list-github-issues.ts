'use server';

/**
 * @fileOverview This file defines the AI flow for listing open GitHub issues.
 *
 * - aiListGithubIssues - A function that lists open GitHub issues for a repository.
 * - AIListGithubIssuesInput - The input type for the function.
 * - AIListGithubIssuesOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AIListGithubIssuesInputSchema = z.object({
  repoOwner: z.string().describe('The owner of the GitHub repository.'),
  repoName: z.string().describe('The name of the GitHub repository.'),
  accessToken: z.string().describe('The GitHub access token for the user.'),
});

export type AIListGithubIssuesInput = z.infer<typeof AIListGithubIssuesInputSchema>;

const IssueSchema = z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    html_url: z.string(),
    user: z.object({
        login: z.string(),
    }),
});

const AIListGithubIssuesOutputSchema = z.object({
  issues: z.array(IssueSchema).describe('The list of open GitHub issues.'),
});

export type AIListGithubIssuesOutput = z.infer<typeof AIListGithubIssuesOutputSchema>;

async function listGithubIssues(input: AIListGithubIssuesInput): Promise<AIListGithubIssuesOutput> {
  const { repoOwner, repoName, accessToken } = input;
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/issues?state=open`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub issues: ${response.statusText}`);
  }

  const issues = await response.json();
  return { issues: issues.filter((issue: any) => !issue.pull_request) }; // Filter out pull requests
}


export async function aiListGithubIssues(input: AIListGithubIssuesInput): Promise<AIListGithubIssuesOutput> {
    return aiListGithubIssuesFlow(input);
}

const aiListGithubIssuesFlow = ai.defineFlow(
  {
    name: 'aiListGithubIssuesFlow',
    inputSchema: AIListGithubIssuesInputSchema,
    outputSchema: AIListGithubIssuesOutputSchema,
  },
  async (input) => {
    return await listGithubIssues(input);
  }
);
