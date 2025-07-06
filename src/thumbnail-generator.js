import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Utility to generate thumbnails for existing videos that don't have them
 */
export class ThumbnailGenerator {
  constructor(config = {}) {
    this.outputDir = config.outputDir || './output';
    this.tempDir = config.tempDir || './temp';
  }

  /**
   * Scan for videos without thumbnails
   */
  async scanForVideosWithoutThumbnails() {
    try {
      const files = await fs.readdir(this.outputDir);
      const videoFiles = files.filter(file => 
        file.endsWith('.mp4') || file.endsWith('.mov') || file.endsWith('.avi')
      );
      
      const videosNeedingThumbnails = [];
      
      for (const videoFile of videoFiles) {
        const baseName = path.parse(videoFile).name;
        const videoPath = path.join(this.outputDir, videoFile);
        
        // Check if thumbnails already exist
        const possibleThumbnails = [
          `${baseName}-thumbnail.jpg`,
          `${baseName}-thumbnail.png`,
          `${baseName}.jpg`,
          `${baseName}.png`
        ];
        
        let hasThumbnail = false;
        for (const thumbName of possibleThumbnails) {
          const thumbPath = path.join(this.outputDir, thumbName);
          try {
            await fs.access(thumbPath);
            hasThumbnail = true;
            break;
          } catch {
            // Thumbnail doesn't exist, continue
          }
        }
        
        if (!hasThumbnail) {
          videosNeedingThumbnails.push({
            filename: videoFile,
            path: videoPath,
            baseName
          });
        }
      }
      
      return videosNeedingThumbnails;
    } catch (error) {
      console.error(`Failed to scan for videos: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract frame from video using ffmpeg
   */
  async extractFrameFromVideo(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(2) // Seek to 2 seconds to avoid black frames
        .frames(1)
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Frame extracted: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (error) => {
          console.error(`❌ Failed to extract frame: ${error.message}`);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Create YouTube-style thumbnail (1280x720)
   */
  async createYouTubeThumbnail(framePath, outputPath) {
    try {
      await sharp(framePath)
        .resize(1280, 720, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      
      console.log(`✅ YouTube thumbnail created: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`❌ Failed to create YouTube thumbnail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create Pinterest-style thumbnail (1000x1500)
   */
  async createPinterestThumbnail(framePath, outputPath) {
    try {
      await sharp(framePath)
        .resize(1000, 1500, {
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 90 })
        .toFile(outputPath);
      
      console.log(`✅ Pinterest thumbnail created: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error(`❌ Failed to create Pinterest thumbnail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate thumbnails for a single video
   */
  async generateThumbnailsForVideo(video) {
    try {
      console.log(`🎬 Processing: ${video.filename}`);
      
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Extract frame from video
      const tempFramePath = path.join(this.tempDir, `frame-${video.baseName}.jpg`);
      await this.extractFrameFromVideo(video.path, tempFramePath);
      
      // Create YouTube thumbnail (JPG)
      const youtubeThumbnailPath = path.join(this.outputDir, `${video.baseName}-thumbnail.jpg`);
      await this.createYouTubeThumbnail(tempFramePath, youtubeThumbnailPath);
      
      // Create Pinterest thumbnail (PNG)
      const pinterestThumbnailPath = path.join(this.outputDir, `${video.baseName}.png`);
      await this.createPinterestThumbnail(tempFramePath, pinterestThumbnailPath);
      
      // Cleanup temp frame
      try {
        await fs.unlink(tempFramePath);
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup temp frame: ${error.message}`);
      }
      
      return {
        success: true,
        youtubeThumbnail: youtubeThumbnailPath,
        pinterestThumbnail: pinterestThumbnailPath
      };
      
    } catch (error) {
      console.error(`❌ Failed to generate thumbnails for ${video.filename}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate thumbnails for all videos that need them
   */
  async generateMissingThumbnails() {
    try {
      console.log('🔍 Scanning for videos without thumbnails...');
      
      const videosNeedingThumbnails = await this.scanForVideosWithoutThumbnails();
      
      if (videosNeedingThumbnails.length === 0) {
        console.log('✅ All videos already have thumbnails!');
        return { success: true, processed: 0 };
      }
      
      console.log(`📹 Found ${videosNeedingThumbnails.length} videos needing thumbnails:`);
      videosNeedingThumbnails.forEach(video => {
        console.log(`   - ${video.filename}`);
      });
      
      const results = [];
      
      for (const video of videosNeedingThumbnails) {
        const result = await this.generateThumbnailsForVideo(video);
        results.push({
          video: video.filename,
          ...result
        });
        
        // Small delay between processing
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      
      console.log('\n📊 Thumbnail Generation Results:');
      console.log('='.repeat(40));
      console.log(`✅ Successful: ${successful}`);
      console.log(`❌ Failed: ${failed}`);
      
      if (failed > 0) {
        console.log('\n❌ Failed videos:');
        results.filter(r => !r.success).forEach(result => {
          console.log(`   - ${result.video}: ${result.error}`);
        });
      }
      
      return {
        success: successful > 0,
        processed: successful,
        failed,
        results
      };
      
    } catch (error) {
      console.error(`❌ Thumbnail generation failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// CLI interface
async function runCLI() {
  const generator = new ThumbnailGenerator();
  await generator.generateMissingThumbnails();
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch(console.error);
}