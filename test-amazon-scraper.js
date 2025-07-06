import { scrapeAmazonProduct } from './src/amazon-scraper.js';

/**
 * Test script to verify enhanced Amazon scraper functionality
 */
const testAmazonScraper = async () => {
  console.log('🔍 Testing Enhanced Amazon Scraper...\n');

  const testUrl = 'https://www.amazon.com/dp/B0F1GMCQPB';
  
  try {
    console.log(`📋 Testing URL: ${testUrl}`);
    console.log('🔄 Scraping product data...\n');
    
    const productData = await scrapeAmazonProduct(testUrl);
    
    console.log('✅ Scraping completed! Here\'s what was extracted:\n');
    
    // Display extracted data
    console.log('📝 PRODUCT INFORMATION:');
    console.log('=' .repeat(50));
    
    console.log(`📌 Title: ${productData.title || 'Not found'}`);
    console.log(`💰 Price: ${productData.price || 'Not found'}`);
    console.log(`⭐ Rating: ${productData.rating || 'Not found'}`);
    console.log(`📊 Review Count: ${productData.reviewCount || 'Not found'}`);
    console.log(`📸 Images Found: ${productData.images?.length || 0}`);
    console.log(`🔧 Features Found: ${productData.features?.length || 0}`);
    console.log(`📄 Description Length: ${productData.description?.length || 0} characters`);
    
    console.log('\n🔧 FEATURES:');
    console.log('-' .repeat(30));
    if (productData.features && productData.features.length > 0) {
      productData.features.forEach((feature, index) => {
        console.log(`${index + 1}. ${feature}`);
      });
    } else {
      console.log('No features extracted');
    }
    
    console.log('\n📸 IMAGES:');
    console.log('-' .repeat(30));
    if (productData.images && productData.images.length > 0) {
      productData.images.forEach((image, index) => {
        console.log(`${index + 1}. ${image.substring(0, 80)}...`);
      });
    } else {
      console.log('No images extracted');
    }
    
    console.log('\n📄 DESCRIPTION PREVIEW:');
    console.log('-' .repeat(30));
    if (productData.description) {
      console.log(productData.description.substring(0, 200) + '...');
    } else {
      console.log('No description extracted');
    }
    
    // Data quality assessment
    console.log('\n📊 DATA QUALITY ASSESSMENT:');
    console.log('=' .repeat(50));
    
    const checks = [
      { name: 'Title', value: productData.title, status: productData.title ? '✅' : '❌' },
      { name: 'Price', value: productData.price, status: productData.price ? '✅' : '❌' },
      { name: 'Rating', value: productData.rating, status: productData.rating ? '✅' : '❌' },
      { name: 'Review Count', value: productData.reviewCount, status: productData.reviewCount ? '✅' : '❌' },
      { name: 'Images', value: `${productData.images?.length || 0} found`, status: (productData.images?.length || 0) > 0 ? '✅' : '❌' },
      { name: 'Features', value: `${productData.features?.length || 0} found`, status: (productData.features?.length || 0) > 0 ? '✅' : '❌' },
      { name: 'Description', value: `${productData.description?.length || 0} chars`, status: (productData.description?.length || 0) > 0 ? '✅' : '❌' }
    ];
    
    checks.forEach(check => {
      console.log(`${check.status} ${check.name}: ${check.value}`);
    });
    
    const successCount = checks.filter(check => check.status === '✅').length;
    const totalCount = checks.length;
    const successRate = Math.round((successCount / totalCount) * 100);
    
    console.log(`\n📈 Overall Success Rate: ${successCount}/${totalCount} (${successRate}%)`);
    
    if (successRate >= 80) {
      console.log('🎉 Excellent! Scraper is working well.');
    } else if (successRate >= 60) {
      console.log('⚠️ Good, but some data is missing. Amazon may have changed their layout.');
    } else {
      console.log('❌ Poor extraction rate. Amazon layout may have significantly changed.');
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('=' .repeat(50));
    
    if (!productData.price) {
      console.log('💰 Price not found - Amazon may be using new price selectors');
    }
    if (!productData.rating) {
      console.log('⭐ Rating not found - Check if product has reviews');
    }
    if (!productData.features || productData.features.length === 0) {
      console.log('🔧 Features not found - Product may not have bullet points');
    }
    if (!productData.images || productData.images.length === 0) {
      console.log('📸 Images not found - This is critical for video creation');
    }
    
    console.log('\n✅ Amazon scraper test completed!');
    
  } catch (error) {
    console.error('❌ Amazon scraper test failed:', error.message);
    console.error('\n🔍 Possible causes:');
    console.error('- Amazon blocked the request (try different user agent)');
    console.error('- Network connectivity issues');
    console.error('- Amazon changed their page structure');
    console.error('- Invalid product URL');
  }
};

// Run the test
testAmazonScraper();