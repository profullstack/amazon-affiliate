#!/usr/bin/env node

/**
 * Test script to verify the publish command's auto-title detection
 * This simulates the publish workflow without actually uploading to YouTube
 */

import { readFile } from 'fs/promises';

// Simulate the extractTitleFromFile function from publish.js
const extractTitleFromFile = async (videoPath) => {
  try {
    const baseName = videoPath.replace(/\.[^/.]+$/, '');
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
          const title = lines[0].trim();
          const cleanTitle = title.replace(/^#+\s*/, '');
          
          if (cleanTitle.length > 0) {
            console.log(`📝 Auto-detected title from ${txtPath}: "${cleanTitle}"`);
            return cleanTitle;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

// Simulate the publish workflow
const simulatePublishWorkflow = async (videoPath, providedTitle = null) => {
  console.log(`🎬 Simulating publish for: ${videoPath}`);
  
  let finalTitle = providedTitle;
  
  if (!finalTitle) {
    // Try auto-detection
    const autoTitle = await extractTitleFromFile(videoPath);
    
    if (autoTitle) {
      finalTitle = autoTitle;
      console.log(`✅ Using auto-detected title`);
    } else {
      console.log(`❌ No title found - would prompt user`);
      return;
    }
  } else {
    console.log(`📝 Using provided title: "${finalTitle}"`);
  }
  
  console.log(`🚀 Would upload with title: "${finalTitle}"`);
  console.log('');
};

async function testPublishAutoTitle() {
  console.log('🧪 Testing publish command auto-title detection...\n');
  
  // Test 1: Auto-detection with existing file
  console.log('📋 Test 1: Auto-detection with existing file');
  await simulatePublishWorkflow('output/hexclad-hybrid-cookware-set-203834.mp4');
  
  // Test 2: Manual title override
  console.log('📋 Test 2: Manual title override');
  await simulatePublishWorkflow(
    'output/hexclad-hybrid-cookware-set-203834.mp4', 
    'Custom Title Override'
  );
  
  // Test 3: Auto-detection with different file
  console.log('📋 Test 3: Auto-detection with different file');
  await simulatePublishWorkflow('output/pelican-catch-pwr-100-965170.mp4');
  
  // Test 4: No corresponding .txt file
  console.log('📋 Test 4: No corresponding .txt file');
  await simulatePublishWorkflow('output/non-existent-video.mp4');
  
  console.log('🎯 Publish auto-title test completed!');
  console.log('\n💡 Expected behavior:');
  console.log('   - When no --title is provided, automatically extract from .txt file');
  console.log('   - When --title is provided, use it instead of auto-detection');
  console.log('   - When no .txt file exists, prompt user for title');
  console.log('   - Show clear feedback about title source');
}

// Run the test
testPublishAutoTitle().catch(console.error);