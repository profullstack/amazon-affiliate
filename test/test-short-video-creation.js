#!/usr/bin/env node

/**
 * Test script to debug short video creation issues
 */

import { createAffiliateVideo } from './src/index.js';

const testShortVideoCreation = async () => {
  console.log('🧪 Testing short video creation...');
  
  try {
    const result = await createAffiliateVideo('B0CPZKLJX1', {
      maxImages: 2,
      videoQuality: 'medium',
      tempDir: './temp',
      outputDir: './output',
      cleanup: false, // Keep files for debugging
      autoUpload: false,
      createShortVideo: true,
      enableBackgroundMusic: false, // Disable to avoid audio issues
      onProgress: (progress) => {
        console.log(`[${progress.step}] ${progress.progress}% - ${progress.message}`);
      }
    });
    
    console.log('\n✅ Test completed');
    console.log('📋 Result:', {
      success: result.success,
      hasShortVideo: !!result.files?.shortVideo,
      shortVideoPath: result.files?.shortVideo,
      error: result.error
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
};

testShortVideoCreation();