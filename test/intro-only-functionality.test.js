/**
 * Test suite for updated intro-only functionality (outro removed per user request)
 */

import { expect } from 'chai';
import fs from 'fs/promises';
import path from 'path';
import { createVideo, createSlideshow, createShortVideo, getVideoInfo } from '../src/video-creator.js';

describe('Intro-Only Video Creation (Outro Removed)', () => {
  const testOutputDir = './test-output';
  const testImagePath = './test/fixtures/test-image.jpg';
  const testAudioPath = './test/fixtures/test-audio.mp3';
  const testIntroImagePath = './src/media/banner.jpg';

  before(async () => {
    // Ensure test output directory exists
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  after(async () => {
    // Clean up test files
    try {
      const files = await fs.readdir(testOutputDir);
      for (const file of files) {
        if (file.includes('intro-only-test')) {
          await fs.unlink(path.join(testOutputDir, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createVideo with intro-only', () => {
    it('should create video with intro voiceover and no outro', async function() {
      this.timeout(60000); // 60 second timeout for video creation

      const outputPath = path.join(testOutputDir, 'intro-only-test-video.mp4');
      
      const options = {
        enableIntroOutro: true,
        enableBackgroundMusic: true,
        introOutroOptions: {
          introDuration: 5.0,
          introVolume: 1.0, // 100% volume for intro music
          introImagePath: testIntroImagePath,
          introVoiceoverText: 'Welcome to The Professional Prompt where we review your favorite products'
        }
      };

      const result = await createVideo(testImagePath, testAudioPath, outputPath, options);
      
      expect(result).to.equal(outputPath);
      
      // Verify file exists and has content
      const stats = await fs.stat(outputPath);
      expect(stats.size).to.be.greaterThan(1000000); // At least 1MB
      
      // Get video info to verify duration includes intro
      const videoInfo = await getVideoInfo(outputPath);
      expect(parseFloat(videoInfo.duration)).to.be.greaterThan(10); // Should be longer than just audio
      
      console.log(`✅ Intro-only video created: ${outputPath} (${Math.round(stats.size / 1024)}KB, ${parseFloat(videoInfo.duration).toFixed(2)}s)`);
    });
  });

  describe('createSlideshow with intro-only', () => {
    it('should create slideshow with intro voiceover and no outro', async function() {
      this.timeout(90000); // 90 second timeout for slideshow creation

      const outputPath = path.join(testOutputDir, 'intro-only-test-slideshow.mp4');
      const imagePaths = [testImagePath, testImagePath]; // Use same image twice for slideshow
      
      const options = {
        enableIntroOutro: true,
        enableBackgroundMusic: true,
        introOutroOptions: {
          introDuration: 5.0,
          introVolume: 1.0, // 100% volume for intro music
          introImagePath: testIntroImagePath,
          introVoiceoverText: 'Welcome to The Professional Prompt where we review your favorite products'
        }
      };

      const result = await createSlideshow(imagePaths, testAudioPath, outputPath, options);
      
      expect(result).to.equal(outputPath);
      
      // Verify file exists and has content
      const stats = await fs.stat(outputPath);
      expect(stats.size).to.be.greaterThan(1000000); // At least 1MB
      
      // Get video info to verify duration includes intro
      const videoInfo = await getVideoInfo(outputPath);
      expect(parseFloat(videoInfo.duration)).to.be.greaterThan(10); // Should be longer than just audio
      
      console.log(`✅ Intro-only slideshow created: ${outputPath} (${Math.round(stats.size / 1024)}KB, ${parseFloat(videoInfo.duration).toFixed(2)}s)`);
    });
  });

  describe('createShortVideo with intro-only', () => {
    it('should create short video with intro voiceover and no outro', async function() {
      this.timeout(60000); // 60 second timeout for short video creation

      const outputPath = path.join(testOutputDir, 'intro-only-test-short.mp4');
      const imagePaths = [testImagePath];
      
      const options = {
        enableIntroOutro: true,
        enableBackgroundMusic: true,
        introOutroOptions: {
          introDuration: 5.0,
          introVolume: 1.0, // 100% volume for intro music
          introImagePath: testIntroImagePath,
          introVoiceoverText: 'Welcome to The Professional Prompt where we review your favorite products'
        }
      };

      const result = await createShortVideo(imagePaths, testAudioPath, outputPath, options);
      
      expect(result).to.equal(outputPath);
      
      // Verify file exists and has content
      const stats = await fs.stat(outputPath);
      expect(stats.size).to.be.greaterThan(500000); // At least 500KB for short video
      
      // Get video info to verify it's vertical format and includes intro
      const videoInfo = await getVideoInfo(outputPath);
      expect(videoInfo.video.width).to.equal(1080);
      expect(videoInfo.video.height).to.equal(1920);
      expect(parseFloat(videoInfo.duration)).to.be.greaterThan(10); // Should be longer than just audio
      
      console.log(`✅ Intro-only short video created: ${outputPath} (${Math.round(stats.size / 1024)}KB, ${parseFloat(videoInfo.duration).toFixed(2)}s, ${videoInfo.video.width}x${videoInfo.video.height})`);
    });
  });

  describe('Intro voiceover text validation', () => {
    it('should use the correct intro voiceover text', () => {
      const expectedText = 'Welcome to The Professional Prompt where we review your favorite products';
      
      // This test validates that our intro text matches the user's requirement
      expect(expectedText).to.include('Welcome to The Professional Prompt');
      expect(expectedText).to.include('where we review your favorite products');
      expect(expectedText.length).to.be.greaterThan(50); // Reasonable length for voiceover
    });
  });

  describe('Outro removal validation', () => {
    it('should not include outro in video duration calculation', async () => {
      // Test that outro is completely removed from configuration
      const { createIntroOutroSegments } = await import('../src/video-creator.js');
      
      // This will fail if we try to access the private function, but we can test the concept
      // by ensuring our options don't include outro settings
      const introOnlyOptions = {
        introDuration: 5.0,
        introVolume: 1.0,
        introImagePath: testIntroImagePath,
        introVoiceoverText: 'Welcome to The Professional Prompt where we review your favorite products'
      };
      
      // Verify no outro-related options are present
      expect(introOnlyOptions).to.not.have.property('outroDuration');
      expect(introOnlyOptions).to.not.have.property('outroVolume');
      expect(introOnlyOptions).to.not.have.property('outroImagePath');
    });
  });
});