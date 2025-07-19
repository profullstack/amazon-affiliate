#!/usr/bin/env node

import { createVideo, createShortVideo } from './src/video-creator.js';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';

console.log('🔧 Testing VLC Codec Compatibility Fixes...\n');

/**
 * Creates a simple test image for video creation
 */
async function createTestImage() {
  const { spawn } = await import('child_process');
  const testImagePath = './test-vlc-image.jpg';
  
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
 * Creates a simple test audio file
 */
async function createTestAudio() {
  const { spawn } = await import('child_process');
  const testAudioPath = './test-vlc-audio.mp3';
  
  return new Promise((resolve, reject) => {
    // Create a simple tone using FFmpeg
    const ffmpegArgs = [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=5',
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
 * Analyzes video codec information using FFprobe
 */
async function analyzeVideoCodec(videoPath) {
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
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
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          
          resolve({
            video: videoStream ? {
              codec: videoStream.codec_name,
              profile: videoStream.profile,
              level: videoStream.level,
              pixelFormat: videoStream.pix_fmt,
              width: videoStream.width,
              height: videoStream.height
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              profile: audioStream.profile,
              sampleRate: audioStream.sample_rate,
              channels: audioStream.channels,
              bitrate: audioStream.bit_rate
            } : null,
            container: metadata.format.format_name
          });
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

async function testVLCCodecFixes() {
  const testFiles = [];
  
  try {
    console.log('📋 Creating test assets...');
    
    // Create test image and audio
    const testImagePath = await createTestImage();
    const testAudioPath = await createTestAudio();
    testFiles.push(testImagePath, testAudioPath);
    
    console.log('\n🎬 Testing regular video creation with VLC-optimized codecs...');
    
    // Test regular video creation
    const regularVideoPath = './test-vlc-regular-video.mp4';
    testFiles.push(regularVideoPath);
    
    await createVideo(testImagePath, testAudioPath, regularVideoPath, {
      resolution: '1920x1080',
      quality: 'high',
      enableBackgroundMusic: false,
      enableIntroOutro: false
    });
    
    console.log('✅ Regular video created successfully');
    
    // Analyze the regular video codec
    const regularCodecInfo = await analyzeVideoCodec(regularVideoPath);
    console.log('\n📊 Regular Video Codec Analysis:');
    console.log(`  🎥 Video: ${regularCodecInfo.video.codec} (${regularCodecInfo.video.profile}, Level ${regularCodecInfo.video.level})`);
    console.log(`  🎵 Audio: ${regularCodecInfo.audio.codec} (${regularCodecInfo.audio.profile || 'default'})`);
    console.log(`  📦 Container: ${regularCodecInfo.container}`);
    console.log(`  📐 Resolution: ${regularCodecInfo.video.width}x${regularCodecInfo.video.height}`);
    console.log(`  🎨 Pixel Format: ${regularCodecInfo.video.pixelFormat}`);
    
    console.log('\n📱 Testing short video creation with VLC-optimized codecs...');
    
    // Test short video creation
    const shortVideoPath = './test-vlc-short-video.mp4';
    testFiles.push(shortVideoPath);
    
    await createShortVideo([testImagePath], testAudioPath, shortVideoPath, {
      resolution: '1080x1920',
      quality: 'high',
      enableBackgroundMusic: false,
      enableIntroOutro: false
    });
    
    console.log('✅ Short video created successfully');
    
    // Analyze the short video codec
    const shortCodecInfo = await analyzeVideoCodec(shortVideoPath);
    console.log('\n📊 Short Video Codec Analysis:');
    console.log(`  🎥 Video: ${shortCodecInfo.video.codec} (${shortCodecInfo.video.profile}, Level ${shortCodecInfo.video.level})`);
    console.log(`  🎵 Audio: ${shortCodecInfo.audio.codec} (${shortCodecInfo.audio.profile || 'default'})`);
    console.log(`  📦 Container: ${shortCodecInfo.container}`);
    console.log(`  📐 Resolution: ${shortCodecInfo.video.width}x${shortCodecInfo.video.height}`);
    console.log(`  🎨 Pixel Format: ${shortCodecInfo.video.pixelFormat}`);
    
    console.log('\n✅ VLC Compatibility Check:');
    console.log('==========================');
    
    // Check if the codec settings match our VLC-optimized parameters
    const isVLCCompatible = (codecInfo) => {
      const video = codecInfo.video;
      const audio = codecInfo.audio;
      
      const checks = {
        videoCodec: video.codec === 'h264',
        videoProfile: video.profile === 'Main',
        videoLevel: video.level <= 31, // Level 3.1 or lower
        pixelFormat: video.pixelFormat === 'yuv420p',
        audioCodec: audio.codec === 'aac',
        container: codecInfo.container.includes('mp4')
      };
      
      return checks;
    };
    
    const regularChecks = isVLCCompatible(regularCodecInfo);
    const shortChecks = isVLCCompatible(shortCodecInfo);
    
    console.log('📹 Regular Video Compatibility:');
    console.log(`  • H.264 Codec: ${regularChecks.videoCodec ? '✅' : '❌'}`);
    console.log(`  • Main Profile: ${regularChecks.videoProfile ? '✅' : '❌'}`);
    console.log(`  • Level ≤ 3.1: ${regularChecks.videoLevel ? '✅' : '❌'}`);
    console.log(`  • YUV420P Format: ${regularChecks.pixelFormat ? '✅' : '❌'}`);
    console.log(`  • AAC Audio: ${regularChecks.audioCodec ? '✅' : '❌'}`);
    console.log(`  • MP4 Container: ${regularChecks.container ? '✅' : '❌'}`);
    
    console.log('\n📱 Short Video Compatibility:');
    console.log(`  • H.264 Codec: ${shortChecks.videoCodec ? '✅' : '❌'}`);
    console.log(`  • Main Profile: ${shortChecks.videoProfile ? '✅' : '❌'}`);
    console.log(`  • Level ≤ 3.1: ${shortChecks.videoLevel ? '✅' : '❌'}`);
    console.log(`  • YUV420P Format: ${shortChecks.pixelFormat ? '✅' : '❌'}`);
    console.log(`  • AAC Audio: ${shortChecks.audioCodec ? '✅' : '❌'}`);
    console.log(`  • MP4 Container: ${shortChecks.container ? '✅' : '❌'}`);
    
    const allRegularPassed = Object.values(regularChecks).every(check => check);
    const allShortPassed = Object.values(shortChecks).every(check => check);
    
    console.log('\n🎯 Overall Results:');
    console.log(`  📹 Regular Video VLC Compatible: ${allRegularPassed ? '✅ YES' : '❌ NO'}`);
    console.log(`  📱 Short Video VLC Compatible: ${allShortPassed ? '✅ YES' : '❌ NO'}`);
    
    if (allRegularPassed && allShortPassed) {
      console.log('\n🎉 SUCCESS: All videos are VLC compatible!');
      console.log('🔧 Codec fixes have been successfully applied');
      console.log('📺 Videos should now play correctly in VLC');
    } else {
      console.log('\n⚠️  WARNING: Some compatibility issues remain');
      console.log('🔍 Review the codec analysis above for details');
    }
    
    console.log('\n📝 Next Steps:');
    console.log('1. Test the generated videos in VLC media player');
    console.log('2. Verify web streaming compatibility');
    console.log('3. Check playback on different devices/platforms');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    // Cleanup test files
    console.log('\n🧹 Cleaning up test files...');
    for (const file of testFiles) {
      if (existsSync(file)) {
        try {
          await unlink(file);
          console.log(`  🗑️  Removed: ${path.basename(file)}`);
        } catch (err) {
          console.warn(`  ⚠️  Could not remove: ${path.basename(file)}`);
        }
      }
    }
  }
}

// Run the test
testVLCCodecFixes()
  .then(() => {
    console.log('\n🎉 VLC codec compatibility test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 VLC codec test failed:', error);
    process.exit(1);
  });