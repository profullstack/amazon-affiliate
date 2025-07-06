import 'dotenv/config';
import { PromotionManager } from './promotion-manager.js';
import readline from 'readline';

/**
 * CLI interface for the promotion system
 */
class PromotionCLI {
  constructor() {
    this.promotionManager = new PromotionManager();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Display help information
   */
  displayHelp() {
    console.log(`
🚀 YouTube Video Promotion Automation CLI

Usage: node src/promotion-cli.js <command> [options]

Commands:
  promote <video-url>     Promote a YouTube video across all platforms
  test                    Test connectivity to all platforms
  stats                   Show promotion statistics
  history                 Show recent campaign history
  help                    Show this help message

Options:
  --title <title>         Video title (required for promote)
  --description <desc>    Video description
  --tags <tags>           Comma-separated tags (e.g., "kitchen,gadget,review")
  --thumbnail <path>      Path to thumbnail image (required for Pinterest)
  --platforms <list>      Comma-separated platforms (reddit,pinterest,twitter)
  --headless <bool>       Run in headless mode (default: true)

Examples:
  # Promote a video with full details
  node src/promotion-cli.js promote "https://youtube.com/watch?v=abc123" \\
    --title "Amazing Kitchen Gadget Review" \\
    --description "Honest review of this kitchen gadget" \\
    --tags "kitchen,gadget,review,amazon" \\
    --thumbnail "./output/thumbnail.jpg"

  # Test platform connectivity
  node src/promotion-cli.js test

  # Show promotion statistics
  node src/promotion-cli.js stats

  # Promote to specific platforms only
  node src/promotion-cli.js promote "https://youtube.com/watch?v=abc123" \\
    --title "Product Review" \\
    --platforms "reddit,twitter"
    `);
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args) {
    const command = args[0];
    const options = {};
    
    if (command === 'promote') {
      options.videoUrl = args[1];
    }

    // Parse flags
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '--title':
          options.title = nextArg;
          i++;
          break;
        case '--description':
          options.description = nextArg;
          i++;
          break;
        case '--tags':
          options.tags = nextArg ? nextArg.split(',').map(t => t.trim()) : [];
          i++;
          break;
        case '--thumbnail':
          options.thumbnailPath = nextArg;
          i++;
          break;
        case '--platforms':
          options.platforms = nextArg ? nextArg.split(',').map(p => p.trim()) : [];
          i++;
          break;
        case '--headless':
          options.headless = nextArg !== 'false';
          i++;
          break;
      }
    }

    return { command, options };
  }

  /**
   * Prompt user for missing information
   */
  async promptForMissingInfo(options) {
    const prompt = (question) => {
      return new Promise((resolve) => {
        this.rl.question(question, resolve);
      });
    };

    if (!options.title) {
      options.title = await prompt('Enter video title: ');
    }

    if (!options.description) {
      const desc = await prompt('Enter video description (optional): ');
      if (desc.trim()) options.description = desc;
    }

    if (!options.tags || options.tags.length === 0) {
      const tags = await prompt('Enter tags (comma-separated, optional): ');
      if (tags.trim()) {
        options.tags = tags.split(',').map(t => t.trim());
      }
    }

    if (!options.thumbnailPath) {
      const thumbnail = await prompt('Enter thumbnail path (required for Pinterest, optional): ');
      if (thumbnail.trim()) options.thumbnailPath = thumbnail;
    }

    return options;
  }

  /**
   * Run promotion command
   */
  async runPromote(options) {
    try {
      if (!options.videoUrl) {
        console.error('❌ Error: Video URL is required for promotion');
        return;
      }

      console.log('🚀 Starting video promotion...\n');

      // Prompt for missing information
      const completeOptions = await this.promptForMissingInfo(options);

      // Configure promotion manager
      if (completeOptions.platforms) {
        this.promotionManager.config.enabledPlatforms = completeOptions.platforms;
        this.promotionManager.promoters = [];
        this.promotionManager.initializePromoters();
      }

      if (completeOptions.headless !== undefined) {
        this.promotionManager.config.headless = completeOptions.headless;
      }

      // Prepare video data
      const videoData = {
        title: completeOptions.title,
        url: completeOptions.videoUrl,
        description: completeOptions.description || '',
        tags: completeOptions.tags || [],
        thumbnailPath: completeOptions.thumbnailPath
      };

      console.log('📋 Video Details:');
      console.log(`   Title: ${videoData.title}`);
      console.log(`   URL: ${videoData.url}`);
      console.log(`   Tags: ${videoData.tags.join(', ') || 'None'}`);
      console.log(`   Platforms: ${this.promotionManager.config.enabledPlatforms.join(', ')}`);
      console.log('');

      // Confirm before proceeding
      const confirm = await new Promise(resolve => {
        this.rl.question('Proceed with promotion? (y/N): ', answer => {
          resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
        });
      });

      if (!confirm) {
        console.log('❌ Promotion cancelled by user');
        return;
      }

      // Run promotion
      const results = await this.promotionManager.promoteVideo(videoData);

      // Display results
      console.log('\n📊 Promotion Results:');
      console.log('='.repeat(50));

      results.forEach(result => {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`${result.platform.toUpperCase()}: ${status}`);
        
        if (result.success) {
          if (result.posts) {
            console.log(`   Posts: ${result.posts.length}`);
            result.posts.forEach(post => {
              if (post.success && post.postUrl) {
                console.log(`   📎 ${post.subreddit || post.board || 'Post'}: ${post.postUrl}`);
              }
            });
          }
          if (result.pins) {
            console.log(`   Pins: ${result.pins.length}`);
            result.pins.forEach(pin => {
              if (pin.success && pin.pinUrl) {
                console.log(`   📎 ${pin.board}: ${pin.pinUrl}`);
              }
            });
          }
          if (result.tweets) {
            console.log(`   Tweets: ${result.tweets.length}`);
            if (result.url) {
              console.log(`   📎 ${result.type}: ${result.url}`);
            }
          }
        } else {
          console.log(`   Error: ${result.error}`);
        }
        console.log('');
      });

      const successful = results.filter(r => r.success).length;
      const total = results.length;

      console.log(`🎉 Promotion completed: ${successful}/${total} platforms successful`);

    } catch (error) {
      console.error(`❌ Promotion failed: ${error.message}`);
    }
  }

  /**
   * Test platform connectivity
   */
  async runTest() {
    try {
      console.log('🔍 Testing platform connectivity...\n');

      const results = await this.promotionManager.testPromoters();

      console.log('📊 Connectivity Test Results:');
      console.log('='.repeat(40));

      results.forEach(result => {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        console.log(`${result.platform.toUpperCase()}: ${status}`);
        
        if (!result.success) {
          console.log(`   Error: ${result.error}`);
        }
      });

      const successful = results.filter(r => r.success).length;
      const total = results.length;

      console.log(`\n🎯 Test Summary: ${successful}/${total} platforms accessible`);

    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }
  }

  /**
   * Show promotion statistics
   */
  async runStats() {
    try {
      const stats = this.promotionManager.getPromotionStats();

      console.log('📊 Promotion Statistics:');
      console.log('='.repeat(30));
      console.log(`Total Campaigns: ${stats.totalPromotions}`);
      console.log(`Successful: ${stats.successfulPromotions}`);
      console.log(`Failed: ${stats.failedPromotions}`);
      
      if (stats.totalPromotions > 0) {
        const successRate = Math.round((stats.successfulPromotions / stats.totalPromotions) * 100);
        console.log(`Success Rate: ${successRate}%`);
      }

      console.log('\n📱 Platform Statistics:');
      Object.entries(stats.platformStats).forEach(([platform, platformStats]) => {
        console.log(`${platform.toUpperCase()}:`);
        console.log(`   Total: ${platformStats.total}`);
        console.log(`   Successful: ${platformStats.successful}`);
        console.log(`   Failed: ${platformStats.failed}`);
        
        if (platformStats.total > 0) {
          const rate = Math.round((platformStats.successful / platformStats.total) * 100);
          console.log(`   Success Rate: ${rate}%`);
        }
      });

      console.log('\n🔧 Configured Promoters:');
      stats.promoters.forEach(promoter => {
        console.log(`   ${promoter.name}: ${promoter.enabled ? 'Enabled' : 'Disabled'}`);
      });

    } catch (error) {
      console.error(`❌ Failed to get statistics: ${error.message}`);
    }
  }

  /**
   * Show campaign history
   */
  async runHistory() {
    try {
      console.log('📜 Recent Campaign History:\n');

      const campaigns = await this.promotionManager.getCampaignHistory(5);

      if (campaigns.length === 0) {
        console.log('No campaigns found.');
        return;
      }

      campaigns.forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.videoData.title}`);
        console.log(`   ID: ${campaign.id}`);
        console.log(`   Date: ${new Date(campaign.timestamp).toLocaleString()}`);
        console.log(`   Status: ${campaign.status}`);
        
        if (campaign.results) {
          const successful = campaign.results.filter(r => r.success).length;
          console.log(`   Results: ${successful}/${campaign.results.length} successful`);
        }
        
        console.log('');
      });

    } catch (error) {
      console.error(`❌ Failed to get campaign history: ${error.message}`);
    }
  }

  /**
   * Main CLI runner
   */
  async run(args = process.argv.slice(2)) {
    try {
      if (args.length === 0) {
        this.displayHelp();
        return;
      }

      const { command, options } = this.parseArgs(args);

      switch (command) {
        case 'promote':
          await this.runPromote(options);
          break;
        case 'test':
          await this.runTest();
          break;
        case 'stats':
          await this.runStats();
          break;
        case 'history':
          await this.runHistory();
          break;
        case 'help':
        default:
          this.displayHelp();
          break;
      }

    } catch (error) {
      console.error(`❌ CLI Error: ${error.message}`);
    } finally {
      this.rl.close();
    }
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new PromotionCLI();
  await cli.run();
}

export { PromotionCLI };