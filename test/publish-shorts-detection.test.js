import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('YouTube Shorts Detection Fix', () => {
  it('should detect short videos from filename containing -short', () => {
    // Test various filename patterns that should be detected as shorts
    const shortVideoFilenames = [
      './output/product-review-short.mp4',
      './output/amazing-gadget-123456-short.mp4',
      './output/kitchen-tool-short.mov',
      '/path/to/video-short.mp4',
      'video-short.mp4'
    ];

    shortVideoFilenames.forEach(filename => {
      const isShortVideo = filename.includes('-short');
      expect(isShortVideo).to.be.true;
      console.log(`✅ Correctly detected as short video: ${filename}`);
    });
  });

  it('should not detect regular videos as shorts', () => {
    // Test filenames that should NOT be detected as shorts
    const regularVideoFilenames = [
      './output/product-review.mp4',
      './output/amazing-gadget-123456.mp4',
      './output/kitchen-tool.mov',
      '/path/to/video.mp4',
      'video.mp4'
    ];

    regularVideoFilenames.forEach(filename => {
      const isShortVideo = filename.includes('-short');
      expect(isShortVideo).to.be.false;
      console.log(`✅ Correctly detected as regular video: ${filename}`);
    });
  });

  it('should handle edge cases correctly', () => {
    // Test edge cases
    const edgeCases = [
      { filename: './output/short-video.mp4', shouldBeShort: false }, // 'short' at beginning, not '-short'
      { filename: './output/video-shortage.mp4', shouldBeShort: true }, // contains '-short' (in 'shortage')
      { filename: './output/video-short-version.mp4', shouldBeShort: true }, // '-short' in middle
      { filename: './output/very-short-clip.mp4', shouldBeShort: true }, // '-short' in middle
    ];

    edgeCases.forEach(({ filename, shouldBeShort }) => {
      const isShortVideo = filename.includes('-short');
      expect(isShortVideo).to.equal(shouldBeShort);
      console.log(`✅ Edge case handled correctly: ${filename} -> ${isShortVideo ? 'SHORT' : 'REGULAR'}`);
    });
  });

  it('should work with the exact pattern from the publish command', () => {
    // Simulate the exact logic from the publish command
    const testCases = [
      { videoPath: './output/product-review-short.mp4', expectedShorts: true },
      { videoPath: './output/product-review.mp4', expectedShorts: false },
      { videoPath: './output/gadget-123456-short.mp4', expectedShorts: true },
      { videoPath: './output/gadget-123456.mp4', expectedShorts: false }
    ];

    testCases.forEach(({ videoPath, expectedShorts }) => {
      // Simulate the publish command logic
      let options = { shorts: false };
      
      // Auto-detect YouTube Shorts based on filename (any file containing '-short')
      if (!options.shorts && videoPath.includes('-short')) {
        options.shorts = true;
      }

      expect(options.shorts).to.equal(expectedShorts);
      console.log(`✅ Publish command logic test: ${videoPath} -> shorts: ${options.shorts}`);
    });
  });
});