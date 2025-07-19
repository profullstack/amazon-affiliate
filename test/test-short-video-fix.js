import { createShortVideo } from './src/video-creator.js';
import fs from 'fs/promises';

async function testShortVideoFix() {
  console.log('🧪 Testing short video fix with existing smart background images...');
  
  try {
    // Check what smart background images exist
    const tempFiles = await fs.readdir('./temp');
    const smartBgImages = tempFiles
      .filter(f => f.includes('smart-bg'))
      .map(f => `./temp/${f}`)
      .sort();
    
    console.log('🎨 Found smart background images:', smartBgImages);
    
    if (smartBgImages.length === 0) {
      console.log('❌ No smart background images found. Run the main workflow first.');
      return;
    }
    
    // Check if audio file exists
    const audioPath = './temp/test-audio.wav';
    try {
      await fs.access(audioPath);
      console.log('🎵 Found audio file:', audioPath);
    } catch {
      console.log('❌ Audio file not found. Using a simple test audio.');
      // Create a simple test audio file (1 second of silence)
      // This is just for testing - in real usage, the audio would be generated
      console.log('⚠️ Skipping test - no audio file available');
      return;
    }
    
    // Test short video creation with smart background images
    const outputPath = './output/test-short-video-fix.mp4';
    
    console.log('📱 Creating short video with smart background images...');
    const result = await createShortVideo(
      smartBgImages,
      audioPath,
      outputPath,
      {
        resolution: '1080x1920',
        quality: 'high'
      }
    );
    
    console.log('✅ Short video created successfully:', result);
    
    // Check the output file
    const stats = await fs.stat(result);
    console.log(`📊 Video size: ${Math.round(stats.size / 1024)}KB`);
    
    // Extract a frame to verify it has content
    console.log('🔍 Extracting frame to verify content...');
    const { spawn } = await import('child_process');
    
    const ffmpegProcess = spawn('ffmpeg', [
      '-i', result,
      '-ss', '00:00:02',
      '-vframes', '1',
      '-y',
      'test-short-fix-frame.jpg'
    ]);
    
    ffmpegProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const frameStats = await fs.stat('test-short-fix-frame.jpg');
          console.log(`✅ Frame extracted: ${frameStats.size} bytes`);
          
          // Check if frame has content (not just black)
          const { spawn: spawnIdentify } = await import('child_process');
          const identifyProcess = spawnIdentify('identify', ['-verbose', 'test-short-fix-frame.jpg']);
          
          let output = '';
          identifyProcess.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          identifyProcess.on('close', (code) => {
            if (code === 0) {
              const meanMatch = output.match(/mean: ([\d.]+)/);
              if (meanMatch) {
                const mean = parseFloat(meanMatch[1]);
                console.log(`📊 Frame mean brightness: ${mean}`);
                if (mean > 50) {
                  console.log('✅ Frame appears to have visible content (not black)');
                } else {
                  console.log('⚠️ Frame appears dark - may still have image issues');
                }
              }
            }
          });
        } catch (error) {
          console.log('⚠️ Could not analyze frame:', error.message);
        }
      } else {
        console.log('❌ Failed to extract frame for analysis');
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testShortVideoFix();