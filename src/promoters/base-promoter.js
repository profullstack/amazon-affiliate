import puppeteer from 'puppeteer';
import winston from 'winston';

/**
 * Base class for all social media promoters
 * Provides common functionality for browser automation and logging
 */
export class BasePromoter {
  constructor(config = {}) {
    this.config = {
      headless: true,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      ...config
    };

    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${this.name?.toUpperCase() || 'PROMOTER'}] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `logs/${this.name || 'promoter'}.log` })
      ]
    });
  }

  /**
   * Initialize browser and page
   */
  async init() {
    try {
      this.logger.info('Initializing browser...');
      
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
      
      // Set user agent and viewport
      await this.page.setUserAgent(this.config.userAgent);
      await this.page.setViewport(this.config.viewport);
      
      // Set default timeout
      this.page.setDefaultTimeout(this.config.timeout);
      
      this.logger.info('Browser initialized successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize browser: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close browser and cleanup
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
      
      this.isLoggedIn = false;
      this.logger.info('Browser cleanup completed');
    } catch (error) {
      this.logger.error(`Cleanup error: ${error.message}`);
    }
  }

  /**
   * Navigate to URL with error handling
   */
  async navigateTo(url) {
    try {
      this.logger.info(`Navigating to: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      await this.randomDelay(1000, 3000);
      return true;
    } catch (error) {
      this.logger.error(`Navigation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for element with timeout
   */
  async waitForElement(selector, timeout = 10000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      this.logger.error(`Element not found: ${selector}`);
      return false;
    }
  }

  /**
   * Type text with human-like delays
   */
  async typeText(selector, text, options = {}) {
    try {
      await this.page.waitForSelector(selector);
      await this.page.click(selector);
      
      if (options.clear) {
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('KeyA');
        await this.page.keyboard.up('Control');
      }
      
      // Type with random delays between characters
      for (const char of text) {
        await this.page.keyboard.type(char);
        await this.randomDelay(50, 150);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to type text: ${error.message}`);
      throw error;
    }
  }

  /**
   * Click element with retry logic
   */
  async clickElement(selector, options = {}) {
    const maxRetries = options.retries || 3;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.click(selector);
        await this.randomDelay(500, 1500);
        return true;
      } catch (error) {
        this.logger.warn(`Click attempt ${i + 1} failed: ${error.message}`);
        if (i === maxRetries - 1) throw error;
        await this.randomDelay(1000, 2000);
      }
    }
  }

  /**
   * Random delay to simulate human behavior
   */
  async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(filename) {
    try {
      const path = `logs/screenshots/${filename}-${Date.now()}.png`;
      await this.page.screenshot({ path, fullPage: true });
      this.logger.info(`Screenshot saved: ${path}`);
      return path;
    } catch (error) {
      this.logger.error(`Screenshot failed: ${error.message}`);
    }
  }

  /**
   * Handle login prompt for user
   */
  async promptUserLogin(platformName) {
    console.log(`\n🔐 ${platformName} Login Required`);
    console.log('Please log in to your account in the browser window that just opened.');
    console.log('Once logged in, press Enter to continue...');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    // Verify login by checking for common logged-in indicators
    return await this.verifyLogin();
  }

  /**
   * Verify if user is logged in (to be overridden by subclasses)
   */
  async verifyLogin() {
    // Default implementation - subclasses should override
    return true;
  }

  /**
   * Generate random user agent
   */
  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  async promote(videoData) {
    throw new Error('promote() method must be implemented by subclass');
  }

  /**
   * Validate video data
   */
  validateVideoData(videoData) {
    if (!videoData || typeof videoData !== 'object') {
      throw new Error('Invalid video data: must be an object');
    }
    
    if (!videoData.title || typeof videoData.title !== 'string') {
      throw new Error('Invalid video data: title is required');
    }
    
    if (!videoData.url || typeof videoData.url !== 'string') {
      throw new Error('Invalid video data: url is required');
    }
    
    return true;
  }

  /**
   * Extract product category from tags
   */
  extractProductCategory(tags = []) {
    const categoryMap = {
      kitchen: ['kitchen', 'cooking', 'cookware', 'appliance'],
      tech: ['tech', 'technology', 'gadget', 'electronic', 'device'],
      home: ['home', 'house', 'decor', 'furniture', 'organization'],
      fitness: ['fitness', 'exercise', 'workout', 'health', 'gym'],
      beauty: ['beauty', 'skincare', 'makeup', 'cosmetic'],
      automotive: ['car', 'auto', 'automotive', 'vehicle'],
      outdoor: ['outdoor', 'camping', 'hiking', 'sports'],
      pet: ['pet', 'dog', 'cat', 'animal'],
      baby: ['baby', 'infant', 'toddler', 'child', 'kids']
    };
    
    const lowerTags = tags.map(tag => tag.toLowerCase());
    
    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => lowerTags.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }
}