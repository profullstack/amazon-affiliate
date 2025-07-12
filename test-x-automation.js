import { XPromoter } from './src/promoters/x-promoter.js';

/**
 * Test X.com automation with login and posting
 */

async function testXAutomation() {
  console.log('🧪 Testing X.com Automation\n');

  const xPromoter = new XPromoter({ 
    headless: false, // Show browser for testing
    timeout: 30000 
  });

  try {
    // Test video data with credentials
    const testVideoData = {
      title: 'Amazing Kitchen Gadget Review - Must Have for 2025!',
      url: 'https://youtube.com/watch?v=test123',
      description: 'This incredible kitchen gadget will revolutionize your cooking experience.',
      tags: ['kitchen', 'gadget', 'cooking', 'review', 'amazon'],
      credentials: {
        username: 'your_x_username', // Replace with actual credentials for testing
        password: 'your_x_password', // Replace with actual credentials for testing
        // twoFactorCode: '123456', // Optional: if 2FA is enabled
        // phoneNumber: '+1234567890' // Optional: if phone verification is needed
      }
    };

    console.log('📋 Test Configuration:');
    console.log(`   Title: ${testVideoData.title}`);
    console.log(`   URL: ${testVideoData.url}`);
    console.log(`   Username: ${testVideoData.credentials.username}`);
    console.log(`   Password: ${'*'.repeat(testVideoData.credentials.password.length)}`);
    console.log('');

    console.log('🚀 Starting X.com promotion test...');
    
    // Test the promotion (this will test both login and posting)
    const result = await xPromoter.promote(testVideoData);
    
    console.log('\n📊 Test Results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Platform: ${result.platform}`);
    console.log(`   Type: ${result.type}`);
    
    if (result.success) {
      console.log(`   Post URL: ${result.postUrl}`);
      console.log(`   Content: ${result.content.substring(0, 100)}...`);
      console.log('\n✅ X.com automation test PASSED!');
    } else {
      console.log(`   Error: ${result.error}`);
      console.log('\n❌ X.com automation test FAILED!');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    try {
      await xPromoter.cleanup();
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
}

// Instructions for running the test
console.log('🔧 X.com Automation Test Setup');
console.log('');
console.log('⚠️  IMPORTANT: Before running this test:');
console.log('1. Edit this file and replace the credentials with real X.com account details');
console.log('2. Make sure you have a valid X.com account');
console.log('3. If you have 2FA enabled, uncomment and set the twoFactorCode');
console.log('4. The test will open a browser window - do not close it manually');
console.log('');
console.log('🚀 Starting test in 5 seconds...');
console.log('');

// Wait 5 seconds then run test
setTimeout(() => {
  testXAutomation().catch(console.error);
}, 5000);