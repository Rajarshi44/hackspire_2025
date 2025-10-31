import { NextRequest, NextResponse } from 'next/server';
import {
  MCPGenerateCodeRequestSchema,
  MCPGenerateCodeResponse,
  MCPError,
  NotAssigneeError,
  ValidationError,
  GitHubAPIError,
  RateLimitError,
} from '@/types/mcp';
import { executeCodeGeneration } from '@/lib/mcp/agent-service';

/**
 * POST /api/mcp/generate-code
 * 
 * MCP endpoint for AI-powered code generation from GitHub issues
 */
export async function POST(request: NextRequest): Promise<NextResponse<MCPGenerateCodeResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    
    // Validate with Zod schema
    const validationResult = MCPGenerateCodeRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      
      return NextResponse.json(
        {
          success: false,
          jobId: body.jobId || 'unknown',
          error: 'Invalid request payload',
          details: errors.join('; '),
        },
        { status: 400 }
      );
    }
    
    const mcpRequest = validationResult.data;
    
    console.log(`📨 Received MCP request for ${mcpRequest.owner}/${mcpRequest.repo}#${mcpRequest.issue_number}`);
    
    // Execute code generation workflow
    const result = await executeCodeGeneration(mcpRequest);
    
    // Return success response
    return NextResponse.json(
      {
        success: true,
        jobId: result.jobId,
        pr_url: result.pr_url,
        pr_number: result.pr_number,
        branch: result.branch,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ MCP endpoint error:', error);
    
    // Handle specific error types with appropriate status codes
    if (error instanceof NotAssigneeError) {
      return NextResponse.json(
        {
          success: false,
          jobId: (error.details as any)?.requestedBy || 'unknown',
          error: 'Not authorized',
          details: error.message,
        },
        { status: 403 }
      );
    }
    
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          success: false,
          jobId: 'unknown',
          error: 'Validation failed',
          details: error.message,
        },
        { status: 422 }
      );
    }
    
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          success: false,
          jobId: 'unknown',
          error: 'Rate limit exceeded',
          details: error.message,
        },
        { status: 429 }
      );
    }
    
    if (error instanceof GitHubAPIError) {
      return NextResponse.json(
        {
          success: false,
          jobId: 'unknown',
          error: 'GitHub API error',
          details: error.message,
        },
        { status: error.statusCode >= 500 ? 502 : 400 }
      );
    }
    
    if (error instanceof MCPError) {
      return NextResponse.json(
        {
          success: false,
          jobId: 'unknown',
          error: error.code,
          details: error.message,
        },
        { status: error.statusCode }
      );
    }
    
    // Handle unknown errors
    return NextResponse.json(
      {
        success: false,
        jobId: 'unknown',
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mcp/generate-code
 * 
 * Return API documentation
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      name: 'MCP Code Generation API',
      version: '1.0.0',
      description: 'AI-powered code generation endpoint for GitHub issues',
      endpoint: 'POST /api/mcp/generate-code',
      requestBody: {
        owner: 'string (required) - Repository owner',
        repo: 'string (required) - Repository name',
        issue_number: 'number (required) - GitHub issue number',
        jobId: 'string (required) - Unique job identifier',
        requested_by: 'string (required) - GitHub username of requester',
        related_files: 'string[] (optional) - Specific files to analyze',
      },
      responses: {
        200: 'Success - PR created',
        400: 'Bad request - Invalid payload',
        403: 'Forbidden - User not assigned to issue',
        422: 'Unprocessable entity - Validation failed',
        429: 'Rate limit exceeded',
        500: 'Internal server error',
      },
      authentication: 'Requires GITHUB_TOKEN environment variable',
    },
    { status: 200 }
  );
}
