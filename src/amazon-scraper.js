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

/**
 * Extracts ultra-high quality images from zoom window during hover interactions
 * @param {Object} page - Puppeteer page object
 * @returns {Promise<string[]>} - Array of ultra-high-quality image URLs from zoom
 */
const extractImagesWithHover = async (page) => {
  console.log('🖱️ Using enhanced hover-based image extraction with zoom window capture...');
  
  const images = await page.evaluate(async () => {
    const imageUrls = new Set();
    
    // Function to wait for a short time
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // First, collect any immediately available images
    const immediateImages = [
      ...document.querySelectorAll('#altImages img'),
      ...document.querySelectorAll('#landingImage'),
      ...document.querySelectorAll('[data-action="main-image-click"] img'),
      ...document.querySelectorAll('.a-dynamic-image'),
      ...document.querySelectorAll('#imageBlock img'),
      ...document.querySelectorAll('[data-a-image-name] img')
    ];
    
    immediateImages.forEach(img => {
      const possibleSources = [
        img.getAttribute('data-old-hires'),
        img.getAttribute('data-a-hires'),
        img.getAttribute('src'),
        img.getAttribute('data-src'),
        img.src
      ].filter(Boolean);
      
      possibleSources.forEach(src => {
        if (src && (src.includes('amazon.com') || src.includes('ssl-images-amazon'))) {
          imageUrls.add(src);
        }
      });
    });
    
    // Find thumbnail images to hover over
    const thumbnails = [
      ...document.querySelectorAll('#altImages img'),
      ...document.querySelectorAll('[data-action="thumb-action"] img'),
      ...document.querySelectorAll('.a-button-thumbnail img'),
      ...document.querySelectorAll('#imageBlock_feature_div img'),
      ...document.querySelectorAll('[role="button"] img')
    ];
    
    console.log(`Found ${thumbnails.length} thumbnails to hover over`);
    
    // Enhanced hover process to capture zoom window images
    for (let i = 0; i < Math.min(thumbnails.length, 10); i++) {
      const thumbnail = thumbnails[i];
      
      try {
        console.log(`Processing thumbnail ${i + 1}/${Math.min(thumbnails.length, 10)}`);
        
        // STEP 1: Hover over thumbnail to load image in main viewer
        const mouseOverEvent = new MouseEvent('mouseover', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        
        thumbnail.dispatchEvent(mouseOverEvent);
        
        // Also try clicking if it's a clickable thumbnail
        if (thumbnail.closest('[data-action]') || thumbnail.closest('[role="button"]')) {
          thumbnail.click();
        }
        
        // Wait for main image to load
        await wait(800);
        
        // STEP 2: Find and hover over main image to trigger zoom window
        const mainImages = [
          ...document.querySelectorAll('#landingImage'),
          ...document.querySelectorAll('[data-action="main-image-click"] img'),
          ...document.querySelectorAll('#imageBlock .a-dynamic-image'),
          ...document.querySelectorAll('[data-a-image-name="main"] img')
        ];
        
        for (const mainImage of mainImages) {
          if (!mainImage) continue;
          
          try {
            // Hover over the main image to trigger zoom window
            const mainImageHover = new MouseEvent('mouseover', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            
            mainImage.dispatchEvent(mainImageHover);
            
            // Also try mouseenter for different zoom triggers
            const mouseEnterEvent = new MouseEvent('mouseenter', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            
            mainImage.dispatchEvent(mouseEnterEvent);
            
            // Wait for zoom window to appear
            await wait(1200);
            
            // STEP 3: Extract ultra-high quality image from zoom window
            const zoomWindow = document.querySelector('#zoomWindow');
            if (zoomWindow) {
              console.log('🔍 Found zoom window!');
              
              // Look for the detail image inside zoom window
              const detailImg = zoomWindow.querySelector('#detailImg, img');
              if (detailImg && detailImg.src) {
                const zoomImageUrl = detailImg.src;
                if (zoomImageUrl && (zoomImageUrl.includes('amazon.com') || zoomImageUrl.includes('ssl-images-amazon'))) {
                  console.log(`🔥 Found ultra-high quality zoom image: ${zoomImageUrl.substring(0, 100)}...`);
                  imageUrls.add(zoomImageUrl);
                }
              }
              
              // Also check for any other images in the zoom window
              const zoomImages = zoomWindow.querySelectorAll('img');
              zoomImages.forEach(img => {
                if (img.src && (img.src.includes('amazon.com') || img.src.includes('ssl-images-amazon'))) {
                  imageUrls.add(img.src);
                }
              });
            }
            
            // STEP 4: Extract regular main image sources (fallback)
            const possibleSources = [
              mainImage.getAttribute('data-old-hires'),
              mainImage.getAttribute('data-a-hires'),
              mainImage.getAttribute('src'),
              mainImage.getAttribute('data-src'),
              mainImage.src
            ].filter(Boolean);
            
            possibleSources.forEach(src => {
              if (src && (src.includes('amazon.com') || src.includes('ssl-images-amazon'))) {
                imageUrls.add(src);
              }
            });
            
          } catch (zoomError) {
            console.log(`Error during zoom extraction for main image:`, zoomError.message);
          }
        }
        
        // Also check if the thumbnail itself has high-res data
        const thumbSources = [
          thumbnail.getAttribute('data-old-hires'),
          thumbnail.getAttribute('data-a-hires'),
          thumbnail.getAttribute('data-src'),
          thumbnail.src
        ].filter(Boolean);
        
        thumbSources.forEach(src => {
          if (src && (src.includes('amazon.com') || src.includes('ssl-images-amazon'))) {
            imageUrls.add(src);
          }
        });
        
      } catch (error) {
        console.log(`Error hovering over thumbnail ${i}:`, error.message);
      }
    }
    
    // Convert Set to Array and return
    const finalImages = Array.from(imageUrls);
    console.log(`🎯 Total unique images extracted: ${finalImages.length}`);
    
    // Log quality breakdown
    const ultraHigh = finalImages.filter(img =>
      img.includes('_SL1500_') || img.includes('_SL2000_') || img.includes('_SL3000_') ||
      img.includes('_SL1200_') || img.includes('_AC_SL1200_')
    ).length;
    const high = finalImages.filter(img => img.includes('_SL1000_') || img.includes('_AC_SL1000_')).length;
    const medium = finalImages.filter(img => img.includes('_SL800_') || img.includes('_SL600_')).length;
    
    console.log(`📊 Quality breakdown: Ultra-high: ${ultraHigh}, High: ${high}, Medium: ${medium}, Other: ${finalImages.length - ultraHigh - high - medium}`);
    
    return finalImages;
  });
  
  console.log(`📸 Enhanced extraction completed: ${images.length} images with zoom window capture`);
  return images;
};

/**
 * Scrapes Amazon product data including title, images, and description with enhanced image extraction
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
    await page.waitForTimeout(3000);

    console.log('📄 Extracting product data...');

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
        features,
        description
      };
    });

    if (!productData.title) {
      throw new Error('Product not found or page structure changed');
    }

    // Extract images using hover-based technique
    const images = await extractImagesWithHover(page);

    // Enhance image URLs for high quality and remove duplicates
    const enhancedImages = [...new Set(images.map(enhanceImageUrl))].slice(0, 10);

    productData.images = enhancedImages;

    console.log(`✅ Successfully scraped product: ${productData.title}`);
    console.log(`📸 Found ${enhancedImages.length} high-quality images`);

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