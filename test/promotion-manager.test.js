import { expect } from 'chai';
import { PromotionManager } from '../src/promotion-manager.js';
import { RedditPromoter } from '../src/promoters/reddit-promoter.js';
import { PinterestPromoter } from '../src/promoters/pinterest-promoter.js';
import { TwitterPromoter } from '../src/promoters/twitter-promoter.js';

describe('PromotionManager', () => {
  let promotionManager;
  
  beforeEach(() => {
    promotionManager = new PromotionManager();
  });

  describe('initialization', () => {
    it('should create a new PromotionManager instance', () => {
      expect(promotionManager).to.be.instanceOf(PromotionManager);
    });

    it('should initialize with empty promoters array', () => {
      expect(promotionManager.promoters).to.be.an('array');
      expect(promotionManager.promoters).to.have.length(0);
    });

    it('should have default configuration', () => {
      expect(promotionManager.config).to.be.an('object');
      expect(promotionManager.config.headless).to.be.true;
      expect(promotionManager.config.timeout).to.equal(30000);
    });
  });

  describe('addPromoter', () => {
    it('should add a promoter to the promoters array', () => {
      const redditPromoter = new RedditPromoter();
      promotionManager.addPromoter(redditPromoter);
      
      expect(promotionManager.promoters).to.have.length(1);
      expect(promotionManager.promoters[0]).to.equal(redditPromoter);
    });

    it('should throw error when adding invalid promoter', () => {
      expect(() => {
        promotionManager.addPromoter({});
      }).to.throw('Invalid promoter: must have promote method');
    });
  });

  describe('promoteVideo', () => {
    it('should promote video across all registered promoters', async () => {
      const mockPromoter = {
        name: 'mock',
        promote: async () => ({ success: true, platform: 'mock' })
      };
      
      promotionManager.addPromoter(mockPromoter);
      
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test',
        description: 'Test description',
        tags: ['test', 'review']
      };
      
      const results = await promotionManager.promoteVideo(videoData);
      
      expect(results).to.be.an('array');
      expect(results).to.have.length(1);
      expect(results[0].success).to.be.true;
      expect(results[0].platform).to.equal('mock');
    });

    it('should handle promoter failures gracefully', async () => {
      const failingPromoter = {
        name: 'failing',
        promote: async () => {
          throw new Error('Promotion failed');
        }
      };
      
      promotionManager.addPromoter(failingPromoter);
      
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test'
      };
      
      const results = await promotionManager.promoteVideo(videoData);
      
      expect(results).to.have.length(1);
      expect(results[0].success).to.be.false;
      expect(results[0].error).to.include('Promotion failed');
    });
  });

  describe('getPromotionStats', () => {
    it('should return promotion statistics', () => {
      const stats = promotionManager.getPromotionStats();
      
      expect(stats).to.be.an('object');
      expect(stats.totalPromotions).to.equal(0);
      expect(stats.successfulPromotions).to.equal(0);
      expect(stats.failedPromotions).to.equal(0);
    });
  });
});