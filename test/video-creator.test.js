import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs/promises';
import { createSlideshow } from '../src/video-creator.js';

describe('Video Creator', () => {
  describe('createSlideshow', () => {
    let ffmpegStub;
    let fsStub;
    let processStub;

    beforeEach(() => {
      // Mock FFmpeg fluent interface
      const mockCommand = {
        input: sinon.stub().returnsThis(),
        loop: sinon.stub().returnsThis(),
        outputOptions: sinon.stub().returnsThis(),
        videoFilters: sinon.stub().returnsThis(),
        audioFilters: sinon.stub().returnsThis(),
        fps: sinon.stub().returnsThis(),
        size: sinon.stub().returnsThis(),
        aspect: sinon.stub().returnsThis(),
        save: sinon.stub().returnsThis(),
        on: sinon.stub().returnsThis(),
        run: sinon.stub()
      };

      // Setup event handling for success case
      mockCommand.on.withArgs('end').callsArg(1);
      mockCommand.save.returns(mockCommand);

      ffmpegStub = sinon.stub().returns(mockCommand);
      
      fsStub = {
        stat: sinon.stub(),
        mkdir: sinon.stub(),
        access: sinon.stub()
      };

      // Mock file stats
      fsStub.stat.resolves({ size: 1024000 }); // 1MB file
      fsStub.mkdir.resolves();
      fsStub.access.resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should create slideshow video from images and audio', async () => {
      const imagePaths = [
        'temp/image-0.jpg',
        'temp/image-1.jpg',
        'temp/image-2.jpg'
      ];
      const audioPath = 'temp/voiceover.mp3';
      const outputPath = 'output/video.mp4';

      const result = await createSlideshow(imagePaths, audioPath, outputPath);

      expect(result).to.equal(outputPath);
      expect(ffmpegStub).to.have.been.calledOnce;
    });

    it('should use default output path when not provided', async () => {
      const imagePaths = ['temp/image-0.jpg'];
      const audioPath = 'temp/voiceover.mp3';

      const result = await createSlideshow(imagePaths, audioPath);

      expect(result).to.equal('output/slideshow.mp4');
    });

    it('should throw error when no images provided', async () => {
      try {
        await createSlideshow([], 'temp/voiceover.mp3');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('At least one image is required');
      }
    });

    it('should throw error when audio file is missing', async () => {
      const imagePaths = ['temp/image-0.jpg'];

      try {
        await createSlideshow(imagePaths, '');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Audio file path is required');
      }
    });

    it('should validate that image files exist', async () => {
      const imagePaths = ['nonexistent.jpg'];
      const audioPath = 'temp/voiceover.mp3';

      fsStub.access.onFirstCall().rejects(new Error('File not found'));

      try {
        await createSlideshow(imagePaths, audioPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Image file not found');
      }
    });

    it('should validate that audio file exists', async () => {
      const imagePaths = ['temp/image-0.jpg'];
      const audioPath = 'nonexistent.mp3';

      fsStub.access.onFirstCall().resolves(); // Image exists
      fsStub.access.onSecondCall().rejects(new Error('File not found')); // Audio missing

      try {
        await createSlideshow(imagePaths, audioPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Audio file not found');
      }
    });

    it('should handle FFmpeg errors', async () => {
      const imagePaths = ['temp/image-0.jpg'];
      const audioPath = 'temp/voiceover.mp3';

      const mockCommand = ffmpegStub();
      mockCommand.on.withArgs('error').callsArgWith(1, new Error('FFmpeg failed'));

      try {
        await createSlideshow(imagePaths, audioPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Video creation failed');
      }
    });

    it('should apply correct video settings', async () => {
      const imagePaths = ['temp/image-0.jpg'];
      const audioPath = 'temp/voiceover.mp3';
      const options = {
        duration: 5,
        fps: 30,
        resolution: '1920x1080',
        transition: 'fade'
      };

      await createSlideshow(imagePaths, audioPath, undefined, options);

      const mockCommand = ffmpegStub();
      expect(mockCommand.fps).to.have.been.calledWith(30);
      expect(mockCommand.size).to.have.been.calledWith('1920x1080');
    });

    it('should handle custom video options', async () => {
      const imagePaths = ['temp/image-0.jpg', 'temp/image-1.jpg'];
      const audioPath = 'temp/voiceover.mp3';
      const options = {
        duration: 3,
        fps: 24,
        resolution: '1280x720',
        quality: 'high'
      };

      await createSlideshow(imagePaths, audioPath, undefined, options);

      const mockCommand = ffmpegStub();
      expect(mockCommand.outputOptions).to.have.been.called;
    });

    it('should create output directory if it does not exist', async () => {
      const imagePaths = ['temp/image-0.jpg'];
      const audioPath = 'temp/voiceover.mp3';
      const outputPath = 'new-dir/video.mp4';

      await createSlideshow(imagePaths, audioPath, outputPath);

      expect(fsStub.mkdir).to.have.been.calledWith('new-dir', { recursive: true });
    });

    it('should validate output file was created', async () => {
      const imagePaths = ['temp/image-0.jpg'];
      const audioPath = 'temp/voiceover.mp3';
      const outputPath = 'output/video.mp4';

      fsStub.stat.onCall(2).rejects(new Error('File not found')); // Output file check

      try {
        await createSlideshow(imagePaths, audioPath, outputPath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Output video file was not created');
      }
    });

    it('should handle progress reporting', async () => {
      const imagePaths = ['temp/image-0.jpg'];
      const audioPath = 'temp/voiceover.mp3';
      const progressCallback = sinon.stub();

      await createSlideshow(imagePaths, audioPath, undefined, { onProgress: progressCallback });

      const mockCommand = ffmpegStub();
      expect(mockCommand.on).to.have.been.calledWith('progress');
    });

    it('should apply image scaling and padding', async () => {
      const imagePaths = ['temp/image-0.jpg'];
      const audioPath = 'temp/voiceover.mp3';
      const options = {
        resolution: '1920x1080',
        scaleMode: 'fit'
      };

      await createSlideshow(imagePaths, audioPath, undefined, options);

      const mockCommand = ffmpegStub();
      expect(mockCommand.videoFilters).to.have.been.called;
    });

    it('should handle multiple image formats', async () => {
      const imagePaths = [
        'temp/image-0.jpg',
        'temp/image-1.png',
        'temp/image-2.webp'
      ];
      const audioPath = 'temp/voiceover.mp3';

      const result = await createSlideshow(imagePaths, audioPath);

      expect(result).to.equal('output/slideshow.mp4');
      expect(ffmpegStub).to.have.been.calledOnce;
    });

    it('should calculate appropriate duration per image based on audio length', async () => {
      const imagePaths = ['temp/image-0.jpg', 'temp/image-1.jpg'];
      const audioPath = 'temp/voiceover.mp3';
      
      // Mock audio duration detection
      const mockCommand = ffmpegStub();
      mockCommand.on.withArgs('codecData').callsArgWith(1, { duration: '10.5' });

      await createSlideshow(imagePaths, audioPath);

      expect(mockCommand.on).to.have.been.calledWith('codecData');
    });
  });
});