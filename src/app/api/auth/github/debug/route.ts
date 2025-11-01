import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXTAUTH_URL || 'http://localhost:9002';
  
  const redirectUri = `${baseUrl}/api/auth/github/slack`;
  
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    baseUrl,
    redirectUri,
    vercelUrl: process.env.VERCEL_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    hasGithubSecret: !!process.env.GITHUB_CLIENT_SECRET,
    timestamp: new Date().toISOString()
  });
}