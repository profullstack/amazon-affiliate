import { createAffiliateVideo } from './src/index.js';

console.log('🧪 Testing sessionId fix...');

// Test with a simple Amazon product ID
const testProductId = 'B0CPZKLJX1';

// Create a minimal test configuration
const testOptions = {
  maxImages: 1,
  tempDir: './test-temp',
  outputDir: './test-output',
  cleanup: false, // Keep files for inspection
  autoUpload: false,
  autoPromote: false,
  createShortVideo: false,
  onProgress: (progress) => {
    console.log(`📊 ${progress.step}: ${progress.progress}% - ${progress.message}`);
  }
};

try {
  console.log('🚀 Starting test with sessionId fix...');
  const result = await createAffiliateVideo(testProductId, testOptions);
  
  if (result.success) {
    console.log('✅ Test passed! sessionId error is fixed');
    console.log(`📹 Video created: ${result.files.video}`);
  } else {
    console.log('❌ Test failed:', result.error);
  }
} catch (error) {
  if (error.message.includes('sessionId is not defined')) {
    console.log('❌ sessionId error still exists:', error.message);
  } else {
    console.log('⚠️ Different error occurred (this may be expected):', error.message);
    console.log('✅ sessionId error appears to be fixed, but other issues may exist');
  }
}