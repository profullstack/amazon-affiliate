/**
 * Test script for complete publish workflow with auto-detection using actual files
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
 * Attempts to automatically extract title and description from corresponding .txt file
 * @param {string} videoPath - Path to video file
 * @returns {Promise<{title: string|null, description: string|null, txtPath: string|null}>} - Extracted data or null if not found
 */
const extractTitleAndDescriptionFromFile = async (videoPath) => {
  try {
    // Get the base name without extension
    const baseName = videoPath.replace(/\.[^/.]+$/, '');
    
    // Try to find corresponding .txt file
    const possiblePaths = [
      `${baseName}.txt`,
      `${baseName}-description.txt`,
      videoPath.replace(/\.mp4$/, '.txt'),
      videoPath.replace(/\.mov$/, '.txt'),
      videoPath.replace(/\.avi$/, '.txt')
    ];
    
    for (const txtPath of possiblePaths) {
      try {
        const content = await readFile(txtPath, 'utf-8');
        const lines = content.split('\n');
        
        if (lines.length > 0) {
          // First line should be the title
          const title = lines[0].trim();
          
          // Remove markdown heading syntax if present
          const cleanTitle = title.replace(/^#+\s*/, '');
          
          // Rest of the content is the description (skip empty first line if title was repeated)
          let descriptionLines = lines.slice(1);
          
          // If second line is the same as title, skip it too
          if (descriptionLines.length > 0 && descriptionLines[0].trim() === cleanTitle) {
            descriptionLines = descriptionLines.slice(1);
          }
          
          // Skip any empty lines at the beginning
          while (descriptionLines.length > 0 && !descriptionLines[0].trim()) {
            descriptionLines = descriptionLines.slice(1);
          }
          
          const description = descriptionLines.join('\n').trim();
          
          if (cleanTitle.length > 0) {
            console.log(`📝 Auto-detected title from ${txtPath}: "${cleanTitle}"`);
            if (description.length > 0) {
              console.log(`📄 Auto-detected description from ${txtPath} (${description.length} characters)`);
            }
            return { title: cleanTitle, description: description || null, txtPath };
          }
        }
      } catch (error) {
        // File doesn't exist or can't be read, continue to next possibility
        continue;
      }
    }
    
    return { title: null, description: null, txtPath: null };
  } catch (error) {
    return { title: null, description: null, txtPath: null };
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
 * Test complete publish workflow auto-detection using actual files
 */
const testCompleteWorkflow = async () => {
  console.log('🧪 Testing Complete Publish Workflow Auto-Detection (Corrected)\n');
  
  // Test cases using actual .txt files that exist
  const testCases = [
    // Test with actual .txt files that exist
    {
      txtFile: 'output/hexclad-18-piece-cookware-set-332838-short.txt',
      videoFile: 'output/hexclad-18-piece-cookware-set-332838-short.mp4',
      thumbnailFile: 'output/hexclad-18piece-cookware-set-265231-short.thumb.jpg'
    },
    {
      txtFile: 'output/hexclad-18-piece-cookware-set-332668.txt',
      videoFile: 'output/hexclad-18-piece-cookware-set-332668.mp4',
      thumbnailFile: 'output/hexclad-18piece-cookware-set-265231-thumbnail.jpg'
    },
    {
      txtFile: 'output/pelican-catch-pwr-100-966040-short.txt',
      videoFile: 'output/pelican-catch-pwr-100-966040-short.mp4',
      thumbnailFile: 'output/pelican-catch-pwr-100-865847-short.thumb.jpg'
    }
  ];
  
  let successCount = 0;
  let totalTests = 0;
  
  for (const testCase of testCases) {
    totalTests++;
    console.log(`\n📹 Testing Complete Workflow:`);
    console.log(`   TXT: ${testCase.txtFile}`);
    console.log(`   Video: ${testCase.videoFile}`);
    console.log(`   Expected Thumbnail: ${testCase.thumbnailFile}`);
    console.log('=' .repeat(80));
    
    try {
      // Test title and description extraction from actual .txt file
      const autoData = await extractTitleAndDescriptionFromFile(testCase.videoFile);
      
      // Test thumbnail detection
      const thumbnailPath = await autoDetectThumbnail(testCase.videoFile);
      
      // Summary
      console.log(`\n📊 Auto-Detection Summary:`);
      console.log(`   Title: ${autoData.title ? '✅ Found' : '❌ Not found'}`);
      console.log(`   Description: ${autoData.description ? '✅ Found' : '❌ Not found'}`);
      console.log(`   Thumbnail: ${thumbnailPath ? '✅ Found' : '❌ Not found'}`);
      
      if (autoData.title) {
        console.log(`   📝 Title: "${autoData.title}"`);
      }
      
      if (autoData.description) {
        const preview = autoData.description.length > 100 
          ? autoData.description.substring(0, 100) + '...'
          : autoData.description;
        console.log(`   📄 Description preview: "${preview}"`);
      }
      
      if (thumbnailPath) {
        const stats = await stat(thumbnailPath);
        console.log(`   🖼️  Thumbnail: ${thumbnailPath} (${Math.round(stats.size / 1024)}KB)`);
      }
      
      // Check if we have all required data for publishing
      const hasTitle = autoData.title !== null;
      const hasDescription = autoData.description !== null;
      const hasThumbnail = thumbnailPath !== null;
      
      if (hasTitle && hasDescription && hasThumbnail) {
        console.log(`\n🎉 Complete auto-detection successful! Ready for publishing.`);
        successCount++;
      } else {
        console.log(`\n⚠️  Partial auto-detection. Missing:`);
        if (!hasTitle) console.log(`     - Title`);
        if (!hasDescription) console.log(`     - Description`);
        if (!hasThumbnail) console.log(`     - Thumbnail`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Complete Workflow Test Results:`);
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   Fully successful: ${successCount}`);
  console.log(`   Success rate: ${Math.round((successCount / totalTests) * 100)}%`);
  
  if (successCount === totalTests) {
    console.log(`\n🎉 All tests passed! Complete auto-detection workflow is working perfectly.`);
  } else {
    console.log(`\n⚠️  Some tests had partial success. Check individual results above.`);
  }
  
  // Now test the actual .txt file to show it works
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 Testing Direct .txt File Reading:`);
  
  try {
    const content = await readFile('output/hexclad-18-piece-cookware-set-332838-short.txt', 'utf-8');
    const lines = content.split('\n');
    const title = lines[0].trim();
    const description = lines.slice(2).join('\n').trim(); // Skip empty line
    
    console.log(`✅ Direct .txt file reading successful:`);
    console.log(`   📝 Title: "${title}"`);
    console.log(`   📄 Description length: ${description.length} characters`);
    console.log(`   📄 Description preview: "${description.substring(0, 150)}..."`);
  } catch (error) {
    console.log(`❌ Direct .txt file reading failed: ${error.message}`);
  }
};

// Run the test
testCompleteWorkflow().catch(console.error);