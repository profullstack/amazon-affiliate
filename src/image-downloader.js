import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

/**
 * Validates if a URL is a valid HTTP/HTTPS URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid HTTP/HTTPS URL
 */
const isValidUrl = url => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Gets file extension from URL or defaults to .jpg
 * @param {string} url - The image URL
 * @returns {string} - File extension
 */
const getFileExtension = url => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const extension = path.extname(pathname).toLowerCase();
    
    // Common image extensions
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    
    return validExtensions.includes(extension) ? extension : '.jpg';
  } catch {
    return '.jpg';
  }
};

/**
 * Gets multiple quality versions of an Amazon image URL for fallback
 * @param {string} imageUrl - The original image URL
 * @returns {string[]} - Array of image URLs in different qualities (highest first)
 */
const getImageQualityVersions = imageUrl => {
  if (!imageUrl) return [];
  
  // The enhanced scraper now provides actual zoom image URLs, so use them directly
  // Only provide minimal fallback for edge cases
  return [imageUrl]; // Trust the scraper to provide the best available URLs
};

/**
 * Downloads a single image with quality fallback and retry logic
 * @param {string} url - Image URL to download
 * @param {string} filePath - Local file path to save the image
 * @param {number} retries - Number of retry attempts per quality version
 * @returns {Promise<boolean>} - True if download successful
 */
const downloadSingleImage = async (url, filePath, retries = 2) => {
  const qualityVersions = getImageQualityVersions(url);
  
  console.log(`🔍 Original URL: ${url}`);
  console.log(`🔍 Generated ${qualityVersions.length} quality versions`);
  
  // Try each quality version in order (highest to lowest)
  for (let versionIndex = 0; versionIndex < qualityVersions.length; versionIndex++) {
    const currentUrl = qualityVersions[versionIndex];
    const qualityLabel = versionIndex === 0 ? 'highest' :
                        versionIndex === 1 ? 'very high' :
                        versionIndex === 2 ? 'high' :
                        versionIndex === 3 ? 'good' :
                        versionIndex === 4 ? 'decent' : 'original';
    
    console.log(`📥 Trying ${qualityLabel} quality version: ${currentUrl}`);
    
    // Try downloading this quality version with retries
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Create a timeout promise to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000);
        });

        const fetchPromise = fetch(currentUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate minimum size (5KB for any acceptable image)
        if (buffer.length < 5120) {
          throw new Error(`Image too small: ${buffer.length} bytes`);
        }

        await fs.writeFile(filePath, buffer);
        
        console.log(`✅ Downloaded ${qualityLabel} quality image: ${Math.round(buffer.length / 1024)}KB`);
        return true;
        
      } catch (error) {
        console.warn(`Attempt ${attempt + 1}/${retries} failed for ${qualityLabel} quality: ${error.message}`);
        
        if (attempt < retries - 1) {
          // Wait before retry (shorter delay to speed up process)
          await new Promise(resolve => setTimeout(resolve, 500 + (attempt * 500)));
        }
      }
    }
    
    console.warn(`❌ All attempts failed for ${qualityLabel} quality, trying next quality level...`);
  }
  
  console.error(`❌ Failed to download any quality version of image`);
  return false;
};

/**
 * Downloads multiple images concurrently with rate limiting and quality fallback
 * @param {string[]} imageUrls - Array of image URLs to download
 * @param {string} tempDir - Directory to save downloaded images
 * @param {number} concurrency - Maximum concurrent downloads
 * @returns {Promise<string[]>} - Array of successfully downloaded file paths
 */
export const downloadImages = async (
  imageUrls = [],
  tempDir = './temp',
  concurrency = 3  // Reduced to be more respectful to servers
) => {
  if (!imageUrls || imageUrls.length === 0) {
    return [];
  }

  // Create temp directory
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create directory ${tempDir}: ${error.message}`);
  }

  // Filter valid URLs
  const validUrls = imageUrls.filter(isValidUrl);
  
  if (validUrls.length === 0) {
    console.warn('No valid image URLs provided');
    return [];
  }

  const downloadPromises = [];
  const successfulDownloads = [];

  // Process downloads in batches to limit concurrency
  for (let i = 0; i < validUrls.length; i += concurrency) {
    const batch = validUrls.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (url, batchIndex) => {
      const globalIndex = i + batchIndex;
      const extension = getFileExtension(url);
      const fileName = `image-${globalIndex}${extension}`;
      const filePath = path.join(tempDir, fileName);
      
      try {
        const success = await downloadSingleImage(url, filePath);
        
        if (success) {
          // File validation is already done in downloadSingleImage
          return filePath;
        }
        
        return null;
      } catch (error) {
        console.warn(`Failed to download ${url}: ${error.message}`);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    successfulDownloads.push(...batchResults.filter(Boolean));
    
    // Small delay between batches to be respectful to servers
    if (i + concurrency < validUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`Successfully downloaded ${successfulDownloads.length} out of ${validUrls.length} images`);
  
  return successfulDownloads;
};

/**
 * Cleans up downloaded images by removing files
 * @param {string[]} filePaths - Array of file paths to remove
 * @returns {Promise<void>}
 */
export const cleanupImages = async filePaths => {
  if (!filePaths || filePaths.length === 0) {
    return;
  }

  const cleanupPromises = filePaths.map(async filePath => {
    try {
      await fs.unlink(filePath);
      console.log(`Cleaned up: ${filePath}`);
    } catch (error) {
      console.warn(`Failed to cleanup ${filePath}: ${error.message}`);
    }
  });

  await Promise.all(cleanupPromises);
};