import crypto from 'crypto';
import path from 'path';

/**
 * Generates a unique session ID for temporary files
 * Uses timestamp + random bytes for uniqueness
 * @returns {string} Unique session ID
 */
export function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(4).toString('hex');
  return `${timestamp}-${randomBytes}`;
}

/**
 * Creates a unique temporary file path with session ID
 * @param {string} tempDir - Base temporary directory
 * @param {string} filename - Base filename (e.g., 'voiceover.mp3', 'image-1.jpg')
 * @param {string} sessionId - Optional session ID (will generate if not provided)
 * @returns {string} Unique temporary file path
 */
export function createTempFilePath(tempDir, filename, sessionId = null) {
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const uniqueFilename = `${baseName}-${sessionId}${ext}`;
  
  return path.join(tempDir, uniqueFilename);
}

/**
 * Creates multiple unique temporary file paths with the same session ID
 * @param {string} tempDir - Base temporary directory
 * @param {string[]} filenames - Array of base filenames
 * @param {string} sessionId - Optional session ID (will generate if not provided)
 * @returns {Object} Object with original filenames as keys and unique paths as values
 */
export function createTempFilePaths(tempDir, filenames, sessionId = null) {
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  
  const paths = {};
  for (const filename of filenames) {
    paths[filename] = createTempFilePath(tempDir, filename, sessionId);
  }
  
  return { paths, sessionId };
}

/**
 * Creates unique image file paths for downloaded images
 * @param {string} tempDir - Base temporary directory
 * @param {number} count - Number of image files to create paths for
 * @param {string} sessionId - Optional session ID (will generate if not provided)
 * @returns {Object} Object with image paths array and session ID
 */
export function createImageFilePaths(tempDir, count, sessionId = null) {
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  
  const imagePaths = [];
  for (let i = 1; i <= count; i++) {
    const filename = `image-${i}.jpg`;
    imagePaths.push(createTempFilePath(tempDir, filename, sessionId));
  }
  
  return { imagePaths, sessionId };
}

/**
 * Creates unique voiceover file paths
 * @param {string} tempDir - Base temporary directory
 * @param {Object} options - Options for voiceover files
 * @param {boolean} options.includeMain - Include main voiceover file
 * @param {boolean} options.includeShort - Include short voiceover file
 * @param {boolean} options.includeIntro - Include intro voiceover file
 * @param {string} sessionId - Optional session ID (will generate if not provided)
 * @returns {Object} Object with voiceover paths and session ID
 */
export function createVoiceoverFilePaths(tempDir, options = {}, sessionId = null) {
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  
  const {
    includeMain = true,
    includeShort = false,
    includeIntro = false
  } = options;
  
  const paths = {};
  
  if (includeMain) {
    paths.main = createTempFilePath(tempDir, 'voiceover.mp3', sessionId);
  }
  
  if (includeShort) {
    paths.short = createTempFilePath(tempDir, 'short-voiceover.mp3', sessionId);
  }
  
  if (includeIntro) {
    paths.intro = createTempFilePath(tempDir, 'intro-voiceover.mp3', sessionId);
  }
  
  return { paths, sessionId };
}

/**
 * Creates unique output file paths for videos and thumbnails
 * @param {string} outputDir - Base output directory
 * @param {string} baseName - Base name for the files (e.g., 'product-review-123')
 * @param {Object} options - Options for output files
 * @param {boolean} options.includeShort - Include short video files
 * @param {boolean} options.includeThumbnails - Include thumbnail files
 * @param {string} sessionId - Optional session ID (will generate if not provided)
 * @returns {Object} Object with output paths and session ID
 */
export function createOutputFilePaths(outputDir, baseName, options = {}, sessionId = null) {
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  
  const {
    includeShort = false,
    includeThumbnails = true
  } = options;
  
  const paths = {};
  
  // Main video file
  paths.video = path.join(outputDir, `${baseName}-${sessionId}.mp4`);
  
  // Short video file
  if (includeShort) {
    paths.shortVideo = path.join(outputDir, `${baseName}-short-${sessionId}.mp4`);
  }
  
  // Thumbnail files
  if (includeThumbnails) {
    paths.thumbnail = path.join(outputDir, `${baseName}-thumbnail-${sessionId}.jpg`);
    
    if (includeShort) {
      paths.shortThumbnail = path.join(outputDir, `${baseName}-short-thumb-${sessionId}.jpg`);
    }
  }
  
  return { paths, sessionId };
}

/**
 * Extracts session ID from a file path that was created with unique naming
 * @param {string} filePath - File path with session ID
 * @returns {string|null} Session ID or null if not found
 */
export function extractSessionId(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(/-([a-z0-9]+-[a-f0-9]{8})\./);
  return match ? match[1] : null;
}

/**
 * Creates a session-specific temporary directory
 * @param {string} baseDir - Base directory (e.g., './temp')
 * @param {string} sessionId - Optional session ID (will generate if not provided)
 * @returns {Object} Object with temp directory path and session ID
 */
export function createSessionTempDir(baseDir, sessionId = null) {
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  
  const tempDir = path.join(baseDir, `session-${sessionId}`);
  
  return { tempDir, sessionId };
}