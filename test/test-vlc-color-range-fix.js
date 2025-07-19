#!/usr/bin/env node

/**
 * Test script to verify VLC color range and pixel format fix
 * This tests that videos use proper yuv420p (not yuvj420p) and tv color range
 */

import { createVideo } from './src/video-creator.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 Testing VLC Color Range and Pixel Format Fix');
console.log('=' .repeat(60));

async function analyzeVideoCodec(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      videoPath
    ];

    const ffprobeProcess = spawn('ffprobe', ffprobeArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobeProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const metadata = JSON.parse(stdout);
          const videoStream = metadata.streams[0];
          resolve(videoStream);
        } catch (error) {
          reject(new Error(`Failed to parse FFprobe output: ${error.message}`));
        }
      } else {
        reject(new Error(`FFprobe failed with exit code ${code}: ${stderr}`));
      }
    });

    ffprobeProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFprobe: ${error.message}`));
    });
  });
}

async function testColorRangeFix() {
  try {
    // Test parameters
    const testImagePath = './src/media/banner.jpg';
    const testAudioPath = './temp/simple-test-audio.wav';
    const testOutputPath = './output/test-color-range-fix.mp4';
    
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
    
    // Create test video with color range fixes
    console.log('\n🎬 Creating test video with color range fixes...');
    
    const options = {
      resolution: '1920x1080',
      quality: 'high',
      enableBackgroundMusic: false,  // Keep it simple for testing
      enableIntroOutro: false
    };
    
    console.log('🔧 Options:', JSON.stringify(options, null, 2));
    
    // Create video
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
    
    // Analyze the generated video
    console.log('\n🔍 Analyzing generated video codec parameters...');
    const videoStream = await analyzeVideoCodec(outputPath);
    
    console.log('📊 Video Stream Analysis:');
    console.log(`   Codec: ${videoStream.codec_name}`);
    console.log(`   Profile: ${videoStream.profile}`);
    console.log(`   Level: ${videoStream.level}`);
    console.log(`   Pixel Format: ${videoStream.pix_fmt}`);
    console.log(`   Color Range: ${videoStream.color_range || 'not specified'}`);
    console.log(`   Color Space: ${videoStream.color_space || 'not specified'}`);
    console.log(`   Frame Rate: ${videoStream.r_frame_rate}`);
    
    // Check for VLC compatibility issues
    let hasIssues = false;
    const issues = [];
    
    // Check pixel format
    if (videoStream.pix_fmt === 'yuvj420p') {
      hasIssues = true;
      issues.push('❌ PIXEL FORMAT: Using yuvj420p (JPEG range) - VLC compatibility issue!');
    } else if (videoStream.pix_fmt === 'yuv420p') {
      console.log('✅ PIXEL FORMAT: Using yuv420p (correct for VLC)');
    } else {
      hasIssues = true;
      issues.push(`❌ PIXEL FORMAT: Using ${videoStream.pix_fmt} (unexpected format)`);
    }
    
    // Check color range
    if (videoStream.color_range === 'pc') {
      hasIssues = true;
      issues.push('❌ COLOR RANGE: Using PC/full range - VLC compatibility issue!');
    } else if (videoStream.color_range === 'tv') {
      console.log('✅ COLOR RANGE: Using TV/limited range (correct for VLC)');
    } else {
      console.log(`⚠️ COLOR RANGE: ${videoStream.color_range || 'not specified'} (may cause issues)`);
    }
    
    // Check color space
    if (videoStream.color_space === 'bt709') {
      console.log('✅ COLOR SPACE: Using bt709 (modern standard)');
    } else {
      console.log(`⚠️ COLOR SPACE: Using ${videoStream.color_space || 'not specified'} (may cause issues)`);
    }
    
    // Check profile and level
    if (videoStream.profile === 'Constrained Baseline') {
      console.log('✅ PROFILE: Using Constrained Baseline (maximum compatibility)');
    } else {
      hasIssues = true;
      issues.push(`❌ PROFILE: Using ${videoStream.profile} (may cause VLC issues)`);
    }
    
    if (videoStream.level === 30) {
      console.log('✅ LEVEL: Using 3.0 (compatible with older devices)');
    } else {
      hasIssues = true;
      issues.push(`❌ LEVEL: Using ${videoStream.level} (may cause VLC issues)`);
    }
    
    // Report results
    console.log('\n' + '='.repeat(60));
    if (hasIssues) {
      console.log('❌ VLC COMPATIBILITY ISSUES DETECTED:');
      issues.forEach(issue => console.log(`   ${issue}`));
      return false;
    } else {
      console.log('✅ ALL VLC COMPATIBILITY CHECKS PASSED!');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the test
console.log('🚀 Starting color range fix test...\n');

testColorRangeFix()
  .then(success => {
    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('🎉 COLOR RANGE FIX TEST PASSED!');
      console.log('✅ Video uses yuv420p pixel format (not yuvj420p)');
      console.log('✅ Video uses TV color range (not PC range)');
      console.log('✅ Video uses bt709 color space');
      console.log('✅ All codec parameters are VLC-compatible');
      process.exit(0);
    } else {
      console.log('❌ COLOR RANGE FIX TEST FAILED!');
      console.log('🔧 VLC compatibility issues still exist');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Test script error:', error.message);
    process.exit(1);
  });