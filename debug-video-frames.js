#!/usr/bin/env node

/**
 * Debug script to extract and compare frames from both videos
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';

async function extractFrames(videoPath, outputPrefix) {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', videoPath,
      '-vf', 'fps=1/10', // Extract 1 frame every 10 seconds
      '-y',
      `${outputPrefix}_%03d.jpg`
    ];

    console.log(`🎬 Extracting frames from ${videoPath}...`);
    console.log(`📹 Command: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Frames extracted for ${videoPath}`);
        resolve();
      } else {
        console.error(`❌ FFmpeg failed: ${stderr}`);
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
  });
}

async function analyzeFrame(framePath) {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', framePath,
      '-vf', 'signalstats,metadata=print:file=-',
      '-f', 'null', '-'
    ];

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        const yavgMatch = stderr.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/);
        const yminMatch = stderr.match(/lavfi\.signalstats\.YMIN=([0-9.]+)/);
        const ymaxMatch = stderr.match(/lavfi\.signalstats\.YMAX=([0-9.]+)/);
        
        resolve({
          avgBrightness: yavgMatch ? parseFloat(yavgMatch[1]) : 0,
          minBrightness: yminMatch ? parseFloat(yminMatch[1]) : 0,
          maxBrightness: ymaxMatch ? parseFloat(ymaxMatch[1]) : 0
        });
      } else {
        reject(new Error(`Analysis failed: ${stderr}`));
      }
    });
  });
}

async function debugVideos() {
  console.log('🔍 Starting comprehensive video debugging...\n');

  try {
    // Check if videos exist
    const mainVideo = 'test-output/pelican-catch-pwr-100-279917.mp4';
    const shortVideo = 'test-output/pelican-catch-pwr-100-279917-short.mp4';

    try {
      await fs.access(mainVideo);
      console.log(`✅ Main video found: ${mainVideo}`);
    } catch {
      console.log(`❌ Main video not found: ${mainVideo}`);
      return;
    }

    try {
      await fs.access(shortVideo);
      console.log(`✅ Short video found: ${shortVideo}`);
    } catch {
      console.log(`❌ Short video not found: ${shortVideo}`);
      return;
    }

    // Extract frames from both videos
    console.log('\n📹 Extracting frames for analysis...');
    await extractFrames(mainVideo, 'debug-main-frame');
    await extractFrames(shortVideo, 'debug-short-frame');

    // Analyze extracted frames
    console.log('\n🔬 Analyzing frame brightness...');
    
    const mainFrames = [];
    const shortFrames = [];
    
    // Find extracted frames
    const files = await fs.readdir('.');
    for (const file of files) {
      if (file.startsWith('debug-main-frame_') && file.endsWith('.jpg')) {
        mainFrames.push(file);
      }
      if (file.startsWith('debug-short-frame_') && file.endsWith('.jpg')) {
        shortFrames.push(file);
      }
    }

    console.log(`📊 Found ${mainFrames.length} main video frames`);
    console.log(`📊 Found ${shortFrames.length} short video frames`);

    // Analyze first frame of each
    if (mainFrames.length > 0) {
      const mainAnalysis = await analyzeFrame(mainFrames[0]);
      console.log(`\n📈 Main video frame analysis (${mainFrames[0]}):`);
      console.log(`   Average brightness: ${mainAnalysis.avgBrightness.toFixed(2)}`);
      console.log(`   Min brightness: ${mainAnalysis.minBrightness.toFixed(2)}`);
      console.log(`   Max brightness: ${mainAnalysis.maxBrightness.toFixed(2)}`);
      
      if (mainAnalysis.avgBrightness < 50) {
        console.log(`   ⚠️  VERY DARK - likely missing images`);
      } else if (mainAnalysis.avgBrightness < 100) {
        console.log(`   ⚠️  DARK - images may be dim`);
      } else {
        console.log(`   ✅ BRIGHT - images visible`);
      }
    }

    if (shortFrames.length > 0) {
      const shortAnalysis = await analyzeFrame(shortFrames[0]);
      console.log(`\n📈 Short video frame analysis (${shortFrames[0]}):`);
      console.log(`   Average brightness: ${shortAnalysis.avgBrightness.toFixed(2)}`);
      console.log(`   Min brightness: ${shortAnalysis.minBrightness.toFixed(2)}`);
      console.log(`   Max brightness: ${shortAnalysis.maxBrightness.toFixed(2)}`);
      
      if (shortAnalysis.avgBrightness < 50) {
        console.log(`   ❌ VERY DARK - images are missing!`);
      } else if (shortAnalysis.avgBrightness < 100) {
        console.log(`   ⚠️  DARK - images may be dim`);
      } else {
        console.log(`   ✅ BRIGHT - images visible`);
      }
    }

    // Compare original source images
    console.log('\n🖼️  Analyzing source images...');
    const sourceImages = await fs.readdir('test-temp');
    const imageFiles = sourceImages.filter(f => f.endsWith('.jpg') && !f.includes('smart-bg'));
    
    for (const imageFile of imageFiles) {
      const imagePath = `test-temp/${imageFile}`;
      try {
        const imageAnalysis = await analyzeFrame(imagePath);
        console.log(`📸 Source image ${imageFile}: brightness ${imageAnalysis.avgBrightness.toFixed(2)}`);
      } catch (error) {
        console.log(`❌ Failed to analyze ${imageFile}: ${error.message}`);
      }
    }

    console.log('\n🎯 DIAGNOSIS:');
    console.log('If short video brightness < 50: Images are completely missing');
    console.log('If short video brightness 50-100: Images are very dim');
    console.log('If short video brightness > 150: Images are visible');
    console.log('\n💡 Check the extracted frame files to visually confirm what the videos contain.');

  } catch (error) {
    console.error('💥 Debug failed:', error.message);
  }
}

debugVideos();