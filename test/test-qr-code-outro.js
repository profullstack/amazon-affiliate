import { createSlideshow, createShortVideo } from './src/video-creator.js';
import { generateVoiceover } from './src/voiceover-generator.js';
import { downloadImages } from './src/image-downloader.js';
import { generateSessionId } from './src/utils/temp-file-manager.js';
import fs from 'fs/promises';

const testQRCodeOutro = async () => {
  console.log('🧪 Testing QR Code Outro functionality...');
  
  const sessionId = generateSessionId();
  const tempDir = './temp';
  const outputDir = './output';
  
  // Ensure directories exist
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  
  try {
    // Test data
    const testImages = [
      'https://m.media-amazon.com/images/I/61Vy2LoQHgL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71QKQ9mwV7L._AC_SL1500_.jpg'
    ];
    
    const amazonUrl = 'https://www.amazon.com/dp/B0CPZKLJX1?tag=test-20';
    
    console.log('📥 Downloading test images...');
    const imagePaths = await downloadImages(testImages, tempDir, 3, { sessionId });
    console.log(`✅ Downloaded ${imagePaths.length} images`);
    
    console.log('🎤 Generating test voiceover...');
    const voiceoverPath = `${tempDir}/test-voiceover-${sessionId}.mp3`;
    await generateVoiceover(
      'This is a test product review. Let me tell you about this amazing product.',
      voiceoverPath
    );
    console.log(`✅ Voiceover generated: ${voiceoverPath}`);
    
    console.log('🎬 Creating video with QR code outro...');
    const videoPath = `${outputDir}/test-qr-outro-${sessionId}.mp4`;
    
    const videoOptions = {
      quality: 'medium',
      enableBackgroundMusic: false,
      enableIntroOutro: true,
      enableIntro: false, // Only outro
      amazonUrl: amazonUrl, // This should trigger QR code generation
      onProgress: (progress) => {
        console.log(`   Progress: ${Math.round(progress.percent || 0)}%`);
      }
    };
    
    const finalVideoPath = await createSlideshow(
      imagePaths,
      voiceoverPath,
      videoPath,
      videoOptions
    );
    
    console.log(`✅ Video created with QR code outro: ${finalVideoPath}`);
    
    // Check if video file exists and has reasonable size
    const stats = await fs.stat(finalVideoPath);
    const sizeMB = Math.round(stats.size / (1024 * 1024) * 10) / 10;
    console.log(`📊 Video size: ${sizeMB}MB`);
    
    if (sizeMB > 0.5) {
      console.log('✅ QR Code Outro test PASSED - Video created successfully');
    } else {
      console.log('❌ QR Code Outro test FAILED - Video too small');
    }
    
  } catch (error) {
    console.error('❌ QR Code Outro test FAILED:', error.message);
    console.error('Stack trace:', error.stack);
  }
};

// Run the test
testQRCodeOutro().catch(console.error);