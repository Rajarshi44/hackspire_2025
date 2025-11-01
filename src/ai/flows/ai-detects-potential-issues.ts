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
  prompt: `You are an AI assistant specializing in analyzing informal, natural chat messages to detect potential software issues, bugs, incidents, or feature requests.

  Review the provided chat history (the messages are in chronological order). Focus on the last few messages to determine whether a new actionable issue should be created. Typical signals that indicate an issue include:
  - Reports of errors, exceptions, stack traces, or failing tests
  - Repeated user reports about a broken feature
  - Requests like "this doesn't work", "we need", "should support", or "please fix"
  - Performance regressions, crashes, or data loss

  If the user explicitly starts a message with `/issue` treat the remainder of that message as the issue title and generate the description from surrounding context.

  Chat History:
  {{#each messages}}
  {{sender}}: {{text}}
  {{/each}}

  {{#if mentions}}
  Mentioned users: {{mentions}}
  If mentions are provided, these users should be included in the 'assignees' list for the issue when appropriate.
  {{/if}}

  Output requirements:
  - Return a JSON object matching the schema exactly.
  - 'is_issue' must be a boolean.
  - If 'is_issue' is true, fill 'title' with a concise, 6-12 word summary suitable for an issue title, 'description' with a clear reproduction or context (include steps if relevant), 'priority' as one of 'low', 'medium', or 'high'. Include 'assignees' only when mentions are provided or you can confidently map Slack handles to GitHub usernames.
  - If 'is_issue' is false, set 'is_issue' to false and return empty strings for 'title' and 'description', 'priority' can be 'low', and 'assignees' should be an empty array.

  Example (issue detected):
  {
    "is_issue": true,
    "title": "API returns 500 when creating user",
    "description": "Requests to POST /api/users return a 500 error intermittently. Steps: 1) POST payload X; 2) observe 500 with stack trace Y. Occurs on prod for user signups.",
    "priority": "high",
    "assignees": ["alice"]
  }

  Example (no issue):
  {
    "is_issue": false,
    "title": "",
    "description": "",
    "priority": "low",
    "assignees": []
  }

  Based on the last message, respond with the JSON object only. Do not include any additional text.
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
