import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { createStylishThumbnail, generateThumbnailTitle, isImageMagickAvailable } from './image-processor.js';

/**
 * Select the highest quality image from an array of image URLs
 * Prioritizes images with quality indicators like _SL1200_, _AC_SL1200_, etc.
 * @param {string[]} imageUrls - Array of image URLs
 * @returns {string} The highest quality image URL
 */
function selectBestQualityImage(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No image URLs provided');
  }

  // Quality indicators in order of preference (highest to lowest)
  const qualityIndicators = [
    '_SL1500_',
    '_AC_SL1500_',
    '_SL1200_',
    '_AC_SL1200_',
    '_SL1000_',
    '_AC_SL1000_',
    '_SL800_',
    '_AC_SL800_',
    '_SL600_',
    '_AC_SL600_',
    '_SL500_',
    '_AC_SL500_',
    '_SL400_',
    '_AC_SL400_'
  ];

  // First, try to find images with quality indicators
  for (const indicator of qualityIndicators) {
    const matchingImage = imageUrls.find(url => url.includes(indicator));
    if (matchingImage) {
      console.log(`🎯 Selected high-quality image with indicator ${indicator}: ${matchingImage}`);
      return matchingImage;
    }
  }

  // If no quality indicators found, prefer longer URLs (often contain more parameters)
  const sortedByLength = [...imageUrls].sort((a, b) => b.length - a.length);
  console.log(`📸 Selected image by URL length: ${sortedByLength[0]}`);
  return sortedByLength[0];
}

/**
 * Utility to generate thumbnails for existing videos that don't have them
 */
export class ThumbnailGenerator {
  constructor(config = {}) {
    this.outputDir = config.outputDir || './output';
    this.tempDir = config.tempDir || './temp';
  }

  /**
   * Scan for videos without thumbnails
   */
  async scanForVideosWithoutThumbnails() {
    try {
      const files = await fs.readdir(this.outputDir);
      const videoFiles = files.filter(file => 
        file.endsWith('.mp4') || file.endsWith('.mov') || file.endsWith('.avi')
      );
      
      const videosNeedingThumbnails = [];
      
      for (const videoFile of videoFiles) {
        const baseName = path.parse(videoFile).name;
        const videoPath = path.join(this.outputDir, videoFile);
        
        // Check if thumbnails already exist
        const possibleThumbnails = [
          `${baseName}-thumbnail.jpg`,
          `${baseName}-thumbnail.png`,
          `${baseName}.jpg`,
          `${baseName}.png`
        ];
        
        let hasThumbnail = false;
        for (const thumbName of possibleThumbnails) {
          const thumbPath = path.join(this.outputDir, thumbName);
          try {
            await fs.access(thumbPath);
            hasThumbnail = true;
            break;
          } catch {
            // Thumbnail doesn't exist, continue
          }
        }
        
        if (!hasThumbnail) {
          videosNeedingThumbnails.push({
            filename: videoFile,
            path: videoPath,
            baseName
          });
        }
      }
      
      return videosNeedingThumbnails;
    } catch (error) {
      console.error(`Failed to scan for videos: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract frame from video using ffmpeg
   */
  async extractFrameFromVideo(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(2) // Seek to 2 seconds to avoid black frames
        .frames(1)
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Frame extracted: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (error) => {
          console.error(`❌ Failed to extract frame: ${error.message}`);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Create YouTube-style thumbnail (1280x720)
   */
  async createYouTubeThumbnail(framePath, outputPath) {
    try {
      await sharp(framePath)
        .resize(1280, 720, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      
      console.log(`✅ YouTube thumbnail created: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`❌ Failed to create YouTube thumbnail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create Pinterest-style thumbnail (1000x1500)
   */
  async createPinterestThumbnail(framePath, outputPath) {
    try {
      await sharp(framePath)
        .resize(1000, 1500, {
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 90 })
        .toFile(outputPath);
      
      console.log(`✅ Pinterest thumbnail created: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`❌ Failed to create Pinterest thumbnail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate thumbnails for a single video
   */
  async generateThumbnailsForVideo(video) {
    try {
      console.log(`🎬 Processing: ${video.filename}`);
      
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Extract frame from video
      const tempFramePath = path.join(this.tempDir, `frame-${video.baseName}.jpg`);
      await this.extractFrameFromVideo(video.path, tempFramePath);
      
      // Create YouTube thumbnail (JPG)
      const youtubeThumbnailPath = path.join(this.outputDir, `${video.baseName}-thumbnail.jpg`);
      await this.createYouTubeThumbnail(tempFramePath, youtubeThumbnailPath);
      
      // Create Pinterest thumbnail (PNG)
      const pinterestThumbnailPath = path.join(this.outputDir, `${video.baseName}.png`);
      await this.createPinterestThumbnail(tempFramePath, pinterestThumbnailPath);
      
      // Cleanup temp frame
      try {
        await fs.unlink(tempFramePath);
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup temp frame: ${error.message}`);
      }
      
      return {
        success: true,
        youtubeThumbnail: youtubeThumbnailPath,
        pinterestThumbnail: pinterestThumbnailPath
      };
      
    } catch (error) {
      console.error(`❌ Failed to generate thumbnails for ${video.filename}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate thumbnails for all videos that need them
   */
  async generateMissingThumbnails() {
    try {
      console.log('🔍 Scanning for videos without thumbnails...');
      
      const videosNeedingThumbnails = await this.scanForVideosWithoutThumbnails();
      
      if (videosNeedingThumbnails.length === 0) {
        console.log('✅ All videos already have thumbnails!');
        return { success: true, processed: 0 };
      }
      
      console.log(`📹 Found ${videosNeedingThumbnails.length} videos needing thumbnails:`);
      videosNeedingThumbnails.forEach(video => {
        console.log(`   - ${video.filename}`);
      });
      
      const results = [];
      
      for (const video of videosNeedingThumbnails) {
        const result = await this.generateThumbnailsForVideo(video);
        results.push({
          video: video.filename,
          ...result
        });
        
        // Small delay between processing
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      
      console.log('\n📊 Thumbnail Generation Results:');
      console.log('='.repeat(40));
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      
      if (failed > 0) {
        console.log('\n❌ Failed videos:');
        results.filter(r => !r.success).forEach(result => {
          console.log(`   - ${result.video}: ${result.error}`);
        });
      }
      
      return {
        success: successful > 0,
        processed: successful,
        failed,
        results
      };
      
    } catch (error) {
      console.error(`❌ Thumbnail generation failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Create a vertical thumbnail for short videos (1080x1920)
 */
async function createVerticalThumbnail(framePath, outputPath) {
  try {
    await sharp(framePath)
      .resize(1080, 1920, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);
    
    console.log(`✅ Vertical thumbnail created: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`❌ Failed to create vertical thumbnail: ${error.message}`);
    throw error;
  }
}

/**
 * Create a thumbnail from product data (for use in main video creation flow)
 * @param {Object} productData - Product data containing images and title
 * @param {string} outputPath - Path where thumbnail should be saved
 * @param {Object} options - Options for thumbnail creation
 * @param {boolean} options.isVertical - Whether to create vertical format (1080x1920) for short videos
 * @param {string} options.tempDir - Temporary directory to use (defaults to './temp')
 * @param {string} options.sessionId - Session ID for finding session-specific files
 * @returns {Promise<string>} - Path to created thumbnail
 */
export const createThumbnail = async (productData, outputPath, options = {}) => {
  try {
    // Check if ImageMagick is available for stylish thumbnails
    const magickAvailable = await isImageMagickAvailable();
    
    // Use provided temp directory or default
    const tempDir = options.tempDir || './temp';
    const sessionId = options.sessionId;
    await fs.mkdir(tempDir, { recursive: true });
    
    let sourceImagePath = null;
    
    // Try to find an existing downloaded image
    // If we have a session ID, look for session-specific files first
    const possibleImages = [];
    
    if (sessionId) {
      // Look for session-specific image files first
      for (let i = 1; i <= 5; i++) {
        possibleImages.push(path.join(tempDir, `image-${i}-${sessionId}.jpg`));
      }
      // Also check for other session-specific files
      possibleImages.push(
        path.join(tempDir, `thumbnail-product-image-${sessionId}.jpg`),
        path.join(tempDir, `test-image-${sessionId}.png`),
        path.join(tempDir, `test-image-1-${sessionId}.png`)
      );
    }
    
    // Fallback to non-session-specific files
    possibleImages.push(
      path.join(tempDir, 'image-1.jpg'),
      path.join(tempDir, 'image-2.jpg'),
      path.join(tempDir, 'image-3.jpg'),
      path.join(tempDir, 'thumbnail-product-image.jpg'),
      path.join(tempDir, 'test-image.png'),
      path.join(tempDir, 'test-image-1.png')
    );
    
    for (const imagePath of possibleImages) {
      try {
        await fs.access(imagePath);
        sourceImagePath = imagePath;
        console.log(`📸 Using existing image for thumbnail: ${imagePath}`);
        break;
      } catch {
        // Image doesn't exist, continue
      }
    }
    
    // If no existing image found, try to download from product data
    if (!sourceImagePath) {
      if (!productData.images || productData.images.length === 0) {
        throw new Error('No product images available for thumbnail creation');
      }

      // Select the highest quality image for thumbnail
      const bestImageUrl = selectBestQualityImage(productData.images);
      const tempImageFilename = sessionId ? `temp-thumbnail-source-${sessionId}.jpg` : 'temp-thumbnail-source.jpg';
      const tempImagePath = path.join(tempDir, tempImageFilename);
      
      console.log(`📥 Downloading high-quality image for thumbnail: ${bestImageUrl}`);
      
      // Download the image using Node.js https/http
      const { default: https } = await import('https');
      const { default: http } = await import('http');
      
      const client = bestImageUrl.startsWith('https:') ? https : http;
      
      await new Promise((resolve, reject) => {
        const request = client.get(bestImageUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download image: ${response.statusCode} ${response.statusMessage}`));
            return;
          }
          
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks);
              await fs.writeFile(tempImagePath, buffer);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        });
        
        request.on('error', reject);
        request.setTimeout(10000, () => {
          request.destroy();
          reject(new Error('Download timeout'));
        });
      });
      
      sourceImagePath = tempImagePath;
    }
    
    // Generate thumbnail title from product data
    const thumbnailTitle = generateThumbnailTitle(productData.title || 'Product Review');
    
    // Try to create stylish thumbnail with ImageMagick first
    if (magickAvailable && productData.title) {
      try {
        console.log('🎨 Creating stylish thumbnail with text overlay...');
        
        const stylishOptions = {
          width: options.isVertical ? 1080 : 1280,
          height: options.isVertical ? 1920 : 720,
          fontSize: options.isVertical ? 68 : 76,
          position: 'center',
          fontFamily: 'Poppins-ExtraBold',
          textColor: 'white',
          strokeColor: 'black',
          strokeWidth: 4,
          shadowOffset: 6,
          shadowBlur: 12,
          shadowOpacity: 0.9
        };
        
        const result = await createStylishThumbnail(
          sourceImagePath,
          thumbnailTitle,
          outputPath,
          stylishOptions
        );
        
        // Only cleanup temp image if we downloaded it (not if we used existing)
        if (sourceImagePath.includes('temp-thumbnail-source')) {
          try {
            await fs.unlink(sourceImagePath);
          } catch (error) {
            console.warn(`⚠️ Failed to cleanup temp image: ${error.message}`);
          }
        }
        
        return result;
        
      } catch (error) {
        console.warn(`⚠️ Stylish thumbnail creation failed: ${error.message}`);
        console.log('📝 Falling back to basic thumbnail...');
      }
    }
    
    // Fallback to basic thumbnail creation with Sharp
    console.log('📸 Creating basic thumbnail...');
    
    if (options.isVertical) {
      // Create vertical thumbnail for short videos (1080x1920)
      await sharp(sourceImagePath)
        .resize(1080, 1920, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      console.log(`✅ Vertical thumbnail created: ${outputPath}`);
    } else {
      // Create YouTube-style thumbnail (1280x720)
      await sharp(sourceImagePath)
        .resize(1280, 720, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      console.log(`✅ YouTube thumbnail created: ${outputPath}`);
    }
    
    // Only cleanup temp image if we downloaded it (not if we used existing)
    if (sourceImagePath.includes('temp-thumbnail-source')) {
      try {
        await fs.unlink(sourceImagePath);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup temp image: ${error.message}`);
      }
    }
    
    return outputPath;
    
  } catch (error) {
    console.error(`❌ Failed to create thumbnail: ${error.message}`);
    throw error;
  }
};

// CLI interface
async function runCLI() {
  const generator = new ThumbnailGenerator();
  await generator.generateMissingThumbnails();
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch(console.error);
}