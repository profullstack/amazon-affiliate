import { expect } from 'chai';
import sinon from 'sinon';
import { createAffiliateVideo } from '../src/index.js';

describe('Main Application', () => {
  describe('createAffiliateVideo', () => {
    let amazonScraperStub;
    let imageDownloaderStub;
    let voiceoverGeneratorStub;
    let videoCreatorStub;
    let youtubePublisherStub;

    beforeEach(() => {
      // Mock all module dependencies
      amazonScraperStub = {
        scrapeAmazonProduct: sinon.stub()
      };
      
      imageDownloaderStub = {
        downloadImages: sinon.stub(),
        cleanupImages: sinon.stub()
      };
      
      voiceoverGeneratorStub = {
        generateVoiceover: sinon.stub()
      };
      
      videoCreatorStub = {
        createSlideshow: sinon.stub()
      };
      
      youtubePublisherStub = {
        uploadToYouTube: sinon.stub()
      };

      // Setup successful responses
      amazonScraperStub.scrapeAmazonProduct.resolves({
        title: 'Amazing Product Title',
        images: [
          'https://m.media-amazon.com/images/I/image1.jpg',
          'https://m.media-amazon.com/images/I/image2.jpg'
        ],
        description: 'This is an amazing product with great features.'
      });

      imageDownloaderStub.downloadImages.resolves([
        'temp/image-0.jpg',
        'temp/image-1.jpg'
      ]);

      voiceoverGeneratorStub.generateVoiceover.resolves('temp/voiceover.mp3');
      
      videoCreatorStub.createSlideshow.resolves('output/video.mp4');
      
      youtubePublisherStub.uploadToYouTube.resolves({
        videoId: 'test-video-id',
        url: 'https://youtu.be/test-video-id',
        title: 'Amazing Product Title',
        status: 'uploaded'
      });

      imageDownloaderStub.cleanupImages.resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should create complete affiliate video workflow', async () => {
      const productUrl = 'https://www.amazon.com/dp/B08N5WRWNW';
      const options = {
        maxImages: 3,
        videoQuality: 'high'
      };

      const result = await createAffiliateVideo(productUrl, options);

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('videoId', 'test-video-id');
      expect(result).to.have.property('youtubeUrl', 'https://youtu.be/test-video-id');
      expect(result).to.have.property('productTitle', 'Amazing Product Title');

      // Verify workflow steps were called in correct order
      expect(amazonScraperStub.scrapeAmazonProduct).to.have.been.calledWith(productUrl);
      expect(imageDownloaderStub.downloadImages).to.have.been.calledAfter(
        amazonScraperStub.scrapeAmazonProduct
      );
      expect(voiceoverGeneratorStub.generateVoiceover).to.have.been.calledAfter(
        imageDownloaderStub.downloadImages
      );
      expect(videoCreatorStub.createSlideshow).to.have.been.calledAfter(
        voiceoverGeneratorStub.generateVoiceover
      );
      expect(youtubePublisherStub.uploadToYouTube).to.have.been.calledAfter(
        videoCreatorStub.createSlideshow
      );
    });

    it('should handle scraping failures gracefully', async () => {
      amazonScraperStub.scrapeAmazonProduct.rejects(new Error('Product not found'));

      const result = await createAffiliateVideo('https://www.amazon.com/dp/INVALID');

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
      expect(result.error).to.include('Product not found');
    });

    it('should handle image download failures', async () => {
      imageDownloaderStub.downloadImages.resolves([]); // No images downloaded

      const result = await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW');

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
      expect(result.error).to.include('No images were downloaded');
    });

    it('should handle voiceover generation failures', async () => {
      voiceoverGeneratorStub.generateVoiceover.rejects(new Error('API quota exceeded'));

      const result = await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW');

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
      expect(result.error).to.include('API quota exceeded');
    });

    it('should handle video creation failures', async () => {
      videoCreatorStub.createSlideshow.rejects(new Error('FFmpeg not found'));

      const result = await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW');

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
      expect(result.error).to.include('FFmpeg not found');
    });

    it('should handle YouTube upload failures', async () => {
      youtubePublisherStub.uploadToYouTube.rejects(new Error('Authentication failed'));

      const result = await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW');

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
      expect(result.error).to.include('Authentication failed');
    });

    it('should cleanup temporary files on success', async () => {
      await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW');

      expect(imageDownloaderStub.cleanupImages).to.have.been.calledWith([
        'temp/image-0.jpg',
        'temp/image-1.jpg'
      ]);
    });

    it('should cleanup temporary files on failure', async () => {
      videoCreatorStub.createSlideshow.rejects(new Error('Video creation failed'));

      await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW');

      expect(imageDownloaderStub.cleanupImages).to.have.been.called;
    });

    it('should respect maxImages option', async () => {
      const options = { maxImages: 2 };

      await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW', options);

      const downloadCall = imageDownloaderStub.downloadImages.getCall(0);
      const imagesArray = downloadCall.args[0];
      expect(imagesArray).to.have.lengthOf(2);
    });

    it('should pass video quality options to video creator', async () => {
      const options = { videoQuality: 'ultra' };

      await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW', options);

      const videoCall = videoCreatorStub.createSlideshow.getCall(0);
      const videoOptions = videoCall.args[3];
      expect(videoOptions).to.have.property('quality', 'ultra');
    });

    it('should generate appropriate video title from product title', async () => {
      await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW');

      const uploadCall = youtubePublisherStub.uploadToYouTube.getCall(0);
      const title = uploadCall.args[1];
      expect(title).to.include('Amazing Product Title');
      expect(title).to.include('Review');
    });

    it('should include timing information in result', async () => {
      const result = await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW');

      expect(result).to.have.property('timing');
      expect(result.timing).to.have.property('totalDuration');
      expect(result.timing).to.have.property('steps');
      expect(result.timing.steps).to.have.property('scraping');
      expect(result.timing.steps).to.have.property('imageDownload');
      expect(result.timing.steps).to.have.property('voiceoverGeneration');
      expect(result.timing.steps).to.have.property('videoCreation');
      expect(result.timing.steps).to.have.property('youtubeUpload');
    });

    it('should validate Amazon URL format', async () => {
      const invalidUrl = 'https://example.com/not-amazon';

      const result = await createAffiliateVideo(invalidUrl);

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
      expect(result.error).to.include('Invalid Amazon URL');
    });

    it('should handle progress reporting when callback provided', async () => {
      const progressCallback = sinon.stub();
      const options = { onProgress: progressCallback };

      await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW', options);

      expect(progressCallback).to.have.been.called;
      expect(progressCallback).to.have.been.calledWith(sinon.match({
        step: sinon.match.string,
        progress: sinon.match.number
      }));
    });

    it('should include file paths in result for debugging', async () => {
      const result = await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW');

      expect(result).to.have.property('files');
      expect(result.files).to.have.property('images');
      expect(result.files).to.have.property('voiceover');
      expect(result.files).to.have.property('video');
    });

    it('should handle custom output directories', async () => {
      const options = {
        tempDir: 'custom-temp',
        outputDir: 'custom-output'
      };

      await createAffiliateVideo('https://www.amazon.com/dp/B08N5WRWNW', options);

      expect(imageDownloaderStub.downloadImages).to.have.been.calledWith(
        sinon.match.any,
        'custom-temp'
      );
    });
  });
});