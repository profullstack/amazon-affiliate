#!/usr/bin/env node

/**
 * Audio debugging utility for troubleshooting loud noise issues
 * Analyzes background music files and tests volume configurations
 */

import { analyzeAudioFile, checkAudioClipping, normalizeVolume, AUDIO_LIMITS } from './src/utils/audio-utils.js';
import { glob } from 'glob';
import path from 'path';

console.log('🔍 Audio Issues Debug Utility');
console.log('==============================\n');

/**
 * Analyzes all background music files for potential issues
 */
async function analyzeBackgroundMusicFiles() {
  console.log('📁 Scanning for background music files...');
  
  try {
    const audioFiles = await glob('./src/media/*.wav');
    
    if (audioFiles.length === 0) {
      console.log('📵 No background music files found in ./src/media/*.wav');
      return;
    }

    console.log(`Found ${audioFiles.length} audio files:\n`);

    for (const audioFile of audioFiles) {
      console.log(`🎵 Analyzing: ${path.basename(audioFile)}`);
      
      try {
        const analysis = await analyzeAudioFile(audioFile);
        
        console.log(`   Duration: ${analysis.duration.toFixed(1)}s`);
        console.log(`   Sample Rate: ${analysis.sampleRate}Hz`);
        console.log(`   Channels: ${analysis.channels}`);
        console.log(`   Bitrate: ${Math.round(analysis.bitrate / 1000)}kbps`);
        console.log(`   Quality: ${analysis.quality}`);
        
        if (analysis.issues.length > 0) {
          console.log(`   ⚠️ Issues: ${analysis.issues.join(', ')}`);
        } else {
          console.log(`   ✅ No issues detected`);
        }

        // Check for loud noise risk factors
        const riskFactors = [];
        if (analysis.quality === 'poor') riskFactors.push('Poor quality');
        if (analysis.bitrate < 128000) riskFactors.push('Low bitrate');
        if (analysis.sampleRate < 44100) riskFactors.push('Low sample rate');
        if (analysis.duration < 10) riskFactors.push('Very short duration');

        if (riskFactors.length > 0) {
          console.log(`   🚨 Loud noise risk: ${riskFactors.join(', ')}`);
        }

      } catch (error) {
        console.log(`   ❌ Analysis failed: ${error.message}`);
      }
      
      console.log('');
    }
  } catch (error) {
    console.error('❌ Failed to scan audio files:', error.message);
  }
}

/**
 * Tests current volume configurations for clipping issues
 */
function testVolumeConfigurations() {
  console.log('🔊 Testing Volume Configurations');
  console.log('--------------------------------\n');

  // Test current problematic settings
  console.log('❌ PROBLEMATIC SETTINGS (causing loud noise):');
  const problematicConfigs = [
    { name: 'Old Intro Volume', voice: 0, intro: 1.0, background: 0 },
    { name: 'High Background', voice: 1.0, intro: 0, background: 0.8 },
    { name: 'Intro + Background', voice: 0, intro: 0.6, background: 0.4 }
  ];

  problematicConfigs.forEach(config => {
    const analysis = checkAudioClipping(config);
    console.log(`   ${config.name}:`);
    console.log(`     Total Volume: ${analysis.totalVolume.toFixed(2)} ${analysis.willClip ? '🚨 WILL CLIP' : '✅ Safe'}`);
    if (analysis.willClip && analysis.recommendation) {
      console.log(`     Recommended: Voice=${analysis.recommendation.voice}, Intro=${analysis.recommendation.intro}, Background=${analysis.recommendation.background}`);
    }
  });

  console.log('\n✅ SAFE SETTINGS (fixed):');
  const safeConfigs = [
    { name: 'New Intro Volume', voice: 0, intro: 0.4, background: 0 },
    { name: 'Safe Background', voice: 1.0, intro: 0, background: 0.2 },
    { name: 'Intro + Background Safe', voice: 0, intro: 0.3, background: 0.15 }
  ];

  safeConfigs.forEach(config => {
    const analysis = checkAudioClipping(config);
    console.log(`   ${config.name}:`);
    console.log(`     Total Volume: ${analysis.totalVolume.toFixed(2)} ${analysis.willClip ? '🚨 WILL CLIP' : '✅ Safe'}`);
  });
}

/**
 * Shows volume normalization in action
 */
function demonstrateVolumeNormalization() {
  console.log('\n🔧 Volume Normalization Demo');
  console.log('-----------------------------\n');

  const testCases = [
    { volume: 1.0, type: 'intro', description: 'Old intro volume (100%)' },
    { volume: 0.8, type: 'background', description: 'High background volume' },
    { volume: 0.05, type: 'background', description: 'Very low volume' },
    { volume: 2.0, type: 'intro', description: 'Excessive volume' }
  ];

  testCases.forEach(test => {
    const normalized = normalizeVolume(test.volume, test.type);
    const changed = normalized !== test.volume;
    
    console.log(`${test.description}:`);
    console.log(`   Input: ${(test.volume * 100).toFixed(0)}% → Output: ${(normalized * 100).toFixed(0)}% ${changed ? '🔧 NORMALIZED' : '✅ OK'}`);
  });
}

/**
 * Shows audio limits and recommendations
 */
function showAudioLimits() {
  console.log('\n📊 Audio Limits & Recommendations');
  console.log('----------------------------------\n');

  console.log('Volume Limits:');
  console.log(`   Voice (Primary): ${(AUDIO_LIMITS.MAX_VOICE_VOLUME * 100).toFixed(0)}%`);
  console.log(`   Intro Music: ${(AUDIO_LIMITS.MAX_INTRO_VOLUME * 100).toFixed(0)}% (reduced from 100%)`);
  console.log(`   Background Music: ${(AUDIO_LIMITS.MAX_BACKGROUND_VOLUME * 100).toFixed(0)}%`);
  console.log(`   Minimum Volume: ${(AUDIO_LIMITS.MIN_VOLUME * 100).toFixed(0)}%`);
  console.log(`   Max Volume Jump: ${(AUDIO_LIMITS.MAX_VOLUME_JUMP * 100).toFixed(0)}%`);

  console.log('\nFade Settings:');
  console.log(`   Minimum Fade: ${AUDIO_LIMITS.MIN_FADE_DURATION}s`);
  console.log(`   Maximum Fade: ${AUDIO_LIMITS.MAX_FADE_DURATION}s`);
  console.log(`   Recommended: ${AUDIO_LIMITS.RECOMMENDED_FADE}s`);

  console.log('\nSafe Mixing:');
  console.log(`   Total Volume Threshold: ${(AUDIO_LIMITS.SAFE_MIXING_THRESHOLD * 100).toFixed(0)}%`);
}

/**
 * Main debugging function
 */
async function main() {
  try {
    await analyzeBackgroundMusicFiles();
    testVolumeConfigurations();
    demonstrateVolumeNormalization();
    showAudioLimits();

    console.log('\n🎯 Summary of Fixes Applied:');
    console.log('============================');
    console.log('✅ Intro volume reduced from 100% to 40%');
    console.log('✅ Dynamic intro volumes normalized (20% during narration, 30% after)');
    console.log('✅ Background music volume capped at 20%');
    console.log('✅ Audio clipping prevention implemented');
    console.log('✅ Volume normalization added');
    console.log('✅ Fade duration validation added');
    console.log('✅ Audio file quality analysis implemented');

    console.log('\n💡 Next Steps:');
    console.log('- Run tests: `pnpm test test/audio-volume-fixes.test.js`');
    console.log('- Validate audio files: `pnpm test test/audio-file-validation.test.js`');
    console.log('- Test video creation with new settings');
    console.log('- Monitor for loud noise issues in generated videos');

  } catch (error) {
    console.error('❌ Debug utility failed:', error.message);
    process.exit(1);
  }
}

// Run the debug utility
main();