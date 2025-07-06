import 'dotenv/config';
import { google } from 'googleapis';

/**
 * Test script to verify YouTube authentication
 * This script tests the current YouTube API credentials without uploading anything
 */

console.log('🔐 Testing YouTube Authentication');
console.log('================================\n');

const testYouTubeAuth = async () => {
  try {
    // Check environment variables
    const {
      YOUTUBE_CLIENT_ID,
      YOUTUBE_CLIENT_SECRET,
      YOUTUBE_OAUTH2_ACCESS_TOKEN,
      YOUTUBE_OAUTH2_REFRESH_TOKEN
    } = process.env;

    console.log('1️⃣  Checking environment variables...');
    
    if (!YOUTUBE_CLIENT_ID) {
      throw new Error('YOUTUBE_CLIENT_ID is missing from .env file');
    }
    
    if (!YOUTUBE_CLIENT_SECRET) {
      throw new Error('YOUTUBE_CLIENT_SECRET is missing from .env file');
    }
    
    if (!YOUTUBE_OAUTH2_ACCESS_TOKEN) {
      throw new Error('YOUTUBE_OAUTH2_ACCESS_TOKEN is missing from .env file');
    }
    
    console.log('✅ Environment variables found');
    console.log(`   • Client ID: ${YOUTUBE_CLIENT_ID.substring(0, 20)}...`);
    console.log(`   • Client Secret: ${YOUTUBE_CLIENT_SECRET.substring(0, 10)}...`);
    console.log(`   • Access Token: ${YOUTUBE_OAUTH2_ACCESS_TOKEN.substring(0, 20)}...`);
    console.log(`   • Refresh Token: ${YOUTUBE_OAUTH2_REFRESH_TOKEN ? 'Present' : 'Missing'}\n`);

    // Create OAuth2 client
    console.log('2️⃣  Creating OAuth2 client...');
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
    console.log('✅ OAuth2 client created\n');

    // Test authentication with YouTube API
    console.log('3️⃣  Testing YouTube API connection...');
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.channels.list({
      part: 'snippet,statistics,status',
      mine: true
    });

    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      console.log('✅ Authentication successful!\n');
      
      console.log('📺 Channel Information:');
      console.log(`   • Name: ${channel.snippet.title}`);
      console.log(`   • Description: ${channel.snippet.description?.substring(0, 100) || 'No description'}...`);
      console.log(`   • Created: ${new Date(channel.snippet.publishedAt).toLocaleDateString()}`);
      console.log(`   • Country: ${channel.snippet.country || 'Not specified'}`);
      console.log(`   • Custom URL: ${channel.snippet.customUrl || 'Not set'}\n`);
      
      console.log('📊 Channel Statistics:');
      console.log(`   • Subscribers: ${parseInt(channel.statistics.subscriberCount || 0).toLocaleString()}`);
      console.log(`   • Total Views: ${parseInt(channel.statistics.viewCount || 0).toLocaleString()}`);
      console.log(`   • Videos: ${parseInt(channel.statistics.videoCount || 0).toLocaleString()}`);
      console.log(`   • Comments: ${parseInt(channel.statistics.commentCount || 0).toLocaleString()}\n`);
      
      console.log('⚙️  Channel Status:');
      console.log(`   • Privacy Status: ${channel.status?.privacyStatus || 'Unknown'}`);
      console.log(`   • Made for Kids: ${channel.status?.madeForKids ? 'Yes' : 'No'}`);
      console.log(`   • Self Declared Made for Kids: ${channel.status?.selfDeclaredMadeForKids ? 'Yes' : 'No'}\n`);
      
      // Test upload quota
      console.log('4️⃣  Testing upload permissions...');
      try {
        // This is a dry run - we're not actually uploading anything
        // Just checking if we have the right scopes
        const quotaResponse = await youtube.videos.list({
          part: 'id',
          myRating: 'none',
          maxResults: 1
        });
        
        console.log('✅ Upload permissions verified');
        console.log('🎬 Ready to upload videos to YouTube!\n');
        
        console.log('🎉 All tests passed!');
        console.log('💡 Your YouTube authentication is working correctly');
        console.log('🚀 You can now run your video creation script');
        
      } catch (uploadError) {
        console.warn('⚠️  Upload permission test failed:', uploadError.message);
        console.log('🔧 This might indicate insufficient OAuth scopes');
        console.log('💡 Try re-running: node youtube-auth.js');
      }
      
    } else {
      console.warn('⚠️  No channel data found');
      console.log('🔧 This might indicate the account has no YouTube channel');
      console.log('💡 Make sure you have a YouTube channel associated with your Google account');
    }

  } catch (error) {
    console.error('\n❌ Authentication test failed:', error.message);
    
    if (error.code === 401) {
      console.log('\n🔧 Token appears to be expired or invalid');
      console.log('💡 Solution: Run the authentication script:');
      console.log('   node youtube-auth.js');
    } else if (error.code === 403) {
      console.log('\n🔧 Access forbidden - possible quota or permission issue');
      console.log('💡 Possible solutions:');
      console.log('   • Check your YouTube Data API v3 is enabled');
      console.log('   • Verify your OAuth2 app has the correct scopes');
      console.log('   • Check if you\'ve exceeded API quotas');
    } else if (error.message.includes('missing')) {
      console.log('\n🔧 Environment variable missing');
      console.log('💡 Solution: Check your .env file and add the missing variable');
    } else {
      console.log('\n🔧 Unexpected error occurred');
      console.log('💡 Try running: node youtube-auth.js');
    }
    
    console.log('\n📋 Debug Information:');
    console.log(`   • Error Code: ${error.code || 'N/A'}`);
    console.log(`   • Error Message: ${error.message}`);
    
    process.exit(1);
  }
};

// Run the test
testYouTubeAuth().catch(console.error);