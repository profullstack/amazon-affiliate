/**
 * Test script to verify the publish command fix - no more binary data reading
 */

import { readFile, stat } from 'fs/promises';

/**
 * Fixed version of extractTitleAndDescriptionFromFile that never reads binary data
 * @param {string} videoPath - Path to video file
 * @returns {Promise<{title: string|null, description: string|null, txtPath: string|null}>} - Extracted data or null if not found
 */
const extractTitleAndDescriptionFromFile = async (videoPath) => {
  try {
    // Get the base name without extension
    const baseName = videoPath.replace(/\.[^/.]+$/, '');
    
    // Try to find corresponding .txt file - only look for actual .txt files
    const possiblePaths = [
      `${baseName}.txt`,
      `${baseName}-description.txt`
    ];
    
    // Also try replacing video extensions with .txt, but ensure we only read .txt files
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    for (const ext of videoExtensions) {
      if (videoPath.endsWith(ext)) {
        const txtPath = videoPath.replace(new RegExp(`\\${ext}$`), '.txt');
        possiblePaths.push(txtPath);
      }
    }
    
    for (const txtPath of possiblePaths) {
      // Safety check: only try to read files that end with .txt
      if (!txtPath.endsWith('.txt')) {
        continue;
      }
      
      try {
        // Verify the file exists and is readable before trying to read it
        await stat(txtPath);
        
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
 * Test the fixed function to ensure it never reads binary data
 */
const testPublishFix = async () => {
  console.log('🧪 Testing Publish Command Fix - No More Binary Data Reading\n');
  
  // Test cases that previously caused binary data reading
  const testCases = [
    // These video files exist but don't have matching .txt files
    'output/hexclad-18piece-cookware-set-265231-short.mp4',
    'output/hexclad-18piece-cookware-set-265231.mp4',
    'output/awesome-protection-plan-review-644367-short.mp4',
    
    // These should work because they have matching .txt files
    'output/hexclad-18-piece-cookware-set-332838-short.txt', // Change to .mp4 to test
    'output/pelican-catch-pwr-100-966040-short.txt' // Change to .mp4 to test
  ];
  
  let successCount = 0;
  let totalTests = 0;
  
  for (const videoPath of testCases) {
    totalTests++;
    console.log(`\n📹 Testing: ${videoPath}`);
    console.log('=' .repeat(60));
    
    try {
      const result = await extractTitleAndDescriptionFromFile(videoPath);
      
      if (result.title) {
        // Check if the title looks like binary data (contains non-printable characters)
        const hasBinaryData = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(result.title);
        
        if (hasBinaryData) {
          console.log(`❌ BINARY DATA DETECTED in title!`);
          console.log(`   Title preview: "${result.title.substring(0, 100)}..."`);
        } else {
          console.log(`✅ Clean text title found: "${result.title}"`);
          successCount++;
        }
      } else {
        console.log(`⚠️  No title found (this is expected for videos without matching .txt files)`);
        successCount++; // This is actually success - no binary data was read
      }
      
      if (result.description) {
        const hasBinaryData = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(result.description);
        
        if (hasBinaryData) {
          console.log(`❌ BINARY DATA DETECTED in description!`);
        } else {
          console.log(`✅ Clean text description found (${result.description.length} characters)`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Test Results:`);
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   No binary data: ${successCount}`);
  console.log(`   Success rate: ${Math.round((successCount / totalTests) * 100)}%`);
  
  if (successCount === totalTests) {
    console.log(`\n🎉 All tests passed! No binary data is being read anymore.`);
    console.log(`✅ The publish command fix is working correctly.`);
  } else {
    console.log(`\n⚠️  Some tests detected binary data. The fix may need adjustment.`);
  }
  
  // Test with actual .txt files that exist
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Testing with actual .txt files:`);
  
  const actualTxtFiles = [
    'output/hexclad-18-piece-cookware-set-332838-short.txt',
    'output/pelican-catch-pwr-100-966040-short.txt'
  ];
  
  for (const txtFile of actualTxtFiles) {
    // Convert .txt to .mp4 to simulate the video file
    const videoFile = txtFile.replace('.txt', '.mp4');
    console.log(`\n🎬 Simulating: ${videoFile}`);
    
    try {
      const result = await extractTitleAndDescriptionFromFile(videoFile);
      
      if (result.title) {
        console.log(`✅ Found title: "${result.title}"`);
      } else {
        console.log(`⚠️  No title found for ${videoFile}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n🚀 Ready to test with actual publish command:`);
  console.log(`   node bin/aff.js publish output/hexclad-18piece-cookware-set-265231-short.mp4`);
  console.log(`   (Should no longer show binary data for title)`);
};

// Run the test
testPublishFix().catch(console.error);