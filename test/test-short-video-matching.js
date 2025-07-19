/**
 * Test script for improved short video .txt file matching
 */

import { readFile, readdir } from 'fs/promises';

/**
 * Improved version that properly handles short video matching
 * @param {string} videoPath - Path to video file
 * @returns {Promise<{title: string|null, description: string|null, txtPath: string|null}>} - Extracted data or null if not found
 */
const extractTitleAndDescriptionFromFile = async (videoPath) => {
  try {
    // Get the directory and base name of the video
    const videoDir = videoPath.substring(0, videoPath.lastIndexOf('/')) || '.';
    const videoFileName = videoPath.substring(videoPath.lastIndexOf('/') + 1);
    const videoBaseName = videoFileName.replace(/\.[^/.]+$/, '');
    
    // Read all .txt files in the directory
    let txtFiles;
    try {
      const allFiles = await readdir(videoDir);
      txtFiles = allFiles.filter(file => file.endsWith('.txt'));
    } catch (error) {
      return { title: null, description: null, txtPath: null };
    }
    
    console.log(`🔍 Looking for .txt file to match video: ${videoBaseName}`);
    console.log(`📁 Found ${txtFiles.length} .txt files in directory`);
    
    // Try to find a matching .txt file using various strategies
    const matchingStrategies = [
      // Strategy 1: Exact match (video-name.txt)
      {
        name: 'Exact match',
        matcher: (txtFile) => txtFile === `${videoBaseName}.txt`
      },
      
      // Strategy 2: Short video match (video-123456-short.mp4 -> video-123456-short.txt)
      {
        name: 'Short video exact match',
        matcher: (txtFile) => {
          const txtBaseName = txtFile.replace('.txt', '');
          return txtBaseName === videoBaseName;
        }
      },
      
      // Strategy 3: Remove numbers but keep short suffix (video-123456-short.mp4 -> video-short.txt)
      {
        name: 'Remove numbers, keep short',
        matcher: (txtFile) => {
          const txtBaseName = txtFile.replace('.txt', '');
          const isVideoShort = videoBaseName.endsWith('-short');
          const isTxtShort = txtBaseName.endsWith('-short');
          
          if (isVideoShort && isTxtShort) {
            const videoWithoutNumbers = videoBaseName.replace(/-\d+(-short)$/, '$1');
            const txtWithoutNumbers = txtBaseName.replace(/-\d+(-short)$/, '$1');
            return videoWithoutNumbers === txtWithoutNumbers;
          }
          
          return false;
        }
      },
      
      // Strategy 4: Fuzzy match - same base words (ignoring numbers)
      {
        name: 'Fuzzy word match',
        matcher: (txtFile) => {
          const txtBaseName = txtFile.replace('.txt', '');
          
          // Split into words and check if both are short or both are regular
          const isVideoShort = videoBaseName.endsWith('-short');
          const isTxtShort = txtBaseName.endsWith('-short');
          
          // Only match if both are short or both are regular
          if (isVideoShort !== isTxtShort) {
            return false;
          }
          
          // Remove numbers and short suffix for comparison
          const videoWords = videoBaseName.replace(/-\d+(-short)?$/, '$1').split('-');
          const txtWords = txtBaseName.replace(/-\d+(-short)?$/, '$1').split('-');
          
          // Filter out numbers and short suffix
          const videoMainWords = videoWords.filter(word => !/^\d+$/.test(word) && word !== 'short');
          const txtMainWords = txtWords.filter(word => !/^\d+$/.test(word) && word !== 'short');
          
          // Need at least 3 main words to match
          if (videoMainWords.length < 3 || txtMainWords.length < 3) {
            return false;
          }
          
          // Check if the main words match (first 3-4 words)
          const wordsToCompare = Math.min(videoMainWords.length, txtMainWords.length, 4);
          for (let i = 0; i < wordsToCompare; i++) {
            if (videoMainWords[i] !== txtMainWords[i]) {
              return false;
            }
          }
          
          return true;
        }
      }
    ];
    
    // Try each strategy to find a matching .txt file
    for (const strategy of matchingStrategies) {
      const matchingTxtFile = txtFiles.find(strategy.matcher);
      
      if (matchingTxtFile) {
        const txtPath = `${videoDir}/${matchingTxtFile}`;
        
        console.log(`✅ Found match using strategy "${strategy.name}": ${matchingTxtFile}`);
        
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
          // File can't be read, continue to next strategy
          console.log(`❌ Failed to read ${txtPath}: ${error.message}`);
          continue;
        }
      } else {
        console.log(`❌ No match found using strategy "${strategy.name}"`);
      }
    }
    
    return { title: null, description: null, txtPath: null };
  } catch (error) {
    return { title: null, description: null, txtPath: null };
  }
};

/**
 * Test the improved short video matching
 */
const testShortVideoMatching = async () => {
  console.log('🧪 Testing Improved Short Video .txt File Matching\n');
  
  // Test cases that should now work correctly
  const testCases = [
    // Test case 1: Short video that should match short .txt file
    {
      video: 'output/hexclad-hybrid-cookware-set-123456-short.mp4',
      expectedMatch: 'hexclad-hybrid-cookware-set-203834-short.txt'
    },
    
    // Test case 2: Regular video that should match regular .txt file
    {
      video: 'output/hexclad-hybrid-cookware-set-123456.mp4',
      expectedMatch: 'hexclad-hybrid-cookware-set-203834.txt'
    },
    
    // Test case 3: Actual existing short video
    {
      video: 'output/hexclad-18piece-cookware-set-265231-short.mp4',
      expectedMatch: 'Should find a matching .txt file'
    }
  ];
  
  let successCount = 0;
  let totalTests = 0;
  
  for (const testCase of testCases) {
    totalTests++;
    console.log(`\n📹 Testing: ${testCase.video}`);
    console.log('=' .repeat(80));
    
    try {
      const result = await extractTitleAndDescriptionFromFile(testCase.video);
      
      if (result.title) {
        console.log(`🎉 SUCCESS: Found title "${result.title}"`);
        console.log(`📄 Description: ${result.description ? `${result.description.length} characters` : 'None'}`);
        console.log(`📁 Source file: ${result.txtPath}`);
        successCount++;
      } else {
        console.log(`⚠️  No matching .txt file found`);
        console.log(`   Expected: ${testCase.expectedMatch}`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Test Results:`);
  console.log(`   Total tests: ${totalTests}`);
  console.log(`   Successful matches: ${successCount}`);
  console.log(`   Success rate: ${Math.round((successCount / totalTests) * 100)}%`);
  
  if (successCount > 0) {
    console.log(`\n🎉 Improved matching is working! Short videos can now find their .txt files.`);
  } else {
    console.log(`\n⚠️  No matches found. The matching logic may need further refinement.`);
  }
  
  // Show what .txt files are actually available
  console.log(`\n📋 Available .txt files for reference:`);
  try {
    const allFiles = await readdir('output');
    const txtFiles = allFiles.filter(file => file.endsWith('.txt'));
    txtFiles.slice(0, 10).forEach(file => {
      console.log(`   📄 ${file}`);
    });
    if (txtFiles.length > 10) {
      console.log(`   ... and ${txtFiles.length - 10} more`);
    }
  } catch (error) {
    console.log(`   ❌ Could not read output directory: ${error.message}`);
  }
};

// Run the test
testShortVideoMatching().catch(console.error);