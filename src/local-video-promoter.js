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
          `${baseName}.thumbnail.png`,
          `${baseName}-thumbnail.png`,
          `${baseName}.png`,
          `${baseName}-thumbnail.jpg`,
          `${baseName}.thumbnail.jpg`,
          `${baseName}.jpg`
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

        // Look for description files (.txt for clean, .md for markdown)
        // Try exact match first, then fuzzy match for different timestamps
        let title = '';
        let cleanDescription = '';
        let markdownDescription = '';
        let txtPath = null;
        let mdPath = null;
        
        // First try exact match
        const exactTxtPath = path.join(this.outputDir, `${baseName}.txt`);
        const exactMdPath = path.join(this.outputDir, `${baseName}.md`);
        
        try {
          await fs.access(exactTxtPath);
          txtPath = exactTxtPath;
        } catch {
          // Try fuzzy match for .txt files
          const baseNameWithoutTimestamp = baseName.replace(/-\d{6}$/, '');
          const files = await fs.readdir(this.outputDir);
          const matchingTxtFile = files.find(file =>
            file.endsWith('.txt') &&
            file.startsWith(baseNameWithoutTimestamp) &&
            file.includes(baseNameWithoutTimestamp)
          );
          if (matchingTxtFile) {
            txtPath = path.join(this.outputDir, matchingTxtFile);
          }
        }
        
        try {
          await fs.access(exactMdPath);
          mdPath = exactMdPath;
        } catch {
          // Try fuzzy match for .md files
          const baseNameWithoutTimestamp = baseName.replace(/-\d{6}$/, '');
          const files = await fs.readdir(this.outputDir);
          const matchingMdFile = files.find(file =>
            file.endsWith('.md') &&
            file.startsWith(baseNameWithoutTimestamp) &&
            file.includes(baseNameWithoutTimestamp)
          );
          if (matchingMdFile) {
            mdPath = path.join(this.outputDir, matchingMdFile);
          }
        }
        
        // Read .txt file if found
        if (txtPath) {
          try {
            const txtContent = await fs.readFile(txtPath, 'utf-8');
            const lines = txtContent.split('\n');
            title = lines[0]?.trim() || '';
            cleanDescription = lines.slice(1).join('\n').trim();
          } catch (error) {
            console.warn(`⚠️ Could not read .txt file: ${txtPath}`);
          }
        }

        // Read .md file if found
        if (mdPath) {
          try {
            const mdContent = await fs.readFile(mdPath, 'utf-8');
            const lines = mdContent.split('\n');
            if (!title) {
              // Extract title from markdown if not found in .txt
              title = lines[0]?.trim().replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1') || '';
            }
            markdownDescription = lines.slice(1).join('\n').trim();
          } catch (error) {
            console.warn(`⚠️ Could not read .md file: ${mdPath}`);
          }
        }
        
        videos.push({
          filename: videoFile,
          path: videoPath,
          thumbnailPath,
          title,
          cleanDescription,
          markdownDescription,
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
      console.log(`   📝 Title: ${video.title || '❌ Missing'}`);
      console.log(`   📄 Clean Description: ${video.cleanDescription ? '✅ Found' : '❌ Missing'}`);
      console.log(`   📝 Markdown Description: ${video.markdownDescription ? '✅ Found' : '❌ Missing'}`);
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
   * Get appropriate description for platform
   * @param {Object} video - Video object with descriptions
   * @param {string} platform - Platform name (reddit, pinterest, twitter)
   * @returns {string} - Appropriate description for the platform
   */
  getDescriptionForPlatform(video, platform) {
    // Reddit supports markdown, so use markdown version if available
    if (platform === 'reddit' && video.markdownDescription) {
      return video.markdownDescription;
    }
    
    // For other platforms or fallback, use clean description
    return video.cleanDescription || video.markdownDescription || '';
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

    const defaultTitle = video.title || this.extractTitleFromFilename(video.filename);
    const title = await prompt('Video title', defaultTitle);
    
    const url = await prompt('YouTube URL (required)');
    if (!url) {
      console.log('❌ YouTube URL is required');
      return null;
    }

    // Show available descriptions
    if (video.cleanDescription || video.markdownDescription) {
      console.log('\n📄 Available descriptions:');
      if (video.cleanDescription) console.log('   ✅ Clean version (for most platforms)');
      if (video.markdownDescription) console.log('   ✅ Markdown version (for Reddit)');
      console.log('   💡 Platform-specific descriptions will be used automatically');
    }

    const customDescription = await prompt('Custom description (optional, leave empty to use auto-detected)');
    
    const tagsInput = await prompt('Tags (comma-separated, optional)', 'review,product,amazon');
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

    const platformsInput = await prompt('Platforms (comma-separated)', 'reddit,pinterest,twitter');
    const platforms = platformsInput ? platformsInput.split(',').map(p => p.trim()) : ['reddit', 'pinterest', 'twitter'];

    return {
      title,
      url,
      description: customDescription, // Custom description if provided
      tags,
      platforms,
      thumbnailPath: video.thumbnailPath,
      video // Pass the video object for platform-specific descriptions
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

      // Run promotion with platform-specific descriptions
      console.log('\n🚀 Starting promotion...');
      
      const promotionManager = new PromotionManager({
        headless: false, // Show browser windows for easier login
        enabledPlatforms: videoDetails.platforms
      });

      // Create platform-specific video data
      const baseVideoData = {
        title: videoDetails.title,
        url: videoDetails.url,
        tags: videoDetails.tags,
        thumbnailPath: videoDetails.thumbnailPath
      };

      let results;
      
      // Use custom description if provided, otherwise use platform-specific descriptions
      if (videoDetails.description) {
        baseVideoData.description = videoDetails.description;
        results = await promotionManager.promoteVideo(baseVideoData);
      } else {
        // Promote to each platform with appropriate description
        results = [];
        for (const platform of videoDetails.platforms) {
          const platformVideoData = {
            ...baseVideoData,
            description: this.getDescriptionForPlatform(videoDetails.video, platform)
          };
          
          console.log(`📝 Using ${platform === 'reddit' ? 'markdown' : 'clean'} description for ${platform}`);
          
          const platformManager = new PromotionManager({
            headless: false,
            enabledPlatforms: [platform]
          });
          
          const platformResults = await platformManager.promoteVideo(platformVideoData);
          results.push(...platformResults);
        }
      }

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
        title: options.title || video.title || this.extractTitleFromFilename(video.filename),
        url: youtubeUrl,
        description: options.description, // Use provided description or let platform-specific logic handle it
        tags: options.tags || ['review', 'product', 'amazon'],
        platforms: options.platforms || ['reddit', 'pinterest', 'twitter'],
        thumbnailPath: video.thumbnailPath,
        video // Pass video object for platform-specific descriptions
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