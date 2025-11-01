'use server';

/**
 * @fileOverview AI flow for detecting issue resolution claims in chat messages.
 * 
 * - aiDetectIssueResolution - Analyzes messages to detect claims of issue resolution
 * - DetectIssueResolutionInput - Input type for the detection function
 * - DetectIssueResolutionOutput - Output type for the detection function
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectIssueResolutionInputSchema = z.object({
  messages: z.array(
    z.object({
      sender: z.string().describe('The sender of the message.'),
      text: z.string().describe('The content of the message.'),
      senderId: z.string().describe('The unique ID of the sender.'),
    })
  ).describe('Recent chat messages to analyze for resolution claims.'),
  currentUserId: z.string().describe('The ID of the user who sent the latest message.'),
});

export type DetectIssueResolutionInput = z.infer<typeof DetectIssueResolutionInputSchema>;

const DetectIssueResolutionOutputSchema = z.object({
  isResolutionClaim: z.boolean().describe('Whether the message claims to have resolved an issue.'),
  issueReference: z.string().optional().describe('Reference to the specific issue (title, number, or description keywords).'),
  confidence: z.enum(['low', 'medium', 'high']).describe('Confidence level of the resolution claim detection.'),
  claimedBy: z.string().describe('User ID of who claimed to have resolved the issue.'),
  resolutionMethod: z.enum(['pull_request', 'direct_fix', 'other']).optional().describe('How the user claims to have resolved the issue.'),
});

export type DetectIssueResolutionOutput = z.infer<typeof DetectIssueResolutionOutputSchema>;

export async function aiDetectIssueResolution(input: DetectIssueResolutionInput): Promise<DetectIssueResolutionOutput> {
  return aiDetectIssueResolutionFlow(input);
}

const detectIssueResolutionPrompt = ai.definePrompt({
  name: 'detectIssueResolutionPrompt',
  input: {schema: DetectIssueResolutionInputSchema},
  output: {schema: DetectIssueResolutionOutputSchema},
  prompt: `You are an AI assistant that analyzes chat messages to detect when someone claims to have resolved an issue.

Look for messages that indicate:
- "I fixed the [issue/bug/problem]"
- "Issue is resolved"
- "I solved the [specific problem]"
- "Created a PR for [issue]"
- "Pull request is ready for [issue]"
- "Done with [issue/task]"
- References to specific issue numbers like "#123"

Chat History:
{{#each messages}}
{{sender}} ({{senderId}}): {{text}}
{{/each}}

Current user making the claim: {{currentUserId}}

Analyze the LATEST message for resolution claims. Look for:
1. Direct statements about fixing/solving/resolving issues
2. References to pull requests or code changes
3. Mentions of specific issues or problems being completed
4. Issue numbers or titles that might be referenced

Respond with a JSON object:
{
  "isResolutionClaim": true/false,
  "issueReference": "specific issue title, number, or keywords mentioned",
  "confidence": "low"/"medium"/"high",
  "claimedBy": "user ID who made the claim",
  "resolutionMethod": "pull_request"/"direct_fix"/"other"
}

Set confidence based on how explicit and specific the claim is.`,
});

const aiDetectIssueResolutionFlow = ai.defineFlow(
  {
    name: 'aiDetectIssueResolutionFlow',
    inputSchema: DetectIssueResolutionInputSchema,
    outputSchema: DetectIssueResolutionOutputSchema,
  },
  async input => {
    const {output} = await detectIssueResolutionPrompt(input);
    return output!;
  }
);