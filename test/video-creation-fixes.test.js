import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import fs from 'fs/promises';
import path from 'path';
import { createVideo, createSlideshow, createShortVideo, createIntroOutroFilter } from '../src/video-creator.js';
import { generateVoiceover } from '../src/voiceover-generator.js';

describe('Video Creation Fixes', () => {
  const testDir = 'temp-test';
  const testImage = path.join(testDir, 'test-image.jpg');
  const testAudio = path.join(testDir, 'test-audio.mp3');
  const testOutput = path.join(testDir, 'test-output.mp4');

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a simple 1x1 pixel PNG image (valid format)
    const testImageData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // IHDR data
      0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
      0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // IDAT data
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82  // IEND chunk
    ]);
    await fs.writeFile(testImage, testImageData);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Voice Consistency Fixes', () => {
    it('should use consistent voice between intro and main voiceover', async () => {
      // Skip if no ElevenLabs API key
      if (!process.env.ELEVENLABS_API_KEY) {
        console.log('⚠️ Skipping voice consistency test - no ELEVENLABS_API_KEY');
        return;
      }

      // Generate test audio first
      await generateVoiceover('This is a test product review.', testAudio);
      
      const options = {
        enableIntroOutro: true,
        voiceGender: 'female',
        introOutroOptions: {
          introVoiceoverText: 'Welcome to The Professional Prompt'
        }
      };

      // Test that selectedVoiceId gets set and used consistently
      const result = await createVideo(testImage, testAudio, testOutput, options);
      
      expect(result).to.equal(path.resolve(testOutput));
      expect(options.selectedVoiceId).to.exist;
      expect(typeof options.selectedVoiceId).to.equal('string');
      
      // Verify output file exists
      const stats = await fs.stat(result);
      expect(stats.size).to.be.greaterThan(0);
    }).timeout(30000);

    it('should preserve voice selection across different video types', async () => {
      // Skip if no ElevenLabs API key
      if (!process.env.ELEVENLABS_API_KEY) {
        console.log('⚠️ Skipping voice preservation test - no ELEVENLABS_API_KEY');
        return;
      }

      // Generate test audio first
      await generateVoiceover('This is a test slideshow review.', testAudio);
      
      const options = {
        enableIntroOutro: true,
        voiceGender: 'male',
        selectedVoiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice
        introOutroOptions: {
          introVoiceoverText: 'Welcome to The Professional Prompt'
        }
      };

      const result = await createSlideshow([testImage], testAudio, testOutput, options);
      
      expect(result).to.equal(path.resolve(testOutput));
      expect(options.selectedVoiceId).to.equal('pNInz6obpgDQGcFmaJgB');
      
      // Verify output file exists
      const stats = await fs.stat(result);
      expect(stats.size).to.be.greaterThan(0);
    }).timeout(30000);
  });

  describe('Audio Timing Fixes', () => {
    it('should properly delay main voiceover after intro', async () => {
      // Skip if no ElevenLabs API key
      if (!process.env.ELEVENLABS_API_KEY) {
        console.log('⚠️ Skipping audio timing test - no ELEVENLABS_API_KEY');
        return;
      }

      // Generate test audio first
      await generateVoiceover('This is the main product review content.', testAudio);
      
      const options = {
        enableIntroOutro: true,
        introOutroOptions: {
          introDuration: 3.0, // 3 second intro
          introVoiceoverText: 'Welcome to The Professional Prompt'
        }
      };

      const result = await createVideo(testImage, testAudio, testOutput, options);
      
      expect(result).to.equal(path.resolve(testOutput));
      
      // Verify output file exists and has reasonable size
      const stats = await fs.stat(result);
      expect(stats.size).to.be.greaterThan(1000); // Should be larger than 1KB
    }).timeout(30000);

    it('should handle intro-only scenarios without main voiceover overlap', async () => {
      // Skip if no ElevenLabs API key
      if (!process.env.ELEVENLABS_API_KEY) {
        console.log('⚠️ Skipping intro-only test - no ELEVENLABS_API_KEY');
        return;
      }

      // Generate test audio first
      await generateVoiceover('Short main content.', testAudio);
      
      const options = {
        enableIntroOutro: true,
        introOutroOptions: {
          introDuration: 5.0, // 5 second intro (longer than main)
          introVoiceoverText: 'This is a longer intro message for testing timing'
        }
      };

      const result = await createShortVideo([testImage], testAudio, testOutput, options);
      
      expect(result).to.equal(path.resolve(testOutput));
      
      // Verify output file exists
      const stats = await fs.stat(result);
      expect(stats.size).to.be.greaterThan(0);
    }).timeout(30000);
  });

  describe('Audio Filter Validation', () => {
    it('should create valid FFmpeg filter complex for intro + main audio', () => {
      // This test validates the filter logic without actually running FFmpeg
      const mockConfig = {
        introConfig: {
          enabled: true,
          duration: 5.0,
          volume: 1.0
        },
        mainContentConfig: {
          imageCount: 1,
          duration: 10.0,
          backgroundVolume: 0.15,
          transitionConfig: { filterComplex: '' }
        },
        backgroundMusicPath: '/path/to/music.wav',
        totalDuration: 15.0,
        resolution: '1920x1080',
        introVoiceoverIndex: 2,
        mainVoiceoverIndex: 3  // This should be different from introVoiceoverIndex
      };

      // Test the actual filter creation function
      const filterComplex = createIntroOutroFilter(mockConfig);
      
      // Validate that the filter uses correct audio input indices
      expect(filterComplex).to.include('[2:a]'); // Intro voiceover should use input 2
      expect(filterComplex).to.include('[3:a]'); // Main voiceover should use input 3
      expect(filterComplex).to.include('atrim=0:5'); // Intro should be trimmed to 5 seconds
      expect(filterComplex).to.include('adelay=5000|5000'); // Main should be delayed by 5 seconds
      
      // Validate intro music volume control (low during narration, higher after)
      expect(filterComplex).to.include('volume=0.2'); // Low volume during narration (20%)
      expect(filterComplex).to.include('volume=0.6'); // Higher volume after narration (60%)
      
      // Ensure we're not incorrectly using the same input for both
      expect(filterComplex).to.not.match(/\[2:a\].*\[2:a\]/); // Should not use [2:a] twice in audio processing
      
      console.log('Generated filter complex:', filterComplex);
    });

    it('should handle missing intro voiceover gracefully', () => {
      const mockConfig = {
        introConfig: {
          enabled: true,
          duration: 5.0,
          volume: 1.0
        },
        mainContentConfig: {
          imageCount: 1,
          duration: 10.0,
          backgroundVolume: 0.15,
          transitionConfig: { filterComplex: '' }
        },
        backgroundMusicPath: null,
        totalDuration: 15.0,
        resolution: '1920x1080',
        introVoiceoverIndex: null, // No intro voiceover
        mainVoiceoverIndex: 2      // Main voiceover at input 2
      };

      // Test the actual filter creation function without intro voiceover
      const filterComplex = createIntroOutroFilter(mockConfig);
      
      // Should still handle main voiceover correctly
      expect(filterComplex).to.include('[2:a]'); // Main voiceover should use input 2
      expect(filterComplex).to.include('adelay=5000|5000'); // Main should still be delayed
      
      // Should not include intro voiceover processing
      expect(filterComplex).to.not.include('atrim=0:5');
      expect(filterComplex).to.not.include('intro_voice');
      
      console.log('Filter complex without intro voiceover:', filterComplex);
    });
  });

  describe('Banner Scaling Fixes', () => {
    it('should scale banner appropriately for vertical format (short videos)', () => {
      const config = {
        introConfig: { enabled: true, duration: 5.0 },
        mainContentConfig: {
          imageCount: 1,
          duration: 10.0,
          backgroundVolume: 0.15,
          transitionConfig: { filterComplex: '' }
        },
        backgroundMusicPath: null,
        totalDuration: 15.0,
        resolution: '1080x1920', // Vertical format
        introVoiceoverIndex: null,
        mainVoiceoverIndex: 2
      };

      const result = createIntroOutroFilter(config);
      
      // Should use 'decrease' scaling and padding for vertical format
      expect(result).to.include('force_original_aspect_ratio=decrease');
      expect(result).to.include('pad=1080:1920');
      expect(result).to.include('color=black');
    });

    it('should scale banner appropriately for horizontal format (regular videos)', () => {
      const config = {
        introConfig: { enabled: true, duration: 5.0 },
        mainContentConfig: {
          imageCount: 1,
          duration: 10.0,
          backgroundVolume: 0.15,
          transitionConfig: { filterComplex: '' }
        },
        backgroundMusicPath: null,
        totalDuration: 15.0,
        resolution: '1920x1080', // Horizontal format
        introVoiceoverIndex: null,
        mainVoiceoverIndex: 2
      };

      const result = createIntroOutroFilter(config);
      
      // Should use 'increase' scaling and crop for horizontal format
      expect(result).to.include('force_original_aspect_ratio=increase');
      expect(result).to.include('crop=1920:1080');
    });

    it('should detect vertical vs horizontal format correctly', () => {
      // Test vertical detection
      const verticalConfig = {
        introConfig: { enabled: true, duration: 5.0 },
        mainContentConfig: {
          imageCount: 1,
          duration: 10.0,
          backgroundVolume: 0.15,
          transitionConfig: { filterComplex: '' }
        },
        backgroundMusicPath: null,
        totalDuration: 15.0,
        resolution: '1080x1920',
        introVoiceoverIndex: null,
        mainVoiceoverIndex: 2
      };

      const verticalResult = createIntroOutroFilter(verticalConfig);
      expect(verticalResult).to.include('decrease');
      expect(verticalResult).to.include('pad=');

      // Test horizontal detection
      const horizontalConfig = {
        introConfig: { enabled: true, duration: 5.0 },
        mainContentConfig: {
          imageCount: 1,
          duration: 10.0,
          backgroundVolume: 0.15,
          transitionConfig: { filterComplex: '' }
        },
        backgroundMusicPath: null,
        totalDuration: 15.0,
        resolution: '1920x1080',
        introVoiceoverIndex: null,
        mainVoiceoverIndex: 2
      };

      const horizontalResult = createIntroOutroFilter(horizontalConfig);
      expect(horizontalResult).to.include('increase');
      expect(horizontalResult).to.include('crop=');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing audio file gracefully', async () => {
      const nonExistentAudio = path.join(testDir, 'nonexistent.mp3');
      
      try {
        await createVideo(testImage, nonExistentAudio, testOutput);
        expect.fail('Should have thrown an error for missing audio file');
      } catch (error) {
        expect(error.message).to.include('not found');
      }
    });

    it('should handle missing image file gracefully', async () => {
      // Generate test audio first
      if (process.env.ELEVENLABS_API_KEY) {
        await generateVoiceover('Test audio content.', testAudio);
      } else {
        // Create a dummy audio file for testing
        await fs.writeFile(testAudio, Buffer.alloc(1000));
      }
      
      const nonExistentImage = path.join(testDir, 'nonexistent.jpg');
      
      try {
        await createVideo(nonExistentImage, testAudio, testOutput);
        expect.fail('Should have thrown an error for missing image file');
      } catch (error) {
        expect(error.message).to.include('not found');
      }
    });

    it('should validate voice gender parameter', async () => {
      // Skip if no ElevenLabs API key
      if (!process.env.ELEVENLABS_API_KEY) {
        console.log('⚠️ Skipping voice gender validation test - no ELEVENLABS_API_KEY');
        return;
      }

      try {
        await generateVoiceover('Test text', testAudio, undefined, 'invalid_gender');
        expect.fail('Should have thrown an error for invalid gender');
      } catch (error) {
        expect(error.message).to.include('Gender must be');
      }
    });
  });
});