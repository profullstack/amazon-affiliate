import { scrapeAmazonProduct } from './src/amazon-scraper.js';

/**
 * Test script to verify enhanced zoom image extraction
 */
const testZoomExtraction = async () => {
  console.log('🧪 Testing enhanced zoom image extraction...\n');
  
  // Test with the Mint Mobile URL that previously had issues
  const testUrl = 'https://www.amazon.com/Mint-Mobile-Starter-Kit-Activation/dp/B0786RD524';
  
  try {
    console.log(`🔍 Testing URL: ${testUrl}`);
    console.log('⏳ This may take a moment as we hover over thumbnails and capture zoom images...\n');
    
    const startTime = Date.now();
    const productData = await scrapeAmazonProduct(testUrl);
    const endTime = Date.now();
    
    console.log('\n✅ Enhanced extraction completed!');
    console.log(`⏱️ Time taken: ${Math.round((endTime - startTime) / 1000)}s`);
    console.log(`📦 Product: ${productData.title}`);
    console.log(`📸 Total images extracted: ${productData.images.length}`);
    
    // Analyze image quality distribution
    const qualityAnalysis = {
      ultraHigh: productData.images.filter(img => 
        img.includes('_SL3000_') || img.includes('_SL2500_') || img.includes('_SL2000_')
      ).length,
      veryHigh: productData.images.filter(img => 
        img.includes('_SL1500_') || img.includes('_SL1200_')
      ).length,
      high: productData.images.filter(img => 
        img.includes('_SL1000_') || img.includes('_SL800_')
      ).length,
      medium: productData.images.filter(img => 
        img.includes('_SL600_') || img.includes('_SL400_')
      ).length
    };
    
    console.log('\n📊 Quality Distribution:');
    console.log(`   🔥 Ultra-High (2000px+): ${qualityAnalysis.ultraHigh} images`);
    console.log(`   ⭐ Very High (1200-1500px): ${qualityAnalysis.veryHigh} images`);
    console.log(`   ✨ High (800-1000px): ${qualityAnalysis.high} images`);
    console.log(`   📷 Medium (400-600px): ${qualityAnalysis.medium} images`);
    console.log(`   📱 Other: ${productData.images.length - qualityAnalysis.ultraHigh - qualityAnalysis.veryHigh - qualityAnalysis.high - qualityAnalysis.medium} images`);
    
    // Show sample URLs for each quality level
    console.log('\n🔗 Sample Image URLs:');
    
    const ultraHighSample = productData.images.find(img => 
      img.includes('_SL3000_') || img.includes('_SL2500_') || img.includes('_SL2000_')
    );
    if (ultraHighSample) {
      console.log(`   🔥 Ultra-High: ${ultraHighSample.substring(0, 80)}...`);
    }
    
    const veryHighSample = productData.images.find(img => 
      img.includes('_SL1500_') || img.includes('_SL1200_')
    );
    if (veryHighSample) {
      console.log(`   ⭐ Very High: ${veryHighSample.substring(0, 80)}...`);
    }
    
    const highSample = productData.images.find(img => 
      img.includes('_SL1000_') || img.includes('_SL800_')
    );
    if (highSample) {
      console.log(`   ✨ High: ${highSample.substring(0, 80)}...`);
    }
    
    // Test success criteria
    const hasUltraHighQuality = qualityAnalysis.ultraHigh > 0;
    const hasMultipleImages = productData.images.length >= 5;
    const hasValidImages = productData.images.every(img => 
      img.includes('amazon.com') || img.includes('ssl-images-amazon')
    );
    
    console.log('\n🎯 Test Results:');
    console.log(`   ${hasUltraHighQuality ? '✅' : '❌'} Ultra-high quality zoom images captured`);
    console.log(`   ${hasMultipleImages ? '✅' : '❌'} Multiple images extracted (${productData.images.length} >= 5)`);
    console.log(`   ${hasValidImages ? '✅' : '❌'} All images are valid Amazon URLs`);
    
    if (hasUltraHighQuality && hasMultipleImages && hasValidImages) {
      console.log('\n🎉 SUCCESS: Enhanced zoom extraction is working perfectly!');
      console.log('🚀 Videos will now use ultra-high quality images from zoom capture!');
    } else {
      console.log('\n⚠️ Some issues detected - may need further optimization');
    }
    
    return {
      success: hasUltraHighQuality && hasMultipleImages && hasValidImages,
      totalImages: productData.images.length,
      qualityBreakdown: qualityAnalysis,
      productTitle: productData.title,
      timeTaken: Math.round((endTime - startTime) / 1000)
    };
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Run the test
testZoomExtraction()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Unexpected error:', error.message);
    process.exit(1);
  });