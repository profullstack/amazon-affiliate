import OpenAI from 'openai';

/**
 * OpenAI-powered script generator for creating natural product review scripts
 */

/**
 * Validates OpenAI environment variables
 * @throws {Error} When required environment variables are missing
 */
const validateOpenAIEnvironment = () => {
  const { OPENAI_API_KEY } = process.env;

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required in environment variables');
  }

  return { OPENAI_API_KEY };
};

/**
 * Creates OpenAI client instance
 * @returns {OpenAI} Configured OpenAI client
 */
const createOpenAIClient = () => {
  const { OPENAI_API_KEY } = validateOpenAIEnvironment();
  
  return new OpenAI({
    apiKey: OPENAI_API_KEY
  });
};

/**
 * Generates a natural, engaging product review script using OpenAI
 * @param {Object} productData - Product information from Amazon scraper
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Generated review script
 */
export const generateAIReviewScript = async (productData, options = {}) => {
  if (!productData || typeof productData !== 'object') {
    throw new Error('Product data is required and must be an object');
  }

  const {
    model = 'gpt-4o-mini',
    maxTokens = 800,
    temperature = 0.7,
    reviewStyle = 'conversational'
  } = options;

  const {
    title = 'this product',
    price = 'a competitive price',
    rating = 'highly rated',
    reviewCount = 'many reviews',
    features = [],
    description = '',
    images = []
  } = productData;

  console.log('🤖 Generating AI-powered review script...');
  console.log(`📝 Product: ${title}`);
  console.log(`💰 Price: ${price}`);
  console.log(`⭐ Rating: ${rating}`);

  try {
    const openai = createOpenAIClient();

    // Create a comprehensive prompt for natural review generation
    const prompt = createReviewPrompt(productData, reviewStyle);

    console.log('🔄 Calling OpenAI API...');
    
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(reviewStyle)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const generatedScript = completion.choices[0]?.message?.content;

    if (!generatedScript) {
      throw new Error('OpenAI API returned empty response');
    }

    console.log(`✅ AI script generated (${generatedScript.length} characters)`);
    
    // Post-process the script for better speech synthesis
    const processedScript = postProcessScript(generatedScript);
    
    return processedScript;

  } catch (error) {
    console.error('❌ OpenAI script generation failed:', error.message);
    console.error('📋 Error details:', error);
    
    // No fallback - throw the error so you can see exactly what's wrong
    throw new Error(`OpenAI script generation failed: ${error.message}`);
  }
};

/**
 * Creates the system prompt for OpenAI based on review style
 * @param {string} reviewStyle - Style of review to generate
 * @returns {string} System prompt
 */
const getSystemPrompt = (reviewStyle) => {
  const basePrompt = `You are a professional product reviewer who creates engaging, honest, and conversational video scripts for YouTube product reviews. You have access to real Amazon product information including detailed descriptions, features, pricing, and customer ratings.

Key requirements:
- Write ONLY in English - no foreign words, phrases, or expressions
- Use a conversational, friendly tone using the actual Amazon product details
- Sound like a real person who has researched the product, not reading marketing copy
- Use the provided Amazon description to create authentic, informative content
- Reference specific product features and details from the Amazon listing
- Include natural speech patterns and transitions
- Be honest and balanced in your assessment based on the real product information
- Keep the audience engaged throughout with specific, relevant details
- Use "I" statements and personal observations about the product data
- Include natural pauses and emphasis where appropriate
- Aim for 60-90 seconds of speaking time (approximately 150-200 words)
- Transform the Amazon description into natural, conversational English language
- Avoid any non-English words, brand names in foreign languages, or international expressions`;

  const stylePrompts = {
    conversational: `${basePrompt}
- Use casual language and contractions (don't, won't, it's)
- Include natural filler words occasionally (well, you know, actually)
- Sound like you're talking to a friend`,
    
    professional: `${basePrompt}
- Maintain a professional but approachable tone
- Use clear, articulate language
- Focus on factual information and practical benefits`,
    
    enthusiastic: `${basePrompt}
- Show genuine excitement about interesting features
- Use energetic language and positive expressions
- Maintain authenticity while being upbeat`
  };

  return stylePrompts[reviewStyle] || stylePrompts.conversational;
};

/**
 * Creates the user prompt with product information
 * @param {Object} productData - Product information
 * @param {string} reviewStyle - Review style
 * @returns {string} User prompt
 */
const createReviewPrompt = (productData, reviewStyle) => {
  const {
    title = 'this product',
    price = 'a competitive price',
    rating = 'highly rated',
    reviewCount = 'many reviews',
    features = [],
    description = '',
    images = []
  } = productData || {};

  // Process and enhance the description for better context
  const processedDescription = processProductDescription(description);
  const featuresText = Array.isArray(features) && features.length > 0
    ? features.slice(0, 5).join('; ')
    : 'Not specified';

  return `Create a natural, engaging product review script for this Amazon product. Use the actual product description and features to create an authentic, informative review:

PRODUCT DETAILS:
- Product Name: ${title}
- Current Price: ${price}
- Customer Rating: ${rating} stars (from ${reviewCount} reviews)
- Available Images: ${Array.isArray(images) ? images.length : 0} product photos

ACTUAL AMAZON PRODUCT DESCRIPTION:
${processedDescription || 'No detailed description available from Amazon'}

KEY PRODUCT FEATURES:
${featuresText}

CRITICAL LANGUAGE REQUIREMENT:
- Write ONLY in English - absolutely no foreign words, phrases, or expressions
- Do not include any non-English brand names, technical terms, or international expressions
- Use only standard American English throughout the entire script

REVIEW SCRIPT REQUIREMENTS:
1. INTRODUCTION: Start with a natural hook that mentions the product name
2. PRODUCT OVERVIEW: Use the actual Amazon description to explain what this product is and what it does
3. KEY FEATURES: Highlight the most important features from the Amazon listing in your own words
4. PRICE & VALUE: Discuss the current price and whether it represents good value
5. CUSTOMER FEEDBACK: Reference the rating and review count to build credibility
6. VISUAL ELEMENTS: Mention that you'll be showing the product images during the review
7. HONEST ASSESSMENT: Give your genuine opinion based on the product information
8. RECOMMENDATION: End with a clear recommendation and call-to-action

TONE & STYLE GUIDELINES:
- Sound like a real person having a conversation, not reading marketing copy
- Use the actual product details from Amazon to create authentic content
- Be honest and balanced - mention both positives and any potential considerations
- Include natural speech patterns, contractions, and conversational transitions
- Reference specific details from the description to show you've researched the product
- Keep it engaging and informative for potential buyers
- Ensure every word is in English - no foreign language insertions

The script should sound like you've actually researched this product on Amazon and are sharing genuine insights with your audience. Use the real product information to create valuable, authentic content in clear, standard English.`;
};

/**
 * Post-processes the generated script for better speech synthesis
 * @param {string} script - Raw generated script
 * @returns {string} Processed script
 */
const postProcessScript = (script) => {
  let processed = script;

  // Remove any markdown formatting
  processed = processed.replace(/\*\*(.*?)\*\*/g, '$1');
  processed = processed.replace(/\*(.*?)\*/g, '$1');
  
  // Ensure proper sentence spacing
  processed = processed.replace(/\.\s+/g, '. ');
  processed = processed.replace(/\?\s+/g, '? ');
  processed = processed.replace(/!\s+/g, '! ');
  
  // Add natural pauses for better speech flow
  processed = processed.replace(/\. ([A-Z])/g, '. ... $1');
  processed = processed.replace(/\? ([A-Z])/g, '? ... $1');
  processed = processed.replace(/! ([A-Z])/g, '! ... $1');
  
  // Emphasize important elements for speech synthesis
  processed = processed.replace(/(\$\d+(?:\.\d{2})?)/g, '*$1*');
  processed = processed.replace(/(\d+(?:\.\d+)?\s*(?:star|stars))/gi, '*$1*');
  
  // Clean up any double spaces
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
};

/**
 * Processes and cleans the Amazon product description for better OpenAI prompts
 * @param {string} description - Raw product description from Amazon
 * @returns {string} Cleaned and formatted description
 */
const processProductDescription = (description) => {
  if (!description || typeof description !== 'string') {
    return '';
  }

  let processed = description;

  // Remove excessive whitespace and normalize
  processed = processed.replace(/\s+/g, ' ').trim();

  // Remove common Amazon boilerplate text
  processed = processed.replace(/About this item/gi, '');
  processed = processed.replace(/Product Description/gi, '');
  processed = processed.replace(/From the manufacturer/gi, '');
  processed = processed.replace(/\[See more\]/gi, '');
  processed = processed.replace(/\[Read more\]/gi, '');

  // Clean up bullet points and formatting
  processed = processed.replace(/•/g, '-');
  processed = processed.replace(/\n+/g, ' ');
  processed = processed.replace(/\t+/g, ' ');

  // Remove excessive punctuation
  processed = processed.replace(/\.{2,}/g, '.');
  processed = processed.replace(/!{2,}/g, '!');
  processed = processed.replace(/\?{2,}/g, '?');

  // Ensure reasonable length for OpenAI prompt (keep it under 1500 chars)
  if (processed.length > 1500) {
    // Try to cut at sentence boundary
    const truncated = processed.substring(0, 1500);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > 1200) {
      processed = truncated.substring(0, lastSentence + 1);
    } else {
      processed = truncated + '...';
    }
  }

  // Final cleanup
  processed = processed.replace(/\s+/g, ' ').trim();

  return processed;
};

/**
 * Generates a fallback script when OpenAI is unavailable
 * @param {Object} productData - Product information
 * @returns {string} Fallback script
 */
const generateFallbackScript = (productData) => {
  // Ensure productData exists and has default values
  if (!productData || typeof productData !== 'object') {
    productData = {};
  }

  const {
    title = 'this product',
    price = 'a great price',
    rating = 'highly rated',
    features = []
  } = productData;

  const intros = [
    `Hey everyone! Today I'm taking a look at ${title}.`,
    `What's up! I wanted to share my thoughts on ${title}.`,
    `Hi there! Let me tell you about ${title}.`
  ];

  const intro = intros[Math.floor(Math.random() * intros.length)];
  
  // Safely check features array
  const featuresArray = Array.isArray(features) ? features : [];
  const featuresText = featuresArray.length > 0
    ? `Some key features include ${featuresArray.slice(0, 3).join(', ')}.`
    : 'It has some interesting features worth discussing.';

  const priceText = typeof price === 'string' && price.includes('$')
    ? `At ${price}, I think it offers decent value.`
    : 'The pricing seems reasonable for what you get.';

  const ratingText = typeof rating === 'number'
    ? `With a ${rating} star rating, customers seem pretty satisfied.`
    : 'It has received positive feedback from users.';

  return `${intro} ... ${featuresText} ... ${priceText} ... ${ratingText} ... Overall, I think this could be a solid choice if you're in the market for this type of product. ... Thanks for watching, and let me know what you think in the comments!`;
};

/**
 * Estimates the speaking duration of a script
 * @param {string} script - Script text
 * @returns {number} Estimated duration in seconds
 */
export const estimateScriptDuration = (script) => {
  if (!script || typeof script !== 'string') {
    return 0;
  }

  // Remove ellipses and extra spaces for word count
  const cleanScript = script.replace(/\.\.\./g, '').replace(/\s+/g, ' ').trim();
  const wordCount = cleanScript.split(' ').length;
  
  // Average speaking rate is about 150-160 words per minute
  const wordsPerMinute = 155;
  const durationMinutes = wordCount / wordsPerMinute;
  
  return Math.ceil(durationMinutes * 60);
};

/**
 * Validates script generation inputs
 * @param {Object} productData - Product data to validate
 * @throws {Error} When validation fails
 */
export const validateScriptInputs = (productData) => {
  if (!productData || typeof productData !== 'object') {
    throw new Error('Product data is required and must be an object');
  }

  if (!productData.title) {
    throw new Error('Product title is required for script generation');
  }
};

/**
 * Gets available OpenAI models for script generation
 * @returns {Array<string>} Available model names
 */
export const getAvailableModels = () => {
  return [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-3.5-turbo'
  ];
};

/**
 * Gets available review styles
 * @returns {Array<string>} Available style names
 */
export const getAvailableStyles = () => {
  return [
    'conversational',
    'professional', 
    'enthusiastic'
  ];
};