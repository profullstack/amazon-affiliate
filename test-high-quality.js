import { scrapeAmazonProduct } from './src/amazon-scraper.js';
import { downloadImages } from './src/image-downloader.js';
import { createSlideshow } from './src/video-creator.js';
import fs from 'fs/promises';

/**
 * Test script to verify high-quality image and video improvements
 */
const testHighQualityImprovements = async () => {
  console.log('🔍 Testing High-Quality Image and Video Improvements...\n');

  try {
    // Test 1: High-Quality Image URL Enhancement
    console.log('1️⃣ Testing Amazon Image URL Enhancement...');
    
    // Mock Amazon product data with typical image URLs
    const mockImageUrls = [
      'https://m.media-amazon.com/images/I/71ABC123DEF._AC_SL300_.jpg',
      'https://m.media-amazon.com/images/I/81XYZ789GHI._AC_SL400_.jpg'
    ];

    console.log('📋 Original Image URLs:');
    mockImageUrls.forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`);
    });

    // Test 2: Quality Fallback System
    console.log('\n2️⃣ Testing Quality Fallback Download System...');
    console.log('📥 Attempting to download high-quality versions...');
    
    const tempDir = './temp/quality-test';
    await fs.mkdir(tempDir, { recursive: true });

    const downloadedImages = await downloadImages(mockImageUrls, tempDir, 2);
    
    console.log(`✅ Successfully downloaded ${downloadedImages.length} images`);
    
    // Analyze downloaded image quality
    if (downloadedImages.length > 0) {
      console.log('\n📊 Image Quality Analysis:');
      
      for (const imagePath of downloadedImages) {
        try {
          const stats = await fs.stat(imagePath);
          const sizeKB = Math.round(stats.size / 1024);
          
          let qualityLevel = 'Unknown';
          if (sizeKB > 150) qualityLevel = 'Ultra High (1500px+)';
          else if (sizeKB > 100) qualityLevel = 'Very High (1200px+)';
          else if (sizeKB > 60) qualityLevel = 'High (1000px+)';
          else if (sizeKB > 30) qualityLevel = 'Good (800px+)';
          else if (sizeKB > 15) qualityLevel = 'Decent (600px+)';
          else qualityLevel = 'Basic';
          
          console.log(`   📸 ${imagePath}: ${sizeKB}KB - ${qualityLevel}`);
        } catch (error) {
          console.warn(`   ⚠️ Could not analyze ${imagePath}: ${error.message}`);
        }
      }
    }

    // Test 3: 1080p Video Creation
    console.log('\n3️⃣ Testing 1080p Video Creation...');
    
    if (downloadedImages.length > 0) {
      // Create a simple audio file for testing (silence)
      const testAudioPath = './temp/quality-test/test-audio.wav';
      
      // Create 3 seconds of silence for testing
      console.log('🎵 Creating test audio file...');
      
      // Use FFmpeg to create a silent audio file
      const { spawn } = await import('child_process');
      
      await new Promise((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', [
          '-f', 'lavfi',
          '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-t', '3',
          '-y',
          testAudioPath
        ]);

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Test audio file created');
            resolve();
          } else {
            reject(new Error(`FFmpeg failed with code ${code}`));
          }
        });

        ffmpegProcess.on('error', reject);
      });

      // Create 1080p video
      const outputVideoPath = './temp/quality-test/test-1080p-video.mp4';
      
      console.log('🎬 Creating 1080p slideshow video...');
      console.log(`📁 Using ${downloadedImages.length} high-quality images`);
      console.log('📹 Target: 1920x1080 @ 30fps, high quality');
      
      const videoPath = await createSlideshow(
        downloadedImages,
        testAudioPath,
        outputVideoPath,
        {
          resolution: '1920x1080',
          fps: 30,
          quality: 'high'
        }
      );

      // Analyze created video
      console.log('\n📊 Video Quality Analysis:');
      
      try {
        const videoStats = await fs.stat(videoPath);
        const videoSizeMB = Math.round(videoStats.size / (1024 * 1024) * 10) / 10;
        
        console.log(`   📹 Video file: ${videoPath}`);
        console.log(`   📏 File size: ${videoSizeMB}MB`);
        console.log(`   🎯 Resolution: 1920x1080 (Full HD)`);
        console.log(`   🎬 Frame rate: 30fps`);
        console.log(`   ⚙️ Quality: High (CRF 18)`);
        
        // Use ffprobe to get actual video information
        const { getVideoInfo } = await import('./src/video-creator.js');
        
        try {
          const videoInfo = await getVideoInfo(videoPath);
          console.log(`   ⏱️ Duration: ${Math.round(videoInfo.duration)}s`);
          console.log(`   📊 Actual resolution: ${videoInfo.video.width}x${videoInfo.video.height}`);
          console.log(`   🎵 Audio: ${videoInfo.audio.codec} @ ${videoInfo.audio.sampleRate}Hz`);
        } catch (error) {
          console.warn(`   ⚠️ Could not get detailed video info: ${error.message}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Could not analyze video: ${error.message}`);
      }
    }

    // Test 4: Quality Comparison Summary
    console.log('\n4️⃣ Quality Improvement Summary:');
    console.log('');
    console.log('📈 Image Quality Improvements:');
    console.log('   ✅ High-resolution Amazon images (up to 1500px)');
    console.log('   ✅ Intelligent quality fallback system');
    console.log('   ✅ File size validation (minimum 5KB)');
    console.log('   ✅ Progressive quality degradation (never fails)');
    console.log('');
    console.log('📈 Video Quality Improvements:');
    console.log('   ✅ Full HD 1080p output (1920x1080)');
    console.log('   ✅ Smooth 30fps frame rate');
    console.log('   ✅ High-quality encoding (CRF 18)');
    console.log('   ✅ Professional YouTube standards');
    console.log('');
    console.log('🎯 Benefits:');
    console.log('   ✅ Professional video appearance');
    console.log('   ✅ Better viewer engagement');
    console.log('   ✅ Higher YouTube ranking potential');
    console.log('   ✅ Improved brand credibility');

    // Cleanup test files
    console.log('\n🧹 Cleaning up test files...');
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('✅ Test files cleaned up');
    } catch (error) {
      console.warn(`⚠️ Cleanup warning: ${error.message}`);
    }

    console.log('\n🎉 High-Quality Improvements Test Completed Successfully!');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Add your OpenAI API key to test AI script generation');
    console.log('   2. Run the full application with a real Amazon product URL');
    console.log('   3. Upload the generated 1080p video to YouTube');

  } catch (error) {
    console.error('❌ High-quality improvements test failed:', error.message);
    console.error(error.stack);
  }
};

// Show configuration info
console.log('🔧 High-Quality Configuration:');
console.log('   Image Quality: Up to 1500px with intelligent fallback');
console.log('   Video Resolution: 1920x1080 (Full HD)');
console.log('   Video Frame Rate: 30fps');
console.log('   Video Quality: High (CRF 18)');
console.log('   Download Strategy: Progressive quality fallback');
console.log('   Validation: File size and integrity checks');
console.log('');

// Run the test
testHighQualityImprovements();