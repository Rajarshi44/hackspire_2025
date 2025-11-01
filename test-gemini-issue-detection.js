// Simple test script to verify Gemini AI issue detection
// Run with: node test-gemini-issue-detection.js

import { ai } from './src/ai/genkit.ts';

async function testGeminiIssueDetection() {
  console.log('🤖 Testing Gemini AI issue detection...');
  
  const testMessages = [
    "The login button is not working properly, users can't sign in",
    "We should add a dark mode feature to the app",
    "Hey team, how's everyone doing today?",
    "There's a critical bug in the payment system - transactions are failing",
    "Can we implement automated testing for our CI/CD pipeline?"
  ];

  for (const message of testMessages) {
    console.log(`\n📝 Testing message: "${message}"`);
    
    try {
      const prompt = `
Analyze this message to determine if it describes a software issue, bug report, or feature request:

"${message}"

Respond with JSON in this exact format:
{
  "isIssue": boolean,
  "title": "Brief title if it's an issue",
  "description": "Detailed description if it's an issue",
  "priority": "low|medium|high",
  "type": "bug|feature|enhancement"
}

Only set isIssue to true if the message clearly describes:
- A bug or error
- A feature request
- An enhancement suggestion
- A technical problem

Do not detect issues for:
- General conversation
- Questions
- Status updates
- Greetings`;

      const response = await ai.chat({ 
        messages: [{ role: 'user', content: [{ text: prompt }] }]
      });
      
      const content = response.text();
      const jsonMatch = content.match(/\{[^}]+\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log('✅ Analysis result:', analysis);
      } else {
        console.log('❌ Could not parse JSON response:', content);
      }
    } catch (error) {
      console.error('❌ Error analyzing message:', error.message);
    }
  }
  
  console.log('\n🎉 Test completed!');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testGeminiIssueDetection().catch(console.error);
}

export { testGeminiIssueDetection };