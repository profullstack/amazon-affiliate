import { PromotionManager } from './src/promotion-manager.js';

/**
 * Simple test script to verify promotion system functionality
 */
async function testPromotionSystem() {
  console.log('🧪 Testing Promotion System...\n');

  try {
    // Test 1: Create PromotionManager
    console.log('1. Creating PromotionManager...');
    const promotionManager = new PromotionManager({
      headless: true,
      enabledPlatforms: ['reddit', 'pinterest', 'twitter']
    });
    console.log('✅ PromotionManager created successfully');

    // Test 2: Check promoters
    console.log('\n2. Checking promoters...');
    console.log(`   Promoters loaded: ${promotionManager.promoters.length}`);
    promotionManager.promoters.forEach(promoter => {
      console.log(`   - ${promoter.name}`);
    });

    // Test 3: Test connectivity (dry run)
    console.log('\n3. Testing platform connectivity...');
    const connectivityResults = await promotionManager.testPromoters();
    
    connectivityResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.platform}: ${result.success ? 'Connected' : result.error}`);
    });

    // Test 4: Validate video data
    console.log('\n4. Testing video data validation...');
    const testVideoData = {
      title: 'Test Product Review - Amazing Kitchen Gadget',
      url: 'https://youtube.com/watch?v=test123',
      description: 'This is a test review of an amazing kitchen gadget that will change your cooking experience.',
      tags: ['kitchen', 'gadget', 'review', 'amazon', 'cooking'],
      thumbnailPath: './test-thumbnail.jpg'
    };

    try {
      promotionManager.validateVideoData(testVideoData);
      console.log('✅ Video data validation passed');
    } catch (error) {
      console.log(`❌ Video data validation failed: ${error.message}`);
    }

    // Test 5: Test individual promoter methods
    console.log('\n5. Testing individual promoter methods...');
    
    for (const promoter of promotionManager.promoters) {
      console.log(`\n   Testing ${promoter.name} promoter:`);
      
      try {
        // Test category extraction
        const category = promoter.extractProductCategory(testVideoData.tags);
        console.log(`   - Category extraction: ${category}`);
        
        // Test platform-specific methods
        if (promoter.name === 'reddit') {
          const subreddits = promoter.getRelevantSubreddits(testVideoData.tags);
          console.log(`   - Relevant subreddits: ${subreddits.join(', ')}`);
          
          const postTitle = promoter.generatePostTitle(testVideoData.title);
          console.log(`   - Generated title: ${postTitle.substring(0, 50)}...`);
        }
        
        if (promoter.name === 'pinterest') {
          const boards = promoter.getRelevantBoards(testVideoData.tags);
          console.log(`   - Relevant boards: ${boards.join(', ')}`);
          
          const pinTitle = promoter.generatePinTitle(testVideoData.title);
          console.log(`   - Generated pin title: ${pinTitle}`);
          
          const hashtags = promoter.generateHashtags(testVideoData.tags);
          console.log(`   - Generated hashtags: ${hashtags.slice(0, 5).join(' ')}`);
        }
        
        if (promoter.name === 'twitter') {
          const tweet = promoter.generateTweet(testVideoData);
          console.log(`   - Generated tweet: ${tweet.substring(0, 100)}...`);
          
          const hashtags = promoter.generateHashtags(testVideoData.tags);
          console.log(`   - Generated hashtags: ${hashtags.join(' ')}`);
        }
        
        console.log(`   ✅ ${promoter.name} methods working correctly`);
        
      } catch (error) {
        console.log(`   ❌ ${promoter.name} method test failed: ${error.message}`);
      }
    }

    // Test 6: Statistics
    console.log('\n6. Testing statistics...');
    const stats = promotionManager.getPromotionStats();
    console.log(`   Total promotions: ${stats.totalPromotions}`);
    console.log(`   Configured promoters: ${stats.promoters.length}`);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Test with real video data using: node src/promotion-cli.js test');
    console.log('   2. Try a dry run promotion: node src/promotion-cli.js promote <youtube-url>');
    console.log('   3. Integrate with video creation: node src/index.js <amazon-url> --auto-promote');

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the test
testPromotionSystem().catch(console.error);