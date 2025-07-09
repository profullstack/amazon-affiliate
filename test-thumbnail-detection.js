/**
 * Test script for thumbnail auto-detection functionality
 */

import { readFile, stat } from 'fs/promises';

/**
 * Validates that a file exists and is readable
 * @param {string} filePath - Path to file
 * @param {string} fileType - Type description for error messages
 */
const validateFile = async (filePath, fileType = 'File') => {
  try {
    await stat(filePath);
  } catch (error) {
    throw new Error(`${fileType} not found: ${filePath}`);
  }
};

/**
 * Attempts to automatically detect thumbnail based on video filename
 * @param {string} videoPath - Path to video file
 * @returns {Promise<string|null>} - Thumbnail path or null if not found
 */
const autoDetectThumbnail = async (videoPath) => {
  try {
    // Get the base name without extension
    const baseName = videoPath.replace(/\.[^/.]+$/, '');
    
    // Check if this is a short video
    const isShortVideo = baseName.includes('-short');
    
    // Try to find corresponding thumbnail file
    const possiblePaths = [];
    
    if (isShortVideo) {
      // For short videos, try short.thumb.jpg first, then regular thumbnail
      possiblePaths.push(
        `${baseName}.thumb.jpg`,
        `${baseName.replace('-short', '')}-thumbnail.jpg`,
        `${baseName}-thumbnail.jpg`
      );
    } else {
      // For regular videos, try thumbnail.jpg first
      possiblePaths.push(
        `${baseName}-thumbnail.jpg`,
        `${baseName}.thumbnail.jpg`,
        videoPath.replace(/\.mp4$/, '-thumbnail.jpg'),
        videoPath.replace(/\.mov$/, '-thumbnail.jpg'),
        videoPath.replace(/\.avi$/, '-thumbnail.jpg')
      );
    }
    
    for (const thumbnailPath of possiblePaths) {
      try {
        await validateFile(thumbnailPath, 'Thumbnail');
        console.log(`🖼️  Auto-detected thumbnail: ${thumbnailPath}`);
        return thumbnailPath;
      } catch (error) {
        // File doesn't exist or can't be read, continue to next possibility
        continue;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Test thumbnail detection for various video files
 */
const testThumbnailDetection = async () => {
  console.log('🧪 Testing Thumbnail Auto-Detection\n');
  
  // Test cases based on actual files in output directory
  const testCases = [
    // Regular videos
    'output/kitchenaid-espresso-machine-review-071850.mp4',
    'output/delonghi-rivelia-automatic-espresso-186634.mp4',
    'output/pelican-catch-pwr-100-214945.mp4',
    
    // Short videos
    'output/hexclad-18piece-cookware-set-265231-short.mp4',
    'output/awesome-protection-plan-review-644367-short.mp4',
    'output/pelican-catch-pwr-100-865847-short.mp4',
    
    // Non-existent videos (should return null)
    'output/non-existent-video.mp4',
    'output/another-missing-video-short.mp4'
  ];
  
  let successCount = 0;
  let totalTests = 0;
  
  for (const videoPath of testCases) {
    totalTests++;
    console.log(`\n📹 Testing: ${videoPath}`);
    
    try {
      const thumbnailPath = await autoDetectThumbnail(videoPath);
      
      if (thumbnailPath) {
        console.log(`   ✅ Found thumbnail: ${thumbnailPath}`);
        
        // Verify the thumbnail file actually exists
        try {
          const stats = await stat(thumbnailPath);
          console.log(`   📊 Thumbnail size: ${Math.round(stats.size / 1024)}KB`);
          successCount++;
        } catch (error) {
          console.log(`   ❌ Thumbnail file doesn't exist: ${thumbnailPath}`);
        }
      } else {
        console.log(`   ⚠️  No thumbnail found`);
        
        // For non-existent videos, this is expected
        if (videoPath.includes('non-existent') || videoPath.includes('missing')) {
          console.log(`   ✅ Expected result for non-existent video`);
          successCount++;
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Test Results:`);
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Success rate: ${Math.round((successCount / totalTests) * 100)}%`);
  
  if (successCount === totalTests) {
    console.log(`\n🎉 All tests passed! Thumbnail auto-detection is working correctly.`);
  } else {
    console.log(`\n⚠️  Some tests failed. Check the results above.`);
  }
};

// Run the test
testThumbnailDetection().catch(console.error);