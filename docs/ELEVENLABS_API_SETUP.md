# Eleven Labs API Setup Guide

This guide will walk you through obtaining the required Eleven Labs API credentials for AI voiceover generation in the Amazon Affiliate Video Automation application.

## 📋 Required Credentials

You need these values for your `.env` file:
- `ELEVENLABS_API_KEY` - Your API key for authentication
- `ELEVENLABS_VOICE_ID` - The voice ID to use for generation (optional, has default)

## 🚀 Step-by-Step Setup

### Step 1: Create an Eleven Labs Account

1. **Visit Eleven Labs Website**
   - Go to: https://elevenlabs.io/
   - Click "Sign Up" in the top right corner

2. **Create Your Account**
   - You can sign up with:
     - Email and password
     - Google account
     - GitHub account
   - Verify your email if required

3. **Choose a Plan**
   - **Free Tier**: 10,000 characters per month
   - **Starter**: $5/month for 30,000 characters
   - **Creator**: $22/month for 100,000 characters
   - **Pro**: $99/month for 500,000 characters
   
   For testing, the free tier is sufficient. For production use, consider a paid plan.

### Step 2: Get Your API Key

1. **Access Your Profile**
   - Once logged in, click on your profile icon in the top right
   - Select "Profile" from the dropdown menu

2. **Find Your API Key**
   - Scroll down to the "API Key" section
   - Your API key will be displayed (starts with something like `sk-...`)
   - Click the "Copy" button to copy your API key

3. **Keep Your API Key Secure**
   - This key gives access to your account and credits
   - Never share it publicly or commit it to version control

### Step 3: Choose a Voice (Optional)

The application uses a default voice, but you can customize it:

1. **Browse Available Voices**
   - Go to the "VoiceLab" section in your dashboard
   - Browse the available voices
   - Click on any voice to hear a preview

2. **Get Voice ID**
   - When you find a voice you like, click on it
   - The voice ID will be in the URL or voice details
   - Common voice IDs:
     - `21m00Tcm4TlvDq8ikWAM` - Rachel (default, female, American)
     - `EXAVITQu4vr4xnSDxMaL` - Bella (female, American)
     - `ErXwobaYiN019PkySvjV` - Antoni (male, American)
     - `MF3mGyEYCl7XYWbV9V6O` - Elli (female, American)
     - `TxGEqnHWrfWFTfGW9XjX` - Josh (male, American)

3. **Test Voice Quality**
   - Use the voice lab to test different voices with your content
   - Consider the tone and style that matches your brand

### Step 4: Update Your .env File

Add the credentials to your `.env` file:

```env
# Eleven Labs API Configuration
ELEVENLABS_API_KEY=sk-1234567890abcdef1234567890abcdef
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

**Note**: If you don't specify `ELEVENLABS_VOICE_ID`, the application will use the default voice.

## 🔧 Testing Your Setup

Create a simple test script to verify your credentials work:

```javascript
// test-elevenlabs-auth.js
import fetch from 'node-fetch';
import 'dotenv/config';

const testElevenLabsAPI = async () => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY not found in environment variables');
    return;
  }

  try {
    // Test 1: Check API key validity by getting user info
    console.log('🔍 Testing API key...');
    const userResponse = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': apiKey
      }
    });

    if (!userResponse.ok) {
      throw new Error(`API key test failed: ${userResponse.status} ${userResponse.statusText}`);
    }

    const userData = await userResponse.json();
    console.log('✅ API key is valid!');
    console.log(`📊 Character limit: ${userData.subscription.character_limit}`);
    console.log(`📈 Characters used: ${userData.subscription.character_count}`);

    // Test 2: Check voice availability
    console.log('\n🎤 Testing voice availability...');
    const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey
      }
    });

    if (!voicesResponse.ok) {
      throw new Error(`Voices test failed: ${voicesResponse.status} ${voicesResponse.statusText}`);
    }

    const voicesData = await voicesResponse.json();
    const selectedVoice = voicesData.voices.find(v => v.voice_id === voiceId);

    if (selectedVoice) {
      console.log(`✅ Voice found: ${selectedVoice.name} (${selectedVoice.voice_id})`);
      console.log(`🎭 Category: ${selectedVoice.category}`);
    } else {
      console.log(`⚠️  Voice ID ${voiceId} not found. Available voices:`);
      voicesData.voices.slice(0, 5).forEach(voice => {
        console.log(`   - ${voice.name} (${voice.voice_id})`);
      });
    }

    // Test 3: Generate a small sample (optional - uses credits)
    const testGeneration = process.argv.includes('--test-generation');
    if (testGeneration) {
      console.log('\n🎵 Testing voice generation (this will use credits)...');
      
      const generateResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'This is a test of the Eleven Labs API integration.',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75
          }
        })
      });

      if (generateResponse.ok) {
        console.log('✅ Voice generation test successful!');
        console.log('🎉 Your Eleven Labs setup is complete and working!');
      } else {
        console.error('❌ Voice generation test failed:', generateResponse.statusText);
      }
    }

  } catch (error) {
    console.error('❌ Eleven Labs API test failed:', error.message);
  }
};

testElevenLabsAPI();
```

Run the test:
```bash
# Basic test (doesn't use credits)
node test-elevenlabs-auth.js

# Full test including voice generation (uses a few credits)
node test-elevenlabs-auth.js --test-generation
```

## 💰 Understanding Pricing and Limits

### Free Tier Limits
- **10,000 characters per month**
- Access to all voices
- Commercial usage allowed
- No credit card required

### Character Usage Tips
- The application processes product descriptions
- Average product description: 200-500 characters
- With free tier: ~20-50 videos per month
- Monitor usage in your Eleven Labs dashboard

### Optimizing Character Usage
```javascript
// The application automatically optimizes text:
// - Removes excessive whitespace
// - Truncates very long descriptions
// - Focuses on key product features
```

## 🔧 Advanced Configuration

### Custom Voice Settings

You can customize voice parameters by modifying the application:

```javascript
// In src/voiceover-generator.js, you can adjust:
const customVoiceSettings = {
  stability: 0.75,        // 0.0 to 1.0 (higher = more stable)
  similarity_boost: 0.75, // 0.0 to 1.0 (higher = more similar to original)
  style: 0.0,            // 0.0 to 1.0 (style exaggeration)
  use_speaker_boost: true // Enhance speaker clarity
};
```

### Voice Selection Strategy

For affiliate marketing videos, consider:

**Professional/Trustworthy**: Rachel, Bella, Josh
**Energetic/Enthusiastic**: Antoni, Elli
**Calm/Soothing**: Domi, Dave

## 🚨 Important Notes

### API Key Security
- Never commit your API key to version control
- Store it securely in environment variables
- Rotate keys periodically for security

### Rate Limiting
- Eleven Labs has rate limits to prevent abuse
- The application includes retry logic with exponential backoff
- For high-volume usage, consider implementing queuing

### Content Guidelines
- Follow Eleven Labs' content policy
- Don't generate harmful or inappropriate content
- Respect copyright and trademark laws

### Monitoring Usage
- Check your dashboard regularly for usage statistics
- Set up billing alerts if using paid plans
- Monitor for unexpected usage spikes

## 🔗 Useful Links

- [Eleven Labs Website](https://elevenlabs.io/)
- [API Documentation](https://docs.elevenlabs.io/)
- [Voice Library](https://elevenlabs.io/voice-library)
- [Pricing Plans](https://elevenlabs.io/pricing)
- [Content Policy](https://elevenlabs.io/content-policy)

## 🆘 Troubleshooting

### Common Issues

**"Invalid API key"**
- Double-check you copied the full API key
- Ensure no extra spaces or characters
- Verify the key in your Eleven Labs dashboard

**"Insufficient credits"**
- Check your usage in the dashboard
- Upgrade to a paid plan if needed
- Wait for monthly reset on free tier

**"Voice not found"**
- Verify the voice ID is correct
- Use the test script to see available voices
- Try the default voice ID: `21m00Tcm4TlvDq8ikWAM`

**"Rate limit exceeded"**
- Wait a few minutes before retrying
- The application includes automatic retry logic
- Consider upgrading for higher rate limits

**"Audio generation failed"**
- Check if text is too long (max ~5000 characters)
- Verify text doesn't contain unsupported characters
- Try with simpler text first

### Getting Help

If you encounter issues:
1. Check the Eleven Labs status page
2. Review their documentation
3. Contact Eleven Labs support
4. Check the application logs for detailed error messages

The test script above will help diagnose most common issues with your setup.