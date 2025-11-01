#!/usr/bin/env node

/**
 * Quick test script to verify Slack bot functionality
 */

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const TEST_CHANNEL = process.env.TEST_CHANNEL || '#general';

async function testSlackBot() {
  console.log('🧪 Testing Slack Bot Functionality');
  console.log('=====================================');
  
  // Check environment variables
  console.log('\n📋 Environment Check:');
  console.log('SLACK_BOT_TOKEN:', SLACK_BOT_TOKEN ? `✅ Set (${SLACK_BOT_TOKEN.length} chars)` : '❌ Missing');
  console.log('SLACK_SIGNING_SECRET:', process.env.SLACK_SIGNING_SECRET ? '✅ Set' : '❌ Missing');
  console.log('Test Channel:', TEST_CHANNEL);
  
  if (!SLACK_BOT_TOKEN) {
    console.log('\n❌ Cannot test without SLACK_BOT_TOKEN');
    process.exit(1);
  }
  
  // Test bot authentication
  console.log('\n🔐 Testing Bot Authentication...');
  try {
    const authResponse = await fetch('https://slack.com/api/auth.test', {
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      },
    });
    
    const authData = await authResponse.json();
    console.log('Auth response:', authData);
    
    if (authData.ok) {
      console.log('✅ Bot authenticated successfully');
      console.log(`   Bot User: ${authData.user} (${authData.user_id})`);
      console.log(`   Team: ${authData.team} (${authData.team_id})`);
    } else {
      console.log('❌ Bot authentication failed:', authData.error);
    }
  } catch (error) {
    console.log('❌ Error testing auth:', error.message);
  }
  
  // Test sending a message
  console.log('\n📨 Testing Message Sending...');
  try {
    const messageResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: TEST_CHANNEL,
        text: '🧪 Test message from GitPulse bot - AI issue detection is active!',
      }),
    });
    
    const messageData = await messageResponse.json();
    console.log('Message response:', messageData);
    
    if (messageData.ok) {
      console.log('✅ Test message sent successfully');
    } else {
      console.log('❌ Failed to send test message:', messageData.error);
    }
  } catch (error) {
    console.log('❌ Error sending message:', error.message);
  }
  
  // Test getting channel list
  console.log('\n📋 Testing Channel Access...');
  try {
    const channelsResponse = await fetch('https://slack.com/api/conversations.list?limit=20', {
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      },
    });
    
    const channelsData = await channelsResponse.json();
    
    if (channelsData.ok) {
      console.log('✅ Can access channels');
      console.log(`   Found ${channelsData.channels.length} channels`);
      channelsData.channels.forEach(channel => {
        console.log(`   - ${channel.name} (${channel.id}) - member: ${channel.is_member}`);
      });
    } else {
      console.log('❌ Cannot access channels:', channelsData.error);
    }
  } catch (error) {
    console.log('❌ Error getting channels:', error.message);
  }
  
  console.log('\n🎯 Test Summary:');
  console.log('================');
  console.log('If the bot is working correctly, you should see:');
  console.log('1. ✅ Bot authenticated successfully');
  console.log('2. ✅ Test message sent successfully');
  console.log('3. ✅ Can access channels');
  console.log('');
  console.log('To test issue detection, send a message like:');
  console.log('"This feature is broken and needs to be fixed"');
  console.log('or "Let\'s add a new header to the website"');
}

testSlackBot().catch(console.error);