// DEPRECATED: Web scraping functionality has been replaced with Rainforest API
// import puppeteer from 'puppeteer';

/**
 * Extracts ASIN from Amazon URL or validates ASIN format
 * @param {string} urlOrAsin - Amazon product URL or ASIN
 * @returns {string} - Extracted or validated ASIN
 * @throws {Error} When URL is invalid or ASIN not found
 */
export const extractAsinFromUrl = (urlOrAsin) => {
  // If it's already an ASIN (10 characters, alphanumeric)
  if (/^[A-Z0-9]{10}$/.test(urlOrAsin)) {
    return urlOrAsin;
  }

  try {
    const url = new URL(urlOrAsin);
    
    // Check if it's a valid Amazon domain
    if (!url.hostname.includes('amazon.')) {
      throw new Error('Not an Amazon URL');
    }

    // Extract ASIN from various Amazon URL formats
    const dpMatch = url.pathname.match(/\/dp\/([A-Z0-9]{10})/);
    const gpMatch = url.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/);
    
    const asin = dpMatch?.[1] || gpMatch?.[1];
    
    if (!asin) {
      throw new Error('ASIN not found in URL');
    }
    
    return asin;
  } catch (error) {
    throw new Error('Invalid Amazon URL or ASIN not found');
  }
};

/**
 * Validates if the provided URL is a valid Amazon product URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid Amazon URL
 * @deprecated Use extractAsinFromUrl instead
 */
const isValidAmazonUrl = url => {
  try {
    extractAsinFromUrl(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates Rainforest API response structure
 * @param {Object} response - The API response to validate
 * @throws {Error} When response is invalid or missing required data
 */
export const validateRainforestResponse = (response) => {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid Rainforest API response: response is not an object');
  }

  if (!response.product) {
    throw new Error('Invalid Rainforest API response: missing product data');
  }

  if (!response.product.title) {
    throw new Error('Invalid Rainforest API response: missing required product title');
  }
};

/**
 * Fetches Amazon product data using Rainforest API
 * @param {string} urlOrAsin - Amazon product URL or ASIN
 * @returns {Promise<Object>} Product data object
 * @throws {Error} When API key is missing, ASIN is invalid, or API request fails
 */
export const fetchAmazonProductData = async (urlOrAsin) => {
  const apiKey = process.env.RAINFOREST_API_KEY;
  
  if (!apiKey || apiKey === 'your-rainforest-api-key') {
    throw new Error('RAINFOREST_API_KEY environment variable is required');
  }

  const asin = extractAsinFromUrl(urlOrAsin);
  
  const apiUrl = new URL('https://api.rainforestapi.com/request');
  apiUrl.searchParams.set('api_key', apiKey);
  apiUrl.searchParams.set('amazon_domain', 'amazon.com');
  apiUrl.searchParams.set('asin', asin);
  apiUrl.searchParams.set('type', 'product');
  apiUrl.searchParams.set('include_a_plus_body', 'true');
  apiUrl.searchParams.set('language', 'en_US');

  try {
    console.log(`🌧️ Fetching product data from Rainforest API for ASIN: ${asin}`);
    
    const response = await fetch(apiUrl.toString());
    
    if (!response.ok) {
      throw new Error(`Rainforest API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate the response structure
    validateRainforestResponse(data);

    // Transform the API response to match our expected format
    const productData = transformRainforestData(data);
    
    console.log(`✅ Successfully fetched product data: ${productData.title}`);
    console.log(`📸 Found ${productData.images.length} high-quality images`);
    
    return productData;
  } catch (error) {
    throw new Error(`Failed to fetch Amazon product data: ${error.message}`);
  }
};

/**
 * Transforms Rainforest API response to match our expected product data format
 * @param {Object} rainforestData - Raw Rainforest API response
 * @returns {Object} Transformed product data
 */
const transformRainforestData = (rainforestData) => {
  const { product } = rainforestData;
  
  // Extract images with enhanced quality versions
  const images = extractAndEnhanceImages(product);
  
  // Extract price information
  const price = extractPrice(product);
  
  // Extract rating and review count
  const rating = product.rating || null;
  const reviewCount = product.ratings_total ? product.ratings_total.toString() : null;
  
  // Extract features
  const features = product.feature_bullets || [];
  
  // Extract description
  const description = extractDescription(product);

  return {
    title: product.title,
    price,
    rating,
    reviewCount,
    features: features.slice(0, 8), // Limit to 8 features like the old scraper
    description,
    images
  };
};

/**
 * Extracts and enhances image URLs from Rainforest API product data
 * @param {Object} product - Product data from Rainforest API
 * @returns {string[]} Array of enhanced image URLs
 */
const extractAndEnhanceImages = (product) => {
  const imageUrls = new Set();
  
  // Add main image
  if (product.main_image?.link) {
    imageUrls.add(product.main_image.link);
  }
  
  // Add additional images
  if (product.images && Array.isArray(product.images)) {
    product.images.forEach(img => {
      if (img.link) {
        imageUrls.add(img.link);
      }
    });
  }
  
  // Convert to array and enhance quality
  const images = Array.from(imageUrls)
    .map(enhanceImageUrl)
    .slice(0, 10); // Limit to 10 images like the old scraper
  
  return images;
};

/**
 * Extracts price information from Rainforest API product data
 * @param {Object} product - Product data from Rainforest API
 * @returns {string|null} Formatted price string or null
 */
const extractPrice = (product) => {
  // Try different price sources
  const priceData = product.buybox_winner?.price ||
                   product.price ||
                   product.list_price;
  
  if (priceData) {
    if (priceData.symbol && priceData.value) {
      return `${priceData.symbol}${priceData.value}`;
    }
    if (priceData.raw) {
      return `$${priceData.raw}`;
    }
  }
  
  return null;
};

/**
 * Extracts description from Rainforest API product data
 * @param {Object} product - Product data from Rainforest API
 * @returns {string} Product description
 */
const extractDescription = (product) => {
  // Try different description sources
  const description = product.description ||
                     product.a_plus_content?.body ||
                     product.feature_bullets?.join(' ') ||
                     '';
  
  // Clean up and limit description length like the old scraper
  return description.replace(/\s+/g, ' ').substring(0, 1000);
};

/**
 * Gets multiple quality versions of an Amazon image URL including ultra-high zoom qualities
 * @param {string} imageUrl - The original image URL
 * @returns {string[]} - Array of image URLs in different qualities (highest first)
 */
const getImageQualityVersions = imageUrl => {
  if (!imageUrl) return [];
  
  const baseUrl = imageUrl.replace(/\._[^.]*_\./, '.').replace(/\.[^.]+$/, '');
  const extension = imageUrl.match(/\.[^.]+$/)?.[0] || '.jpg';
  
  if (baseUrl.includes('amazon.com') || baseUrl.includes('ssl-images-amazon.com')) {
    return [
      baseUrl + '._SL3000_.' + extension,  // 3000px (zoom ultra-high)
      baseUrl + '._SL2500_.' + extension,  // 2500px (zoom very high)
      baseUrl + '._SL2000_.' + extension,  // 2000px (zoom high)
      baseUrl + '._SL1500_.' + extension,  // 1500px (ultra high)
      baseUrl + '._SL1200_.' + extension,  // 1200px (very high)
      baseUrl + '._SL1000_.' + extension,  // 1000px (high)
      baseUrl + '._SL800_.' + extension,   // 800px (good)
      baseUrl + '._SL600_.' + extension,   // 600px (decent)
      baseUrl + extension                  // Original
    ];
  }
  
  return [imageUrl]; // Return original if not Amazon
};

/**
 * Enhances Amazon image URLs to get the highest quality version
 * @param {string} imageUrl - The original image URL
 * @returns {string} - High-quality image URL
 */
const enhanceImageUrl = imageUrl => {
  const versions = getImageQualityVersions(imageUrl);
  return versions[0]; // Return highest quality version
};

// DEPRECATED: Web scraping functionality has been replaced with Rainforest API
// The following code is kept for reference but is no longer used

/*
const extractImagesWithHover = async (page) => {
  // ... (old hover-based image extraction code)
  // This function has been replaced by Rainforest API image extraction
};

const scrapeAmazonProductOld = async url => {
  // ... (old web scraping code)
  // This function has been replaced by fetchAmazonProductData using Rainforest API
};
*/

/**
 * Main function to get Amazon product data - now uses Rainforest API instead of web scraping
 * @param {string} urlOrAsin - Amazon product URL or ASIN
 * @returns {Promise<Object>} Product data object
 * @throws {Error} When URL/ASIN is invalid or API request fails
 */
export const scrapeAmazonProduct = async (urlOrAsin) => {
  console.log('🌧️ Using Rainforest API instead of web scraping for better reliability and data quality');
  return await fetchAmazonProductData(urlOrAsin);
};