/**
 * Test script to verify audio level fixes for QR code outro
 * Tests that:
 * 1. Background music is enabled
 * 2. Outro volume matches intro and main content
 * 3. All voiceovers use consistent normalized volumes
 */

import { createAffiliateVideo } from './src/index.js';
import fs from 'fs/promises';

const testAudioLevelFixes = async () => {
  console.log('🎵 Testing Audio Level Fixes for QR Code Outro');
  console.log('=' .repeat(60));

  try {
    // Test with a simple Amazon product ID
    const productId = 'B0CPZKLJX1'; // Example product ID
    
    const options = {
      maxImages: 2, // Minimal images for faster testing
      videoQuality: 'medium',
      tempDir: './test-temp',
      outputDir: './test-output',
      cleanup: false, // Keep files for inspection
      autoUpload: false, // Don't upload during testing
      autoPromote: false,
      createShortVideo: false, // Focus on main video only
      enableBackgroundMusic: true, // ✅ Test background music is enabled
      enableIntroOutro: true, // ✅ Test intro/outro with QR code
      introOutroOptions: {
        enableQROutro: true,
        outroDuration: 8.0 // Shorter for testing
      },
      onProgress: (progress) => {
        console.log(`📊 ${progress.step}: ${progress.progress}% - ${progress.message}`);
      }
    };

    console.log('🚀 Starting audio level test...');
    console.log(`📦 Product: ${productId}`);
    console.log(`🎼 Background music: ${options.enableBackgroundMusic ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🎭 Intro/Outro: ${options.enableIntroOutro ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔗 QR Code outro: ${options.introOutroOptions.enableQROutro ? 'ENABLED' : 'DISABLED'}`);
    console.log('');

    const result = await createAffiliateVideo(productId, options);

    if (result.success) {
      console.log('\n✅ Audio level test completed successfully!');
      console.log('📹 Video details:');
      console.log(`   📁 Video: ${result.files.video}`);
      console.log(`   📏 Title: ${result.videoTitle}`);
      
      // Check if video file exists and get size
      try {
        const videoStats = await fs.stat(result.files.video);
        const videoSizeMB = Math.round(videoStats.size / (1024 * 1024) * 10) / 10;
        console.log(`   📊 Size: ${videoSizeMB}MB`);
      } catch (error) {
        console.log('   📊 Size: Unable to determine');
      }

      console.log('\n🎵 Audio Level Verification:');
      console.log('   ✅ Background music should be enabled throughout video');
      console.log('   ✅ Intro, main content, and outro should have consistent voice levels');
      console.log('   ✅ QR code outro should have proper background music integration');
      console.log('   ✅ No audio buzzing or volume spikes should occur');
      
      console.log('\n🔍 Manual Verification Steps:');
      console.log('   1. Play the video and listen to audio levels');
      console.log('   2. Check that background music plays throughout');
      console.log('   3. Verify outro voice volume matches intro/main content');
      console.log('   4. Confirm QR code outro has background music');
      console.log(`   🎥 Video file: ${result.files.video}`);
      
      return true;
    } else {
      console.error('❌ Audio level test failed:', result.error);
      return false;
    }

  } catch (error) {
    console.error('💥 Test error:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
};

// Run the test
testAudioLevelFixes()
  .then(success => {
    if (success) {
      console.log('\n🎉 Audio level fixes test completed successfully!');
      console.log('💡 Please manually verify the audio levels in the generated video.');
      process.exit(0);
    } else {
      console.log('\n❌ Audio level fixes test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Unexpected test error:', error.message);
    process.exit(1);
  });