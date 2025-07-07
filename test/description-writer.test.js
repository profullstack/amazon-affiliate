import { expect } from 'chai';
import fs from 'fs/promises';
import path from 'path';
import { writeVideoDescription, generateDescriptionFilename } from '../src/description-writer.js';

// Helper function for async error testing
const expectAsyncError = async (asyncFn, expectedMessage) => {
  try {
    await asyncFn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    expect(error.message).to.include(expectedMessage);
  }
};

describe('Description Writer', () => {
  const testOutputDir = './test-output';
  const testDescription = 'This is a test video description with multiple lines.\n\nIt includes product features and affiliate links.';
  const testVideoTitle = 'Amazing Product Review - Honest Review';

  beforeEach(async () => {
    // Create test output directory
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const files = await fs.readdir(testOutputDir);
      for (const file of files) {
        await fs.unlink(path.join(testOutputDir, file));
      }
      await fs.rmdir(testOutputDir);
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  describe('generateDescriptionFilename', () => {
    it('should generate safe filename from video title', () => {
      const filename = generateDescriptionFilename(testVideoTitle);
      expect(filename).to.match(/^amazing-product-review-honest-\d{6}\.txt$/);
    });

    it('should handle special characters in title', () => {
      const titleWithSpecialChars = 'Test Product! @#$%^&*() - Review';
      const filename = generateDescriptionFilename(titleWithSpecialChars);
      expect(filename).to.match(/^test-product-review-\d{6}\.txt$/);
    });

    it('should handle very long titles', () => {
      const longTitle = 'This is a very long product title that exceeds normal length limits and should be truncated properly while maintaining readability and ensuring the filename is not too long for the filesystem';
      const filename = generateDescriptionFilename(longTitle);
      expect(filename.length).to.be.lessThan(100);
      expect(filename).to.match(/\.txt$/);
    });

    it('should handle empty or invalid titles', () => {
      expect(() => generateDescriptionFilename('')).to.throw('Video title is required');
      expect(() => generateDescriptionFilename(null)).to.throw('Video title is required');
      expect(() => generateDescriptionFilename(undefined)).to.throw('Video title is required');
    });
  });

  describe('writeVideoDescription', () => {
    it('should write description to file with generated filename', async () => {
      const result = await writeVideoDescription(
        testDescription,
        testVideoTitle,
        testOutputDir
      );

      expect(result).to.have.property('filePath');
      expect(result).to.have.property('filename');
      expect(result.filename).to.match(/^amazing-product-review-honest-\d{6}\.txt$/);

      // Verify file exists and has correct content
      const fileContent = await fs.readFile(result.filePath, 'utf-8');
      expect(fileContent).to.equal(testDescription);
    });

    it('should write description to file with custom filename', async () => {
      const customFilename = 'custom-description.txt';
      const result = await writeVideoDescription(
        testDescription,
        testVideoTitle,
        testOutputDir,
        customFilename
      );

      expect(result.filename).to.equal(customFilename);
      expect(result.filePath).to.equal(path.join(testOutputDir, customFilename));

      // Verify file exists and has correct content
      const fileContent = await fs.readFile(result.filePath, 'utf-8');
      expect(fileContent).to.equal(testDescription);
    });

    it('should create output directory if it does not exist', async () => {
      const nonExistentDir = './test-output-new';
      
      const result = await writeVideoDescription(
        testDescription,
        testVideoTitle,
        nonExistentDir
      );

      // Verify directory was created and file exists
      const fileContent = await fs.readFile(result.filePath, 'utf-8');
      expect(fileContent).to.equal(testDescription);

      // Clean up
      await fs.unlink(result.filePath);
      await fs.rmdir(nonExistentDir);
    });

    it('should handle empty description', async () => {
      const result = await writeVideoDescription(
        '',
        testVideoTitle,
        testOutputDir
      );

      const fileContent = await fs.readFile(result.filePath, 'utf-8');
      expect(fileContent).to.equal('');
    });

    it('should handle description with special characters and encoding', async () => {
      const specialDescription = 'Description with émojis 🎬📹 and spëcial characters: àáâãäåæçèéêë';
      
      const result = await writeVideoDescription(
        specialDescription,
        testVideoTitle,
        testOutputDir
      );

      const fileContent = await fs.readFile(result.filePath, 'utf-8');
      expect(fileContent).to.equal(specialDescription);
    });

    it('should throw error for invalid parameters', async () => {
      await expectAsyncError(
        () => writeVideoDescription(null, testVideoTitle, testOutputDir),
        'Description is required'
      );
      
      await expectAsyncError(
        () => writeVideoDescription(testDescription, '', testOutputDir),
        'Video title is required'
      );
      
      await expectAsyncError(
        () => writeVideoDescription(testDescription, testVideoTitle, ''),
        'Output directory is required'
      );
    });

    it('should return file stats information', async () => {
      const result = await writeVideoDescription(
        testDescription,
        testVideoTitle,
        testOutputDir
      );

      expect(result).to.have.property('stats');
      expect(result.stats).to.have.property('size');
      expect(result.stats).to.have.property('created');
      expect(result.stats.size).to.equal(testDescription.length);
      expect(result.stats.created).to.be.a('date');
    });
  });
});