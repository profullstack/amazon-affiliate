#!/usr/bin/env node

import { createShortVideo } from './src/video-creator.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Test script to verify the scaling fix for short videos
 * This ensures images fit within the frame with proper padding
 */

async function testScalingFix() {
  console.log('🧪 Testing scaling fix for short videos...');
  
  // Use existing test images
  const testImages = [
    'test-temp/image-1.jpg',
    'test-temp/image-2.jpg'
  ];
  
  // Check if test images exist
  for (const imagePath of testImages) {
    try {
      await fs.access(imagePath);
      console.log(`✅ Found test image: ${imagePath}`);
    } catch (error) {
      console.log(`❌ Missing test image: ${imagePath}`);
      return;
    }
  }
  
  // Use existing audio file
  const audioPath = 'test-output/pelican-catch-pwr-100-279917.mp3';
  try {
    await fs.access(audioPath);
    console.log(`✅ Found test audio: ${audioPath}`);
  } catch (error) {
    console.log(`❌ Missing test audio: ${audioPath}`);
    console.log('⏳ Waiting for main process to generate audio...');
    return;
  }
  
  const outputPath = 'test-output/scaling-fix-test-short.mp4';
  
  try {
    console.log('\n🎬 Creating test short video with scaling fix...');
    console.log('📐 Expected behavior: Images should fit within 1080x1920 frame with black padding');
    
    const result = await createShortVideo(testImages, audioPath, outputPath, {
      resolution: '1080x1920',
      quality: 'high'
    });
    
    console.log(`✅ Test video created: ${result}`);
    
    // Check file size
    const stats = await fs.stat(result);
    console.log(`📊 File size: ${Math.round(stats.size / 1024)}KB`);
    
    console.log('\n🔍 To verify the fix:');
    console.log('1. Open the video in a browser or media player');
    console.log('2. Check that images fit within the frame');
    console.log('3. Verify black padding fills empty space (top/bottom for wide images, left/right for tall images)');
    console.log('4. Ensure no image content is cropped off');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testScalingFix().catch(console.error);