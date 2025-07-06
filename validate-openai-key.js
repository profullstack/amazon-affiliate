import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Validates OpenAI API key by making a simple test request
 */
const validateOpenAIKey = async () => {
  console.log('🔍 Validating OpenAI API Key...\n');

  // Check if API key exists
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY not found in environment variables');
    console.log('💡 Please add your OpenAI API key to the .env file:');
    console.log('   OPENAI_API_KEY=your_actual_api_key_here');
    return false;
  }

  // Check API key format
  console.log('📋 API Key Information:');
  console.log(`   Length: ${apiKey.length} characters`);
  console.log(`   Starts with: ${apiKey.substring(0, 7)}...`);
  console.log(`   Format: ${apiKey.startsWith('sk-') ? '✅ Correct (sk-...)' : '❌ Invalid format (should start with sk-)'}`);

  if (!apiKey.startsWith('sk-')) {
    console.log('\n❌ Invalid API key format. OpenAI API keys should start with "sk-"');
    console.log('💡 Please check your API key and ensure it\'s copied correctly');
    return false;
  }

  // Test API connection
  console.log('\n🔄 Testing API connection...');
  
  try {
    const openai = new OpenAI({
      apiKey: apiKey
    });

    // Make a simple test request
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Say "API key is working" in exactly those words.'
        }
      ],
      max_tokens: 10,
      temperature: 0
    });

    const result = response.choices[0]?.message?.content;
    
    if (result) {
      console.log('✅ API Connection Successful!');
      console.log(`📝 Test Response: "${result}"`);
      console.log(`💰 Model Used: ${response.model}`);
      console.log(`🔢 Tokens Used: ${response.usage?.total_tokens || 'unknown'}`);
      
      // Test different models
      console.log('\n🧪 Testing Available Models...');
      
      const models = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
      
      for (const model of models) {
        try {
          const testResponse = await openai.chat.completions.create({
            model: model,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1,
            temperature: 0
          });
          
          console.log(`   ✅ ${model}: Available`);
        } catch (error) {
          if (error.status === 404) {
            console.log(`   ❌ ${model}: Not available (model not found)`);
          } else if (error.status === 429) {
            console.log(`   ⚠️ ${model}: Rate limited (but accessible)`);
          } else {
            console.log(`   ❌ ${model}: Error - ${error.message}`);
          }
        }
      }
      
      return true;
      
    } else {
      console.log('❌ API responded but with empty content');
      console.log('🔍 Full response:', JSON.stringify(response, null, 2));
      return false;
    }

  } catch (error) {
    console.log('❌ API Connection Failed!');
    console.log(`📋 Error Type: ${error.constructor.name}`);
    console.log(`📋 Error Message: ${error.message}`);
    
    if (error.status) {
      console.log(`📋 HTTP Status: ${error.status}`);
      
      switch (error.status) {
        case 401:
          console.log('💡 This indicates an invalid API key');
          console.log('   - Check that your API key is correct');
          console.log('   - Ensure the key hasn\'t expired');
          console.log('   - Verify the key has proper permissions');
          break;
        case 429:
          console.log('💡 This indicates rate limiting');
          console.log('   - You may have exceeded your quota');
          console.log('   - Wait a moment and try again');
          console.log('   - Check your OpenAI usage dashboard');
          break;
        case 403:
          console.log('💡 This indicates insufficient permissions');
          console.log('   - Your API key may not have access to the requested model');
          console.log('   - Check your OpenAI plan and permissions');
          break;
        default:
          console.log('💡 Unexpected error - check OpenAI status and your internet connection');
      }
    }
    
    return false;
  }
};

// Run validation
validateOpenAIKey().then(isValid => {
  console.log('\n' + '='.repeat(50));
  if (isValid) {
    console.log('🎉 OpenAI API Key Validation: SUCCESS');
    console.log('✅ Your API key is working correctly');
    console.log('✅ You can now use AI-powered script generation');
  } else {
    console.log('💥 OpenAI API Key Validation: FAILED');
    console.log('❌ Please fix the issues above before using AI features');
    console.log('🔗 Get a new API key at: https://platform.openai.com/api-keys');
  }
  console.log('='.repeat(50));
}).catch(error => {
  console.error('💥 Validation script failed:', error.message);
});