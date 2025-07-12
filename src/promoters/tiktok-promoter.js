import { BasePromoter } from './base-promoter.js';

/**
 * TikTok promoter for automated video posting and engagement
 */
export class TikTokPromoter extends BasePromoter {
  constructor(config = {}) {
    super(config);
    this.name = 'tiktok';
    this.recentPosts = [];
    this.maxPostsPerDay = 3; // Conservative rate limiting for TikTok
  }

  /**
   * Check rate limiting
   */
  checkRateLimit() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.recentPosts = this.recentPosts.filter(time => time > oneDayAgo);
    return this.recentPosts.length < this.maxPostsPerDay;
  }

  /**
   * Generate TikTok-style caption
   */
  generateCaption(videoData) {
    const { title, description, tags = [] } = videoData;
    
    // Get appropriate emoji
    const emoji = this.getProductEmoji(tags);
    
    // TikTok trending hashtags
    const trendingTags = ['#fyp', '#viral', '#review', '#product', '#musthave'];
    
    // Custom hashtags from video tags
    const customTags = tags.slice(0, 3).map(tag => `#${tag.replace(/\s+/g, '').toLowerCase()}`);
    
    // Combine hashtags
    const allTags = [...trendingTags, ...customTags].slice(0, 8).join(' ');
    
    // Build caption (TikTok allows up to 150 characters for captions)
    let caption = `${emoji} ${title}`;
    
    // Add hook if space allows
    const hooks = [
      'You NEED to see this! 🤯',
      'This changed everything! ✨',
      'Wait for it... 😱',
      'POV: You found the perfect product 💯',
      'This is a game changer! 🔥'
    ];
    
    const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
    const remainingSpace = 150 - caption.length - allTags.length - 10;
    
    if (remainingSpace > randomHook.length + 5) {
      caption = `${randomHook}\n\n${caption}`;
    }
    
    // Add call to action
    caption += '\n\nLink in bio! 👆';
    caption += `\n\n${allTags}`;
    
    return caption.substring(0, 150);
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
   * Navigate to TikTok and check login status
   */
  async checkLoginStatus() {
    try {
      await this.navigateTo('https://www.tiktok.com');
      await this.randomDelay(3000, 5000);

      // Check for login indicators
      const loginIndicators = [
        '[data-e2e="profile-icon"]',
        '[data-e2e="nav-profile"]',
        '[data-e2e="upload-icon"]',
        'div[data-e2e="nav-upload"]'
      ];

      for (const selector of loginIndicators) {
        if (await this.waitForElement(selector, 3000)) {
          this.logger.info('TikTok login detected');
          return true;
        }
      }

      this.logger.warn('TikTok login not detected');
      return false;
    } catch (error) {
      this.logger.error(`Failed to check TikTok login status: ${error.message}`);
      return false;
    }
  }

  /**
   * Upload video to TikTok
   */
  async uploadVideo(videoPath, caption) {
    try {
      this.logger.info('Uploading video to TikTok...');

      // Navigate to upload page
      await this.navigateTo('https://www.tiktok.com/upload');
      await this.randomDelay(3000, 5000);

      // Find file input for video upload
      const fileInputSelectors = [
        'input[type="file"][accept*="video"]',
        '[data-e2e="upload-btn-input"]',
        'input[accept*=".mp4"]'
      ];

      let fileInput = null;
      for (const selector of fileInputSelectors) {
        fileInput = await this.waitForElement(selector, 5000);
        if (fileInput) break;
      }

      if (!fileInput) {
        throw new Error('Could not find video upload input');
      }

      // Upload the video file
      await fileInput.uploadFile(videoPath);
      this.logger.info('Video file uploaded, waiting for processing...');
      
      // Wait for video to process (this can take a while)
      await this.randomDelay(10000, 15000);

      // Wait for the caption text area to appear
      const captionSelectors = [
        '[data-e2e="video-caption"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="caption"]'
      ];

      let captionArea = null;
      for (const selector of captionSelectors) {
        captionArea = await this.waitForElement(selector, 10000);
        if (captionArea) break;
      }

      if (!captionArea) {
        throw new Error('Could not find caption text area');
      }

      // Add caption
      await captionArea.click();
      await this.randomDelay(1000, 2000);
      await captionArea.type(caption);
      await this.randomDelay(2000, 3000);

      // Set privacy to public (if needed)
      const privacySelectors = [
        '[data-e2e="privacy-public"]',
        'input[value="0"]', // Public option
        'div[data-e2e="public-post"]'
      ];

      for (const selector of privacySelectors) {
        const privacyOption = await this.waitForElement(selector, 3000);
        if (privacyOption) {
          await privacyOption.click();
          break;
        }
      }

      // Find and click the post button
      const postSelectors = [
        '[data-e2e="post-btn"]',
        'button[data-e2e="upload-btn"]',
        'div[data-e2e="post-button"]'
      ];

      let postButton = null;
      for (const selector of postSelectors) {
        postButton = await this.waitForElement(selector, 5000);
        if (postButton) break;
      }

      if (!postButton) {
        throw new Error('Could not find post button');
      }

      await postButton.click();
      this.logger.info('Post button clicked, waiting for upload to complete...');
      
      // Wait for upload to complete
      await this.randomDelay(15000, 25000);

      // Check if upload was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('tiktok.com') && !currentUrl.includes('upload')) {
        this.recentPosts.push(Date.now());
        this.logger.info('Video uploaded successfully to TikTok');
        return { success: true, postUrl: currentUrl };
      } else {
        // Check for success indicators
        const successSelectors = [
          '[data-e2e="upload-success"]',
          'div[data-e2e="post-success"]',
          '.upload-success'
        ];

        for (const selector of successSelectors) {
          if (await this.waitForElement(selector, 5000)) {
            this.recentPosts.push(Date.now());
            this.logger.info('Video uploaded successfully to TikTok');
            return { success: true, postUrl: 'https://www.tiktok.com' };
          }
        }

        throw new Error('Video upload may have failed');
      }

    } catch (error) {
      this.logger.error(`Failed to upload video to TikTok: ${error.message}`);
      await this.takeScreenshot(`tiktok-error-${Date.now()}`);
      throw error;
    }
  }

  /**
   * Create a text-based post (when no video is available)
   */
  async createTextPost(caption) {
    try {
      this.logger.info('Creating text-based TikTok post...');
      
      // Note: TikTok primarily focuses on video content
      // For text-based promotion, we'll guide users to create a simple video
      this.logger.warn('TikTok requires video content. Consider creating a simple slideshow video.');
      
      return {
        success: false,
        error: 'TikTok requires video content. Please provide a video file for upload.'
      };

    } catch (error) {
      this.logger.error(`Failed to create TikTok text post: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main promotion method
   */
  async promote(videoData) {
    try {
      this.logger.info('Starting TikTok promotion');

      // Check rate limiting
      if (!this.checkRateLimit()) {
        throw new Error('TikTok rate limit exceeded. Please wait before posting more videos.');
      }

      // Initialize browser and check login
      await this.init();
      const isLoggedIn = await this.checkLoginStatus();

      if (!isLoggedIn) {
        await this.promptUserLogin('TikTok');
        // Wait for user to log in
        await this.randomDelay(10000, 15000);
      }

      // Generate caption
      const caption = this.generateCaption(videoData);
      this.logger.info(`Generated TikTok caption: ${caption}`);

      let result;

      // Check if video file is provided
      if (videoData.videoPath) {
        // Upload video
        result = await this.uploadVideo(videoData.videoPath, caption);
        result.type = 'video';
      } else {
        // TikTok requires video content
        result = await this.createTextPost(caption);
        result.type = 'text';
      }

      return {
        success: result.success,
        platform: 'tiktok',
        type: result.type,
        postUrl: result.postUrl,
        caption,
        error: result.error
      };

    } catch (error) {
      this.logger.error(`TikTok promotion failed: ${error.message}`);
      await this.takeScreenshot(`tiktok-error-${Date.now()}`);

      return {
        success: false,
        platform: 'tiktok',
        error: error.message
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Get video requirements for TikTok
   */
  getVideoRequirements() {
    return {
      formats: ['.mp4', '.mov', '.avi'],
      maxSize: '287MB',
      maxDuration: '10 minutes',
      minDuration: '3 seconds',
      aspectRatio: '9:16 (vertical) recommended',
      resolution: '1080x1920 recommended'
    };
  }
}