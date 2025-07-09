/**
 * YouTube Authentication Utilities
 * Provides reusable authentication functions for CLI commands
 */

import 'dotenv/config';
import { google } from 'googleapis';
import { authenticateYouTube } from '../youtube-auth.js';

/**
 * Validates YouTube environment variables
 * @returns {Object} - Environment validation result
 */
export const validateYouTubeEnvironment = () => {
  const {
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    YOUTUBE_OAUTH2_ACCESS_TOKEN,
    YOUTUBE_OAUTH2_REFRESH_TOKEN
  } = process.env;

  const missing = [];
  
  if (!YOUTUBE_CLIENT_ID) missing.push('YOUTUBE_CLIENT_ID');
  if (!YOUTUBE_CLIENT_SECRET) missing.push('YOUTUBE_CLIENT_SECRET');
  if (!YOUTUBE_OAUTH2_ACCESS_TOKEN) missing.push('YOUTUBE_OAUTH2_ACCESS_TOKEN');

  return {
    isValid: missing.length === 0,
    missing,
    hasRefreshToken: !!YOUTUBE_OAUTH2_REFRESH_TOKEN
  };
};

/**
 * Creates and tests YouTube OAuth2 client
 * @returns {Promise<Object>} - OAuth2 client and channel info
 */
export const createAndTestYouTubeAuth = async () => {
  const {
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    YOUTUBE_OAUTH2_ACCESS_TOKEN,
    YOUTUBE_OAUTH2_REFRESH_TOKEN
  } = process.env;

  // Create OAuth2 client
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

  // Test authentication
  try {
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const response = await youtube.channels.list({
      part: 'snippet,statistics',
      mine: true
    });

    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      return {
        success: true,
        oauth2Client,
        channel: {
          title: channel.snippet.title,
          subscribers: channel.statistics.subscriberCount || 'Hidden',
          videos: channel.statistics.videoCount || '0'
        }
      };
    } else {
      throw new Error('No channel data found');
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      oauth2Client: null,
      channel: null
    };
  }
};

/**
 * Ensures YouTube authentication is valid, prompts for auth if needed
 * @param {Object} options - Authentication options
 * @param {boolean} options.silent - Whether to suppress output messages
 * @returns {Promise<Object>} - Authentication result
 */
export const ensureYouTubeAuthentication = async (options = {}) => {
  const { silent = false } = options;

  if (!silent) {
    console.log('🔐 Checking YouTube authentication...');
  }

  // Check environment variables
  const envCheck = validateYouTubeEnvironment();
  
  if (!envCheck.isValid) {
    if (!silent) {
      console.log('❌ YouTube authentication not configured');
      console.log('📋 Missing environment variables:');
      envCheck.missing.forEach(variable => {
        console.log(`   • ${variable}`);
      });
      console.log('\n🚀 Starting YouTube authentication process...');
    }

    try {
      await authenticateYouTube();
      
      // Re-validate after authentication
      const newEnvCheck = validateYouTubeEnvironment();
      if (!newEnvCheck.isValid) {
        throw new Error('Authentication completed but environment variables still missing');
      }
    } catch (error) {
      throw new Error(`YouTube authentication failed: ${error.message}`);
    }
  }

  // Test authentication
  const authTest = await createAndTestYouTubeAuth();
  
  if (!authTest.success) {
    if (!silent) {
      console.log('❌ YouTube authentication test failed');
      console.log(`🔧 Error: ${authTest.error}`);
      console.log('\n🚀 Re-authenticating with YouTube...');
    }

    try {
      await authenticateYouTube();
      
      // Re-test after re-authentication
      const newAuthTest = await createAndTestYouTubeAuth();
      if (!newAuthTest.success) {
        throw new Error(`Re-authentication failed: ${newAuthTest.error}`);
      }
      
      return newAuthTest;
    } catch (error) {
      throw new Error(`YouTube re-authentication failed: ${error.message}`);
    }
  }

  if (!silent) {
    console.log('✅ YouTube authentication verified');
    console.log(`📺 Channel: ${authTest.channel.title}`);
    console.log(`👥 Subscribers: ${authTest.channel.subscribers}`);
    console.log(`🎬 Videos: ${authTest.channel.videos}`);
    console.log('');
  }

  return authTest;
};

/**
 * Quick check if YouTube authentication is available (non-interactive)
 * @returns {Promise<boolean>} - True if authentication is valid
 */
export const isYouTubeAuthenticationValid = async () => {
  try {
    const envCheck = validateYouTubeEnvironment();
    if (!envCheck.isValid) {
      return false;
    }

    const authTest = await createAndTestYouTubeAuth();
    return authTest.success;
  } catch (error) {
    return false;
  }
};

/**
 * Gets YouTube channel information if authenticated
 * @returns {Promise<Object|null>} - Channel info or null if not authenticated
 */
export const getYouTubeChannelInfo = async () => {
  try {
    const authTest = await createAndTestYouTubeAuth();
    return authTest.success ? authTest.channel : null;
  } catch (error) {
    return null;
  }
};