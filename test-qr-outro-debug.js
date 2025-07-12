import { createAffiliateVideo } from './src/index.js';

/**
 * Test script to debug QR code outro functionality
 * This will help us trace where the QR code outro is failing
 */
async function testQROutroDebug() {
  console.log('🔍 Testing QR code outro with debug logging...');
  
  try {
    const result = await createAffiliateVideo('B0CPZKLJX1', {
      maxImages: 2,
      tempDir: './temp',
      outputDir: './output',
      videoQuality: 'medium',
      cleanup: false, // Keep files for debugging
      autoUpload: false, // Don't upload, just create videos
      createShortVideo: true,
      enableBackgroundMusic: false, // Disabled per CLI settings
      enableIntroOutro: true, // Enable intro/outro for QR code
      introOutroOptions: {
        enableQROutro: true, // Explicitly enable QR code outro
        outroDuration: 10.0
      },
      onProgress: (progress) => {
        console.log(`📊 Progress: ${progress.progress}% - ${progress.step}: ${progress.message}`);
      }
    });
    
    if (result.success) {
      console.log('✅ Test completed successfully!');
      console.log(`📹 Main video: ${result.files.video}`);
      console.log(`📱 Short video: ${result.files.shortVideo}`);
      
      // Check if files exist
      const fs = await import('fs/promises');
      
      try {
        await fs.access(result.files.video);
        console.log('✅ Main video file exists');
      } catch {
        console.log('❌ Main video file missing');
      }
      
      if (result.files.shortVideo) {
        try {
          await fs.access(result.files.shortVideo);
          console.log('✅ Short video file exists');
        } catch {
          console.log('❌ Short video file missing');
        }
      }
      
    } else {
      console.error('❌ Test failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Test error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testQROutroDebug();