import { expect } from 'chai';
import { RedditPromoter } from '../src/promoters/reddit-promoter.js';

describe('RedditPromoter', () => {
  let redditPromoter;
  
  beforeEach(() => {
    redditPromoter = new RedditPromoter({
      headless: true,
      timeout: 10000
    });
  });

  describe('initialization', () => {
    it('should create a new RedditPromoter instance', () => {
      expect(redditPromoter).to.be.instanceOf(RedditPromoter);
    });

    it('should have correct platform name', () => {
      expect(redditPromoter.name).to.equal('reddit');
    });

    it('should initialize with default configuration', () => {
      expect(redditPromoter.config.headless).to.be.true;
      expect(redditPromoter.config.timeout).to.equal(10000);
    });
  });

  describe('getRelevantSubreddits', () => {
    it('should return relevant subreddits for product categories', () => {
      const kitchenSubreddits = redditPromoter.getRelevantSubreddits(['kitchen', 'cooking']);
      expect(kitchenSubreddits).to.include('r/Kitchen');
      expect(kitchenSubreddits).to.include('r/Cooking');
      expect(kitchenSubreddits).to.include('r/BuyItForLife');
    });

    it('should return general subreddits for unknown categories', () => {
      const generalSubreddits = redditPromoter.getRelevantSubreddits(['unknown']);
      expect(generalSubreddits).to.include('r/ProductReviews');
      expect(generalSubreddits).to.include('r/BuyItForLife');
    });

    it('should handle empty categories array', () => {
      const defaultSubreddits = redditPromoter.getRelevantSubreddits([]);
      expect(defaultSubreddits).to.be.an('array');
      expect(defaultSubreddits.length).to.be.greaterThan(0);
    });
  });

  describe('generatePostTitle', () => {
    it('should generate engaging post title from video title', () => {
      const videoTitle = 'Amazing Kitchen Gadget - Honest Review';
      const postTitle = redditPromoter.generatePostTitle(videoTitle);
      
      expect(postTitle).to.be.a('string');
      expect(postTitle.length).to.be.lessThan(300);
      expect(postTitle).to.include('Review');
    });

    it('should handle long video titles', () => {
      const longTitle = 'This is a very long product title that goes on and on and should be truncated properly - Honest Review';
      const postTitle = redditPromoter.generatePostTitle(longTitle);
      
      expect(postTitle.length).to.be.lessThan(300);
    });
  });

  describe('generatePostContent', () => {
    it('should generate post content with video link', () => {
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test123',
        description: 'This is a test product review'
      };
      
      const content = redditPromoter.generatePostContent(videoData);
      
      expect(content).to.include(videoData.url);
      expect(content).to.include('review');
      expect(content).to.be.a('string');
    });

    it('should include disclaimer about affiliate links', () => {
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test123'
      };
      
      const content = redditPromoter.generatePostContent(videoData);
      expect(content.toLowerCase()).to.include('affiliate');
    });
  });

  describe('validateSubreddit', () => {
    it('should validate correct subreddit format', () => {
      expect(redditPromoter.validateSubreddit('r/ProductReviews')).to.be.true;
      expect(redditPromoter.validateSubreddit('r/BuyItForLife')).to.be.true;
    });

    it('should reject invalid subreddit formats', () => {
      expect(redditPromoter.validateSubreddit('ProductReviews')).to.be.false;
      expect(redditPromoter.validateSubreddit('r/')).to.be.false;
      expect(redditPromoter.validateSubreddit('')).to.be.false;
    });
  });

  describe('checkRateLimit', () => {
    it('should track posting frequency', () => {
      const canPost = redditPromoter.checkRateLimit('r/test');
      expect(canPost).to.be.true;
    });

    it('should enforce rate limiting', () => {
      // Simulate recent post
      redditPromoter.lastPostTimes.set('r/test', Date.now());
      const canPost = redditPromoter.checkRateLimit('r/test');
      expect(canPost).to.be.false;
    });
  });

  describe('promote', () => {
    it('should return success result for valid video data', async () => {
      // Mock the actual posting for testing
      redditPromoter.postToSubreddit = async () => ({ success: true, postUrl: 'https://reddit.com/test' });
      
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test123',
        tags: ['kitchen', 'gadget']
      };
      
      const result = await redditPromoter.promote(videoData);
      
      expect(result.success).to.be.true;
      expect(result.platform).to.equal('reddit');
      expect(result.posts).to.be.an('array');
    });

    it('should handle missing video data gracefully', async () => {
      const result = await redditPromoter.promote({});
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid video data');
    });
  });
});