import { RedditPromoter } from './promoters/reddit-promoter.js';
import { PinterestPromoter } from './promoters/pinterest-promoter.js';
import { TwitterPromoter } from './promoters/twitter-promoter.js';
import winston from 'winston';
import fs from 'fs/promises';

/**
 * Main promotion manager that coordinates all social media promoters
 */
export class PromotionManager {
  constructor(config = {}) {
    this.config = {
      headless: true,
      timeout: 30000,
      enabledPlatforms: ['reddit', 'pinterest', 'twitter'],
      maxConcurrentPromotions: 1, // Run promotions sequentially to avoid detection
      ...config
    };

    this.promoters = [];
    this.stats = {
      totalPromotions: 0,
      successfulPromotions: 0,
      failedPromotions: 0,
      platformStats: {}
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [PROMOTION-MANAGER] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/promotion-manager.log' })
      ]
    });

    // Initialize default promoters
    this.initializePromoters();
  }

  /**
   * Initialize default promoters based on enabled platforms
   */
  initializePromoters() {
    const promoterConfig = {
      headless: this.config.headless,
      timeout: this.config.timeout
    };

    if (this.config.enabledPlatforms.includes('reddit')) {
      this.addPromoter(new RedditPromoter(promoterConfig));
    }

    if (this.config.enabledPlatforms.includes('pinterest')) {
      this.addPromoter(new PinterestPromoter(promoterConfig));
    }

    if (this.config.enabledPlatforms.includes('twitter')) {
      this.addPromoter(new TwitterPromoter(promoterConfig));
    }
  }

  /**
   * Add a promoter to the manager
   */
  addPromoter(promoter) {
    if (!promoter || typeof promoter.promote !== 'function') {
      throw new Error('Invalid promoter: must have promote method');
    }

    this.promoters.push(promoter);
    this.logger.info(`Added promoter: ${promoter.name || 'unknown'}`);
  }

  /**
   * Remove a promoter by name
   */
  removePromoter(promoterName) {
    const index = this.promoters.findIndex(p => p.name === promoterName);
    if (index !== -1) {
      this.promoters.splice(index, 1);
      this.logger.info(`Removed promoter: ${promoterName}`);
      return true;
    }
    return false;
  }

  /**
   * Get promoter by name
   */
  getPromoter(promoterName) {
    return this.promoters.find(p => p.name === promoterName);
  }

  /**
   * Validate video data before promotion
   */
  validateVideoData(videoData) {
    if (!videoData || typeof videoData !== 'object') {
      throw new Error('Invalid video data: must be an object');
    }

    const required = ['title', 'url'];
    for (const field of required) {
      if (!videoData[field] || typeof videoData[field] !== 'string') {
        throw new Error(`Invalid video data: ${field} is required and must be a string`);
      }
    }

    return true;
  }

  /**
   * Create promotion campaign data
   */
  createCampaignData(videoData, options = {}) {
    return {
      id: `campaign-${Date.now()}`,
      timestamp: new Date().toISOString(),
      videoData,
      options,
      status: 'pending',
      results: []
    };
  }

  /**
   * Save campaign results to file
   */
  async saveCampaignResults(campaign) {
    try {
      const logsDir = './logs';
      await fs.mkdir(logsDir, { recursive: true });
      
      const filename = `${logsDir}/campaign-${campaign.id}.json`;
      await fs.writeFile(filename, JSON.stringify(campaign, null, 2));
      
      this.logger.info(`Campaign results saved: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to save campaign results: ${error.message}`);
    }
  }

  /**
   * Update promotion statistics
   */
  updateStats(results) {
    this.stats.totalPromotions++;

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    this.stats.successfulPromotions += successful;
    this.stats.failedPromotions += failed;

    // Update platform-specific stats
    results.forEach(result => {
      const platform = result.platform;
      if (!this.stats.platformStats[platform]) {
        this.stats.platformStats[platform] = {
          total: 0,
          successful: 0,
          failed: 0
        };
      }

      this.stats.platformStats[platform].total++;
      if (result.success) {
        this.stats.platformStats[platform].successful++;
      } else {
        this.stats.platformStats[platform].failed++;
      }
    });
  }

  /**
   * Run promotion on a single platform
   */
  async runSinglePromotion(promoter, videoData) {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting promotion on ${promoter.name}`);
      
      const result = await promoter.promote(videoData);
      const duration = Date.now() - startTime;
      
      this.logger.info(`${promoter.name} promotion completed in ${duration}ms: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      
      return {
        ...result,
        duration,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`${promoter.name} promotion failed: ${error.message}`);
      
      return {
        success: false,
        platform: promoter.name,
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Run promotions sequentially to avoid detection
   */
  async runSequentialPromotions(videoData) {
    const results = [];
    
    for (const promoter of this.promoters) {
      try {
        const result = await this.runSinglePromotion(promoter, videoData);
        results.push(result);
        
        // Wait between promotions to appear more human-like
        if (results.length < this.promoters.length) {
          const delay = Math.floor(Math.random() * 300000) + 300000; // 5-10 minutes
          this.logger.info(`Waiting ${Math.round(delay / 1000)}s before next promotion...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        this.logger.error(`Unexpected error during ${promoter.name} promotion: ${error.message}`);
        results.push({
          success: false,
          platform: promoter.name,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Main promotion method
   */
  async promoteVideo(videoData, options = {}) {
    try {
      // Validate input
      this.validateVideoData(videoData);
      
      if (this.promoters.length === 0) {
        throw new Error('No promoters configured');
      }
      
      this.logger.info(`Starting promotion campaign for: ${videoData.title}`);
      
      // Create campaign
      const campaign = this.createCampaignData(videoData, options);
      
      // Ensure logs directory exists
      await fs.mkdir('./logs', { recursive: true });
      await fs.mkdir('./logs/screenshots', { recursive: true });
      
      // Run promotions
      const results = await this.runSequentialPromotions(videoData);
      
      // Update campaign with results
      campaign.results = results;
      campaign.status = 'completed';
      campaign.completedAt = new Date().toISOString();
      
      // Update statistics
      this.updateStats(results);
      
      // Save campaign results
      await this.saveCampaignResults(campaign);
      
      // Log summary
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      
      this.logger.info(`Promotion campaign completed: ${successful} successful, ${failed} failed`);
      
      return results;
      
    } catch (error) {
      this.logger.error(`Promotion campaign failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get promotion statistics
   */
  getPromotionStats() {
    return {
      ...this.stats,
      promoters: this.promoters.map(p => ({
        name: p.name,
        enabled: true
      }))
    };
  }

  /**
   * Reset promotion statistics
   */
  resetStats() {
    this.stats = {
      totalPromotions: 0,
      successfulPromotions: 0,
      failedPromotions: 0,
      platformStats: {}
    };
    
    this.logger.info('Promotion statistics reset');
  }

  /**
   * Get campaign history
   */
  async getCampaignHistory(limit = 10) {
    try {
      const logsDir = './logs';
      const files = await fs.readdir(logsDir);
      const campaignFiles = files
        .filter(file => file.startsWith('campaign-') && file.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);
      
      const campaigns = [];
      for (const file of campaignFiles) {
        try {
          const content = await fs.readFile(`${logsDir}/${file}`, 'utf8');
          campaigns.push(JSON.parse(content));
        } catch (error) {
          this.logger.warn(`Failed to read campaign file ${file}: ${error.message}`);
        }
      }
      
      return campaigns;
    } catch (error) {
      this.logger.error(`Failed to get campaign history: ${error.message}`);
      return [];
    }
  }

  /**
   * Test promoter connectivity (dry run)
   */
  async testPromoters() {
    const results = [];
    
    for (const promoter of this.promoters) {
      try {
        this.logger.info(`Testing ${promoter.name} connectivity...`);
        
        // Initialize browser
        await promoter.init();
        
        // Navigate to platform
        const platformUrls = {
          reddit: 'https://www.reddit.com',
          pinterest: 'https://www.pinterest.com',
          twitter: 'https://twitter.com'
        };
        
        const url = platformUrls[promoter.name];
        if (url) {
          await promoter.navigateTo(url);
          await promoter.randomDelay(2000, 4000);
        }
        
        // Cleanup
        await promoter.cleanup();
        
        results.push({
          platform: promoter.name,
          success: true,
          message: 'Connectivity test passed'
        });
        
        this.logger.info(`${promoter.name} connectivity test: PASSED`);
        
      } catch (error) {
        results.push({
          platform: promoter.name,
          success: false,
          error: error.message
        });
        
        this.logger.error(`${promoter.name} connectivity test: FAILED - ${error.message}`);
        
        // Ensure cleanup even on failure
        try {
          await promoter.cleanup();
        } catch (cleanupError) {
          this.logger.warn(`Cleanup failed for ${promoter.name}: ${cleanupError.message}`);
        }
      }
    }
    
    return results;
  }
}