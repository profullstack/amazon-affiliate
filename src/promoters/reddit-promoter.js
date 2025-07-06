import { BasePromoter } from './base-promoter.js';

/**
 * Reddit promoter for automated posting to relevant subreddits
 */
export class RedditPromoter extends BasePromoter {
  constructor(config = {}) {
    super(config);
    this.name = 'reddit';
    this.lastPostTimes = new Map();
    this.minPostInterval = 24 * 60 * 60 * 1000; // 24 hours between posts to same subreddit
    
    // Subreddit mapping by category
    this.subredditMap = {
      kitchen: ['r/Kitchen', 'r/Cooking', 'r/KitchenGadgets', 'r/BuyItForLife', 'r/ProductReviews'],
      tech: ['r/gadgets', 'r/technology', 'r/ProductReviews', 'r/BuyItForLife', 'r/shutupandtakemymoney'],
      home: ['r/HomeImprovement', 'r/organization', 'r/BuyItForLife', 'r/ProductReviews'],
      fitness: ['r/fitness', 'r/homegym', 'r/BuyItForLife', 'r/ProductReviews'],
      beauty: ['r/SkincareAddiction', 'r/MakeupAddiction', 'r/ProductReviews'],
      automotive: ['r/cars', 'r/AutoDetailing', 'r/BuyItForLife', 'r/ProductReviews'],
      outdoor: ['r/camping', 'r/hiking', 'r/BuyItForLife', 'r/ProductReviews'],
      pet: ['r/dogs', 'r/cats', 'r/pets', 'r/ProductReviews'],
      baby: ['r/Parenting', 'r/BabyBumps', 'r/ProductReviews'],
      general: ['r/ProductReviews', 'r/BuyItForLife', 'r/shutupandtakemymoney', 'r/videos']
    };
  }

  /**
   * Get relevant subreddits based on product categories
   */
  getRelevantSubreddits(tags = []) {
    const category = this.extractProductCategory(tags);
    const subreddits = this.subredditMap[category] || this.subredditMap.general;
    
    // Add some general subreddits for broader reach
    const generalSubs = ['r/ProductReviews', 'r/BuyItForLife'];
    const allSubs = [...new Set([...subreddits, ...generalSubs])];
    
    return allSubs.slice(0, 3); // Limit to 3 subreddits to avoid spam
  }

  /**
   * Generate engaging post title from video title
   */
  generatePostTitle(videoTitle) {
    // Clean up the title and make it more Reddit-friendly
    let title = videoTitle
      .replace(/- Honest Review$/, '')
      .replace(/Review$/, '')
      .trim();
    
    // Add engaging prefixes
    const prefixes = [
      'Just reviewed this',
      'Honest thoughts on',
      'My experience with',
      'Is this worth it?',
      'Tested this for you:'
    ];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const finalTitle = `${prefix} ${title} - What do you think?`;
    
    // Ensure title is under Reddit's limit
    return finalTitle.length > 300 ? finalTitle.substring(0, 297) + '...' : finalTitle;
  }

  /**
   * Generate post content with video link
   */
  generatePostContent(videoData) {
    const { title, url, description } = videoData;
    
    let content = `I recently got my hands on the ${title.replace(/- Honest Review$/, '').trim()} and decided to share my thoughts.\n\n`;
    
    // Add key points if description is available
    if (description) {
      const keyPoints = this.extractKeyPoints(description);
      if (keyPoints.length > 0) {
        content += 'Key things I noticed:\n';
        keyPoints.forEach(point => {
          content += `• ${point}\n`;
        });
        content += '\n';
      }
    }
    
    content += `Check out my full review here: ${url}\n\n`;
    content += 'What are your thoughts? Have you tried this product?\n\n';
    content += '*Disclosure: This post contains affiliate links. I may earn a small commission if you purchase through these links, at no extra cost to you.*';
    
    return content;
  }

  /**
   * Extract key points from description
   */
  extractKeyPoints(description) {
    if (!description) return [];
    
    // Look for bullet points or numbered lists
    const bulletPoints = description.match(/[•·\-\*]\s*([^\n•·\-\*]{10,100})/g);
    if (bulletPoints) {
      return bulletPoints
        .map(point => point.replace(/^[•·\-\*]\s*/, '').trim())
        .slice(0, 3);
    }
    
    // Extract sentences that might be key features
    const sentences = description.split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 100)
      .slice(0, 3);
    
    return sentences;
  }

  /**
   * Validate subreddit format
   */
  validateSubreddit(subreddit) {
    return /^r\/[a-zA-Z0-9_]+$/.test(subreddit);
  }

  /**
   * Check if we can post to a subreddit (rate limiting)
   */
  checkRateLimit(subreddit) {
    const lastPost = this.lastPostTimes.get(subreddit);
    if (!lastPost) return true;
    
    const timeSinceLastPost = Date.now() - lastPost;
    return timeSinceLastPost >= this.minPostInterval;
  }

  /**
   * Verify Reddit login
   */
  async verifyLogin() {
    try {
      // Check for user menu or profile link
      const loginIndicators = [
        '[data-testid="user-menu-button"]',
        '.header-user-dropdown',
        '[data-click-id="profile"]'
      ];
      
      for (const selector of loginIndicators) {
        if (await this.waitForElement(selector, 3000)) {
          this.isLoggedIn = true;
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Login verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Navigate to subreddit
   */
  async navigateToSubreddit(subreddit) {
    const url = `https://www.reddit.com/${subreddit}/submit`;
    await this.navigateTo(url);
    
    // Wait for submit form to load
    return await this.waitForElement('[data-testid="submit-page"]', 10000);
  }

  /**
   * Post to a specific subreddit
   */
  async postToSubreddit(subreddit, title, content) {
    try {
      this.logger.info(`Posting to ${subreddit}: ${title}`);
      
      // Navigate to subreddit submit page
      if (!await this.navigateToSubreddit(subreddit)) {
        throw new Error(`Failed to load submit page for ${subreddit}`);
      }
      
      // Select "Text" post type
      const textPostButton = '[data-testid="text-post-button"]';
      if (await this.waitForElement(textPostButton, 5000)) {
        await this.clickElement(textPostButton);
      }
      
      // Fill in title
      const titleInput = '[data-testid="title-field"]';
      await this.typeText(titleInput, title, { clear: true });
      
      // Fill in content
      const contentInput = '[data-testid="text-field"]';
      await this.typeText(contentInput, content, { clear: true });
      
      // Add flair if available (optional)
      await this.addFlairIfAvailable();
      
      // Submit post
      const submitButton = '[data-testid="submit-button"]';
      await this.clickElement(submitButton);
      
      // Wait for success or error
      await this.randomDelay(3000, 5000);
      
      // Check if post was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('/comments/')) {
        // Success - we're on the post page
        this.lastPostTimes.set(subreddit, Date.now());
        this.logger.info(`Successfully posted to ${subreddit}`);
        return { success: true, postUrl: currentUrl };
      } else {
        // Check for error messages
        const errorElement = await this.page.$('[data-testid="error-message"]');
        const errorText = errorElement ? await errorElement.textContent() : 'Unknown error';
        throw new Error(`Post failed: ${errorText}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to post to ${subreddit}: ${error.message}`);
      await this.takeScreenshot(`reddit-error-${subreddit}`);
      throw error;
    }
  }

  /**
   * Add flair to post if available
   */
  async addFlairIfAvailable() {
    try {
      const flairButton = '[data-testid="flair-button"]';
      if (await this.waitForElement(flairButton, 3000)) {
        await this.clickElement(flairButton);
        
        // Look for relevant flairs
        const relevantFlairs = ['Review', 'Product', 'Discussion', 'Question'];
        
        for (const flairText of relevantFlairs) {
          const flairOption = `[title*="${flairText}"]`;
          if (await this.waitForElement(flairOption, 2000)) {
            await this.clickElement(flairOption);
            break;
          }
        }
        
        // Apply flair
        const applyButton = '[data-testid="apply-flair-button"]';
        if (await this.waitForElement(applyButton, 2000)) {
          await this.clickElement(applyButton);
        }
      }
    } catch (error) {
      // Flair is optional, so we don't throw here
      this.logger.warn(`Could not add flair: ${error.message}`);
    }
  }

  /**
   * Main promotion method
   */
  async promote(videoData) {
    try {
      this.validateVideoData(videoData);
      
      const { title, tags = [] } = videoData;
      const relevantSubreddits = this.getRelevantSubreddits(tags);
      const postTitle = this.generatePostTitle(title);
      const postContent = this.generatePostContent(videoData);
      
      this.logger.info(`Starting Reddit promotion for: ${title}`);
      
      // Initialize browser
      await this.init();
      
      // Navigate to Reddit and handle login
      await this.navigateTo('https://www.reddit.com');
      
      if (!await this.verifyLogin()) {
        this.logger.info('User login required for Reddit');
        await this.promptUserLogin('Reddit');
        
        if (!await this.verifyLogin()) {
          throw new Error('Reddit login verification failed');
        }
      }
      
      const results = [];
      
      // Post to each relevant subreddit
      for (const subreddit of relevantSubreddits) {
        try {
          if (!this.validateSubreddit(subreddit)) {
            this.logger.warn(`Invalid subreddit format: ${subreddit}`);
            continue;
          }
          
          if (!this.checkRateLimit(subreddit)) {
            this.logger.warn(`Rate limit exceeded for ${subreddit}, skipping`);
            continue;
          }
          
          const result = await this.postToSubreddit(subreddit, postTitle, postContent);
          results.push({
            subreddit,
            success: true,
            postUrl: result.postUrl
          });
          
          // Wait between posts to avoid spam detection
          await this.randomDelay(30000, 60000); // 30-60 seconds
          
        } catch (error) {
          this.logger.error(`Failed to post to ${subreddit}: ${error.message}`);
          results.push({
            subreddit,
            success: false,
            error: error.message
          });
        }
      }
      
      await this.cleanup();
      
      const successfulPosts = results.filter(r => r.success);
      
      return {
        success: successfulPosts.length > 0,
        platform: 'reddit',
        posts: results,
        summary: {
          total: results.length,
          successful: successfulPosts.length,
          failed: results.length - successfulPosts.length
        }
      };
      
    } catch (error) {
      this.logger.error(`Reddit promotion failed: ${error.message}`);
      await this.cleanup();
      
      return {
        success: false,
        platform: 'reddit',
        error: error.message
      };
    }
  }
}