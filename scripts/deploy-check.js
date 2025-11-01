#!/usr/bin/env node

/**
 * Vercel Deployment Setup Script
 * Run this to validate your environment for Vercel deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 GitPulse Vercel Deployment Checker\n');

// Check for required files
const requiredFiles = [
  'package.json',
  'vercel.json',
  'next.config.ts',
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} - Found`);
  } else {
    console.log(`❌ ${file} - Missing`);
  }
});

// Check environment variables template
console.log('\n🔧 Checking environment setup...');
if (fs.existsSync('.env.example')) {
  console.log('✅ .env.example - Template available');
  console.log('   → Copy this to set up your Vercel environment variables');
} else {
  console.log('❌ .env.example - Missing template');
}

// Check local environment (optional)
if (fs.existsSync('.env.local')) {
  console.log('✅ .env.local - Local environment configured');
} else {
  console.log('ℹ️  .env.local - Not found (OK for production deployment)');
}

// Parse package.json for scripts
console.log('\n📦 Checking build configuration...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.scripts?.build) {
    console.log(`✅ Build script: ${packageJson.scripts.build}`);
  } else {
    console.log('❌ No build script found');
  }
  
  if (packageJson.scripts?.start) {
    console.log(`✅ Start script: ${packageJson.scripts.start}`);
  } else {
    console.log('❌ No start script found');
  }

  // Check for required dependencies
  const requiredDeps = [
    '@genkit-ai/google-genai',
    '@slack/bolt',
    'firebase',
    'next',
  ];

  console.log('\n📚 Checking required dependencies...');
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  requiredDeps.forEach(dep => {
    if (allDeps[dep]) {
      console.log(`✅ ${dep} - ${allDeps[dep]}`);
    } else {
      console.log(`❌ ${dep} - Missing`);
    }
  });

} catch (error) {
  console.log('❌ Error reading package.json');
}

// Deployment checklist
console.log('\n📋 Pre-deployment Checklist:');
console.log('');
console.log('1. Environment Variables (Set in Vercel Dashboard):');
console.log('   □ SLACK_SIGNING_SECRET');
console.log('   □ SLACK_BOT_TOKEN'); 
console.log('   □ GOOGLE_GENAI_API_KEY');
console.log('   □ NEXTAUTH_URL (https://your-app.vercel.app)');
console.log('   □ NEXTAUTH_SECRET');
console.log('   □ Firebase configuration variables');
console.log('');
console.log('2. Slack App Configuration:');
console.log('   □ Update Request URLs to your Vercel domain');
console.log('   □ Slash Commands: /api/slack/commands');
console.log('   □ Event Subscriptions: /api/slack/events');
console.log('   □ Interactive Components: /api/slack/interactions');
console.log('');
console.log('3. Deployment Steps:');
console.log('   □ Push code to GitHub');
console.log('   □ Connect repository to Vercel');
console.log('   □ Configure environment variables');
console.log('   □ Deploy and test');
console.log('');
console.log('For detailed instructions, see VERCEL_DEPLOYMENT_GUIDE.md');