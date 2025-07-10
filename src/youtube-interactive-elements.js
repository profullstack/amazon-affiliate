import { google } from 'googleapis';

/**
 * YouTube Interactive Elements Manager
 * Handles Cards, End Screens, and other clickable elements for affiliate marketing
 */

/**
 * Validates environment variables for YouTube API
 * @throws {Error} When required environment variables are missing
 */
const validateEnvironment = () => {
  const {
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    YOUTUBE_OAUTH2_ACCESS_TOKEN,
    YOUTUBE_OAUTH2_REFRESH_TOKEN
  } = process.env;

  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_OAUTH2_ACCESS_TOKEN) {
    throw new Error('YouTube API credentials are required. Run: node youtube-auth.js');
  }

  return {
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    YOUTUBE_OAUTH2_ACCESS_TOKEN,
    YOUTUBE_OAUTH2_REFRESH_TOKEN
  };
};

/**
 * Creates YouTube OAuth2 client
 * @param {Object} credentials - OAuth2 credentials
 * @returns {Object} - Configured OAuth2 client
 */
const createOAuth2Client = (credentials) => {
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

  if (YOUTUBE_OAUTH2_REFRESH_TOKEN) {
    tokenData.refresh_token = YOUTUBE_OAUTH2_REFRESH_TOKEN;
  }

  oauth2Client.setCredentials(tokenData);
  return oauth2Client;
};

/**
 * Adds YouTube Cards to a video for clickable affiliate links
 * Cards appear as small rectangular overlays during video playback
 * @param {string} videoId - YouTube video ID
 * @param {Object} cardData - Card configuration
 * @param {string} cardData.affiliateUrl - Affiliate link URL
 * @param {string} cardData.productTitle - Product title for the card
 * @param {number} cardData.startTime - When to show card (seconds from start)
 * @param {string} cardData.cardType - Type of card ('link' or 'video')
 * @returns {Promise<Object>} - Card creation result
 */
export const addYouTubeCard = async (videoId, cardData) => {
  if (!videoId || !cardData) {
    throw new Error('Video ID and card data are required');
  }

  const {
    affiliateUrl,
    productTitle = 'Get This Product',
    startTime = 10,
    cardType = 'link'
  } = cardData;

  if (!affiliateUrl) {
    throw new Error('Affiliate URL is required for card');
  }

  console.log(`🎴 Adding YouTube Card to video ${videoId}...`);
  console.log(`🔗 Link: ${affiliateUrl}`);
  console.log(`⏰ Start time: ${startTime}s`);

  try {
    const credentials = validateEnvironment();
    const auth = createOAuth2Client(credentials);
    const youtube = google.youtube({ version: 'v3', auth });

    // Note: YouTube Cards API is limited and requires special permissions
    // For now, we'll prepare the card data structure that would be used
    // In practice, cards are typically added through YouTube Studio UI
    
    const cardConfig = {
      videoId,
      card: {
        cardType: 'link',
        timing: {
          type: 'offsetFromStart',
          offsetMs: startTime * 1000
        },
        link: {
          linkUrl: affiliateUrl,
          linkText: productTitle
        }
      }
    };

    console.log('⚠️ Note: YouTube Cards require manual setup through YouTube Studio');
    console.log('📋 Card configuration prepared:', JSON.stringify(cardConfig, null, 2));
    
    // Return configuration for manual setup
    return {
      success: true,
      cardConfig,
      instructions: [
        '1. Go to YouTube Studio (studio.youtube.com)',
        `2. Select your video: ${videoId}`,
        '3. Go to Editor > Cards',
        '4. Add Link Card',
        `5. Set URL: ${affiliateUrl}`,
        `6. Set Title: ${productTitle}`,
        `7. Set Start Time: ${startTime} seconds`,
        '8. Save changes'
      ]
    };

  } catch (error) {
    throw new Error(`Failed to add YouTube Card: ${error.message}`);
  }
};

/**
 * Adds End Screen elements to a video for clickable affiliate links
 * End screens appear in the last 5-20 seconds of a video
 * @param {string} videoId - YouTube video ID
 * @param {Object} endScreenData - End screen configuration
 * @param {string} endScreenData.affiliateUrl - Affiliate link URL
 * @param {string} endScreenData.productTitle - Product title
 * @param {number} endScreenData.startTime - When to show end screen (seconds from start)
 * @param {number} endScreenData.duration - How long to show (seconds)
 * @returns {Promise<Object>} - End screen creation result
 */
export const addYouTubeEndScreen = async (videoId, endScreenData) => {
  if (!videoId || !endScreenData) {
    throw new Error('Video ID and end screen data are required');
  }

  const {
    affiliateUrl,
    productTitle = 'Buy This Product',
    startTime,
    duration = 10
  } = endScreenData;

  if (!affiliateUrl) {
    throw new Error('Affiliate URL is required for end screen');
  }

  console.log(`🎬 Adding YouTube End Screen to video ${videoId}...`);
  console.log(`🔗 Link: ${affiliateUrl}`);
  console.log(`⏰ Start time: ${startTime}s, Duration: ${duration}s`);

  try {
    const credentials = validateEnvironment();
    const auth = createOAuth2Client(credentials);
    const youtube = google.youtube({ version: 'v3', auth });

    // Get video duration to calculate end screen timing
    const videoResponse = await youtube.videos.list({
      part: 'contentDetails',
      id: videoId
    });

    if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
      throw new Error('Video not found');
    }

    const videoDuration = parseISO8601Duration(videoResponse.data.items[0].contentDetails.duration);
    const calculatedStartTime = startTime || Math.max(videoDuration - 20, videoDuration * 0.8);

    // Prepare end screen configuration
    const endScreenConfig = {
      videoId,
      endScreen: {
        elements: [
          {
            type: 'link',
            position: {
              cornerPosition: 'tr', // top-right
              width: 0.3,
              height: 0.2
            },
            timing: {
              type: 'offsetFromStart',
              offsetMs: calculatedStartTime * 1000,
              durationMs: duration * 1000
            },
            link: {
              linkUrl: affiliateUrl,
              linkText: productTitle
            }
          }
        ]
      }
    };

    console.log('⚠️ Note: YouTube End Screens require manual setup through YouTube Studio');
    console.log('📋 End Screen configuration prepared:', JSON.stringify(endScreenConfig, null, 2));

    return {
      success: true,
      endScreenConfig,
      videoDuration,
      calculatedStartTime,
      instructions: [
        '1. Go to YouTube Studio (studio.youtube.com)',
        `2. Select your video: ${videoId}`,
        '3. Go to Editor > End screen',
        '4. Add Element > Link',
        `5. Set URL: ${affiliateUrl}`,
        `6. Set Title: ${productTitle}`,
        `7. Position in top-right corner`,
        `8. Set timing: ${Math.round(calculatedStartTime)}s - ${Math.round(calculatedStartTime + duration)}s`,
        '9. Save changes'
      ]
    };

  } catch (error) {
    throw new Error(`Failed to add YouTube End Screen: ${error.message}`);
  }
};

/**
 * Creates a comprehensive interactive elements package for a video
 * Includes both Cards and End Screens optimized for affiliate marketing
 * @param {string} videoId - YouTube video ID
 * @param {Object} productData - Product information
 * @param {string} productData.affiliateUrl - Affiliate link URL
 * @param {string} productData.title - Product title
 * @param {string} productData.price - Product price
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - Complete interactive elements setup
 */
export const addCompleteInteractiveElements = async (videoId, productData, options = {}) => {
  if (!videoId || !productData) {
    throw new Error('Video ID and product data are required');
  }

  const {
    affiliateUrl,
    title: productTitle,
    price
  } = productData;

  if (!affiliateUrl) {
    throw new Error('Affiliate URL is required');
  }

  const {
    cardStartTime = 15,
    endScreenDuration = 15,
    includeCards = true,
    includeEndScreen = true
  } = options;

  console.log(`🎯 Setting up complete interactive elements for video ${videoId}...`);
  console.log(`📦 Product: ${productTitle}`);
  console.log(`💰 Price: ${price}`);

  const results = {
    videoId,
    productData,
    cards: null,
    endScreen: null,
    success: false,
    instructions: []
  };

  try {
    // Add YouTube Card
    if (includeCards) {
      console.log('\n🎴 Setting up YouTube Card...');
      results.cards = await addYouTubeCard(videoId, {
        affiliateUrl,
        productTitle: `${productTitle} - ${price}`,
        startTime: cardStartTime,
        cardType: 'link'
      });
      
      if (results.cards.success) {
        results.instructions.push(...results.cards.instructions);
      }
    }

    // Add End Screen
    if (includeEndScreen) {
      console.log('\n🎬 Setting up YouTube End Screen...');
      results.endScreen = await addYouTubeEndScreen(videoId, {
        affiliateUrl,
        productTitle: `Buy ${productTitle}`,
        duration: endScreenDuration
      });
      
      if (results.endScreen.success) {
        results.instructions.push(...results.endScreen.instructions);
      }
    }

    results.success = (results.cards?.success || !includeCards) && 
                     (results.endScreen?.success || !includeEndScreen);

    if (results.success) {
      console.log('\n✅ Interactive elements setup completed!');
      console.log('📋 Manual setup required in YouTube Studio');
    }

    return results;

  } catch (error) {
    throw new Error(`Failed to setup interactive elements: ${error.message}`);
  }
};

/**
 * Generates overlay text with affiliate links for video creation
 * This creates text overlays that can be burned into the video during creation
 * @param {Object} productData - Product information
 * @param {Object} options - Overlay options
 * @returns {Object} - Overlay configuration for FFmpeg
 */
export const generateAffiliateOverlay = (productData, options = {}) => {
  const {
    affiliateUrl,
    title: productTitle,
    price
  } = productData;

  const {
    position = 'bottom',
    duration = 5,
    startTime = 10,
    fontSize = 24,
    backgroundColor = 'black@0.7',
    textColor = 'white'
  } = options;

  // Create overlay text
  const overlayText = `🛒 ${productTitle} - ${price}\\nClick link in description to purchase`;
  
  // Generate FFmpeg filter for text overlay
  const overlayFilter = generateTextOverlayFilter({
    text: overlayText,
    position,
    startTime,
    duration,
    fontSize,
    backgroundColor,
    textColor
  });

  return {
    overlayText,
    overlayFilter,
    affiliateUrl,
    timing: {
      startTime,
      duration
    },
    instructions: [
      'This overlay will be burned into the video during creation',
      'The affiliate link will be in the video description',
      'Viewers will see the overlay and can click the description link'
    ]
  };
};

/**
 * Generates FFmpeg text overlay filter
 * @param {Object} config - Overlay configuration
 * @returns {string} - FFmpeg filter string
 */
const generateTextOverlayFilter = (config) => {
  const {
    text,
    position,
    startTime,
    duration,
    fontSize,
    backgroundColor,
    textColor
  } = config;

  // Position mapping
  const positions = {
    'top': 'x=(w-text_w)/2:y=50',
    'bottom': 'x=(w-text_w)/2:y=h-text_h-50',
    'center': 'x=(w-text_w)/2:y=(h-text_h)/2',
    'top-left': 'x=50:y=50',
    'top-right': 'x=w-text_w-50:y=50',
    'bottom-left': 'x=50:y=h-text_h-50',
    'bottom-right': 'x=w-text_w-50:y=h-text_h-50'
  };

  const positionStr = positions[position] || positions['bottom'];
  const endTime = startTime + duration;

  return `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${textColor}:${positionStr}:box=1:boxcolor=${backgroundColor}:enable='between(t,${startTime},${endTime})'`;
};

/**
 * Parses ISO 8601 duration format (PT1M30S) to seconds
 * @param {string} duration - ISO 8601 duration string
 * @returns {number} - Duration in seconds
 */
const parseISO8601Duration = (duration) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  
  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * Gets video information needed for interactive elements
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - Video information
 */
export const getVideoInfo = async (videoId) => {
  if (!videoId) {
    throw new Error('Video ID is required');
  }

  try {
    const credentials = validateEnvironment();
    const auth = createOAuth2Client(credentials);
    const youtube = google.youtube({ version: 'v3', auth });

    const response = await youtube.videos.list({
      part: 'snippet,contentDetails,statistics',
      id: videoId
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = response.data.items[0];
    const duration = parseISO8601Duration(video.contentDetails.duration);

    return {
      videoId,
      title: video.snippet.title,
      description: video.snippet.description,
      duration,
      publishedAt: video.snippet.publishedAt,
      viewCount: video.statistics.viewCount,
      likeCount: video.statistics.likeCount,
      commentCount: video.statistics.commentCount
    };

  } catch (error) {
    throw new Error(`Failed to get video info: ${error.message}`);
  }
};

/**
 * Validates interactive elements configuration
 * @param {Object} config - Configuration to validate
 * @throws {Error} When configuration is invalid
 */
export const validateInteractiveConfig = (config) => {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration object is required');
  }

  const { videoId, productData } = config;

  if (!videoId || typeof videoId !== 'string') {
    throw new Error('Valid video ID is required');
  }

  if (!productData || typeof productData !== 'object') {
    throw new Error('Product data is required');
  }

  if (!productData.affiliateUrl) {
    throw new Error('Affiliate URL is required in product data');
  }

  if (!productData.title) {
    throw new Error('Product title is required in product data');
  }

  console.log('✅ Interactive elements configuration validated');
};