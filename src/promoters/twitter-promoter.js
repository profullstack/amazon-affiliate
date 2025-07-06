import { BasePromoter } from './base-promoter.js';

/**
 * Twitter/X promoter for automated tweet posting and engagement
 */
export class TwitterPromoter extends BasePromoter {
  constructor(config = {}) {
    super(config);
    this.name = 'twitter';
    this.recentTweets = [];
    this.maxTweetsPerHour = 25; // Twitter rate limit
    this.minTweetInterval = 5 * 60 * 1000; // 5 minutes between tweets
    
    // Relevant accounts to engage with by category
    this.relevantAccounts = {
      kitchen: ['@SeriousEats', '@FoodNetwork', '@BonAppetit', '@KitchenAid'],
      tech: ['@TechCrunch', '@TheVerge', '@Wired', '@engadget'],
      home: ['@BHG', '@HGTV', '@apartmenttherapy', '@houzz'],
      fitness: ['@MensHealth', '@WomensHealth', '@MyFitnessPal', '@Nike'],
      beauty: ['@Sephora', '@Ulta', '@AllureBeauty', '@beautyguru'],
      automotive: ['@MotorTrend', '@RoadandTrack', '@CarandDriver'],
      outdoor: ['@OutsideMag', '@REI', '@Patagonia', '@NatGeo'],
      pet: ['@PetSmart', '@PETCO', '@AmericanKennel', '@ASPCA'],
      baby: ['@BabyCenter', '@WhatToExpect', '@Pampers', '@Huggies'],
      general: ['@amazon', '@deals', '@ProductHunt', '@TechReviews']
    };
  }

  /**
   * Generate tweet within character limit
   */
  generateTweet(videoData) {
    const { title, url, tags = [] } = videoData;
    const maxLength = 280;
    
    // Clean title
    let cleanTitle = title.replace(/- Honest Review$/, '').trim();
    
    // Generate hashtags
    const hashtags = this.generateHashtags(tags);
    const hashtagString = hashtags.slice(0, 3).join(' '); // Limit hashtags for readability
    
    // Calculate available space for content
    const urlLength = 23; // Twitter's t.co URL length
    const hashtagLength = hashtagString.length;
    const availableLength = maxLength - urlLength - hashtagLength - 10; // Buffer for spacing
    
    // Create tweet content
    let tweetText = '';
    
    // Add engaging prefix
    const prefixes = [
      '🔥 Just reviewed:',
      '💯 Honest thoughts on:',
      '⭐ My take on:',
      '🛍️ Tested this:',
      '📝 Review:'
    ];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    
    // Truncate title if needed
    if (cleanTitle.length > availableLength - prefix.length - 5) {
      cleanTitle = cleanTitle.substring(0, availableLength - prefix.length - 8) + '...';
    }
    
    tweetText = `${prefix} ${cleanTitle}\n\n${url}\n\n${hashtagString}`;
    
    return tweetText;
  }

  /**
   * Generate thread for longer content
   */
  generateThread(videoData) {
    const { title, url, description, tags = [] } = videoData;
    const thread = [];
    
    // Thread starter
    const cleanTitle = title.replace(/- Honest Review$/, '').trim();
    thread.push(`🧵 Thread: My honest review of ${cleanTitle}`);
    
    // Main content tweets
    if (description) {
      const sentences = description.split(/[.!?]/)
        .map(s => s.trim())
        .filter(s => s.length > 10);
      
      let currentTweet = '';
      let tweetNumber = 2;
      
      for (const sentence of sentences) {
        const potentialTweet = currentTweet + sentence + '. ';
        
        if (potentialTweet.length > 250) { // Leave room for tweet number
          if (currentTweet) {
            thread.push(`${tweetNumber}/ ${currentTweet.trim()}`);
            tweetNumber++;
          }
          currentTweet = sentence + '. ';
        } else {
          currentTweet = potentialTweet;
        }
      }
      
      if (currentTweet.trim()) {
        thread.push(`${tweetNumber}/ ${currentTweet.trim()}`);
        tweetNumber++;
      }
    }
    
    // Final tweet with link and hashtags
    const hashtags = this.generateHashtags(tags);
    const finalTweet = `${thread.length + 1}/ Watch the full review: ${url}\n\n${hashtags.slice(0, 5).join(' ')}`;
    thread.push(finalTweet);
    
    return thread;
  }

  /**
   * Generate relevant hashtags
   */
  generateHashtags(tags = []) {
    const baseHashtags = ['#review', '#productreview', '#honest'];
    
    // Convert tags to hashtags
    const tagHashtags = tags
      .filter(tag => tag && tag.length > 2)
      .map(tag => `#${tag.toLowerCase().replace(/[^a-z0-9]/g, '')}`)
      .slice(0, 8);
    
    // Add category-specific hashtags
    const category = this.extractProductCategory(tags);
    const categoryHashtags = this.getCategoryHashtags(category);
    
    // Combine and deduplicate
    const allHashtags = [...new Set([...baseHashtags, ...tagHashtags, ...categoryHashtags])];
    
    // Limit for readability (Twitter best practice is 1-2 hashtags per tweet)
    return allHashtags.slice(0, 5);
  }

  /**
   * Get category-specific hashtags
   */
  getCategoryHashtags(category) {
    const categoryHashtagMap = {
      kitchen: ['#kitchen', '#cooking', '#kitchengadgets'],
      tech: ['#tech', '#gadgets', '#technology'],
      home: ['#home', '#homedecor', '#organization'],
      fitness: ['#fitness', '#workout', '#health'],
      beauty: ['#beauty', '#skincare', '#makeup'],
      automotive: ['#car', '#auto', '#automotive'],
      outdoor: ['#outdoor', '#camping', '#adventure'],
      pet: ['#pets', '#petcare', '#animals'],
      baby: ['#baby', '#parenting', '#babygear'],
      general: ['#shopping', '#deals', '#amazon']
    };
    
    return categoryHashtagMap[category] || categoryHashtagMap.general;
  }

  /**
   * Optimize tweet timing
   */
  optimizeTweetTiming(timezone = 'America/New_York') {
    return {
      bestHours: [9, 10, 11, 15, 16, 17], // Peak engagement hours
      bestDays: ['Tuesday', 'Wednesday', 'Thursday'], // Best days for engagement
      timezone,
      recommendation: 'Post during weekday business hours for maximum engagement'
    };
  }

  /**
   * Find relevant accounts to engage with
   */
  findRelevantAccounts(tags = []) {
    const category = this.extractProductCategory(tags);
    const accounts = this.relevantAccounts[category] || this.relevantAccounts.general;
    
    return accounts.slice(0, 3); // Limit to avoid spam
  }

  /**
   * Check Twitter rate limiting
   */
  checkRateLimit() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Remove old tweets from tracking
    this.recentTweets = this.recentTweets.filter(tweetTime => tweetTime > oneHourAgo);
    
    // Check if we're under the hourly limit
    if (this.recentTweets.length >= this.maxTweetsPerHour) {
      return false;
    }
    
    // Check minimum interval since last tweet
    if (this.recentTweets.length > 0) {
      const lastTweet = Math.max(...this.recentTweets);
      if (now - lastTweet < this.minTweetInterval) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Verify Twitter login
   */
  async verifyLogin() {
    try {
      // Check for user avatar or profile menu
      const loginIndicators = [
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        '[data-testid="AppTabBar_Profile_Link"]',
        '[aria-label="Profile"]',
        '[data-testid="UserAvatar-Container-unknown"]'
      ];
      
      for (const selector of loginIndicators) {
        if (await this.waitForElement(selector, 3000)) {
          this.isLoggedIn = true;
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Twitter login verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Navigate to tweet compose
   */
  async navigateToCompose() {
    // Click the tweet button
    const tweetButton = '[data-testid="SideTweetButton"]';
    if (await this.waitForElement(tweetButton, 5000)) {
      await this.clickElement(tweetButton);
    } else {
      // Alternative: use the floating action button
      const floatingButton = '[data-testid="floatingActionButton"]';
      await this.clickElement(floatingButton);
    }
    
    // Wait for compose modal
    return await this.waitForElement('[data-testid="tweetTextarea_0"]', 10000);
  }

  /**
   * Post a single tweet
   */
  async postTweet(content) {
    try {
      this.logger.info(`Posting tweet: ${content.substring(0, 50)}...`);
      
      // Navigate to compose
      if (!await this.navigateToCompose()) {
        throw new Error('Failed to open tweet compose dialog');
      }
      
      // Type tweet content
      const textArea = '[data-testid="tweetTextarea_0"]';
      await this.typeText(textArea, content, { clear: true });
      
      // Wait a moment for content to register
      await this.randomDelay(1000, 2000);
      
      // Click tweet button
      const tweetSubmitButton = '[data-testid="tweetButtonInline"]';
      await this.clickElement(tweetSubmitButton);
      
      // Wait for tweet to be posted
      await this.randomDelay(3000, 5000);
      
      // Check if we're back to timeline (success indicator)
      const timeline = '[data-testid="primaryColumn"]';
      if (await this.waitForElement(timeline, 10000)) {
        this.recentTweets.push(Date.now());
        this.logger.info('Tweet posted successfully');
        return { success: true, tweetUrl: this.page.url() };
      } else {
        throw new Error('Tweet posting may have failed');
      }
      
    } catch (error) {
      this.logger.error(`Failed to post tweet: ${error.message}`);
      await this.takeScreenshot(`twitter-error-${Date.now()}`);
      throw error;
    }
  }

  /**
   * Post a thread
   */
  async postThread(tweets) {
    try {
      this.logger.info(`Posting thread with ${tweets.length} tweets`);
      
      const results = [];
      
      for (let i = 0; i < tweets.length; i++) {
        const tweet = tweets[i];
        
        if (i === 0) {
          // First tweet
          const result = await this.postTweet(tweet);
          results.push(result);
        } else {
          // Reply to previous tweet
          await this.randomDelay(2000, 4000);
          
          // Click reply button on the last tweet
          const replyButton = '[data-testid="reply"]';
          if (await this.waitForElement(replyButton, 5000)) {
            await this.clickElement(replyButton);
            
            // Wait for reply compose
            if (await this.waitForElement('[data-testid="tweetTextarea_0"]', 5000)) {
              // Type reply content
              await this.typeText('[data-testid="tweetTextarea_0"]', tweet, { clear: true });
              
              // Submit reply
              await this.clickElement('[data-testid="tweetButtonInline"]');
              await this.randomDelay(3000, 5000);
              
              results.push({ success: true, tweetUrl: this.page.url() });
            }
          }
        }
        
        // Rate limiting between tweets
        if (i < tweets.length - 1) {
          await this.randomDelay(10000, 20000); // 10-20 seconds between thread tweets
        }
      }
      
      return {
        success: true,
        threadUrl: results[0]?.tweetUrl,
        tweets: results
      };
      
    } catch (error) {
      this.logger.error(`Failed to post thread: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main promotion method
   */
  async promote(videoData) {
    try {
      this.validateVideoData(videoData);
      
      const { title, description, tags = [] } = videoData;
      
      this.logger.info(`Starting Twitter promotion for: ${title}`);
      
      // Check rate limits
      if (!this.checkRateLimit()) {
        throw new Error('Twitter rate limit exceeded. Please wait before posting more tweets.');
      }
      
      // Initialize browser
      await this.init();
      
      // Navigate to Twitter and handle login
      await this.navigateTo('https://twitter.com');
      
      if (!await this.verifyLogin()) {
        this.logger.info('User login required for Twitter');
        await this.promptUserLogin('Twitter');
        
        if (!await this.verifyLogin()) {
          throw new Error('Twitter login verification failed');
        }
      }
      
      let result;
      
      // Decide between single tweet or thread based on content length
      if (description && description.length > 200) {
        // Create thread for longer content
        const thread = this.generateThread(videoData);
        result = await this.postThread(thread);
        result.type = 'thread';
      } else {
        // Create single tweet
        const tweet = this.generateTweet(videoData);
        result = await this.postTweet(tweet);
        result.type = 'tweet';
      }
      
      await this.cleanup();
      
      return {
        success: result.success,
        platform: 'twitter',
        type: result.type,
        tweets: result.tweets || [{ success: result.success, tweetUrl: result.tweetUrl }],
        url: result.threadUrl || result.tweetUrl
      };
      
    } catch (error) {
      this.logger.error(`Twitter promotion failed: ${error.message}`);
      await this.cleanup();
      
      return {
        success: false,
        platform: 'twitter',
        error: error.message
      };
    }
  }
}