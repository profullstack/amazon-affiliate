/**
 * Publish command - Uploads videos to YouTube
 */

import { uploadToYouTube, getUploadQuota, updateVideoMetadata } from '../youtube-publisher.js';
import {
  parseCommandArgs,
  validateRequiredArgs,
  promptUserInput,
  promptUserConfirmation,
  displaySuccess,
  displayWarning,
  exitWithError,
  validateFile,
  formatFileSize,
  listVideoFiles,
  displayVideoSelection
} from './utils.js';
import { readFile, stat } from 'fs/promises';

/**
 * Flag definitions for the publish command
 */
const FLAG_DEFINITIONS = {
  'title': {
    type: 'string',
    description: 'Video title (required)'
  },
  'description': {
    type: 'string',
    description: 'Video description'
  },
  'description-file': {
    type: 'string',
    description: 'Path to file containing video description'
  },
  'tags': {
    type: 'array',
    default: ['Amazon', 'Affiliate', 'Review'],
    description: 'Comma-separated video tags'
  },
  'category': {
    type: 'string',
    default: '26',
    description: 'YouTube category ID (default: 26 - Howto & Style)'
  },
  'privacy': {
    type: 'string',
    default: 'public',
    description: 'Privacy status: public, unlisted, private'
  },
  'thumbnail': {
    type: 'string',
    description: 'Path to custom thumbnail image'
  },
  'product-url': {
    type: 'string',
    description: 'Amazon product URL for affiliate link in description'
  },
  'auto-confirm': {
    type: 'boolean',
    default: false,
    description: 'Skip confirmation prompts'
  },
  'check-quota': {
    type: 'boolean',
    default: false,
    description: 'Check upload quota before uploading'
  }
};

/**
 * Valid privacy status options
 */
const PRIVACY_OPTIONS = ['public', 'unlisted', 'private'];

/**
 * Common YouTube category IDs
 */
const YOUTUBE_CATEGORIES = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology'
};

/**
 * Display help information for the publish command
 */
export const displayHelp = () => {
  console.log(`
📤 Publish Video to YouTube

Usage: aff publish <video-path> [options]

Arguments:
  <video-path>                Path to video file to upload

Options:
  --title <title>             Video title (required)
  --description <desc>        Video description
  --description-file <path>   Path to file containing video description
  --tags <tags>               Comma-separated video tags (default: Amazon,Affiliate,Review)
  --category <id>             YouTube category ID (default: 26 - Howto & Style)
  --privacy <status>          Privacy status: public, unlisted, private (default: public)
  --thumbnail <path>          Path to custom thumbnail image
  --product-url <url>         Amazon product URL for affiliate link in description
  --auto-confirm             Skip confirmation prompts
  --check-quota              Check upload quota before uploading

Privacy Options:
  public                      Video is visible to everyone
  unlisted                    Video is only accessible via direct link
  private                     Video is only visible to you

Common Categories:
  1   Film & Animation        15  Pets & Animals
  2   Autos & Vehicles        17  Sports
  10  Music                   19  Travel & Events
  20  Gaming                  22  People & Blogs
  23  Comedy                  24  Entertainment
  25  News & Politics         26  Howto & Style (default)
  27  Education               28  Science & Technology

Examples:
  # Upload with basic information
  aff publish ./output/my-video.mp4 --title "Amazing Product Review"

  # Upload with full details
  aff publish ./output/product-review.mp4 \\
    --title "Kitchen Gadget Review - Worth It?" \\
    --description "Detailed review of this amazing kitchen gadget" \\
    --tags "kitchen,gadget,review,amazon,cooking" \\
    --thumbnail ./output/thumbnail.jpg \\
    --product-url "https://amazon.com/dp/B123456789"

  # Upload with description from file
  aff publish ./output/video.mp4 \\
    --title "Product Review" \\
    --description-file ./output/description.txt \\
    --privacy unlisted

  # Upload as private video
  aff publish ./output/video.mp4 \\
    --title "Test Upload" \\
    --privacy private \\
    --auto-confirm

  # Check quota before uploading
  aff publish ./output/video.mp4 \\
    --title "Product Review" \\
    --check-quota

Special Commands:
  aff publish quota           Check current upload quota
`);
};

/**
 * Validates publish command arguments and options
 * @param {string[]} args - Command arguments
 * @param {Object} options - Parsed options
 */
const validatePublishArgs = async (args, options) => {
  // Handle special commands
  if (args[0] === 'quota') {
    return; // Quota check doesn't need file validation
  }

  validateRequiredArgs(args, 1, 'aff publish <video-path> [options]');

  const videoPath = args[0];
  
  // Validate video file
  await validateFile(videoPath, 'Video file');

  // Validate privacy status
  if (options.privacy && !PRIVACY_OPTIONS.includes(options.privacy)) {
    exitWithError(`Invalid privacy status: ${options.privacy}. Valid options: ${PRIVACY_OPTIONS.join(', ')}`);
  }

  // Validate category ID
  if (options.category && !YOUTUBE_CATEGORIES[options.category]) {
    displayWarning(`Category ID ${options.category} may not be valid. See --help for common categories.`);
  }

  // Validate thumbnail if provided
  if (options.thumbnail) {
    try {
      await validateFile(options.thumbnail, 'Thumbnail');
    } catch (error) {
      if (options['auto-confirm']) {
        displayWarning(`Thumbnail validation failed: ${error.message}`);
        options.thumbnail = null;
      } else {
        exitWithError(error.message);
      }
    }
  }

  // Validate description file if provided
  if (options['description-file']) {
    try {
      await validateFile(options['description-file'], 'Description file');
    } catch (error) {
      exitWithError(error.message);
    }
  }
};

/**
 * Loads description from file if specified
 * @param {Object} options - Command options
 * @returns {Promise<string>} - Description text
 */
const loadDescription = async (options) => {
  if (options['description-file']) {
    try {
      const content = await readFile(options['description-file'], 'utf-8');
      
      // If it's a markdown file, try to extract clean text
      if (options['description-file'].endsWith('.md')) {
        const lines = content.split('\n');
        // Skip the first line if it looks like a title
        const descriptionLines = lines[0].startsWith('#') ? lines.slice(1) : lines;
        return descriptionLines.join('\n').trim();
      }
      
      return content.trim();
    } catch (error) {
      exitWithError(`Failed to read description file: ${error.message}`);
    }
  }
  
  return options.description || '';
};

/**
 * Prompts user for missing upload information
 * @param {Object} options - Current options
 * @returns {Promise<Object>} - Complete options
 */
const promptForMissingInfo = async (options) => {
  const completeOptions = { ...options };

  if (!completeOptions.title) {
    completeOptions.title = await promptUserInput('Enter video title');
    if (!completeOptions.title) {
      exitWithError('Video title is required for upload');
    }
  }

  if (!completeOptions.description && !completeOptions['description-file']) {
    const desc = await promptUserInput('Enter video description (optional)');
    if (desc.trim()) {
      completeOptions.description = desc;
    }
  }

  if (!completeOptions.tags || completeOptions.tags.length === 0) {
    const tags = await promptUserInput('Enter video tags (comma-separated, optional)', 'Amazon,Affiliate,Review');
    if (tags.trim()) {
      completeOptions.tags = tags.split(',').map(t => t.trim());
    }
  }

  if (!completeOptions.thumbnail) {
    const thumbnail = await promptUserInput('Enter thumbnail path (optional)');
    if (thumbnail.trim()) {
      completeOptions.thumbnail = thumbnail;
    }
  }

  return completeOptions;
};

/**
 * Displays video file information
 * @param {string} videoPath - Path to video file
 */
const displayVideoInfo = async (videoPath) => {
  try {
    const stats = await stat(videoPath);
    const fileSize = formatFileSize(stats.size);
    
    console.log('📹 Video Information:');
    console.log(`   File: ${videoPath}`);
    console.log(`   Size: ${fileSize}`);
    console.log(`   Modified: ${stats.mtime.toLocaleString()}`);
  } catch (error) {
    displayWarning(`Could not read video file info: ${error.message}`);
  }
};

/**
 * Checks upload quota
 */
const checkQuota = async () => {
  try {
    console.log('📊 Checking YouTube upload quota...\n');
    
    const quota = await getUploadQuota();
    
    console.log('📈 Upload Quota Status:');
    console.log(`   Available: ${quota.available ? 'Yes' : 'No'}`);
    console.log(`   Daily uploads: ${quota.dailyUploads}/${quota.maxDailyUploads}`);
    
    if (!quota.available) {
      exitWithError('Upload quota exceeded. Please try again later.');
    }
    
    displaySuccess('Upload quota is available');
    
  } catch (error) {
    displayWarning(`Could not check quota: ${error.message}`);
    console.log('Proceeding with upload attempt...');
  }
};

/**
 * Runs the main upload workflow
 * @param {string} videoPath - Path to video file
 * @param {Object} options - Upload options
 */
const runUpload = async (videoPath, options) => {
  try {
    console.log('📤 Starting YouTube upload...\n');

    // Check quota if requested
    if (options['check-quota']) {
      await checkQuota();
      console.log('');
    }

    // Display video information
    await displayVideoInfo(videoPath);
    console.log('');

    // Prompt for missing information if not in auto-confirm mode
    let completeOptions = options;
    if (!options['auto-confirm']) {
      completeOptions = await promptForMissingInfo(options);
    }

    // Load description from file if specified
    const description = await loadDescription(completeOptions);

    // Prepare upload options
    const uploadOptions = {
      tags: completeOptions.tags,
      categoryId: completeOptions.category,
      privacyStatus: completeOptions.privacy,
      thumbnailPath: completeOptions.thumbnail,
      onProgress: (progress) => {
        const bar = '█'.repeat(Math.floor(progress.percent / 5)) + 
                    '░'.repeat(20 - Math.floor(progress.percent / 5));
        process.stdout.write(`\r[${bar}] ${progress.percent}% - Uploading...`);
      }
    };

    console.log('📋 Upload Details:');
    console.log(`   Title: ${completeOptions.title}`);
    console.log(`   Privacy: ${completeOptions.privacy}`);
    console.log(`   Category: ${completeOptions.category} (${YOUTUBE_CATEGORIES[completeOptions.category] || 'Unknown'})`);
    console.log(`   Tags: ${completeOptions.tags.join(', ')}`);
    if (completeOptions.thumbnail) {
      console.log(`   Thumbnail: ${completeOptions.thumbnail}`);
    }
    if (completeOptions['product-url']) {
      console.log(`   Product URL: ${completeOptions['product-url']}`);
    }
    console.log('');

    // Confirm before proceeding (unless auto-confirm is enabled)
    if (!completeOptions['auto-confirm']) {
      const confirmed = await promptUserConfirmation('Proceed with upload?');
      if (!confirmed) {
        console.log('❌ Upload cancelled by user');
        return;
      }
    }

    // Upload video
    console.log('🚀 Uploading to YouTube...\n');
    
    const result = await uploadToYouTube(
      videoPath,
      completeOptions.title,
      description,
      completeOptions['product-url'],
      uploadOptions
    );

    // Clear progress line
    process.stdout.write('\r' + ' '.repeat(50) + '\r');

    // Display results
    console.log('\n' + '='.repeat(60));
    displaySuccess('Video uploaded successfully to YouTube!');
    
    console.log('\n📺 Upload Results:');
    console.log(`   Video ID: ${result.videoId}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Title: ${result.title}`);
    console.log(`   Privacy: ${result.privacyStatus}`);
    console.log(`   Upload Status: ${result.status}`);
    
    if (result.thumbnailUploaded) {
      displaySuccess('Custom thumbnail uploaded successfully');
    } else if (completeOptions.thumbnail) {
      displayWarning('Custom thumbnail upload failed - using auto-generated thumbnail');
    }

    console.log('\n🎉 Your video is now live on YouTube!');
    console.log(`🔗 Share this link: ${result.url}`);

  } catch (error) {
    // Clear progress line if it exists
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
    exitWithError(`Upload failed: ${error.message}`);
  }
};

/**
 * Main publish command function
 * @param {string[]} args - Command arguments
 */
const publishCommand = async (args) => {
  try {
    // Handle special commands first
    if (args[0] === 'quota') {
      await checkQuota();
      return;
    }

    // Parse arguments and options
    const { options, args: remainingArgs } = parseCommandArgs(args, FLAG_DEFINITIONS);
    
    let videoPath = remainingArgs[0];
    
    // If no video path provided, show video selection
    if (!videoPath) {
      console.log('📤 YouTube Video Publisher\n');
      
      const videoFiles = await listVideoFiles('./output');
      const selectedVideo = await displayVideoSelection(videoFiles, 'publish');
      
      if (!selectedVideo) {
        return; // User cancelled or no videos found
      }
      
      videoPath = selectedVideo.path;
      console.log(`\n✅ Selected: ${selectedVideo.name}\n`);
    }
    
    // Validate arguments (now that we have a video path)
    await validatePublishArgs([videoPath], options);
    
    // Run upload
    await runUpload(videoPath, options);
    
  } catch (error) {
    exitWithError(`Publish command failed: ${error.message}`);
  }
};

// Export the main function as default
export default publishCommand;

// Also export as named export for consistency
export { publishCommand as run };