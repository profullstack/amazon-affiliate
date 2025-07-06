import { createVideo, createSlideshow } from './src/video-creator.js';
import fs from 'fs/promises';

async function testVideoCreation() {
  console.log('🧪 Testing simplified video creation...');
  
  try {
    // Create test directories
    await fs.mkdir('./temp', { recursive: true });
    await fs.mkdir('./output', { recursive: true });
    
    // Create a simple test image (1x1 pixel PNG)
    const testImageData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x21, 0x08, 0x21, 0x08, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    const testImagePath = './temp/test-image.png';
    await fs.writeFile(testImagePath, testImageData);
    console.log('✅ Created test image');
    
    // Create a simple test audio file (silent WAV)
    const testAudioData = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x08, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      0x66, 0x6D, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x44, 0xAC, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00, 0x02, 0x00, 0x10, 0x00,
      0x64, 0x61, 0x74, 0x61, 0x00, 0x08, 0x00, 0x00
    ]);
    
    // Add 2 seconds of silence (44100 Hz * 2 seconds * 2 bytes per sample)
    const silenceData = Buffer.alloc(44100 * 2 * 2, 0);
    const fullAudioData = Buffer.concat([testAudioData, silenceData]);
    
    const testAudioPath = './temp/test-audio.wav';
    await fs.writeFile(testAudioPath, fullAudioData);
    console.log('✅ Created test audio file');
    
    // Test single image video creation
    console.log('🎬 Testing single image video creation...');
    const videoPath = './output/test-video.mp4';
    
    const result = await createVideo(testImagePath, testAudioPath, videoPath, {
      resolution: '640x480',
      fps: 24,
      quality: 28
    });
    
    console.log('✅ Video created successfully:', result);
    
    // Verify the video file exists and has content
    const stats = await fs.stat(result);
    console.log(`📊 Video file size: ${Math.round(stats.size / 1024)}KB`);
    
    if (stats.size > 1000) {
      console.log('🎉 Test passed! FFmpeg is working correctly.');
      return true;
    } else {
      console.log('⚠️ Video file is very small, might be an issue.');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

// Run the test
testVideoCreation()
  .then(success => {
    if (success) {
      console.log('\n✅ All tests passed! You can now run the main application.');
      console.log('Try: node src/index.js "https://www.amazon.com/dp/B0F1GMCQPB"');
    } else {
      console.log('\n❌ Tests failed. Please check the error messages above.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Unexpected test error:', error);
    process.exit(1);
  });