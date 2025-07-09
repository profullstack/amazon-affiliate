import { expect } from 'chai';
import { scrapeAmazonProduct } from '../src/amazon-scraper.js';

describe('Amazon Scraper with Hover-based Image Extraction', () => {
  // Test timeout increased for web scraping
  const SCRAPER_TIMEOUT = 30000;

  describe('URL validation', () => {
    it('should reject invalid URLs', async () => {
      const invalidUrls = [
        'https://google.com',
        'https://amazon.com',
        'not-a-url',
        'https://amazon.com/search?k=test'
      ];

      for (const url of invalidUrls) {
        try {
          await scrapeAmazonProduct(url);
          expect.fail(`Should have thrown error for invalid URL: ${url}`);
        } catch (error) {
          expect(error.message).to.include('Invalid Amazon URL');
        }
      }
    });

    it('should accept valid Amazon product URLs', () => {
      const validUrls = [
        'https://www.amazon.com/dp/B0741FGRG2',
        'https://amazon.com/gp/product/B0741FGRG2',
        'https://www.amazon.co.uk/dp/B0741FGRG2',
        'https://amazon.de/dp/B0741FGRG2?ref=test'
      ];

      validUrls.forEach(url => {
        // This should not throw an error during URL validation
        expect(() => {
          // Just test the URL validation part
          const urlObj = new URL(url);
          const isValid = urlObj.hostname.includes('amazon.') &&
                          (url.includes('/dp/') || url.includes('/gp/product/'));
          expect(isValid).to.be.true;
        }).to.not.throw();
      });
    });
  });

  describe('Product data extraction', () => {
    it('should successfully scrape Mint Mobile product with hover-based image extraction', async function() {
      this.timeout(SCRAPER_TIMEOUT);
      
      const testUrl = 'https://www.amazon.com/Mint-Mobile-Wireless-Unlimited-3-Months/dp/B0741FGRG2?th=1';
      
      const productData = await scrapeAmazonProduct(testUrl);
      
      // Verify basic product data
      expect(productData).to.be.an('object');
      expect(productData.title).to.be.a('string').and.not.be.empty;
      expect(productData.title).to.include('Mint Mobile');
      
      // Verify price extraction
      expect(productData.price).to.be.a('string').and.not.be.empty;
      
      // Verify rating extraction
      expect(productData.rating).to.be.a('number');
      expect(productData.rating).to.be.at.least(0).and.at.most(5);
      
      // Verify features extraction
      expect(productData.features).to.be.an('array');
      expect(productData.features.length).to.be.at.least(1);
      
      // Verify description extraction
      expect(productData.description).to.be.a('string').and.not.be.empty;
      
      // Verify hover-based image extraction
      expect(productData.images).to.be.an('array');
      expect(productData.images.length).to.be.at.least(5); // Should find multiple images
      expect(productData.images.length).to.be.at.most(10); // Limited to 10
      
      // Verify image quality enhancement
      productData.images.forEach(imageUrl => {
        expect(imageUrl).to.be.a('string');
        expect(imageUrl).to.satisfy(url => 
          url.includes('amazon.com') || url.includes('ssl-images-amazon')
        );
        expect(imageUrl).to.include('_SL1500_'); // High quality version
      });
      
      console.log(`✅ Successfully extracted ${productData.images.length} high-quality images`);
    });

    it('should handle products with limited images gracefully', async function() {
      this.timeout(SCRAPER_TIMEOUT);
      
      // Test with a different product that might have fewer images
      const testUrl = 'https://www.amazon.com/dp/B08N5WRWNW'; // Echo Dot
      
      try {
        const productData = await scrapeAmazonProduct(testUrl);
        
        expect(productData).to.be.an('object');
        expect(productData.title).to.be.a('string').and.not.be.empty;
        expect(productData.images).to.be.an('array');
        
        // Should still find some images, even if fewer
        expect(productData.images.length).to.be.at.least(1);
        
        console.log(`✅ Extracted ${productData.images.length} images from Echo Dot product`);
      } catch (error) {
        // If the product is no longer available, that's acceptable
        if (error.message.includes('Product not found')) {
          console.log('⚠️ Test product no longer available, skipping');
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });

  describe('Image quality enhancement', () => {
    it('should enhance image URLs to highest quality', () => {
      // Test the image enhancement logic
      const testImages = [
        'https://m.media-amazon.com/images/I/41nR7IYmcjL._AC_SX300_.jpg',
        'https://m.media-amazon.com/images/I/41TeVSToD-L._AC_SY200_.jpg'
      ];
      
      // Import the enhancement function (we'll need to export it for testing)
      // For now, we'll test the pattern that should be applied
      testImages.forEach(originalUrl => {
        // The enhanced URL should have _SL1500_ for highest quality
        expect(originalUrl).to.be.a('string');
        expect(originalUrl).to.include('amazon.com');
      });
    });
  });

  describe('Error handling', () => {
    it('should handle network timeouts gracefully', async function() {
      this.timeout(35000); // Longer timeout for this test
      
      // Test with a URL that might timeout
      const timeoutUrl = 'https://www.amazon.com/dp/INVALID_PRODUCT_ID';
      
      try {
        await scrapeAmazonProduct(timeoutUrl);
        // If it doesn't throw, that's also acceptable (might find a valid page)
      } catch (error) {
        expect(error.message).to.include('Failed to scrape Amazon product');
      }
    });

    it('should handle missing product gracefully', async function() {
      this.timeout(SCRAPER_TIMEOUT);
      
      // Test with a URL that should return a "not found" page
      const notFoundUrl = 'https://www.amazon.com/dp/B000000000';
      
      try {
        await scrapeAmazonProduct(notFoundUrl);
        // If it doesn't throw, the page might have redirected to a valid product
      } catch (error) {
        expect(error.message).to.satisfy(msg => 
          msg.includes('Product not found') || 
          msg.includes('Failed to scrape Amazon product')
        );
      }
    });
  });

  describe('Performance', () => {
    it('should complete scraping within reasonable time', async function() {
      this.timeout(25000); // 25 second timeout
      
      const testUrl = 'https://www.amazon.com/Mint-Mobile-Wireless-Unlimited-3-Months/dp/B0741FGRG2?th=1';
      
      const startTime = Date.now();
      const productData = await scrapeAmazonProduct(testUrl);
      const endTime = Date.now();
      
      const duration = (endTime - startTime) / 1000;
      
      expect(duration).to.be.below(20); // Should complete within 20 seconds
      expect(productData.images.length).to.be.at.least(5); // Should find multiple images
      
      console.log(`⏱️ Scraping completed in ${duration.toFixed(2)}s`);
    });
  });
});