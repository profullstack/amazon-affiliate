import 'dotenv/config';
import { scrapeAmazonProduct } from './amazon-scraper.js';
import { downloadImages, cleanupImages } from './image-downloader.js';
import { generateVoiceover } from './voiceover-generator.js';
import { generateAIReviewScript } from './openai-script-generator.js';
import { createSlideshow } from './video-creator.js';
import { createThumbnail } from './thumbnail-generator.js';
import { uploadToYouTube } from './youtube-publisher.js';
import fs from 'fs/promises';

/**
 * Default configuration options
 */
const DEFAULT_OPTIONS = {
  maxImages: 5,
  tempDir: './temp',
  outputDir: './output',
  videoQuality: 'medium',
  cleanup: true,
  onProgress: null
};

/**
 * Validates Amazon product URL
 * @param {string} url - URL to validate
 * @throws {Error} When URL is invalid
 */
const validateAmazonUrl = url => {
  if (!url || typeof url !== 'string') {
    throw new Error('Amazon product URL is required');
  }

  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('amazon.') || 
        (!url.includes('/dp/') && !url.includes('/gp/product/'))) {
      throw new Error('Invalid Amazon URL format');
    }
  } catch {
    throw new Error('Invalid Amazon URL format');
  }
};

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
 * Main function to create affiliate video from Amazon product URL
 * @param {string} productUrl - Amazon product URL
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Result object with success status and details
 */
export const createAffiliateVideo = async (productUrl, options = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const timings = {};
  let tempFiles = [];

  try {
    // Validate input
    validateAmazonUrl(productUrl);
    
    reportProgress(config.onProgress, 'validation', 5, 'Validating Amazon URL');

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
    const imagePaths = await downloadImages(imagesToDownload, config.tempDir);
    
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
      `${config.tempDir}/voiceover.mp3`
    );
    
    timings.voiceoverGeneration.end = Date.now();
    tempFiles.push(voiceoverPath);
    console.log(`✅ Voiceover generated: ${voiceoverPath}`);

    // Step 5: Create video
    reportProgress(config.onProgress, 'videoCreation', 70, 'Creating slideshow video');
    timings.videoCreation = { start: Date.now() };
    
    const videoTitle = generateVideoTitle(productData.title);
    const safeFilename = generateSafeFilename(videoTitle);
    
    // Ensure output directory exists
    await fs.mkdir(config.outputDir, { recursive: true });
    
    const videoPath = `${config.outputDir}/${safeFilename}.mp4`;
    
    console.log(`📁 Output directory: ${config.outputDir}`);
    console.log(`📄 Video filename: ${safeFilename}.mp4`);
    
    const videoOptions = {
      quality: config.videoQuality,
      onProgress: progress => {
        const overallProgress = 70 + (progress.percent || 0) * 0.10;
        reportProgress(config.onProgress, 'videoCreation', overallProgress,
          `Creating video: ${Math.round(progress.percent || 0)}%`);
      }
    };

    const finalVideoPath = await createSlideshow(
      imagePaths,
      voiceoverPath,
      videoPath,
      videoOptions
    );
    
    timings.videoCreation.end = Date.now();
    console.log(`✅ Video created: ${finalVideoPath}`);

    // Step 6: Create thumbnail
    reportProgress(config.onProgress, 'thumbnailCreation', 80, 'Creating YouTube thumbnail');
    timings.thumbnailCreation = { start: Date.now() };
    
    const thumbnailPath = `${config.outputDir}/${safeFilename}-thumbnail.jpg`;
    let finalThumbnailPath = null;
    
    try {
      finalThumbnailPath = await createThumbnail(
        productData,
        thumbnailPath
      );
      
      timings.thumbnailCreation.end = Date.now();
      console.log(`✅ Thumbnail created: ${finalThumbnailPath}`);
    } catch (error) {
      console.warn(`⚠️ Thumbnail creation failed: ${error.message}`);
      console.log('📹 Continuing without custom thumbnail...');
      timings.thumbnailCreation = { start: timings.thumbnailCreation.start, end: Date.now() };
    }

    // Step 7: Review video before upload
    reportProgress(config.onProgress, 'review', 85, 'Video ready for review');
    
    console.log('\n🎬 Video creation completed successfully!');
    console.log('📹 Video details:');
    console.log(`   📁 File: ${finalVideoPath}`);
    console.log(`   📏 Title: ${videoTitle}`);
    console.log(`   ⏱️ Duration: ~${Math.round(timings.videoCreation.end - timings.videoCreation.start) / 1000}s to create`);
    
    // Get video file stats
    try {
      const videoStats = await fs.stat(finalVideoPath);
      const videoSizeMB = Math.round(videoStats.size / (1024 * 1024) * 10) / 10;
      console.log(`   📊 File size: ${videoSizeMB}MB`);
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
      // Step 8: Upload to YouTube
      reportProgress(config.onProgress, 'youtubeUpload', 90, 'Uploading to YouTube');
      timings.youtubeUpload = { start: Date.now() };
      
      const videoDescription = generateVideoDescription(productData.description, productData.title);
      
      const uploadOptions = {
        thumbnailPath: finalThumbnailPath, // Pass thumbnail path for upload
        onProgress: progress => {
          const overallProgress = 90 + (progress.percent || 0) * 0.10;
          reportProgress(config.onProgress, 'youtubeUpload', overallProgress,
            `Uploading: ${Math.round(progress.percent || 0)}%`);
        }
      };

      const uploadResult = await uploadToYouTube(
        finalVideoPath,
        videoTitle,
        videoDescription,
        productUrl,
        uploadOptions
      );
      
      timings.youtubeUpload.end = Date.now();
      console.log(`✅ Video uploaded to YouTube: ${uploadResult.url}`);
      
      // Return success result with YouTube URL
      const successResult = {
        success: true,
        videoId: uploadResult.videoId,
        youtubeUrl: uploadResult.url,
        productTitle: productData.title,
        videoTitle,
        timing: createTimingInfo(timings),
        files: {
          images: imagePaths,
          voiceover: voiceoverPath,
          video: finalVideoPath,
          thumbnail: thumbnailPath
        },
        stats: {
          imagesDownloaded: imagePaths.length,
          totalImages: productData.images.length,
          videoSize: await fs.stat(finalVideoPath).then(s => s.size).catch(() => 0)
        }
      };
      
      // Cleanup temporary files
      if (config.cleanup) {
        reportProgress(config.onProgress, 'cleanup', 95, 'Cleaning up temporary files');
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
          video: finalVideoPath,
          thumbnail: thumbnailPath
        },
        stats: {
          imagesDownloaded: imagePaths.length,
          totalImages: productData.images.length,
          videoSize: await fs.stat(finalVideoPath).then(s => s.size).catch(() => 0)
        }
      };
      
      // Cleanup temporary files
      if (config.cleanup) {
        reportProgress(config.onProgress, 'cleanup', 95, 'Cleaning up temporary files');
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
  if (args.length === 0) {
    console.log(`
🎬 Amazon Affiliate Video Automation

Usage: node src/index.js <amazon-product-url> [options]

Options:
  --max-images <number>     Maximum number of images to download (default: 5)
  --quality <level>         Video quality: low, medium, high, ultra (default: medium)
  --temp-dir <path>         Temporary directory (default: ./temp)
  --output-dir <path>       Output directory (default: ./output)
  --no-cleanup             Don't cleanup temporary files
  --auto-upload            Automatically upload to YouTube without confirmation

Example:
  node src/index.js "https://www.amazon.com/dp/B08N5WRWNW" --quality high --max-images 3
  node src/index.js "https://www.amazon.com/dp/B08N5WRWNW" --auto-upload
    `);
    process.exit(1);
  }

  const productUrl = args[0];
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
    }
  }

  // Add progress reporting
  options.onProgress = progress => {
    const bar = '█'.repeat(Math.floor(progress.progress / 5)) + 
                '░'.repeat(20 - Math.floor(progress.progress / 5));
    console.log(`[${bar}] ${progress.progress}% - ${progress.step}: ${progress.message}`);
  };

  try {
    const result = await createAffiliateVideo(productUrl, options);
    
    if (result.success) {
      if (result.youtubeUrl) {
        console.log('\n🎉 Success! Video created and uploaded to YouTube');
        console.log(`📺 YouTube URL: ${result.youtubeUrl}`);
      } else if (result.skippedUpload) {
        console.log('\n✅ Success! Video created successfully');
        console.log('⏸️ YouTube upload was skipped by user choice');
        console.log(`📁 Video saved locally: ${result.files.video}`);
      } else {
        console.log('\n✅ Success! Video created successfully');
        console.log(`📁 Video saved locally: ${result.files.video}`);
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