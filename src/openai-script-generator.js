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
- Avoid any non-English words, brand names in foreign languages, or international expressions
- CRITICAL: Never include section headers, titles, or labels like "Introduction:", "Features:", "Conclusion:" etc.
- Create a natural flowing presentation script that sounds like a continuous conversation
- Transition smoothly between topics without announcing what section you're moving to`;

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

SCRIPT FLOW REQUIREMENTS:
Create a natural, flowing presentation script that seamlessly covers these elements WITHOUT section headers or titles:
- Start with a natural hook that mentions the product name
- Smoothly transition to explaining what this product is and what it does using the Amazon description
- Naturally highlight the most important features from the Amazon listing in your own words
- Organically discuss the current price and whether it represents good value
- Naturally reference the rating and review count to build credibility
- Mention that you'll be showing the product images during the review
- Give your genuine opinion based on the product information
- End with a clear recommendation and call-to-action

CRITICAL: Do NOT include any section titles, headers, or labels like "Introduction:", "Overview:", "Features:", etc. The script should flow naturally like a conversation without any structural markers.

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

/**
 * Generates an optimized YouTube video title using OpenAI
 * @param {Object} productData - Product information from Amazon scraper
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Generated optimized title
 */
export const generateAIVideoTitle = async (productData, options = {}) => {
  if (!productData || typeof productData !== 'object') {
    throw new Error('Product data is required and must be an object');
  }

  const {
    model = 'gpt-4o-mini',
    maxTokens = 100,
    temperature = 0.8
  } = options;

  const {
    title = 'this product',
    price = 'a competitive price',
    rating = 'highly rated',
    reviewCount = 'many reviews',
    features = [],
    description = ''
  } = productData;

  console.log('🎬 Generating AI-optimized video title...');
  console.log(`📝 Original product: ${title}`);

  try {
    const openai = createOpenAIClient();

    const prompt = `Create an engaging, SEO-optimized YouTube video title for this Amazon product review. The title should be clickable, informative, and under 60 characters for optimal display.

PRODUCT DETAILS:
- Product Name: ${title}
- Price: ${price}
- Rating: ${rating} stars (${reviewCount} reviews)
- Key Features: ${Array.isArray(features) ? features.slice(0, 3).join(', ') : 'Not specified'}

TITLE REQUIREMENTS:
1. Must be under 60 characters for full mobile display
2. Include the main product name or category
3. Add compelling words like "Review", "Worth It?", "Honest Opinion", "Before You Buy"
4. Make it clickable and curiosity-driven
5. Avoid clickbait - be honest and informative
6. Consider SEO keywords that people might search for
7. Use title case formatting

EXAMPLES OF GOOD TITLES:
- "KitchenAid Espresso Machine Review - Worth $1,800?"
- "Honest Review: Is This $200 Robot Vacuum Any Good?"
- "Apple AirPods Pro 2 - Should You Upgrade?"

Generate 1 optimized title that balances SEO, engagement, and honesty:`;

    console.log('🔄 Calling OpenAI API for title generation...');
    
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a YouTube SEO expert who creates compelling, honest video titles that get clicks while maintaining credibility. Focus on creating titles that are informative, engaging, and optimized for search.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature,
      presence_penalty: 0.2,
      frequency_penalty: 0.1
    });

    const generatedTitle = completion.choices[0]?.message?.content?.trim();

    if (!generatedTitle) {
      throw new Error('OpenAI API returned empty title response');
    }

    // Clean up the title
    const cleanTitle = generatedTitle
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/^\d+\.\s*/, '') // Remove numbering
      .trim();

    console.log(`✅ AI title generated: "${cleanTitle}"`);
    
    return cleanTitle;

  } catch (error) {
    console.error('❌ OpenAI title generation failed:', error.message);
    
    // Fallback to enhanced original title
    const fallbackTitle = generateFallbackTitle(productData);
    console.log(`🔄 Using fallback title: "${fallbackTitle}"`);
    return fallbackTitle;
  }
};

/**
 * Generates an optimized YouTube video description using OpenAI
 * @param {Object} productData - Product information from Amazon scraper
 * @param {string} videoTitle - The video title
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Generated optimized description
 */
export const generateAIVideoDescription = async (productData, videoTitle, options = {}) => {
  if (!productData || typeof productData !== 'object') {
    throw new Error('Product data is required and must be an object');
  }

  const {
    model = 'gpt-4o-mini',
    maxTokens = 600,
    temperature = 0.7,
    includeTimestamps = true,
    includeHashtags = true
  } = options;

  const {
    title = 'this product',
    price = 'a competitive price',
    rating = 'highly rated',
    reviewCount = 'many reviews',
    features = [],
    description = '',
    amazonUrl = ''
  } = productData;

  console.log('📝 Generating AI-optimized video description...');

  try {
    const openai = createOpenAIClient();

    const prompt = `Create an engaging, SEO-optimized YouTube video description for this Amazon product review video.

VIDEO TITLE: ${videoTitle}

PRODUCT DETAILS:
- Product Name: ${title}
- Price: ${price}
- Rating: ${rating} stars (${reviewCount} reviews)
- Amazon URL: ${amazonUrl}
- Key Features: ${Array.isArray(features) ? features.slice(0, 5).join(', ') : 'Not specified'}
- Description: ${processProductDescription(description).substring(0, 500)}

DESCRIPTION REQUIREMENTS:
1. Start with a compelling hook that matches the video title
2. Provide a brief overview of what viewers will learn
3. Include key product details and features
4. Mention the price and value proposition
5. Reference customer ratings and feedback
6. Include a call-to-action for engagement
7. Add relevant keywords naturally for SEO
8. Keep it informative but engaging
9. Include disclaimer about affiliate links if applicable
10. End with social media engagement request

STRUCTURE:
- Opening hook (2-3 sentences)
- What's covered in the video (2-3 sentences)
- Key product highlights (3-4 sentences)
- Price and value discussion (1-2 sentences)
- Call to action (1-2 sentences)
- Engagement request (1 sentence)

Generate a comprehensive description (aim for 200-300 words):`;

    console.log('🔄 Calling OpenAI API for description generation...');
    
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a YouTube content strategist who creates compelling video descriptions that improve SEO, engagement, and viewer retention. Focus on being informative, engaging, and optimized for search while maintaining authenticity.'
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

    let generatedDescription = completion.choices[0]?.message?.content?.trim();

    if (!generatedDescription) {
      throw new Error('OpenAI API returned empty description response');
    }

    // Post-process the description
    generatedDescription = postProcessDescription(generatedDescription, productData, {
      includeTimestamps,
      includeHashtags
    });

    console.log(`✅ AI description generated (${generatedDescription.length} characters)`);
    
    return generatedDescription;

  } catch (error) {
    console.error('❌ OpenAI description generation failed:', error.message);
    
    // Fallback to enhanced description
    const fallbackDescription = generateFallbackDescription(productData, videoTitle);
    console.log(`🔄 Using fallback description (${fallbackDescription.length} characters)`);
    return fallbackDescription;
  }
};

/**
 * Generates a fallback title when OpenAI is unavailable
 * @param {Object} productData - Product information
 * @returns {string} Fallback title
 */
const generateFallbackTitle = (productData) => {
  const { title = 'Product', price = '' } = productData || {};
  
  // Extract main product name (first few words)
  const productName = title.split(' ').slice(0, 3).join(' ');
  
  const titleTemplates = [
    `${productName} Review - Worth It?`,
    `${productName} - Honest Review`,
    `${productName} Review - Before You Buy`,
    `Is the ${productName} Worth ${price}?`,
    `${productName} - My Honest Opinion`
  ];
  
  const selectedTemplate = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];
  
  // Ensure under 60 characters
  return selectedTemplate.length > 60
    ? selectedTemplate.substring(0, 57) + '...'
    : selectedTemplate;
};

/**
 * Generates a fallback description when OpenAI is unavailable
 * @param {Object} productData - Product information
 * @param {string} videoTitle - Video title
 * @returns {string} Fallback description
 */
const generateFallbackDescription = (productData, videoTitle) => {
  const {
    title = 'this product',
    price = 'a competitive price',
    rating = 'highly rated',
    reviewCount = 'many reviews',
    features = []
  } = productData || {};

  const featuresText = Array.isArray(features) && features.length > 0
    ? features.slice(0, 3).join(', ')
    : 'various useful features';

  return `In this video, I'm reviewing the ${title} to help you decide if it's worth your money.

I'll cover the key features including ${featuresText}, discuss the current price of ${price}, and share my honest thoughts based on the ${rating} star rating from ${reviewCount} customer reviews.

Whether you're considering this purchase or just curious about the product, this review will give you all the information you need to make an informed decision.

⏰ Timestamps:
0:00 Introduction
0:30 Product Overview
1:00 Key Features
1:30 Price & Value
2:00 Final Thoughts

👍 If this review was helpful, please like and subscribe for more honest product reviews!

#ProductReview #Amazon #Review`;
};

/**
 * Post-processes the generated description
 * @param {string} description - Raw generated description
 * @param {Object} productData - Product data
 * @param {Object} options - Processing options
 * @returns {string} Processed description
 */
const postProcessDescription = (description, productData, options = {}) => {
  let processed = description;
  
  const { includeTimestamps = true, includeHashtags = true } = options;
  
  // Add timestamps if not present and requested
  if (includeTimestamps && !processed.includes('0:00')) {
    processed += '\n\n⏰ Timestamps:\n0:00 Introduction\n0:30 Product Overview\n1:00 Key Features\n1:30 Price & Value\n2:00 Final Thoughts';
  }
  
  // Add engagement call-to-action if not present
  if (!processed.toLowerCase().includes('like') && !processed.toLowerCase().includes('subscribe')) {
    processed += '\n\n👍 If this review was helpful, please like and subscribe for more honest product reviews!';
  }
  
  // Add relevant hashtags if requested
  if (includeHashtags && !processed.includes('#')) {
    const productCategory = extractProductCategory(productData.title || '');
    processed += `\n\n#ProductReview #Amazon #Review #${productCategory}`;
  }
  
  // Clean up formatting
  processed = processed.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  processed = processed.trim();
  
  return processed;
};

/**
 * Extracts product category for hashtags
 * @param {string} title - Product title
 * @returns {string} Product category
 */
const extractProductCategory = (title) => {
  const categories = {
    'kitchen': ['kitchen', 'espresso', 'coffee', 'blender', 'mixer', 'cookware'],
    'electronics': ['phone', 'laptop', 'tablet', 'headphones', 'speaker', 'camera'],
    'home': ['vacuum', 'air purifier', 'humidifier', 'lamp', 'furniture'],
    'fitness': ['treadmill', 'weights', 'yoga', 'exercise', 'fitness'],
    'beauty': ['skincare', 'makeup', 'hair', 'beauty', 'cosmetic'],
    'automotive': ['car', 'auto', 'vehicle', 'tire', 'automotive']
  };
  
  const lowerTitle = title.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerTitle.includes(keyword))) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
  
  return 'Product';
};

/**
 * Generates a short (~30 second) script specifically for social media short videos
 * @param {Object} productData - Product information from Amazon scraper
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Generated short video script
 */
export const generateAIShortVideoScript = async (productData, options = {}) => {
  if (!productData || typeof productData !== 'object') {
    throw new Error('Product data is required and must be an object');
  }

  const {
    model = 'gpt-4o-mini',
    maxTokens = 200,
    temperature = 0.8,
    targetDuration = 30
  } = options;

  const {
    title = 'this product',
    price = 'a competitive price',
    rating = 'highly rated',
    reviewCount = 'many reviews',
    features = [],
    description = ''
  } = productData;

  console.log('📱 Generating AI-powered short video script...');
  console.log(`📝 Product: ${title}`);
  console.log(`⏱️ Target duration: ~${targetDuration} seconds`);

  try {
    const openai = createOpenAIClient();

    const prompt = `Create a punchy, engaging script for a ${targetDuration}-second short video (Instagram Reels, TikTok, YouTube Shorts) reviewing this Amazon product.

PRODUCT DETAILS:
- Product Name: ${title}
- Price: ${price}
- Rating: ${rating} stars (${reviewCount} reviews)
- Key Features: ${Array.isArray(features) ? features.slice(0, 3).join(', ') : 'Not specified'}
- Description: ${processProductDescription(description).substring(0, 300)}

SHORT VIDEO SCRIPT FLOW:
Create a natural, fast-paced script that flows seamlessly through these elements WITHOUT any section headers or time markers:
- Start with an attention-grabbing opener
- Smoothly transition to briefly explaining what the product is and why it matters
- Naturally focus on 1-2 most compelling features or benefits
- End with a quick recommendation and engagement request

CRITICAL: Do NOT include any section titles, time markers, or labels like "Hook:", "Overview:", etc. The script should flow naturally like an excited conversation without any structural markers.

STYLE GUIDELINES:
- Write ONLY in English - no foreign words or phrases
- Keep it fast-paced and energetic for social media
- Use short, punchy sentences
- Include natural pauses marked with "..."
- Make it conversational and authentic
- Focus on the most compelling selling points
- Target exactly ${targetDuration} seconds of speaking time (~75-90 words)
- Use "I" statements to make it personal
- End with a clear call-to-action

TONE: Energetic, authentic, and helpful - like you're excitedly telling a friend about a great find.

Generate a script that will keep viewers engaged for the full ${targetDuration} seconds:`;

    console.log('🔄 Calling OpenAI API for short video script...');
    
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a social media content creator who specializes in creating engaging, fast-paced product review scripts for short-form video platforms like TikTok, Instagram Reels, and YouTube Shorts. Your scripts are punchy, authentic, and designed to hold attention for the full duration while providing genuine value.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature,
      presence_penalty: 0.2,
      frequency_penalty: 0.1
    });

    const generatedScript = completion.choices[0]?.message?.content;

    if (!generatedScript) {
      throw new Error('OpenAI API returned empty short video script response');
    }

    console.log(`✅ AI short video script generated (${generatedScript.length} characters)`);
    
    // Post-process the script for better speech synthesis
    const processedScript = postProcessShortScript(generatedScript);
    
    // Estimate duration and log it
    const estimatedDuration = estimateScriptDuration(processedScript);
    console.log(`⏱️ Estimated speaking duration: ${estimatedDuration} seconds`);
    
    return processedScript;

  } catch (error) {
    console.error('❌ OpenAI short video script generation failed:', error.message);
    console.error('📋 Error details:', error);
    
    // No fallback - throw the error so you can see exactly what's wrong
    throw new Error(`OpenAI short video script generation failed: ${error.message}`);
  }
};

/**
 * Post-processes the generated short video script for better speech synthesis
 * @param {string} script - Raw generated short script
 * @returns {string} Processed short script
 */
const postProcessShortScript = (script) => {
  let processed = script;

  // Remove any markdown formatting
  processed = processed.replace(/\*\*(.*?)\*\*/g, '$1');
  processed = processed.replace(/\*(.*?)\*/g, '$1');
  
  // Ensure proper sentence spacing
  processed = processed.replace(/\.\s+/g, '. ');
  processed = processed.replace(/\?\s+/g, '? ');
  processed = processed.replace(/!\s+/g, '! ');
  
  // Add natural pauses for better speech flow (shorter pauses for fast-paced content)
  processed = processed.replace(/\. ([A-Z])/g, '. .. $1');
  processed = processed.replace(/\? ([A-Z])/g, '? .. $1');
  processed = processed.replace(/! ([A-Z])/g, '! .. $1');
  
  // Emphasize important elements for speech synthesis
  processed = processed.replace(/(\$\d+(?:\.\d{2})?)/g, '*$1*');
  processed = processed.replace(/(\d+(?:\.\d+)?\s*(?:star|stars))/gi, '*$1*');
  
  // Clean up any double spaces
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
};
