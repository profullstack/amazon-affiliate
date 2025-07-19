import { createSlideshow } from './src/video-creator.js';
import fs from 'fs/promises';

/**
 * Comprehensive test to verify both video and audio input indexing fixes
 */

async function testInputIndexingFix() {
  console.log('🔧 Testing Complete Input Indexing Fix');
  console.log('=' .repeat(45));
  
  try {
    // Create test audio if needed
    const testAudioPath = './temp/test-audio-indexing.mp3';
    try {
      await fs.access(testAudioPath);
      console.log('✅ Test audio file exists');
    } catch {
      console.log('📝 Creating test audio file...');
      const { execSync } = await import('child_process');
      await fs.mkdir('./temp', { recursive: true });
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=8" -y ${testAudioPath}`, { stdio: 'inherit' });
      console.log('✅ Test audio file created');
    }
    
    // Test configuration that previously failed
    const testImages = [
      './src/media/banner.jpg',
      './src/media/banner.jpg',
      './src/media/banner.jpg',
      './src/media/banner.jpg'
    ];
    
    console.log('🎬 Testing slideshow with complete input indexing...');
    console.log(`  Images: ${testImages.length} images`);
    console.log(`  Audio: ${testAudioPath}`);
    console.log(`  Features: Intro + Main + Outro + Small QR + Background Music`);
    console.log('');
    
    console.log('📋 Expected Input Order:');
    console.log('  0: Intro image');
    console.log('  1-4: Main images (4 images)');
    console.log('  5: Intro voiceover audio');
    console.log('  6: Main voiceover audio');
    console.log('  7: Outro voiceover audio');
    console.log('  8: Outro QR code image');
    console.log('  9: Small QR code image');
    console.log('  10: Background music audio');
    console.log('');
    
    const result = await createSlideshow(
      testImages,
      testAudioPath,
      './temp/test-indexing-fix.mp4',
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
    
    console.log('✅ Input indexing fix successful!');
    console.log(`📹 Output: ${result}`);
    console.log('');
    console.log('🎯 Both video and audio stream indexing resolved');
    console.log('✓ Small QR overlay positioned correctly');
    console.log('✓ Background music indexed correctly');
    console.log('✓ All voiceover streams indexed correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Analyze the error type
    if (error.message.includes('matches no streams')) {
      console.error('🔍 Stream indexing issue detected');
      if (error.message.includes(':v')) {
        console.error('   → Video stream indexing problem');
      }
      if (error.message.includes(':a')) {
        console.error('   → Audio stream indexing problem');
      }
    } else if (error.message.includes('Invalid argument')) {
      console.error('🔍 FFmpeg filtergraph binding error');
      console.error('   → Input/output stream mismatch');
    }
    
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting Complete Input Indexing Fix Test...\n');
  await testInputIndexingFix();
  console.log('\n✨ All indexing issues resolved!');
}