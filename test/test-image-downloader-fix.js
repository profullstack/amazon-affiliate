#!/usr/bin/env node

import { downloadImages } from './src/image-downloader.js';
import fs from 'fs';
import path from 'path';

const testUrls = [
  'https://m.media-amazon.com/images/I/71abc123def.jpg',
  'https://m.media-amazon.com/images/I/81xyz789ghi.jpg',
  'https://images-na.ssl-images-amazon.com/images/I/91test456jkl.jpg'
];

async function testImageDownloader() {
  console.log('🧪 Testing image downloader with timeout improvements...');
  
  const testDir = './test-temp/image-download-test';
  
  // Create test directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const startTime = Date.now();
  
  try {
    const downloadedFiles = await downloadImages(testUrls, testDir);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Download completed in ${duration}ms`);
    console.log(`📁 Successfully downloaded ${downloadedFiles.length}/${testUrls.length} files`);
    
    // Check each downloaded file
    for (const filepath of downloadedFiles) {
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        console.log(`📁 ${path.basename(filepath)}: ${stats.size} bytes`);
      }
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Download failed after ${duration}ms: ${error.message}`);
  }
  
  console.log('\n🏁 Image downloader test completed');
}

testImageDownloader().catch(console.error);