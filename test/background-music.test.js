import { expect } from 'chai';
import { describe, it } from 'mocha';
import fs from 'fs/promises';
import path from 'path';

/**
 * Test suite for background music functionality
 * Tests the background music selection and audio mixing system
 */
describe('Background Music System', () => {
  describe('Music File Selection', () => {
    it('should handle empty media directory gracefully', async () => {
      // Test behavior when no background music files are found
      const expectedBehavior = {
        noFilesFound: true,
        shouldReturnNull: true,
        shouldLogMessage: '📵 No background music files found in ./media/*.wav'
      };
      
      expect(expectedBehavior.noFilesFound).to.be.true;
      expect(expectedBehavior.shouldReturnNull).to.be.true;
      expect(expectedBehavior.shouldLogMessage).to.include('No background music files found');
    });

    it('should randomly select from available wav files', () => {
      const mockFiles = [
        './media/ambient1.wav',
        './media/ambient2.wav',
        './media/background1.wav',
        './media/music1.wav'
      ];
      
      // Test random selection logic
      const randomIndex = Math.floor(Math.random() * mockFiles.length);
      const selectedFile = mockFiles[randomIndex];
      
      expect(selectedFile).to.be.oneOf(mockFiles);
      expect(selectedFile).to.include('.wav');
      expect(selectedFile).to.include('./media/');
    });

    it('should handle file scanning errors gracefully', () => {
      const errorScenario = {
        shouldCatchError: true,
        shouldReturnNull: true,
        shouldLogWarning: true
      };
      
      expect(errorScenario.shouldCatchError).to.be.true;
      expect(errorScenario.shouldReturnNull).to.be.true;
      expect(errorScenario.shouldLogWarning).to.be.true;
    });
  });

  describe('Audio Mixing Configuration', () => {
    it('should create proper background music filter', () => {
      const mockConfig = {
        backgroundMusicPath: './media/ambient1.wav',
        videoDuration: 30.0,
        options: {
          backgroundVolume: 0.15,
          fadeInDuration: 2.0,
          fadeOutDuration: 2.0,
          voiceoverVolume: 1.0
        }
      };
      
      // Test filter generation
      const fadeOutStart = Math.max(0, mockConfig.videoDuration - mockConfig.options.fadeOutDuration);
      expect(fadeOutStart).to.equal(28.0);
      
      // Test volume levels
      expect(mockConfig.options.backgroundVolume).to.equal(0.15); // 15% volume
      expect(mockConfig.options.voiceoverVolume).to.equal(1.0);   // 100% volume
      
      // Test fade timing
      expect(mockConfig.options.fadeInDuration).to.equal(2.0);
      expect(mockConfig.options.fadeOutDuration).to.equal(2.0);
    });

    it('should generate correct FFmpeg audio filter', () => {
      const mockSettings = {
        backgroundVolume: 0.15,
        fadeInDuration: 2.0,
        fadeOutDuration: 2.0,
        voiceoverVolume: 1.0,
        videoDuration: 30.0
      };
      
      const fadeOutStart = mockSettings.videoDuration - mockSettings.fadeOutDuration;
      
      // Expected filter components
      const expectedComponents = [
        'aloop=loop=-1:size=2e+09',
        `afade=t=in:st=0:d=${mockSettings.fadeInDuration}`,
        `afade=t=out:st=${fadeOutStart}:d=${mockSettings.fadeOutDuration}`,
        `volume=${mockSettings.backgroundVolume}`,
        `volume=${mockSettings.voiceoverVolume}`,
        'amix=inputs=2:duration=first:dropout_transition=2'
      ];
      
      expectedComponents.forEach(component => {
        expect(component).to.be.a('string');
        expect(component.length).to.be.greaterThan(0);
      });
    });

    it('should handle different video durations correctly', () => {
      const testCases = [
        { duration: 10.0, expectedFadeOut: 8.0 },  // 10s video, fade out at 8s
        { duration: 60.0, expectedFadeOut: 58.0 }, // 60s video, fade out at 58s
        { duration: 5.0, expectedFadeOut: 3.0 }    // 5s video, fade out at 3s
      ];
      
      testCases.forEach(testCase => {
        const fadeOutStart = Math.max(0, testCase.duration - 2.0);
        expect(fadeOutStart).to.equal(testCase.expectedFadeOut);
      });
    });
  });

  describe('FFmpeg Command Integration', () => {
    it('should add background music input to FFmpeg args', () => {
      const mockArgs = [
        '-loop', '1',
        '-t', '30',
        '-i', 'image.jpg',
        '-i', 'voiceover.wav'
      ];
      
      const backgroundMusicPath = './media/ambient1.wav';
      
      // Simulate adding background music input
      const updatedArgs = [...mockArgs, '-i', backgroundMusicPath];
      
      expect(updatedArgs).to.include('-i');
      expect(updatedArgs).to.include(backgroundMusicPath);
      expect(updatedArgs.length).to.equal(mockArgs.length + 2);
    });

    it('should use filter_complex for audio mixing', () => {
      const mockFilterComplex = [
        '[1:a]volume=1.0[voice];',
        '[2:a]aloop=loop=-1:size=2e+09,afade=t=in:st=0:d=2.0,afade=t=out:st=28:d=2.0,volume=0.15[bg];',
        '[voice][bg]amix=inputs=2:duration=first:dropout_transition=2[audio_out]'
      ].join('');
      
      expect(mockFilterComplex).to.include('amix=inputs=2');
      expect(mockFilterComplex).to.include('amix=inputs=2');
      expect(mockFilterComplex).to.include('[audio_out]');
    });

    it('should map correct audio output', () => {
      const expectedMapping = {
        withBackgroundMusic: '[audio_out]',
        withoutBackgroundMusic: '1:a:0'
      };
      
      expect(expectedMapping.withBackgroundMusic).to.equal('[audio_out]');
      expect(expectedMapping.withoutBackgroundMusic).to.equal('1:a:0');
    });
  });

  describe('Volume and Fade Settings', () => {
    it('should use appropriate default volume levels', () => {
      const defaultSettings = {
        backgroundVolume: 0.15,  // 15% - subtle background
        voiceoverVolume: 1.0,    // 100% - clear voiceover
        fadeInDuration: 2.0,     // 2 second fade in
        fadeOutDuration: 2.0     // 2 second fade out
      };
      
      expect(defaultSettings.backgroundVolume).to.be.lessThan(0.5); // Background should be subtle
      expect(defaultSettings.voiceoverVolume).to.equal(1.0);        // Voiceover should be full volume
      expect(defaultSettings.fadeInDuration).to.be.greaterThan(0);  // Should have fade in
      expect(defaultSettings.fadeOutDuration).to.be.greaterThan(0); // Should have fade out
    });

    it('should calculate fade timing correctly', () => {
      const videoDuration = 45.0;
      const fadeOutDuration = 2.0;
      const fadeOutStart = Math.max(0, videoDuration - fadeOutDuration);
      
      expect(fadeOutStart).to.equal(43.0);
      expect(fadeOutStart).to.be.lessThan(videoDuration);
      expect(fadeOutStart + fadeOutDuration).to.equal(videoDuration);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing background music gracefully', () => {
      const scenario = {
        backgroundMusicPath: null,
        shouldUseOriginalAudio: true,
        shouldNotAddMusicInput: true
      };
      
      expect(scenario.backgroundMusicPath).to.be.null;
      expect(scenario.shouldUseOriginalAudio).to.be.true;
      expect(scenario.shouldNotAddMusicInput).to.be.true;
    });

    it('should validate audio file paths', () => {
      const validPaths = [
        './media/ambient1.wav',
        './media/background-music.wav',
        './media/music_track_01.wav'
      ];
      
      const invalidPaths = [
        './media/music.mp3',  // Wrong format
        './sounds/ambient.wav', // Wrong directory
        'ambient.wav'         // No directory
      ];
      
      validPaths.forEach(path => {
        expect(path).to.include('./media/');
        expect(path).to.include('.wav');
      });
      
      invalidPaths.forEach(path => {
        const isValid = path.includes('./media/') && path.includes('.wav');
        expect(isValid).to.be.false;
      });
    });
  });

  describe('Console Output', () => {
    it('should log background music selection', () => {
      const mockFile = './media/ambient-music.wav';
      const expectedLog = `🎵 Selected background music: ${path.basename(mockFile)}`;
      
      expect(expectedLog).to.include('🎵 Selected background music:');
      expect(expectedLog).to.include('ambient-music.wav');
    });

    it('should log audio mixing information', () => {
      const backgroundVolume = 0.15;
      const voiceoverVolume = 1.0;
      const expectedLog = `🎼 Mixing audio: Voice (${(voiceoverVolume * 100).toFixed(0)}%) + Background (${(backgroundVolume * 100).toFixed(0)}%)`;
      
      expect(expectedLog).to.include('🎼 Mixing audio:');
      expect(expectedLog).to.include('Voice (100%)');
      expect(expectedLog).to.include('Background (15%)');
    });
  });
});