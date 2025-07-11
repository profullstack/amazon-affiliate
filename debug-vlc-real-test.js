#!/usr/bin/env node

import { createVideo, createShortVideo } from './src/video-creator.js';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';

console.log('🔍 Real VLC Compatibility Test - Investigating Actual Issues...\n');

/**
 * Creates a simple test image for video creation
 */
async function createTestImage() {
  const { spawn } = await import('child_process');
  const testImagePath = './test-real-image.jpg';
  
  return new Promise((resolve, reject) => {
    // Create a simple colored image using FFmpeg
    const ffmpegArgs = [
      '-f', 'lavfi',
      '-i', 'color=c=blue:size=1920x1080:duration=1',
      '-frames:v', '1',
      '-y',
      testImagePath
    ];
    
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Test image created: ${testImagePath}`);
        resolve(testImagePath);
      } else {
        reject(new Error(`Failed to create test image: exit code ${code}`));
      }
    });
    
    ffmpegProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFmpeg for image creation: ${error.message}`));
    });
  });
}

/**
 * Creates a simple test audio file with controlled volume
 */
async function createTestAudio() {
  const { spawn } = await import('child_process');
  const testAudioPath = './test-real-audio.mp3';
  
  return new Promise((resolve, reject) => {
    // Create a simple tone with controlled volume
    const ffmpegArgs = [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=10',
      '-af', 'volume=0.1', // Very low volume to prevent loud beep
      '-c:a', 'mp3',
      '-b:a', '128k',
      '-y',
      testAudioPath
    ];
    
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Test audio created: ${testAudioPath}`);
        resolve(testAudioPath);
      } else {
        reject(new Error(`Failed to create test audio: exit code ${code}`));
      }
    });
    
    ffmpegProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFmpeg for audio creation: ${error.message}`));
    });
  });
}

/**
 * Tests VLC compatibility with ultra-conservative settings
 */
async function testUltraConservativeVideo(imagePath, audioPath) {
  const { spawn } = await import('child_process');
  const testVideoPath = './test-ultra-conservative.mp4';
  
  return new Promise((resolve, reject) => {
    // Ultra-conservative FFmpeg settings for maximum VLC compatibility
    const ffmpegArgs = [
      '-loop', '1',
      '-t', '10',
      '-i', imagePath,
      '-i', audioPath,
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black',
      
      // Ultra-conservative video settings
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-profile:v', 'baseline',  // Most compatible profile
      '-level:v', '3.0',         // Very low level for old devices
      '-pix_fmt', 'yuv420p',
      '-crf', '23',              // Standard quality
      '-r', '25',                // Standard frame rate
      '-g', '50',                // Keyframe interval
      
      // Ultra-conservative audio settings
      '-c:a', 'aac',
      '-b:a', '96k',             // Lower bitrate
      '-ar', '44100',
      '-ac', '2',
      '-af', 'volume=0.5',       // Reduce volume to prevent loud audio
      
      // Container settings
      '-f', 'mp4',
      '-movflags', '+faststart',
      '-avoid_negative_ts', 'make_zero',
      '-shortest',
      '-y',
      testVideoPath
    ];
    
    console.log('🎥 Ultra-conservative FFmpeg command:');
    console.log('ffmpeg', ffmpegArgs.join(' '));
    
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stderr = '';
    
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Ultra-conservative video created: ${testVideoPath}`);
        resolve(testVideoPath);
      } else {
        console.error('❌ Ultra-conservative video creation failed:', stderr);
        reject(new Error(`FFmpeg failed with exit code ${code}: ${stderr}`));
      }
    });
    
    ffmpegProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFmpeg: ${error.message}`));
    });
  });
}

/**
 * Analyzes video with detailed codec information
 */
async function analyzeVideoDetailed(videoPath) {
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      '-show_entries', 'stream=codec_name,profile,level,pix_fmt,width,height,r_frame_rate,bit_rate,sample_rate,channels',
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
          resolve(metadata);
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

async function testRealVLCCompatibility() {
  const testFiles = [];
  
  try {
    console.log('📋 Creating test assets...');
    
    // Create test image and audio
    const testImagePath = await createTestImage();
    const testAudioPath = await createTestAudio();
    testFiles.push(testImagePath, testAudioPath);
    
    console.log('\n🎬 Testing current video-creator.js implementation...');
    
    // Test current implementation
    const currentVideoPath = './test-current-implementation.mp4';
    testFiles.push(currentVideoPath);
    
    try {
      await createVideo(testImagePath, testAudioPath, currentVideoPath, {
        resolution: '1280x720',  // Lower resolution for compatibility
        quality: 'medium',
        enableBackgroundMusic: false,
        enableIntroOutro: false
      });
      
      console.log('✅ Current implementation video created');
      
      // Analyze current implementation
      const currentMetadata = await analyzeVideoDetailed(currentVideoPath);
      const currentVideo = currentMetadata.streams.find(s => s.codec_type === 'video');
      const currentAudio = currentMetadata.streams.find(s => s.codec_type === 'audio');
      
      console.log('\n📊 Current Implementation Analysis:');
      console.log(`  🎥 Video: ${currentVideo.codec_name} (${currentVideo.profile}, Level ${currentVideo.level})`);
      console.log(`  📐 Resolution: ${currentVideo.width}x${currentVideo.height}`);
      console.log(`  🎨 Pixel Format: ${currentVideo.pix_fmt}`);
      console.log(`  🎵 Audio: ${currentAudio.codec_name} (${currentAudio.profile || 'default'})`);
      console.log(`  🔊 Sample Rate: ${currentAudio.sample_rate}Hz`);
      console.log(`  📦 Container: ${currentMetadata.format.format_name}`);
      
    } catch (error) {
      console.error('❌ Current implementation failed:', error.message);
    }
    
    console.log('\n🛡️ Testing ultra-conservative settings...');
    
    // Test ultra-conservative settings
    const conservativeVideoPath = await testUltraConservativeVideo(testImagePath, testAudioPath);
    testFiles.push(conservativeVideoPath);
    
    // Analyze conservative implementation
    const conservativeMetadata = await analyzeVideoDetailed(conservativeVideoPath);
    const conservativeVideo = conservativeMetadata.streams.find(s => s.codec_type === 'video');
    const conservativeAudio = conservativeMetadata.streams.find(s => s.codec_type === 'audio');
    
    console.log('\n📊 Ultra-Conservative Analysis:');
    console.log(`  🎥 Video: ${conservativeVideo.codec_name} (${conservativeVideo.profile}, Level ${conservativeVideo.level})`);
    console.log(`  📐 Resolution: ${conservativeVideo.width}x${conservativeVideo.height}`);
    console.log(`  🎨 Pixel Format: ${conservativeVideo.pix_fmt}`);
    console.log(`  🎵 Audio: ${conservativeAudio.codec_name} (${conservativeAudio.profile || 'default'})`);
    console.log(`  🔊 Sample Rate: ${conservativeAudio.sample_rate}Hz`);
    console.log(`  📦 Container: ${conservativeMetadata.format.format_name}`);
    
    console.log('\n🎯 VLC Compatibility Recommendations:');
    console.log('=====================================');
    
    console.log('1. Use H.264 Baseline Profile Level 3.0 (most compatible)');
    console.log('2. Lower resolution (1280x720 max for compatibility)');
    console.log('3. Standard frame rate (25fps)');
    console.log('4. Lower audio bitrate (96k)');
    console.log('5. Add volume control to prevent loud audio');
    console.log('6. Use slower preset for better compatibility');
    
    console.log('\n📝 Files created for manual VLC testing:');
    if (existsSync(currentVideoPath)) {
      console.log(`  📹 Current: ${currentVideoPath}`);
    }
    console.log(`  🛡️ Conservative: ${conservativeVideoPath}`);
    console.log('\n🧪 Manual Test Steps:');
    console.log('1. Open both videos in VLC');
    console.log('2. Check for codec errors');
    console.log('3. Verify audio levels (should be quiet)');
    console.log('4. Test playback quality');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    // Don't cleanup - leave files for manual testing
    console.log('\n📁 Test files preserved for manual VLC testing');
    console.log('🧹 Run this script again to cleanup and retest');
  }
}

// Run the test
testRealVLCCompatibility()
  .then(() => {
    console.log('\n🎉 Real VLC compatibility test completed!');
    console.log('📺 Please test the generated videos in VLC and report results');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Real VLC test failed:', error);
    process.exit(1);
  });