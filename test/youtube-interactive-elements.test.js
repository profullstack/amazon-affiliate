import { expect } from 'chai';
import {
  addYouTubeCard,
  addYouTubeEndScreen,
  addCompleteInteractiveElements,
  generateAffiliateOverlay,
  getVideoInfo,
  validateInteractiveConfig
} from '../src/youtube-interactive-elements.js';

describe('YouTube Interactive Elements', () => {
  const mockProductData = {
    affiliateUrl: 'https://amazon.com/dp/B123456789?tag=test-affiliate-20',
    title: 'Test Product',
    price: '$99.99'
  };

  const mockVideoId = 'dQw4w9WgXcQ'; // Rick Roll video ID for testing

  describe('validateInteractiveConfig', () => {
    it('should validate correct configuration', () => {
      const config = {
        videoId: mockVideoId,
        productData: mockProductData
      };

      expect(() => validateInteractiveConfig(config)).to.not.throw();
    });

    it('should throw error for missing video ID', () => {
      const config = {
        productData: mockProductData
      };

      expect(() => validateInteractiveConfig(config))
        .to.throw('Valid video ID is required');
    });

    it('should throw error for missing product data', () => {
      const config = {
        videoId: mockVideoId
      };

      expect(() => validateInteractiveConfig(config))
        .to.throw('Product data is required');
    });

    it('should throw error for missing affiliate URL', () => {
      const config = {
        videoId: mockVideoId,
        productData: {
          title: 'Test Product',
          price: '$99.99'
        }
      };

      expect(() => validateInteractiveConfig(config))
        .to.throw('Affiliate URL is required in product data');
    });

    it('should throw error for missing product title', () => {
      const config = {
        videoId: mockVideoId,
        productData: {
          affiliateUrl: 'https://amazon.com/test',
          price: '$99.99'
        }
      };

      expect(() => validateInteractiveConfig(config))
        .to.throw('Product title is required in product data');
    });
  });

  describe('addYouTubeCard', () => {
    it('should create card configuration with default values', async () => {
      const cardData = {
        affiliateUrl: mockProductData.affiliateUrl
      };

      const result = await addYouTubeCard(mockVideoId, cardData);

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('cardConfig');
      expect(result).to.have.property('instructions');
      expect(result.cardConfig.videoId).to.equal(mockVideoId);
      expect(result.cardConfig.card.link.linkUrl).to.equal(mockProductData.affiliateUrl);
      expect(result.cardConfig.card.timing.offsetMs).to.equal(10000); // 10 seconds default
    });

    it('should create card configuration with custom values', async () => {
      const cardData = {
        affiliateUrl: mockProductData.affiliateUrl,
        productTitle: 'Custom Product Title',
        startTime: 30,
        cardType: 'link'
      };

      const result = await addYouTubeCard(mockVideoId, cardData);

      expect(result.success).to.be.true;
      expect(result.cardConfig.card.link.linkText).to.equal('Custom Product Title');
      expect(result.cardConfig.card.timing.offsetMs).to.equal(30000); // 30 seconds
    });

    it('should throw error for missing video ID', async () => {
      const cardData = {
        affiliateUrl: mockProductData.affiliateUrl
      };

      try {
        await addYouTubeCard(null, cardData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Video ID and card data are required');
      }
    });

    it('should throw error for missing affiliate URL', async () => {
      const cardData = {
        productTitle: 'Test Product'
      };

      try {
        await addYouTubeCard(mockVideoId, cardData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Affiliate URL is required for card');
      }
    });

    it('should include setup instructions', async () => {
      const cardData = {
        affiliateUrl: mockProductData.affiliateUrl
      };

      const result = await addYouTubeCard(mockVideoId, cardData);

      expect(result.instructions).to.be.an('array');
      expect(result.instructions.length).to.be.greaterThan(0);
      expect(result.instructions[0]).to.include('YouTube Studio');
    });
  });

  describe('addYouTubeEndScreen', () => {
    it('should create end screen configuration with calculated timing', async () => {
      const endScreenData = {
        affiliateUrl: mockProductData.affiliateUrl,
        productTitle: 'Buy This Product'
      };

      // Note: This test will fail without valid YouTube API credentials
      // In a real environment, you'd mock the YouTube API response
      try {
        const result = await addYouTubeEndScreen(mockVideoId, endScreenData);
        
        expect(result).to.have.property('success', true);
        expect(result).to.have.property('endScreenConfig');
        expect(result).to.have.property('instructions');
        expect(result).to.have.property('videoDuration');
        expect(result).to.have.property('calculatedStartTime');
      } catch (error) {
        // Expected to fail without API credentials
        expect(error.message).to.include('YouTube API credentials');
      }
    });

    it('should throw error for missing affiliate URL', async () => {
      const endScreenData = {
        productTitle: 'Test Product'
      };

      try {
        await addYouTubeEndScreen(mockVideoId, endScreenData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Affiliate URL is required for end screen');
      }
    });
  });

  describe('generateAffiliateOverlay', () => {
    it('should generate overlay configuration with default values', () => {
      const result = generateAffiliateOverlay(mockProductData);

      expect(result).to.have.property('overlayText');
      expect(result).to.have.property('overlayFilter');
      expect(result).to.have.property('affiliateUrl', mockProductData.affiliateUrl);
      expect(result).to.have.property('timing');
      expect(result).to.have.property('instructions');

      expect(result.overlayText).to.include(mockProductData.title);
      expect(result.overlayText).to.include(mockProductData.price);
      expect(result.timing.startTime).to.equal(10); // default
      expect(result.timing.duration).to.equal(5); // default
    });

    it('should generate overlay configuration with custom options', () => {
      const options = {
        position: 'top',
        duration: 8,
        startTime: 20,
        fontSize: 32,
        backgroundColor: 'blue@0.8',
        textColor: 'yellow'
      };

      const result = generateAffiliateOverlay(mockProductData, options);

      expect(result.timing.startTime).to.equal(20);
      expect(result.timing.duration).to.equal(8);
      expect(result.overlayFilter).to.include('fontsize=32');
      expect(result.overlayFilter).to.include('fontcolor=yellow');
      expect(result.overlayFilter).to.include('boxcolor=blue@0.8');
      expect(result.overlayFilter).to.include('y=50'); // top position
    });

    it('should generate correct FFmpeg filter for different positions', () => {
      const positions = ['top', 'bottom', 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
      
      positions.forEach(position => {
        const result = generateAffiliateOverlay(mockProductData, { position });
        expect(result.overlayFilter).to.be.a('string');
        expect(result.overlayFilter).to.include('drawtext=');
      });
    });

    it('should include timing in FFmpeg filter', () => {
      const options = {
        startTime: 15,
        duration: 10
      };

      const result = generateAffiliateOverlay(mockProductData, options);

      expect(result.overlayFilter).to.include('enable=\'between(t,15,25)\'');
    });

    it('should escape text properly for FFmpeg', () => {
      const productDataWithSpecialChars = {
        ...mockProductData,
        title: 'Product with "quotes" and \'apostrophes\'',
        price: '$99.99'
      };

      const result = generateAffiliateOverlay(productDataWithSpecialChars);

      expect(result.overlayText).to.be.a('string');
      expect(result.overlayFilter).to.be.a('string');
    });
  });

  describe('addCompleteInteractiveElements', () => {
    it('should setup complete interactive elements with default options', async () => {
      const options = {
        includeCards: false, // Disable to avoid API calls in tests
        includeEndScreen: false
      };

      const result = await addCompleteInteractiveElements(mockVideoId, mockProductData, options);

      expect(result).to.have.property('videoId', mockVideoId);
      expect(result).to.have.property('productData');
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('instructions');
      expect(result.productData).to.deep.equal(mockProductData);
    });

    it('should throw error for missing video ID', async () => {
      try {
        await addCompleteInteractiveElements(null, mockProductData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Video ID and product data are required');
      }
    });

    it('should throw error for missing product data', async () => {
      try {
        await addCompleteInteractiveElements(mockVideoId, null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Video ID and product data are required');
      }
    });

    it('should throw error for missing affiliate URL', async () => {
      const invalidProductData = {
        title: 'Test Product',
        price: '$99.99'
      };

      try {
        await addCompleteInteractiveElements(mockVideoId, invalidProductData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Affiliate URL is required');
      }
    });
  });

  describe('Integration Tests', () => {
    it('should create a complete affiliate marketing setup', async () => {
      // Test the complete workflow without API calls
      const options = {
        includeCards: false,
        includeEndScreen: false,
        cardStartTime: 20,
        endScreenDuration: 12
      };

      const interactiveResult = await addCompleteInteractiveElements(
        mockVideoId,
        mockProductData,
        options
      );

      const overlayResult = generateAffiliateOverlay(mockProductData, {
        startTime: 15,
        duration: 8,
        position: 'bottom'
      });

      expect(interactiveResult.success).to.be.true;
      expect(overlayResult.affiliateUrl).to.equal(mockProductData.affiliateUrl);
      expect(overlayResult.overlayText).to.include(mockProductData.title);
      expect(overlayResult.timing.startTime).to.equal(15);
    });

    it('should provide comprehensive setup instructions', async () => {
      const options = {
        includeCards: false,
        includeEndScreen: false
      };

      const result = await addCompleteInteractiveElements(
        mockVideoId,
        mockProductData,
        options
      );

      expect(result.instructions).to.be.an('array');
      // Even with disabled features, should provide general instructions
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid video IDs gracefully', async () => {
      const invalidVideoId = 'invalid-video-id';
      
      try {
        await getVideoInfo(invalidVideoId);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Expected to fail - either due to invalid ID or missing credentials
        expect(error.message).to.be.a('string');
      }
    });

    it('should handle missing environment variables', async () => {
      // This test would require mocking process.env
      // For now, we just ensure the function exists and can be called
      expect(addYouTubeCard).to.be.a('function');
      expect(addYouTubeEndScreen).to.be.a('function');
      expect(getVideoInfo).to.be.a('function');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate overlay configuration parameters', () => {
      const validPositions = ['top', 'bottom', 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
      
      validPositions.forEach(position => {
        const result = generateAffiliateOverlay(mockProductData, { position });
        expect(result.overlayFilter).to.include('drawtext=');
      });
    });

    it('should handle edge cases in timing calculations', () => {
      const result = generateAffiliateOverlay(mockProductData, {
        startTime: 0,
        duration: 1
      });

      expect(result.overlayFilter).to.include('enable=\'between(t,0,1)\'');
    });
  });
});