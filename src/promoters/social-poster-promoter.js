import { SocialPoster } from '@profullstack/social-poster';
import { BasePromoter } from './base-promoter.js';

/**
 * Social media promoter using @profullstack/social-poster
 * Supports X.com, Pinterest, and TikTok
 */
export class SocialPosterPromoter extends BasePromoter {
  constructor(config = {}) {
    super(config);
    this.name = config.platform || 'social-poster';
    this.platform = config.platform;
    this.socialPoster = null;
    
    // Platform-specific configurations
    this.platformConfigs = {
      'x': {
        name: 'X (Twitter)',
        url: 'https://x.com',
        maxLength: 280,
        supportsImages: true,
        supportsVideos: true
      },
      'pinterest': {
        name: 'Pinterest',
        url: 'https://pinterest.com',
        maxLength: 500,
        supportsImages: true,
        supportsVideos: false,
        requiresImage: true
      },
      'tiktok': {
        name: 'TikTok',
        url: 'https://tiktok.com',
        maxLength: 150,
        supportsImages: false,
        supportsVideos: true,
        requiresVideo: true
      }
    };
  }

  /**
   * Initialize the social poster for the specific platform
   */
  async init() {
    try {
      await super.init();
      
      if (!this.platform || !this.platformConfigs[this.platform]) {
        throw new Error(`Unsupported platform: ${this.platform}`);
      }

      this.socialPoster = new SocialPoster({
        platform: this.platform,
        headless: this.config.headless,
        timeout: this.config.timeout || 30000
      });

      await this.socialPoster.init();
      this.logger.info(`${this.platformConfigs[this.platform].name} poster initialized`);
      
    } catch (error) {
      this.logger.error(`Failed to initialize ${this.platform} poster: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate platform-specific content
   */
  generateContent(videoData) {
    const config = this.platformConfigs[this.platform];
    const { title, url, description, tags = [] } = videoData;
    
    let content = '';
    
    switch (this.platform) {
      case 'x':
        content = this.generateXContent(title, url, description, tags, config.maxLength);
        break;
      case 'pinterest':
        content = this.generatePinterestContent(title, url, description, tags, config.maxLength);
        break;
      case 'tiktok':
        content = this.generateTikTokContent(title, url, description, tags, config.maxLength);
        break;
      default:
        throw new Error(`Content generation not implemented for ${this.platform}`);
    }

    return content;
  }

  /**
   * Generate X.com (Twitter) content
   */
  generateXContent(title, url, description, tags, maxLength) {
    // Create engaging tweet with emojis and hashtags
    const hashtags = tags.slice(0, 3).map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');
    const emoji = this.getProductEmoji(tags);
    
    let content = `${emoji} ${title}\n\n`;
    
    // Add brief description if space allows
    const remainingSpace = maxLength - content.length - url.length - hashtags.length - 10; // buffer
    if (description && remainingSpace > 50) {
      const shortDesc = description.substring(0, remainingSpace - 3) + '...';
      content += `${shortDesc}\n\n`;
    }
    
    content += `${url}\n\n${hashtags}`;
    
    return content.substring(0, maxLength);
  }

  /**
   * Generate Pinterest content
   */
  generatePinterestContent(title, url, description, tags, maxLength) {
    // Pinterest prefers descriptive, keyword-rich content
    let content = `${title}\n\n`;
    
    if (description) {
      const remainingSpace = maxLength - content.length - url.length - 20; // buffer
      if (remainingSpace > 50) {
        const desc = description.substring(0, remainingSpace - 3) + '...';
        content += `${desc}\n\n`;
      }
    }
    
    content += `🔗 ${url}\n\n`;
    
    // Add relevant hashtags
    const hashtags = tags.slice(0, 5).map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');
    content += hashtags;
    
    return content.substring(0, maxLength);
  }

  /**
   * Generate TikTok content
   */
  generateTikTokContent(title, url, description, tags, maxLength) {
    // TikTok prefers short, catchy descriptions with trending hashtags
    const emoji = this.getProductEmoji(tags);
    let content = `${emoji} ${title}`;
    
    // Add trending hashtags for TikTok
    const tiktokTags = ['#fyp', '#viral', '#review', '#product'];
    const customTags = tags.slice(0, 2).map(tag => `#${tag.replace(/\s+/g, '')}`);
    const allTags = [...tiktokTags, ...customTags].join(' ');
    
    const remainingSpace = maxLength - content.length - allTags.length - 10;
    if (remainingSpace > 20) {
      content += `\n\nLink in bio! 👆`;
    }
    
    content += `\n\n${allTags}`;
    
    return content.substring(0, maxLength);
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
   * Validate content requirements for platform
   */
  validateContent(videoData) {
    const config = this.platformConfigs[this.platform];
    
    if (config.requiresImage && !videoData.thumbnailPath) {
      throw new Error(`${config.name} requires an image but none provided`);
    }
    
    if (config.requiresVideo && !videoData.videoPath) {
      throw new Error(`${config.name} requires a video but none provided`);
    }
    
    return true;
  }

  /**
   * Post content to the platform
   */
  async postContent(content, videoData) {
    try {
      const config = this.platformConfigs[this.platform];
      
      const postData = {
        text: content,
        url: videoData.url
      };

      // Add media if supported and available
      if (config.supportsImages && videoData.thumbnailPath) {
        postData.imagePath = videoData.thumbnailPath;
      }
      
      if (config.supportsVideos && videoData.videoPath) {
        postData.videoPath = videoData.videoPath;
      }

      this.logger.info(`Posting to ${config.name}...`);
      const result = await this.socialPoster.post(postData);
      
      if (result.success) {
        this.logger.info(`Successfully posted to ${config.name}`);
        return {
          success: true,
          postUrl: result.postUrl,
          postId: result.postId
        };
      } else {
        throw new Error(result.error || 'Post failed');
      }
      
    } catch (error) {
      this.logger.error(`Failed to post to ${this.platform}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main promotion method
   */
  async promote(videoData) {
    try {
      this.logger.info(`Starting ${this.platformConfigs[this.platform].name} promotion`);
      
      // Validate requirements
      this.validateContent(videoData);
      
      // Generate platform-specific content
      const content = this.generateContent(videoData);
      this.logger.info(`Generated content (${content.length} chars): ${content.substring(0, 100)}...`);
      
      // Post content
      const result = await this.postContent(content, videoData);
      
      return {
        success: true,
        platform: this.platform,
        content,
        ...result
      };
      
    } catch (error) {
      this.logger.error(`${this.platformConfigs[this.platform].name} promotion failed: ${error.message}`);
      await this.takeScreenshot(`${this.platform}-error-${Date.now()}`);
      
      return {
        success: false,
        platform: this.platform,
        error: error.message
      };
    }
  }

  /**
   * Test platform connectivity
   */
  async testConnectivity() {
    try {
      await this.init();
      
      const config = this.platformConfigs[this.platform];
      await this.socialPoster.navigateTo(config.url);
      
      // Wait a moment to ensure page loads
      await this.randomDelay(2000, 4000);
      
      await this.cleanup();
      
      return {
        success: true,
        platform: this.platform,
        message: `${config.name} connectivity test passed`
      };
      
    } catch (error) {
      return {
        success: false,
        platform: this.platform,
        error: error.message
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.socialPoster) {
        await this.socialPoster.cleanup();
      }
      await super.cleanup();
    } catch (error) {
      this.logger.warn(`Cleanup warning for ${this.platform}: ${error.message}`);
    }
  }
}

/**
 * Factory function to create platform-specific promoters
 */
export function createSocialPosterPromoter(platform, config = {}) {
  return new SocialPosterPromoter({ ...config, platform });
}

/**
 * Create X.com promoter
 */
export function createXPromoter(config = {}) {
  return createSocialPosterPromoter('x', config);
}

/**
 * Create Pinterest promoter (using social-poster)
 */
export function createPinterestPromoter(config = {}) {
  return createSocialPosterPromoter('pinterest', config);
}

/**
 * Create TikTok promoter
 */
export function createTikTokPromoter(config = {}) {
  return createSocialPosterPromoter('tiktok', config);
}