#!/usr/bin/env node

/**
 * Test script to verify that both main and short videos use the same processed images
 */

import { createAffiliateVideo } from './src/index.js';
import fs from 'fs/promises';
import path from 'path';

async function testImageConsistency() {
  console.log('🧪 Testing image consistency between main and short videos...\n');
  
  const testProductId = 'B0CPZKLJX1'; // Pelican Catch PWR 100 Kayak
  
  const options = {
    tempDir: './test-temp',
    outputDir: './test-output',
    maxImages: 3,
    cleanup: false, // Keep files for inspection
    createShortVideo: true,
    autoUpload: false,
    onProgress: (progress) => {
      console.log(`[${progress.step}] ${progress.progress}% - ${progress.message}`);
    }
  };
  
  try {
    // Clean up any existing test files
    try {
      await fs.rm('./test-temp', { recursive: true, force: true });
      await fs.rm('./test-output', { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    console.log('🚀 Starting video creation with image consistency test...\n');
    
    const result = await createAffiliateVideo(testProductId, options);
    
    if (result.success) {
      console.log('\n✅ Video creation completed successfully!');
      console.log('\n📊 Analyzing image usage...');
      
      // Check what images were created
      const tempFiles = await fs.readdir('./test-temp');
      const originalImages = tempFiles.filter(f => f.startsWith('image-') && f.endsWith('.jpg') && !f.includes('smart-bg'));
      const smartBgImages = tempFiles.filter(f => f.startsWith('image-') && f.includes('smart-bg.jpg'));
      
      console.log(`\n📁 Temp directory contents:`);
      console.log(`   🖼️  Original images: ${originalImages.length}`);
      console.log(`   🎨 Smart background images: ${smartBgImages.length}`);
      
      if (smartBgImages.length > 0) {
        console.log('\n✅ Smart background images were created:');
        smartBgImages.forEach(img => console.log(`   📸 ${img}`));
      } else {
        console.log('\n⚠️  No smart background images found');
      }
      
      // Check result files
      console.log(`\n📹 Video files created:`);
      if (result.files.video) {
        const videoStats = await fs.stat(result.files.video);
        console.log(`   🎬 Main video: ${path.basename(result.files.video)} (${Math.round(videoStats.size / 1024)}KB)`);
      }
      
      if (result.files.shortVideo) {
        const shortVideoStats = await fs.stat(result.files.shortVideo);
        console.log(`   📱 Short video: ${path.basename(result.files.shortVideo)} (${Math.round(shortVideoStats.size / 1024)}KB)`);
      }
      
      // Check if processed images were used
      if (result.files.processedImages && result.files.processedImages.length > 0) {
        console.log(`\n🎨 Processed images used for both videos:`);
        result.files.processedImages.forEach((img, index) => {
          const isSmartBg = path.basename(img).includes('smart-bg');
          console.log(`   ${index + 1}. ${path.basename(img)} ${isSmartBg ? '(smart background)' : '(original)'}`);
        });
        
        const allSmartBg = result.files.processedImages.every(img => path.basename(img).includes('smart-bg'));
        if (allSmartBg) {
          console.log('\n✅ SUCCESS: Both videos use the same smart background images!');
        } else {
          console.log('\n⚠️  WARNING: Videos are using original images (smart background processing may have failed)');
        }
      } else {
        console.log('\n❌ ERROR: No processed images information available');
      }
      
      console.log('\n🔍 Test completed. Check the video files to verify image consistency.');
      console.log(`📁 Files saved in: ${options.outputDir}`);
      console.log(`🗂️  Temp files in: ${options.tempDir} (not cleaned up for inspection)`);
      
    } else {
      console.error('\n❌ Video creation failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testImageConsistency();