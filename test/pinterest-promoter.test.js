import { expect } from 'chai';
import { PinterestPromoter } from '../src/promoters/pinterest-promoter.js';

describe('PinterestPromoter', () => {
  let pinterestPromoter;
  
  beforeEach(() => {
    pinterestPromoter = new PinterestPromoter({
      headless: true,
      timeout: 10000
    });
  });

  describe('initialization', () => {
    it('should create a new PinterestPromoter instance', () => {
      expect(pinterestPromoter).to.be.instanceOf(PinterestPromoter);
    });

    it('should have correct platform name', () => {
      expect(pinterestPromoter.name).to.equal('pinterest');
    });

    it('should initialize with default configuration', () => {
      expect(pinterestPromoter.config.headless).to.be.true;
      expect(pinterestPromoter.config.timeout).to.equal(10000);
    });
  });

  describe('generatePinTitle', () => {
    it('should generate SEO-optimized pin title', () => {
      const videoTitle = 'Amazing Kitchen Gadget - Honest Review';
      const pinTitle = pinterestPromoter.generatePinTitle(videoTitle);
      
      expect(pinTitle).to.be.a('string');
      expect(pinTitle.length).to.be.lessThan(100);
      expect(pinTitle).to.include('Review');
    });

    it('should handle long video titles', () => {
      const longTitle = 'This is a very long product title that should be truncated for Pinterest - Honest Review';
      const pinTitle = pinterestPromoter.generatePinTitle(longTitle);
      
      expect(pinTitle.length).to.be.lessThan(100);
    });
  });

  describe('generatePinDescription', () => {
    it('should generate pin description with keywords and link', () => {
      const videoData = {
        title: 'Kitchen Gadget Review',
        url: 'https://youtube.com/watch?v=test123',
        tags: ['kitchen', 'gadget', 'review']
      };
      
      const description = pinterestPromoter.generatePinDescription(videoData);
      
      expect(description).to.include(videoData.url);
      expect(description).to.include('#kitchen');
      expect(description).to.include('#gadget');
      expect(description).to.be.a('string');
    });

    it('should include call-to-action', () => {
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test123'
      };
      
      const description = pinterestPromoter.generatePinDescription(videoData);
      expect(description.toLowerCase()).to.include('watch');
    });
  });

  describe('getRelevantBoards', () => {
    it('should return relevant boards for product categories', () => {
      const kitchenBoards = pinterestPromoter.getRelevantBoards(['kitchen', 'cooking']);
      expect(kitchenBoards).to.include('Kitchen Gadgets');
      expect(kitchenBoards).to.include('Product Reviews');
    });

    it('should return general boards for unknown categories', () => {
      const generalBoards = pinterestPromoter.getRelevantBoards(['unknown']);
      expect(generalBoards).to.include('Product Reviews');
      expect(generalBoards).to.include('Shopping');
    });

    it('should handle empty categories array', () => {
      const defaultBoards = pinterestPromoter.getRelevantBoards([]);
      expect(defaultBoards).to.be.an('array');
      expect(defaultBoards.length).to.be.greaterThan(0);
    });
  });

  describe('optimizeImageForPin', () => {
    it('should return optimization settings for pin image', () => {
      const settings = pinterestPromoter.optimizeImageForPin();
      
      expect(settings).to.be.an('object');
      expect(settings.width).to.equal(1000);
      expect(settings.height).to.equal(1500);
      expect(settings.quality).to.equal(90);
    });
  });

  describe('generateHashtags', () => {
    it('should generate relevant hashtags from tags', () => {
      const tags = ['kitchen', 'gadget', 'review', 'amazon'];
      const hashtags = pinterestPromoter.generateHashtags(tags);
      
      expect(hashtags).to.be.an('array');
      expect(hashtags).to.include('#kitchen');
      expect(hashtags).to.include('#gadget');
      expect(hashtags).to.include('#review');
    });

    it('should limit number of hashtags', () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);
      const hashtags = pinterestPromoter.generateHashtags(manyTags);
      
      expect(hashtags.length).to.be.lessThan(21); // Pinterest limit is 20
    });

    it('should handle empty tags array', () => {
      const hashtags = pinterestPromoter.generateHashtags([]);
      expect(hashtags).to.be.an('array');
      expect(hashtags.length).to.be.greaterThan(0); // Should have default hashtags
    });
  });

  describe('checkRateLimit', () => {
    it('should track pinning frequency', () => {
      const canPin = pinterestPromoter.checkRateLimit();
      expect(canPin).to.be.true;
    });

    it('should enforce rate limiting', () => {
      // Simulate recent pins
      for (let i = 0; i < 10; i++) {
        pinterestPromoter.recentPins.push(Date.now());
      }
      
      const canPin = pinterestPromoter.checkRateLimit();
      expect(canPin).to.be.false;
    });
  });

  describe('promote', () => {
    it('should return success result for valid video data', async () => {
      // Mock the actual pinning for testing
      pinterestPromoter.createPin = async () => ({ success: true, pinUrl: 'https://pinterest.com/pin/test' });
      
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test123',
        thumbnailPath: '/path/to/thumbnail.jpg',
        tags: ['kitchen', 'gadget']
      };
      
      const result = await pinterestPromoter.promote(videoData);
      
      expect(result.success).to.be.true;
      expect(result.platform).to.equal('pinterest');
      expect(result.pins).to.be.an('array');
    });

    it('should handle missing thumbnail gracefully', async () => {
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test123'
        // No thumbnailPath
      };
      
      const result = await pinterestPromoter.promote(videoData);
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('thumbnail');
    });

    it('should handle missing video data gracefully', async () => {
      const result = await pinterestPromoter.promote({});
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid video data');
    });
  });
});