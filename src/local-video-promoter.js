import 'dotenv/config';
import { PromotionManager } from './promotion-manager.js';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

/**
 * Utility for promoting videos that are already created and stored locally
 */
class LocalVideoPromoter {
  constructor() {
    this.outputDir = './output';
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Scan output directory for video files
   */
  async scanForVideos() {
    try {
      const files = await fs.readdir(this.outputDir);
      const videoFiles = files.filter(file => 
        file.endsWith('.mp4') || file.endsWith('.mov') || file.endsWith('.avi')
      );
      
      const videos = [];
      
      for (const videoFile of videoFiles) {
        const videoPath = path.join(this.outputDir, videoFile);
        const stats = await fs.stat(videoPath);
        
        // Look for corresponding thumbnail
        const baseName = path.parse(videoFile).name;
        const possibleThumbnails = [
          `${baseName}-thumbnail.jpg`,
          `${baseName}-thumbnail.png`,
          `${baseName}.jpg`,
          `${baseName}.png`
        ];
        
        let thumbnailPath = null;
        for (const thumbName of possibleThumbnails) {
          const thumbPath = path.join(this.outputDir, thumbName);
          try {
            await fs.access(thumbPath);
            thumbnailPath = thumbPath;
            break;
          } catch {
            // Thumbnail doesn't exist, continue
          }
        }
        
        videos.push({
          filename: videoFile,
          path: videoPath,
          thumbnailPath,
          size: Math.round(stats.size / (1024 * 1024) * 10) / 10, // MB
          created: stats.birthtime.toLocaleDateString(),
          baseName
        });
      }
      
      return videos.sort((a, b) => b.created.localeCompare(a.created));
    } catch (error) {
      console.error(`Failed to scan output directory: ${error.message}`);
      return [];
    }
  }

  /**
   * Display available videos
   */
  displayVideos(videos) {
    if (videos.length === 0) {
      console.log('❌ No video files found in ./output directory');
      return;
    }

    console.log('\n📹 Available Videos in ./output:');
    console.log('='.repeat(60));
    
    videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.filename}`);
      console.log(`   📁 Size: ${video.size}MB`);
      console.log(`   📅 Created: ${video.created}`);
      console.log(`   🖼️  Thumbnail: ${video.thumbnailPath ? '✅ Found' : '❌ Missing'}`);
      console.log('');
    });
  }

  /**
   * Prompt user to select a video
   */
  async selectVideo(videos) {
    return new Promise((resolve) => {
      this.rl.question(`Select video (1-${videos.length}) or 'q' to quit: `, (answer) => {
        if (answer.toLowerCase() === 'q') {
          resolve(null);
          return;
        }
        
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < videos.length) {
          resolve(videos[index]);
        } else {
          console.log('❌ Invalid selection');
          resolve(null);
        }
      });
    });
  }

  /**
   * Extract title from filename
   */
  extractTitleFromFilename(filename) {
    // Remove extension and common suffixes
    let title = path.parse(filename).name;
    
    // Remove timestamp suffixes (e.g., -123456)
    title = title.replace(/-\d{6}$/, '');
    
    // Replace hyphens and underscores with spaces
    title = title.replace(/[-_]/g, ' ');
    
    // Capitalize words
    title = title.replace(/\b\w/g, l => l.toUpperCase());
    
    // Add "Review" if not present
    if (!title.toLowerCase().includes('review')) {
      title += ' - Review';
    }
    
    return title;
  }

  /**
   * Prompt for video details
   */
  async promptForVideoDetails(video) {
    const prompt = (question, defaultValue = '') => {
      return new Promise((resolve) => {
        const displayDefault = defaultValue ? ` (${defaultValue})` : '';
        this.rl.question(`${question}${displayDefault}: `, (answer) => {
          resolve(answer.trim() || defaultValue);
        });
      });
    };

    console.log(`\n📝 Enter details for: ${video.filename}`);
    console.log('='.repeat(50));

    const defaultTitle = this.extractTitleFromFilename(video.filename);
    const title = await prompt('Video title', defaultTitle);
    
    const url = await prompt('YouTube URL (required)');
    if (!url) {
      console.log('❌ YouTube URL is required');
      return null;
    }

    const description = await prompt('Video description (optional)');
    
    const tagsInput = await prompt('Tags (comma-separated, optional)', 'review,product,amazon');
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

