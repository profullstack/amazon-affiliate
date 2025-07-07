import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/**
 * Extracts the dominant color from an image using ImageMagick
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} Hex color code (without #)
 */
export async function extractDominantColor(imagePath) {
  return new Promise((resolve, reject) => {
    // Use ImageMagick to get the most frequent color
    const magickArgs = [
      imagePath,
      '-resize', '1x1!',  // Resize to 1x1 to get average color
      '-format', '%[pixel:u]',  // Get the pixel color
      'info:'
    ];

    const magickProcess = spawn('magick', magickArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    magickProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    magickProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    magickProcess.on('close', (code) => {
      if (code === 0) {
        // Parse the color output (format: srgb(r,g,b))
        const colorMatch = stdout.match(/srgb\((\d+),(\d+),(\d+)\)/);
        if (colorMatch) {
          const [, r, g, b] = colorMatch;
          const hexColor = [r, g, b]
            .map(c => parseInt(c).toString(16).padStart(2, '0'))
            .join('');
          resolve(hexColor);
        } else {
          // Fallback to black if parsing fails
          console.warn(`⚠️ Could not parse color from: ${stdout.trim()}, using black`);
          resolve('000000');
        }
      } else {
        console.warn(`⚠️ ImageMagick failed for ${imagePath}: ${stderr}, using black`);
        resolve('000000'); // Fallback to black
      }
    });

    magickProcess.on('error', (error) => {
      console.warn(`⚠️ ImageMagick not available: ${error.message}, using black`);
      resolve('000000'); // Fallback to black
    });
  });
}

/**
 * Creates a smart background version of an image with dominant color padding
 * @param {string} imagePath - Path to the original image
 * @param {string} outputPath - Path for the processed image
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {Promise<string>} Path to the processed image
 */
export async function createSmartBackground(imagePath, outputPath, targetWidth, targetHeight) {
  try {
    // Extract dominant color
    const dominantColor = await extractDominantColor(imagePath);
    console.log(`🎨 Dominant color for ${path.basename(imagePath)}: #${dominantColor}`);

    return new Promise((resolve, reject) => {
      // Use ImageMagick to create smart background
      const magickArgs = [
        imagePath,
        '-resize', `${targetWidth}x${targetHeight}>`,  // Resize only if larger
        '-background', `#${dominantColor}`,
        '-gravity', 'center',
        '-extent', `${targetWidth}x${targetHeight}`,
        outputPath
      ];

      const magickProcess = spawn('magick', magickArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';

      magickProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      magickProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Smart background created: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error(`ImageMagick failed: ${stderr}`));
        }
      });

      magickProcess.on('error', (error) => {
        reject(new Error(`Failed to start ImageMagick: ${error.message}`));
      });
    });
  } catch (error) {
    throw new Error(`Smart background creation failed: ${error.message}`);
  }
}

/**
 * Checks if ImageMagick is available on the system
 * @returns {Promise<boolean>} True if ImageMagick is available
 */
export async function isImageMagickAvailable() {
  return new Promise((resolve) => {
    const magickProcess = spawn('magick', ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    magickProcess.on('close', (code) => {
      resolve(code === 0);
    });

    magickProcess.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Processes images with smart backgrounds for video creation
 * @param {string[]} imagePaths - Array of image paths
 * @param {string} tempDir - Temporary directory for processed images
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {Promise<string[]>} Array of processed image paths
 */
export async function processImagesWithSmartBackground(imagePaths, tempDir, targetWidth, targetHeight) {
  const magickAvailable = await isImageMagickAvailable();
  
  if (!magickAvailable) {
    console.log('📝 ImageMagick not available, using original images with FFmpeg padding');
    return imagePaths; // Return original paths, FFmpeg will handle padding
  }

  console.log('🎨 Processing images with smart backgrounds...');
  
  const processedPaths = [];
  
  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    const filename = path.basename(imagePath, path.extname(imagePath));
    const processedPath = path.join(tempDir, `${filename}-smart-bg.jpg`);
    
    try {
      await createSmartBackground(imagePath, processedPath, targetWidth, targetHeight);
      processedPaths.push(processedPath);
    } catch (error) {
      console.warn(`⚠️ Smart background failed for ${imagePath}: ${error.message}`);
      console.log('📝 Using original image with FFmpeg padding');
      processedPaths.push(imagePath); // Fallback to original
    }
  }
  
  return processedPaths;
}

/**
 * Creates a stylish thumbnail with text overlay using ImageMagick
 * @param {string} imagePath - Path to the base image
 * @param {string} title - Title text to overlay
 * @param {string} outputPath - Path for the output thumbnail
 * @param {Object} options - Styling options
 * @returns {Promise<string>} Path to the created thumbnail
 */
export async function createStylishThumbnail(imagePath, title, outputPath, options = {}) {
  const {
    width = 1280,
    height = 720,
    fontSize = 72,
    fontFamily = 'Adwaita-Sans-Black', // Bold, impactful font
    textColor = 'white',
    strokeColor = 'black',
    strokeWidth = 3,
    shadowOffset = 5,
    shadowBlur = 10,
    shadowOpacity = 0.8,
    position = 'bottom', // 'top', 'bottom', 'center'
    maxLines = 2
  } = options;

  try {
    // First, create the base thumbnail with proper sizing
    const tempBasePath = outputPath.replace('.jpg', '-base.jpg');
    
    await new Promise((resolve, reject) => {
      const baseArgs = [
        imagePath,
        '-resize', `${width}x${height}^`,
        '-gravity', 'center',
        '-extent', `${width}x${height}`,
        tempBasePath
      ];

      const magickProcess = spawn('magick', baseArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      magickProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      magickProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Base thumbnail creation failed: ${stderr}`));
        }
      });

      magickProcess.on('error', (error) => {
        reject(new Error(`Failed to start ImageMagick: ${error.message}`));
      });
    });

    // Prepare the title text (truncate if too long)
    let displayTitle = title;
    if (displayTitle.length > 50) {
      displayTitle = displayTitle.substring(0, 47) + '...';
    }

    // Split title into lines if needed
    const words = displayTitle.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > 25 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
      
      if (lines.length >= maxLines - 1) {
        break;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }

    // Calculate text positioning
    let gravity, yOffset;
    switch (position) {
      case 'top':
        gravity = 'north';
        yOffset = 50;
        break;
      case 'center':
        gravity = 'center';
        yOffset = 0;
        break;
      case 'bottom':
      default:
        gravity = 'south';
        yOffset = -50;
        break;
    }

    // Now add the stylish text overlay
    return new Promise((resolve, reject) => {
      const textArgs = [
        tempBasePath,
        '-font', fontFamily,
        '-pointsize', fontSize.toString(),
        '-fill', textColor,
        '-stroke', strokeColor,
        '-strokewidth', strokeWidth.toString(),
        '-gravity', gravity
      ];

      // Add drop shadow effect
      textArgs.push(
        '(',
        '+clone',
        '-background', 'black',
        '-shadow', `${Math.round(shadowOpacity * 100)}x${shadowBlur}+${shadowOffset}+${shadowOffset}`,
        ')',
        '+swap',
        '-background', 'none',
        '-layers', 'merge',
        '+repage'
      );

      // Add each line of text
      lines.forEach((line, index) => {
        const lineYOffset = yOffset + (index * (fontSize + 10));
        textArgs.push(
          '-annotate', `+0${lineYOffset >= 0 ? '+' : ''}${lineYOffset}`, line
        );
      });

      textArgs.push(outputPath);

      console.log(`🎨 Creating stylish thumbnail with text: "${displayTitle}"`);

      const magickProcess = spawn('magick', textArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      magickProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      magickProcess.on('close', async (code) => {
        // Clean up temp file
        try {
          await fs.unlink(tempBasePath);
        } catch (error) {
          // Ignore cleanup errors
        }

        if (code === 0) {
          console.log(`✅ Stylish thumbnail created: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error(`Text overlay failed: ${stderr}`));
        }
      });

      magickProcess.on('error', (error) => {
        reject(new Error(`Failed to start ImageMagick for text overlay: ${error.message}`));
      });
    });

  } catch (error) {
    throw new Error(`Stylish thumbnail creation failed: ${error.message}`);
  }
}

/**
 * Generates a short, catchy title for thumbnails from a longer title
 * @param {string} fullTitle - The full video title
 * @returns {string} Shortened, punchy title for thumbnail
 */
export function generateThumbnailTitle(fullTitle) {
  // Remove common review phrases and make it punchier
  let shortTitle = fullTitle
    .replace(/\s*-\s*Honest Review\s*$/i, '')
    .replace(/\s*-\s*Review\s*$/i, '')
    .replace(/\s*Review\s*$/i, '')
    .replace(/^Review:\s*/i, '')
    .replace(/\s*\|\s*.*$/, '') // Remove anything after |
    .trim();

  // If still too long, take key words
  if (shortTitle.length > 40) {
    const words = shortTitle.split(' ');
    const keyWords = words.filter(word =>
      word.length > 3 &&
      !['the', 'and', 'for', 'with', 'from'].includes(word.toLowerCase())
    );
    
    if (keyWords.length > 0) {
      shortTitle = keyWords.slice(0, 4).join(' ');
    } else {
      shortTitle = shortTitle.substring(0, 37) + '...';
    }
  }

  // Add excitement if it doesn't already have it
  if (!/[!?]$/.test(shortTitle)) {
    shortTitle += '!';
  }

  return shortTitle;
}