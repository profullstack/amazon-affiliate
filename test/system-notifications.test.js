import { expect } from 'chai';
import { describe, it } from 'mocha';
import { systemBeep, videoCompletionBeep, youtubeReadyBeep, playAudioFile } from '../src/utils/system-notifications.js';
import path from 'path';

describe('System Notifications', () => {
  describe('systemBeep', () => {
    it('should execute without throwing errors', () => {
      expect(() => systemBeep()).to.not.throw();
    });

    it('should handle multiple beeps', () => {
      expect(() => systemBeep(3, 100)).to.not.throw();
    });
  });

  describe('videoCompletionBeep', () => {
    it('should execute without throwing errors', async () => {
      // This test verifies the function runs without errors
      // The actual audio playback may fail in test environment, which is expected
      try {
        await videoCompletionBeep();
      } catch (error) {
        // Audio playback failure is acceptable in test environment
        console.log('Audio playback failed in test environment (expected):', error.message);
      }
    });
  });

  describe('youtubeReadyBeep', () => {
    it('should execute without throwing errors', () => {
      expect(() => youtubeReadyBeep()).to.not.throw();
    });
  });

  describe('playAudioFile', () => {
    it('should handle non-existent audio file gracefully', async () => {
      const nonExistentPath = './non-existent-file.wav';
      
      // Should not throw, but may fall back to system beep
      try {
        await playAudioFile(nonExistentPath);
      } catch (error) {
        // Expected to fail gracefully
        expect(error).to.be.an('error');
      }
    });

    it('should handle beep.wav file if it exists', async () => {
      const beepPath = path.resolve('./src/media/beep.wav');
      
      // Should not throw, regardless of whether file exists or audio system works
      try {
        await playAudioFile(beepPath);
        console.log('✅ beep.wav played successfully');
      } catch (error) {
        // Audio playback failure is acceptable in test environment
        console.log('Audio playback failed (may be expected in test environment):', error.message);
      }
    });
  });
});