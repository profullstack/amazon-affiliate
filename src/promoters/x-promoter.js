import { BasePromoter } from './base-promoter.js';
import { XLoginAutomation } from './x-login-automation.js';

/**
 * X.com (formerly Twitter) promoter for automated posting
 * Updated for the new X.com platform
 */
export class XPromoter extends BasePromoter {
  constructor(config = {}) {
    super(config);
    this.name = 'x';
    this.recentPosts = [];
    this.maxPostsPerHour = 5; // Rate limiting
  }

  /**
   * Check rate limiting
   */
  checkRateLimit() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.recentPosts = this.recentPosts.filter(time => time > oneHourAgo);
    return this.recentPosts.length < this.maxPostsPerHour;
  }

  /**
   * Generate engaging X.com post content
   */
  generatePost(videoData) {
    const { title, url, description, tags = [] } = videoData;
    
    // Get appropriate emoji based on product category
    const emoji = this.getProductEmoji(tags);
    
    // Create hashtags (max 3 for better engagement)
    const hashtags = tags.slice(0, 3).map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');
    
    // Build post content
    let post = `${emoji} ${title}\n\n`;
    
    // Add brief description if space allows (X.com has 280 char limit)
    const remainingSpace = 280 - post.length - url.length - hashtags.length - 10; // buffer
    if (description && remainingSpace > 50) {
      const shortDesc = description.substring(0, remainingSpace - 3) + '...';
      post += `${shortDesc}\n\n`;
    }
    
    post += `${url}\n\n${hashtags}`;
    
    // Ensure we don't exceed character limit
    return post.substring(0, 280);
  }

  /**
   * Generate thread for longer content
   */
  generateThread(videoData) {
    const { title, url, description, tags = [] } = videoData;
    const emoji = this.getProductEmoji(tags);
    const hashtags = tags.slice(0, 3).map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');
    
    const tweets = [];
    
    // First tweet - hook
    tweets.push(`${emoji} ${title} 🧵\n\n${hashtags}`);
    
    // Second tweet - description
    if (description) {
      const chunks = this.splitTextIntoChunks(description, 250);
      tweets.push(...chunks.map((chunk, index) => `${index + 2}/ ${chunk}`));
    }
    
    // Final tweet - link
    tweets.push(`🔗 Watch the full review: ${url}\n\n${hashtags}`);
    
    return tweets;
  }

  /**
   * Split text into tweet-sized chunks
   */
  splitTextIntoChunks(text, maxLength) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';
    
    for (const word of words) {
      if ((currentChunk + ' ' + word).length <= maxLength) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = word;
      }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  /**
   * Get appropriate emoji based on product tags
   */
  getProductEmoji(tags = []) {
    const tagString = tags.join(' ').toLowerCase();
    
    if (tagString.includes('tech') || tagString.includes('electronic')) return '📱';
    if (tagString.includes('kitchen') || tagString.includes('cooking')) return '🍳';
    if (tagString.includes('fitness') || tagString.includes('health')) return '💪';
    if (tagString.includes('beauty') || tagString.includes('cosmetic')) return '💄';
    if (tagString.includes('home') || tagString.includes('decor')) return '🏠';
    if (tagString.includes('fashion') || tagString.includes('clothing')) return '👕';
    if (tagString.includes('book') || tagString.includes('reading')) return '📚';
    if (tagString.includes('toy') || tagString.includes('game')) return '🎮';
    if (tagString.includes('outdoor') || tagString.includes('camping')) return '🏕️';
    if (tagString.includes('car') || tagString.includes('automotive')) return '🚗';
    
    return '⭐'; // Default star emoji
  }

  /**
   * Navigate to X.com and check login status
   */
  async checkLoginStatus() {
    try {
      await this.navigateTo('https://x.com');
      await this.randomDelay(3000, 5000);

      const automation = new XLoginAutomation(this.page);
      return await automation.verifyLogin();
    } catch (error) {
      this.logger.error(`Failed to check X.com login status: ${error.message}`);
      return false;
    }
  }

  /**
   * Perform automated login
   */
  async performAutomatedLogin(credentials) {
    try {
      this.logger.info('Attempting automated X.com login...');
      const automation = new XLoginAutomation(this.page);
      return await automation.login(credentials);
    } catch (error) {
      this.logger.error(`Automated login failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Post a single tweet using automation
   */
  async postTweet(content) {
    try {
      this.logger.info('Posting tweet to X.com...');
      const automation = new XLoginAutomation(this.page);
      const result = await automation.postTweet(content);
      
      if (result.success) {
        this.recentPosts.push(Date.now());
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to post tweet to X.com: ${error.message}`);
      await this.takeScreenshot(`x-error-${Date.now()}`);
      throw error;
    }
  }

  /**
   * Post a thread of tweets
   */
  async postThread(tweets) {
    try {
      this.logger.info(`Posting thread of ${tweets.length} tweets to X.com...`);
      const results = [];

      for (let i = 0; i < tweets.length; i++) {
        const tweet = tweets[i];
        this.logger.info(`Posting tweet ${i + 1}/${tweets.length}`);

        if (i === 0) {
          // First tweet
          const result = await this.postTweet(tweet);
          results.push(result);
        } else {
          // Reply to previous tweet
          // This would require more complex logic to find and reply to the previous tweet
          // For now, we'll post as separate tweets with a delay
          await this.randomDelay(30000, 60000); // Wait 30-60 seconds between tweets
          const result = await this.postTweet(tweet);
          results.push(result);
        }
      }

      return {
        success: true,
        tweets: results,
        threadUrl: results[0]?.postUrl
      };

    } catch (error) {
      this.logger.error(`Failed to post thread to X.com: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main promotion method
   */
  async promote(videoData) {
    try {
      this.logger.info('Starting X.com promotion');

      // Check rate limiting
      if (!this.checkRateLimit()) {
        throw new Error('X.com rate limit exceeded. Please wait before posting more tweets.');
      }

      // Initialize browser and check login
      await this.init();
      const isLoggedIn = await this.checkLoginStatus();

      if (!isLoggedIn) {
        await this.promptUserLogin('X.com');
        // Wait for user to log in
        await this.randomDelay(10000, 15000);
      }

      let result;

      // Decide whether to post a single tweet or thread based on content length
      const singlePost = this.generatePost(videoData);
      if (singlePost.length <= 280 && videoData.description?.length < 200) {
        // Post single tweet
        result = await this.postTweet(singlePost);
        result.type = 'tweet';
      } else {
        // Post thread
        const thread = this.generateThread(videoData);
        result = await this.postThread(thread);
        result.type = 'thread';
      }

      return {
        success: result.success,
        platform: 'x',
        type: result.type,
        postUrl: result.postUrl || result.threadUrl,
        content: result.type === 'tweet' ? singlePost : thread
      };

    } catch (error) {
      this.logger.error(`X.com promotion failed: ${error.message}`);
      await this.takeScreenshot(`x-error-${Date.now()}`);

      return {
        success: false,
        platform: 'x',
        error: error.message
      };
    } finally {
      await this.cleanup();
    }
  }
}