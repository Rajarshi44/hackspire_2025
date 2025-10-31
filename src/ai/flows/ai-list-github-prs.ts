'use server';

/**
 * @fileOverview This file defines the AI flow for listing open GitHub pull requests.
 *
 * - aiListGithubPRs - A function that lists open GitHub pull requests for a repository.
 * - AIListGithubPRsInput - The input type for the function.
 * - AIListGithubPRsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AIListGithubPRsInputSchema = z.object({
  repoOwner: z.string().describe('The owner of the GitHub repository.'),
  repoName: z.string().describe('The name of the GitHub repository.'),
  accessToken: z.string().describe('The GitHub access token for the user.'),
});

export type AIListGithubPRsInput = z.infer<typeof AIListGithubPRsInputSchema>;

const PRSchema = z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    html_url: z.string(),
    user: z.object({
        login: z.string(),
    }),
});

const AIListGithubPRsOutputSchema = z.object({
  prs: z.array(PRSchema).describe('The list of open GitHub pull requests.'),
});

export type AIListGithubPRsOutput = z.infer<typeof AIListGithubPRsOutputSchema>;


async function listGithubPRs(input: AIListGithubPRsInput): Promise<AIListGithubPRsOutput> {
  const { repoOwner, repoName, accessToken } = input;
  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/pulls?state=open`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub pull requests: ${response.statusText}`);
  }

  const prs = await response.json();
  return { prs };
}

export async function aiListGithubPRs(input: AIListGithubPRsInput): Promise<AIListGithubPRsOutput> {
    return aiListGithubPRsFlow(input);
}


const aiListGithubPRsFlow = ai.defineFlow(
  {
    name: 'aiListGithubPRsFlow',
    inputSchema: AIListGithubPRsInputSchema,
    outputSchema: AIListGithubPRsOutputSchema,
  },
  async (input) => {
    return await listGithubPRs(input);
  }
);
