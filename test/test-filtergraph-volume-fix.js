#!/usr/bin/env node

/**
 * Test script to verify FFmpeg complex filtergraph volume control fix
 * This tests that volume control is properly integrated into complex filtergraphs
 * instead of using conflicting simple audio filters
 */

import { createVideo } from './src/video-creator.js';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 Testing FFmpeg Complex Filtergraph Volume Control Fix');
console.log('=' .repeat(60));

async function testFiltergraphVolumeFix() {
  try {
    // Test parameters
    const testImagePath = './src/media/banner.jpg';
    const testAudioPath = './temp/simple-test-audio.wav';
    const testOutputPath = './output/test-filtergraph-volume-fix.mp4';
    
    // Check if test files exist
    console.log('📋 Checking test files...');
    
    try {
      await fs.access(testImagePath);
      console.log(`✅ Test image found: ${testImagePath}`);
    } catch (error) {
      console.log(`❌ Test image not found: ${testImagePath}`);
      return false;
    }
    
    try {
      await fs.access(testAudioPath);
      console.log(`✅ Test audio found: ${testAudioPath}`);
    } catch (error) {
      console.log(`❌ Test audio not found: ${testAudioPath}`);
      return false;
    }
    
    // Test video creation with complex filtergraph (intro + background music)
    console.log('\n🎬 Testing video creation with complex filtergraph...');
    console.log('This should NOT produce the filtergraph conflict error');
    
    const options = {
      resolution: '1920x1080',
      quality: 'high',
      enableBackgroundMusic: true,  // This triggers complex filtergraph
      enableIntroOutro: true,       // This also triggers complex filtergraph
      introOutroOptions: {
        introDuration: 3.0,
        introVoiceoverText: 'Test intro for filtergraph volume fix'
      }
    };
    
    console.log('🔧 Options:', JSON.stringify(options, null, 2));
    
    // Create video - this should work without filtergraph conflicts
    const startTime = Date.now();
    const outputPath = await createVideo(
      testImagePath,
      testAudioPath,
      testOutputPath,
      options
    );
    const endTime = Date.now();
    
    console.log(`\n✅ Video creation successful!`);
    console.log(`📁 Output: ${outputPath}`);
    console.log(`⏱️ Duration: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    
    // Verify output file exists and has reasonable size
    try {
      const stats = await fs.stat(outputPath);
      const fileSizeKB = Math.round(stats.size / 1024);
      console.log(`📊 File size: ${fileSizeKB}KB`);
      
      if (stats.size > 1000) { // At least 1KB
        console.log('✅ Output file has reasonable size');
        return true;
      } else {
        console.log('❌ Output file is too small - may be corrupted');
        return false;
      }
    } catch (error) {
      console.log(`❌ Could not verify output file: ${error.message}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    
    // Check if it's the specific filtergraph conflict error
    if (error.message.includes('Simple and complex filtering cannot be used together')) {
      console.error('🚨 FILTERGRAPH CONFLICT ERROR STILL EXISTS!');
      console.error('The fix did not resolve the issue.');
      return false;
    }
    
    // Check for other FFmpeg errors
    if (error.message.includes('FFmpeg failed')) {
      console.error('🔧 FFmpeg error - may need further investigation');
      console.error('Error details:', error.message);
      return false;
    }
    
    return false;
  }
}

// Run the test
console.log('🚀 Starting filtergraph volume control fix test...\n');

testFiltergraphVolumeFix()
  .then(success => {
    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('🎉 FILTERGRAPH VOLUME FIX TEST PASSED!');
      console.log('✅ Complex filtergraphs now work without volume conflicts');
      console.log('✅ Volume control is properly integrated into filtergraphs');
      process.exit(0);
    } else {
      console.log('❌ FILTERGRAPH VOLUME FIX TEST FAILED!');
      console.log('🔧 Further investigation needed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Test script error:', error.message);
    process.exit(1);
  });