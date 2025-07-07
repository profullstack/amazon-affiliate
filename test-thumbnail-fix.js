import { createThumbnail } from './src/thumbnail-generator.js';
import fs from 'fs/promises';

/**
 * Test script to verify thumbnail creation works
 */

const testProductData = {
  title: 'KitchenAid Fully Automatic Espresso Machine',
  images: [
    'https://m.media-amazon.com/images/I/71QZ8Z8Z8ZL._AC_SL1500_.jpg'
  ]
};

async function testThumbnailCreation() {
  console.log('🧪 Testing thumbnail creation fix...\n');

  try {
    // Ensure output directory exists
    await fs.mkdir('./output', { recursive: true });
    
    const thumbnailPath = './output/test-thumbnail-fix.jpg';
    const promotionPath = './output/test-thumbnail-fix.png';
    
    console.log('🎨 Creating thumbnail from product image...');
    
    const result = await createThumbnail(testProductData, thumbnailPath);
    
    console.log(`✅ Thumbnail created: ${result}`);
    
    // Check if file exists
    try {
      const stats = await fs.stat(thumbnailPath);
      console.log(`📏 File size: ${Math.round(stats.size / 1024)}KB`);
      
      // Create PNG version for promotion
      const sharp = (await import('sharp')).default;
      await sharp(thumbnailPath)
        .png()
        .toFile(promotionPath);
      
      console.log(`✅ PNG version created: ${promotionPath}`);
      
      const pngStats = await fs.stat(promotionPath);
      console.log(`📏 PNG file size: ${Math.round(pngStats.size / 1024)}KB`);
      
    } catch (error) {
      throw new Error(`Thumbnail file not found: ${error.message}`);
    }
    
    console.log('\n🎉 Thumbnail creation test passed!');
    console.log('💡 The thumbnail generation should now work in the main workflow.');
    
  } catch (error) {
    console.error('❌ Thumbnail test failed:', error.message);
    console.error('🔧 This needs to be fixed before thumbnails will work properly.');
    process.exit(1);
  }
}

// Run the test
testThumbnailCreation().catch(console.error);