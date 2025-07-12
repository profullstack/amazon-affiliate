/**
 * QR Code Generator Utility
 * Generates QR codes for Amazon affiliate URLs using the profullstack.com API
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Generates a QR code image for the given Amazon affiliate URL
 * @param {string} amazonUrl - The Amazon affiliate URL to encode
 * @param {string} outputPath - Path where to save the QR code image
 * @param {Object} options - QR code generation options
 * @returns {Promise<string>} - Path to the generated QR code image
 */
export const generateQRCode = async (amazonUrl, outputPath, options = {}) => {
  const {
    size = 250,
    errorCorrectionLevel = 'M'
  } = options;

  try {
    console.log(`🔗 Generating QR code for: ${amazonUrl}`);
    
    // Call the QR code generation API
    const response = await fetch('https://mcp.profullstack.com/tools/qr-generator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: amazonUrl,
        size,
        errorCorrectionLevel,
      }),
    });

    if (!response.ok) {
      throw new Error(`QR code API request failed: ${response.status} ${response.statusText}`);
    }

    // Parse the JSON response
    const jsonResponse = await response.json();
    
    // Check if the response contains the expected structure
    if (!jsonResponse.result || !jsonResponse.result.qrCode || !jsonResponse.result.qrCode.data) {
      throw new Error('Invalid API response: missing QR code data');
    }
    
    // Extract base64 data directly from the response
    const base64Data = jsonResponse.result.qrCode.data;
    
    if (!base64Data) {
      throw new Error('Invalid QR code data format');
    }
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save the QR code image
    await fs.writeFile(outputPath, imageBuffer);
    
    console.log(`✅ QR code saved to: ${outputPath}`);
    return outputPath;
    
  } catch (error) {
    console.error('❌ Failed to generate QR code:', error.message);
    throw new Error(`QR code generation failed: ${error.message}`);
  }
};

/**
 * Creates a QR code outro video segment with the QR code and instructions
 * @param {string} qrCodeImagePath - Path to the QR code image
 * @param {string} voiceoverPath - Path to the voiceover audio file
 * @param {string} outputPath - Path for the outro video
 * @param {number} duration - Duration of the outro in seconds (default: 10)
 * @returns {Promise<string>} - Path to the generated outro video
 */
export const createQRCodeOutro = async (qrCodeImagePath, voiceoverPath, outputPath, options = {}) => {
  const { duration = 10 } = options;
  const { execSync } = await import('child_process');
  
  try {
    console.log(`🎬 Creating QR code outro video...`);
    
    // Create a video with the QR code centered on a dark background
    const filterComplex = [
      '[1:v]scale=400:400[qr]',
      '[0:v][qr]overlay=(W-w)/2:(H-h)/2[video]',
      '[video]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=\'Scan QR Code or Screenshot to Visit Product Page\':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h-150[final]'
    ].join(';');
    
    const ffmpegCommand = [
      'ffmpeg',
      '-y', // Overwrite output file
      '-f', 'lavfi',
      '-i', `color=c=black:size=1920x1080:duration=${duration}`, // Black background
      '-i', qrCodeImagePath, // QR code image
      '-i', voiceoverPath, // Voiceover audio
      '-filter_complex', `"${filterComplex}"`,
      '-map', '[final]', // Use the final video
      '-map', '2:a', // Use the voiceover audio
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-t', duration.toString(),
      outputPath
    ];
    
    console.log(`🔧 Running FFmpeg command: ${ffmpegCommand.join(' ')}`);
    execSync(ffmpegCommand.join(' '), { stdio: 'inherit' });
    
    console.log(`✅ QR code outro created: ${outputPath}`);
    return outputPath;
    
  } catch (error) {
    console.error('❌ Failed to create QR code outro:', error.message);
    throw new Error(`QR code outro creation failed: ${error.message}`);
  }
};

/**
 * Generates the voiceover text for QR code instructions
 * @returns {string} - The voiceover script for QR code instructions
 */
export const getQRCodeVoiceoverText = () => {
  return "Scan the QR code or on mobile take a screenshot and scan it to go to the product page";
};