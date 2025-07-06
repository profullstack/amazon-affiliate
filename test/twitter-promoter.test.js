import { expect } from 'chai';
import { TwitterPromoter } from '../src/promoters/twitter-promoter.js';

describe('TwitterPromoter', () => {
  let twitterPromoter;
  
  beforeEach(() => {
    twitterPromoter = new TwitterPromoter({
      headless: true,
      timeout: 10000
    });
  });

  describe('initialization', () => {
    it('should create a new TwitterPromoter instance', () => {
      expect(twitterPromoter).to.be.instanceOf(TwitterPromoter);
    });

    it('should have correct platform name', () => {
      expect(twitterPromoter.name).to.equal('twitter');
    });

    it('should initialize with default configuration', () => {
      expect(twitterPromoter.config.headless).to.be.true;
      expect(twitterPromoter.config.timeout).to.equal(10000);
    });
  });

  describe('generateTweet', () => {
    it('should generate tweet within character limit', () => {
      const videoData = {
        title: 'Amazing Kitchen Gadget - Honest Review',
        url: 'https://youtube.com/watch?v=test123',
        tags: ['kitchen', 'gadget', 'review']
      };
      
      const tweet = twitterPromoter.generateTweet(videoData);
      
      expect(tweet).to.be.a('string');
      expect(tweet.length).to.be.lessThan(280);
      expect(tweet).to.include(videoData.url);
    });

    it('should include relevant hashtags', () => {
      const videoData = {
        title: 'Kitchen Gadget Review',
        url: 'https://youtube.com/watch?v=test123',
        tags: ['kitchen', 'gadget', 'review']
      };
      
      const tweet = twitterPromoter.generateTweet(videoData);
      
      expect(tweet).to.include('#kitchen');
      expect(tweet).to.include('#review');
    });

    it('should handle long titles gracefully', () => {
      const videoData = {
        title: 'This is an extremely long product title that would normally exceed Twitter character limits if not handled properly - Honest Review',
        url: 'https://youtube.com/watch?v=test123'
      };
      
      const tweet = twitterPromoter.generateTweet(videoData);
      
      expect(tweet.length).to.be.lessThan(280);
      expect(tweet).to.include(videoData.url);
    });
  });

  describe('generateThread', () => {
    it('should generate thread for detailed content', () => {
      const videoData = {
        title: 'Kitchen Gadget Review',
        url: 'https://youtube.com/watch?v=test123',
        description: 'This is a detailed review of an amazing kitchen gadget that will change your cooking experience forever.',
        tags: ['kitchen', 'gadget', 'review']
      };
      
      const thread = twitterPromoter.generateThread(videoData);
      
      expect(thread).to.be.an('array');
      expect(thread.length).to.be.greaterThan(1);
      expect(thread[0]).to.include('🧵 Thread');
      expect(thread[thread.length - 1]).to.include(videoData.url);
    });

    it('should keep each tweet under character limit', () => {
      const videoData = {
        title: 'Test Product',
        url: 'https://youtube.com/watch?v=test123',
        description: 'Very long description '.repeat(50)
      };
      
      const thread = twitterPromoter.generateThread(videoData);
      
      thread.forEach(tweet => {
        expect(tweet.length).to.be.lessThan(280);
      });
    });
  });

  describe('generateHashtags', () => {
    it('should generate relevant hashtags from tags', () => {
      const tags = ['kitchen', 'gadget', 'review', 'amazon'];
      const hashtags = twitterPromoter.generateHashtags(tags);
      
      expect(hashtags).to.be.an('array');
      expect(hashtags).to.include('#kitchen');
      expect(hashtags).to.include('#gadget');
      expect(hashtags).to.include('#review');
    });

    it('should limit number of hashtags for readability', () => {
      const manyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
      const hashtags = twitterPromoter.generateHashtags(manyTags);
      
      expect(hashtags.length).to.be.lessThan(6); // Keep it readable
    });

    it('should handle empty tags array', () => {
      const hashtags = twitterPromoter.generateHashtags([]);
      expect(hashtags).to.be.an('array');
      expect(hashtags.length).to.be.greaterThan(0); // Should have default hashtags
    });
  });

  describe('optimizeTweetTiming', () => {
    it('should suggest optimal posting times', () => {
      const timing = twitterPromoter.optimizeTweetTiming();
      
      expect(timing).to.be.an('object');
      expect(timing.bestHours).to.be.an('array');
      expect(timing.bestDays).to.be.an('array');
    });

    it('should consider timezone', () => {
      const timing = twitterPromoter.optimizeTweetTiming('America/New_York');
      
      expect(timing.timezone).to.equal('America/New_York');
    });
  });

  describe('checkRateLimit', () => {
    it('should track tweeting frequency', () => {
      const canTweet = twitterPromoter.checkRateLimit();
      expect(canTweet).to.be.true;
    });

    it('should enforce rate limiting', () => {
      // Simulate recent tweets
      for (let i = 0; i < 50; i++) {
        twitterPromoter.recentTweets.push(Date.now());
      }
      
      const canTweet = twitterPromoter.checkRateLimit();
      expect(canTweet).to.be.false;
    });
  });

  describe('findRelevantAccounts', () => {
    it('should return accounts to engage with based on tags', () => {
      const tags = ['kitchen', 'cooking', 'gadget'];
      const accounts = twitterPromoter.findRelevantAccounts(tags);
      
      expect(accounts).to.be.an('array');
      expect(accounts.length).to.be.greaterThan(0);
    });

    it('should handle unknown categories', () => {
      const tags = ['unknown', 'category'];
      const accounts = twitterPromoter.findRelevantAccounts(tags);
      
      expect(accounts).to.be.an('array');
    });
  });

  describe('promote', () => {
    it('should return success result for valid video data', async () => {
      // Mock the actual tweeting for testing
      twitterPromoter.postTweet = async () => ({ success: true, tweetUrl: 'https://twitter.com/test/status/123' });
      
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test123',
        tags: ['kitchen', 'gadget']
      };
      
      const result = await twitterPromoter.promote(videoData);
      
      expect(result.success).to.be.true;
      expect(result.platform).to.equal('twitter');
      expect(result.tweets).to.be.an('array');
    });

    it('should handle missing video data gracefully', async () => {
      const result = await twitterPromoter.promote({});
      
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid video data');
    });

    it('should create thread for long content', async () => {
      // Mock the actual tweeting for testing
      twitterPromoter.postThread = async () => ({ success: true, threadUrl: 'https://twitter.com/test/status/123' });
      
      const videoData = {
        title: 'Test Product Review',
        url: 'https://youtube.com/watch?v=test123',
        description: 'Very long description '.repeat(20),
        tags: ['kitchen', 'gadget']
      };
      
      const result = await twitterPromoter.promote(videoData);
      
      expect(result.success).to.be.true;
      expect(result.type).to.equal('thread');
    });
  });
});