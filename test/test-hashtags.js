#!/usr/bin/env node

/**
 * Test script to verify hashtag generation functionality
 */

// Simulate the generateHashtags function from description-writer.js
const generateHashtags = (videoTitle, description) => {
  const commonHashtags = [
    '#Amazon', '#AmazonFinds', '#ProductReview', '#Review', 
    '#Affiliate', '#Shopping', '#Deal', '#Recommendation'
  ];
  
  const contentText = `${videoTitle} ${description}`.toLowerCase();
  const specificHashtags = [];
  
  // Product category hashtags
  const categoryMap = {
    'kitchen': ['#Kitchen', '#Cooking', '#KitchenGadgets'],
    'cookware': ['#Cookware', '#Kitchen', '#Cooking'],
    'headphones': ['#Headphones', '#Audio', '#Tech'],
    'wireless': ['#Wireless', '#Tech', '#Bluetooth'],
    'kayak': ['#Kayak', '#Outdoor', '#Water', '#Fishing'],
    'fishing': ['#Fishing', '#Outdoor', '#Water'],
    'outdoor': ['#Outdoor', '#Adventure'],
    'tech': ['#Tech', '#Technology', '#Gadgets'],
    'home': ['#Home', '#HomeImprovement'],
    'fitness': ['#Fitness', '#Health', '#Workout'],
    'beauty': ['#Beauty', '#Skincare', '#Makeup'],
    'gaming': ['#Gaming', '#Games', '#Gamer'],
    'car': ['#Car', '#Auto', '#Automotive'],
    'phone': ['#Phone', '#Mobile', '#Smartphone'],
    'laptop': ['#Laptop', '#Computer', '#Tech'],
    'camera': ['#Camera', '#Photography', '#Photo']
  };
  
  // Check for category keywords and add relevant hashtags
  for (const [keyword, hashtags] of Object.entries(categoryMap)) {
    if (contentText.includes(keyword)) {
      specificHashtags.push(...hashtags);
    }
  }
  
  // Brand-specific hashtags
  const brandMap = {
    'hexclad': ['#HexClad'],
    'kitchenaid': ['#KitchenAid'],
    'ninja': ['#Ninja'],
    'instant pot': ['#InstantPot'],
    'apple': ['#Apple'],
    'samsung': ['#Samsung'],
    'sony': ['#Sony'],
    'bose': ['#Bose'],
    'pelican': ['#Pelican']
  };
  
  for (const [brand, hashtags] of Object.entries(brandMap)) {
    if (contentText.includes(brand)) {
      specificHashtags.push(...hashtags);
    }
  }
  
  // Combine and deduplicate hashtags
  const allHashtags = [...commonHashtags, ...specificHashtags];
  const uniqueHashtags = [...new Set(allHashtags)];
  
  // Limit to 15 hashtags to avoid spam
  return uniqueHashtags.slice(0, 15);
};

async function testHashtagGeneration() {
  console.log('🧪 Testing hashtag generation...\n');
  
  // Test cases
  const testCases = [
    {
      title: 'HexClad Hybrid Cookware Set Review - Is It Worth $1,137?',
      description: 'This premium cookware set features innovative technology for the kitchen.',
      expected: ['#HexClad', '#Cookware', '#Kitchen', '#Cooking']
    },
    {
      title: 'Pelican Catch PWR 100 Kayak Review - Is It Worth $1,399?',
      description: 'Perfect for fishing and outdoor adventures on the water.',
      expected: ['#Pelican', '#Kayak', '#Outdoor', '#Water', '#Fishing']
    },
    {
      title: 'Wireless Headphones Review - Amazing Audio Quality',
      description: 'These wireless headphones deliver incredible sound for tech enthusiasts.',
      expected: ['#Wireless', '#Tech', '#Bluetooth', '#Headphones', '#Audio']
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📋 Test ${i + 1}: ${testCase.title}`);
    
    const hashtags = generateHashtags(testCase.title, testCase.description);
    
    console.log(`📝 Generated hashtags (${hashtags.length}): ${hashtags.join(' ')}`);
    
    // Check if expected hashtags are present
    const foundExpected = testCase.expected.filter(tag => hashtags.includes(tag));
    const missingExpected = testCase.expected.filter(tag => !hashtags.includes(tag));
    
    if (foundExpected.length > 0) {
      console.log(`✅ Found expected: ${foundExpected.join(', ')}`);
    }
    
    if (missingExpected.length > 0) {
      console.log(`❌ Missing expected: ${missingExpected.join(', ')}`);
    }
    
    // Check for common hashtags
    const hasCommon = hashtags.some(tag => ['#Amazon', '#ProductReview', '#Review'].includes(tag));
    if (hasCommon) {
      console.log(`✅ Includes common hashtags`);
    } else {
      console.log(`❌ Missing common hashtags`);
    }
    
    console.log('');
  }
  
  console.log('🎯 Hashtag generation test completed!');
  console.log('\n💡 Expected behavior:');
  console.log('   - Include common Amazon/review hashtags');
  console.log('   - Add category-specific hashtags based on content');
  console.log('   - Add brand-specific hashtags when detected');
  console.log('   - Limit to 15 hashtags maximum');
  console.log('   - Remove duplicates');
}

// Run the test
testHashtagGeneration().catch(console.error);