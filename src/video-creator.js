import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/**
 * Creates a simple video from a single image and audio using direct FFmpeg execution
 * @param {string} imagePath - Path to image file
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Path for output video
 * @param {Object} options - Video creation options
 * @returns {Promise<string>} Path to created video
 */
export async function createVideo(imagePath, audioPath, outputPath, options = {}) {
  const {
    resolution = '1920x1080',  // Default to 1080p for high quality
    fps = 30,                  // Higher fps for smoother video
    quality = 'high'           // Default to high quality
  } = options;

  // Convert quality string to numeric CRF value
  let crfValue = 23; // default
  if (typeof quality === 'string') {
    const qualityMap = {
      'low': 28,
      'medium': 23,
      'high': 18,
      'ultra': 15
    };
    crfValue = qualityMap[quality] || 23;
  } else if (typeof quality === 'number') {
    crfValue = quality;
  }

  // Validate inputs
  if (!imagePath || !audioPath) {
    throw new Error('Both image and audio paths are required');
  }

  // Convert to absolute paths to avoid path issues
  const absoluteImagePath = path.resolve(imagePath);
  const absoluteAudioPath = path.resolve(audioPath);
  const absoluteOutputPath = path.resolve(outputPath);

  // Check if files exist
  try {
    await fs.access(absoluteImagePath);
    await fs.access(absoluteAudioPath);
  } catch (error) {
    throw new Error(`Input file not found: ${error.message}`);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(absoluteOutputPath);
  await fs.mkdir(outputDir, { recursive: true });

  console.log('🎬 Creating video from single image...');
  console.log(`📁 Image: ${absoluteImagePath}`);
  console.log(`🎵 Audio: ${absoluteAudioPath}`);
  console.log(`📹 Output: ${absoluteOutputPath}`);

  // Get audio duration to set video length
  let audioDuration;
  try {
    audioDuration = await getAudioDuration(absoluteAudioPath);
    console.log(`🎵 Audio duration: ${audioDuration.toFixed(2)}s`);
    
    // Ensure minimum duration to avoid FFmpeg issues
    if (audioDuration < 1) {
      console.log('⚠️ Audio too short, using 5s minimum duration');
      audioDuration = 5;
    }
  } catch (error) {
    console.warn('⚠️ Could not get audio duration, using 30s default');
    audioDuration = 30;
  }

  return new Promise((resolve, reject) => {
    // Build FFmpeg command arguments with stable audio processing
    const ffmpegArgs = [
      '-loop', '1',
      '-t', audioDuration.toString(),
      '-i', absoluteImagePath,
      '-i', absoluteAudioPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:a', '128k',           // Fixed audio bitrate for consistency
      '-ar', '44100',           // Fixed sample rate
      '-ac', '2',               // Stereo audio
      '-pix_fmt', 'yuv420p',
      '-crf', crfValue.toString(),
      '-r', fps.toString(),
      '-s', resolution,
      '-avoid_negative_ts', 'make_zero',  // Prevent timing issues
      '-fflags', '+genpts',     // Generate presentation timestamps
      '-shortest',
      '-y',
      absoluteOutputPath
    ];

    console.log('🎥 FFmpeg command: ffmpeg', ffmpegArgs.join(' '));

    // Spawn FFmpeg process
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    // Capture stderr for error reporting
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      // Look for progress indicators
      const progressMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})/);
      if (progressMatch) {
        const [, hours, minutes, seconds] = progressMatch;
        const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
        const progress = Math.min((currentTime / audioDuration) * 100, 100);
        console.log(`📹 Progress: ${Math.round(progress)}%`);
      }
    });

    // Handle process completion
    ffmpegProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.stat(absoluteOutputPath);
          console.log(`✅ Video created: ${absoluteOutputPath} (${Math.round(stats.size / 1024)}KB)`);
          resolve(absoluteOutputPath);
        } catch (error) {
          reject(new Error(`Output file verification failed: ${error.message}`));
        }
      } else {
        console.error('❌ FFmpeg stderr:', stderr);
        reject(new Error(`FFmpeg failed with exit code ${code}: ${stderr}`));
      }
    });

    // Handle process errors
    ffmpegProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFmpeg: ${error.message}`));
    });

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      ffmpegProcess.kill('SIGTERM');
      reject(new Error('FFmpeg process timed out after 60 seconds'));
    }, 60000);

    ffmpegProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Creates a slideshow video from multiple images and audio
 * @param {string[]} imagePaths - Array of image file paths
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Path for output video
 * @param {Object} options - Video creation options
 * @returns {Promise<string>} Path to created video
 */
export async function createSlideshow(imagePaths, audioPath, outputPath, options = {}) {
  if (!imagePaths || imagePaths.length === 0) {
    throw new Error('At least one image is required');
  }

  const {
    resolution = '1920x1080',  // Default to 1080p for high quality
    fps = 30,                  // Higher fps for smoother slideshow
    quality = 'high'           // Default to high quality
  } = options;

  // Convert quality string to numeric CRF value
  let crfValue = 23; // default
  if (typeof quality === 'string') {
    const qualityMap = {
      'low': 28,
      'medium': 23,
      'high': 18,
      'ultra': 15
    };
    crfValue = qualityMap[quality] || 23;
  } else if (typeof quality === 'number') {
    crfValue = quality;
  }

  // Convert to absolute paths
  const absoluteImagePaths = imagePaths.map(p => path.resolve(p));
  const absoluteAudioPath = path.resolve(audioPath);
  const absoluteOutputPath = path.resolve(outputPath);

  // Check if files exist
  for (const imagePath of absoluteImagePaths) {
    try {
      await fs.access(imagePath);
    } catch (error) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
  }

  try {
    await fs.access(absoluteAudioPath);
  } catch (error) {
    throw new Error(`Audio file not found: ${absoluteAudioPath}`);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(absoluteOutputPath);
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`🎬 Creating slideshow from ${imagePaths.length} images...`);
  console.log(`📁 Images: ${absoluteImagePaths.join(', ')}`);
  console.log(`🎵 Audio: ${absoluteAudioPath}`);
  console.log(`📹 Output: ${absoluteOutputPath}`);

  // Get audio duration
  let audioDuration;
  try {
    audioDuration = await getAudioDuration(absoluteAudioPath);
    console.log(`🎵 Audio duration: ${audioDuration.toFixed(2)}s`);
  } catch (error) {
    console.warn('⚠️ Could not get audio duration, using 30s default');
    audioDuration = 30;
  }

  // Calculate duration per image
  const durationPerImage = audioDuration / imagePaths.length;
  console.log(`⏱️ Duration per image: ${durationPerImage.toFixed(2)}s`);

  return new Promise((resolve, reject) => {
    // Build FFmpeg command for slideshow with stable audio processing
    const ffmpegArgs = [];
    
    // Add each image as input with its duration
    for (let i = 0; i < absoluteImagePaths.length; i++) {
      ffmpegArgs.push(
        '-loop', '1',
        '-t', durationPerImage.toString(),
        '-i', absoluteImagePaths[i]
      );
    }
    
    // Add audio input
    ffmpegArgs.push('-i', absoluteAudioPath);
    
    // Create filter complex for concatenating images with stable audio
    let filterComplex = '';
    // Parse resolution to get width and height
    const [width, height] = resolution.split('x').map(Number);
    
    // Scale and pad each image, ensuring consistent timing
    for (let i = 0; i < absoluteImagePaths.length; i++) {
      filterComplex += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${fps},setpts=PTS-STARTPTS[v${i}];`;
    }
    
    // Concatenate all scaled images with precise timing
    filterComplex += absoluteImagePaths.map((_, i) => `[v${i}]`).join('') + `concat=n=${absoluteImagePaths.length}:v=1:a=0,fps=${fps}[outv]`;
    
    ffmpegArgs.push(
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', `${absoluteImagePaths.length}:a:0`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:a', '128k',           // Fixed audio bitrate for consistency
      '-ar', '44100',           // Fixed sample rate
      '-ac', '2',               // Stereo audio
      '-pix_fmt', 'yuv420p',
      '-crf', crfValue.toString(),
      '-r', fps.toString(),
      '-avoid_negative_ts', 'make_zero',  // Prevent timing issues
      '-fflags', '+genpts',     // Generate presentation timestamps
      '-shortest',
      '-y',
      absoluteOutputPath
    );

    console.log('🎥 FFmpeg slideshow command: ffmpeg', ffmpegArgs.join(' '));

    // Spawn FFmpeg process
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    // Capture stderr for error reporting and progress
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      // Look for progress indicators
      const progressMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})/);
      if (progressMatch) {
        const [, hours, minutes, seconds] = progressMatch;
        const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
        const progress = Math.min((currentTime / audioDuration) * 100, 100);
        console.log(`📹 Slideshow progress: ${Math.round(progress)}%`);
      }
    });

    // Handle process completion
    ffmpegProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.stat(absoluteOutputPath);
          console.log(`✅ Slideshow created: ${absoluteOutputPath} (${Math.round(stats.size / 1024)}KB)`);
          resolve(absoluteOutputPath);
        } catch (error) {
          reject(new Error(`Output file verification failed: ${error.message}`));
        }
      } else {
        console.error('❌ FFmpeg slideshow stderr:', stderr);
        reject(new Error(`FFmpeg slideshow failed with exit code ${code}: ${stderr}`));
      }
    });

    // Handle process errors
    ffmpegProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFmpeg slideshow: ${error.message}`));
    });

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      ffmpegProcess.kill('SIGTERM');
      reject(new Error('FFmpeg slideshow process timed out after 120 seconds'));
    }, 120000); // 2 minutes for slideshow

    ffmpegProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Gets the duration of an audio file using FFprobe
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<number>} Duration in seconds
 */
export async function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      audioPath
    ];

    const ffprobeProcess = spawn('ffprobe', ffprobeArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobeProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const metadata = JSON.parse(stdout);
          const duration = parseFloat(metadata.format.duration);
          if (isNaN(duration)) {
            reject(new Error('Could not determine audio duration'));
          } else {
            resolve(duration);
          }
        } catch (error) {
          reject(new Error(`Failed to parse FFprobe output: ${error.message}`));
        }
      } else {
        reject(new Error(`FFprobe failed with exit code ${code}: ${stderr}`));
      }
    });

    ffprobeProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFprobe: ${error.message}`));
    });
  });
}

/**
 * Validates video creation inputs
 * @param {string[]} imagePaths - Array of image paths
 * @param {string} audioPath - Audio file path
 * @returns {Promise<void>}
 */
export async function validateVideoInputs(imagePaths, audioPath) {
  if (!imagePaths || imagePaths.length === 0) {
    throw new Error('At least one image is required');
  }

  if (!audioPath) {
    throw new Error('Audio file path is required');
  }

  // Check if images exist
  for (const imagePath of imagePaths) {
    try {
      await fs.access(imagePath);
    } catch (error) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
  }

  // Check if audio file exists
  try {
    await fs.access(audioPath);
  } catch (error) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  console.log(`✅ Validated ${imagePaths.length} images and audio file`);
}

/**
 * Gets video information using ffprobe
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Object>} Video metadata
 */
export async function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath
    ];

    const ffprobeProcess = spawn('ffprobe', ffprobeArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobeProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const metadata = JSON.parse(stdout);
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          
          resolve({
            duration: metadata.format.duration,
            size: metadata.format.size,
            bitrate: metadata.format.bit_rate,
            video: videoStream ? {
              codec: videoStream.codec_name,
              width: videoStream.width,
              height: videoStream.height,
              fps: videoStream.r_frame_rate
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              sampleRate: audioStream.sample_rate,
              channels: audioStream.channels
            } : null
          });
        } catch (error) {
          reject(new Error(`Failed to parse FFprobe output: ${error.message}`));
        }
      } else {
        reject(new Error(`FFprobe failed with exit code ${code}: ${stderr}`));
      }
    });

    ffprobeProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFprobe: ${error.message}`));
    });
  });
}