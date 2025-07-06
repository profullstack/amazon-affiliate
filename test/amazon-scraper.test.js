import { expect } from 'chai';
import sinon from 'sinon';
import { scrapeAmazonProduct } from '../src/amazon-scraper.js';

describe('Amazon Scraper', () => {
  describe('scrapeAmazonProduct', () => {
    let puppeteerStub;
    let browserStub;
    let pageStub;

    beforeEach(() => {
      // Setup stubs for puppeteer
      pageStub = {
        goto: sinon.stub(),
        evaluate: sinon.stub(),
        close: sinon.stub()
      };
      
      browserStub = {
        newPage: sinon.stub().resolves(pageStub),
        close: sinon.stub()
      };
      
      puppeteerStub = {
        launch: sinon.stub().resolves(browserStub)
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should extract product title, images, and description from Amazon page', async () => {
      const mockProductData = {
        title: 'Test Product Title',
        images: [
          'https://m.media-amazon.com/images/I/test1.jpg',
          'https://m.media-amazon.com/images/I/test2.jpg'
        ],
        description: 'Test product description with features'
      };

      pageStub.evaluate.resolves(mockProductData);

      const result = await scrapeAmazonProduct('https://www.amazon.com/dp/B08N5WRWNW');

      expect(result).to.deep.equal(mockProductData);
      expect(browserStub.newPage).to.have.been.calledOnce;
      expect(pageStub.goto).to.have.been.calledWith(
        'https://www.amazon.com/dp/B08N5WRWNW',
        { waitUntil: 'domcontentloaded' }
      );
      expect(browserStub.close).to.have.been.calledOnce;
    });

    it('should throw error for invalid Amazon URL', async () => {
      try {
        await scrapeAmazonProduct('https://invalid-url.com');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid Amazon URL');
      }
    });

    it('should throw error when product title is not found', async () => {
      pageStub.evaluate.resolves({
        title: null,
        images: [],
        description: ''
      });

      try {
        await scrapeAmazonProduct('https://www.amazon.com/dp/B08N5WRWNW');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Product not found');
      }
    });

    it('should handle pages with no images gracefully', async () => {
      const mockProductData = {
        title: 'Test Product Title',
        images: [],
        description: 'Test product description'
      };

      pageStub.evaluate.resolves(mockProductData);

      const result = await scrapeAmazonProduct('https://www.amazon.com/dp/B08N5WRWNW');

      expect(result.images).to.be.an('array').that.is.empty;
      expect(result.title).to.equal('Test Product Title');
    });

    it('should clean image URLs by removing size parameters', async () => {
      const mockProductData = {
        title: 'Test Product Title',
        images: [
          'https://m.media-amazon.com/images/I/test1._AC_SL1500_.jpg',
          'https://m.media-amazon.com/images/I/test2._SX300_QL70_.jpg'
        ],
        description: 'Test description'
      };

      pageStub.evaluate.resolves({
        title: 'Test Product Title',
        images: [
          'https://m.media-amazon.com/images/I/test1.jpg',
          'https://m.media-amazon.com/images/I/test2.jpg'
        ],
        description: 'Test description'
      });

      const result = await scrapeAmazonProduct('https://www.amazon.com/dp/B08N5WRWNW');

      expect(result.images).to.deep.equal([
        'https://m.media-amazon.com/images/I/test1.jpg',
        'https://m.media-amazon.com/images/I/test2.jpg'
      ]);
    });

    it('should handle browser launch failure', async () => {
      puppeteerStub.launch.rejects(new Error('Browser launch failed'));

      try {
        await scrapeAmazonProduct('https://www.amazon.com/dp/B08N5WRWNW');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Browser launch failed');
      }
    });

    it('should handle page navigation timeout', async () => {
      pageStub.goto.rejects(new Error('Navigation timeout'));

      try {
        await scrapeAmazonProduct('https://www.amazon.com/dp/B08N5WRWNW');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Navigation timeout');
      }
    });
  });
});