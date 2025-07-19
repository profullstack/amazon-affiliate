import { createSlideshow } from './src/video-creator.js';
import fs from 'fs/promises';

/**
 * Quick test to verify the QR overlay input indexing fix
 */

async function testQROverlayFix() {
  console.log('🔧 Testing QR Overlay Input Index Fix');
  console.log('=' .repeat(40));
  
  try {
    // Create a simple test audio file if it doesn't exist
    const testAudioPath = './temp/test-audio-short.mp3';
    try {
      await fs.access(testAudioPath);
      console.log('✅ Test audio file exists');
    } catch {
      console.log('📝 Creating test audio file...');
      const { execSync } = await import('child_process');
      await fs.mkdir('./temp', { recursive: true });
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -y ${testAudioPath}`, { stdio: 'inherit' });
      console.log('✅ Test audio file created');
    }
    
    // Test with slideshow (the failing case from the error)
    const testImages = [
      './src/media/banner.jpg',
      './src/media/banner.jpg',
      './src/media/banner.jpg',
      './src/media/banner.jpg'
    ];
    
    console.log('🎬 Testing slideshow with QR overlay...');
    console.log(`  Images: ${testImages.length} images`);
    console.log(`  Audio: ${testAudioPath}`);
    console.log(`  QR Overlay: ENABLED`);
    console.log('');
    
    const result = await createSlideshow(
      testImages,
      testAudioPath,
      './temp/test-qr-fix.mp4',
      {
        resolution: '1920x1080',
        quality: 'medium',
        enableBackgroundMusic: true,
        enableIntroOutro: true,
        amazonUrl: 'https://amazon.com/dp/B08N5WRWNW?tag=test-20',
        enableSmallQROverlay: true,
        introOutroOptions: {
          enableQROutro: true,
          outroDuration: 5.0
        }
      }
    );
    
    console.log('✅ QR overlay fix successful!');
    console.log(`📹 Output: ${result}`);
    console.log('');
    console.log('🎯 Input indexing issue resolved');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Check if it's still the same input indexing error
    if (error.message.includes('matches no streams') || error.message.includes('Invalid argument')) {
      console.error('🔍 This appears to be the same input indexing issue');
      console.error('   The fix may need further adjustment');
    }
    
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting QR Overlay Fix Test...\n');
  await testQROverlayFix();
  console.log('\n✨ Test completed successfully!');
}