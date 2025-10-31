'use server';

/**
 * @fileOverview AI flow for matching pull requests with issues.
 * 
 * - aiMatchPullRequestWithIssue - Matches PRs with issues using AI analysis
 * - MatchPRWithIssueInput - Input type for the matching function  
 * - MatchPRWithIssueOutput - Output type for the matching function
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MatchPRWithIssueInputSchema = z.object({
  repoOwner: z.string().describe('The owner of the GitHub repository.'),
  repoName: z.string().describe('The name of the GitHub repository.'),
  issueReference: z.string().describe('Reference to the issue (title, number, or keywords).'),
  claimedBy: z.string().describe('User ID who claimed to resolve the issue.'),
  accessToken: z.string().describe('GitHub access token for API access.'),
});

export type MatchPRWithIssueInput = z.infer<typeof MatchPRWithIssueInputSchema>;

const MatchPRWithIssueOutputSchema = z.object({
  matchFound: z.boolean().describe('Whether a matching PR was found.'),
  matchingPRs: z.array(z.object({
    number: z.number().describe('PR number.'),
    title: z.string().describe('PR title.'),
    url: z.string().describe('PR URL.'),
    author: z.string().describe('PR author username.'),
    createdAt: z.string().describe('PR creation date.'),
    matchConfidence: z.enum(['low', 'medium', 'high']).describe('Confidence of the match.'),
    matchReason: z.string().describe('Why this PR matches the issue.'),
  })).describe('List of matching pull requests.'),
  totalPRsAnalyzed: z.number().describe('Total number of PRs analyzed.'),
});

export type MatchPRWithIssueOutput = z.infer<typeof MatchPRWithIssueOutputSchema>;

export async function aiMatchPullRequestWithIssue(input: MatchPRWithIssueInput): Promise<MatchPRWithIssueOutput> {
  return aiMatchPRWithIssueFlow(input);
}

const fetchRecentPRs = ai.defineTool(
  {
    name: 'fetchRecentPRs',
    description: 'Fetches recent pull requests from GitHub repository.',
    inputSchema: z.object({
      repoOwner: z.string(),
      repoName: z.string(),
      accessToken: z.string(),
    }),
    outputSchema: z.object({
      pullRequests: z.array(z.object({
        number: z.number(),
        title: z.string(),
        body: z.string().nullable(),
        html_url: z.string(),
        user: z.object({
          login: z.string(),
        }),
        created_at: z.string(),
        state: z.string(),
      })),
    }),
  },
  async (input) => {
    const { repoOwner, repoName, accessToken } = input;
    
    try {
      // Fetch recent PRs (last 50, both open and closed)
      const [openResponse, closedResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/pulls?state=open&per_page=25&sort=created&direction=desc`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        }),
        fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/pulls?state=closed&per_page=25&sort=created&direction=desc`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        }),
      ]);

      if (!openResponse.ok || !closedResponse.ok) {
        throw new Error('Failed to fetch pull requests');
      }

      const [openPRs, closedPRs] = await Promise.all([
        openResponse.json(),
        closedResponse.json(),
      ]);

      const allPRs = [...openPRs, ...closedPRs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return { pullRequests: allPRs };
    } catch (error) {
      console.error('Error fetching PRs:', error);
      return { pullRequests: [] };
    }
  }
);

const matchPRPrompt = ai.definePrompt({
  name: 'matchPRPrompt',
  tools: [fetchRecentPRs],
  prompt: `You are an AI assistant that matches pull requests with issue resolution claims.

Issue Reference: "{{issueReference}}"
Claimed by User: "{{claimedBy}}"

First, fetch recent pull requests from the repository using the fetchRecentPRs tool.

Then analyze each PR to determine if it could be related to the issue reference. Look for:

1. **Direct matches**: PR title/description mentions the issue reference
2. **Keyword matches**: PR addresses similar functionality/bug described in issue reference  
3. **Author matches**: PR is created by the user who claimed to resolve the issue
4. **Timing**: PR was created recently (within reasonable timeframe)
5. **Content analysis**: PR description suggests it fixes the type of issue mentioned

For each potentially matching PR, assign a confidence level:
- **High**: Direct issue reference + same author + recent timing
- **Medium**: Good keyword match + same author OR direct reference + different author  
- **Low**: Keyword match only OR same author + timing but unclear content match

Provide detailed reasoning for each match found.`,
});

const aiMatchPRWithIssueFlow = ai.defineFlow(
  {
    name: 'aiMatchPRWithIssueFlow',
    inputSchema: MatchPRWithIssueInputSchema,
    outputSchema: MatchPRWithIssueOutputSchema,
  },
  async (input) => {
    const { repoOwner, repoName, issueReference, claimedBy, accessToken } = input;
    
    // Fetch recent PRs
    const { pullRequests } = await fetchRecentPRs({ repoOwner, repoName, accessToken });
    
    if (pullRequests.length === 0) {
      return {
        matchFound: false,
        matchingPRs: [],
        totalPRsAnalyzed: 0,
      };
    }

    // Analyze each PR for matches
    const matchingPRs = [];
    
    for (const pr of pullRequests) {
      // Simple matching logic - can be enhanced with AI analysis
      let matchConfidence: 'low' | 'medium' | 'high' = 'low';
      let matchReason = '';
      let isMatch = false;

      const prText = `${pr.title} ${pr.body || ''}`.toLowerCase();
      const issueText = issueReference.toLowerCase();
      
      // Check for direct issue number reference (e.g., #123)
      const issueNumberMatch = issueReference.match(/#(\d+)/);
      if (issueNumberMatch) {
        const issueNumber = issueNumberMatch[1];
        if (prText.includes(`#${issueNumber}`) || prText.includes(`issue ${issueNumber}`)) {
          isMatch = true;
          matchConfidence = pr.user.login === claimedBy ? 'high' : 'medium';
          matchReason = `References issue #${issueNumber}`;
        }
      }
      
      // Check for keyword matches
      if (!isMatch) {
        const keywords = issueText.split(' ').filter(word => word.length > 3);
        const matchingKeywords = keywords.filter(keyword => 
          prText.includes(keyword) || pr.title.toLowerCase().includes(keyword)
        );
        
        if (matchingKeywords.length >= 2 || (matchingKeywords.length >= 1 && pr.user.login === claimedBy)) {
          isMatch = true;
          matchConfidence = pr.user.login === claimedBy ? 'medium' : 'low';
          matchReason = `Keyword matches: ${matchingKeywords.join(', ')}`;
        }
      }
      
      // Check if author matches claimed user
      if (pr.user.login === claimedBy && !isMatch) {
        // Recent PR by the same user - could be related
        const prDate = new Date(pr.created_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - prDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff <= 24) { // Within last 24 hours
          isMatch = true;
          matchConfidence = 'low';
          matchReason = 'Same author, recent PR';
        }
      }
      
      if (isMatch) {
        matchingPRs.push({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          author: pr.user.login,
          createdAt: pr.created_at,
          matchConfidence,
          matchReason,
        });
      }
    }
    
    return {
      matchFound: matchingPRs.length > 0,
      matchingPRs: matchingPRs.sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        return confidenceOrder[b.matchConfidence] - confidenceOrder[a.matchConfidence];
      }),
      totalPRsAnalyzed: pullRequests.length,
    };
  }
);