import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/**
 * Default thumbnail configuration
 */
const DEFAULT_THUMBNAIL_CONFIG = {
  width: 1280,
  height: 720,
  quality: 95,
  format: 'jpg',
  backgroundColor: '#1a1a1a',
  textColor: '#ffffff',
  accentColor: '#ff6b35',
  fontSize: {
    title: 48,
    subtitle: 32,
    rating: 36,
    price: 42
  },
  padding: 60,
  borderRadius: 20
};

/**
 * Creates a high-quality YouTube thumbnail from product data
 * @param {Object} productData - Product information
 * @param {string} outputPath - Path for the thumbnail image
 * @param {Object} config - Thumbnail configuration options
 * @returns {Promise<string>} Path to created thumbnail
 */
export const createThumbnail = async (productData, outputPath, config = {}) => {
  const thumbnailConfig = { ...DEFAULT_THUMBNAIL_CONFIG, ...config };
  
  if (!productData || typeof productData !== 'object') {
    throw new Error('Product data is required and must be an object');
  }

  const {
    title = 'Product Review',
    price = '',
    rating = '',
    images = []
  } = productData;

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  console.log('🎨 Creating YouTube thumbnail...');
  console.log(`📐 Size: ${thumbnailConfig.width}x${thumbnailConfig.height}`);
  console.log(`📄 Title: ${title}`);

  // Use the first product image if available
  const productImagePath = images.length > 0 ? images[0] : null;
  
  if (productImagePath && productImagePath.startsWith('http')) {
    // Download the product image first
    const localImagePath = await downloadProductImage(productImagePath);
    return await createThumbnailWithImage(
      title, 
      price, 
      rating, 
      localImagePath, 
      outputPath, 
      thumbnailConfig
    );
  } else if (productImagePath) {
    // Use local image
    return await createThumbnailWithImage(
      title, 
      price, 
      rating, 
      productImagePath, 
      outputPath, 
      thumbnailConfig
    );
  } else {
    // Create text-only thumbnail
    return await createTextOnlyThumbnail(
      title, 
      price, 
      rating, 
      outputPath, 
      thumbnailConfig
    );
  }
};

/**
 * Downloads a product image for thumbnail use
 * @param {string} imageUrl - URL of the image to download
 * @returns {Promise<string>} Path to downloaded image
 */
const downloadProductImage = async (imageUrl) => {
  const tempImagePath = 'temp/thumbnail-product-image.jpg';
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(tempImagePath, buffer);
    
    console.log(`📥 Downloaded product image: ${tempImagePath}`);
    return tempImagePath;
  } catch (error) {
    console.warn(`⚠️ Failed to download product image: ${error.message}`);
    return null;
  }
};

/**
 * Creates a thumbnail with product image
 * @param {string} title - Product title
 * @param {string} price - Product price
 * @param {string} rating - Product rating
 * @param {string} imagePath - Path to product image
 * @param {string} outputPath - Output path for thumbnail
 * @param {Object} config - Thumbnail configuration
 * @returns {Promise<string>} Path to created thumbnail
 */
const createThumbnailWithImage = async (title, price, rating, imagePath, outputPath, config) => {
  return new Promise((resolve, reject) => {
    // Clean title for display (max 60 characters)
    const displayTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
    
    // Create rating text
    const ratingText = rating ? `⭐ ${rating}` : '';
    
    // Create price text
    const priceText = price ? `💰 ${price}` : '';
    
    // Build ImageMagick command for thumbnail with product image
    const magickArgs = [
      // Create base canvas
      '-size', `${config.width}x${config.height}`,
      `canvas:${config.backgroundColor}`,
      
      // Add product image (resized and positioned)
      '(', imagePath,
      '-resize', '400x400^',
      '-gravity', 'center',
      '-extent', '400x400',
      '-bordercolor', config.accentColor,
      '-border', '3',
      ')',
      '-gravity', 'west',
      '-geometry', `+${config.padding}+0`,
      '-composite',
      
      // Add title text
      
      '-pointsize', config.fontSize.title.toString(),
      '-fill', config.textColor,
      '-gravity', 'northeast',
      '-annotate', `+${config.padding}+${config.padding}`, displayTitle,
      
      // Add "REVIEW" badge
      
      '-pointsize', '28',
      '-fill', config.accentColor,
      '-gravity', 'northeast',
      '-annotate', `+${config.padding}+${config.padding + 60}`, 'HONEST REVIEW',
      
      // Add rating if available
      ...(ratingText ? [
        
        '-pointsize', config.fontSize.rating.toString(),
        '-fill', '#ffd700',
        '-gravity', 'east',
        '-annotate', `+${config.padding}+${-config.padding}`, ratingText
      ] : []),
      
      // Add price if available
      ...(priceText ? [
        
        '-pointsize', config.fontSize.price.toString(),
        '-fill', '#00ff00',
        '-gravity', 'southeast',
        '-annotate', `+${config.padding}+${config.padding}`, priceText
      ] : []),
      
      // Add quality and format
      '-quality', config.quality.toString(),
      outputPath
    ];

    console.log('🎨 ImageMagick thumbnail command:', 'magick', magickArgs.join(' '));

    const magickProcess = spawn('magick', magickArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    magickProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    magickProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.stat(outputPath);
          console.log(`✅ Thumbnail created: ${outputPath} (${Math.round(stats.size / 1024)}KB)`);
          resolve(outputPath);
        } catch (error) {
          reject(new Error(`Thumbnail verification failed: ${error.message}`));
        }
      } else {
        console.error('❌ ImageMagick stderr:', stderr);
        reject(new Error(`ImageMagick failed with exit code ${code}: ${stderr}`));
      }
    });

    magickProcess.on('error', (error) => {
      reject(new Error(`Failed to start ImageMagick: ${error.message}`));
    });
  });
};

/**
 * Creates a text-only thumbnail when no product image is available
 * @param {string} title - Product title
 * @param {string} price - Product price
 * @param {string} rating - Product rating
 * @param {string} outputPath - Output path for thumbnail
 * @param {Object} config - Thumbnail configuration
 * @returns {Promise<string>} Path to created thumbnail
 */
const createTextOnlyThumbnail = async (title, price, rating, outputPath, config) => {
  return new Promise((resolve, reject) => {
    // Clean title for display
    const displayTitle = title.length > 80 ? title.substring(0, 77) + '...' : title;
    
    // Create rating text
    const ratingText = rating ? `⭐ ${rating} STARS` : '';
    
    // Create price text
    const priceText = price ? `💰 ${price}` : '';
    
    // Build ImageMagick command for text-only thumbnail
    const magickArgs = [
      // Create gradient background
      '-size', `${config.width}x${config.height}`,
      'gradient:#2c3e50-#34495e',
      
      // Add main title
      
      '-pointsize', config.fontSize.title.toString(),
      '-fill', config.textColor,
      '-gravity', 'center',
      '-annotate', '+0-100', displayTitle,
      
      // Add "PRODUCT REVIEW" subtitle
      
      '-pointsize', config.fontSize.subtitle.toString(),
      '-fill', config.accentColor,
      '-gravity', 'center',
      '-annotate', '+0-40', 'PRODUCT REVIEW',
      
      // Add rating if available
      ...(ratingText ? [
        
        '-pointsize', config.fontSize.rating.toString(),
        '-fill', '#ffd700',
        '-gravity', 'center',
        '-annotate', '+0+40', ratingText
      ] : []),
      
      // Add price if available
      ...(priceText ? [
        
        '-pointsize', config.fontSize.price.toString(),
        '-fill', '#00ff00',
        '-gravity', 'center',
        '-annotate', '+0+100', priceText
      ] : []),
      
      // Add decorative elements
      '-stroke', config.accentColor,
      '-strokewidth', '3',
      '-fill', 'none',
      '-draw', `roundrectangle ${config.padding},${config.padding} ${config.width - config.padding},${config.height - config.padding} ${config.borderRadius},${config.borderRadius}`,
      
      // Add quality and format
      '-quality', config.quality.toString(),
      outputPath
    ];

    console.log('🎨 ImageMagick text thumbnail command:', 'magick', magickArgs.join(' '));

    const magickProcess = spawn('magick', magickArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    magickProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    magickProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.stat(outputPath);
          console.log(`✅ Text thumbnail created: ${outputPath} (${Math.round(stats.size / 1024)}KB)`);
          resolve(outputPath);
        } catch (error) {
          reject(new Error(`Thumbnail verification failed: ${error.message}`));
        }
      } else {
        console.error('❌ ImageMagick stderr:', stderr);
        reject(new Error(`ImageMagick failed with exit code ${code}: ${stderr}`));
      }
    });

    magickProcess.on('error', (error) => {
      reject(new Error(`Failed to start ImageMagick: ${error.message}`));
    });
  });
};

/**
 * Validates thumbnail creation inputs
 * @param {Object} productData - Product data to validate
 * @param {string} outputPath - Output path to validate
 * @throws {Error} When validation fails
 */
export const validateThumbnailInputs = (productData, outputPath) => {
  if (!productData || typeof productData !== 'object') {
    throw new Error('Product data is required and must be an object');
  }

  if (!outputPath || typeof outputPath !== 'string') {
    throw new Error('Output path is required and must be a string');
  }

  if (!productData.title) {
    throw new Error('Product title is required for thumbnail generation');
  }
};

/**
 * Gets thumbnail dimensions for different platforms
 * @param {string} platform - Platform name ('youtube', 'instagram', 'facebook')
 * @returns {Object} Dimensions object with width and height
 */
export const getThumbnailDimensions = (platform = 'youtube') => {
  const dimensions = {
    youtube: { width: 1280, height: 720 },
    instagram: { width: 1080, height: 1080 },
    facebook: { width: 1200, height: 630 },
    twitter: { width: 1200, height: 675 }
  };

  return dimensions[platform] || dimensions.youtube;
};