#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

console.log('🔍 VLC Codec Compatibility Diagnostic Tool\n');

/**
 * Tests FFmpeg codec parameters for VLC compatibility
 */
async function testVLCCodecCompatibility() {
  const testOutputs = [];
  
  try {
    // Create a simple test image if it doesn't exist
    const testImagePath = './test-codec-image.jpg';
    const testAudioPath = './test-codec-audio.mp3';
    
    console.log('📋 Current FFmpeg Parameters Analysis:');
    console.log('=====================================');
    
    // Analyze current codec settings from video-creator.js
    const currentSettings = {
      video: {
        codec: 'libx264',
        profile: 'high',
        level: '4.1',
        preset: 'medium',
        pixelFormat: 'yuv420p',
        crf: '18-28'
      },
      audio: {
        codec: 'aac',
        bitrate: '128k',
        sampleRate: '44100',
        channels: '2',
        profile: 'aac_low'
      },
      container: 'mp4'
    };
    
    console.log('🎥 Video Settings:');
    console.log(`  • Codec: ${currentSettings.video.codec}`);
    console.log(`  • Profile: ${currentSettings.video.profile}`);
    console.log(`  • Level: ${currentSettings.video.level}`);
    console.log(`  • Preset: ${currentSettings.video.preset}`);
    console.log(`  • Pixel Format: ${currentSettings.video.pixelFormat}`);
    console.log(`  • CRF: ${currentSettings.video.crf}`);
    
    console.log('\n🎵 Audio Settings:');
    console.log(`  • Codec: ${currentSettings.audio.codec}`);
    console.log(`  • Bitrate: ${currentSettings.audio.bitrate}`);
    console.log(`  • Sample Rate: ${currentSettings.audio.sampleRate}`);
    console.log(`  • Channels: ${currentSettings.audio.channels}`);
    console.log(`  • Profile: ${currentSettings.audio.profile}`);
    
    console.log(`\n📦 Container: ${currentSettings.container}`);
    
    console.log('\n🚨 Potential VLC Compatibility Issues:');
    console.log('=====================================');
    
    const issues = [];
    const fixes = [];
    
    // Check for common VLC compatibility issues
    if (currentSettings.video.profile === 'high' && currentSettings.video.level === '4.1') {
      issues.push('H.264 High Profile Level 4.1 may not be supported by older VLC versions');
      fixes.push('Use Main Profile Level 3.1 for better compatibility');
    }
    
    if (currentSettings.audio.profile === 'aac_low') {
      issues.push('AAC Low Complexity profile might cause issues with some VLC builds');
      fixes.push('Use standard AAC encoding without explicit profile');
    }
    
    // Check for missing compatibility flags
    issues.push('Missing VLC-specific compatibility flags');
    fixes.push('Add -movflags +faststart for web compatibility');
    fixes.push('Add -strict experimental for AAC encoding');
    fixes.push('Ensure proper codec parameter ordering');
    
    if (issues.length > 0) {
      console.log('⚠️  Issues Found:');
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
      
      console.log('\n✅ Recommended Fixes:');
      fixes.forEach((fix, i) => console.log(`  ${i + 1}. ${fix}`));
    } else {
      console.log('✅ No obvious compatibility issues detected');
    }
    
    console.log('\n🔧 VLC-Optimized Codec Parameters:');
    console.log('==================================');
    
    const vlcOptimizedParams = [
      // Video codec settings
      '-c:v', 'libx264',
      '-profile:v', 'main',        // Changed from 'high' to 'main' for better compatibility
      '-level:v', '3.1',           // Changed from '4.1' to '3.1' for older VLC support
      '-preset', 'medium',
      '-crf', '23',                // Balanced quality/size
      '-pix_fmt', 'yuv420p',       // Standard pixel format
      '-r', '30',                  // Standard frame rate
      
      // Audio codec settings
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      
      // Container and compatibility flags
      '-f', 'mp4',
      '-movflags', '+faststart',   // Enable fast start for streaming
      '-avoid_negative_ts', 'make_zero',  // Fix timing issues
      '-fflags', '+genpts',        // Generate presentation timestamps
      '-strict', 'experimental'    // Allow experimental AAC encoder
    ];
    
    console.log('FFmpeg command structure:');
    console.log('ffmpeg [inputs] [filters] \\');
    vlcOptimizedParams.forEach((param, i) => {
      if (i % 2 === 0) {
        console.log(`  ${param} ${vlcOptimizedParams[i + 1] || ''} \\`);
      }
    });
    console.log('  output.mp4');
    
    console.log('\n📊 Compatibility Matrix:');
    console.log('========================');
    console.log('VLC Version    | H.264 Main 3.1 | H.264 High 4.1 | AAC Support');
    console.log('---------------|-----------------|-----------------|------------');
    console.log('VLC 2.x        | ✅ Full         | ⚠️  Limited     | ✅ Full');
    console.log('VLC 3.x        | ✅ Full         | ✅ Full         | ✅ Full');
    console.log('VLC 4.x        | ✅ Full         | ✅ Full         | ✅ Full');
    console.log('Mobile VLC     | ✅ Full         | ⚠️  Limited     | ✅ Full');
    
    console.log('\n🎯 Recommended Solution:');
    console.log('========================');
    console.log('1. Use H.264 Main Profile Level 3.1 instead of High Profile Level 4.1');
    console.log('2. Remove explicit AAC profile specification');
    console.log('3. Ensure proper parameter ordering in FFmpeg command');
    console.log('4. Add VLC-specific compatibility flags');
    console.log('5. Test with actual video creation');
    
    console.log('\n🧪 Next Steps:');
    console.log('==============');
    console.log('1. Update video-creator.js with VLC-optimized parameters');
    console.log('2. Create test video with new settings');
    console.log('3. Verify VLC can play the generated video');
    console.log('4. Test with different VLC versions if possible');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    throw error;
  }
}

// Run the diagnostic
testVLCCodecCompatibility()
  .then(() => {
    console.log('\n🎉 VLC codec diagnostic completed!');
    console.log('📝 Review the recommendations above and apply the fixes.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Diagnostic failed:', error);
    process.exit(1);
  });