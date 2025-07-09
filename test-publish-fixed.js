#!/usr/bin/env node

/**
 * Test script to verify the fixed publish command functionality
 */

import { readFile } from 'fs/promises';

// Simulate the fixed extractTitleAndDescriptionFromFile function
const extractTitleAndDescriptionFromFile = async (videoPath) => {
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
        const lines = content.split('\n');
        
        if (lines.length > 0) {
          const title = lines[0].trim();
          const cleanTitle = title.replace(/^#+\s*/, '');
          
          let descriptionLines = lines.slice(1);
          
          if (descriptionLines.length > 0 && descriptionLines[0].trim() === cleanTitle) {
            descriptionLines = descriptionLines.slice(1);
          }
          
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
        continue;
      }
    }
    
    return { title: null, description: null, txtPath: null };
  } catch (error) {
    return { title: null, description: null, txtPath: null };
  }
};

async function testPublishFixed() {
  console.log('🧪 Testing fixed publish command functionality...\n');
  
  // Test with existing file
  console.log('📋 Test 1: Auto-detection with existing file');
  const result1 = await extractTitleAndDescriptionFromFile('output/hexclad-hybrid-cookware-set-203834.mp4');
  
  if (result1.title) {
    console.log(`✅ Title: "${result1.title}"`);
    if (result1.description) {
      console.log(`✅ Description: ${result1.description.length} characters`);
      console.log(`📄 First 100 chars: "${result1.description.substring(0, 100)}..."`);
    } else {
      console.log(`❌ No description found`);
    }
  } else {
    console.log(`❌ No title found`);
  }
  
  console.log('\n📋 Test 2: Auto-detection with short video file');
  const result2 = await extractTitleAndDescriptionFromFile('output/hexclad-hybrid-cookware-set-203834-short.mp4');
  
  if (result2.title) {
    console.log(`✅ Title: "${result2.title}"`);
    if (result2.description) {
      console.log(`✅ Description: ${result2.description.length} characters`);
    } else {
      console.log(`❌ No description found`);
    }
  } else {
    console.log(`❌ No title found`);
  }
  
  console.log('\n🎯 Test completed!');
  console.log('\n💡 Expected behavior:');
  console.log('   - Extract title from first line of .txt file');
  console.log('   - Extract description from rest of .txt file content');
  console.log('   - Skip duplicate title line if present');
  console.log('   - Handle both regular and short video files');
}

// Run the test
testPublishFixed().catch(console.error);