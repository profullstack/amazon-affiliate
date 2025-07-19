import { createSlideshow } from './src/video-creator.js';
import { generateProductReviewScript } from './src/voiceover-generator.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Test script to verify slideshow functionality with multiple images
 */
const testSlideshow = async () => {
  console.log('🧪 Testing slideshow functionality...');

  try {
    // Create test directories
    await fs.mkdir('temp', { recursive: true });
    await fs.mkdir('output', { recursive: true });

    // Mock product data for testing
    const mockProductData = {
      title: 'Amazing Wireless Headphones - Premium Sound Quality',
      price: '$89.99',
      rating: 4.5,
      reviewCount: '1,234 reviews',
      features: [
        'Active Noise Cancellation',
        '30-hour battery life',
        'Premium sound quality',
        'Comfortable over-ear design'
      ],
      description: 'Experience premium audio with these wireless headphones featuring advanced noise cancellation technology and exceptional battery life.',
      images: [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg'
      ]
    };

    // Generate test review script
    console.log('📝 Generating product review script...');
    const reviewScript = generateProductReviewScript(mockProductData);
    console.log('Generated script:', reviewScript.substring(0, 200) + '...');

    // Create mock image files for testing (simple colored rectangles)
    const testImages = [];
    const colors = ['red', 'green', 'blue', 'yellow', 'purple'];
    
    for (let i = 0; i < 5; i++) {
      const imagePath = `temp/test-image-${i + 1}.png`;
      
      // Create a simple test image using ImageMagick (if available) or skip
      try {
        const { spawn } = await import('child_process');
        const color = colors[i];
        
        await new Promise((resolve, reject) => {
          const convert = spawn('convert', [
            '-size', '640x480',
            `xc:${color}`,
            '-pointsize', '48',
            '-fill', 'white',
            '-gravity', 'center',
            '-annotate', '+0+0', `Test Image ${i + 1}`,
            imagePath
          ]);

          convert.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`ImageMagick convert failed with code ${code}`));
            }
          });

          convert.on('error', reject);
        });

        testImages.push(imagePath);
        console.log(`✅ Created test image: ${imagePath}`);
      } catch (error) {
        console.warn(`⚠️ Could not create test image ${i + 1}: ${error.message}`);
        console.log('💡 Install ImageMagick for full testing: sudo apt-get install imagemagick');
      }
    }

    if (testImages.length === 0) {
      console.log('❌ No test images created. Cannot test slideshow functionality.');
      return;
    }

    // Create a simple test audio file (silence)
    const audioPath = 'temp/test-audio.wav';
    try {
      const { spawn } = await import('child_process');
      
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-f', 'lavfi',
          '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-t', '10', // 10 seconds of silence
          '-y',
          audioPath
        ]);

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg failed with code ${code}`));
          }
        });

        ffmpeg.on('error', reject);
      });

      console.log(`✅ Created test audio: ${audioPath}`);
    } catch (error) {
      console.error(`❌ Could not create test audio: ${error.message}`);
      return;
    }

    // Test slideshow creation
    console.log('🎬 Creating slideshow with multiple images...');
    const outputPath = 'output/test-slideshow.mp4';
    
    const options = {
      quality: 'medium',
      onProgress: (progress) => {
        console.log(`Progress: ${Math.round(progress.percent || 0)}%`);
      }
    };

    const videoPath = await createSlideshow(
      testImages,
      audioPath,
      outputPath,
      options
    );

    console.log(`✅ Slideshow created successfully: ${videoPath}`);

    // Check video file stats
    const stats = await fs.stat(videoPath);
    console.log(`📊 Video file size: ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);

    // Get video info using ffprobe
    try {
      const { spawn } = await import('child_process');
      
      await new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          videoPath
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => {
          output += data.toString();
        });

        ffprobe.on('close', (code) => {
          if (code === 0) {
            try {
              const info = JSON.parse(output);
              const videoStream = info.streams.find(s => s.codec_type === 'video');
              const audioStream = info.streams.find(s => s.codec_type === 'audio');
              
              console.log('📹 Video info:');
              console.log(`   Duration: ${parseFloat(info.format.duration).toFixed(2)}s`);
              console.log(`   Resolution: ${videoStream?.width}x${videoStream?.height}`);
              console.log(`   Video codec: ${videoStream?.codec_name}`);
              console.log(`   Audio codec: ${audioStream?.codec_name}`);
              
              resolve();
            } catch (parseError) {
              console.warn('⚠️ Could not parse video info');
              resolve();
            }
          } else {
            console.warn('⚠️ Could not get video info');
            resolve();
          }
        });

        ffprobe.on('error', () => {
          console.warn('⚠️ ffprobe not available');
          resolve();
        });
      });
    } catch (error) {
      console.warn('⚠️ Could not analyze video:', error.message);
    }

    console.log('\n🎉 Slideshow test completed successfully!');
    console.log(`📁 Test video saved to: ${videoPath}`);
    console.log('💡 You can play this video to verify the slideshow cycles through all images');

  } catch (error) {
    console.error('❌ Slideshow test failed:', error.message);
    console.error(error.stack);
  }
};

// Run the test
testSlideshow();