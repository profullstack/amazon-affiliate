import { createVideo } from './src/video-creator.js';
import fs from 'fs/promises';

async function simpleTest() {
  console.log('🧪 Running simple video creation test...');
  
  try {
    // Create test directories
    await fs.mkdir('./temp', { recursive: true });
    await fs.mkdir('./output', { recursive: true });
    
    // Create a simple 1x1 pixel PNG
    const testImageData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x21, 0x08, 0x21, 0x08, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    const testImagePath = './temp/simple-test-image.png';
    await fs.writeFile(testImagePath, testImageData);
    console.log('✅ Created test image');
    
    // Create a longer test audio file (5 seconds of silence)
    const sampleRate = 44100;
    const duration = 5; // 5 seconds
    const channels = 1;
    const bitsPerSample = 16;
    
    const numSamples = sampleRate * duration * channels;
    const dataSize = numSamples * (bitsPerSample / 8);
    
    // WAV header
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // PCM format size
    wavHeader.writeUInt16LE(1, 20);  // PCM format
    wavHeader.writeUInt16LE(channels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
    wavHeader.writeUInt16LE(channels * (bitsPerSample / 8), 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(dataSize, 40);
    
    // Silent audio data
    const silenceData = Buffer.alloc(dataSize, 0);
    const fullAudioData = Buffer.concat([wavHeader, silenceData]);
    
    const testAudioPath = './temp/simple-test-audio.wav';
    await fs.writeFile(testAudioPath, fullAudioData);
    console.log('✅ Created 5-second test audio file');
    
    // Test video creation
    console.log('🎬 Testing video creation...');
    const videoPath = './output/simple-test-video.mp4';
    
    const result = await createVideo(testImagePath, testAudioPath, videoPath, {
      resolution: '640x480',
      fps: 24,
      quality: 28
    });
    
    console.log('✅ Video created successfully:', result);
    
    // Verify the video file
    const stats = await fs.stat(result);
    console.log(`📊 Video file size: ${Math.round(stats.size / 1024)}KB`);
    
    if (stats.size > 1000) {
      console.log('🎉 Test passed! Video creation is working.');
      return true;
    } else {
      console.log('⚠️ Video file is very small, might be an issue.');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
simpleTest()
  .then(success => {
    if (success) {
      console.log('\n✅ Simple test completed successfully!');
      console.log('The video creator is working. You can now run the full application.');
    } else {
      console.log('\n❌ Simple test failed.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });