/**
 * Promote command - Promotes videos on social media platforms
 */

import { PromotionManager } from '../promotion-manager.js';
import {
  parseCommandArgs,
  validateRequiredArgs,
  promptUserInput,
  promptUserConfirmation,
  displaySuccess,
  displayWarning,
  exitWithError,
  validateFile,
  listVideoFiles,
  displayVideoSelection
} from './utils.js';

/**
 * Flag definitions for the promote command
 */
const FLAG_DEFINITIONS = {
  'title': {
    type: 'string',
    description: 'Video title (required for promotion)'
  },
  'description': {
    type: 'string',
    description: 'Video description'
  },
  'tags': {
    type: 'array',
    default: [],
    description: 'Comma-separated tags (e.g., "kitchen,gadget,review")'
  },
  'thumbnail': {
    type: 'string',
    description: 'Path to thumbnail image (required for Pinterest)'
  },
  'platforms': {
    type: 'array',
    default: ['reddit', 'pinterest', 'twitter', 'x', 'tiktok'],
    description: 'Comma-separated platforms to promote on'
  },
  'headless': {
    type: 'boolean',
    default: true,
    description: 'Run browser automation in headless mode'
  },
  'auto-confirm': {
    type: 'boolean',
    default: false,
    description: 'Skip confirmation prompts'
  }
};

/**
 * Available promotion platforms
 */
const AVAILABLE_PLATFORMS = ['reddit', 'pinterest', 'twitter', 'x', 'tiktok'];

/**
 * Display help information for the promote command
 */
export const displayHelp = () => {
  console.log(`
📢 Promote Video on Social Media

Usage: aff promote <video-url> [options]

Arguments:
  <video-url>                 YouTube video URL to promote

Options:
  --title <title>             Video title (required for promotion)
  --description <desc>        Video description
  --tags <tags>               Comma-separated tags (e.g., "kitchen,gadget,review")
  --thumbnail <path>          Path to thumbnail image (required for Pinterest)
  --platforms <list>          Comma-separated platforms (default: reddit,pinterest,twitter,x,tiktok)
  --headless <bool>           Run in headless mode (default: true)
  --auto-confirm             Skip confirmation prompts

Available Platforms:
  reddit                      Post to relevant subreddits
  pinterest                   Create pins on relevant boards
  twitter                     Post tweets with video link

Examples:
  # Promote with full details
  aff promote "https://youtube.com/watch?v=abc123" \\
    --title "Amazing Kitchen Gadget Review" \\
    --description "Honest review of this kitchen gadget" \\
    --tags "kitchen,gadget,review,amazon" \\
    --thumbnail "./output/thumbnail.jpg"

  # Promote to specific platforms only
  aff promote "https://youtube.com/watch?v=abc123" \\
    --title "Product Review" \\
    --platforms "reddit,x,tiktok"

  # Promote with interactive prompts
  aff promote "https://youtube.com/watch?v=abc123"

  # Auto-confirm all prompts
  aff promote "https://youtube.com/watch?v=abc123" \\
    --title "Product Review" \\
    --auto-confirm

Special Commands:
  aff promote test            Test connectivity to all platforms
  aff promote stats           Show promotion statistics
  aff promote history         Show recent campaign history
`);
};

/**
 * Validates promote command arguments and options
 * @param {string[]} args - Command arguments
 * @param {Object} options - Parsed options
 */
const validatePromoteArgs = (args, options) => {
  // Handle special commands
  if (args[0] === 'test' || args[0] === 'stats' || args[0] === 'history') {
    return; // These don't need URL validation
  }

  validateRequiredArgs(args, 1, 'aff promote <video-url> [options]');

  // Validate video URL format
  const videoUrl = args[0];
  if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
    displayWarning('Video URL should be a YouTube URL for best results');
  }

  // Validate platforms
  if (options.platforms) {
    const invalidPlatforms = options.platforms.filter(p => !AVAILABLE_PLATFORMS.includes(p));
    if (invalidPlatforms.length > 0) {
      exitWithError(`Invalid platforms: ${invalidPlatforms.join(', ')}. Available: ${AVAILABLE_PLATFORMS.join(', ')}`);
    }
  }
};

/**
 * Prompts user for missing promotion information
 * @param {Object} options - Current options
 * @returns {Promise<Object>} - Complete options
 */
const promptForMissingInfo = async (options) => {
  const completeOptions = { ...options };

  if (!completeOptions.title) {
    completeOptions.title = await promptUserInput('Enter video title');
    if (!completeOptions.title) {
      exitWithError('Video title is required for promotion');
    }
  }

  if (!completeOptions.description) {
    const desc = await promptUserInput('Enter video description (optional)');
    if (desc.trim()) {
      completeOptions.description = desc;
    }
  }

  if (!completeOptions.tags || completeOptions.tags.length === 0) {
    const tags = await promptUserInput('Enter tags (comma-separated, optional)');
    if (tags.trim()) {
      completeOptions.tags = tags.split(',').map(t => t.trim());
    }
  }

  if (!completeOptions.thumbnail) {
    const thumbnail = await promptUserInput('Enter thumbnail path (required for Pinterest, optional)');
    if (thumbnail.trim()) {
      completeOptions.thumbnail = thumbnail;
    }
  }

  return completeOptions;
};

/**
 * Tests platform connectivity
 */
const runTest = async () => {
  try {
    console.log('🔍 Testing platform connectivity...\n');

    const promotionManager = new PromotionManager();
    const results = await promotionManager.testPromoters();

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
    exitWithError(`Test failed: ${error.message}`);
  }
};

/**
 * Shows promotion statistics
 */
const runStats = async () => {
  try {
    const promotionManager = new PromotionManager();
    const stats = promotionManager.getPromotionStats();

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
    exitWithError(`Failed to get statistics: ${error.message}`);
  }
};

/**
 * Shows campaign history
 */
const runHistory = async () => {
  try {
    console.log('📜 Recent Campaign History:\n');

    const promotionManager = new PromotionManager();
    const campaigns = await promotionManager.getCampaignHistory(5);

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
    exitWithError(`Failed to get campaign history: ${error.message}`);
  }
};

/**
 * Runs the main promotion workflow
 * @param {string} videoUrl - YouTube video URL
 * @param {Object} options - Promotion options
 */
const runPromotion = async (videoUrl, options) => {
  try {
    console.log('🚀 Starting video promotion...\n');

    // Prompt for missing information if not in auto-confirm mode
    let completeOptions = options;
    if (!options['auto-confirm']) {
      completeOptions = await promptForMissingInfo(options);
    }

    // Validate thumbnail file if provided
    if (completeOptions.thumbnail) {
      try {
        await validateFile(completeOptions.thumbnail, 'Thumbnail');
      } catch (error) {
        if (options['auto-confirm']) {
          displayWarning(`Thumbnail validation failed: ${error.message}`);
          completeOptions.thumbnail = null;
        } else {
          exitWithError(error.message);
        }
      }
    }

    // Configure promotion manager
    const promotionManager = new PromotionManager({
      headless: completeOptions.headless,
      enabledPlatforms: completeOptions.platforms
    });

    // Prepare video data
    const videoData = {
      title: completeOptions.title,
      url: videoUrl,
      description: completeOptions.description || '',
      tags: completeOptions.tags || [],
      thumbnailPath: completeOptions.thumbnail
    };

    console.log('📋 Video Details:');
    console.log(`   Title: ${videoData.title}`);
    console.log(`   URL: ${videoData.url}`);
    console.log(`   Tags: ${videoData.tags.join(', ') || 'None'}`);
    console.log(`   Platforms: ${completeOptions.platforms.join(', ')}`);
    console.log('');

    // Confirm before proceeding (unless auto-confirm is enabled)
    if (!completeOptions['auto-confirm']) {
      const confirmed = await promptUserConfirmation('Proceed with promotion?');
      if (!confirmed) {
        console.log('❌ Promotion cancelled by user');
        return;
      }
    }

    // Run promotion
    console.log('🚀 Starting promotion across platforms...\n');
    const results = await promotionManager.promoteVideo(videoData);

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

    if (successful === total) {
      displaySuccess(`Promotion completed: ${successful}/${total} platforms successful`);
    } else if (successful > 0) {
      displayWarning(`Promotion partially completed: ${successful}/${total} platforms successful`);
    } else {
      exitWithError(`Promotion failed: ${successful}/${total} platforms successful`);
    }

  } catch (error) {
    exitWithError(`Promotion failed: ${error.message}`);
  }
};

/**
 * Main promote command function
 * @param {string[]} args - Command arguments
 */
const promoteCommand = async (args) => {
  try {
    // Parse arguments and options
    const { options, args: remainingArgs } = parseCommandArgs(args, FLAG_DEFINITIONS);
    
    // Handle special commands
    if (remainingArgs[0] === 'test') {
      await runTest();
      return;
    }
    
    if (remainingArgs[0] === 'stats') {
      await runStats();
      return;
    }
    
    if (remainingArgs[0] === 'history') {
      await runHistory();
      return;
    }

    let videoUrl = remainingArgs[0];
    
    // If no video URL provided, show video selection and try to find corresponding YouTube URL
    if (!videoUrl) {
      console.log('📢 Social Media Video Promoter\n');
      
      const videoFiles = await listVideoFiles('./output');
      const selectedVideo = await displayVideoSelection(videoFiles, 'promote');
      
      if (!selectedVideo) {
        return; // User cancelled or no videos found
      }
      
      console.log(`\n✅ Selected: ${selectedVideo.name}`);
      
      // Try to find a corresponding description file that might contain the YouTube URL
      const descriptionPath = selectedVideo.path.replace(/\.[^.]+$/, '.md');
      try {
        const { readFile } = await import('fs/promises');
        const descriptionContent = await readFile(descriptionPath, 'utf-8');
        
        // Look for YouTube URL in the description file
        const youtubeUrlMatch = descriptionContent.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (youtubeUrlMatch) {
          videoUrl = youtubeUrlMatch[0];
          console.log(`🔗 Found YouTube URL: ${videoUrl}\n`);
        } else {
          console.log('⚠️ No YouTube URL found in description file.');
          videoUrl = await promptUserInput('Enter YouTube video URL to promote');
          if (!videoUrl) {
            console.log('❌ YouTube URL is required for promotion');
            return;
          }
        }
      } catch (error) {
        console.log('⚠️ Could not find description file with YouTube URL.');
        videoUrl = await promptUserInput('Enter YouTube video URL to promote');
        if (!videoUrl) {
          console.log('❌ YouTube URL is required for promotion');
          return;
        }
      }
    }

    // Validate arguments for regular promotion
    validatePromoteArgs([videoUrl], options);
    
    // Run promotion
    await runPromotion(videoUrl, options);
    
  } catch (error) {
    exitWithError(`Promote command failed: ${error.message}`);
  }
};

// Export the main function as default
export default promoteCommand;

// Also export as named export for consistency
export { promoteCommand as run };