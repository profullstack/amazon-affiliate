import { generateQRCode, createQRCodeOutro, getQRCodeVoiceoverText } from './src/utils/qr-code-generator.js';
import fs from 'fs/promises';

const testQRCodeFunctionality = async () => {
  console.log('🧪 Testing QR Code functionality...');
  
  const tempDir = './temp';
  const amazonUrl = 'https://www.amazon.com/dp/B0CPZKLJX1?tag=test-20';
  
  // Ensure temp directory exists
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // Test 1: QR Code generation
    console.log('📱 Testing QR code generation...');
    const qrCodeFilePath = `${tempDir}/test-qr-code.png`;
    const qrCodePath = await generateQRCode(amazonUrl, qrCodeFilePath);
    console.log(`✅ QR code generated: ${qrCodePath}`);
    
    // Check if QR code file exists
    const qrStats = await fs.stat(qrCodePath);
    if (qrStats.size > 0) {
      console.log(`✅ QR code file size: ${qrStats.size} bytes`);
    } else {
      throw new Error('QR code file is empty');
    }
    
    // Test 2: Voiceover text generation
    console.log('🎤 Testing voiceover text generation...');
    const voiceoverText = getQRCodeVoiceoverText();
    console.log(`✅ Voiceover text: "${voiceoverText}"`);
    
    if (voiceoverText.includes('scan') && voiceoverText.includes('QR code')) {
      console.log('✅ Voiceover text contains expected keywords');
    } else {
      throw new Error('Voiceover text missing expected keywords');
    }
    
    // Test 3: QR Code outro video creation (without actual voiceover)
    console.log('🎬 Testing QR code outro video creation...');
    const outroVideoPath = `${tempDir}/test-qr-outro.mp4`;
    
    // Create a simple test voiceover file (silent audio)
    const testVoiceoverPath = `${tempDir}/test-voiceover.mp3`;
    
    // Create a 10-second silent audio file using FFmpeg
    const { execSync } = await import('child_process');
    execSync(`ffmpeg -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -t 10 -y "${testVoiceoverPath}"`, { stdio: 'pipe' });
    
    const outroResult = await createQRCodeOutro(
      qrCodePath,
      testVoiceoverPath,
      outroVideoPath,
      { duration: 10 }
    );
    
    console.log(`✅ QR code outro video created: ${outroResult}`);
    
    // Check if outro video file exists and has reasonable size
    const outroStats = await fs.stat(outroResult);
    if (outroStats.size > 1000) { // At least 1KB
      console.log(`✅ Outro video file size: ${Math.round(outroStats.size / 1024)}KB`);
      console.log('✅ QR Code functionality test PASSED');
    } else {
      throw new Error('Outro video file too small');
    }
    
  } catch (error) {
    console.error('❌ QR Code functionality test FAILED:', error.message);
    console.error('Stack trace:', error.stack);
  }
};

// Run the test
testQRCodeFunctionality().catch(console.error);