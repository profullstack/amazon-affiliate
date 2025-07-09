import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs/promises';
import { uploadToYouTube, uploadToYouTubeShorts } from '../src/youtube-publisher.js';

// Mock the google module
const mockGoogle = {
  youtube: sinon.stub(),
  auth: {
    OAuth2: sinon.stub()
  }
};

// Mock OAuth2 client
const mockOAuth2Client = {
  setCredentials: sinon.stub(),
  on: sinon.stub()
};

// Mock YouTube API
const mockYouTubeAPI = {
  videos: {
    insert: sinon.stub()
  },
  thumbnails: {
    set: sinon.stub()
  }
};

describe('YouTube Publisher', () => {
  describe('uploadToYouTube', () => {
    let googleStub;
    let fsStub;
    let processStub;

    beforeEach(() => {
      // Mock Google APIs
      const mockYouTube = {
        videos: {
          insert: sinon.stub()
        }
      };

      googleStub = {
        youtube: sinon.stub().returns(mockYouTube),
        auth: {
          OAuth2: sinon.stub()
        }
      };

      fsStub = {
        readFile: sinon.stub(),
        stat: sinon.stub(),
        createReadStream: sinon.stub()
      };

      processStub = {
        env: {
          YOUTUBE_CLIENT_ID: 'test-client-id',
          YOUTUBE_CLIENT_SECRET: 'test-client-secret',
          YOUTUBE_OAUTH2_ACCESS_TOKEN: 'test-access-token',
          AFFILIATE_TAG: 'test-affiliate-tag'
        }
      };

      // Mock successful upload response
      mockYouTube.videos.insert.resolves({
        data: {
          id: 'test-video-id',
          snippet: {
            title: 'Test Video',
            description: 'Test Description'
          },
          status: {
            uploadStatus: 'uploaded',
            privacyStatus: 'public'
          }
        }
      });

      fsStub.stat.resolves({ size: 10485760 }); // 10MB file
      fsStub.readFile.resolves(Buffer.from('fake video data'));
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should upload video to YouTube successfully', async () => {
      const videoPath = 'output/test-video.mp4';
      const title = 'Amazing Product Review';
      const description = 'Check out this amazing product!';
      const productUrl = 'https://www.amazon.com/dp/B08N5WRWNW';

      const result = await uploadToYouTube(videoPath, title, description, productUrl);

      expect(result).to.have.property('videoId', 'test-video-id');
      expect(result).to.have.property('url', 'https://youtu.be/test-video-id');
      expect(googleStub.youtube).to.have.been.calledOnce;
    });

    it('should throw error when required environment variables are missing', async () => {
      processStub.env.YOUTUBE_CLIENT_ID = undefined;

      try {
        await uploadToYouTube('video.mp4', 'Title', 'Description');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('YOUTUBE_CLIENT_ID is required');
      }
    });

    it('should throw error when video file does not exist', async () => {
      fsStub.stat.rejects(new Error('File not found'));

      try {
        await uploadToYouTube('nonexistent.mp4', 'Title', 'Description');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Video file not found');
      }
    });

    it('should throw error when video file is too large', async () => {
      fsStub.stat.resolves({ size: 137438953472 }); // 128GB file (exceeds YouTube limit)

      try {
        await uploadToYouTube('huge-video.mp4', 'Title', 'Description');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Video file is too large');
      }
    });

    it('should include affiliate link in description', async () => {
      const videoPath = 'output/test-video.mp4';
      const title = 'Product Review';
      const description = 'Great product!';
      const productUrl = 'https://www.amazon.com/dp/B08N5WRWNW';

      await uploadToYouTube(videoPath, title, description, productUrl);

      const mockYouTube = googleStub.youtube();
      const uploadCall = mockYouTube.videos.insert.getCall(0);
      const requestBody = uploadCall.args[0].requestBody;

      expect(requestBody.snippet.description).to.include('test-affiliate-tag');
      expect(requestBody.snippet.description).to.include(productUrl);
    });

    it('should handle YouTube API errors', async () => {
      const mockYouTube = googleStub.youtube();
      mockYouTube.videos.insert.rejects(new Error('Quota exceeded'));

      try {
        await uploadToYouTube('video.mp4', 'Title', 'Description');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('YouTube upload failed');
        expect(error.message).to.include('Quota exceeded');
      }
    });

    it('should use correct video metadata', async () => {
      const videoPath = 'output/test-video.mp4';
      const title = 'Product Review Video';
      const description = 'Detailed product review';
      const productUrl = 'https://www.amazon.com/dp/B08N5WRWNW';
      const options = {
        tags: ['product', 'review', 'amazon'],
        categoryId: '26',
        privacyStatus: 'public'
      };

      await uploadToYouTube(videoPath, title, description, productUrl, options);

      const mockYouTube = googleStub.youtube();
      const uploadCall = mockYouTube.videos.insert.getCall(0);
      const requestBody = uploadCall.args[0].requestBody;

      expect(requestBody.snippet.title).to.equal(title);
      expect(requestBody.snippet.tags).to.include.members(['product', 'review', 'amazon']);
      expect(requestBody.snippet.categoryId).to.equal('26');
      expect(requestBody.status.privacyStatus).to.equal('public');
    });

    it('should handle upload progress reporting', async () => {
      const progressCallback = sinon.stub();
      const options = { onProgress: progressCallback };

      await uploadToYouTube('video.mp4', 'Title', 'Description', undefined, options);

      // Verify that progress callback setup was attempted
      const mockYouTube = googleStub.youtube();
      expect(mockYouTube.videos.insert).to.have.been.calledOnce;
    });

    it('should validate video title length', async () => {
      const longTitle = 'A'.repeat(150); // Exceeds YouTube's 100 character limit

      try {
        await uploadToYouTube('video.mp4', longTitle, 'Description');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Title is too long');
      }
    });

    it('should validate video description length', async () => {
      const longDescription = 'A'.repeat(6000); // Exceeds YouTube's 5000 character limit

      try {
        await uploadToYouTube('video.mp4', 'Title', longDescription);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Description is too long');
      }
    });

    it('should set default privacy status when not specified', async () => {
      await uploadToYouTube('video.mp4', 'Title', 'Description');

      const mockYouTube = googleStub.youtube();
      const uploadCall = mockYouTube.videos.insert.getCall(0);
      const requestBody = uploadCall.args[0].requestBody;

      expect(requestBody.status.privacyStatus).to.equal('public');
    });

    it('should include default tags when none provided', async () => {
      await uploadToYouTube('video.mp4', 'Title', 'Description');

      const mockYouTube = googleStub.youtube();
      const uploadCall = mockYouTube.videos.insert.getCall(0);
      const requestBody = uploadCall.args[0].requestBody;

      expect(requestBody.snippet.tags).to.include.members(['Amazon', 'Affiliate', 'Review']);
    });

    it('should handle authentication errors', async () => {
      const mockYouTube = googleStub.youtube();
      mockYouTube.videos.insert.rejects({
        code: 401,
        message: 'Invalid credentials'
      });

      try {
        await uploadToYouTube('video.mp4', 'Title', 'Description');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Authentication failed');
      }
    });

    it('should retry on temporary failures', async () => {
      const mockYouTube = googleStub.youtube();
      mockYouTube.videos.insert
        .onFirstCall().rejects(new Error('Temporary server error'))
        .onSecondCall().resolves({
          data: {
            id: 'retry-video-id',
            snippet: { title: 'Test', description: 'Test' },
            status: { uploadStatus: 'uploaded', privacyStatus: 'public' }
          }
        });

      const result = await uploadToYouTube('video.mp4', 'Title', 'Description');

      expect(result.videoId).to.equal('retry-video-id');
      expect(mockYouTube.videos.insert).to.have.been.calledTwice;
    });

    it('should generate proper affiliate URL', async () => {
      const productUrl = 'https://www.amazon.com/dp/B08N5WRWNW';
      
      await uploadToYouTube('video.mp4', 'Title', 'Description', productUrl);

      const mockYouTube = googleStub.youtube();
      const uploadCall = mockYouTube.videos.insert.getCall(0);
      const description = uploadCall.args[0].requestBody.snippet.description;

      expect(description).to.include('?tag=test-affiliate-tag');
    });

    it('should handle missing product URL gracefully', async () => {
      const result = await uploadToYouTube('video.mp4', 'Title', 'Description');

      expect(result).to.have.property('videoId');
      expect(result).to.have.property('url');
    });

    it('should validate supported video formats', async () => {
      const unsupportedFile = 'video.avi';

      try {
        await uploadToYouTube(unsupportedFile, 'Title', 'Description');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Unsupported video format');
      }
    });

    describe('buildDescription function', () => {
      it('should not duplicate affiliate content when already present', async () => {
        const existingDescription = `Great product review!

🛒 Get this product here: https://www.amazon.com/dp/B08N5WRWNW?tag=existing-tag

⚠️ As an Amazon Associate, I earn from qualifying purchases.
This helps support the channel at no extra cost to you!

#Amazon #ProductReview #Review`;
        
        const productUrl = 'https://www.amazon.com/dp/B08N5WRWNW';
        
        await uploadToYouTube('video.mp4', 'Title', existingDescription, productUrl);

        const mockYouTube = googleStub.youtube();
        const uploadCall = mockYouTube.videos.insert.getCall(0);
        const finalDescription = uploadCall.args[0].requestBody.snippet.description;

        // Should not contain duplicate affiliate sections
        const affiliateMatches = (finalDescription.match(/🛒 Get this product here:/g) || []).length;
        const associateMatches = (finalDescription.match(/As an Amazon Associate/g) || []).length;
        
        expect(affiliateMatches).to.equal(1, 'Should only have one affiliate link section');
        expect(associateMatches).to.equal(1, 'Should only have one associate disclaimer');
      });

      it('should add affiliate content when not present', async () => {
        const baseDescription = `Great product review!

#Amazon #ProductReview #Review`;
        
        const productUrl = 'https://www.amazon.com/dp/B08N5WRWNW';
        
        await uploadToYouTube('video.mp4', 'Title', baseDescription, productUrl);

        const mockYouTube = googleStub.youtube();
        const uploadCall = mockYouTube.videos.insert.getCall(0);
        const finalDescription = uploadCall.args[0].requestBody.snippet.description;

        expect(finalDescription).to.include('🛒 Get this product here:');
        expect(finalDescription).to.include('As an Amazon Associate');
        expect(finalDescription).to.include('test-affiliate-tag');
      });

      it('should handle partial affiliate content correctly', async () => {
        const partialDescription = `Great product review!

🛒 Get this product here: https://www.amazon.com/dp/B08N5WRWNW?tag=old-tag

#Amazon #ProductReview #Review`;
        
        const productUrl = 'https://www.amazon.com/dp/B08N5WRWNW';
        
        await uploadToYouTube('video.mp4', 'Title', partialDescription, productUrl);

        const mockYouTube = googleStub.youtube();
        const uploadCall = mockYouTube.videos.insert.getCall(0);
        const finalDescription = uploadCall.args[0].requestBody.snippet.description;

        // Should not duplicate the affiliate link section
        const affiliateMatches = (finalDescription.match(/🛒 Get this product here:/g) || []).length;
        expect(affiliateMatches).to.equal(1, 'Should only have one affiliate link section');
      });

      it('should preserve existing content when no product URL provided', async () => {
        const existingDescription = `Great product review!

🛒 Get this product here: https://www.amazon.com/dp/B08N5WRWNW?tag=existing-tag

⚠️ As an Amazon Associate, I earn from qualifying purchases.
This helps support the channel at no extra cost to you!

#Amazon #ProductReview #Review`;
        
        await uploadToYouTube('video.mp4', 'Title', existingDescription);

        const mockYouTube = googleStub.youtube();
        const uploadCall = mockYouTube.videos.insert.getCall(0);
        const finalDescription = uploadCall.args[0].requestBody.snippet.description;

        expect(finalDescription).to.equal(existingDescription);
      });
    });

    describe('buildDescription with Shorts optimization', () => {
      it('should create concise description for Shorts', async () => {
        const longDescription = 'This is a very long description that should be truncated for YouTube Shorts to keep it under the recommended character limit for better visibility and engagement.';
        
        await uploadToYouTube('video.mp4', 'Title', longDescription, 'https://amazon.com/product', { isShorts: true });

        const mockYouTube = googleStub.youtube();
        const uploadCall = mockYouTube.videos.insert.getCall(0);
        const finalDescription = uploadCall.args[0].requestBody.snippet.description;
        
        expect(finalDescription).to.include('This is a very long description that should be truncated for YouTube Shorts to keep it under...');
        expect(finalDescription).to.include('#Shorts #Short #Vertical #QuickReview');
        expect(finalDescription).to.include('🛒 https://amazon.com/product?tag=test-affiliate-tag');
      });

      it('should add Shorts hashtags when not present', async () => {
        await uploadToYouTube('video.mp4', 'Title', 'Short product review', '', { isShorts: true });

        const mockYouTube = googleStub.youtube();
        const uploadCall = mockYouTube.videos.insert.getCall(0);
        const finalDescription = uploadCall.args[0].requestBody.snippet.description;
        
        expect(finalDescription).to.include('#Shorts #Short #Vertical #QuickReview');
      });

      it('should not duplicate Shorts hashtags', async () => {
        await uploadToYouTube('video.mp4', 'Title', 'Product review #Shorts', '', { isShorts: true });

        const mockYouTube = googleStub.youtube();
        const uploadCall = mockYouTube.videos.insert.getCall(0);
        const finalDescription = uploadCall.args[0].requestBody.snippet.description;
        
        const shortsCount = (finalDescription.match(/#Shorts/g) || []).length;
        expect(shortsCount).to.equal(1);
      });

      it('should use shorter affiliate content for Shorts', async () => {
        await uploadToYouTube('video.mp4', 'Title', 'Product review', 'https://amazon.com/product', { isShorts: true });

        const mockYouTube = googleStub.youtube();
        const uploadCall = mockYouTube.videos.insert.getCall(0);
        const finalDescription = uploadCall.args[0].requestBody.snippet.description;
        
        expect(finalDescription).to.include('🛒 https://amazon.com/product?tag=test-affiliate-tag');
        expect(finalDescription).to.include('⚠️ As an Amazon Associate, I earn from qualifying purchases.');
        expect(finalDescription).not.to.include('This helps support the channel at no extra cost to you!');
      });
    });
  });
});
  describe('uploadToYouTubeShorts', () => {
    let googleStub;
    let fsStub;
    let processStub;

    beforeEach(() => {
      // Mock Google APIs
      const mockYouTube = {
        videos: {
          insert: sinon.stub()
        },
        thumbnails: {
          set: sinon.stub().resolves({ status: 200 })
        }
      };

      googleStub = {
        youtube: sinon.stub().returns(mockYouTube),
        auth: {
          OAuth2: sinon.stub()
        }
      };

      // Mock fs module
      fsStub = sinon.stub(fs, 'stat');
      fsStub.resolves({ size: 10485760 }); // 10MB file

      // Mock environment variables
      processStub = sinon.stub(process, 'env').value({
        YOUTUBE_CLIENT_ID: 'test-client-id',
        YOUTUBE_CLIENT_SECRET: 'test-client-secret',
        YOUTUBE_OAUTH2_ACCESS_TOKEN: 'test-access-token',
        AFFILIATE_TAG: 'test-affiliate-tag'
      });

      // Mock successful upload response
      mockYouTube.videos.insert.resolves({
        data: {
          id: 'test-shorts-id',
          snippet: {
            title: 'Test Shorts Video #Shorts',
            description: 'Test Description'
          },
          status: {
            uploadStatus: 'uploaded',
            privacyStatus: 'public'
          }
        }
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should optimize title and description for Shorts and return Shorts URL', async () => {
      const mockYouTube = googleStub.youtube();
      mockYouTube.videos.insert.resolves({
        data: {
          id: 'shorts123',
          snippet: {
            title: 'Test Video #Shorts',
            description: 'Short description\n\n#Shorts #Short #Vertical #QuickReview'
          },
          status: {
            uploadStatus: 'uploaded',
            privacyStatus: 'public'
          }
        }
      });

      const result = await uploadToYouTubeShorts(
        '/path/to/short-video.mp4',
        'Test Video',
        'Short description'
      );

      expect(result).to.have.property('videoId', 'shorts123');
      expect(result).to.have.property('url', 'https://youtube.com/shorts/shorts123');
      expect(result).to.have.property('regularUrl', 'https://youtu.be/shorts123');
      expect(result).to.have.property('isShorts', true);
      expect(result.title).to.include('#Shorts');
      expect(result.description).to.include('#Shorts');
    });

    it('should handle long titles by truncating for Shorts', async () => {
      const longTitle = 'This is a very long title that exceeds the recommended length for YouTube Shorts videos';
      
      const mockYouTube = googleStub.youtube();
      mockYouTube.videos.insert.resolves({
        data: {
          id: 'shorts456',
          snippet: {
            title: 'This is a very long title that exceeds the r... #Shorts',
            description: 'Test description'
          },
          status: {
            uploadStatus: 'uploaded',
            privacyStatus: 'public'
          }
        }
      });

      const result = await uploadToYouTubeShorts(
        '/path/to/short-video.mp4',
        longTitle,
        'Test description'
      );

      expect(result.title).to.have.length.at.most(60);
      expect(result.title).to.include('#Shorts');
      expect(result.url).to.include('youtube.com/shorts/');
    });

    it('should use Entertainment category for better Shorts performance', async () => {
      const mockYouTube = googleStub.youtube();
      mockYouTube.videos.insert.resolves({
        data: {
          id: 'shorts789',
          snippet: {
            title: 'Test Video #Shorts',
            description: 'Test description',
            categoryId: '24'
          },
          status: {
            uploadStatus: 'uploaded',
            privacyStatus: 'public'
          }
        }
      });

      await uploadToYouTubeShorts(
        '/path/to/short-video.mp4',
        'Test Video',
        'Test description'
      );

      // Verify that the upload was called with Entertainment category (24)
      const uploadCall = mockYouTube.videos.insert.getCall(0);
      expect(uploadCall.args[0].requestBody.snippet.categoryId).to.equal('24');
    });
  });
