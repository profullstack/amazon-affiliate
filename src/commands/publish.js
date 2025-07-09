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
  },
  'shorts': {
    type: 'boolean',
    default: false,
    description: 'Optimize upload for YouTube Shorts (adds #Shorts hashtag and validates format)'
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
  --title <title>             Video title (auto-detected from .txt file if available)
  --description <desc>        Video description
  --description-file <path>   Path to file containing video description
  --tags <tags>               Comma-separated video tags (default: Amazon,Affiliate,Review)
  --category <id>             YouTube category ID (default: 26 - Howto & Style)
  --privacy <status>          Privacy status: public, unlisted, private (default: public)
  --thumbnail <path>          Path to custom thumbnail image (auto-detected if available)
  --product-url <url>         Amazon product URL for affiliate link in description
  --auto-confirm             Skip confirmation prompts
  --check-quota              Check upload quota before uploading
  --shorts                   Optimize upload for YouTube Shorts (adds #Shorts hashtag)

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
  # Upload with auto-detected title (from corresponding .txt file)
  aff publish ./output/my-video.mp4

  # Upload with custom title (overrides auto-detection)
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

  # Upload short video as YouTube Shorts (auto-detected from filename)
  aff publish ./output/product-review-short.mp4 \\
    --title "Quick Product Review"
  
  # Or manually enable Shorts optimization
  aff publish ./output/product-review.mp4 \\
    --title "Quick Product Review" \\
    --shorts

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
 * Attempts to automatically extract title and description from corresponding .txt file
 * @param {string} videoPath - Path to video file
 * @returns {Promise<{title: string|null, description: string|null, txtPath: string|null}>} - Extracted data or null if not found
 */
const extractTitleAndDescriptionFromFile = async (videoPath) => {
  try {
    const { readdir } = await import('fs/promises');
    
    // Get the directory and base name of the video
    const videoDir = videoPath.substring(0, videoPath.lastIndexOf('/')) || '.';
    const videoFileName = videoPath.substring(videoPath.lastIndexOf('/') + 1);
    const videoBaseName = videoFileName.replace(/\.[^/.]+$/, '');
    
    // Read all .txt files in the directory
    let txtFiles;
    try {
      const allFiles = await readdir(videoDir);
      txtFiles = allFiles.filter(file => file.endsWith('.txt'));
    } catch (error) {
      return { title: null, description: null, txtPath: null };
    }
    
    // Try to find a matching .txt file using various strategies
    const matchingStrategies = [
      // Strategy 1: Exact match (video-name.txt)
      {
        name: 'Exact match',
        matcher: (txtFile) => txtFile === `${videoBaseName}.txt`
      },
      
      // Strategy 2: Short video match (video-123456-short.mp4 -> video-123456-short.txt)
      {
        name: 'Short video exact match',
        matcher: (txtFile) => {
          const txtBaseName = txtFile.replace('.txt', '');
          return txtBaseName === videoBaseName;
        }
      },
      
      // Strategy 3: Remove numbers but keep short suffix (video-123456-short.mp4 -> video-short.txt)
      {
        name: 'Remove numbers, keep short',
        matcher: (txtFile) => {
          const txtBaseName = txtFile.replace('.txt', '');
          const isVideoShort = videoBaseName.endsWith('-short');
          const isTxtShort = txtBaseName.endsWith('-short');
          
          if (isVideoShort && isTxtShort) {
            const videoWithoutNumbers = videoBaseName.replace(/-\d+(-short)$/, '$1');
            const txtWithoutNumbers = txtBaseName.replace(/-\d+(-short)$/, '$1');
            return videoWithoutNumbers === txtWithoutNumbers;
          }
          
          return false;
        }
      },
      
      // Strategy 4: Fuzzy match - same base words (ignoring numbers)
      {
        name: 'Fuzzy word match',
        matcher: (txtFile) => {
          const txtBaseName = txtFile.replace('.txt', '');
          
          // Split into words and check if both are short or both are regular
          const isVideoShort = videoBaseName.endsWith('-short');
          const isTxtShort = txtBaseName.endsWith('-short');
          
          // Only match if both are short or both are regular
          if (isVideoShort !== isTxtShort) {
            return false;
          }
          
          // Remove numbers and short suffix for comparison
          const videoWords = videoBaseName.replace(/-\d+(-short)?$/, '$1').split('-');
          const txtWords = txtBaseName.replace(/-\d+(-short)?$/, '$1').split('-');
          
          // Filter out numbers and short suffix
          const videoMainWords = videoWords.filter(word => !/^\d+$/.test(word) && word !== 'short');
          const txtMainWords = txtWords.filter(word => !/^\d+$/.test(word) && word !== 'short');
          
          // Need at least 3 main words to match
          if (videoMainWords.length < 3 || txtMainWords.length < 3) {
            return false;
          }
          
          // Check if the main words match (first 3-4 words)
          const wordsToCompare = Math.min(videoMainWords.length, txtMainWords.length, 4);
          for (let i = 0; i < wordsToCompare; i++) {
            if (videoMainWords[i] !== txtMainWords[i]) {
              return false;
            }
          }
          
          return true;
        }
      },
      
      // Strategy 5: Handle hyphen variations (18piece vs 18-piece)
      {
        name: 'Hyphen variation match',
        matcher: (txtFile) => {
          const txtBaseName = txtFile.replace('.txt', '');
          
          // Split into words and check if both are short or both are regular
          const isVideoShort = videoBaseName.endsWith('-short');
          const isTxtShort = txtBaseName.endsWith('-short');
          
          // Only match if both are short or both are regular
          if (isVideoShort !== isTxtShort) {
            return false;
          }
          
          // Normalize hyphens (18piece -> 18-piece, etc.)
          const normalizeHyphens = (str) => {
            return str
              .replace(/(\d+)([a-z])/gi, '$1-$2')  // Add hyphen between number and letter
              .replace(/-+/g, '-')                 // Collapse multiple hyphens
              .replace(/-\d+(-short)?$/, '$1');    // Remove trailing numbers but keep -short
          };
          
          const normalizedVideo = normalizeHyphens(videoBaseName);
          const normalizedTxt = normalizeHyphens(txtBaseName);
          
          // Split into words for comparison
          const videoWords = normalizedVideo.split('-').filter(word => !/^\d+$/.test(word) && word !== 'short');
          const txtWords = normalizedTxt.split('-').filter(word => !/^\d+$/.test(word) && word !== 'short');
          
          // Need at least 3 main words to match
          if (videoWords.length < 3 || txtWords.length < 3) {
            return false;
          }
          
          // Check if the main words match (first 3-4 words)
          const wordsToCompare = Math.min(videoWords.length, txtWords.length, 4);
          for (let i = 0; i < wordsToCompare; i++) {
            if (videoWords[i] !== txtWords[i]) {
              return false;
            }
          }
          
          return true;
        }
      }
    ];
    
    // Try each strategy to find a matching .txt file
    for (const strategy of matchingStrategies) {
      const matchingTxtFile = txtFiles.find(strategy.matcher);
      
      if (matchingTxtFile) {
        const txtPath = `${videoDir}/${matchingTxtFile}`;
        
        console.log(`✅ Found match using strategy "${strategy.name}": ${matchingTxtFile}`);
        
        try {
          const content = await readFile(txtPath, 'utf-8');
          const lines = content.split('\n');
          
          if (lines.length > 0) {
            // First line should be the title
            const title = lines[0].trim();
            
            // Remove markdown heading syntax if present
            const cleanTitle = title.replace(/^#+\s*/, '');
            
            // Rest of the content is the description (skip empty first line if title was repeated)
            let descriptionLines = lines.slice(1);
            
            // If second line is the same as title, skip it too
            if (descriptionLines.length > 0 && descriptionLines[0].trim() === cleanTitle) {
              descriptionLines = descriptionLines.slice(1);
            }
            
            // Skip any empty lines at the beginning
            while (descriptionLines.length > 0 && !descriptionLines[0].trim()) {
              descriptionLines = descriptionLines.slice(1);
            }
            
            const description = descriptionLines.join('\n').trim();
            
            if (cleanTitle.length > 0) {
              console.log(`📝 Auto-detected title from ${txtPath}: "${cleanTitle}"`);
              if (description.length > 0) {
                console.log(`📄 Auto-detected description from ${txtPath} (${description.length} characters)`);
              }
              return { title: cleanTitle, description: description || null, txtPath };
            }
          }
        } catch (error) {
          // File can't be read, continue to next strategy
          console.log(`❌ Failed to read ${txtPath}: ${error.message}`);
          continue;
        }
      } else {
        console.log(`❌ No match found using strategy "${strategy.name}"`);
      }
    }
    
    return { title: null, description: null, txtPath: null };
  } catch (error) {
    return { title: null, description: null, txtPath: null };
  }
};

/**
 * Attempts to automatically detect thumbnail based on video filename
 * @param {string} videoPath - Path to video file
 * @returns {Promise<string|null>} - Thumbnail path or null if not found
 */
const autoDetectThumbnail = async (videoPath) => {
  try {
    // Get the base name without extension
    const baseName = videoPath.replace(/\.[^/.]+$/, '');
    
    // Check if this is a short video
    const isShortVideo = baseName.includes('-short');
    
    // Try to find corresponding thumbnail file
    const possiblePaths = [];
    
    if (isShortVideo) {
      // For short videos, try various short thumbnail patterns
      possiblePaths.push(
        `${baseName}-thumbnail.jpg`,           // product-123456-short-thumbnail.jpg
        `${baseName.replace('-short', '')}-short-thumbnail.jpg`, // product-123456-short-thumbnail.jpg
        `${baseName}.thumb.jpg`,               // product-123456-short.thumb.jpg
        `${baseName}-thumb.jpg`,               // product-123456-short-thumb.jpg
        `${baseName.replace('-short', '')}-thumbnail.jpg` // fallback to regular thumbnail
      );
    } else {
      // For regular videos, try thumbnail.jpg first
      possiblePaths.push(
        `${baseName}-thumbnail.jpg`,
        `${baseName}.thumbnail.jpg`,
        videoPath.replace(/\.mp4$/, '-thumbnail.jpg'),
        videoPath.replace(/\.mov$/, '-thumbnail.jpg'),
        videoPath.replace(/\.avi$/, '-thumbnail.jpg')
      );
    }
    
    for (const thumbnailPath of possiblePaths) {
      try {
        await validateFile(thumbnailPath, 'Thumbnail');
        console.log(`🖼️  Auto-detected thumbnail: ${thumbnailPath}`);
        return thumbnailPath;
      } catch (error) {
        // File doesn't exist or can't be read, continue to next possibility
        continue;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Validates and optimizes video for YouTube Shorts
 * @param {string} videoPath - Path to video file
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Updated options optimized for Shorts
 */
const validateAndOptimizeForShorts = async (videoPath, options) => {
  if (!options.shorts) {
    return options;
  }

  console.log('📱 Optimizing for YouTube Shorts...');
  
  // Check if video appears to be a short video (contains -short in filename)
  const isShortVideo = videoPath.includes('-short');
  
  if (isShortVideo) {
    console.log('✅ Detected short video format from filename');
  } else {
    displayWarning('Video filename does not contain "-short" - ensure this is a vertical video under 60 seconds');
  }

  // Create optimized options for Shorts
  const shortsOptions = { ...options };
  
  // Add #Shorts hashtag to title if not already present
  if (shortsOptions.title && !shortsOptions.title.includes('#Shorts')) {
    shortsOptions.title = `${shortsOptions.title} #Shorts`;
    console.log('📝 Added #Shorts hashtag to title for better discoverability');
  }
  
  // Add Shorts-specific tags
  const shortsSpecificTags = ['Shorts', 'Short', 'Vertical'];
  const currentTags = shortsOptions.tags || [];
  const newTags = [...currentTags];
  
  shortsSpecificTags.forEach(tag => {
    if (!newTags.some(existingTag => existingTag.toLowerCase() === tag.toLowerCase())) {
      newTags.push(tag);
    }
  });
  
  shortsOptions.tags = newTags;
  console.log('🏷️  Added Shorts-specific tags for better categorization');
  
  // Prefer vertical thumbnail for Shorts
  if (!shortsOptions.thumbnail) {
    const autoThumbnail = await autoDetectThumbnail(videoPath);
    if (autoThumbnail) {
      shortsOptions.thumbnail = autoThumbnail;
      console.log('🖼️  Using vertical thumbnail optimized for Shorts');
    }
  }
  
  console.log('🎯 YouTube Shorts optimization complete');
  
  return shortsOptions;
};

/**
 * Prompts user for missing upload information
 * @param {string} videoPath - Path to video file
 * @param {Object} options - Current options
 * @returns {Promise<Object>} - Complete options
 */
const promptForMissingInfo = async (videoPath, options) => {
  const completeOptions = { ...options };

  // Try to auto-extract title and description from .txt file first
  const autoData = await extractTitleAndDescriptionFromFile(videoPath);
  
  if (!completeOptions.title) {
    if (autoData.title) {
      completeOptions.title = autoData.title;
    } else {
      completeOptions.title = await promptUserInput('Enter video title');
      if (!completeOptions.title) {
        exitWithError('Video title is required for upload');
      }
    }
  }

  if (!completeOptions.description && !completeOptions['description-file']) {
    if (autoData.description) {
      completeOptions.description = autoData.description;
    } else {
      const desc = await promptUserInput('Enter video description (optional)');
      if (desc.trim()) {
        completeOptions.description = desc;
      }
    }
  }

  if (!completeOptions.tags || completeOptions.tags.length === 0) {
    const tags = await promptUserInput('Enter video tags (comma-separated, optional)', 'Amazon,Affiliate,Review');
    if (tags.trim()) {
      completeOptions.tags = tags.split(',').map(t => t.trim());
    }
  }

  if (!completeOptions.thumbnail) {
    // Try to auto-detect thumbnail first
    const autoThumbnail = await autoDetectThumbnail(videoPath);
    if (autoThumbnail) {
      completeOptions.thumbnail = autoThumbnail;
    } else {
      const thumbnail = await promptUserInput('Enter thumbnail path (optional)');
      if (thumbnail.trim()) {
        completeOptions.thumbnail = thumbnail;
      }
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

    // Auto-detect YouTube Shorts based on filename
    if (!options.shorts && videoPath.includes('-short.mp4')) {
      options.shorts = true;
      console.log('📱 Auto-detected short video format - enabling YouTube Shorts optimization');
      console.log('');
    }

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
      completeOptions = await promptForMissingInfo(videoPath, options);
    } else {
      // Even in auto-confirm mode, try to extract title, description, and thumbnail if not provided
      const autoData = await extractTitleAndDescriptionFromFile(videoPath);
      const updates = {};
      
      if (!options.title && autoData.title) {
        updates.title = autoData.title;
        console.log(`📝 Auto-detected title: "${autoData.title}"`);
      }
      
      if (!options.description && !options['description-file'] && autoData.description) {
        updates.description = autoData.description;
        console.log(`📄 Auto-detected description (${autoData.description.length} characters)`);
      }
      
      if (!options.thumbnail) {
        const autoThumbnail = await autoDetectThumbnail(videoPath);
        if (autoThumbnail) {
          updates.thumbnail = autoThumbnail;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        completeOptions = { ...options, ...updates };
      }
    }

    // Optimize for YouTube Shorts if requested
    completeOptions = await validateAndOptimizeForShorts(videoPath, completeOptions);

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
    if (completeOptions.shorts) {
      console.log(`   Format: YouTube Shorts (optimized for mobile)`);
    }
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