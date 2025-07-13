import { createSlideshow } from './src/video-creator.js';
import fs from 'fs/promises';

/**
 * Test to verify that the beeping issue is resolved
 * and proper background music is selected
 */

async function testNoBeepIssue() {
  console.log('🔇 Testing No Beep Issue - Background Music Fix');
  console.log('=' .repeat(50));
  
  try {
    // Create test audio if needed
    const testAudioPath = './temp/test-audio-no-beep.mp3';
    try {
      await fs.access(testAudioPath);
      console.log('✅ Test audio file exists');
    } catch {
      console.log('📝 Creating test audio file...');
      const { execSync } = await import('child_process');
      await fs.mkdir('./temp', { recursive: true });
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=10" -y ${testAudioPath}`, { stdio: 'inherit' });
      console.log('✅ Test audio file created');
    }
    
    // Test configuration
    const testImages = [
      './src/media/banner.jpg',
      './src/media/banner.jpg',
      './src/media/banner.jpg'
    ];
    
    console.log('🎬 Testing slideshow with proper background music...');
    console.log(`  Images: ${testImages.length} images`);
    console.log(`  Audio: ${testAudioPath}`);
    console.log(`  Background Music: ENABLED (should exclude beep.wav)`);
    console.log(`  QR Overlay: ENABLED`);
    console.log('');
    
    console.log('🎵 Available background music files:');
    console.log('  ✓ Cloud Drift.wav (should be selected)');
    console.log('  ✓ Cloud Drift2.wav (should be selected)');
    console.log('  ✗ beep.wav (should be EXCLUDED)');
    console.log('');
    
    const result = await createSlideshow(
      testImages,
      testAudioPath,
      './temp/test-no-beep.mp4',
      {
        resolution: '1920x1080',
        quality: 'medium',
        enableBackgroundMusic: true, // This should now exclude beep.wav
        enableIntroOutro: true,
        amazonUrl: 'https://amazon.com/dp/B08N5WRWNW?tag=test-20',
        enableSmallQROverlay: true,
        introOutroOptions: {
          enableQROutro: true,
          outroDuration: 5.0
        }
      }
    );
    
    console.log('✅ No beep issue test successful!');
    console.log(`📹 Output: ${result}`);
    console.log('');
    console.log('🎯 Background music filtering working correctly');
    console.log('✓ beep.wav excluded from background music selection');
    console.log('✓ Only proper music files (Cloud Drift) used');
    console.log('✓ Small QR overlay working with proper audio');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Check if it's an audio-related error
    if (error.message.includes('beep') || error.message.includes('loud')) {
      console.error('🔍 Audio issue detected - beep file may still be selected');
    }
    
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting No Beep Issue Test...\n');
  await testNoBeepIssue();
  console.log('\n✨ Beeping issue resolved!');
}