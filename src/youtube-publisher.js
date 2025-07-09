import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

/**
 * YouTube video size limits (in bytes)
 */
const MAX_FILE_SIZE = 128 * 1024 * 1024 * 1024; // 128GB
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * Supported video formats for YouTube
 */
const SUPPORTED_FORMATS = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv'];

/**
 * Supported thumbnail formats for YouTube
 */
const SUPPORTED_THUMBNAIL_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Default video metadata
 */
const DEFAULT_METADATA = {
  tags: ['Amazon', 'Affiliate', 'Review'],
  categoryId: '26', // Howto & Style
  privacyStatus: 'public',
  defaultLanguage: 'en'
};

/**
 * Validates environment variables for YouTube API
 * @throws {Error} When required environment variables are missing
 */
const validateEnvironment = () => {
  const {
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    YOUTUBE_OAUTH2_ACCESS_TOKEN,
    YOUTUBE_OAUTH2_REFRESH_TOKEN,
    AFFILIATE_TAG
  } = process.env;

  if (!YOUTUBE_CLIENT_ID) {
    throw new Error('YOUTUBE_CLIENT_ID is required in environment variables');
  }

  if (!YOUTUBE_CLIENT_SECRET) {
    throw new Error('YOUTUBE_CLIENT_SECRET is required in environment variables');
  }

  if (!YOUTUBE_OAUTH2_ACCESS_TOKEN) {
    throw new Error('YOUTUBE_OAUTH2_ACCESS_TOKEN is required in environment variables. Run: node youtube-auth.js');
  }

  return {
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    YOUTUBE_OAUTH2_ACCESS_TOKEN,
    YOUTUBE_OAUTH2_REFRESH_TOKEN,
    AFFILIATE_TAG
  };
};

/**
 * Validates video file before upload
 * @param {string} videoPath - Path to video file
 * @throws {Error} When video file is invalid
 */
const validateVideoFile = async videoPath => {
  if (!videoPath || typeof videoPath !== 'string') {
    throw new Error('Video file path is required');
  }

  // Check if file exists
  try {
    const stats = await fs.stat(videoPath);
    
    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`Video file is too large: ${Math.round(stats.size / (1024 * 1024 * 1024))}GB (max: 128GB)`);
    }

    if (stats.size === 0) {
      throw new Error('Video file is empty');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    throw error;
  }

  // Check file format
  const extension = path.extname(videoPath).toLowerCase();
  if (!SUPPORTED_FORMATS.includes(extension)) {
    throw new Error(`Unsupported video format: ${extension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
  }
};

/**
 * Validates thumbnail file before upload
 * @param {string} thumbnailPath - Path to thumbnail file
 * @throws {Error} When thumbnail file is invalid
 */
const validateThumbnailFile = async thumbnailPath => {
  if (!thumbnailPath || typeof thumbnailPath !== 'string') {
    return false; // Thumbnail is optional
  }

  try {
    const stats = await fs.stat(thumbnailPath);
    
    // Check file size
    if (stats.size > MAX_THUMBNAIL_SIZE) {
      console.warn(`⚠️ Thumbnail file is too large: ${Math.round(stats.size / (1024 * 1024))}MB (max: 2MB)`);
      return false;
    }

    if (stats.size === 0) {
      console.warn('⚠️ Thumbnail file is empty');
      return false;
    }

    // Check file format
    const extension = path.extname(thumbnailPath).toLowerCase();
    if (!SUPPORTED_THUMBNAIL_FORMATS.includes(extension)) {
      console.warn(`⚠️ Unsupported thumbnail format: ${extension}. Supported formats: ${SUPPORTED_THUMBNAIL_FORMATS.join(', ')}`);
      return false;
    }

    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠️ Thumbnail file not found: ${thumbnailPath}`);
      return false;
    }
    console.warn(`⚠️ Thumbnail validation error: ${error.message}`);
    return false;
  }
};

/**
 * Validates video metadata
 * @param {string} title - Video title
 * @param {string} description - Video description
 * @throws {Error} When metadata is invalid
 */
const validateMetadata = (title, description) => {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Video title is required');
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Title is too long: ${title.length} characters (max: ${MAX_TITLE_LENGTH})`);
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description is too long: ${description.length} characters (max: ${MAX_DESCRIPTION_LENGTH})`);
  }
};

/**
 * Creates YouTube OAuth2 client with automatic token refresh
 * @param {Object} credentials - OAuth2 credentials
 * @returns {Object} - Configured OAuth2 client
 */
const createOAuth2Client = credentials => {
  const {
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    YOUTUBE_OAUTH2_ACCESS_TOKEN,
    YOUTUBE_OAUTH2_REFRESH_TOKEN
  } = credentials;

  const oauth2Client = new google.auth.OAuth2(
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    'http://localhost:8080/oauth2callback'
  );

  const tokenData = {
    access_token: YOUTUBE_OAUTH2_ACCESS_TOKEN
  };

  // Add refresh token if available
  if (YOUTUBE_OAUTH2_REFRESH_TOKEN) {
    tokenData.refresh_token = YOUTUBE_OAUTH2_REFRESH_TOKEN;
  }

  oauth2Client.setCredentials(tokenData);

  // Set up automatic token refresh
  oauth2Client.on('tokens', (tokens) => {
    console.log('🔄 YouTube tokens refreshed automatically');
    if (tokens.refresh_token) {
      console.log('💾 New refresh token received');
    }
    // Note: In production, you might want to save new tokens to .env
    // For now, they'll be used for the current session
  });

  return oauth2Client;
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
 * Checks if description already contains affiliate content
 * @param {string} description - Description text to check
 * @returns {boolean} - True if affiliate content is already present
 */
const hasAffiliateContent = (description) => {
  if (!description) return false;
  
  // Check for affiliate link indicator
  const hasAffiliateLink = description.includes('🛒 Get this product here:');
  
  // Check for Amazon Associate disclaimer
  const hasAssociateDisclaimer = description.includes('As an Amazon Associate');
  
  // Consider it has affiliate content if either indicator is present
  return hasAffiliateLink || hasAssociateDisclaimer;
};

/**
 * Builds video description with affiliate link
 * @param {string} baseDescription - Base description text
 * @param {string} productUrl - Amazon product URL
 * @param {string} affiliateTag - Amazon affiliate tag
 * @param {boolean} isShorts - Whether this is for YouTube Shorts
 * @returns {string} - Complete description with affiliate link
 */
const buildDescription = (baseDescription, productUrl, affiliateTag, isShorts = false) => {
  let description = baseDescription || '';

  // For Shorts, keep description concise and add Shorts-specific hashtags
  if (isShorts) {
    // Truncate description for Shorts (keep it under 125 characters for better visibility)
    if (description.length > 100) {
      description = description.substring(0, 97) + '...';
    }
    
    // Add Shorts-specific hashtags if not already present
    if (!description.includes('#Shorts')) {
      description += '\n\n#Shorts #Short #Vertical #QuickReview';
    }
  }

  // Only add affiliate content if it doesn't already exist and we have the required parameters
  if (productUrl && affiliateTag && !hasAffiliateContent(description)) {
    const affiliateUrl = generateAffiliateUrl(productUrl, affiliateTag);
    
    if (description.length > 0) {
      description += '\n\n';
    }
    
    if (isShorts) {
      // Shorter affiliate content for Shorts
      description += `🛒 ${affiliateUrl}\n`;
      description += '⚠️ As an Amazon Associate, I earn from qualifying purchases.';
    } else {
      // Full affiliate content for regular videos
      description += `🛒 Get this product here: ${affiliateUrl}\n\n`;
      description += '⚠️ As an Amazon Associate, I earn from qualifying purchases.\n';
      description += 'This helps support the channel at no extra cost to you!';
    }
  }

  return description;
};

/**
 * Uploads video to YouTube with retry logic
 * @param {Object} youtube - YouTube API client
 * @param {Object} requestBody - Upload request body
 * @param {string} videoPath - Path to video file
 * @param {Object} options - Upload options
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object>} - Upload response
 */
const uploadWithRetry = async (youtube, requestBody, videoPath, options = {}, retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Import fs with createReadStream for streaming
      const { createReadStream } = await import('fs');
      const fileStream = createReadStream(videoPath);
      
      // Get file size for progress reporting
      const stats = await fs.stat(videoPath);
      const fileSize = stats.size;
      
      const uploadRequest = {
        part: 'snippet,status',
        requestBody,
        media: {
          body: fileStream
        }
      };

      // Add progress reporting if callback provided
      if (options.onProgress && typeof options.onProgress === 'function') {
        uploadRequest.onUploadProgress = evt => {
          const progress = (evt.bytesRead / fileSize) * 100;
          options.onProgress({
            percent: Math.round(progress),
            bytesUploaded: evt.bytesRead,
            totalBytes: fileSize
          });
        };
      }

      const response = await youtube.videos.insert(uploadRequest);
      return response;
    } catch (error) {
      console.warn(`Upload attempt ${attempt + 1} failed: ${error.message}`);
      
      // Check if it's an authentication error
      if (error.code === 401 || error.message.includes('Invalid credentials')) {
        throw new Error('Authentication failed. Please run: node youtube-auth.js');
      }
      
      // Check if it's a quota error
      if (error.code === 403 && error.message.includes('quota')) {
        throw new Error('YouTube API quota exceeded. Please try again later.');
      }
      
      // Check if it's a token expiry error
      if (error.code === 401 || error.message.includes('Token has been expired')) {
        throw new Error('YouTube token expired. Please run: node youtube-auth.js');
      }
      
      if (attempt === retries - 1) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, attempt) * 2000)
      );
    }
  }
};

/**
 * Uploads thumbnail to YouTube video
 * @param {Object} youtube - YouTube API client
 * @param {string} videoId - YouTube video ID
 * @param {string} thumbnailPath - Path to thumbnail file
 * @returns {Promise<boolean>} - True if thumbnail uploaded successfully
 */
const uploadThumbnail = async (youtube, videoId, thumbnailPath) => {
  try {
    const isValid = await validateThumbnailFile(thumbnailPath);
    if (!isValid) {
      return false;
    }

    console.log('📸 Uploading custom thumbnail...');

    // Import fs with createReadStream for streaming
    const { createReadStream } = await import('fs');
    const thumbnailStream = createReadStream(thumbnailPath);

    const response = await youtube.thumbnails.set({
      videoId: videoId,
      media: {
        body: thumbnailStream
      }
    });

    if (response.status === 200) {
      console.log('✅ Custom thumbnail uploaded successfully');
      return true;
    } else {
      console.warn('⚠️ Thumbnail upload returned unexpected status:', response.status);
      return false;
    }
  } catch (error) {
    console.warn('⚠️ Failed to upload thumbnail:', error.message);
    
    // Check if it's a permissions error
    if (error.code === 403) {
      console.warn('💡 Note: Custom thumbnails require channel verification');
      console.warn('   Visit: https://www.youtube.com/verify to verify your channel');
    }
    
    return false;
  }
};

/**
 * Uploads video to YouTube
 * @param {string} videoPath - Path to video file
 * @param {string} title - Video title
 * @param {string} description - Video description
 * @param {string} productUrl - Amazon product URL (optional)
 * @param {Object} options - Upload options
 * @param {string} options.thumbnailPath - Path to custom thumbnail (optional)
 * @param {boolean} options.isShorts - Whether this is a YouTube Shorts video (optional)
 * @returns {Promise<Object>} - Upload result with video ID and URL
 * @throws {Error} When upload fails
 */
export const uploadToYouTube = async (
  videoPath,
  title,
  description = '',
  productUrl = '',
  options = {}
) => {
  // Validate inputs
  await validateVideoFile(videoPath);
  validateMetadata(title, description);
  
  // Validate environment
  const credentials = validateEnvironment();
  
  const videoType = options.isShorts ? 'YouTube Shorts' : 'YouTube';
  console.log(`Uploading video to ${videoType}: ${title}`);
  
  try {
    // Create OAuth2 client
    const auth = createOAuth2Client(credentials);
    
    // Create YouTube API client
    const youtube = google.youtube({
      version: 'v3',
      auth
    });
    
    // Build complete description with affiliate link
    const completeDescription = buildDescription(
      description,
      productUrl,
      credentials.AFFILIATE_TAG,
      options.isShorts
    );
    
    // Merge options with defaults
    const metadata = { ...DEFAULT_METADATA, ...options };
    
    // Prepare request body
    const requestBody = {
      snippet: {
        title: title.trim(),
        description: completeDescription,
        tags: metadata.tags,
        categoryId: metadata.categoryId,
        defaultLanguage: metadata.defaultLanguage
      },
      status: {
        privacyStatus: metadata.privacyStatus,
        selfDeclaredMadeForKids: false
      }
    };
    
    // Upload video
    const response = await uploadWithRetry(
      youtube,
      requestBody,
      videoPath,
      options
    );
    
    const videoData = response.data;
    const videoId = videoData.id;
    const videoUrl = `https://youtu.be/${videoId}`;
    
    console.log(`Video uploaded successfully: ${videoUrl}`);
    
    // Upload custom thumbnail if provided
    let thumbnailUploaded = false;
    if (options.thumbnailPath) {
      thumbnailUploaded = await uploadThumbnail(youtube, videoId, options.thumbnailPath);
    }
    
    return {
      videoId,
      url: videoUrl,
      title: videoData.snippet.title,
      description: videoData.snippet.description,
      status: videoData.status.uploadStatus,
      privacyStatus: videoData.status.privacyStatus,
      thumbnailUploaded
    };
    
  } catch (error) {
    throw new Error(`YouTube upload failed: ${error.message}`);
  }
};

/**
 * Gets upload quota information
 * @returns {Promise<Object>} - Quota information
 */
export const getUploadQuota = async () => {
  const credentials = validateEnvironment();
  const auth = createOAuth2Client(credentials);
  const youtube = google.youtube({ version: 'v3', auth });
  
  try {
    // This is a simplified quota check - YouTube doesn't provide direct quota API
    // In practice, you'd track uploads and implement your own quota management
    const response = await youtube.channels.list({
      part: 'statistics',
      mine: true
    });
    
    return {
      available: true,
      dailyUploads: 0, // Would need to be tracked separately
      maxDailyUploads: 100 // YouTube's default limit
    };
  } catch (error) {
    throw new Error(`Failed to check quota: ${error.message}`);
  }
};

/**
 * Uploads video specifically to YouTube Shorts with optimized settings and Shorts URL
 * @param {string} videoPath - Path to short video file
 * @param {string} title - Video title (will be optimized for Shorts)
 * @param {string} description - Video description (will be optimized for Shorts)
 * @param {string} productUrl - Amazon product URL (optional)
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Upload result with video ID and Shorts URL
 * @throws {Error} When upload fails
 */
export const uploadToYouTubeShorts = async (
  videoPath,
  title,
  description = '',
  productUrl = '',
  options = {}
) => {
  // Validate inputs
  await validateVideoFile(videoPath);
  validateMetadata(title, description);
  
  // Validate environment
  const credentials = validateEnvironment();
  
  console.log('📱 Uploading to YouTube Shorts...');
  
  try {
    // Create OAuth2 client
    const auth = createOAuth2Client(credentials);
    
    // Create YouTube API client
    const youtube = google.youtube({
      version: 'v3',
      auth
    });
    
    // Optimize title for Shorts
    let shortsTitle = title;
    if (!shortsTitle.includes('#Shorts')) {
      // Keep title concise for Shorts (under 60 characters is ideal)
      if (shortsTitle.length > 50) {
        shortsTitle = shortsTitle.substring(0, 47) + '...';
      }
      shortsTitle += ' #Shorts';
    }
    
    // Build complete description with affiliate link for Shorts
    const completeDescription = buildDescription(
      description,
      productUrl,
      credentials.AFFILIATE_TAG,
      true // isShorts = true
    );
    
    // Optimize options for YouTube Shorts
    const shortsOptions = {
      ...options,
      tags: [...(options.tags || []), 'Shorts', 'Short', 'Vertical', 'QuickReview', 'YouTubeShorts'],
      categoryId: '24' // Entertainment category works better for Shorts
    };
    
    // Merge options with defaults
    const metadata = { ...DEFAULT_METADATA, ...shortsOptions };
    
    // Prepare request body with Shorts-specific optimizations
    const requestBody = {
      snippet: {
        title: shortsTitle.trim(),
        description: completeDescription,
        tags: metadata.tags,
        categoryId: metadata.categoryId,
        defaultLanguage: metadata.defaultLanguage
      },
      status: {
        privacyStatus: metadata.privacyStatus,
        selfDeclaredMadeForKids: false,
        // Add Shorts-specific metadata
        madeForKids: false
      }
    };
    
    // Upload video with Shorts optimization
    const response = await uploadWithRetry(
      youtube,
      requestBody,
      videoPath,
      options
    );
    
    const videoData = response.data;
    const videoId = videoData.id;
    
    // Generate Shorts-specific URL
    const shortsUrl = `https://youtube.com/shorts/${videoId}`;
    const regularUrl = `https://youtu.be/${videoId}`;
    
    console.log(`📱 YouTube Shorts uploaded successfully: ${shortsUrl}`);
    
    // Upload custom thumbnail if provided
    let thumbnailUploaded = false;
    if (options.thumbnailPath) {
      thumbnailUploaded = await uploadThumbnail(youtube, videoId, options.thumbnailPath);
    }
    
    return {
      videoId,
      url: shortsUrl, // Return Shorts URL
      regularUrl: regularUrl, // Also provide regular URL
      title: videoData.snippet.title,
      description: videoData.snippet.description,
      status: videoData.status.uploadStatus,
      privacyStatus: videoData.status.privacyStatus,
      thumbnailUploaded,
      isShorts: true
    };
    
  } catch (error) {
    throw new Error(`YouTube Shorts upload failed: ${error.message}`);
  }
};

/**
 * Uploads both long-form and short-form videos to YouTube automatically
 * @param {string} longVideoPath - Path to long-form video file
 * @param {string} shortVideoPath - Path to short-form video file
 * @param {string} title - Base video title
 * @param {string} description - Video description
 * @param {string} productUrl - Amazon product URL (optional)
 * @param {Object} options - Upload options
 * @param {string} options.thumbnailPath - Path to custom thumbnail for long video (optional)
 * @param {string} options.shortThumbnailPath - Path to custom thumbnail for short video (optional)
 * @param {boolean} options.publishBoth - Whether to publish both videos (default: true)
 * @returns {Promise<Object>} - Upload results for both videos
 * @throws {Error} When upload fails
 */
export const uploadBothVideosToYouTube = async (
  longVideoPath,
  shortVideoPath,
  title,
  description = '',
  productUrl = '',
  options = {}
) => {
  const results = {
    longVideo: null,
    shortVideo: null,
    success: false,
    errors: []
  };

  try {
    console.log('🎬 Starting dual video upload to YouTube...');
    console.log(`📹 Long video: ${longVideoPath}`);
    console.log(`📱 Short video: ${shortVideoPath}`);
    console.log('');

    // Upload long-form video first
    console.log('📹 Uploading long-form video...');
    try {
      const longVideoOptions = {
        ...options,
        thumbnailPath: options.thumbnailPath,
        tags: [...(options.tags || [])],
        onProgress: (progress) => {
          if (options.onProgress) {
            options.onProgress({
              ...progress,
              type: 'long',
              message: `Long video: ${Math.round(progress.percent || 0)}%`
            });
          }
        }
      };

      results.longVideo = await uploadToYouTube(
        longVideoPath,
        title,
        description,
        productUrl,
        longVideoOptions
      );

      console.log(`✅ Long video uploaded: ${results.longVideo.url}`);
    } catch (error) {
      console.error(`❌ Long video upload failed: ${error.message}`);
      results.errors.push({ type: 'long', error: error.message });
    }

    // Upload short-form video as YouTube Shorts
    try {
      const shortVideoOptions = {
        ...options,
        thumbnailPath: options.shortThumbnailPath,
        onProgress: (progress) => {
          if (options.onProgress) {
            options.onProgress({
              ...progress,
              type: 'short',
              message: `YouTube Shorts: ${Math.round(progress.percent || 0)}%`
            });
          }
        }
      };

      results.shortVideo = await uploadToYouTubeShorts(
        shortVideoPath,
        title,
        description,
        productUrl,
        shortVideoOptions
      );

      console.log(`✅ YouTube Shorts uploaded: ${results.shortVideo.url}`);
    } catch (error) {
      console.error(`❌ YouTube Shorts upload failed: ${error.message}`);
      results.errors.push({ type: 'short', error: error.message });
    }

    // Determine overall success
    results.success = results.longVideo !== null || results.shortVideo !== null;

    if (results.success) {
      console.log('\n🎉 Dual video upload completed!');
      if (results.longVideo) {
        console.log(`📹 Long-form video: ${results.longVideo.url}`);
      }
      if (results.shortVideo) {
        console.log(`📱 YouTube Shorts: ${results.shortVideo.url}`);
      }
    } else {
      console.log('\n❌ Both video uploads failed');
    }

    return results;

  } catch (error) {
    results.errors.push({ type: 'general', error: error.message });
    throw new Error(`Dual video upload failed: ${error.message}`);
  }
};

/**
 * Updates video metadata after upload
 * @param {string} videoId - YouTube video ID
 * @param {Object} updates - Metadata updates
 * @returns {Promise<Object>} - Updated video data
 */
export const updateVideoMetadata = async (videoId, updates) => {
  const credentials = validateEnvironment();
  const auth = createOAuth2Client(credentials);
  const youtube = google.youtube({ version: 'v3', auth });
  
  try {
    const response = await youtube.videos.update({
      part: 'snippet',
      requestBody: {
        id: videoId,
        snippet: updates
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Failed to update video metadata: ${error.message}`);
  }
};