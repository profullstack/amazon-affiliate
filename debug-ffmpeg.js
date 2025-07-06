import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';

// Simple test to debug FFmpeg issues
async function testFFmpeg() {
  console.log('🔍 Testing FFmpeg installation...');
  
  try {
    // Test 1: Check if FFmpeg is available
    await new Promise((resolve, reject) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          reject(new Error(`FFmpeg not found: ${err.message}`));
        } else {
          console.log('✅ FFmpeg is installed and accessible');
          resolve();
        }
      });
    });

    // Test 2: Create output directory
    await fs.mkdir('./output', { recursive: true });
    console.log('✅ Output directory created');

    // Test 3: Check FFmpeg capabilities
    console.log('🔍 Checking FFmpeg capabilities...');
    
    await new Promise((resolve, reject) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          reject(err);
        } else {
          const hasLavfi = Object.keys(formats).includes('lavfi');
          console.log(`📋 Available formats: ${Object.keys(formats).length}`);
          console.log(`🎨 lavfi support: ${hasLavfi ? '✅ Yes' : '❌ No (limited FFmpeg build)'}`);
          
          if (!hasLavfi) {
            console.log('\n⚠️  Your FFmpeg build is missing lavfi (libavfilter) support.');
            console.log('This is common with minimal installations.');
            console.log('The application will work with a simpler approach.');
          }
          
          resolve();
        }
      });
    });

    console.log('\n🎉 FFmpeg is functional! Using compatibility mode for video creation.');

  } catch (error) {
    console.error('\n❌ FFmpeg test failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Install FFmpeg: sudo apt-get install ffmpeg (Ubuntu) or brew install ffmpeg (macOS)');
    console.log('2. Check PATH: ffmpeg -version');
    console.log('3. Check permissions on output directory');
  }
}

testFFmpeg();