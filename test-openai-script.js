import dotenv from 'dotenv';
import {
  generateAIReviewScript,
  estimateScriptDuration,
  validateScriptInputs,
  getAvailableModels,
  getAvailableStyles
} from './src/openai-script-generator.js';

// Load environment variables
dotenv.config();

/**
 * Test script to demonstrate OpenAI-powered review script generation
 */
const testOpenAIScriptGeneration = async () => {
  console.log('🤖 Testing OpenAI-powered script generation...');

  try {
    // Mock product data for testing
    const mockProductData = {
      title: 'Sony WH-1000XM4 Wireless Premium Noise Canceling Overhead Headphones',
      price: '$279.99',
      rating: 4.4,
      reviewCount: '47,284 reviews',
      features: [
        'Industry-leading noise canceling with Dual Noise Sensor technology',
        '30-hour battery life with quick charge (10 min charge for 5 hours of playback)',
        'Touch Sensor controls to pause play skip tracks, control volume, activate your voice assistant, and answer phone calls',
        'Speak-to-chat technology automatically reduces volume during conversations',
        'Superior call quality with precise voice pickup',
        'Wearing detection pauses playback when headphones are removed'
      ],
      description: `Sony's intelligent industry-leading noise canceling headphones with premium sound, unleash the best in music with the WH-1000XM4 headphones. Over 30 hours of battery life with quick charge capabilities, touch sensor controls, speak-to-chat technology, and superior call quality make these headphones perfect for long listening sessions. Whether you're working from home or on the go, the WH-1000XM4 headphones deliver exceptional sound quality and comfort.`,
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=400&fit=crop'
      ]
    };

    console.log('📋 Product Data:');
    console.log(`   Title: ${mockProductData.title}`);
    console.log(`   Price: ${mockProductData.price}`);
    console.log(`   Rating: ${mockProductData.rating} stars (${mockProductData.reviewCount})`);
    console.log(`   Features: ${mockProductData.features.length} listed`);
    console.log(`   Description: ${mockProductData.description.length} characters`);

    // Test input validation
    console.log('\n🔍 Testing input validation...');
    try {
      validateScriptInputs(mockProductData);
      console.log('✅ Input validation passed');
    } catch (error) {
      console.log(`❌ Input validation failed: ${error.message}`);
      return;
    }

    // Show available options
    console.log('\n⚙️ Available Options:');
    console.log('   Models:', getAvailableModels().join(', '));
    console.log('   Styles:', getAvailableStyles().join(', '));

    // Check if OpenAI API key is available
    const hasOpenAIKey = process.env.OPENAI_API_KEY;
    
    if (!hasOpenAIKey) {
      console.log('\n⚠️ OPENAI_API_KEY not found in environment variables.');
      console.log('💡 To test OpenAI script generation, add your API key to .env file:');
      console.log('   OPENAI_API_KEY=your_openai_api_key_here');
      console.log('\n✅ OpenAI script generator is ready to use once API key is added!');
      return;
    }

    console.log('\n🤖 Testing different script generation styles...');

    // Test 1: Conversational style (default)
    console.log('\n1️⃣ Testing CONVERSATIONAL style...');
    try {
      const conversationalScript = await generateAIReviewScript(mockProductData, {
        reviewStyle: 'conversational',
        temperature: 0.7,
        maxTokens: 600
      });
      
      const duration = estimateScriptDuration(conversationalScript);
      
      console.log('✅ Conversational script generated');
      console.log(`📏 Length: ${conversationalScript.length} characters`);
      console.log(`⏱️ Estimated duration: ${duration} seconds`);
      console.log('\n📄 Generated Script (Conversational):');
      console.log('=' .repeat(80));
      console.log(conversationalScript);
      console.log('=' .repeat(80));
    } catch (error) {
      console.log(`❌ Conversational script failed: ${error.message}`);
    }

    // Test 2: Professional style
    console.log('\n2️⃣ Testing PROFESSIONAL style...');
    try {
      const professionalScript = await generateAIReviewScript(mockProductData, {
        reviewStyle: 'professional',
        temperature: 0.5,
        maxTokens: 600
      });
      
      const duration = estimateScriptDuration(professionalScript);
      
      console.log('✅ Professional script generated');
      console.log(`📏 Length: ${professionalScript.length} characters`);
      console.log(`⏱️ Estimated duration: ${duration} seconds`);
      console.log('\n📄 Generated Script (Professional):');
      console.log('=' .repeat(80));
      console.log(professionalScript);
      console.log('=' .repeat(80));
    } catch (error) {
      console.log(`❌ Professional script failed: ${error.message}`);
    }

    // Test 3: Enthusiastic style
    console.log('\n3️⃣ Testing ENTHUSIASTIC style...');
    try {
      const enthusiasticScript = await generateAIReviewScript(mockProductData, {
        reviewStyle: 'enthusiastic',
        temperature: 0.8,
        maxTokens: 600
      });
      
      const duration = estimateScriptDuration(enthusiasticScript);
      
      console.log('✅ Enthusiastic script generated');
      console.log(`📏 Length: ${enthusiasticScript.length} characters`);
      console.log(`⏱️ Estimated duration: ${duration} seconds`);
      console.log('\n📄 Generated Script (Enthusiastic):');
      console.log('=' .repeat(80));
      console.log(enthusiasticScript);
      console.log('=' .repeat(80));
    } catch (error) {
      console.log(`❌ Enthusiastic script failed: ${error.message}`);
    }

    console.log('\n🎉 OpenAI script generation tests completed!');
    
    console.log('\n📊 Script Quality Comparison:');
    console.log('   🗣️ Conversational: Natural, friendly, like talking to a friend');
    console.log('   💼 Professional: Clear, articulate, factual and informative');
    console.log('   🎯 Enthusiastic: Energetic, positive, engaging and upbeat');
    
    console.log('\n💡 Benefits of AI-Generated Scripts:');
    console.log('   ✅ Natural, human-like language');
    console.log('   ✅ Contextual product information');
    console.log('   ✅ Engaging storytelling structure');
    console.log('   ✅ Proper review flow and pacing');
    console.log('   ✅ Authentic voice and tone');
    console.log('   ✅ No robotic or marketing language');

  } catch (error) {
    console.error('❌ OpenAI script generation test failed:', error.message);
    console.error(error.stack);
  }
};

// Show configuration info
console.log('🔧 OpenAI Script Generator Configuration:');
console.log('   Default Model: gpt-4o-mini (fast and cost-effective)');
console.log('   Default Style: conversational');
console.log('   Default Temperature: 0.7 (balanced creativity)');
console.log('   Max Tokens: 800 (approximately 150-200 words)');
console.log('   Target Duration: 60-90 seconds of speech');

// Run the test
testOpenAIScriptGeneration();