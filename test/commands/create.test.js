/**
 * Tests for create command with YouTube authentication
 * Using Mocha test framework with Chai assertions
 */

import { expect } from 'chai';
import sinon from 'sinon';
import createCommand from '../../src/commands/create.js';
import * as youtubeAuthUtils from '../../src/youtube-auth-utils.js';
import * as indexModule from '../../src/index.js';

describe('Create Command', () => {
  let consoleLogStub;
  let processExitStub;
  let ensureYouTubeAuthenticationStub;
  let createAffiliateVideoStub;

  beforeEach(() => {
    // Stub console.log to prevent test output noise
    consoleLogStub = sinon.stub(console, 'log');
    
    // Stub process.exit to prevent test termination
    processExitStub = sinon.stub(process, 'exit');
    
    // Stub YouTube authentication
    ensureYouTubeAuthenticationStub = sinon.stub(youtubeAuthUtils, 'ensureYouTubeAuthentication');
    
    // Stub video creation
    createAffiliateVideoStub = sinon.stub(indexModule, 'createAffiliateVideo');
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  describe('YouTube Authentication Integration', () => {
    it('should authenticate with YouTube before creating video', async () => {
      // Setup successful authentication
      ensureYouTubeAuthenticationStub.resolves({
        success: true,
        channel: { title: 'Test Channel', subscribers: '1000', videos: '50' }
      });
      
      // Setup successful video creation
      createAffiliateVideoStub.resolves({
        success: true,
        files: { video: 'test-video.mp4' },
        stats: { imagesDownloaded: 5 }
      });

      // Run create command
      await createCommand(['B123456789']);

      // Verify authentication was called first
      expect(ensureYouTubeAuthenticationStub).to.have.been.calledOnce;
      expect(createAffiliateVideoStub).to.have.been.calledOnce;
      
      // Verify authentication was called before video creation
      expect(ensureYouTubeAuthenticationStub).to.have.been.calledBefore(createAffiliateVideoStub);
    });

    it('should exit with error when YouTube authentication fails', async () => {
      // Setup failed authentication
      const authError = new Error('YouTube authentication failed: Missing credentials');
      ensureYouTubeAuthenticationStub.rejects(authError);

      // Run create command
      await createCommand(['B123456789']);

      // Verify authentication was attempted
      expect(ensureYouTubeAuthenticationStub).to.have.been.calledOnce;
      
      // Verify video creation was not called
      expect(createAffiliateVideoStub).to.not.have.been.called;
      
      // Verify process exit was called with error
      expect(processExitStub).to.have.been.calledWith(1);
    });

    it('should handle authentication timeout gracefully', async () => {
      // Setup authentication timeout
      const timeoutError = new Error('Authentication timeout');
      ensureYouTubeAuthenticationStub.rejects(timeoutError);

      // Run create command
      await createCommand(['B123456789']);

      // Verify proper error handling
      expect(ensureYouTubeAuthenticationStub).to.have.been.calledOnce;
      expect(createAffiliateVideoStub).to.not.have.been.called;
      expect(processExitStub).to.have.been.calledWith(1);
    });

    it('should proceed with video creation after successful authentication', async () => {
      // Setup successful authentication
      ensureYouTubeAuthenticationStub.resolves({
        success: true,
        channel: { title: 'Test Channel', subscribers: '1000', videos: '50' }
      });
      
      // Setup successful video creation
      const mockResult = {
        success: true,
        files: { 
          video: 'output/test-video.mp4',
          shortVideo: 'output/test-short.mp4',
          thumbnail: 'output/thumbnail.jpg'
        },
        stats: { imagesDownloaded: 5, videoSize: 1024000 },
        timing: { totalDuration: 120000 }
      };
      createAffiliateVideoStub.resolves(mockResult);

      // Run create command with options
      await createCommand(['B123456789', '--quality', 'high', '--max-images', '3']);

      // Verify authentication was successful
      expect(ensureYouTubeAuthenticationStub).to.have.been.calledOnce;
      
      // Verify video creation was called with correct parameters
      expect(createAffiliateVideoStub).to.have.been.calledOnce;
      const [productInput, options] = createAffiliateVideoStub.firstCall.args;
      expect(productInput).to.equal('B123456789');
      expect(options).to.have.property('videoQuality', 'high');
      expect(options).to.have.property('maxImages', 3);
    });
  });

  describe('Command Options Integration', () => {
    beforeEach(() => {
      // Setup successful authentication for all tests
      ensureYouTubeAuthenticationStub.resolves({
        success: true,
        channel: { title: 'Test Channel', subscribers: '1000', videos: '50' }
      });
      
      // Setup successful video creation
      createAffiliateVideoStub.resolves({
        success: true,
        files: { video: 'test-video.mp4' }
      });
    });

    it('should pass through quality option correctly', async () => {
      await createCommand(['B123456789', '--quality', 'ultra']);

      const [, options] = createAffiliateVideoStub.firstCall.args;
      expect(options).to.have.property('videoQuality', 'ultra');
    });

    it('should pass through max-images option correctly', async () => {
      await createCommand(['B123456789', '--max-images', '10']);

      const [, options] = createAffiliateVideoStub.firstCall.args;
      expect(options).to.have.property('maxImages', 10);
    });

    it('should pass through auto-upload option correctly', async () => {
      await createCommand(['B123456789', '--auto-upload']);

      const [, options] = createAffiliateVideoStub.firstCall.args;
      expect(options).to.have.property('autoUpload', true);
    });

    it('should pass through auto-promote option correctly', async () => {
      await createCommand(['B123456789', '--auto-promote', '--promotion-platforms', 'reddit,twitter']);

      const [, options] = createAffiliateVideoStub.firstCall.args;
      expect(options).to.have.property('autoPromote', true);
      expect(options.promotionPlatforms).to.deep.equal(['reddit', 'twitter']);
    });

    it('should handle no-cleanup option correctly', async () => {
      await createCommand(['B123456789', '--no-cleanup']);

      const [, options] = createAffiliateVideoStub.firstCall.args;
      expect(options).to.have.property('cleanup', false);
    });

    it('should handle no-short-video option correctly', async () => {
      await createCommand(['B123456789', '--no-short-video']);

      const [, options] = createAffiliateVideoStub.firstCall.args;
      expect(options).to.have.property('createShortVideo', false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Setup successful authentication for error handling tests
      ensureYouTubeAuthenticationStub.resolves({
        success: true,
        channel: { title: 'Test Channel', subscribers: '1000', videos: '50' }
      });
    });

    it('should handle video creation errors gracefully', async () => {
      // Setup video creation failure
      const videoError = new Error('Video creation failed: Invalid product ID');
      createAffiliateVideoStub.rejects(videoError);

      await createCommand(['INVALID123']);

      // Verify authentication was successful
      expect(ensureYouTubeAuthenticationStub).to.have.been.calledOnce;
      
      // Verify video creation was attempted
      expect(createAffiliateVideoStub).to.have.been.calledOnce;
      
      // Verify process exit was called with error
      expect(processExitStub).to.have.been.calledWith(1);
    });

    it('should handle missing required arguments', async () => {
      await createCommand([]);

      // Verify authentication was not called for invalid arguments
      expect(ensureYouTubeAuthenticationStub).to.not.have.been.called;
      expect(createAffiliateVideoStub).to.not.have.been.called;
      expect(processExitStub).to.have.been.calledWith(1);
    });

    it('should handle invalid quality option', async () => {
      await createCommand(['B123456789', '--quality', 'invalid']);

      // Verify authentication was not called for invalid options
      expect(ensureYouTubeAuthenticationStub).to.not.have.been.called;
      expect(createAffiliateVideoStub).to.not.have.been.called;
      expect(processExitStub).to.have.been.calledWith(1);
    });

    it('should handle invalid max-images option', async () => {
      await createCommand(['B123456789', '--max-images', '25']); // Over limit of 20

      // Verify authentication was not called for invalid options
      expect(ensureYouTubeAuthenticationStub).to.not.have.been.called;
      expect(createAffiliateVideoStub).to.not.have.been.called;
      expect(processExitStub).to.have.been.calledWith(1);
    });
  });

  describe('Output Display', () => {
    beforeEach(() => {
      // Setup successful authentication
      ensureYouTubeAuthenticationStub.resolves({
        success: true,
        channel: { title: 'Test Channel', subscribers: '1000', videos: '50' }
      });
    });

    it('should display configuration information', async () => {
      createAffiliateVideoStub.resolves({
        success: true,
        files: { video: 'test-video.mp4' }
      });

      await createCommand(['B123456789', '--quality', 'high', '--max-images', '3']);

      // Verify configuration output
      expect(consoleLogStub).to.have.been.calledWith('🚀 Starting affiliate video creation...');
      expect(consoleLogStub).to.have.been.calledWith('📦 Product: B123456789');
      expect(consoleLogStub).to.have.been.calledWith('⚙️  Quality: high');
      expect(consoleLogStub).to.have.been.calledWith('🖼️  Max images: 3');
    });

    it('should display success result', async () => {
      const mockResult = {
        success: true,
        files: { 
          video: 'output/test-video.mp4',
          shortVideo: 'output/test-short.mp4',
          thumbnail: 'output/thumbnail.jpg'
        },
        stats: { imagesDownloaded: 5 },
        timing: { totalDuration: 120000 }
      };
      createAffiliateVideoStub.resolves(mockResult);

      await createCommand(['B123456789']);

      // Verify success output (exact console.log calls may vary)
      expect(consoleLogStub).to.have.been.called;
      expect(processExitStub).to.not.have.been.called;
    });

    it('should display YouTube upload result', async () => {
      const mockResult = {
        success: true,
        youtubeUrl: 'https://youtu.be/abc123',
        files: { video: 'output/test-video.mp4' },
        stats: { imagesDownloaded: 5 }
      };
      createAffiliateVideoStub.resolves(mockResult);

      await createCommand(['B123456789', '--auto-upload']);

      // Verify YouTube upload output
      expect(consoleLogStub).to.have.been.called;
      expect(processExitStub).to.not.have.been.called;
    });
  });
});