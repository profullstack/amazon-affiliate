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

    const platformsInput = await prompt('Platforms (comma-separated)', 'reddit,pinterest,twitter');
    const platforms = platformsInput ? platformsInput.split(',').map(p => p.trim()) : ['reddit', 'pinterest', 'twitter'];

    return {
      title,
      url,
      description,
      tags,
      platforms,
      thumbnailPath: video.thumbnailPath
    };
  }

  /**
   * Main promotion workflow
   */
  async promoteLocalVideo() {
    try {
      console.log('🚀 Local Video Promoter');
      console.log('Scanning for videos in ./output directory...\n');

      // Scan for videos
      const videos = await this.scanForVideos();
      this.displayVideos(videos);

      if (videos.length === 0) {
        return;
      }

      // Select video
      const selectedVideo = await this.selectVideo(videos);
      if (!selectedVideo) {
        console.log('👋 Goodbye!');
        return;
      }

      // Get video details
      const videoDetails = await this.promptForVideoDetails(selectedVideo);
      if (!videoDetails) {
        return;
      }

      // Confirm promotion
      console.log('\n📋 Promotion Summary:');
      console.log('='.repeat(30));
      console.log(`Video: ${selectedVideo.filename}`);
      console.log(`Title: ${videoDetails.title}`);
      console.log(`URL: ${videoDetails.url}`);
      console.log(`Tags: ${videoDetails.tags.join(', ')}`);
      console.log(`Platforms: ${videoDetails.platforms.join(', ')}`);
      console.log(`Thumbnail: ${videoDetails.thumbnailPath ? 'Available' : 'Missing'}`);

      const confirm = await new Promise(resolve => {
        this.rl.question('\nProceed with promotion? (y/N): ', answer => {
          resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
        });
      });

      if (!confirm) {
        console.log('❌ Promotion cancelled');
        return;
      }

      // Run promotion
      console.log('\n🚀 Starting promotion...');
      
      const promotionManager = new PromotionManager({
        headless: false, // Show browser windows for easier login
        enabledPlatforms: videoDetails.platforms
      });

      const results = await promotionManager.promoteVideo(videoDetails);

      // Display results
      console.log('\n📊 Promotion Results:');
      console.log('='.repeat(50));

      results.forEach(result => {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`${result.platform.toUpperCase()}: ${status}`);
        
        if (result.success) {
          if (result.posts) {
            result.posts.forEach(post => {
              if (post.success && post.postUrl) {
                console.log(`   📎 ${post.subreddit || 'Post'}: ${post.postUrl}`);
              }
            });
          }
          if (result.pins) {
            result.pins.forEach(pin => {
              if (pin.success && pin.pinUrl) {
                console.log(`   📎 ${pin.board}: ${pin.pinUrl}`);
              }
            });
          }
          if (result.url) {
            console.log(`   📎 ${result.type || 'Post'}: ${result.url}`);
          }
        } else {
          console.log(`   Error: ${result.error}`);
        }
        console.log('');
      });

      const successful = results.filter(r => r.success).length;
      console.log(`🎉 Promotion completed: ${successful}/${results.length} platforms successful`);

    } catch (error) {
      console.error(`❌ Promotion failed: ${error.message}`);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Quick promotion with minimal prompts
   */
  async quickPromote(videoFilename, youtubeUrl, options = {}) {
    try {
      const videos = await this.scanForVideos();
      const video = videos.find(v => v.filename === videoFilename);
      
      if (!video) {
        throw new Error(`Video file not found: ${videoFilename}`);
      }

      const videoDetails = {
        title: options.title || this.extractTitleFromFilename(video.filename),
        url: youtubeUrl,
        description: options.description || '',
        tags: options.tags || ['review', 'product', 'amazon'],
        platforms: options.platforms || ['reddit', 'pinterest', 'twitter'],
        thumbnailPath: video.thumbnailPath
      };

      console.log(`🚀 Quick promoting: ${video.filename}`);
      console.log(`📺 YouTube URL: ${youtubeUrl}`);
      console.log(`🏷️  Title: ${videoDetails.title}`);

      const promotionManager = new PromotionManager({
        headless: false, // Show browser windows for easier login
        enabledPlatforms: videoDetails.platforms
      });

      const results = await promotionManager.promoteVideo(videoDetails);
      
      const successful = results.filter(r => r.success).length;
      console.log(`✅ Quick promotion completed: ${successful}/${results.length} platforms successful`);
      
      return results;
    } catch (error) {
      console.error(`❌ Quick promotion failed: ${error.message}`);
      throw error;
    }
  }
}

// CLI interface
async function runCLI(args = process.argv.slice(2)) {
  const promoter = new LocalVideoPromoter();

  if (args.length === 0) {
    // Interactive mode
    await promoter.promoteLocalVideo();
  } else if (args.length >= 2) {
    // Quick mode: filename and YouTube URL
    const [filename, youtubeUrl, ...optionArgs] = args;
    
    const options = {};
    for (let i = 0; i < optionArgs.length; i += 2) {
      const key = optionArgs[i]?.replace('--', '');
      const value = optionArgs[i + 1];
      
      if (key === 'title') options.title = value;
      if (key === 'description') options.description = value;
      if (key === 'tags') options.tags = value?.split(',').map(t => t.trim());
      if (key === 'platforms') options.platforms = value?.split(',').map(p => p.trim());
    }
    
    await promoter.quickPromote(filename, youtubeUrl, options);
  } else {
    console.log(`
🚀 Local Video Promoter

Usage:
  # Interactive mode (recommended)
  node src/local-video-promoter.js

  # Quick mode
  node src/local-video-promoter.js <video-filename> <youtube-url> [options]

Options:
  --title <title>         Custom video title
  --description <desc>    Video description
  --tags <tags>           Comma-separated tags
  --platforms <list>      Comma-separated platforms

Examples:
  # Interactive mode
  node src/local-video-promoter.js

  # Quick mode
  node src/local-video-promoter.js "my-video-123456.mp4" "https://youtube.com/watch?v=abc123"
  
  # Quick mode with options
  node src/local-video-promoter.js "kitchen-gadget-123456.mp4" "https://youtube.com/watch?v=abc123" \\
    --title "Amazing Kitchen Gadget Review" \\
    --tags "kitchen,gadget,review" \\
    --platforms "reddit,twitter"
    `);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch(console.error);
}

export { LocalVideoPromoter };