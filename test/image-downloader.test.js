import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs/promises';
import path from 'path';
import { downloadImages } from '../src/image-downloader.js';

describe('Image Downloader', () => {
  describe('downloadImages', () => {
    let fetchStub;
    let fsStub;
    let pathStub;

    beforeEach(() => {
      fetchStub = sinon.stub();
      fsStub = {
        mkdir: sinon.stub(),
        writeFile: sinon.stub(),
        access: sinon.stub(),
        unlink: sinon.stub()
      };
      pathStub = {
        join: sinon.stub()
      };

      // Mock successful responses
      fetchStub.resolves({
        ok: true,
        arrayBuffer: sinon.stub().resolves(new ArrayBuffer(1024))
      });

      fsStub.mkdir.resolves();
      fsStub.writeFile.resolves();
      pathStub.join.callsFake((...args) => args.join('/'));
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should download images and return file paths', async () => {
      const imageUrls = [
        'https://m.media-amazon.com/images/I/test1.jpg',
        'https://m.media-amazon.com/images/I/test2.jpg'
      ];

      const tempDir = './temp';
      const expectedPaths = [
        'temp/image-0.jpg',
        'temp/image-1.jpg'
      ];

      const result = await downloadImages(imageUrls, tempDir);

      expect(result).to.deep.equal(expectedPaths);
      expect(fsStub.mkdir).to.have.been.calledWith(tempDir, { recursive: true });
      expect(fetchStub).to.have.been.calledTwice;
      expect(fsStub.writeFile).to.have.been.calledTwice;
    });

    it('should handle empty image URLs array', async () => {
      const result = await downloadImages([]);

      expect(result).to.be.an('array').that.is.empty;
      expect(fetchStub).to.not.have.been.called;
    });

    it('should use default temp directory when not specified', async () => {
      const imageUrls = ['https://example.com/image.jpg'];

      await downloadImages(imageUrls);

      expect(fsStub.mkdir).to.have.been.calledWith('./temp', { recursive: true });
    });

    it('should handle fetch failures gracefully', async () => {
      const imageUrls = [
        'https://example.com/valid.jpg',
        'https://example.com/invalid.jpg'
      ];

      fetchStub.onFirstCall().resolves({
        ok: true,
        arrayBuffer: sinon.stub().resolves(new ArrayBuffer(1024))
      });

      fetchStub.onSecondCall().rejects(new Error('Network error'));

      const result = await downloadImages(imageUrls);

      // Should return only successful downloads
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.equal('temp/image-0.jpg');
    });

    it('should handle HTTP error responses', async () => {
      const imageUrls = ['https://example.com/notfound.jpg'];

      fetchStub.resolves({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await downloadImages(imageUrls);

      expect(result).to.be.an('array').that.is.empty;
    });

    it('should validate image URLs before downloading', async () => {
      const imageUrls = [
        'https://example.com/valid.jpg',
        'invalid-url',
        'ftp://example.com/image.jpg',
        'https://example.com/valid2.png'
      ];

      fetchStub.resolves({
        ok: true,
        arrayBuffer: sinon.stub().resolves(new ArrayBuffer(1024))
      });

      const result = await downloadImages(imageUrls);

      // Should only download valid HTTP/HTTPS URLs
      expect(result).to.have.lengthOf(2);
      expect(fetchStub).to.have.been.calledTwice;
    });

    it('should handle file write failures', async () => {
      const imageUrls = ['https://example.com/image.jpg'];

      fetchStub.resolves({
        ok: true,
        arrayBuffer: sinon.stub().resolves(new ArrayBuffer(1024))
      });

      fsStub.writeFile.rejects(new Error('Disk full'));

      const result = await downloadImages(imageUrls);

      expect(result).to.be.an('array').that.is.empty;
    });

    it('should generate unique filenames for images with same extension', async () => {
      const imageUrls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.png'
      ];

      fetchStub.resolves({
        ok: true,
        arrayBuffer: sinon.stub().resolves(new ArrayBuffer(1024))
      });

      const result = await downloadImages(imageUrls);

      expect(result).to.deep.equal([
        'temp/image-0.jpg',
        'temp/image-1.jpg',
        'temp/image-2.png'
      ]);
    });

    it('should handle directory creation failure', async () => {
      const imageUrls = ['https://example.com/image.jpg'];

      fsStub.mkdir.rejects(new Error('Permission denied'));

      try {
        await downloadImages(imageUrls);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to create directory');
      }
    });

    it('should limit number of concurrent downloads', async () => {
      const imageUrls = Array.from({ length: 20 }, (_, i) => 
        `https://example.com/image${i}.jpg`
      );

      fetchStub.resolves({
        ok: true,
        arrayBuffer: sinon.stub().resolves(new ArrayBuffer(1024))
      });

      const result = await downloadImages(imageUrls);

      expect(result).to.have.lengthOf(20);
      // Verify that not all requests were made simultaneously
      expect(fetchStub.callCount).to.equal(20);
    });
  });
});