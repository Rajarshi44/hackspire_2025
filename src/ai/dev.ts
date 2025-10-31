import { config } from 'dotenv';
config();

import '@/ai/flows/ai-detects-potential-issues.ts';
import '@/ai/flows/ai-creates-github-issues.ts';
import '@/ai/flows/ai-problem-solver-suggests-fixes.ts';
import '@/ai/flows/ai-analyze-repository.ts';
import '@/ai/flows/ai-list-github-issues.ts';
import '@/aiflows/ai-list-github-prs.ts';
