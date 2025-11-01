'use server';

/**
 * @fileOverview This file defines the AI flow for automatically creating GitHub issues from detected bug reports or feature requests.
 *
 * - aiCreateGithubIssue - A function that creates a GitHub issue based on AI-detected information.
 * - AICreateGithubIssueInput - The input type for the aiCreateGithubIssue function.
 * - AICreateGithubIssueOutput - The return type for the aiCreateGithubIssue function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AICreateGithubIssueInputSchema = z.object({
  repoOwner: z.string().describe('The owner of the GitHub repository.'),
  repoName: z.string().describe('The name of the GitHub repository.'),
  issueTitle: z.string().describe('The title of the GitHub issue.'),
  issueDescription: z.string().describe('The description of the GitHub issue.'),
  accessToken: z.string().describe('The GitHub access token for the user.'),
  assignees: z.array(z.string()).optional().describe('Array of GitHub usernames to assign to the issue.'),
});

export type AICreateGithubIssueInput = z.infer<typeof AICreateGithubIssueInputSchema>;

const AICreateGithubIssueOutputSchema = z.object({
  issueUrl: z.string().describe('The URL of the created GitHub issue.'),
});

export type AICreateGithubIssueOutput = z.infer<typeof AICreateGithubIssueOutputSchema>;

export async function aiCreateGithubIssue(input: AICreateGithubIssueInput): Promise<AICreateGithubIssueOutput> {
  return aiCreateGithubIssueFlow(input);
}

const createGithubIssue = ai.defineTool(
  {
    name: 'createGithubIssue',
    description: 'Creates a GitHub issue in the specified repository.',
    inputSchema: AICreateGithubIssueInputSchema,
    outputSchema: AICreateGithubIssueOutputSchema,
  },
  async (input: AICreateGithubIssueInput) => {
    const {
      repoOwner,
      repoName,
      issueTitle,
      issueDescription,
      accessToken,
      assignees,
    } = input;

    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/issues`;

    const issueData = {
      title: issueTitle,
      body: `${issueDescription}\n\n---\n_Created by GitPulse AI_`,
      ...(assignees && assignees.length > 0 && { assignees }),
    };

    let response = await fetch(githubApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issueData),
    });

    // If we get a 422 error and have assignees, try again without assignees
    if (!response.ok && response.status === 422 && assignees && assignees.length > 0) {
      const errorText = await response.text();
      console.warn('GitHub API 422 error with assignees:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        assignees: assignees
      });

      // Check if the error is related to invalid assignees
      if (errorText.includes('assignees') || errorText.includes('cannot be assigned')) {
        console.log('Retrying GitHub issue creation without assignees...');
        
        // Retry without assignees
        const issueDataWithoutAssignees = {
          title: issueTitle,
          body: `${issueDescription}\n\n---\n_Created by GitPulse AI_\n\n> Note: Could not assign suggested users (${assignees.join(', ')}) - they may not have access to this repository.`,
        };

        response = await fetch(githubApiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(issueDataWithoutAssignees),
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, response.statusText, errorText);
      throw new Error(`Failed to create GitHub issue: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();

    return {
      issueUrl: responseData.html_url,
    };
  }
);

const aiCreateGithubIssuePrompt = ai.definePrompt({
  name: 'aiCreateGithubIssuePrompt',
  tools: [createGithubIssue],
  prompt: `Create a GitHub issue using the provided information. The title should be "{{issueTitle}}" and the description should be "{{issueDescription}}".

  Make sure to call the createGithubIssue tool to create the issue in the specified repository.`,
});

const aiCreateGithubIssueFlow = ai.defineFlow(
  {
    name: 'aiCreateGithubIssueFlow',
    inputSchema: AICreateGithubIssueInputSchema,
    outputSchema: AICreateGithubIssueOutputSchema,
  },
  async input => {
    const {repoOwner, repoName, issueTitle, issueDescription, accessToken, assignees} = input;
    const {issueUrl} = await createGithubIssue({
        repoOwner,
        repoName,
        issueTitle,
        issueDescription,
        accessToken,
        assignees
    });
    return {issueUrl};
  }
);
