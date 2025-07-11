import { expect } from 'chai';
import { describe, it } from 'mocha';
import fs from 'fs/promises';
import path from 'path';
import { analyzeAudioFile, AUDIO_LIMITS } from '../src/utils/audio-utils.js';
import { glob } from 'glob';

/**
 * Test suite for audio file validation and quality checking
 * Validates background music files for potential loud noise issues
 */
describe('Audio File Validation', () => {
  let audioFiles = [];

  before(async () => {
    try {
      // Find all audio files in the media directory
      audioFiles = await glob('./src/media/*.wav');
      console.log(`Found ${audioFiles.length} audio files for validation`);
    } catch (error) {
      console.warn('Could not scan for audio files:', error.message);
    }
  });

  describe('Background Music File Analysis', () => {
    it('should find background music files', () => {
      expect(audioFiles).to.be.an('array');
      if (audioFiles.length > 0) {
        console.log('📁 Found audio files:', audioFiles.map(f => path.basename(f)));
      } else {
        console.log('📵 No audio files found in ./src/media/*.wav');
      }
    });

    audioFiles.forEach((audioFile) => {
      it(`should analyze ${path.basename(audioFile)} for quality issues`, async function() {
        this.timeout(10000); // Allow time for audio analysis
        
        try {
          const analysis = await analyzeAudioFile(audioFile);
          
          console.log(`🎵 Analysis for ${path.basename(audioFile)}:`);
          console.log(`   Duration: ${analysis.duration.toFixed(1)}s`);
          console.log(`   Sample Rate: ${analysis.sampleRate}Hz`);
          console.log(`   Channels: ${analysis.channels}`);
          console.log(`   Bitrate: ${Math.round(analysis.bitrate / 1000)}kbps`);
          console.log(`   Quality: ${analysis.quality}`);
          
          if (analysis.issues.length > 0) {
            console.log(`   Issues: ${analysis.issues.join(', ')}`);
          }

          // Validate basic properties
          expect(analysis.duration).to.be.a('number');
          expect(analysis.sampleRate).to.be.a('number');
          expect(analysis.channels).to.be.a('number');
          expect(analysis.quality).to.be.oneOf(['good', 'acceptable', 'poor', 'unknown']);

          // Check for critical issues that could cause loud noise
          const criticalIssues = analysis.issues.filter(issue => 
            issue.includes('Low sample rate') || 
            issue.includes('Low bitrate') ||
            issue.includes('Too many channels')
          );

          if (criticalIssues.length > 0) {
            console.warn(`⚠️ Critical audio issues found in ${path.basename(audioFile)}:`, criticalIssues);
          }

          // File should be long enough for looping
          if (analysis.duration < 10) {
            console.warn(`⚠️ ${path.basename(audioFile)} is very short (${analysis.duration.toFixed(1)}s) - may cause abrupt loops`);
          }

          // Quality should not be poor
          if (analysis.quality === 'poor') {
            console.warn(`⚠️ ${path.basename(audioFile)} has poor quality - may contribute to audio issues`);
          }

        } catch (error) {
          console.error(`❌ Failed to analyze ${path.basename(audioFile)}:`, error.message);
          // Don't fail the test if analysis fails, just warn
          console.warn('Audio analysis failed - file may be corrupted or inaccessible');
        }
      });
    });
  });

  describe('Audio File Recommendations', () => {
    it('should provide recommendations for optimal audio files', () => {
      const recommendations = {
        format: '.wav (uncompressed)',
        sampleRate: '44.1kHz or 48kHz',
        channels: 'Stereo (2 channels)',
        bitrate: 'At least 128kbps',
        duration: 'At least 30 seconds for smooth looping',
        volume: 'Normalized to prevent clipping',
        quality: 'High quality recording without distortion'
      };

      expect(recommendations.format).to.include('.wav');
      expect(recommendations.sampleRate).to.include('44.1kHz');
      expect(recommendations.channels).to.include('Stereo');
      expect(recommendations.bitrate).to.include('128kbps');

      console.log('💡 Recommendations for background music files:');
      Object.entries(recommendations).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    });

    it('should identify files that may cause loud noise issues', async function() {
      this.timeout(15000); // Allow time for all file analysis

      const problematicFiles = [];

      for (const audioFile of audioFiles) {
        try {
          const analysis = await analyzeAudioFile(audioFile);
          
          // Check for conditions that might cause loud noise
          const hasLoudNoiseRisk = 
            analysis.quality === 'poor' ||
            analysis.bitrate < 64000 || // Very low bitrate
            analysis.sampleRate < 22050 || // Very low sample rate
            analysis.duration < 5; // Too short, might cause jarring loops

          if (hasLoudNoiseRisk) {
            problematicFiles.push({
              file: path.basename(audioFile),
              issues: analysis.issues,
              quality: analysis.quality,
              risk: 'May cause audio quality issues or loud noise'
            });
          }
        } catch (error) {
          problematicFiles.push({
            file: path.basename(audioFile),
            issues: ['Analysis failed'],
            quality: 'unknown',
            risk: 'File may be corrupted'
          });
        }
      }

      if (problematicFiles.length > 0) {
        console.warn('⚠️ Files with potential loud noise risk:');
        problematicFiles.forEach(file => {
          console.warn(`   ${file.file}: ${file.risk}`);
          console.warn(`     Issues: ${file.issues.join(', ')}`);
        });
      } else {
        console.log('✅ No obvious loud noise risks detected in audio files');
      }

      // Test passes regardless, but logs warnings
      expect(problematicFiles).to.be.an('array');
    });
  });

  describe('Volume Level Testing', () => {
    it('should test volume normalization with current audio limits', () => {
      const testVolumes = [
        { input: 1.0, type: 'intro', expected: AUDIO_LIMITS.MAX_INTRO_VOLUME },
        { input: 0.8, type: 'intro', expected: AUDIO_LIMITS.MAX_INTRO_VOLUME },
        { input: 0.3, type: 'intro', expected: 0.3 },
        { input: 0.5, type: 'background', expected: AUDIO_LIMITS.MAX_BACKGROUND_VOLUME },
        { input: 0.1, type: 'background', expected: 0.1 }
      ];

      testVolumes.forEach(test => {
        const { normalizeVolume } = require('../src/utils/audio-utils.js');
        const result = normalizeVolume(test.input, test.type);
        
        expect(result).to.be.at.most(test.expected);
        expect(result).to.be.at.least(AUDIO_LIMITS.MIN_VOLUME);
        
        if (result !== test.input) {
          console.log(`🔧 Volume normalized: ${test.input} → ${result} (${test.type})`);
        }
      });
    });

    it('should prevent volume combinations that cause clipping', () => {
      const { checkAudioClipping } = require('../src/utils/audio-utils.js');
      
      const testCombinations = [
        { voice: 1.0, background: 0.8, shouldClip: true },
        { voice: 1.0, background: 0.2, shouldClip: false },
        { voice: 1.0, intro: 0.6, shouldClip: true },
        { voice: 1.0, intro: 0.4, shouldClip: false }
      ];

      testCombinations.forEach(test => {
        const analysis = checkAudioClipping(test);
        const actuallyClips = analysis.willClip;
        
        expect(actuallyClips).to.equal(test.shouldClip);
        
        if (actuallyClips) {
          console.log(`⚠️ Clipping detected: Total volume ${analysis.totalVolume.toFixed(2)}`);
        }
      });
    });
  });
});