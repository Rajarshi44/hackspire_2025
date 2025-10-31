'use server';
/**
 * @fileOverview AI-powered issue detection flow for analyzing chat messages.
 *
 * - aiDetectIssue - Analyzes chat messages to detect potential issues or feature requests.
 * - DetectIssueInput - The input type for the aiDetectIssue function.
 * - DetectIssueOutput - The return type for the aiDetectIssue function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectIssueInputSchema = z.object({
  messages: z.array(
    z.object({
      sender: z.string().describe('The sender of the message.'),
      text: z.string().describe('The content of the message.'),
    })
  ).describe('The last 10 messages from the chat, including the new message.'),
  mentions: z.array(z.string()).optional().describe('Array of GitHub usernames mentioned in the message with @ symbol.'),
});
export type DetectIssueInput = z.infer<typeof DetectIssueInputSchema>;

const DetectIssueOutputSchema = z.object({
  is_issue: z.boolean().describe('Whether the message indicates an issue or feature request.'),
  title: z.string().describe('A concise title for the detected issue.'),
  description: z.string().describe('A detailed description of the issue.'),
  priority: z.enum(['low', 'medium', 'high']).describe('The priority of the issue.'),
  assignees: z.array(z.string()).optional().describe('Array of GitHub usernames to assign to the issue.'),
});
export type DetectIssueOutput = z.infer<typeof DetectIssueOutputSchema>;

export async function aiDetectIssue(input: DetectIssueInput): Promise<DetectIssueOutput> {
  return aiDetectIssueFlow(input);
}

const detectIssuePrompt = ai.definePrompt({
  name: 'detectIssuePrompt',
  input: {schema: DetectIssueInputSchema},
  output: {schema: DetectIssueOutputSchema},
  prompt: `You are an AI assistant specializing in analyzing chat messages to detect potential software issues or feature requests.

  Review the following chat messages and determine if the latest message indicates a new issue or feature request.

  If the message starts with '/issue', you MUST treat it as an issue. The text after '/issue' is the title of the issue.

  Chat History:
  {{#each messages}}
  {{sender}}: {{text}}
  {{/each}}

  {{#if mentions}}
  Mentioned users: {{mentions}}
  If mentions are provided, these users should be assigned to the issue if it's detected.
  {{/if}}

  Based on the last message, respond with a JSON object in the following format:
  {
  "is_issue": true or false,
  "title": "Concise title of the issue",
  "description": "Detailed description of the issue, including steps to reproduce if applicable",
  "priority": "low", "medium", or "high",
  "assignees": ["username1", "username2"] // Only include if mentions were provided and this is an issue
  }

  If the last message does not indicate an issue or feature request, set "is_issue" to false and leave the other fields empty.
  `,
});

const aiDetectIssueFlow = ai.defineFlow(
  {
    name: 'aiDetectIssueFlow',
    inputSchema: DetectIssueInputSchema,
    outputSchema: DetectIssueOutputSchema,
  },
  async input => {
    const {output} = await detectIssuePrompt(input);
    return output!;
  }
);
