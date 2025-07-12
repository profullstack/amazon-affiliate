/**
 * Create command - Creates affiliate videos from Amazon product URLs or IDs
 */

import { createAffiliateVideo } from '../index.js';
import { ensureYouTubeAuthentication } from '../youtube-auth-utils.js';
import {
  parseCommandArgs,
  validateRequiredArgs,
  createProgressCallback,
  displaySuccess,
  displayWarning,
  exitWithError,
  formatDuration,
  formatFileSize
} from './utils.js';
import { youtubeReadyBeep } from '../utils/system-notifications.js';

/**
 * Flag definitions for the create command
 */
const FLAG_DEFINITIONS = {
  'max-images': {
    type: 'number',
    default: 5,
    description: 'Maximum number of images to download'
  },
  'quality': {
    type: 'string',
    default: 'medium',
    description: 'Video quality: low, medium, high, ultra'
  },
  'temp-dir': {
    type: 'string',
    default: './temp',
    description: 'Temporary directory for processing files'
  },
  'output-dir': {
    type: 'string',
    default: './output',
    description: 'Output directory for generated files'
  },
  'no-cleanup': {
    type: 'boolean',
    default: false,
    description: 'Don\'t cleanup temporary files after processing'
  },
  'auto-upload': {
    type: 'boolean',
    default: false,
    description: 'Automatically upload to YouTube without confirmation'
  },
  'auto-promote': {
    type: 'boolean',
    default: false,
    description: 'Automatically promote video on social media after upload'
  },
  'promotion-platforms': {
    type: 'array',
    default: ['reddit', 'pinterest', 'twitter'],
    description: 'Comma-separated list of promotion platforms'
  },
  'create-short-video': {
    type: 'boolean',
    default: true,
    description: 'Create a 30-second short video for social media'
  },
  'no-short-video': {
    type: 'boolean',
    default: false,
    description: 'Disable short video creation'
  },
  'publish-both-videos': {
    type: 'boolean',
    default: true,
    description: 'Publish both long and short videos to YouTube'
  },
  'no-dual-publish': {
    type: 'boolean',
    default: false,
    description: 'Disable dual publishing (upload only long video)'
  },
  'headless': {
    type: 'boolean',
    default: false,
    description: 'Run browser automation in headless mode'
  },
  'male': {
    type: 'boolean',
    default: false,
    description: 'Use male voice for voiceover generation'
  },
  'female': {
    type: 'boolean',
    default: false,
    description: 'Use female voice for voiceover generation'
  }
};

/**
 * Display help information for the create command
 */
export const displayHelp = () => {
  console.log(`
🎬 Create Affiliate Video

Usage: aff create <amazon-product-url-or-id> [options]

Arguments:
  <amazon-product-url-or-id>  Either a full Amazon URL or just the product ID
                              Examples:
                                • https://www.amazon.com/dp/B0CPZKLJX1
                                • B0CPZKLJX1

Options:
  --max-images <number>       Maximum number of images to download (default: 5)
  --quality <level>           Video quality: low, medium, high, ultra (default: medium)
  --temp-dir <path>           Temporary directory (default: ./temp)
  --output-dir <path>         Output directory (default: ./output)
  --no-cleanup               Don't cleanup temporary files
  --auto-upload              Automatically upload to YouTube without confirmation
  --auto-promote             Automatically promote video on social media after upload
  --promotion-platforms <list> Comma-separated platforms (reddit,pinterest,twitter)
  --create-short-video       Create a 30-second short video for social media (default: true)
  --no-short-video           Disable short video creation
  --publish-both-videos      Publish both long and short videos to YouTube (default: true)
  --no-dual-publish          Disable dual publishing (upload only long video)
  --headless                 Run browser automation in headless mode
  --male                     Use male voice for voiceover generation
  --female                   Use female voice for voiceover generation

Examples:
  # Create video from product ID with high quality
  aff create B0CPZKLJX1 --quality high --max-images 3

  # Create and auto-upload to YouTube
  aff create "https://www.amazon.com/dp/B08N5WRWNW" --auto-upload

  # Create with auto-promotion on specific platforms
  aff create B0CPZKLJX1 --auto-upload --auto-promote --promotion-platforms "reddit,twitter"

  # Create only full video (no short video)
  aff create B08N5WRWNW --no-short-video

  # Create with custom directories
  aff create B0CPZKLJX1 --temp-dir ./custom-temp --output-dir ./custom-output
`);
};

/**
 * Validates create command arguments and options
 * @param {string[]} args - Command arguments
 * @param {Object} options - Parsed options
 */
const validateCreateArgs = (args, options) => {
  validateRequiredArgs(args, 1, 'aff create <amazon-product-url-or-id> [options]');

  // Validate quality option
  const validQualities = ['low', 'medium', 'high', 'ultra'];
  if (options.quality && !validQualities.includes(options.quality)) {
    exitWithError(`Invalid quality: ${options.quality}. Valid options: ${validQualities.join(', ')}`);
  }

  // Validate max-images
  if (options['max-images'] && (options['max-images'] < 1 || options['max-images'] > 20)) {
    exitWithError('max-images must be between 1 and 20');
  }

  // Handle conflicting short video options
  if (options['no-short-video']) {
    options['create-short-video'] = false;
  }

  // Handle conflicting dual publishing options
  if (options['no-dual-publish']) {
    options['publish-both-videos'] = false;
  }

  // Handle conflicting voice options
  if (options.male && options.female) {
    exitWithError('Cannot specify both --male and --female voice options. Choose one or neither for random selection.');
  }
};

/**
 * Converts CLI options to createAffiliateVideo options format
 * @param {Object} cliOptions - CLI options
 * @returns {Object} - Options for createAffiliateVideo function
 */
const convertToVideoOptions = (cliOptions) => {
  // Determine voice gender preference
  let voiceGender = null;
  if (cliOptions.male) {
    voiceGender = 'male';
  } else if (cliOptions.female) {
    voiceGender = 'female';
  }

  return {
    maxImages: cliOptions['max-images'],
    videoQuality: cliOptions.quality,
    tempDir: cliOptions['temp-dir'],
    outputDir: cliOptions['output-dir'],
    cleanup: !cliOptions['no-cleanup'],
    autoUpload: cliOptions['auto-upload'],
    autoPromote: cliOptions['auto-promote'],
    promotionPlatforms: cliOptions['promotion-platforms'],
    createShortVideo: cliOptions['create-short-video'],
    publishBothVideos: cliOptions['publish-both-videos'],
    headless: cliOptions.headless,
    voiceGender: voiceGender,
    onProgress: createProgressCallback()
  };
};

/**
 * Displays the final result summary
 * @param {Object} result - Result from createAffiliateVideo
 */
const displayResult = (result) => {
  console.log('\n' + '='.repeat(60));
  
  if (result.success) {
    if (result.youtubeUrl) {
      displaySuccess('Video created and uploaded to YouTube!');
      console.log(`📺 YouTube URL: ${result.youtubeUrl}`);
    } else if (result.skippedUpload) {
      displaySuccess('Video created successfully!');
      displayWarning('YouTube upload was skipped by user choice');
      console.log(`📁 Video saved locally: ${result.files.video}`);
      
      // Play notification beep for YouTube ready
      youtubeReadyBeep();
    } else {
      displaySuccess('Video created successfully!');
      console.log(`📁 Video saved locally: ${result.files.video}`);
      console.log('📤 Ready for YouTube upload!');
      
      // Play notification beep for YouTube ready
      youtubeReadyBeep();
    }

    // Display file information
    console.log('\n📋 Generated Files:');
    console.log(`   🎥 Full video: ${result.files.video}`);
    
    if (result.files.shortVideo) {
      console.log(`   📱 Short video: ${result.files.shortVideo}`);
    }
    
    if (result.files.thumbnail) {
      console.log(`   🖼️  Thumbnail: ${result.files.thumbnail}`);
    }
    
    if (result.files.description) {
      console.log(`   📝 Description: ${result.files.description}`);
    }

    // Display statistics
    if (result.stats) {
      console.log('\n📊 Statistics:');
      console.log(`   Images downloaded: ${result.stats.imagesDownloaded}`);
      
      if (result.stats.videoSize) {
        console.log(`   Video size: ${formatFileSize(result.stats.videoSize)}`);
      }
    }

    // Display timing information
    if (result.timing) {
      console.log(`   ⏱️  Total time: ${formatDuration(result.timing.totalDuration)}`);
    }

    // Display promotion results if available
    if (result.promotionResults) {
      const successful = result.promotionResults.filter(r => r.success).length;
      const total = result.promotionResults.length;
      
      console.log('\n📢 Promotion Results:');
      console.log(`   ${successful}/${total} platforms successful`);
      
      result.promotionResults.forEach(promo => {
        const status = promo.success ? '✅' : '❌';
        console.log(`   ${status} ${promo.platform.toUpperCase()}`);
      });
    }

  } else {
    console.error(`❌ Failed to create video: ${result.error}`);
    
    if (result.timing) {
      console.log(`⏱️  Time before failure: ${formatDuration(result.timing.totalDuration)}`);
    }
    
    process.exit(1);
  }
};

/**
 * Main create command function
 * @param {string[]} args - Command arguments
 */
const createCommand = async (args) => {
  try {
    // Parse arguments and options
    const { options, args: remainingArgs } = parseCommandArgs(args, FLAG_DEFINITIONS);
    
    // Validate arguments
    validateCreateArgs(remainingArgs, options);
    
    const productInput = remainingArgs[0];
    
    console.log('🚀 Starting affiliate video creation...');
    console.log(`📦 Product: ${productInput}`);
    console.log(`⚙️  Quality: ${options.quality}`);
    console.log(`🖼️  Max images: ${options['max-images']}`);
    console.log(`📁 Output directory: ${options['output-dir']}`);
    
    if (options['create-short-video']) {
      console.log('📱 Short video: Enabled');
    }
    
    if (options['auto-upload']) {
      console.log('📤 Auto-upload: Enabled');
    }
    
    if (options['auto-promote']) {
      console.log(`📢 Auto-promote: ${options['promotion-platforms'].join(', ')}`);
    }
    
    console.log(''); // Empty line before authentication check

    // Authenticate with YouTube first (required for video creation workflow)
    try {
      await ensureYouTubeAuthentication();
    } catch (error) {
      exitWithError(`YouTube authentication failed: ${error.message}`);
    }

    // Convert CLI options to video creation options
    const videoOptions = convertToVideoOptions(options);
    
    // Create the video
    const result = await createAffiliateVideo(productInput, videoOptions);
    
    // Display results
    displayResult(result);
    
  } catch (error) {
    exitWithError(`Create command failed: ${error.message}`);
  }
};

// Export the main function as default
export default createCommand;

// Also export as named export for consistency
export { createCommand as run };