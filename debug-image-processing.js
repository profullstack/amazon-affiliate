import { processImagesWithSmartBackground } from './src/image-processor.js';
import fs from 'fs/promises';
import path from 'path';

async function debugImageProcessing() {
  console.log('🔍 Debugging image processing for short video...');
  
  // Check what images are available in temp
  try {
    const tempFiles = await fs.readdir('./temp');
    console.log('📁 Files in temp directory:', tempFiles);
    
    // Find original images
    const originalImages = tempFiles.filter(f => f.startsWith('image-') && !f.includes('smart-bg'));
    const smartBgImages = tempFiles.filter(f => f.includes('smart-bg'));
    
    console.log('🖼️ Original images:', originalImages);
    console.log('🎨 Smart background images:', smartBgImages);
    
    if (originalImages.length > 0) {
      // Test processing with the original images
      const imagePaths = originalImages.map(f => `./temp/${f}`);
      console.log('\n🧪 Testing processImagesWithSmartBackground...');
      console.log('Input paths:', imagePaths);
      
      const processedPaths = await processImagesWithSmartBackground(
        imagePaths,
        './temp',
        1080,
        1920
      );
      
      console.log('Output paths:', processedPaths);
      
      // Check if processing actually created new files
      const sameAsPaths = processedPaths.every((processed, i) => 
        path.resolve(processed) === path.resolve(imagePaths[i])
      );
      
      console.log('🔍 Are processed paths same as input paths?', sameAsPaths);
      
      // Check file sizes to see if they're different
      for (let i = 0; i < Math.min(imagePaths.length, processedPaths.length); i++) {
        try {
          const originalStat = await fs.stat(imagePaths[i]);
          const processedStat = await fs.stat(processedPaths[i]);
          
          console.log(`📊 Image ${i + 1}:`);
          console.log(`   Original: ${imagePaths[i]} (${originalStat.size} bytes)`);
          console.log(`   Processed: ${processedPaths[i]} (${processedStat.size} bytes)`);
          console.log(`   Same file: ${path.resolve(imagePaths[i]) === path.resolve(processedPaths[i])}`);
        } catch (error) {
          console.log(`❌ Error checking image ${i + 1}:`, error.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugImageProcessing();