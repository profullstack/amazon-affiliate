import 'dotenv/config';
import { generateAIVideoTitle, generateAIVideoDescription } from './src/openai-script-generator.js';

/**
 * Test script for AI-powered title and description generation
 */

const testProductData = {
  title: 'KitchenAid Fully Automatic Espresso Machine KF8 with Milk Attachment & Plant Based Milk Options, KES8558SX, Stainless Steel',
  price: '$1,799.99',
  rating: 4.2,
  reviewCount: '156 reviews',
  features: [
    'Fully automatic espresso machine',
    'Built-in milk frother',
    'Plant-based milk compatibility',
    'Stainless steel construction',
    'Professional-grade brewing'
  ],
  description: 'Experience café-quality espresso at home with the KitchenAid Fully Automatic Espresso Machine. Features advanced brewing technology, integrated milk frother for perfect lattes and cappuccinos, and compatibility with both dairy and plant-based milks. The sleek stainless steel design complements any kitchen while delivering consistent, professional results.',
  amazonUrl: 'https://www.amazon.com/dp/B0CTCZ389V'
};

async function testAIEnhancements() {
  console.log('🧪 Testing AI-powered title and description generation...\n');

  try {
    // Test AI title generation
    console.log('🎬 Testing AI Video Title Generation:');
    console.log('=' .repeat(50));
    
    const aiTitle = await generateAIVideoTitle(testProductData, {
      temperature: 0.8
    });
    
    console.log(`✅ Generated Title: "${aiTitle}"`);
    console.log(`📏 Title Length: ${aiTitle.length} characters`);
    console.log(`✓ Under 60 chars: ${aiTitle.length <= 60 ? 'Yes' : 'No'}\n`);

    // Test AI description generation
    console.log('📝 Testing AI Video Description Generation:');
    console.log('=' .repeat(50));
    
    const aiDescription = await generateAIVideoDescription(testProductData, aiTitle, {
      temperature: 0.7,
      includeTimestamps: true,
      includeHashtags: true
    });
    
    console.log(`✅ Generated Description:`);
    console.log('-'.repeat(30));
    console.log(aiDescription);
    console.log('-'.repeat(30));
    console.log(`📏 Description Length: ${aiDescription.length} characters`);
    console.log(`✓ Includes timestamps: ${aiDescription.includes('0:00') ? 'Yes' : 'No'}`);
    console.log(`✓ Includes hashtags: ${aiDescription.includes('#') ? 'Yes' : 'No'}`);
    console.log(`✓ Includes engagement CTA: ${aiDescription.toLowerCase().includes('like') || aiDescription.toLowerCase().includes('subscribe') ? 'Yes' : 'No'}`);

    console.log('\n🎉 AI enhancement tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('💡 Make sure your OPENAI_API_KEY is set in your .env file');
    process.exit(1);
  }
}

// Run the test
testAIEnhancements().catch(console.error);