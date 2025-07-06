import { 
  generateProductReviewScript, 
  generateVoiceover,
  DEFAULT_VOICE_SETTINGS,
  NATURAL_VOICE_SETTINGS,
  CONVERSATIONAL_VOICE_SETTINGS
} from './src/voiceover-generator.js';
import fs from 'fs/promises';

/**
 * Test script to demonstrate voice quality improvements
 */
const testVoiceImprovements = async () => {
  console.log('🎤 Testing AI voice improvements...');

  try {
    // Create test directories
    await fs.mkdir('temp', { recursive: true });
    await fs.mkdir('output', { recursive: true });

    // Mock product data for testing
    const mockProductData = {
      title: 'Amazing Wireless Headphones - Premium Sound Quality',
      price: '$89.99',
      rating: 4.5,
      reviewCount: '1,234 reviews',
      features: [
        'Active Noise Cancellation',
        '30-hour battery life',
        'Premium sound quality',
        'Comfortable over-ear design'
      ],
      description: 'Experience premium audio with these wireless headphones featuring advanced noise cancellation technology and exceptional battery life.',
      images: [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg'
      ]
    };

    // Generate enhanced product review script
    console.log('📝 Generating enhanced product review script...');
    const reviewScript = generateProductReviewScript(mockProductData);
    console.log('\n📄 Generated Script:');
    console.log('=' .repeat(60));
    console.log(reviewScript);
    console.log('=' .repeat(60));

    // Test different voice settings (if API keys are available)
    const hasApiKeys = process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID;
    
    if (!hasApiKeys) {
      console.log('\n⚠️ ElevenLabs API credentials not found in environment variables.');
      console.log('💡 To test voice generation, add your API credentials to .env file:');
      console.log('   ELEVENLABS_API_KEY=your_api_key_here');
      console.log('   ELEVENLABS_VOICE_ID=your_voice_id_here');
      console.log('\n✅ Script generation and voice settings are ready to use!');
      return;
    }

    console.log('\n🎙️ Testing different voice settings...');

    // Test 1: Default settings (more robotic)
    console.log('\n1️⃣ Testing DEFAULT voice settings (baseline)...');
    try {
      const defaultVoice = await generateVoiceover(
        "Hello! This is a test of the default voice settings.",
        'temp/test-voice-default.mp3',
        DEFAULT_VOICE_SETTINGS
      );
      console.log(`✅ Default voice generated: ${defaultVoice}`);
    } catch (error) {
      console.log(`❌ Default voice test failed: ${error.message}`);
    }

    // Test 2: Natural settings
    console.log('\n2️⃣ Testing NATURAL voice settings...');
    try {
      const naturalVoice = await generateVoiceover(
        "Hey there! This is a test of the natural voice settings with more expression.",
        'temp/test-voice-natural.mp3',
        NATURAL_VOICE_SETTINGS
      );
      console.log(`✅ Natural voice generated: ${naturalVoice}`);
    } catch (error) {
      console.log(`❌ Natural voice test failed: ${error.message}`);
    }

    // Test 3: Conversational settings (best for reviews)
    console.log('\n3️⃣ Testing CONVERSATIONAL voice settings (recommended)...');
    try {
      const conversationalVoice = await generateVoiceover(
        "What's up everyone! This is a test of the conversational voice settings. It should sound much more natural and engaging, perfect for product reviews!",
        'temp/test-voice-conversational.mp3',
        CONVERSATIONAL_VOICE_SETTINGS
      );
      console.log(`✅ Conversational voice generated: ${conversationalVoice}`);
    } catch (error) {
      console.log(`❌ Conversational voice test failed: ${error.message}`);
    }

    // Test 4: Full product review with enhanced script
    console.log('\n4️⃣ Testing full product review with enhanced script...');
    try {
      const fullReviewVoice = await generateVoiceover(
        reviewScript,
        'temp/test-voice-full-review.mp3'
        // Uses CONVERSATIONAL_VOICE_SETTINGS by default
      );
      console.log(`✅ Full review voice generated: ${fullReviewVoice}`);
    } catch (error) {
      console.log(`❌ Full review voice test failed: ${error.message}`);
    }

    console.log('\n🎉 Voice improvement tests completed!');
    console.log('\n📊 Voice Quality Comparison:');
    console.log('   🤖 Default Settings: More robotic, monotone');
    console.log('   😊 Natural Settings: Balanced, moderate expression');
    console.log('   🗣️ Conversational Settings: Most natural, engaging for reviews');
    
    console.log('\n💡 Listen to the generated audio files to hear the differences:');
    console.log('   • temp/test-voice-default.mp3 (baseline)');
    console.log('   • temp/test-voice-natural.mp3 (improved)');
    console.log('   • temp/test-voice-conversational.mp3 (best for reviews)');
    console.log('   • temp/test-voice-full-review.mp3 (complete enhanced review)');

  } catch (error) {
    console.error('❌ Voice improvement test failed:', error.message);
    console.error(error.stack);
  }
};

// Show voice settings comparison
console.log('🔧 Voice Settings Comparison:');
console.log('\nDEFAULT (Robotic):');
console.log(JSON.stringify(DEFAULT_VOICE_SETTINGS, null, 2));
console.log('\nNATURAL (Balanced):');
console.log(JSON.stringify(NATURAL_VOICE_SETTINGS, null, 2));
console.log('\nCONVERSATIONAL (Best for Reviews):');
console.log(JSON.stringify(CONVERSATIONAL_VOICE_SETTINGS, null, 2));

// Run the test
testVoiceImprovements();