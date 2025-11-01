/**
 * Test script for github-tools.ts
 * 
 * Run with: npx tsx test-github-tools.ts
 */

import {
  getIssueContext,
  createBranch,
  createOrUpdateFile,
  createDraftPR,
  listPRReviewComments,
  postPRComment,
  postIssueComment,
} from './src/lib/mcp/github-tools';

async function testGitHubTools() {
  console.log('🧪 Testing GitHub Tools Module\n');

  // Test 1: Get Issue Context
  console.log('1️⃣ Testing getIssueContext...');
  try {
    const context = await getIssueContext({
      owner: 'Rajarshi44',
      repo: 'hackspire_2025',
      issue_number: 1,
    });
    console.log('✅ Issue Title:', context.issue.title);
    console.log('✅ Comments Count:', context.comments.length);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  // Test 2: Create Branch
  console.log('\n2️⃣ Testing createBranch...');
  try {
    const branch = await createBranch({
      owner: 'Rajarshi44',
      repo: 'hackspire_2025',
      newBranch: `test-branch-${Date.now()}`,
      baseBranch: 'main',
    });
    console.log('✅ Branch created:', branch.ref);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  // Test 3: Create or Update File
  console.log('\n3️⃣ Testing createOrUpdateFile...');
  try {
    const fileResult = await createOrUpdateFile({
      owner: 'Rajarshi44',
      repo: 'hackspire_2025',
      path: `test-file-${Date.now()}.txt`,
      content: 'Hello from github-tools!',
      branch: 'main',
      commitMessage: 'Test commit from github-tools',
    });
    console.log('✅ File created:', fileResult.content.path);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  // Test 4: List PR Review Comments
  console.log('\n4️⃣ Testing listPRReviewComments...');
  try {
    const comments = await listPRReviewComments({
      owner: 'Rajarshi44',
      repo: 'hackspire_2025',
      pr_number: 1,
    });
    console.log('✅ Review Comments Count:', comments.length);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  // Test 5: Post Issue Comment
  console.log('\n5️⃣ Testing postIssueComment...');
  try {
    const comment = await postIssueComment({
      owner: 'Rajarshi44',
      repo: 'hackspire_2025',
      issue_number: 1,
      body: '🤖 Test comment from github-tools module',
    });
    console.log('✅ Comment posted:', comment.html_url);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n✨ All tests completed!');
}

// Run tests
testGitHubTools().catch(console.error);
