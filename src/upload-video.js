import 'dotenv/config';
import { uploadToYouTube } from './youtube-publisher.js';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

/**
 * Simple CLI utility for uploading existing videos to YouTube
 */
class VideoUploader {
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
        const baseName = path.parse(videoFile).name;
        
        // Look for thumbnail files (multiple possible names)
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

        // Look for .txt description file
        const txtPath = path.join(this.outputDir, `${baseName}.txt`);
        let title = '';
        let description = '';
        try {
          const txtContent = await fs.readFile(txtPath, 'utf-8');
          const lines = txtContent.split('\n');
          title = lines[0]?.trim() || ''; // First line is title (already cleaned by description writer)
          description = lines.slice(1).join('\n').trim(); // Rest is description
        } catch {
          // Description file doesn't exist
        }
        
        videos.push({
          filename: videoFile,
          path: videoPath,
          thumbnailPath,
          title,
          description,
          size: Math.round(stats.size / (1024 * 1024) * 10) / 10, // MB
          created: stats.birthtime.toLocaleDateString(),
          baseName
        });
      }
      
      return videos.sort((a, b) => new Date(b.created) - new Date(a.created));
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
   * Upload video to YouTube
   */
  async uploadVideo(video) {
    try {
      if (!video.title) {
        throw new Error('No title found in .txt file. Please ensure the first line contains the video title.');
      }

      console.log('\n🚀 Starting YouTube upload...');
      console.log(`📹 Video: ${video.filename}`);
      console.log(`🏷️  Title: ${video.title}`);
      console.log(`🖼️  Thumbnail: ${video.thumbnailPath ? 'Will upload' : 'None'}`);
      
      // Show progress
      const progressCallback = (progress) => {
        const percent = progress.percent;
        const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
        process.stdout.write(`\r📤 Uploading: [${bar}] ${percent}%`);
      };

      const result = await uploadToYouTube(
        video.path,
        video.title,
        video.description,
        '', // No product URL for now
        {
          thumbnailPath: video.thumbnailPath,
          onProgress: progressCallback
        }
      );

      console.log('\n✅ Upload completed successfully!');
      console.log(`📺 YouTube URL: ${result.url}`);
      console.log(`🆔 Video ID: ${result.videoId}`);
      console.log(`🔒 Privacy: ${result.privacyStatus}`);
      
      if (result.thumbnailUploaded) {
        console.log('🖼️  Custom thumbnail uploaded');
      }

      return result;
    } catch (error) {
      console.error(`\n❌ Upload failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main upload workflow
   */
  async run() {
    try {
      console.log('🚀 YouTube Video Uploader');
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

      // Confirm upload
      console.log('\n📋 Upload Summary:');
      console.log('='.repeat(30));
      console.log(`Video: ${selectedVideo.filename}`);
      console.log(`Title: ${selectedVideo.title}`);
      console.log(`Description: ${selectedVideo.description ? 'Available' : 'None'}`);
      console.log(`Thumbnail: ${selectedVideo.thumbnailPath ? 'Available' : 'Missing'}`);

      const confirm = await new Promise(resolve => {
        this.rl.question('\nProceed with upload? (y/N): ', answer => {
          resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
        });
      });

      if (!confirm) {
        console.log('❌ Upload cancelled');
        return;
      }

      // Upload video
      const result = await this.uploadVideo(selectedVideo);
      return result;

    } catch (error) {
      console.error(`❌ Upload failed: ${error.message}`);
    } finally {
      this.rl.close();
    }
  }
}

// CLI interface
async function runCLI(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🚀 YouTube Video Uploader

Description:
  Simple tool to upload existing videos from ./output directory to YouTube.
  Automatically uses .txt files for title/description and .thumbnail.png for thumbnails.

Usage:
  node src/upload-video.js

File Structure Expected:
  ./output/
  ├── video-name.mp4              # Video file
  ├── video-name.txt              # Title (line 1) + Description (rest)
  └── video-name.thumbnail.png    # Thumbnail image

Features:
  • Scans ./output for video files (.mp4, .mov, .avi)
  • Uses first line of .txt file as video title
  • Uses rest of .txt file as video description
  • Automatically uploads .thumbnail.png as custom thumbnail
  • Shows upload progress with visual progress bar
  • Handles YouTube authentication and affiliate links

Examples:
  # Run the uploader
  node src/upload-video.js
  
  # Show this help
  node src/upload-video.js --help
    `);
    return;
  }

  const uploader = new VideoUploader();
  await uploader.run();
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await runCLI();
}

export { VideoUploader };