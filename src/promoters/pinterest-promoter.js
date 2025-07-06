import { BasePromoter } from './base-promoter.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Pinterest promoter for automated pin creation and posting
 */
export class PinterestPromoter extends BasePromoter {
  constructor(config = {}) {
    super(config);
    this.name = 'pinterest';
    this.recentPins = [];
    this.maxPinsPerHour = 5; // Pinterest rate limit
    this.minPinInterval = 15 * 60 * 1000; // 15 minutes between pins
    
    // Board mapping by category
    this.boardMap = {
      kitchen: ['Kitchen Gadgets', 'Cooking Tools', 'Product Reviews', 'Kitchen Organization'],
      tech: ['Tech Gadgets', 'Electronics', 'Product Reviews', 'Cool Gadgets'],
      home: ['Home Organization', 'Home Decor', 'Product Reviews', 'Home Improvement'],
      fitness: ['Fitness Equipment', 'Home Gym', 'Product Reviews', 'Health & Fitness'],
      beauty: ['Beauty Products', 'Skincare', 'Product Reviews', 'Beauty Tips'],
      automotive: ['Car Accessories', 'Auto Products', 'Product Reviews'],
      outdoor: ['Outdoor Gear', 'Camping', 'Product Reviews', 'Adventure'],
      pet: ['Pet Products', 'Pet Care', 'Product Reviews', 'Pet Accessories'],
      baby: ['Baby Products', 'Parenting', 'Product Reviews', 'Baby Gear'],
      general: ['Product Reviews', 'Shopping', 'Cool Products', 'Must Have Items']
    };
  }

  /**
   * Generate SEO-optimized pin title
   */
  generatePinTitle(videoTitle) {
    // Clean up and optimize for Pinterest
    let title = videoTitle
      .replace(/- Honest Review$/, '')
      .replace(/Review$/, '')
      .trim();
    
    // Add Pinterest-friendly elements
    const enhancers = [
      '✨ Must-Have:',
      '🔥 Trending:',
      '💯 Worth It?',
      '⭐ Review:',
      '🛍️ Found:'
    ];
    
    const enhancer = enhancers[Math.floor(Math.random() * enhancers.length)];
    const finalTitle = `${enhancer} ${title}`;
    
    // Pinterest title limit is 100 characters
    return finalTitle.length > 100 ? finalTitle.substring(0, 97) + '...' : finalTitle;
  }

  /**
   * Generate pin description with keywords and hashtags
   */
  generatePinDescription(videoData) {
    const { title, url, tags = [] } = videoData;
    
    let description = `Check out my honest review of this ${title.replace(/- Honest Review$/, '').trim()}! `;
    description += `I tested it so you don't have to. Watch the full review to see if it's worth your money! 💰\n\n`;
    
    // Add call-to-action
    description += `🎥 Watch the full review: ${url}\n\n`;
    
    // Add hashtags
    const hashtags = this.generateHashtags(tags);
    description += hashtags.join(' ');
    
    // Pinterest description limit is 500 characters
    return description.length > 500 ? description.substring(0, 497) + '...' : description;
  }

  /**
   * Generate relevant hashtags from tags
   */
  generateHashtags(tags = []) {
    const baseHashtags = ['#productreview', '#review', '#shopping', '#musthave'];
    
    // Convert tags to hashtags
    const tagHashtags = tags
      .filter(tag => tag && tag.length > 2)
      .map(tag => `#${tag.toLowerCase().replace(/[^a-z0-9]/g, '')}`)
      .slice(0, 10);
    
    // Add category-specific hashtags
    const category = this.extractProductCategory(tags);
    const categoryHashtags = this.getCategoryHashtags(category);
    
    // Combine and deduplicate
    const allHashtags = [...new Set([...baseHashtags, ...tagHashtags, ...categoryHashtags])];
    
    // Pinterest recommends max 20 hashtags
    return allHashtags.slice(0, 20);
  }

  /**
   * Get category-specific hashtags
   */
  getCategoryHashtags(category) {
    const categoryHashtagMap = {
      kitchen: ['#kitchen', '#cooking', '#kitchengadgets', '#cookingtools'],
      tech: ['#tech', '#gadgets', '#electronics', '#technology'],
      home: ['#home', '#homedecor', '#organization', '#homeimprovement'],
      fitness: ['#fitness', '#homegym', '#workout', '#health'],
      beauty: ['#beauty', '#skincare', '#makeup', '#beautytips'],
      automotive: ['#car', '#auto', '#automotive', '#caraccessories'],
      outdoor: ['#outdoor', '#camping', '#hiking', '#adventure'],
      pet: ['#pets', '#petcare', '#petproducts', '#animals'],
      baby: ['#baby', '#parenting', '#babyproducts', '#babygear'],
      general: ['#products', '#shopping', '#deals', '#recommendations']
    };
    
    return categoryHashtagMap[category] || categoryHashtagMap.general;
  }

  /**
   * Get relevant boards for posting
   */
  getRelevantBoards(tags = []) {
    const category = this.extractProductCategory(tags);
    const boards = this.boardMap[category] || this.boardMap.general;
    
    // Return top 2 boards to avoid spam
    return boards.slice(0, 2);
  }

  /**
   * Optimize image for Pinterest (1000x1500 aspect ratio)
   */
  optimizeImageForPin() {
    return {
      width: 1000,
      height: 1500,
      quality: 90,
      format: 'jpeg'
    };
  }

  /**
   * Create Pinterest-optimized image from thumbnail
   */
  async createPinImage(thumbnailPath, outputPath) {
    try {
      const settings = this.optimizeImageForPin();
      
      await sharp(thumbnailPath)
        .resize(settings.width, settings.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: settings.quality })
        .toFile(outputPath);
      
      this.logger.info(`Pin image created: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error(`Failed to create pin image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check Pinterest rate limiting
   */
  checkRateLimit() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Remove old pins from tracking
    this.recentPins = this.recentPins.filter(pinTime => pinTime > oneHourAgo);
    
    // Check if we're under the hourly limit
    if (this.recentPins.length >= this.maxPinsPerHour) {
      return false;
    }
    
    // Check minimum interval since last pin
    if (this.recentPins.length > 0) {
      const lastPin = Math.max(...this.recentPins);
      if (now - lastPin < this.minPinInterval) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Verify Pinterest login
   */
  async verifyLogin() {
    try {
      // Check for user avatar or profile menu
      const loginIndicators = [
        '[data-test-id="user-avatar"]',
        '[data-test-id="profile-avatar"]',
        '.userAvatar',
        '[aria-label="Profile"]'
      ];
      
      for (const selector of loginIndicators) {
        if (await this.waitForElement(selector, 3000)) {
          this.isLoggedIn = true;
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Pinterest login verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Navigate to pin creation page
   */
  async navigateToCreatePin() {
    const createUrl = 'https://www.pinterest.com/pin-creation-tool/';
    await this.navigateTo(createUrl);
    
    // Wait for pin creation form
    return await this.waitForElement('[data-test-id="pin-draft-title"]', 10000);
  }

  /**
   * Upload image for pin
   */
  async uploadPinImage(imagePath) {
    try {
      // Find file input
      const fileInput = await this.page.$('input[type="file"]');
      if (!fileInput) {
        throw new Error('File upload input not found');
      }
      
      // Upload image
      await fileInput.uploadFile(imagePath);
      
      // Wait for image to process
      await this.randomDelay(3000, 5000);
      
      // Wait for image preview
      return await this.waitForElement('[data-test-id="pin-image"]', 15000);
    } catch (error) {
      this.logger.error(`Failed to upload pin image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fill pin details
   */
  async fillPinDetails(title, description, boardName) {
    try {
      // Fill title
      const titleInput = '[data-test-id="pin-draft-title"]';
      await this.typeText(titleInput, title, { clear: true });
      
      // Fill description
      const descInput = '[data-test-id="pin-draft-description"]';
      await this.typeText(descInput, description, { clear: true });
      
      // Select board
      await this.selectBoard(boardName);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to fill pin details: ${error.message}`);
      throw error;
    }
  }

  /**
   * Select board for pin
   */
  async selectBoard(boardName) {
    try {
      // Click board selector
      const boardSelector = '[data-test-id="board-dropdown-select-button"]';
      await this.clickElement(boardSelector);
      
      // Wait for board list
      await this.waitForElement('[data-test-id="board-row"]', 5000);
      
      // Look for the specific board
      const boardOption = `[title="${boardName}"]`;
      if (await this.waitForElement(boardOption, 3000)) {
        await this.clickElement(boardOption);
        return true;
      }
      
      // If specific board not found, select first available board
      const firstBoard = '[data-test-id="board-row"]:first-child';
      await this.clickElement(firstBoard);
      
      return true;
    } catch (error) {
      this.logger.warn(`Could not select specific board, using default: ${error.message}`);
      return false;
    }
  }

  /**
   * Publish the pin
   */
  async publishPin() {
    try {
      const publishButton = '[data-test-id="pin-draft-publish-button"]';
      await this.clickElement(publishButton);
      
      // Wait for success confirmation
      await this.randomDelay(3000, 5000);
      
      // Check if we're redirected to the pin page
      const currentUrl = this.page.url();
      if (currentUrl.includes('/pin/')) {
        return { success: true, pinUrl: currentUrl };
      }
      
      // Check for error messages
      const errorElement = await this.page.$('[data-test-id="error-message"]');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(`Pin publication failed: ${errorText}`);
      }
      
      return { success: true, pinUrl: currentUrl };
    } catch (error) {
      this.logger.error(`Failed to publish pin: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a single pin
   */
  async createPin(imagePath, title, description, boardName) {
    try {
      this.logger.info(`Creating pin: ${title}`);
      
      // Navigate to pin creation
      if (!await this.navigateToCreatePin()) {
        throw new Error('Failed to load pin creation page');
      }
      
      // Upload image
      if (!await this.uploadPinImage(imagePath)) {
        throw new Error('Failed to upload pin image');
      }
      
      // Fill pin details
      await this.fillPinDetails(title, description, boardName);
      
      // Publish pin
      const result = await this.publishPin();
      
      if (result.success) {
        this.recentPins.push(Date.now());
        this.logger.info(`Pin created successfully: ${result.pinUrl}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to create pin: ${error.message}`);
      await this.takeScreenshot(`pinterest-error-${Date.now()}`);
      throw error;
    }
  }

  /**
   * Main promotion method
   */
  async promote(videoData) {
    try {
      this.validateVideoData(videoData);
      
      const { title, thumbnailPath, tags = [] } = videoData;
      
      if (!thumbnailPath) {
        throw new Error('Pinterest promotion requires a thumbnail image');
      }
      
      // Check if thumbnail exists
      try {
        await fs.access(thumbnailPath);
      } catch {
        throw new Error(`Thumbnail file not found: ${thumbnailPath}`);
      }
      
      this.logger.info(`Starting Pinterest promotion for: ${title}`);
      
      // Check rate limits
      if (!this.checkRateLimit()) {
        throw new Error('Pinterest rate limit exceeded. Please wait before creating more pins.');
      }
      
      // Initialize browser
      await this.init();
      
      // Navigate to Pinterest and handle login
      await this.navigateTo('https://www.pinterest.com');
      
      if (!await this.verifyLogin()) {
        this.logger.info('User login required for Pinterest');
        await this.promptUserLogin('Pinterest');
        
        if (!await this.verifyLogin()) {
          throw new Error('Pinterest login verification failed');
        }
      }
      
      // Create Pinterest-optimized image
      const tempDir = './temp';
      await fs.mkdir(tempDir, { recursive: true });
      
      const pinImagePath = path.join(tempDir, `pin-${Date.now()}.jpg`);
      await this.createPinImage(thumbnailPath, pinImagePath);
      
      // Generate pin content
      const pinTitle = this.generatePinTitle(title);
      const pinDescription = this.generatePinDescription(videoData);
      const relevantBoards = this.getRelevantBoards(tags);
      
      const results = [];
      
      // Create pins for each relevant board
      for (const boardName of relevantBoards) {
        try {
          if (!this.checkRateLimit()) {
            this.logger.warn('Rate limit reached, stopping pin creation');
            break;
          }
          
          const result = await this.createPin(pinImagePath, pinTitle, pinDescription, boardName);
          results.push({
            board: boardName,
            success: true,
            pinUrl: result.pinUrl
          });
          
          // Wait between pins
          await this.randomDelay(60000, 120000); // 1-2 minutes
          
        } catch (error) {
          this.logger.error(`Failed to create pin for board ${boardName}: ${error.message}`);
          results.push({
            board: boardName,
            success: false,
            error: error.message
          });
        }
      }
      
      // Cleanup temp image
      try {
        await fs.unlink(pinImagePath);
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp image: ${error.message}`);
      }
      
      await this.cleanup();
      
      const successfulPins = results.filter(r => r.success);
      
      return {
        success: successfulPins.length > 0,
        platform: 'pinterest',
        pins: results,
        summary: {
          total: results.length,
          successful: successfulPins.length,
          failed: results.length - successfulPins.length
        }
      };
      
    } catch (error) {
      this.logger.error(`Pinterest promotion failed: ${error.message}`);
      await this.cleanup();
      
      return {
        success: false,
        platform: 'pinterest',
        error: error.message
      };
    }
  }
}