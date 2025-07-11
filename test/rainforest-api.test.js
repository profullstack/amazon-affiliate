import { expect } from 'chai';
import { fetchAmazonProductData, extractAsinFromUrl, validateRainforestResponse } from '../src/amazon-scraper.js';

describe('Rainforest API Integration', () => {
  describe('extractAsinFromUrl', () => {
    it('should extract ASIN from standard Amazon product URL', () => {
      const url = 'https://www.amazon.com/dp/B073JYC4XM';
      const asin = extractAsinFromUrl(url);
      expect(asin).to.equal('B073JYC4XM');
    });

    it('should extract ASIN from Amazon product URL with gp/product path', () => {
      const url = 'https://www.amazon.com/gp/product/B073JYC4XM';
      const asin = extractAsinFromUrl(url);
      expect(asin).to.equal('B073JYC4XM');
    });

    it('should extract ASIN from Amazon URL with additional parameters', () => {
      const url = 'https://www.amazon.com/dp/B073JYC4XM?ref=sr_1_1&keywords=test';
      const asin = extractAsinFromUrl(url);
      expect(asin).to.equal('B073JYC4XM');
    });

    it('should throw error for invalid Amazon URL', () => {
      const url = 'https://www.google.com';
      expect(() => extractAsinFromUrl(url)).to.throw('Invalid Amazon URL or ASIN not found');
    });

    it('should return ASIN directly if valid ASIN is provided', () => {
      const asin = 'B073JYC4XM';
      const result = extractAsinFromUrl(asin);
      expect(result).to.equal('B073JYC4XM');
    });

    it('should throw error for invalid ASIN format', () => {
      const invalidAsin = '123';
      expect(() => extractAsinFromUrl(invalidAsin)).to.throw('Invalid Amazon URL or ASIN not found');
    });
  });

  describe('validateRainforestResponse', () => {
    it('should validate a complete Rainforest API response', () => {
      const validResponse = {
        product: {
          title: 'Test Product',
          main_image: {
            link: 'https://example.com/image.jpg'
          },
          images: [
            { link: 'https://example.com/image1.jpg' },
            { link: 'https://example.com/image2.jpg' }
          ],
          buybox_winner: {
            price: {
              raw: 29.99,
              symbol: '$',
              value: 29.99
            }
          },
          rating: 4.5,
          ratings_total: 1234,
          feature_bullets: ['Feature 1', 'Feature 2'],
          description: 'Product description'
        }
      };

      expect(() => validateRainforestResponse(validResponse)).to.not.throw();
    });

    it('should throw error for response without product data', () => {
      const invalidResponse = {};
      expect(() => validateRainforestResponse(invalidResponse)).to.throw('Invalid Rainforest API response: missing product data');
    });

    it('should throw error for response without product title', () => {
      const invalidResponse = {
        product: {
          main_image: { link: 'https://example.com/image.jpg' }
        }
      };
      expect(() => validateRainforestResponse(invalidResponse)).to.throw('Invalid Rainforest API response: missing required product title');
    });
  });

  describe('fetchAmazonProductData', () => {
    it('should fetch product data using ASIN', async function() {
      this.timeout(10000); // Increase timeout for API calls
      
      // Skip if no API key is provided
      if (!process.env.RAINFOREST_API_KEY || process.env.RAINFOREST_API_KEY === 'your-rainforest-api-key') {
        this.skip();
      }

      const asin = 'B073JYC4XM';
      const productData = await fetchAmazonProductData(asin);

      expect(productData).to.be.an('object');
      expect(productData.title).to.be.a('string');
      expect(productData.images).to.be.an('array');
      expect(productData.images.length).to.be.greaterThan(0);
    });

    it('should fetch product data using Amazon URL', async function() {
      this.timeout(10000);
      
      // Skip if no API key is provided
      if (!process.env.RAINFOREST_API_KEY || process.env.RAINFOREST_API_KEY === 'your-rainforest-api-key') {
        this.skip();
      }

      const url = 'https://www.amazon.com/dp/B073JYC4XM';
      const productData = await fetchAmazonProductData(url);

      expect(productData).to.be.an('object');
      expect(productData.title).to.be.a('string');
      expect(productData.images).to.be.an('array');
    });

    it('should throw error when API key is missing', async () => {
      const originalKey = process.env.RAINFOREST_API_KEY;
      delete process.env.RAINFOREST_API_KEY;

      try {
        await fetchAmazonProductData('B073JYC4XM');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('RAINFOREST_API_KEY environment variable is required');
      } finally {
        process.env.RAINFOREST_API_KEY = originalKey;
      }
    });

    it('should throw error for invalid ASIN', async function() {
      this.timeout(10000);
      
      // Skip if no API key is provided
      if (!process.env.RAINFOREST_API_KEY || process.env.RAINFOREST_API_KEY === 'your-rainforest-api-key') {
        this.skip();
      }

      try {
        await fetchAmazonProductData('INVALID123');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to fetch Amazon product data');
      }
    });

    it('should handle API rate limiting gracefully', async function() {
      this.timeout(15000);
      
      // Skip if no API key is provided
      if (!process.env.RAINFOREST_API_KEY || process.env.RAINFOREST_API_KEY === 'your-rainforest-api-key') {
        this.skip();
      }

      // This test checks that the function handles rate limiting
      // by making multiple rapid requests
      const asin = 'B073JYC4XM';
      const promises = Array(3).fill().map(() => fetchAmazonProductData(asin));
      
      try {
        const results = await Promise.allSettled(promises);
        // At least one should succeed
        const successful = results.filter(r => r.status === 'fulfilled');
        expect(successful.length).to.be.greaterThan(0);
      } catch (error) {
        // Rate limiting errors are acceptable
        expect(error.message).to.include('rate limit');
      }
    });
  });

  describe('Product Data Structure', () => {
    it('should return consistent data structure matching old scraper format', async function() {
      this.timeout(10000);
      
      // Skip if no API key is provided
      if (!process.env.RAINFOREST_API_KEY || process.env.RAINFOREST_API_KEY === 'your-rainforest-api-key') {
        this.skip();
      }

      const asin = 'B073JYC4XM';
      const productData = await fetchAmazonProductData(asin);

      // Check that the structure matches what the old scraper returned
      expect(productData).to.have.property('title');
      expect(productData).to.have.property('price');
      expect(productData).to.have.property('rating');
      expect(productData).to.have.property('reviewCount');
      expect(productData).to.have.property('features');
      expect(productData).to.have.property('description');
      expect(productData).to.have.property('images');

      // Validate types
      expect(productData.title).to.be.a('string');
      expect(productData.images).to.be.an('array');
      expect(productData.features).to.be.an('array');
      
      if (productData.price) {
        expect(productData.price).to.be.a('string');
      }
      
      if (productData.rating) {
        expect(productData.rating).to.be.a('number');
        expect(productData.rating).to.be.at.least(0);
        expect(productData.rating).to.be.at.most(5);
      }
    });
  });
});