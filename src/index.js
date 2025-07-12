import 'dotenv/config';
import { scrapeAmazonProduct } from './amazon-scraper.js';
import { downloadImages, cleanupImages } from './image-downloader.js';
import { generateVoiceover } from './voiceover-generator.js';
import { generateAIReviewScript, generateAIVideoTitle, generateAIVideoDescription, generateAIShortVideoScript } from './openai-script-generator.js';
import { createSlideshow, createShortVideo, createVideoWithAffiliateOverlay } from './video-creator.js';
import { createThumbnail } from './thumbnail-generator.js';
import { uploadToYouTube, uploadBothVideosToYouTube } from './youtube-publisher.js';
import { addCompleteInteractiveElements } from './youtube-interactive-elements.js';
import { PromotionManager } from './promotion-manager.js';
import { writeVideoDescription } from './description-writer.js';
import { videoCompletionBeep, youtubeReadyBeep } from './utils/system-notifications.js';
import { generateSessionId, createVoiceoverFilePaths, createOutputFilePaths } from './utils/temp-file-manager.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Default configuration options
 */
const DEFAULT_OPTIONS = {
  maxImages: 5,
  tempDir: './temp',
  outputDir: './output',
  videoQuality: 'high',
  cleanup: true,
  onProgress: null,
  autoPromote: false,
  promotionPlatforms: ['reddit', 'pinterest', 'twitter'],
  createShortVideo: true,
  publishBothVideos: true, // New option to control dual publishing
  enableAffiliateOverlay: false, // New option to enable affiliate text overlay on videos
  setupInteractiveElements: false, // New option to setup YouTube Cards and End Screens
  enableBackgroundMusic: true, // Enable background music by default
  enableIntroOutro: true // Enable intro/outro by default
};

/**
 * Validates and normalizes Amazon product URL or product ID
 * @param {string} input - URL or product ID to validate
 * @returns {string} - Normalized Amazon URL
 * @throws {Error} When input is invalid
 */
const validateAndNormalizeAmazonUrl = input => {
  if (!input || typeof input !== 'string') {
    throw new Error('Amazon product URL or product ID is required');
  }

  const trimmedInput = input.trim();

  // Check if it's already a full URL
  if (trimmedInput.startsWith('http')) {
    try {
      const urlObj = new URL(trimmedInput);
      if (!urlObj.hostname.includes('amazon.') ||
          (!trimmedInput.includes('/dp/') && !trimmedInput.includes('/gp/product/'))) {
        throw new Error('Invalid Amazon URL format');
      }
      return trimmedInput;
    } catch {
      throw new Error('Invalid Amazon URL format');
    }
  }

  // Check if it's a product ID (ASIN format: typically 10 characters, alphanumeric)
  const productIdPattern = /^[A-Z0-9]{10}$/;
  if (productIdPattern.test(trimmedInput)) {
    // Convert product ID to full Amazon URL
    const amazonUrl = `https://www.amazon.com/dp/${trimmedInput}`;
    console.log(`📦 Converted product ID "${trimmedInput}" to URL: ${amazonUrl}`);
    return amazonUrl;
  }

  // Check for other common ASIN patterns (sometimes shorter or with different characters)
  const flexibleProductIdPattern = /^[A-Z0-9]{8,12}$/;
  if (flexibleProductIdPattern.test(trimmedInput)) {
    const amazonUrl = `https://www.amazon.com/dp/${trimmedInput}`;
    console.log(`📦 Converted product ID "${trimmedInput}" to URL: ${amazonUrl}`);
    return amazonUrl;
  }

  throw new Error('Invalid input. Please provide either a full Amazon URL or a valid product ID (e.g., B0CPZKLJX1)');
};

// Export for testing
export { validateAndNormalizeAmazonUrl };

/**
 * Reports progress to callback if provided
 * @param {Function} callback - Progress callback function
 * @param {string} step - Current step name
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Progress message
 */
const reportProgress = (callback, step, progress, message = '') => {
  if (callback && typeof callback === 'function') {
    callback({
      step,
      progress: Math.round(progress),
      message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Generates video title from product title
 * @param {string} productTitle - Original product title
 * @returns {string} - Optimized video title
 */
const generateVideoTitle = productTitle => {
  // Clean up the title and add review context
  let title = productTitle
    .replace(/[^\w\s\-()]/g, '') // Remove special characters except basic ones
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Truncate if too long, leaving room for " - Honest Review"
  const maxBaseLength = 85;
  if (title.length > maxBaseLength) {
    title = title.substring(0, maxBaseLength).trim();
    // Try to end at a word boundary
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > maxBaseLength * 0.8) {
      title = title.substring(0, lastSpace);
    }
  }

  return `${title} - Honest Review`;
};

/**
 * Generates safe filename from video title
 * @param {string} videoTitle - Video title
 * @returns {string} - Safe filename
 */
const generateSafeFilename = videoTitle => {
  // Extract key words and create a much shorter filename
  const words = videoTitle
    .replace(/[^\w\s]/g, '') // Remove special characters
    .split(/\s+/)
    .filter(word => word.length > 2) // Only keep words longer than 2 chars
    .slice(0, 4); // Take only first 4 meaningful words
  
  const shortName = words.join('-').toLowerCase();
  
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now().toString().slice(-6);
  
  return `${shortName}-${timestamp}`;
};

/**
 * Generates video description from product description
 * @param {string} productDescription - Original product description
 * @param {string} productTitle - Product title
 * @returns {string} - Optimized video description
 */
const generateVideoDescription = (productDescription, productTitle) => {
  let description = `In this video, I review the ${productTitle}.\n\n`;
  
  // Add key features from product description
  if (productDescription && productDescription.length > 0) {
    // Extract bullet points or key features
    const features = productDescription
      .split(/[•·\n]/)
      .map(line => line.trim())
      .filter(line => line.length > 10 && line.length < 200)
      .slice(0, 5); // Limit to 5 key features

    if (features.length > 0) {
      description += 'Key Features:\n';
      features.forEach(feature => {
        description += `• ${feature}\n`;
      });
      description += '\n';
    }
  }

  description += 'Watch the full review to see if this product is right for you!\n\n';
  description += '⏰ Timestamps:\n';
  description += '0:00 Introduction\n';
  description += '0:30 Product Overview\n';
  description += '1:00 Key Features\n';
  description += '2:00 Final Thoughts\n\n';

  return description;
};

/**
 * Generates affiliate URL from product URL
 * @param {string} productUrl - Original Amazon product URL
 * @param {string} affiliateTag - Amazon affiliate tag
 * @returns {string} - URL with affiliate tag
 */
const generateAffiliateUrl = (productUrl, affiliateTag) => {
  if (!productUrl || !affiliateTag) {
    return productUrl || '';
  }

  try {
    const url = new URL(productUrl);
    url.searchParams.set('tag', affiliateTag);
    return url.toString();
  } catch {
    // If URL parsing fails, return original URL
    return productUrl;
  }
};

/**
 * Builds complete video description with affiliate link
 * @param {string} baseDescription - Base description text
 * @param {string} productUrl - Amazon product URL
 * @param {string} affiliateTag - Amazon affiliate tag
 * @returns {string} - Complete description with affiliate link
 */
const buildCompleteDescription = (baseDescription, productUrl, affiliateTag) => {
  let description = baseDescription || '';

  if (productUrl && affiliateTag) {
    const affiliateUrl = generateAffiliateUrl(productUrl, affiliateTag);
    
    if (description.length > 0) {
      description += '\n\n';
    }
    
    description += `🛒 Get this product here: ${affiliateUrl}\n\n`;
    description += '⚠️ As an Amazon Associate, I earn from qualifying purchases.\n';
    description += 'This helps support the channel at no extra cost to you!';
  }

  return description;
};

/**
 * Creates timing information for performance tracking
 * @param {Object} timings - Step timings object
 * @returns {Object} - Formatted timing information
 */
const createTimingInfo = timings => {
  const totalStart = Math.min(...Object.values(timings).map(t => t.start));
  const totalEnd = Math.max(...Object.values(timings).map(t => t.end));
  
  return {
    totalDuration: totalEnd - totalStart,
    steps: Object.fromEntries(
      Object.entries(timings).map(([step, timing]) => [
        step,
        {
          duration: timing.end - timing.start,
          startTime: timing.start - totalStart
        }
      ])
    )
  };
};

/**
 * Prompts user for confirmation with yes/no input
 * @param {string} message - The question to ask the user
 * @param {boolean} autoConfirm - If true, automatically confirms without prompting
 * @returns {Promise<boolean>} - True if user confirms, false otherwise
 */
const promptUserConfirmation = async (message, autoConfirm = false) => {
  if (autoConfirm) {
    console.log(`${message} (auto-confirmed)`);
    return true;
  }

  // Import readline for user input
  const readline = await import('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes';
      resolve(confirmed);
    });
  });
};

/**
 * Main function to create affiliate video from Amazon product URL or product ID
 * @param {string} productInput - Amazon product URL or product ID
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Result object with success status and details
 */
export const createAffiliateVideo = async (productInput, options = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const timings = {};
  let tempFiles = [];

  try {
    // Validate and normalize input (convert product ID to URL if needed)
    const productUrl = validateAndNormalizeAmazonUrl(productInput);
    
    reportProgress(config.onProgress, 'validation', 5, 'Validating Amazon input');

    // Generate unique session ID for this video creation session
    const sessionId = generateSessionId();
    console.log(`🔑 Session ID: ${sessionId}`);

    // Create unique file paths for this session (will be updated with meaningful name later)
    const voiceoverPaths = createVoiceoverFilePaths(config.tempDir, {
      includeMain: true,
      includeShort: config.createShortVideo,
      includeIntro: config.enableIntroOutro
    }, sessionId);

    // Ensure directories exist
    await fs.mkdir(config.tempDir, { recursive: true });
    await fs.mkdir(config.outputDir, { recursive: true });

    console.log(`🚀 Starting affiliate video creation for: ${productUrl}`);

    // Step 1: Scrape Amazon product
    reportProgress(config.onProgress, 'scraping', 10, 'Scraping product information');
    timings.scraping = { start: Date.now() };
    
    const productData = await scrapeAmazonProduct(productUrl);
    
    timings.scraping.end = Date.now();
    console.log(`✅ Product scraped: ${productData.title}`);

    if (!productData.images || productData.images.length === 0) {
      throw new Error('No product images found');
    }

    // Step 2: Download images
    reportProgress(config.onProgress, 'imageDownload', 25, 'Downloading product images');
    timings.imageDownload = { start: Date.now() };
    
    const imagesToDownload = productData.images.slice(0, config.maxImages);
    const imagePaths = await downloadImages(imagesToDownload, config.tempDir, 3, { sessionId });
    
    timings.imageDownload.end = Date.now();
    tempFiles.push(...imagePaths);

    if (imagePaths.length === 0) {
      throw new Error('No images were downloaded successfully');
    }

    console.log(`✅ Downloaded ${imagePaths.length} images`);

    // Step 3: Generate AI-powered review script
    reportProgress(config.onProgress, 'scriptGeneration', 35, 'Generating AI review script');
    timings.scriptGeneration = { start: Date.now() };
    
    const voiceoverText = await generateAIReviewScript(productData, {
      reviewStyle: 'conversational',
      temperature: 0.7
    });
    
    timings.scriptGeneration.end = Date.now();
    console.log(`✅ AI script generated: ${voiceoverText.length} characters`);

    // Step 4: Generate voiceover
    reportProgress(config.onProgress, 'voiceoverGeneration', 50, 'Generating AI voiceover');
    timings.voiceoverGeneration = { start: Date.now() };
    
    const voiceoverPath = await generateVoiceover(
      voiceoverText,
      voiceoverPaths.paths.main,
      undefined, // Use default voice settings
      config.voiceGender
    );
    
    // Store the selected voice ID for consistency across all voiceovers
    if (!config.selectedVoiceId) {
      const { getRandomVoice } = await import('./voiceover-generator.js');
      config.selectedVoiceId = getRandomVoice();
      console.log(`🎤 Voice selected for consistency: ${config.selectedVoiceId}`);
    }
    
    timings.voiceoverGeneration.end = Date.now();
    tempFiles.push(voiceoverPath);
    console.log(`✅ Voiceover generated: ${voiceoverPath}`);

    // Step 5: Generate AI-optimized video title
    reportProgress(config.onProgress, 'titleGeneration', 60, 'Generating AI-optimized video title');
    timings.titleGeneration = { start: Date.now() };
    
    const videoTitle = await generateAIVideoTitle(productData, {
      temperature: 0.8
    });
    
    timings.titleGeneration.end = Date.now();
    console.log(`✅ AI video title generated: "${videoTitle}"`);
    
    const safeFilename = generateSafeFilename(videoTitle);

    // Create output file paths with meaningful filename
    const outputPaths = createOutputFilePaths(config.outputDir, safeFilename, {
      includeShort: config.createShortVideo,
      includeThumbnails: true
    }, sessionId);

    // Step 6: Create video
    reportProgress(config.onProgress, 'videoCreation', 70, 'Creating slideshow video');
    timings.videoCreation = { start: Date.now() };
    
    // Ensure output directory exists
    await fs.mkdir(config.outputDir, { recursive: true });
    
    const videoPath = outputPaths.paths.video;
    
    console.log(`📁 Output directory: ${config.outputDir}`);
    console.log(`📄 Video filename: ${path.basename(videoPath)}`);
    
    const videoOptions = {
      quality: config.videoQuality,
      onProgress: progress => {
        const overallProgress = 70 + (progress.percent || 0) * 0.10;
        reportProgress(config.onProgress, 'videoCreation', overallProgress,
          `Creating video: ${Math.round(progress.percent || 0)}%`);
      }
    };

    let finalVideoPath;
    
    // Generate affiliate URL for use in video creation and QR codes
    const affiliateTag = process.env.AFFILIATE_TAG;
    const affiliateUrl = generateAffiliateUrl(productUrl, affiliateTag);
    
    // Use affiliate overlay video creation if enabled
    if (config.enableAffiliateOverlay) {
      console.log('🎯 Creating video with affiliate overlay...');
      
      const productDataForOverlay = {
        affiliateUrl,
        title: productData.title,
        price: productData.price || 'Check Amazon for current price'
      };
      
      finalVideoPath = await createVideoWithAffiliateOverlay(
        imagePaths,
        voiceoverPath,
        videoPath,
        productDataForOverlay,
        {
          ...videoOptions,
          overlayOptions: {
            position: 'bottom',
            startTime: 15,
            duration: 8,
            fontSize: 28,
            backgroundColor: 'black@0.8',
            textColor: 'white'
          }
        }
      );
    } else {
      console.log(`🎬 Creating slideshow with QR code outro options:`);
      console.log(`   enableIntroOutro: ${config.enableIntroOutro}`);
      console.log(`   amazonUrl: ${affiliateUrl}`);
      console.log(`   introOutroOptions:`, JSON.stringify(config.introOutroOptions || {}, null, 2));
      
      finalVideoPath = await createSlideshow(
        imagePaths,
        voiceoverPath,
        videoPath,
        {
          ...videoOptions,
          enableBackgroundMusic: config.enableBackgroundMusic,
          enableIntroOutro: config.enableIntroOutro,
          introOutroOptions: config.introOutroOptions || {},
          amazonUrl: affiliateUrl, // Pass Amazon URL for QR code generation
          selectedVoiceId: config.selectedVoiceId, // Pass voice ID for consistency
          voiceGender: config.voiceGender // Pass voice gender for consistency
        }
      );
    }
    
    timings.videoCreation.end = Date.now();
    console.log(`✅ Video created: ${finalVideoPath}`);

    // Step 6.5: Create short video for social media (if enabled)
    let shortVideoPath = null;
    let shortVoiceoverPath = null;
    if (config.createShortVideo) {
      reportProgress(config.onProgress, 'shortVideoCreation', 75, 'Creating short video for social media');
      timings.shortVideoCreation = { start: Date.now() };
      
      try {
        // Generate short video script (~30 seconds)
        console.log('📱 Generating short video script...');
        const shortVideoScript = await generateAIShortVideoScript(productData, {
          targetDuration: 30,
          temperature: 0.8
        });
        console.log(`✅ Short video script generated: ${shortVideoScript.length} characters`);
        
        // Generate short video voiceover with unique naming
        console.log('🎤 Generating short video voiceover...');
        shortVoiceoverPath = await generateVoiceover(
          shortVideoScript,
          voiceoverPaths.paths.short,
          undefined, // Use default voice settings
          config.voiceGender,
          config.selectedVoiceId // Use the same voice as main video
        );
        tempFiles.push(shortVoiceoverPath);
        console.log(`✅ Short video voiceover generated: ${shortVoiceoverPath}`);
        
        // Create short video
        shortVideoPath = outputPaths.paths.shortVideo;
        
        console.log(`📱 Creating short video: ${path.basename(shortVideoPath)}`);
        
        const shortVideoOptions = {
          resolution: '1080x1920', // Vertical format for mobile
          quality: config.videoQuality,
          onProgress: progress => {
            const overallProgress = 75 + (progress.percent || 0) * 0.05;
            reportProgress(config.onProgress, 'shortVideoCreation', overallProgress,
              `Creating short video: ${Math.round(progress.percent || 0)}%`);
          }
        };

        // Use the same images for both videos (the original downloaded images)
        console.log(`📱 Using original images for short video (same as main video)`);
        
        console.log(`📱 Creating short video with QR code outro options:`);
        console.log(`   enableIntroOutro: ${config.enableIntroOutro}`);
        console.log(`   amazonUrl: ${affiliateUrl}`);
        console.log(`   introOutroOptions:`, JSON.stringify(config.introOutroOptions || {}, null, 2));
        
        shortVideoPath = await createShortVideo(
          imagePaths,
          shortVoiceoverPath,
          shortVideoPath,
          {
            ...shortVideoOptions,
            enableBackgroundMusic: config.enableBackgroundMusic,
            enableIntroOutro: config.enableIntroOutro,
            introOutroOptions: config.introOutroOptions || {},
            amazonUrl: affiliateUrl, // Pass Amazon URL for QR code generation
            selectedVoiceId: config.selectedVoiceId, // Pass voice ID for consistency
            voiceGender: config.voiceGender // Pass voice gender for consistency
          }
        );
        
        timings.shortVideoCreation.end = Date.now();
        console.log(`✅ Short video created: ${shortVideoPath}`);
        
        // Note: Short video thumbnail and descriptions will be created after the main video description is generated
        
      } catch (error) {
        console.warn(`⚠️ Short video creation failed: ${error.message}`);
        console.log('📹 Continuing with main video only...');
        shortVideoPath = null;
        shortVoiceoverPath = null;
        timings.shortVideoCreation = { start: timings.shortVideoCreation.start, end: Date.now() };
      }
    }

    // Play notification beep for ALL video generation completion
    // This happens after both main video and short video (if enabled) are created
    await videoCompletionBeep();

    // Step 7: Create thumbnail
    reportProgress(config.onProgress, 'thumbnailCreation', 82, 'Creating YouTube thumbnail');
    timings.thumbnailCreation = { start: Date.now() };
    
    const thumbnailPath = outputPaths.paths.thumbnail;
    let finalThumbnailPath = null;
    let promotionThumbnailPath = null;
    
    try {
      finalThumbnailPath = await createThumbnail(
        productData,
        thumbnailPath,
        {
          tempDir: config.tempDir,
          sessionId: sessionId
        }
      );
      
      // Only create PNG version if promotion is enabled
      if (finalThumbnailPath && config.autoPromote) {
        try {
          // Import sharp for image conversion
          const sharp = (await import('sharp')).default;
          promotionThumbnailPath = `${config.outputDir}/${safeFilename}-${sessionId}.png`;
          
          await sharp(finalThumbnailPath)
            .png()
            .toFile(promotionThumbnailPath);
          
          console.log(`✅ Promotion thumbnail created: ${promotionThumbnailPath}`);
        } catch (conversionError) {
          console.warn(`⚠️ Failed to create PNG thumbnail for promotions: ${conversionError.message}`);
          promotionThumbnailPath = null;
        }
      }
      
      timings.thumbnailCreation.end = Date.now();
      console.log(`✅ Thumbnail created: ${finalThumbnailPath}`);
    } catch (error) {
      console.warn(`⚠️ Thumbnail creation failed: ${error.message}`);
      console.log('📹 Continuing without custom thumbnail...');
      timings.thumbnailCreation = { start: timings.thumbnailCreation.start, end: Date.now() };
    }

    // Step 8: Generate AI-optimized video description
    reportProgress(config.onProgress, 'descriptionGeneration', 84, 'Generating AI-optimized video description');
    timings.descriptionGeneration = { start: Date.now() };
    
    const baseVideoDescription = await generateAIVideoDescription(productData, videoTitle, {
      temperature: 0.7,
      includeTimestamps: true,
      includeHashtags: true
    });
    
    // Build complete description with affiliate link
    const videoDescription = buildCompleteDescription(baseVideoDescription, productUrl, affiliateTag);
    
    timings.descriptionGeneration.end = Date.now();
    console.log(`✅ AI video description generated (${videoDescription.length} characters)`);

    // Step 9: Save video description to file
    reportProgress(config.onProgress, 'descriptionSaving', 86, 'Saving video description to file');
    let descriptionFilePath = null;
    
    try {
      const descriptionResult = await writeVideoDescription(
        videoDescription,
        videoTitle,
        config.outputDir
      );
      descriptionFilePath = descriptionResult.filePath;
      console.log(`✅ Video description saved: ${descriptionResult.filename}`);
    } catch (error) {
      console.warn(`⚠️ Failed to save video description: ${error.message}`);
      console.log('📹 Continuing...');
    }

    // Step 9.5: Create short video files (thumbnail and descriptions) if short video was created
    if (shortVideoPath) {
      reportProgress(config.onProgress, 'shortVideoFiles', 88, 'Creating short video thumbnail and descriptions');
      
      // Create short video thumbnail
      try {
        const shortThumbnailPath = outputPaths.paths.shortThumbnail;
        const shortThumbnailResult = await createThumbnail(
          productData,
          shortThumbnailPath,
          {
            isVertical: true,
            tempDir: config.tempDir,
            sessionId: sessionId
          }
        );
        console.log(`✅ Short video thumbnail created: ${shortThumbnailResult}`);
      } catch (error) {
        console.warn(`⚠️ Short video thumbnail creation failed: ${error.message}`);
      }
      
      // Create short video descriptions
      try {
        const shortDescriptionResult = await writeVideoDescription(
          videoDescription,
          `${videoTitle} - Short`,
          config.outputDir,
          {
            filenameSuffix: '-short',
            isShortVideo: true
          }
        );
        console.log(`✅ Short video descriptions created: ${shortDescriptionResult.filename}`);
      } catch (error) {
        console.warn(`⚠️ Short video description creation failed: ${error.message}`);
      }
    }

    // Step 10: Review video before upload
    reportProgress(config.onProgress, 'review', 87, 'Video ready for review');
    
    console.log('\n🎬 Video creation completed successfully!');
    console.log('📹 Video details:');
    console.log(`   📁 Full video: ${finalVideoPath}`);
    if (shortVideoPath) {
      console.log(`   📱 Short video: ${shortVideoPath}`);
    }
    console.log(`   📏 Title: ${videoTitle}`);
    console.log(`   ⏱️ Duration: ~${Math.round(timings.videoCreation.end - timings.videoCreation.start) / 1000}s to create`);
    
    // Get video file stats
    try {
      const videoStats = await fs.stat(finalVideoPath);
      const videoSizeMB = Math.round(videoStats.size / (1024 * 1024) * 10) / 10;
      console.log(`   📊 Full video size: ${videoSizeMB}MB`);
      
      if (shortVideoPath) {
        const shortVideoStats = await fs.stat(shortVideoPath);
        const shortVideoSizeMB = Math.round(shortVideoStats.size / (1024 * 1024) * 10) / 10;
        console.log(`   📊 Short video size: ${shortVideoSizeMB}MB`);
      }
    } catch (error) {
      console.log('   📊 File size: Unable to determine');
    }
    
    console.log('\n🔍 Please review your video before uploading to YouTube:');
    console.log(`   🎥 Local file: ${finalVideoPath}`);
    console.log('   💡 You can open this file in any video player to preview it');
    
    // Prompt user for upload confirmation
    const shouldUpload = await promptUserConfirmation(
      '\n📤 Do you want to upload this video to YouTube now?',
      config.autoUpload
    );
    
    if (shouldUpload) {
      // Step 11: Upload to YouTube
      reportProgress(config.onProgress, 'youtubeUpload', 90, 'Uploading to YouTube');
      timings.youtubeUpload = { start: Date.now() };
      
      // Use clean description for YouTube (read from .txt file if available)
      let youtubeDescription = videoDescription;
      if (descriptionFilePath) {
        try {
          // Read the clean .txt version for YouTube
          const txtFilePath = descriptionFilePath.replace('.md', '.txt');
          const txtContent = await fs.readFile(txtFilePath, 'utf-8');
          const lines = txtContent.split('\n');
          youtubeDescription = lines.slice(1).join('\n').trim(); // Skip title line
        } catch (error) {
          console.warn('⚠️ Could not read clean description file, using original');
        }
      }

      let uploadResult;

      // Check if we should upload both videos (when short video exists and dual publishing is enabled)
      if (shortVideoPath && config.publishBothVideos) {
        console.log('🎬 Dual video upload enabled - uploading both long and short videos');
        
        const dualUploadOptions = {
          thumbnailPath: finalThumbnailPath,
          shortThumbnailPath: shortVideoPath ? outputPaths.paths.shortThumbnail : null,
          tags: ['Amazon', 'Affiliate', 'Review'],
          categoryId: '26',
          privacyStatus: 'public',
          onProgress: progress => {
            const overallProgress = 90 + (progress.percent || 0) * 0.10;
            reportProgress(config.onProgress, 'youtubeUpload', overallProgress,
              progress.message || `Uploading: ${Math.round(progress.percent || 0)}%`);
          }
        };

        uploadResult = await uploadBothVideosToYouTube(
          finalVideoPath,
          shortVideoPath,
          videoTitle,
          youtubeDescription,
          productUrl,
          dualUploadOptions
        );
        
        timings.youtubeUpload.end = Date.now();
        
        if (uploadResult.success) {
          if (uploadResult.longVideo && uploadResult.shortVideo) {
            console.log(`✅ Both videos uploaded successfully!`);
            console.log(`📹 Long video: ${uploadResult.longVideo.url}`);
            console.log(`📱 Short video: ${uploadResult.shortVideo.url}`);
          } else if (uploadResult.longVideo) {
            console.log(`✅ Long video uploaded: ${uploadResult.longVideo.url}`);
            console.warn('⚠️ Short video upload failed');
          } else if (uploadResult.shortVideo) {
            console.log(`✅ Short video uploaded: ${uploadResult.shortVideo.url}`);
            console.warn('⚠️ Long video upload failed');
          }
        } else {
          throw new Error('Both video uploads failed');
        }
      } else {
        // Single video upload (original behavior)
        const uploadOptions = {
          thumbnailPath: finalThumbnailPath,
          onProgress: progress => {
            const overallProgress = 90 + (progress.percent || 0) * 0.10;
            reportProgress(config.onProgress, 'youtubeUpload', overallProgress,
              `Uploading: ${Math.round(progress.percent || 0)}%`);
          }
        };

        uploadResult = await uploadToYouTube(
          finalVideoPath,
          videoTitle,
          youtubeDescription,
          productUrl,
          uploadOptions
        );
        
        timings.youtubeUpload.end = Date.now();
        console.log(`✅ Video uploaded to YouTube: ${uploadResult.url}`);
      }

      // Step 11.5: Setup interactive elements (if enabled)
      if (config.setupInteractiveElements && uploadResult.videoId) {
        reportProgress(config.onProgress, 'interactiveElements', 92, 'Setting up YouTube interactive elements');
        
        try {
          console.log('\n🎯 Setting up YouTube interactive elements...');
          const interactiveAffiliateUrl = generateAffiliateUrl(productUrl, affiliateTag);
          
          const productDataForInteractive = {
            affiliateUrl: interactiveAffiliateUrl,
            title: productData.title,
            price: productData.price || 'Check Amazon for current price'
          };
          
          const interactiveResult = await addCompleteInteractiveElements(
            uploadResult.videoId,
            productDataForInteractive,
            {
              cardStartTime: 20,
              endScreenDuration: 15,
              includeCards: true,
              includeEndScreen: true
            }
          );
          
          if (interactiveResult.success) {
            console.log('✅ Interactive elements configuration prepared');
            console.log('📋 Manual setup required in YouTube Studio:');
            interactiveResult.instructions.forEach((instruction, index) => {
              console.log(`   ${index + 1}. ${instruction}`);
            });
          }
        } catch (error) {
          console.warn(`⚠️ Interactive elements setup failed: ${error.message}`);
          console.log('📹 Video was uploaded successfully, but interactive elements need manual setup');
        }
      }
      
      // Step 11: Promote video (if enabled)
      let promotionResults = null;
      if (config.autoPromote) {
        const shouldPromote = await promptUserConfirmation(
          '\n📢 Do you want to promote this video on social media now?',
          config.autoPromote
        );
        
        if (shouldPromote) {
          reportProgress(config.onProgress, 'promotion', 95, 'Promoting video on social media');
          timings.promotion = { start: Date.now() };
          
          try {
            console.log('\n🚀 Starting social media promotion...');
            
            const promotionManager = new PromotionManager({
              headless: config.headless ?? false, // Show browser windows by default for easier login
              enabledPlatforms: config.promotionPlatforms
            });
            
            // Extract tags from product data for better targeting
            const tags = [
              ...productData.title.toLowerCase().split(' ').filter(word => word.length > 3),
              'review', 'amazon', 'product'
            ].slice(0, 10);
            
            const promotionData = {
              title: videoTitle,
              url: uploadResult.url,
              description: videoDescription,
              tags,
              thumbnailPath: finalThumbnailPath
            };
            
            promotionResults = await promotionManager.promoteVideo(promotionData);
            
            timings.promotion.end = Date.now();
            
            const successfulPromotions = promotionResults.filter(r => r.success).length;
            console.log(`✅ Promotion completed: ${successfulPromotions}/${promotionResults.length} platforms successful`);
            
            // Display promotion results
            promotionResults.forEach(result => {
              if (result.success) {
                console.log(`   ✅ ${result.platform.toUpperCase()}: Promoted successfully`);
              } else {
                console.log(`   ❌ ${result.platform.toUpperCase()}: ${result.error}`);
              }
            });
            
          } catch (error) {
            console.warn(`⚠️ Promotion failed: ${error.message}`);
            console.log('📹 Video was uploaded successfully, but promotion encountered issues');
            timings.promotion = { start: timings.promotion.start, end: Date.now() };
          }
        } else {
          console.log('\n⏸️ Promotion skipped by user choice');
          console.log('💡 You can promote your video later using: node src/promotion-cli.js promote');
        }
      }
      
      // Return success result with YouTube URL(s)
      const successResult = {
        success: true,
        productTitle: productData.title,
        videoTitle,
        timing: createTimingInfo(timings),
        promotionResults,
        files: {
          images: imagePaths,
          voiceover: voiceoverPath,
          video: finalVideoPath,
          shortVideo: shortVideoPath,
          thumbnail: finalThumbnailPath,
          promotionThumbnail: promotionThumbnailPath,
          description: descriptionFilePath
        },
        stats: {
          imagesDownloaded: imagePaths.length,
          totalImages: productData.images.length,
          videoSize: await fs.stat(finalVideoPath).then(s => s.size).catch(() => 0)
        }
      };

      // Handle dual upload results
      if (uploadResult.longVideo || uploadResult.shortVideo) {
        // Dual upload result
        successResult.dualUpload = true;
        successResult.longVideo = uploadResult.longVideo;
        successResult.shortVideo = uploadResult.shortVideo;
        successResult.youtubeUrl = uploadResult.longVideo?.url || uploadResult.shortVideo?.url;
        successResult.videoId = uploadResult.longVideo?.videoId || uploadResult.shortVideo?.videoId;
      } else {
        // Single upload result
        successResult.dualUpload = false;
        successResult.videoId = uploadResult.videoId;
        successResult.youtubeUrl = uploadResult.url;
      }
      
      // Cleanup temporary files (after all video creation is complete)
      if (config.cleanup) {
        reportProgress(config.onProgress, 'cleanup', 98, 'Cleaning up temporary files');
        await cleanupImages(tempFiles);
        console.log('✅ Temporary files cleaned up');
      }

      reportProgress(config.onProgress, 'complete', 100, 'Video creation and upload completed successfully');
      return successResult;
      
    } else {
      console.log('\n⏸️ Upload skipped by user choice');
      console.log('💡 Your video is ready and saved locally');
      console.log('📤 You can upload it manually to YouTube later');
      
      // Return success result without YouTube URL
      const localResult = {
        success: true,
        skippedUpload: true,
        productTitle: productData.title,
        videoTitle,
        timing: createTimingInfo(timings),
        files: {
          images: imagePaths,
          voiceover: voiceoverPath,
          shortVoiceover: shortVoiceoverPath,
          video: finalVideoPath,
          shortVideo: shortVideoPath,
          thumbnail: finalThumbnailPath,
          shortThumbnail: shortVideoPath ? outputPaths.paths.shortThumbnail : null,
          promotionThumbnail: promotionThumbnailPath,
          description: descriptionFilePath,
          shortDescription: shortVideoPath ? `${config.outputDir}/${path.basename(shortVideoPath, '.mp4')}.md` : null
        },
        stats: {
          imagesDownloaded: imagePaths.length,
          totalImages: productData.images.length,
          videoSize: await fs.stat(finalVideoPath).then(s => s.size).catch(() => 0)
        }
      };
      
      // Cleanup temporary files (after all video creation is complete)
      if (config.cleanup) {
        reportProgress(config.onProgress, 'cleanup', 98, 'Cleaning up temporary files');
        await cleanupImages(tempFiles);
        console.log('✅ Temporary files cleaned up');
      }

      reportProgress(config.onProgress, 'complete', 100, 'Video creation completed successfully');
      return localResult;
    }

  } catch (error) {
    console.error('❌ Video creation failed:', error.message);

    // Cleanup on failure
    if (config.cleanup && tempFiles.length > 0) {
      try {
        await cleanupImages(tempFiles);
        console.log('🧹 Cleaned up temporary files after failure');
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temporary files:', cleanupError.message);
      }
    }

    reportProgress(config.onProgress, 'error', 0, `Error: ${error.message}`);

    return {
      success: false,
      error: error.message,
      timing: Object.keys(timings).length > 0 ? createTimingInfo(timings) : null,
      files: {
        images: tempFiles.filter(f => f.includes('image')),
        voiceover: tempFiles.find(f => f.includes('voiceover')) || null,
        video: null
      }
    };
  }
};

/**
 * CLI interface for running the application
 * @param {string[]} args - Command line arguments
 */
export const runCLI = async (args = process.argv.slice(2)) => {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🎬 Amazon Affiliate Video Automation

Usage: node src/index.js <amazon-product-url-or-id> [options]

Input:
  <amazon-product-url-or-id>  Either a full Amazon URL or just the product ID
                              Examples:
                                • https://www.amazon.com/dp/B0CPZKLJX1
                                • B0CPZKLJX1

Options:
  --max-images <number>     Maximum number of images to download (default: 5)
  --quality <level>         Video quality: low, medium, high, ultra (default: medium)
  --temp-dir <path>         Temporary directory (default: ./temp)
  --output-dir <path>       Output directory (default: ./output)
  --no-cleanup             Don't cleanup temporary files
  --auto-upload            Automatically upload to YouTube without confirmation
  --auto-promote           Automatically promote video on social media after upload
  --promotion-platforms    Comma-separated list of platforms (reddit,pinterest,twitter,x,tiktok)
  --create-short-video     Create a 30-second short video for social media (default: true)
  --no-short-video         Disable short video creation
  --publish-both-videos    Publish both long and short videos to YouTube (default: true)
  --no-dual-publish        Disable dual publishing (upload only long video)
  --woman                  Use female voice for voiceover generation
  --man                    Use male voice for voiceover generation
  --affiliate-overlay      Add affiliate text overlay burned into the video
  --interactive-elements   Setup YouTube Cards and End Screens (requires manual completion)

Examples:
  # Using full URL
  node src/index.js "https://www.amazon.com/dp/B08N5WRWNW" --quality high --max-images 3
  
  # Using just product ID (much easier!)
  node src/index.js "B0CPZKLJX1" --auto-upload --auto-promote
  
  # Product ID with specific platforms
  node src/index.js "B08N5WRWNW" --promotion-platforms "reddit,x,tiktok"
  
  # Create both full video and 30s short video for social media
  node src/index.js "B0CPZKLJX1" --create-short-video
  
  # Disable short video creation (only create full video)
  node src/index.js "B08N5WRWNW" --no-short-video
    `);
    process.exit(1);
  }

  const productInput = args[0];
  const options = {};

  // Parse command line options
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--max-images':
        options.maxImages = parseInt(value, 10);
        break;
      case '--quality':
        options.videoQuality = value;
        break;
      case '--temp-dir':
        options.tempDir = value;
        break;
      case '--output-dir':
        options.outputDir = value;
        break;
      case '--no-cleanup':
        options.cleanup = false;
        i--; // No value for this flag
        break;
      case '--auto-upload':
        options.autoUpload = true;
        i--; // No value for this flag
        break;
      case '--auto-promote':
        options.autoPromote = true;
        i--; // No value for this flag
        break;
      case '--promotion-platforms':
        options.promotionPlatforms = value ? value.split(',').map(p => p.trim()) : [];
        break;
      case '--create-short-video':
        options.createShortVideo = true;
        i--; // No value for this flag
        break;
      case '--no-short-video':
        options.createShortVideo = false;
        i--; // No value for this flag
        break;
      case '--publish-both-videos':
        options.publishBothVideos = true;
        i--; // No value for this flag
        break;
      case '--no-dual-publish':
        options.publishBothVideos = false;
        i--; // No value for this flag
        break;
      case '--woman':
        options.voiceGender = 'female';
        i--; // No value for this flag
        break;
      case '--man':
      case '--male':
        options.voiceGender = 'male';
        i--; // No value for this flag
        break;
      case '--affiliate-overlay':
        options.enableAffiliateOverlay = true;
        i--; // No value for this flag
        break;
      case '--interactive-elements':
        options.setupInteractiveElements = true;
        i--; // No value for this flag
        break;
    }
  }

  // Add progress reporting
  options.onProgress = progress => {
    const bar = '█'.repeat(Math.floor(progress.progress / 5)) + 
                '░'.repeat(20 - Math.floor(progress.progress / 5));
    console.log(`[${bar}] ${progress.progress}% - ${progress.step}: ${progress.message}`);
  };

  try {
    const result = await createAffiliateVideo(productInput, options);
    
    if (result.success) {
      if (result.youtubeUrl) {
        console.log('\n🎉 Success! Video created and uploaded to YouTube');
        console.log(`📺 YouTube URL: ${result.youtubeUrl}`);
      } else if (result.skippedUpload) {
        console.log('\n✅ Success! Video created successfully');
        console.log('⏸️ YouTube upload was skipped by user choice');
        console.log(`📁 Video saved locally: ${result.files.video}`);
        
        // Play notification beep for YouTube ready
        youtubeReadyBeep();
      } else {
        console.log('\n✅ Success! Video created successfully');
        console.log(`📁 Video saved locally: ${result.files.video}`);
        console.log('📤 Ready for YouTube upload!');
        
        // Play notification beep for YouTube ready
        youtubeReadyBeep();
      }
      console.log(`⏱️  Total time: ${Math.round(result.timing.totalDuration / 1000)}s`);
    } else {
      console.error('\n❌ Failed to create video:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Unexpected error:', error.message);
    process.exit(1);
  }
};

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI();
}