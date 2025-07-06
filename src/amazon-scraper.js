import puppeteer from 'puppeteer';

/**
 * Validates if the provided URL is a valid Amazon product URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid Amazon URL
 */
const isValidAmazonUrl = url => {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes('amazon.') &&
      (url.includes('/dp/') || url.includes('/gp/product/'))
    );
  } catch {
    return false;
  }
};

/**
 * Gets multiple quality versions of an Amazon image URL
 * @param {string} imageUrl - The original image URL
 * @returns {string[]} - Array of image URLs in different qualities (highest first)
 */
const getImageQualityVersions = imageUrl => {
  if (!imageUrl) return [];
  
  const baseUrl = imageUrl.replace(/\._[^.]*_\./, '.').replace(/\.[^.]+$/, '');
  const extension = imageUrl.match(/\.[^.]+$/)?.[0] || '.jpg';
  
  if (baseUrl.includes('amazon.com') || baseUrl.includes('ssl-images-amazon.com')) {
    return [
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

/**
 * Scrapes Amazon product data including title, images, and description
 * @param {string} url - Amazon product URL
 * @returns {Promise<Object>} Product data object
 * @throws {Error} When URL is invalid or product not found
 */
export const scrapeAmazonProduct = async url => {
  if (!isValidAmazonUrl(url)) {
    throw new Error('Invalid Amazon URL provided');
  }

  let browser;
  let page;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for content to load
    await page.waitForTimeout(2000);

    const productData = await page.evaluate(() => {
      // Extract product title
      const titleElement =
        document.querySelector('#productTitle') ||
        document.querySelector('[data-automation-id="product-title"]') ||
        document.querySelector('h1.a-size-large') ||
        document.querySelector('h1[data-automation-id="product-title"]');

      const title = titleElement?.innerText?.trim() || null;

      // Extract product price
      const priceSelectors = [
        '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
        '.a-price-whole',
        '.a-price .a-offscreen',
        '[data-automation-id="price"] .a-price .a-offscreen',
        '.a-price.a-text-price .a-offscreen',
        '#priceblock_dealprice',
        '#priceblock_ourprice',
        '.a-price-range .a-price .a-offscreen'
      ];
      
      let price = null;
      for (const selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement?.innerText?.trim()) {
          price = priceElement.innerText.trim();
          break;
        }
      }

      // Extract product rating
      const ratingSelectors = [
        '[data-hook="average-star-rating"] .a-icon-alt',
        '.a-icon-alt',
        '[aria-label*="stars"]',
        '.cr-original-review-link',
        '#acrPopover .a-icon-alt'
      ];
      
      let rating = null;
      for (const selector of ratingSelectors) {
        const ratingElement = document.querySelector(selector);
        if (ratingElement) {
          const ratingText = ratingElement.getAttribute('aria-label') || ratingElement.innerText || '';
          const ratingMatch = ratingText.match(/(\d+\.?\d*)\s*out\s*of\s*5|(\d+\.?\d*)\s*stars?/i);
          if (ratingMatch) {
            rating = parseFloat(ratingMatch[1] || ratingMatch[2]);
            break;
          }
        }
      }

      // Extract review count
      const reviewSelectors = [
        '[data-hook="total-review-count"]',
        '#acrCustomerReviewText',
        '.a-link-normal[href*="#customerReviews"]',
        '[data-automation-id="reviews-block"] a'
      ];
      
      let reviewCount = null;
      for (const selector of reviewSelectors) {
        const reviewElement = document.querySelector(selector);
        if (reviewElement?.innerText?.trim()) {
          const reviewText = reviewElement.innerText.trim();
          const reviewMatch = reviewText.match(/([\d,]+)\s*(?:customer\s*)?reviews?/i);
          if (reviewMatch) {
            reviewCount = reviewMatch[1];
            break;
          }
        }
      }

      // Extract product images
      const imageElements = [
        ...document.querySelectorAll('#altImages img'),
        ...document.querySelectorAll('#landingImage'),
        ...document.querySelectorAll('[data-action="main-image-click"] img'),
        ...document.querySelectorAll('.a-dynamic-image'),
        ...document.querySelectorAll('#imageBlock img')
      ];

      const images = imageElements
        .map(img => img.src || img.dataset.src || img.getAttribute('data-old-hires'))
        .filter(src => src && (src.includes('amazon.com') || src.includes('ssl-images-amazon')))
        .filter((src, index, arr) => arr.indexOf(src) === index) // Remove duplicates
        .slice(0, 10); // Limit to 10 images

      // Extract product features
      const featureSelectors = [
        '#feature-bullets ul li span',
        '[data-feature-name="featurebullets"] span',
        '.a-unordered-list.a-vertical.a-spacing-mini li span',
        '#productDetails_feature_div li'
      ];
      
      let features = [];
      for (const selector of featureSelectors) {
        const featureElements = document.querySelectorAll(selector);
        if (featureElements.length > 0) {
          features = Array.from(featureElements)
            .map(el => el.innerText?.trim())
            .filter(text => text && text.length > 10 && text.length < 200)
            .slice(0, 8); // Limit to 8 features
          if (features.length > 0) break;
        }
      }

      // Extract product description
      const descriptionElements = [
        document.querySelector('#feature-bullets'),
        document.querySelector('#productDescription'),
        document.querySelector('[data-feature-name="productDescription"]'),
        document.querySelector('#aplus'),
        document.querySelector('.a-expander-content')
      ];

      let description = '';
      for (const element of descriptionElements) {
        if (element?.innerText?.trim()) {
          description = element.innerText.trim();
          // Clean up the description
          description = description.replace(/\s+/g, ' ').substring(0, 1000);
          break;
        }
      }

      return {
        title,
        price,
        rating,
        reviewCount,
        images,
        features,
        description
      };
    });

    if (!productData.title) {
      throw new Error('Product not found or page structure changed');
    }

    // Enhance image URLs for high quality
    productData.images = productData.images.map(enhanceImageUrl);

    return productData;
  } catch (error) {
    throw new Error(`Failed to scrape Amazon product: ${error.message}`);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};