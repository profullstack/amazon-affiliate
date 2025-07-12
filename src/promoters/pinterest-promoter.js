/**
 * Pinterest Promoter
 * Handles Pinterest pin creation and promotion
 */

import puppeteer from 'puppeteer';
import { PinterestLoginAutomation } from './pinterest-login-automation.js';
import fs from 'fs/promises';
import path from 'path';

export class PinterestPromoter {
  constructor(config = {}) {
    this.name = 'pinterest';
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
      ...config
    };
    this.browser = null;
    this.page = null;
    this.loginAutomation = null;
  }

  /**
   * Initialize browser and page
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Pinterest promoter...');
      
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Set viewport
      await this.page.setViewport({ width: 1366, height: 768 });
      
      this.loginAutomation = new PinterestLoginAutomation(this.page);
      
      console.log('✅ Pinterest promoter initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Pinterest promoter:', error.message);
      throw error;
    }
  }

  /**
   * Login to Pinterest
   */
  async login(credentials) {
    if (!this.loginAutomation) {
      throw new Error('Pinterest promoter not initialized');
    }

    return await this.loginAutomation.login(credentials);
  }

  /**
   * Generate Pinterest-optimized content
   */
  generateContent(productData) {
    const { title, description, price, rating, features, affiliateUrl } = productData;
    
    // Pinterest-optimized title (100 characters max)
    const pinTitle = this.truncateText(`${title} - ${price ? `$${price}` : 'Great Deal'}`, 100);
    
    // Pinterest description with rich details and hashtags
    const pinDescription = this.createPinDescription({
      title,
      description,
      price,
      rating,
      features,
      affiliateUrl
    });

    // Pinterest-specific hashtags
    const hashtags = this.generateHashtags(productData);

    return {
      title: pinTitle,
      description: pinDescription,
      hashtags,
      url: affiliateUrl
    };
  }

  /**
   * Create Pinterest pin description
   */
  createPinDescription({ title, description, price, rating, features, affiliateUrl }) {
    let pinDescription = '';

    // Add compelling opening
    pinDescription += `✨ ${title}\n\n`;

    // Add price if available
    if (price) {
      pinDescription += `💰 Price: $${price}\n`;
    }

    // Add rating if available
    if (rating) {
      pinDescription += `⭐ Rating: ${rating}/5\n`;
    }

    pinDescription += '\n';

    // Add description
    if (description) {
      const cleanDesc = this.cleanDescription(description);
      pinDescription += `${cleanDesc}\n\n`;
    }

    // Add key features
    if (features && features.length > 0) {
      pinDescription += '🔥 Key Features:\n';
      features.slice(0, 3).forEach(feature => {
        pinDescription += `• ${feature}\n`;
      });
      pinDescription += '\n';
    }

    // Add call to action
    pinDescription += '👆 Click the link to shop now!\n\n';

    // Add hashtags
    const hashtags = this.generateHashtags({ title, description, price, rating, features });
    pinDescription += hashtags.join(' ');

    // Pinterest has a 500 character limit for descriptions
    return this.truncateText(pinDescription, 500);
  }

  /**
   * Generate Pinterest hashtags
   */
  generateHashtags(productData) {
    const { title, description } = productData;
    const hashtags = new Set();

    // Add general shopping hashtags
    hashtags.add('#AmazonFinds');
    hashtags.add('#Shopping');
    hashtags.add('#Deal');
    hashtags.add('#MustHave');

    // Extract category-based hashtags from title and description
    const text = `${title} ${description}`.toLowerCase();
    
    // Electronics
    if (text.match(/\b(phone|laptop|computer|tablet|headphone|speaker|camera|tv|monitor|gaming|tech|electronic|gadget|device|wireless|bluetooth|smart|digital)\b/)) {
      hashtags.add('#Electronics');
      hashtags.add('#Tech');
      hashtags.add('#Gadgets');
    }

    // Home & Kitchen
    if (text.match(/\b(kitchen|home|house|decor|furniture|appliance|cookware|bedding|bathroom|living|dining|bedroom|storage|organization)\b/)) {
      hashtags.add('#HomeDecor');
      hashtags.add('#Kitchen');
      hashtags.add('#HomeImprovement');
    }

    // Fashion & Beauty
    if (text.match(/\b(fashion|clothing|dress|shirt|shoes|jewelry|beauty|makeup|skincare|hair|style|outfit|accessories|bag|watch)\b/)) {
      hashtags.add('#Fashion');
      hashtags.add('#Style');
      hashtags.add('#Beauty');
    }

    // Health & Fitness
    if (text.match(/\b(fitness|health|workout|exercise|gym|yoga|supplement|vitamin|wellness|sports|running|training)\b/)) {
      hashtags.add('#Fitness');
      hashtags.add('#Health');
      hashtags.add('#Wellness');
    }

    // Books & Education
    if (text.match(/\b(book|read|education|learn|study|knowledge|guide|manual|textbook|novel|literature)\b/)) {
      hashtags.add('#Books');
      hashtags.add('#Reading');
      hashtags.add('#Education');
    }

    // Toys & Games
    if (text.match(/\b(toy|game|play|kid|child|baby|puzzle|board|card|educational|fun|entertainment)\b/)) {
      hashtags.add('#Toys');
      hashtags.add('#Games');
      hashtags.add('#Kids');
    }

    // Outdoor & Sports
    if (text.match(/\b(outdoor|camping|hiking|fishing|hunting|sports|bike|bicycle|travel|adventure|nature)\b/)) {
      hashtags.add('#Outdoor');
      hashtags.add('#Sports');
      hashtags.add('#Adventure');
    }

    // Add seasonal hashtags
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) { // Spring
      hashtags.add('#Spring');
    } else if (month >= 5 && month <= 7) { // Summer
      hashtags.add('#Summer');
    } else if (month >= 8 && month <= 10) { // Fall
      hashtags.add('#Fall');
    } else { // Winter
      hashtags.add('#Winter');
    }

    // Convert to array and limit to 20 hashtags
    return Array.from(hashtags).slice(0, 20);
  }

  /**
   * Create a pin
   */
  async createPin(productData, imagePath) {
    try {
      console.log('📌 Creating Pinterest pin...');

      if (!this.loginAutomation) {
        throw new Error('Pinterest promoter not initialized');
      }

      // Generate Pinterest content
      const content = this.generateContent(productData);
      
      console.log('📝 Generated Pinterest content:');
      console.log(`Title: ${content.title}`);
      console.log(`Description: ${content.description.substring(0, 100)}...`);
      console.log(`Hashtags: ${content.hashtags.slice(0, 5).join(' ')}`);

      // Create the pin using automation
      const result = await this.loginAutomation.createPin(content, imagePath);
      
      if (result.success) {
        console.log('✅ Pinterest pin created successfully');
        return {
          success: true,
          platform: 'Pinterest',
          pinUrl: result.pinUrl,
          content: content
        };
      } else {
        throw new Error('Failed to create Pinterest pin');
      }

    } catch (error) {
      console.error('❌ Failed to create Pinterest pin:', error.message);
      throw error;
    }
  }

  /**
   * Main promotion method (required by PromotionManager)
   */
  async promote(videoData) {
    try {
      console.log('📌 Starting Pinterest promotion...');
      
      // Convert videoData to productData format
      const productData = {
        title: videoData.title,
        description: videoData.description || '',
        price: videoData.price || null,
        rating: videoData.rating || null,
        features: videoData.features || [],
        affiliateUrl: videoData.url || videoData.affiliateUrl,
        tags: videoData.tags || []
      };

      // Use thumbnail as image (you would typically have a product image)
      const imagePath = videoData.thumbnailPath || './test-assets/sample-product-image.jpg';
      
      // Mock credentials for testing (in real use, these would come from config)
      const credentials = {
        email: 'test@example.com',
        password: 'testpassword'
      };

      const result = await this.post(productData, imagePath, credentials);
      
      return {
        success: result.success,
        platform: 'pinterest',
        postUrl: result.pinUrl,
        content: result.content,
        error: result.error
      };

    } catch (error) {
      console.error('❌ Pinterest promotion failed:', error.message);
      return {
        success: false,
        platform: 'pinterest',
        error: error.message
      };
    }
  }

  /**
   * Post to Pinterest with retry logic
   */
  async post(productData, imagePath, credentials) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        console.log(`📌 Pinterest posting attempt ${attempt}/${this.config.retries}`);
        
        if (!this.browser) {
          await this.initialize();
        }

        // Login if not already logged in
        const loginResult = await this.login(credentials);
        if (!loginResult.success) {
          throw new Error(`Login failed: ${loginResult.error}`);
        }

        // Create pin
        const result = await this.createPin(productData, imagePath);
        
        console.log('✅ Pinterest posting successful');
        return result;

      } catch (error) {
        lastError = error;
        console.error(`❌ Pinterest posting attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.retries) {
          console.log(`⏳ Retrying in ${attempt * 2} seconds...`);
          await this.delay(attempt * 2000);
          
          // Reinitialize browser for next attempt
          await this.cleanup();
          await this.initialize();
        }
      }
    }

    throw new Error(`Pinterest posting failed after ${this.config.retries} attempts: ${lastError.message}`);
  }

  /**
   * Clean description text
   */
  cleanDescription(description) {
    return description
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Truncate text to specified length
   */
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Delay execution
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(filename = 'pinterest-debug.png') {
    if (this.page) {
      try {
        await this.page.screenshot({ 
          path: filename, 
          fullPage: true 
        });
        console.log(`📸 Screenshot saved: ${filename}`);
      } catch (error) {
        console.warn('Failed to take screenshot:', error.message);
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.loginAutomation = null;
      console.log('🧹 Pinterest promoter cleaned up');
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
}