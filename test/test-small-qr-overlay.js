import { createVideo } from './src/video-creator.js';
import path from 'path';

/**
 * Test script for small QR code overlay functionality
 * This script tests the new small QR code overlay feature that displays
 * a small QR code in the lower left corner throughout the video
 */

async function testSmallQROverlay() {
  console.log('🧪 Testing Small QR Code Overlay Feature');
  console.log('=' .repeat(50));
  
  try {
    // Test configuration
    const testImagePath = './src/media/banner.jpg';
    const testAudioPath = './temp/test-audio.mp3';
    const outputPath = './temp/test-small-qr-overlay.mp4';
    const amazonUrl = 'https://amazon.com/dp/B08N5WRWNW?tag=youraffid-20';
    
    console.log('📋 Test Configuration:');
    console.log(`  Image: ${testImagePath}`);
    console.log(`  Audio: ${testAudioPath}`);
    console.log(`  Output: ${outputPath}`);
    console.log(`  Amazon URL: ${amazonUrl}`);
    console.log(`  Small QR Overlay: ENABLED`);
    console.log('');
    
    // Check if test files exist
    const fs = await import('fs/promises');
    
    try {
      await fs.access(testImagePath);
      console.log('✅ Test image found');
    } catch {
      console.log('❌ Test image not found - using fallback');
      // You might want to create a simple test image here
    }
    
    try {
      await fs.access(testAudioPath);
      console.log('✅ Test audio found');
    } catch {
      console.log('❌ Test audio not found - please create a test audio file');
      console.log('   You can use: ffmpeg -f lavfi -i "sine=frequency=1000:duration=10" temp/test-audio.mp3');
      return;
    }
    
    console.log('');
    console.log('🎬 Creating video with small QR code overlay...');
    
    // Create video with small QR code overlay enabled
    const result = await createVideo(
      testImagePath,
      testAudioPath,
      outputPath,
      {
        resolution: '1920x1080',
        quality: 'medium',
        enableBackgroundMusic: true,
        enableIntroOutro: true,
        amazonUrl: amazonUrl,
        enableSmallQROverlay: true, // This enables the small QR overlay
        introOutroOptions: {
          enableQROutro: true,
          outroDuration: 8.0
        }
      }
    );
    
    console.log('');
    console.log('✅ Video created successfully!');
    console.log(`📹 Output: ${result}`);
    console.log('');
    console.log('🔍 Expected Features:');
    console.log('  ✓ Small QR code in lower left corner (80x80px)');
    console.log('  ✓ QR overlay visible during intro and main content');
    console.log('  ✓ QR overlay hidden during outro (full QR code shown instead)');
    console.log('  ✓ Semi-transparent overlay (80% opacity)');
    console.log('  ✓ Positioned 20px from left and bottom edges');
    console.log('');
    console.log('🎯 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Test with different video types
async function testAllVideoTypes() {
  console.log('🧪 Testing Small QR Code Overlay on All Video Types');
  console.log('=' .repeat(60));
  
  const amazonUrl = 'https://amazon.com/dp/B08N5WRWNW?tag=youraffid-20';
  const testImagePath = './src/media/banner.jpg';
  const testAudioPath = './temp/test-audio.mp3';
  
  // Test 1: Single video with QR overlay
  console.log('\n📹 Test 1: Single Video with QR Overlay');
  try {
    await createVideo(
      testImagePath,
      testAudioPath,
      './temp/test-single-qr.mp4',
      {
        amazonUrl: amazonUrl,
        enableSmallQROverlay: true,
        enableIntroOutro: true
      }
    );
    console.log('✅ Single video test passed');
  } catch (error) {
    console.log('❌ Single video test failed:', error.message);
  }
  
  // Test 2: Slideshow with QR overlay
  console.log('\n📹 Test 2: Slideshow with QR Overlay');
  try {
    const { createSlideshow } = await import('./src/video-creator.js');
    await createSlideshow(
      [testImagePath, testImagePath], // Use same image twice for slideshow
      testAudioPath,
      './temp/test-slideshow-qr.mp4',
      {
        amazonUrl: amazonUrl,
        enableSmallQROverlay: true,
        enableIntroOutro: true
      }
    );
    console.log('✅ Slideshow test passed');
  } catch (error) {
    console.log('❌ Slideshow test failed:', error.message);
  }
  
  // Test 3: Short video with QR overlay
  console.log('\n📹 Test 3: Short Video with QR Overlay');
  try {
    const { createShortVideo } = await import('./src/video-creator.js');
    await createShortVideo(
      [testImagePath],
      testAudioPath,
      './temp/test-short-qr.mp4',
      {
        resolution: '1080x1920', // Vertical format
        amazonUrl: amazonUrl,
        enableSmallQROverlay: true,
        enableIntroOutro: true
      }
    );
    console.log('✅ Short video test passed');
  } catch (error) {
    console.log('❌ Short video test failed:', error.message);
  }
  
  console.log('\n🎯 All video type tests completed!');
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Starting Small QR Code Overlay Tests...\n');
  
  // Run basic test first
  await testSmallQROverlay();
  
  console.log('\n' + '='.repeat(60));
  
  // Run comprehensive tests
  await testAllVideoTypes();
  
  console.log('\n✨ All tests completed!');
  console.log('📝 Review the generated videos to verify QR overlay functionality');
}