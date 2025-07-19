#!/usr/bin/env node

import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Test script to verify auto-title extraction functionality
 */

/**
 * Simulates the extractTitleFromFile function from publish.js
 */
const extractTitleFromFile = async (videoPath) => {
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
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length > 0) {
          // First line should be the title
          const title = lines[0].trim();
          
          // Remove markdown heading syntax if present
          const cleanTitle = title.replace(/^#+\s*/, '');
          
          if (cleanTitle.length > 0) {
            console.log(`📝 Auto-detected title from ${txtPath}: "${cleanTitle}"`);
            return cleanTitle;
          }
        }
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

async function testAutoTitleExtraction() {
  console.log('🧪 Testing auto-title extraction...\n');
  
  // Test cases with existing files
  const testCases = [
    'output/hexclad-hybrid-cookware-set-203834.mp4',
    'output/pelican-catch-pwr-100-965170.mp4',
    'output/hexclad-18-piece-cookware-set-616968.mp4'
  ];
  
  for (const videoPath of testCases) {
    console.log(`🎬 Testing: ${videoPath}`);
    
    const title = await extractTitleFromFile(videoPath);
    
    if (title) {
      console.log(`✅ Success: "${title}"`);
    } else {
      console.log(`❌ Failed: No title found`);
    }
    console.log('');
  }
  
  // Test edge cases
  console.log('🔍 Testing edge cases...\n');
  
  // Test with non-existent file
  console.log('🎬 Testing: non-existent-video.mp4');
  const noTitle = await extractTitleFromFile('non-existent-video.mp4');
  if (noTitle) {
    console.log(`❌ Unexpected: Found title "${noTitle}" for non-existent file`);
  } else {
    console.log(`✅ Correct: No title found for non-existent file`);
  }
  
  console.log('\n🎯 Auto-title extraction test completed!');
}

// Run the test
testAutoTitleExtraction().catch(console.error);