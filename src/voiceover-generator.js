import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

/**
 * Recommended ElevenLabs Voices for Product Reviews
 *
 * This collection includes a diverse set of high-quality voices optimized for product reviews.
 * The system automatically selects a random voice for each voiceover generation to provide
 * variety and prevent monotony across multiple videos.
 *
 * Voice Categories:
 * - Male Voices: Antoni, Adam, Sam, Jake, Drew
 * - Female Voices: Rachel, Bella, Elli, Grace, Charlotte
 *
 * Each voice has been selected for its clarity, professionalism, and suitability for
 * product review content.
 */
const VOICES = {
  // Male Voices
  antoni: 'ErXwobaYiN019PkySvjV',   // Antoni: Professional, Clear
  adam: 'pNInz6obpgDQGcFmaJgB',     // Adam: Authoritative, Deep
  sam: 'yoZ06aMxZJJ28mfd3POQ',      // Sam: Friendly, Conversational
  jake: 'onwK4e9ZLuTAKqWW03F9',     // Jake: Upbeat, Dynamic
  drew: '29vD33N1CtxCmqQRPOHJ',     // Drew: Warm, Confident

  // Female Voices
  rachel: '21m00Tcm4TlvDq8ikWAM',   // Rachel: Clear, Professional, Trustworthy
  bella: 'EXAVITQu4vr4xnSDxMaL',    // Bella: Warm, Friendly, Engaging
  elli: 'MF3mGyEYCl7XYWbV9V6O',     // Elli: Bright, Energetic, Youthful
  grace: 'oWAxZDx7w5VEj9dCyTzz',    // Grace: Calm, Sophisticated, Clear
  charlotte: 'XB0fDUnXU5powFXDhCwa' // Charlotte: Smooth, Authoritative
};

/**
 * Gets male voices from the VOICES object
 * @returns {Object} - Object containing male voices
 */
const getMaleVoices = () => {
  return {
    antoni: VOICES.antoni,
    adam: VOICES.adam,
    sam: VOICES.sam,
    jake: VOICES.jake,
    drew: VOICES.drew
  };
};

/**
 * Gets female voices from the VOICES object
 * @returns {Object} - Object containing female voices
 */
const getFemaleVoices = () => {
  return {
    rachel: VOICES.rachel,
    bella: VOICES.bella,
    elli: VOICES.elli,
    grace: VOICES.grace,
    charlotte: VOICES.charlotte
  };
};

/**
 * Randomly selects a voice from the available voices array
 * @param {string} gender - Optional gender preference ('male', 'female', or undefined for random)
 * @returns {string} - Voice ID for ElevenLabs API
 */
const getRandomVoice = (gender = null) => {
  let availableVoices;
  
  if (gender === 'male') {
    availableVoices = getMaleVoices();
    console.log('🎤 Using male voice selection');
  } else if (gender === 'female') {
    availableVoices = getFemaleVoices();
    console.log('🎤 Using female voice selection');
  } else {
    availableVoices = VOICES;
    console.log('🎤 Using random voice selection');
  }
  
  const voiceNames = Object.keys(availableVoices);
  const randomIndex = Math.floor(Math.random() * voiceNames.length);
  const selectedVoiceName = voiceNames[randomIndex];
  const selectedVoiceId = availableVoices[selectedVoiceName];
  
  console.log(`🎤 Selected voice: ${selectedVoiceName} (${selectedVoiceId})`);
  return selectedVoiceId;
};

/**
 * Default voice settings for Eleven Labs API
 */
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,        // Lower stability for more natural variation
  similarity_boost: 0.8, // Higher similarity for consistency
  style: 0.2,            // Add some style for expressiveness
  use_speaker_boost: true
};

/**
 * Natural voice settings for more human-like speech
 */
const NATURAL_VOICE_SETTINGS = {
  stability: 0.4,        // Even lower for more natural fluctuation
  similarity_boost: 0.85, // High similarity to maintain voice character
  style: 0.3,            // More expressive style
  use_speaker_boost: true
};

/**
 * Conversational voice settings for review-style content
 * Optimized for stable, natural speech without speed variations
 */
const CONVERSATIONAL_VOICE_SETTINGS = {
  stability: 0.6,        // Higher stability to prevent speed variations
  similarity_boost: 0.85, // High similarity for consistency
  style: 0.2,            // Lower style to reduce artificial effects
  use_speaker_boost: true
};

/**
 * Enhances text for more natural speech by adding pauses and emphasis
 * @param {string} text - Text to enhance
 * @returns {string} - Enhanced text with natural speech patterns
 */
const enhanceTextForSpeech = text => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let enhanced = text;

  // Add natural pauses after introductory phrases
  enhanced = enhanced.replace(/(Hey everyone|Hi there|What's up|Welcome back)[!.]?\s*/gi, '$1! ');
  
  // Add emphasis to important phrases
  enhanced = enhanced.replace(/\b(amazing|incredible|fantastic|excellent|outstanding)\b/gi, '*$1*');
  
  // Add pauses before conclusions
  enhanced = enhanced.replace(/\b(Overall|In conclusion|To sum up|Bottom line)\b/gi, '... $1');
  
  // Add natural breathing pauses after long sentences
  enhanced = enhanced.replace(/([.!?])\s+([A-Z])/g, '$1 ... $2');
  
  // Emphasize price mentions
  enhanced = enhanced.replace(/(\$\d+(?:\.\d{2})?)/g, '*$1*');
  
  // Add pauses around ratings
  enhanced = enhanced.replace(/(\d+(?:\.\d+)?\s*(?:star|stars))/gi, '... $1 ...');

  return enhanced;
};

/**
 * Preprocesses text for voiceover generation
 * @param {string} text - Raw text to preprocess
 * @returns {string} - Cleaned and processed text
 */
const preprocessText = text => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove excessive whitespace and normalize
  let cleanText = text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  // Remove special characters that might cause issues or trigger language detection
  cleanText = cleanText.replace(/[^\w\s.,!?;:()\-'"]/g, '');

  // Remove common foreign language words/phrases that might trigger language switching
  const foreignPhrases = [
    /\b(hola|bonjour|guten tag|ciao|konnichiwa|namaste|shalom)\b/gi,
    /\b(gracias|merci|danke|grazie|arigato|dhanyawad)\b/gi,
    /\b(por favor|s'il vous plaît|bitte|per favore|onegaishimasu)\b/gi,
    /\b(sí|oui|ja|si|hai|haan)\b/gi,
    /\b(no|non|nein|iie|nahin)\b/gi
  ];

  foreignPhrases.forEach(pattern => {
    cleanText = cleanText.replace(pattern, '');
  });

  // Ensure English-only content by removing non-ASCII characters that might trigger language detection
  cleanText = cleanText.replace(/[^\x00-\x7F]/g, '');

  // Clean up any double spaces created by removals
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  // Truncate if too long (Eleven Labs has character limits)
  const maxLength = 4500;
  if (cleanText.length > maxLength) {
    // Try to truncate at sentence boundary
    const truncated = cleanText.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxLength * 0.8) {
      cleanText = truncated.substring(0, lastSentence + 1);
    } else {
      cleanText = truncated + '...';
    }
  }

  return cleanText;
};

/**
 * Validates environment variables for Eleven Labs API
 * @throws {Error} When required environment variables are missing
 */
const validateEnvironment = () => {
  const { ELEVENLABS_API_KEY } = process.env;

  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is required in environment variables');
  }

  return { ELEVENLABS_API_KEY };
};

/**
 * Makes API request to Eleven Labs with retry logic
 * @param {string} text - Text to convert to speech
 * @param {string} apiKey - Eleven Labs API key
 * @param {string} voiceId - Voice ID to use
 * @param {Object} voiceSettings - Voice configuration settings
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<ArrayBuffer>} - Audio data
 */
const makeApiRequest = async (text, apiKey, voiceId, voiceSettings, retries = 3) => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  
  const requestBody = {
    text,
    voice_settings: voiceSettings,
    model_id: 'eleven_monolingual_v1',  // English-only model (inherently English, no language_code needed)
    output_format: 'mp3_44100_128'      // Fixed format for consistent audio
  };

  const requestOptions = {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Eleven Labs API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.warn(`API request attempt ${attempt + 1} failed: ${error.message}`);
      
      if (attempt === retries - 1) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
};

/**
 * Generates voiceover from text using Eleven Labs API
 *
 * This function automatically selects a random voice from the predefined VOICES array
 * to provide variety across different voiceover generations. No longer requires
 * ELEVENLABS_VOICE_ID environment variable.
 *
 * @param {string} text - Text to convert to speech
 * @param {string} outputPath - Path where to save the audio file
 * @param {Object} voiceSettings - Custom voice settings (optional)
 * @param {string} gender - Voice gender preference ('male', 'female', or null for random)
 * @returns {Promise<string>} - Path to the generated audio file
 * @throws {Error} When generation fails
 */
export const generateVoiceover = async (
  text,
  outputPath = 'temp/voiceover.mp3',
  voiceSettings = CONVERSATIONAL_VOICE_SETTINGS,
  gender = null
) => {
  // Validate input
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text is required and must be a non-empty string');
  }

  // Validate gender parameter
  if (gender && !['male', 'female'].includes(gender)) {
    throw new Error('Gender must be "male", "female", or null');
  }

  // Validate environment and get voice based on gender preference
  const { ELEVENLABS_API_KEY } = validateEnvironment();
  const ELEVENLABS_VOICE_ID = getRandomVoice(gender);

  // Enhance text for natural speech, then preprocess
  const enhancedText = enhanceTextForSpeech(text);
  const processedText = preprocessText(enhancedText);
  
  if (processedText.length === 0) {
    throw new Error('Text becomes empty after preprocessing');
  }

  console.log(`Generating voiceover for ${processedText.length} characters of text`);

  try {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Make API request
    const audioBuffer = await makeApiRequest(
      processedText,
      ELEVENLABS_API_KEY,
      ELEVENLABS_VOICE_ID,
      voiceSettings
    );

    // Save audio file
    await fs.writeFile(outputPath, Buffer.from(audioBuffer));

    // Verify file was created and has content
    const stats = await fs.stat(outputPath);
    if (stats.size === 0) {
      throw new Error('Generated voiceover file is empty');
    }

    console.log(`Voiceover generated successfully: ${outputPath} (${stats.size} bytes)`);
    
    return outputPath;
  } catch (error) {
    // Clean up partial file if it exists
    try {
      await fs.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }

    if (error.message.includes('Eleven Labs API error')) {
      throw error;
    } else if (error.message.includes('Failed to save')) {
      throw new Error(`Failed to save voiceover file: ${error.message}`);
    } else {
      throw new Error(`Failed to generate voiceover: ${error.message}`);
    }
  }
};

/**
 * Gets available voices from Eleven Labs API
 * @returns {Promise<Array>} - Array of available voices
 */
export const getAvailableVoices = async () => {
  const { ELEVENLABS_API_KEY } = validateEnvironment();

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    throw new Error(`Failed to fetch available voices: ${error.message}`);
  }
};

/**
 * Estimates the duration of generated audio based on text length
 * @param {string} text - Text to analyze
 * @returns {number} - Estimated duration in seconds
 */
// Export voice settings and voices for external use
export {
  DEFAULT_VOICE_SETTINGS,
  NATURAL_VOICE_SETTINGS,
  CONVERSATIONAL_VOICE_SETTINGS,
  VOICES,
  getRandomVoice,
  getMaleVoices,
  getFemaleVoices
};

export const estimateAudioDuration = text => {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const processedText = preprocessText(text);
  const wordCount = processedText.split(/\s+/).length;
  
  // Average speaking rate is about 150-160 words per minute
  const wordsPerMinute = 155;
  const durationMinutes = wordCount / wordsPerMinute;
  
  return Math.ceil(durationMinutes * 60); // Return seconds
};

/**
 * Generates a product review script from Amazon product data
 * @param {Object} productData - Product information from Amazon scraper
 * @returns {string} - Engaging review script
 */
export const generateProductReviewScript = (productData) => {
  if (!productData || typeof productData !== 'object') {
    throw new Error('Product data is required and must be an object');
  }

  const {
    title = 'this product',
    price = 'a great price',
    rating = 'highly rated',
    reviewCount = 'many reviews',
    features = [],
    description = '',
    images = []
  } = productData;

  // Create engaging intro
  const intros = [
    `Hey everyone! Today I'm reviewing ${title}, and I have to say, I'm impressed.`,
    `What's up, product reviewers! Let's dive into ${title} - this one caught my attention.`,
    `Welcome back to my channel! Today we're looking at ${title}, and here's what you need to know.`,
    `Hi there! I've been testing ${title} for a while now, and I'm ready to share my thoughts.`
  ];

  // Create price commentary
  const priceCommentary = typeof price === 'string' && price.includes('$')
    ? `At ${price}, this offers solid value for money.`
    : `The pricing is competitive and reasonable for what you get.`;

  // Create rating commentary
  const ratingText = typeof rating === 'number'
    ? `With a ${rating} star rating from ${reviewCount} customers, it's clearly popular.`
    : `This product has received positive feedback from customers.`;

  // Create features overview
  let featuresText = '';
  if (features && features.length > 0) {
    const topFeatures = features.slice(0, 3);
    featuresText = `Key features include: ${topFeatures.join(', ')}.`;
  }

  // Create description summary
  let descriptionText = '';
  if (description && description.length > 0) {
    const shortDesc = description.length > 200
      ? description.substring(0, 200).trim() + '...'
      : description;
    descriptionText = `Here's what makes it special: ${shortDesc}`;
  }

  // Create image commentary for slideshow
  let imageCommentary = '';
  if (images && images.length > 1) {
    imageCommentary = `As you can see in these images, the product looks well-designed and functional. Let me walk you through what you're looking at.`;
  } else if (images && images.length === 1) {
    imageCommentary = `Take a look at this product image - you can see the quality and attention to detail.`;
  }

  // Create conclusion
  const conclusions = [
    `Overall, I think this is a solid choice if you're in the market for this type of product.`,
    `Would I recommend it? Based on my research, yes - especially at this price point.`,
    `This product delivers on its promises and offers good value for the money.`,
    `If you're considering this purchase, I'd say go for it - you won't be disappointed.`
  ];

  // Assemble the script
  const script = [
    intros[Math.floor(Math.random() * intros.length)],
    ratingText,
    priceCommentary,
    featuresText,
    descriptionText,
    imageCommentary,
    conclusions[Math.floor(Math.random() * conclusions.length)],
    `Thanks for watching, and don't forget to like and subscribe for more product reviews!`
  ].filter(Boolean).join(' ');

  return script;
};