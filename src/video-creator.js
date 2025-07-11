import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { processImagesWithSmartBackground } from './image-processor.js';
import { generateAffiliateOverlay } from './youtube-interactive-elements.js';
import { glob } from 'glob';
import {
  createSafeAudioFilter,
  normalizeVolume,
  validateFadeDuration,
  checkAudioClipping,
  logAudioConfig,
  analyzeAudioFile,
  AUDIO_LIMITS
} from './utils/audio-utils.js';

/**
 * Finds and randomly selects a background music file from ./media/*.wav
 * @returns {Promise<string|null>} Path to selected background music file or null if none found
 */
const selectRandomBackgroundMusic = async () => {
  try {
    const mediaFiles = await glob('./src/media/*.wav');
    
    if (mediaFiles.length === 0) {
      console.log('📵 No background music files found in ./src/media/*.wav');
      return null;
    }
    
    const selectedFile = mediaFiles[Math.floor(Math.random() * mediaFiles.length)];
    console.log(`🎵 Selected background music: ${path.basename(selectedFile)}`);
    return selectedFile;
  } catch (error) {
    console.warn('⚠️ Could not scan for background music files:', error.message);
    return null;
  }
};

/**
 * Creates audio mixing filter for background music with voiceover
 * @param {string} backgroundMusicPath - Path to background music file
 * @param {number} videoDuration - Duration of the video in seconds
 * @param {Object} options - Audio mixing options
 * @returns {Object} Audio filter configuration
 */
const createBackgroundMusicFilter = (backgroundMusicPath, videoDuration, options = {}) => {
  const {
    backgroundVolume = 0.15,  // 15% volume for subtle background
    fadeInDuration = 2.0,     // 2 second fade in
    fadeOutDuration = 2.0,    // 2 second fade out
    voiceoverVolume = 1.0     // 100% volume for voiceover
  } = options;

  console.log('🔧 Creating safe background music filter...');
  
  // Normalize volumes using safe audio utilities
  const safeVoiceVolume = normalizeVolume(voiceoverVolume, 'voice');
  const safeBackgroundVolume = normalizeVolume(backgroundVolume, 'background');
  const safeFadeIn = validateFadeDuration(fadeInDuration);
  const safeFadeOut = validateFadeDuration(fadeOutDuration);

  // Check for clipping
  const clippingAnalysis = checkAudioClipping({
    voice: safeVoiceVolume,
    background: safeBackgroundVolume
  });

  if (!clippingAnalysis.willClip) {
    console.log('✅ Audio levels are safe - no clipping risk detected');
  } else {
    console.warn('⚠️ Audio clipping risk detected in background music filter');
  }

  const fadeOutStart = Math.max(0, videoDuration - safeFadeOut);
  
  // Create complex audio filter for mixing voiceover with background music
  const audioFilter = [
    // Background music processing: loop, fade in/out, volume control
    `[1:a]aloop=loop=-1:size=2e+09,afade=t=in:st=0:d=${safeFadeIn},afade=t=out:st=${fadeOutStart}:d=${safeFadeOut},volume=${safeBackgroundVolume}[bg];`,
    // Voiceover processing: ensure consistent volume with 50% reduction for safety
    `[0:a]volume=${safeVoiceVolume * 0.5}[voice];`,
    // Mix both audio streams
    `[voice][bg]amix=inputs=2:duration=first:dropout_transition=2[audio_out]`
  ].join('');

  // Log the safe configuration
  logAudioConfig({
    voiceoverVolume: safeVoiceVolume,
    backgroundVolume: safeBackgroundVolume,
    fadeInDuration: safeFadeIn,
    fadeOutDuration: safeFadeOut,
    clippingAnalysis
  }, 'Background Music Filter');

  return {
    audioFilter,
    backgroundMusicPath,
    settings: {
      backgroundVolume: safeBackgroundVolume,
      fadeInDuration: safeFadeIn,
      fadeOutDuration: safeFadeOut,
      voiceoverVolume: safeVoiceVolume
    }
  };
};

/**
 * Creates intro segment for professional video branding (outro removed per user request)
 * @param {string} backgroundMusicPath - Path to background music file
 * @param {Object} options - Intro options
 * @returns {Object} Intro configuration
 */
const createIntroOutroSegments = async (backgroundMusicPath, options = {}) => {
  const {
    introDuration = 5.0,        // 5 second intro
    introVolume = 0.4,          // FIXED: 40% volume for intro music (was 100% - too loud!)
    introImagePath = './src/media/banner.jpg',
    introVoiceoverText = 'Welcome to The Professional Prompt where we review your favorite products'
  } = options;

  // Normalize intro volume to prevent loud noise
  const safeIntroVolume = normalizeVolume(introVolume, 'intro');
  
  if (safeIntroVolume !== introVolume) {
    console.log(`🔧 Intro volume normalized: ${introVolume} → ${safeIntroVolume} (was too loud!)`);
  }

  // Check if intro image exists
  const introExists = await checkFileExists(introImagePath);

  if (!introExists) {
    console.log(`⚠️ Intro image not found: ${introImagePath}`);
  }

  return {
    intro: {
      enabled: introExists,
      imagePath: introImagePath,
      duration: introDuration,
      volume: safeIntroVolume,  // Use normalized safe volume
      voiceoverText: introVoiceoverText
    },
    outro: {
      enabled: false,  // Outro completely removed per user request
      imagePath: null,
      duration: 0,
      volume: 0
    },
    totalExtraDuration: introExists ? introDuration : 0  // Only intro duration now
  };
};

/**
 * Checks if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True if file exists
 */
const checkFileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Creates complex FFmpeg filter for intro and main content (outro removed per user request)
 * @param {Object} config - Configuration object
 * @returns {string} FFmpeg filter complex string
 */
export const createIntroOutroFilter = (config) => {
  const {
    introConfig,
    mainContentConfig,
    backgroundMusicPath,
    totalDuration,
    resolution,
    introVoiceoverIndex = null,  // New parameter for intro voiceover audio
    mainVoiceoverIndex = null    // New parameter for main voiceover audio
  } = config;

  const [width, height] = resolution.split('x').map(Number);
  let filterComplex = '';
  let inputIndex = 0;
  let segmentFilters = [];

  // Intro segment - scale appropriately for aspect ratio
  if (introConfig.enabled) {
    // For vertical videos (like short videos), use decrease to fit content within frame
    // For horizontal videos, use increase to fill frame
    const isVertical = height > width;
    const scaleMode = isVertical ? 'decrease' : 'increase';
    const paddingColor = isVertical ? 'black' : 'black';
    
    if (isVertical) {
      // Vertical format: fit banner within frame with padding
      filterComplex += `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${paddingColor},setsar=1:1,setpts=PTS-STARTPTS[intro_v];`;
    } else {
      // Horizontal format: crop to fill frame
      filterComplex += `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1:1,setpts=PTS-STARTPTS[intro_v];`;
    }
    segmentFilters.push('[intro_v]');
    inputIndex++;
  }

  // Main content segments (images with transitions)
  const mainContentStart = inputIndex;
  for (let i = 0; i < mainContentConfig.imageCount; i++) {
    filterComplex += `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1:1,fps=30,setpts=PTS-STARTPTS[v${i}];`;
    inputIndex++;
  }

  // Add main content transitions
  if (mainContentConfig.imageCount > 1 && mainContentConfig.transitionConfig.filterComplex) {
    filterComplex += mainContentConfig.transitionConfig.filterComplex;
    segmentFilters.push('[outv]');
  } else if (mainContentConfig.imageCount === 1) {
    // Single main content image - use the processed video stream
    segmentFilters.push('[v0]');
  } else {
    // Fallback: concatenate all main content images
    const mainContentStreams = [];
    for (let i = 0; i < mainContentConfig.imageCount; i++) {
      mainContentStreams.push(`[v${i}]`);
    }
    filterComplex += `${mainContentStreams.join('')}concat=n=${mainContentConfig.imageCount}:v=1:a=0[main_v];`;
    segmentFilters.push('[main_v]');
  }

  // Concatenate video segments (intro + main content only, no outro)
  if (segmentFilters.length > 1) {
    filterComplex += `${segmentFilters.join('')}concat=n=${segmentFilters.length}:v=1:a=0[final_v];`;
  } else if (segmentFilters.length === 1) {
    // Single segment - just copy it to final output
    filterComplex += `${segmentFilters[0]}copy[final_v];`;
  } else {
    // Fallback - should not happen, but handle gracefully
    throw new Error('No video segments available for concatenation');
  }

  // Audio processing: intro voiceover + main voiceover + background music
  // mainVoiceoverIndex is now passed as a parameter
  const musicIndex = mainVoiceoverIndex + 1; // Background music (after main voiceover)
  
  if (backgroundMusicPath) {
    // Create volume-varying background music with dynamic intro volume control
    const introEnd = introConfig.enabled ? introConfig.duration : 0;
    const mainEnd = introEnd + mainContentConfig.duration;

    let musicFilter = `[${musicIndex}:a]aloop=loop=-1:size=2e+09`;
    
    // Apply different volumes for intro vs main content with SAFE levels
    if (introConfig.enabled && introVoiceoverIndex !== null) {
      // Get intro voiceover duration to determine when narration ends
      // For now, assume narration takes 70% of intro duration, then music volume increases
      const narrationEnd = introEnd * 0.7;
      
      // FIXED: Use safe volume levels to prevent loud noise
      const narrationVolume = normalizeVolume(0.1, 'background'); // 10% during narration
      const postNarrationVolume = normalizeVolume(0.3, 'intro');  // 30% after narration (was 60% - too loud!)
      
      musicFilter += `,volume=enable='between(t,0,${narrationEnd})':volume=${narrationVolume}`;
      musicFilter += `,volume=enable='between(t,${narrationEnd},${introEnd})':volume=${postNarrationVolume}`;
      
      console.log(`🎵 Intro music volumes: narration=${(narrationVolume*100).toFixed(0)}%, post-narration=${(postNarrationVolume*100).toFixed(0)}%`);
    } else if (introConfig.enabled) {
      // No intro voiceover - use normalized intro volume
      const safeIntroVolume = normalizeVolume(introConfig.volume, 'intro');
      musicFilter += `,volume=enable='between(t,0,${introEnd})':volume=${safeIntroVolume}`;
      console.log(`🎵 Intro music volume: ${(safeIntroVolume*100).toFixed(0)}%`);
    }
    
    // Lower volume during main content with normalization
    const safeBackgroundVolume = normalizeVolume(mainContentConfig.backgroundVolume, 'background');
    musicFilter += `,volume=enable='between(t,${introEnd},${mainEnd})':volume=${safeBackgroundVolume}`;
    console.log(`🎵 Main content background volume: ${(safeBackgroundVolume*100).toFixed(0)}%`);
    
    // Add fade in/out with validated durations
    const safeFadeIn = validateFadeDuration(2.0);
    const safeFadeOut = validateFadeDuration(2.0);
    musicFilter += `,afade=t=in:st=0:d=${safeFadeIn},afade=t=out:st=${totalDuration - safeFadeOut}:d=${safeFadeOut}[bg];`;
    
    filterComplex += musicFilter;

    if (introVoiceoverIndex !== null && introConfig.enabled) {
      // FIXED: Use correct audio inputs - intro voiceover and main voiceover are separate files
      // Intro voiceover: trim to intro duration and play from start with volume control
      filterComplex += `[${introVoiceoverIndex}:a]volume=0.5,atrim=0:${introEnd}[intro_voice];`;
      // Main voiceover: delay by intro duration so it starts after intro ends with volume control
      filterComplex += `[${mainVoiceoverIndex}:a]volume=0.5,adelay=${introEnd * 1000}|${introEnd * 1000}[delayed_main_voice];`;
      // Combine intro and delayed main voiceover (they won't overlap due to delay)
      filterComplex += `[intro_voice][delayed_main_voice]amix=inputs=2:duration=longest:dropout_transition=0[combined_voice];`;
      // Mix combined voice with background music
      filterComplex += `[combined_voice][bg]amix=inputs=2:duration=first:dropout_transition=2[audio_out];`;
    } else if (introConfig.enabled) {
      // Intro enabled but no intro voiceover - just delay main voiceover to start after intro with volume control
      filterComplex += `[${mainVoiceoverIndex}:a]volume=0.5,adelay=${introEnd * 1000}|${introEnd * 1000}[delayed_voice];`;
      filterComplex += `[delayed_voice][bg]amix=inputs=2:duration=first:dropout_transition=2[audio_out];`;
    } else {
      // No intro - main voiceover starts immediately with volume control
      filterComplex += `[${mainVoiceoverIndex}:a]volume=0.5[voice];`;
      filterComplex += `[voice][bg]amix=inputs=2:duration=first:dropout_transition=2[audio_out];`;
    }
  } else {
    // No background music
    if (introVoiceoverIndex !== null && introConfig.enabled) {
      // FIXED: Use correct audio inputs without background music with volume control
      // Intro voiceover: trim to intro duration and play from start with volume control
      filterComplex += `[${introVoiceoverIndex}:a]volume=0.5,atrim=0:${introEnd}[intro_voice];`;
      // Main voiceover: delay by intro duration so it starts after intro ends with volume control
      filterComplex += `[${mainVoiceoverIndex}:a]volume=0.5,adelay=${introEnd * 1000}|${introEnd * 1000}[delayed_main_voice];`;
      // Combine intro and delayed main voiceover (they won't overlap due to delay)
      filterComplex += `[intro_voice][delayed_main_voice]amix=inputs=2:duration=longest:dropout_transition=0[audio_out];`;
    } else if (introConfig.enabled) {
      // Intro enabled but no intro voiceover - just delay main voiceover to start after intro with volume control
      const introEnd = introConfig.enabled ? introConfig.duration : 0;
      filterComplex += `[${mainVoiceoverIndex}:a]volume=0.5,adelay=${introEnd * 1000}|${introEnd * 1000}[audio_out];`;
    } else {
      // No intro - main voiceover starts immediately with volume control
      filterComplex += `[${mainVoiceoverIndex}:a]volume=0.5[audio_out];`;
    }
  }

  return filterComplex;
};

/**
 * Available transition types for slideshow videos
 */
const TRANSITION_TYPES = [
  'fade',
  'slideLeft',
  'slideRight',
  'slideUp',
  'slideDown'
];

/**
 * Generates a random transition effect for slideshow videos
 * @param {number} duration - Transition duration in seconds
 * @returns {Object} Transition configuration
 */
const generateRandomTransition = (duration = 0.5) => {
  const transitionType = TRANSITION_TYPES[Math.floor(Math.random() * TRANSITION_TYPES.length)];
  
  switch (transitionType) {
    case 'fade':
      return {
        type: 'fade',
        filter: `fade=t=in:st=0:d=${duration},fade=t=out:st=${duration}:d=${duration}`,
        description: 'Fade in/out'
      };
    
    case 'slideLeft':
      return {
        type: 'slideLeft',
        filter: `slide=direction=left:duration=${duration}`,
        description: 'Slide from right to left'
      };
    
    case 'slideRight':
      return {
        type: 'slideRight',
        filter: `slide=direction=right:duration=${duration}`,
        description: 'Slide from left to right'
      };
    
    case 'slideUp':
      return {
        type: 'slideUp',
        filter: `slide=direction=up:duration=${duration}`,
        description: 'Slide from bottom to top'
      };
    
    case 'slideDown':
      return {
        type: 'slideDown',
        filter: `slide=direction=down:duration=${duration}`,
        description: 'Slide from top to bottom'
      };
    
    default:
      return {
        type: 'fade',
        filter: `fade=t=in:st=0:d=${duration},fade=t=out:st=${duration}:d=${duration}`,
        description: 'Fade in/out (default)'
      };
  }
};

/**
 * Creates smooth transition effects between slides using FFmpeg xfade filter
 * @param {number} imageCount - Number of images in slideshow
 * @param {number} durationPerImage - Duration each image is shown
 * @param {number} transitionDuration - Duration of transition effect
 * @returns {Object} Transition configuration for FFmpeg
 */
const createSlideshowTransitions = (imageCount, durationPerImage, transitionDuration = 0.5) => {
  if (imageCount < 2) {
    return { filterComplex: '', transitions: [] };
  }

  const transitions = [];
  let filterComplex = '';
  
  // Generate random transitions for each slide change
  for (let i = 0; i < imageCount - 1; i++) {
    const transition = generateRandomTransition(transitionDuration);
    transitions.push({
      from: i,
      to: i + 1,
      ...transition
    });
  }

  // Build xfade filter chain for smooth transitions
  const transitionEffects = [
    'fade', 'fadeblack', 'fadewhite', 'distance', 'wipeleft', 'wiperight',
    'wipeup', 'wipedown', 'slideleft', 'slideright', 'slideup', 'slidedown',
    'circlecrop', 'rectcrop', 'circleopen', 'circleclose', 'vertopen', 'vertclose',
    'horzopen', 'horzclose', 'dissolve', 'pixelize', 'diagtl', 'diagtr', 'diagbl', 'diagbr'
  ];

  // Create xfade chain for smooth transitions between images
  let currentStream = '[v0]';
  
  for (let i = 0; i < imageCount - 1; i++) {
    const randomEffect = transitionEffects[Math.floor(Math.random() * transitionEffects.length)];
    const transitionStart = (i + 1) * durationPerImage - transitionDuration;
    const nextStream = i === imageCount - 2 ? '[outv]' : `[t${i}]`;
    
    // Simple xfade without additional fps filters (they're already applied)
    filterComplex += `${currentStream}[v${i + 1}]xfade=transition=${randomEffect}:duration=${transitionDuration}:offset=${transitionStart}${nextStream};`;
    currentStream = nextStream;
    
    // Update transition info
    transitions[i].effect = randomEffect;
    transitions[i].startTime = transitionStart;
    
    console.log(`🎬 Transition ${i + 1}: ${randomEffect} (${transitionStart.toFixed(1)}s - ${(transitionStart + transitionDuration).toFixed(1)}s)`);
  }

  return {
    filterComplex,
    transitions,
    transitionDuration
  };
};

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
    quality = 'high',          // Default to high quality
    enableBackgroundMusic = true,  // Enable background music by default
    enableIntroOutro = true,       // Enable intro/outro by default
    introOutroOptions = {}         // Options for intro/outro configuration
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

  // Select background music if enabled
  let backgroundMusicPath = null;
  let backgroundMusicConfig = null;
  if (enableBackgroundMusic) {
    backgroundMusicPath = await selectRandomBackgroundMusic();
    if (backgroundMusicPath) {
      console.log(`🎼 Background music: ${path.basename(backgroundMusicPath)}`);
    }
  }

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

  // Create intro configuration if enabled (outro removed per user request)
  let introOutroConfig = null;
  let totalVideoDuration = audioDuration;
  let introVoiceoverPath = null;
  
  if (enableIntroOutro) {
    introOutroConfig = await createIntroOutroSegments(backgroundMusicPath, introOutroOptions);
    totalVideoDuration += introOutroConfig.totalExtraDuration;
    console.log(`🎭 Intro segment: intro=${introOutroConfig.intro.enabled} (outro removed)`);
    console.log(`⏱️ Total video duration: ${totalVideoDuration.toFixed(2)}s (including intro)`);
    
    // Generate intro voiceover if intro is enabled
    if (introOutroConfig.intro.enabled && introOutroConfig.intro.voiceoverText) {
      console.log('🎤 Generating intro voiceover...');
      const { generateVoiceover, getRandomVoice } = await import('./voiceover-generator.js');
      introVoiceoverPath = path.resolve(`${path.dirname(outputPath)}/intro-voiceover.mp3`);
      
      try {
        // FIXED: Select a specific voice and store it for consistency between intro and main voiceover
        // Use the same voice that will be used for the main voiceover (if already selected) or select one now
        let selectedVoice = options.selectedVoiceId;
        if (!selectedVoice) {
          selectedVoice = getRandomVoice(options.voiceGender);
          options.selectedVoiceId = selectedVoice; // Store for main voiceover to use
        }
        console.log(`🎤 Using consistent voice for intro and main: ${selectedVoice}`);
        
        // Use the same voice settings as the main voiceover for consistency
        await generateVoiceover(
          introOutroConfig.intro.voiceoverText,
          introVoiceoverPath,
          undefined, // Use default voice settings
          options.voiceGender, // Pass voice gender for consistency
          selectedVoice // Pass the specific voice ID to ensure consistency
        );
        console.log(`✅ Intro voiceover generated: ${introVoiceoverPath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to generate intro voiceover: ${error.message}`);
        introVoiceoverPath = null;
      }
    }
  }

  return new Promise((resolve, reject) => {
    // Build FFmpeg command arguments with stable audio processing and proper scaling
    const [width, height] = resolution.split('x').map(Number);
    
    let ffmpegArgs;
    
    if (introOutroConfig && introOutroConfig.intro.enabled) {
      // Use intro with complex filter (outro removed per user request)
      ffmpegArgs = [];
      let inputIndex = 0;
      
      // Add intro image
      ffmpegArgs.push('-loop', '1', '-t', introOutroConfig.intro.duration.toString(), '-i', introOutroConfig.intro.imagePath);
      inputIndex++;
      
      // Add main image
      ffmpegArgs.push('-loop', '1', '-t', audioDuration.toString(), '-i', absoluteImagePath);
      inputIndex++;
      
      // Add intro voiceover if available
      let introVoiceoverIndex = null;
      if (introVoiceoverPath) {
        ffmpegArgs.push('-i', introVoiceoverPath);
        introVoiceoverIndex = inputIndex;
        inputIndex++;
      }
      
      // Add main audio
      ffmpegArgs.push('-i', absoluteAudioPath);
      const mainVoiceoverIndex = inputIndex;
      inputIndex++;
      
      // Add background music
      if (backgroundMusicPath) {
        ffmpegArgs.push('-i', backgroundMusicPath);
        inputIndex++;
      }
      
      // Create complex filter for intro + main content
      const mainContentConfig = {
        imageCount: 1,
        duration: audioDuration,
        backgroundVolume: 0.15,
        transitionConfig: { filterComplex: '' }
      };
      
      const filterComplex = createIntroOutroFilter({
        introConfig: introOutroConfig.intro,
        mainContentConfig: mainContentConfig,
        backgroundMusicPath: backgroundMusicPath,
        totalDuration: totalVideoDuration,
        resolution: resolution,
        introVoiceoverIndex: introVoiceoverIndex,
        mainVoiceoverIndex: mainVoiceoverIndex
      });
      
      ffmpegArgs.push(
        '-filter_complex', filterComplex,
        '-map', '[final_v]',
        '-map', '[audio_out]',
        '-pix_fmt', 'yuv420p',
        '-color_range', 'tv',
        '-colorspace', 'bt709',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-profile:v', 'baseline',
        '-level:v', '3.0',
        '-crf', crfValue.toString(),
        '-r', '25',
        '-g', '50',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'mp4',
        '-movflags', '+faststart',
        '-avoid_negative_ts', 'make_zero',
        '-shortest',
        '-y',
        absoluteOutputPath
      );
      
      console.log(`🎼 Mixing audio with intro: Voice (100%) + Background (intro: ${(introOutroConfig.intro.volume * 100).toFixed(0)}%, main: 15%)`);
      
    } else if (backgroundMusicPath) {
      // Create background music configuration
      backgroundMusicConfig = createBackgroundMusicFilter(backgroundMusicPath, audioDuration);
      console.log(`🎼 Mixing audio: Voice (100%) + Background (${(backgroundMusicConfig.settings.backgroundVolume * 100).toFixed(0)}%)`);
      
      ffmpegArgs = [
        '-loop', '1',
        '-t', audioDuration.toString(),
        '-i', absoluteImagePath,
        '-i', absoluteAudioPath,
        '-i', backgroundMusicPath,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
        '-filter_complex', backgroundMusicConfig.audioFilter,
        '-map', '0:v',
        '-map', '[audio_out]',
        '-pix_fmt', 'yuv420p',
        '-color_range', 'tv',
        '-colorspace', 'bt709',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-profile:v', 'baseline',
        '-level:v', '3.0',
        '-crf', crfValue.toString(),
        '-r', '25',
        '-g', '50',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'mp4',
        '-movflags', '+faststart',
        '-avoid_negative_ts', 'make_zero',
        '-shortest',
        '-shortest',
        '-y',
        absoluteOutputPath
      ];
    } else {
      // Original single audio track
      ffmpegArgs = [
        '-loop', '1',
        '-t', audioDuration.toString(),
        '-i', absoluteImagePath,
        '-i', absoluteAudioPath,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
        '-pix_fmt', 'yuv420p',
        '-color_range', 'tv',
        '-colorspace', 'bt709',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-profile:v', 'baseline',
        '-level:v', '3.0',
        '-crf', crfValue.toString(),
        '-r', '25',
        '-g', '50',
        '-c:a', 'aac',
        '-b:a', '96k',           // Lower bitrate for compatibility
        '-ar', '44100',           // Fixed sample rate
        '-ac', '2',               // Stereo audio
        '-f', 'mp4',
        '-movflags', '+faststart',
        '-avoid_negative_ts', 'make_zero',  // Prevent timing issues
        '-shortest',
        '-shortest',
        '-y',
        absoluteOutputPath
      ];
    }

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
    quality = 'high',          // Default to high quality
    enableBackgroundMusic = true,  // Enable background music by default
    enableIntroOutro = true,       // Enable intro/outro by default
    introOutroOptions = {}         // Options for intro/outro configuration
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

  // Select background music if enabled
  let backgroundMusicPath = null;
  let backgroundMusicConfig = null;
  if (enableBackgroundMusic) {
    backgroundMusicPath = await selectRandomBackgroundMusic();
    if (backgroundMusicPath) {
      console.log(`🎼 Background music: ${path.basename(backgroundMusicPath)}`);
    }
  }

  // Get audio duration
  let audioDuration;
  try {
    audioDuration = await getAudioDuration(absoluteAudioPath);
    console.log(`🎵 Audio duration: ${audioDuration.toFixed(2)}s`);
  } catch (error) {
    console.warn('⚠️ Could not get audio duration, using 30s default');
    audioDuration = 30;
  }

  // Create intro configuration if enabled (outro removed per user request)
  let introOutroConfig = null;
  let totalVideoDuration = audioDuration;
  let introVoiceoverPath = null;
  
  if (enableIntroOutro) {
    introOutroConfig = await createIntroOutroSegments(backgroundMusicPath, introOutroOptions);
    totalVideoDuration += introOutroConfig.totalExtraDuration;
    console.log(`🎭 Slideshow intro segment: intro=${introOutroConfig.intro.enabled} (outro removed)`);
    console.log(`⏱️ Total slideshow duration: ${totalVideoDuration.toFixed(2)}s (including intro)`);
    
    // Generate intro voiceover if intro is enabled
    if (introOutroConfig.intro.enabled && introOutroConfig.intro.voiceoverText) {
      console.log('🎤 Generating slideshow intro voiceover...');
      const { generateVoiceover, getRandomVoice } = await import('./voiceover-generator.js');
      introVoiceoverPath = path.resolve(`${path.dirname(outputPath)}/slideshow-intro-voiceover.mp3`);
      
      try {
        // FIXED: Select a specific voice and store it for consistency between intro and main voiceover
        // Use the same voice that will be used for the main voiceover (if already selected) or select one now
        let selectedVoice = options.selectedVoiceId;
        if (!selectedVoice) {
          selectedVoice = getRandomVoice(options.voiceGender);
          options.selectedVoiceId = selectedVoice; // Store for main voiceover to use
        }
        console.log(`🎤 Using consistent voice for slideshow intro and main: ${selectedVoice}`);
        
        // Use the same voice settings as the main voiceover for consistency
        await generateVoiceover(
          introOutroConfig.intro.voiceoverText,
          introVoiceoverPath,
          undefined, // Use default voice settings
          options.voiceGender, // Pass voice gender for consistency
          selectedVoice // Pass the specific voice ID to ensure consistency
        );
        console.log(`✅ Slideshow intro voiceover generated: ${introVoiceoverPath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to generate slideshow intro voiceover: ${error.message}`);
        introVoiceoverPath = null;
      }
    }
  }

  // Calculate duration per image
  const durationPerImage = audioDuration / imagePaths.length;
  console.log(`⏱️ Duration per image: ${durationPerImage.toFixed(2)}s`);

  // Use simple concatenation for now to ensure reliability
  console.log('🔄 Using simple concatenation for maximum compatibility');
  const transitionDuration = 0.5; // Define for compatibility, but not used
  const transitionConfig = { filterComplex: '', transitions: [] };

  return new Promise((resolve, reject) => {
    let ffmpegArgs;
    
    if (introOutroConfig && introOutroConfig.intro.enabled) {
      // Use intro with complex filter for slideshow (outro removed per user request)
      ffmpegArgs = [];
      let inputIndex = 0;
      
      // Add intro image
      ffmpegArgs.push('-loop', '1', '-t', introOutroConfig.intro.duration.toString(), '-i', introOutroConfig.intro.imagePath);
      inputIndex++;
      
      // Add main images
      for (let i = 0; i < absoluteImagePaths.length; i++) {
        ffmpegArgs.push('-loop', '1', '-t', durationPerImage.toString(), '-i', absoluteImagePaths[i]);
        inputIndex++;
      }
      
      // Add intro voiceover if available
      let introVoiceoverIndex = null;
      if (introVoiceoverPath) {
        ffmpegArgs.push('-i', introVoiceoverPath);
        introVoiceoverIndex = inputIndex;
        inputIndex++;
      }
      
      // Add main audio
      ffmpegArgs.push('-i', absoluteAudioPath);
      const mainVoiceoverIndex = inputIndex;
      inputIndex++;
      
      // Add background music
      if (backgroundMusicPath) {
        ffmpegArgs.push('-i', backgroundMusicPath);
        inputIndex++;
      }
      
      // Create complex filter for intro + slideshow
      const mainContentConfig = {
        imageCount: absoluteImagePaths.length,
        duration: audioDuration,
        backgroundVolume: 0.15,
        transitionConfig: { filterComplex: '' }
      };
      
      const filterComplex = createIntroOutroFilter({
        introConfig: introOutroConfig.intro,
        mainContentConfig: mainContentConfig,
        backgroundMusicPath: backgroundMusicPath,
        totalDuration: totalVideoDuration,
        resolution: resolution,
        introVoiceoverIndex: introVoiceoverIndex,
        mainVoiceoverIndex: mainVoiceoverIndex
      });
      
      ffmpegArgs.push(
        '-filter_complex', filterComplex,
        '-map', '[final_v]',
        '-map', '[audio_out]',
        '-pix_fmt', 'yuv420p',
        '-color_range', 'tv',
        '-colorspace', 'bt709',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-profile:v', 'baseline',
        '-level:v', '3.0',
        '-crf', crfValue.toString(),
        '-r', '25',
        '-g', '50',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'mp4',
        '-movflags', '+faststart',
        '-avoid_negative_ts', 'make_zero',
        '-shortest',
        // Don't use -shortest with intro to allow full extended duration
        '-y',
        absoluteOutputPath
      );
      
      console.log(`🎼 Slideshow mixing audio with intro: Voice (100%) + Background (intro: ${(introOutroConfig.intro.volume * 100).toFixed(0)}%, main: 15%)`);
      
    } else {
      // Build FFmpeg command for slideshow with smooth transitions
      ffmpegArgs = [];
      
      // Add each image as input with extended duration for transitions
      const extendedDuration = durationPerImage + (transitionDuration / 2);
      for (let i = 0; i < absoluteImagePaths.length; i++) {
        ffmpegArgs.push(
          '-loop', '1',
          '-t', extendedDuration.toString(),
          '-i', absoluteImagePaths[i]
        );
      }
      
      // Add audio input
      ffmpegArgs.push('-i', absoluteAudioPath);
      
      // Add background music input if available
      if (backgroundMusicPath) {
        ffmpegArgs.push('-i', backgroundMusicPath);
        backgroundMusicConfig = createBackgroundMusicFilter(backgroundMusicPath, audioDuration);
        console.log(`🎼 Mixing slideshow audio: Voice (100%) + Background (${(backgroundMusicConfig.settings.backgroundVolume * 100).toFixed(0)}%)`);
      }
      
      // Create filter complex with smooth transitions
      let filterComplex = '';
      const [width, height] = resolution.split('x').map(Number);
      
      // Scale and pad each image, ensuring consistent timing and SAR
      for (let i = 0; i < absoluteImagePaths.length; i++) {
        filterComplex += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1:1,fps=${fps},setpts=PTS-STARTPTS[v${i}];`;
      }
      
      // Add smooth transitions between images
      if (absoluteImagePaths.length > 1 && transitionConfig.filterComplex) {
        filterComplex += transitionConfig.filterComplex;
      } else if (absoluteImagePaths.length > 1) {
        // Fallback: simple concatenation without transitions
        console.log('🔄 Using simple concatenation fallback (no transitions)');
        filterComplex += absoluteImagePaths.map((_, i) => `[v${i}]`).join('') + `concat=n=${absoluteImagePaths.length}:v=1:a=0[outv];`;
      } else {
        // Single image - no transitions needed
        filterComplex += '[v0]copy[outv];';
      }
      
      if (backgroundMusicPath) {
        // Add background music filter to the complex filter
        const audioInputIndex = absoluteImagePaths.length; // Voiceover audio index
        const musicInputIndex = absoluteImagePaths.length + 1; // Background music index
        
        // Update the filter complex to include background music mixing with volume control
        filterComplex += `[${audioInputIndex}:a]volume=${backgroundMusicConfig.settings.voiceoverVolume * 0.5}[voice];`;
        filterComplex += `[${musicInputIndex}:a]aloop=loop=-1:size=2e+09,afade=t=in:st=0:d=${backgroundMusicConfig.settings.fadeInDuration},afade=t=out:st=${Math.max(0, audioDuration - backgroundMusicConfig.settings.fadeOutDuration)}:d=${backgroundMusicConfig.settings.fadeOutDuration},volume=${backgroundMusicConfig.settings.backgroundVolume}[bg];`;
        filterComplex += `[voice][bg]amix=inputs=2:duration=first:dropout_transition=2[audio_out];`;
        
        ffmpegArgs.push(
          '-filter_complex', filterComplex,
          '-map', '[outv]',
          '-map', '[audio_out]',
          '-pix_fmt', 'yuv420p',
          '-color_range', 'tv',
          '-colorspace', 'bt709',
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-profile:v', 'baseline',
          '-level:v', '3.0',
          '-crf', crfValue.toString(),
          '-r', '25',
          '-g', '50',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-ar', '44100',
          '-ac', '2',
          '-f', 'mp4',
          '-movflags', '+faststart',
          '-avoid_negative_ts', 'make_zero',
          '-shortest',
          '-shortest',
          '-y',
          absoluteOutputPath
        );
      } else {
        // Original audio mapping without background music
        ffmpegArgs.push(
          '-filter_complex', filterComplex,
          '-map', '[outv]',
          '-map', `${absoluteImagePaths.length}:a:0`,
          '-pix_fmt', 'yuv420p',
          '-color_range', 'tv',
          '-colorspace', 'bt709',
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-profile:v', 'baseline',
          '-level:v', '3.0',
          '-crf', crfValue.toString(),
          '-r', '25',
          '-g', '50',
          '-c:a', 'aac',
          '-b:a', '96k',           // Lower bitrate for compatibility
          '-ar', '44100',           // Fixed sample rate
          '-ac', '2',               // Stereo audio
          '-f', 'mp4',
          '-movflags', '+faststart',
          '-avoid_negative_ts', 'make_zero',  // Prevent timing issues
          '-shortest',
          '-shortest',
          '-y',
          absoluteOutputPath
        );
      }
    }

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

/**
 * Creates a short video for social media (Instagram Reels, TikTok, YouTube Shorts)
 * Uses the full audio duration but optimized for short-form content
 * @param {string[]} imagePaths - Array of image file paths
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Path for output video
 * @param {Object} options - Video creation options
 * @returns {Promise<string>} Path to created short video
 */
export async function createShortVideo(imagePaths, audioPath, outputPath, options = {}) {
  if (!imagePaths || imagePaths.length === 0) {
    throw new Error('At least one image is required');
  }

  const {
    resolution = '1080x1920',      // Vertical format for mobile (9:16 aspect ratio)
    fps = 30,                      // High fps for smooth playback
    quality = 'high',              // High quality for social media
    enableBackgroundMusic = true,  // Enable background music by default
    enableIntroOutro = true,       // Enable intro/outro by default
    introOutroOptions = {}         // Options for intro/outro configuration
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

  console.log('🎨 Using original images with proper scaling...');

  // Get actual audio duration
  let audioDuration;
  try {
    audioDuration = await getAudioDuration(absoluteAudioPath);
    console.log(`🎵 Audio duration: ${audioDuration.toFixed(2)}s`);
  } catch (error) {
    console.warn('⚠️ Could not get audio duration, using 30s default');
    audioDuration = 30;
  }

  console.log(`📱 Creating ${audioDuration.toFixed(1)}s short video from ${imagePaths.length} images...`);
  console.log(`📁 Images: ${absoluteImagePaths.join(', ')}`);
  console.log(`🎵 Audio: ${absoluteAudioPath}`);
  console.log(`📹 Output: ${absoluteOutputPath}`);
  console.log(`📐 Resolution: ${resolution} (vertical format for mobile)`);

  // Select background music if enabled
  let backgroundMusicPath = null;
  let backgroundMusicConfig = null;
  if (enableBackgroundMusic) {
    backgroundMusicPath = await selectRandomBackgroundMusic();
    if (backgroundMusicPath) {
      console.log(`🎼 Short video background music: ${path.basename(backgroundMusicPath)}`);
    }
  }

  // Create intro configuration if enabled (outro removed per user request)
  let introOutroConfig = null;
  let totalVideoDuration = audioDuration;
  let introVoiceoverPath = null;
  
  if (enableIntroOutro) {
    introOutroConfig = await createIntroOutroSegments(backgroundMusicPath, introOutroOptions);
    totalVideoDuration += introOutroConfig.totalExtraDuration;
    console.log(`🎭 Short video intro segment: intro=${introOutroConfig.intro.enabled} (outro removed)`);
    console.log(`⏱️ Total short video duration: ${totalVideoDuration.toFixed(2)}s (including intro)`);
    
    // Generate intro voiceover if intro is enabled
    if (introOutroConfig.intro.enabled && introOutroConfig.intro.voiceoverText) {
      console.log('🎤 Generating short video intro voiceover...');
      const { generateVoiceover, getRandomVoice } = await import('./voiceover-generator.js');
      introVoiceoverPath = path.resolve(`${path.dirname(outputPath)}/short-intro-voiceover.mp3`);
      
      try {
        // FIXED: Select a specific voice and store it for consistency between intro and main voiceover
        // Use the same voice that will be used for the main voiceover (if already selected) or select one now
        let selectedVoice = options.selectedVoiceId;
        if (!selectedVoice) {
          selectedVoice = getRandomVoice(options.voiceGender);
          options.selectedVoiceId = selectedVoice; // Store for main voiceover to use
        }
        console.log(`🎤 Using consistent voice for short video intro and main: ${selectedVoice}`);
        
        // Use the same voice settings as the main voiceover for consistency
        await generateVoiceover(
          introOutroConfig.intro.voiceoverText,
          introVoiceoverPath,
          undefined, // Use default voice settings
          options.voiceGender, // Pass voice gender for consistency
          selectedVoice // Pass the specific voice ID to ensure consistency
        );
        console.log(`✅ Short video intro voiceover generated: ${introVoiceoverPath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to generate short video intro voiceover: ${error.message}`);
        introVoiceoverPath = null;
      }
    }
  }

  // Calculate duration per image for the short video
  const durationPerImage = audioDuration / imagePaths.length;
  console.log(`⏱️ Duration per image: ${durationPerImage.toFixed(2)}s`);

  // Use simple concatenation for short videos too for maximum compatibility
  console.log('📱 Using simple concatenation for short video compatibility');
  const transitionDuration = 0.5; // Define for compatibility, but not used
  const transitionConfig = { filterComplex: '', transitions: [] };

  return new Promise((resolve, reject) => {
    // For short videos, use a simpler approach that's more reliable
    // If we have multiple images, create a slideshow; if just one, use it directly
    
    let ffmpegArgs;
    
    if (introOutroConfig && introOutroConfig.intro.enabled) {
      // Use intro with complex filter for short video (outro removed per user request)
      ffmpegArgs = [];
      let inputIndex = 0;
      
      // Add intro image
      ffmpegArgs.push('-loop', '1', '-t', introOutroConfig.intro.duration.toString(), '-i', introOutroConfig.intro.imagePath);
      inputIndex++;
      
      // Add main images
      for (let i = 0; i < absoluteImagePaths.length; i++) {
        ffmpegArgs.push('-loop', '1', '-t', durationPerImage.toString(), '-i', absoluteImagePaths[i]);
        inputIndex++;
      }
      
      // Add intro voiceover if available
      let introVoiceoverIndex = null;
      if (introVoiceoverPath) {
        ffmpegArgs.push('-i', introVoiceoverPath);
        introVoiceoverIndex = inputIndex;
        inputIndex++;
      }
      
      // Add main audio
      ffmpegArgs.push('-i', absoluteAudioPath);
      const mainVoiceoverIndex = inputIndex;
      inputIndex++;
      
      // Add background music
      if (backgroundMusicPath) {
        ffmpegArgs.push('-i', backgroundMusicPath);
        inputIndex++;
      }
      
      // Create complex filter for intro + short video
      const mainContentConfig = {
        imageCount: absoluteImagePaths.length,
        duration: audioDuration,
        backgroundVolume: 0.15,
        transitionConfig: { filterComplex: '' }
      };
      
      const filterComplex = createIntroOutroFilter({
        introConfig: introOutroConfig.intro,
        mainContentConfig: mainContentConfig,
        backgroundMusicPath: backgroundMusicPath,
        totalDuration: totalVideoDuration,
        resolution: resolution,
        introVoiceoverIndex: introVoiceoverIndex,
        mainVoiceoverIndex: mainVoiceoverIndex
      });
      
      ffmpegArgs.push(
        '-filter_complex', filterComplex,
        '-map', '[final_v]',
        '-map', '[audio_out]',
        '-pix_fmt', 'yuv420p',
        '-color_range', 'tv',
        '-colorspace', 'bt709',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-profile:v', 'baseline',
        '-level:v', '3.0',
        '-crf', crfValue.toString(),
        '-r', '25',
        '-g', '50',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'mp4',
        '-movflags', '+faststart',
        '-avoid_negative_ts', 'make_zero',
        '-shortest',
        // Don't use -shortest with intro to allow full extended duration
        '-y',
        absoluteOutputPath
      );
      
      console.log(`🎼 Short video mixing audio with intro: Voice (100%) + Background (intro: ${(introOutroConfig.intro.volume * 100).toFixed(0)}%, main: 15%)`);
      
    } else if (absoluteImagePaths.length === 1) {
      // Single image - use crop approach to fill frame properly
      const [width, height] = resolution.split('x').map(Number);
      
      if (backgroundMusicPath) {
        // Single image with background music
        backgroundMusicConfig = createBackgroundMusicFilter(backgroundMusicPath, audioDuration);
        console.log(`🎼 Short video mixing audio: Voice (100%) + Background (${(backgroundMusicConfig.settings.backgroundVolume * 100).toFixed(0)}%)`);
        
        ffmpegArgs = [
          '-loop', '1',
          '-t', audioDuration.toString(),
          '-i', absoluteImagePaths[0],
          '-i', absoluteAudioPath,
          '-i', backgroundMusicPath,
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
          '-filter_complex', backgroundMusicConfig.audioFilter.replace('volume=0.5', 'volume=0.3,alimiter=level_in=1:level_out=0.8:limit=0.8').replace('amix=inputs=2:duration=first:dropout_transition=2', 'amix=inputs=2:duration=first:dropout_transition=3:normalize=0'),
          '-map', '0:v',
          '-map', '[audio_out]',
          '-pix_fmt', 'yuv420p',
          '-color_range', 'tv',
          '-colorspace', 'bt709',
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-profile:v', 'baseline',
          '-level:v', '3.0',
          '-crf', crfValue.toString(),
          '-r', '25',
          '-g', '50',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-ar', '44100',
          '-ac', '2',
          '-f', 'mp4',
          '-movflags', '+faststart',
          '-avoid_negative_ts', 'make_zero',
          '-shortest',
          '-shortest',
          '-y',
          absoluteOutputPath
        ];
      } else {
        // Single image without background music
        ffmpegArgs = [
          '-loop', '1',
          '-t', audioDuration.toString(),  // FIXED: Add duration parameter
          '-i', absoluteImagePaths[0],
          '-i', absoluteAudioPath,
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
          '-pix_fmt', 'yuv420p',
          '-color_range', 'tv',
          '-colorspace', 'bt709',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-profile:v', 'main',
          '-level:v', '3.1',
          '-crf', crfValue.toString(),
          '-r', fps.toString(),
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100',
          '-ac', '2',
          '-f', 'mp4',
          '-movflags', '+faststart',
          '-avoid_negative_ts', 'make_zero',  // FIXED: Add timing fix
          '-fflags', '+genpts',               // FIXED: Add presentation timestamps
          '-strict', 'experimental',
          '-shortest',
          '-y',
          absoluteOutputPath
        ];
      }
    } else {
      // Multiple images - use filter complex with crop approach
      ffmpegArgs = [];
      
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
      
      // Add background music input if available
      if (backgroundMusicPath) {
        ffmpegArgs.push('-i', backgroundMusicPath);
        backgroundMusicConfig = createBackgroundMusicFilter(backgroundMusicPath, audioDuration);
        console.log(`🎼 Short video slideshow mixing audio: Voice (100%) + Background (${(backgroundMusicConfig.settings.backgroundVolume * 100).toFixed(0)}%)`);
      }
      
      // Create filter complex with transitions for short video
      let filterComplex = '';
      const [width, height] = resolution.split('x').map(Number);
      
      // Scale and crop each image to fill frame properly
      for (let i = 0; i < absoluteImagePaths.length; i++) {
        filterComplex += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1:1,fps=${fps},setpts=PTS-STARTPTS[v${i}];`;
      }
      
      // Add simple concatenation for short video
      if (absoluteImagePaths.length > 1) {
        // Simple concatenation without transitions
        filterComplex += absoluteImagePaths.map((_, i) => `[v${i}]`).join('') + `concat=n=${absoluteImagePaths.length}:v=1:a=0[outv];`;
      } else {
        // Single image - no transitions needed
        filterComplex += '[v0]copy[outv];';
      }
      
      if (backgroundMusicPath) {
        // Add background music filter to the complex filter
        const audioInputIndex = absoluteImagePaths.length; // Voiceover audio index
        const musicInputIndex = absoluteImagePaths.length + 1; // Background music index
        
        // FIXED: Use safer audio mixing for short videos to prevent beep noise
        // Apply additional volume reduction and safer mixing parameters
        const safeVoiceVolume = Math.min(backgroundMusicConfig.settings.voiceoverVolume * 0.3, 0.7); // Further reduced
        const safeBackgroundVolume = Math.min(backgroundMusicConfig.settings.backgroundVolume * 0.5, 0.1); // Much lower background
        
        filterComplex += `[${audioInputIndex}:a]volume=${safeVoiceVolume},alimiter=level_in=1:level_out=0.8:limit=0.8[voice];`;
        filterComplex += `[${musicInputIndex}:a]aloop=loop=-1:size=2e+09,afade=t=in:st=0:d=${backgroundMusicConfig.settings.fadeInDuration},afade=t=out:st=${Math.max(0, audioDuration - backgroundMusicConfig.settings.fadeOutDuration)}:d=${backgroundMusicConfig.settings.fadeOutDuration},volume=${safeBackgroundVolume},alimiter=level_in=1:level_out=0.5:limit=0.5[bg];`;
        filterComplex += `[voice][bg]amix=inputs=2:duration=first:dropout_transition=3:normalize=0[audio_out];`;
        
        ffmpegArgs.push(
          '-filter_complex', filterComplex,
          '-map', '[outv]',
          '-map', '[audio_out]',
          '-pix_fmt', 'yuv420p',
          '-color_range', 'tv',
          '-colorspace', 'bt709',
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-profile:v', 'baseline',
          '-level:v', '3.0',
          '-crf', crfValue.toString(),
          '-r', '25',
          '-g', '50',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-ar', '44100',
          '-ac', '2',
          '-f', 'mp4',
          '-movflags', '+faststart',
          '-avoid_negative_ts', 'make_zero',
          '-shortest',
          '-shortest',
          '-y',
          absoluteOutputPath
        );
      } else {
        // Original audio mapping without background music
        ffmpegArgs.push(
          '-filter_complex', filterComplex,
          '-map', '[outv]',
          '-map', `${absoluteImagePaths.length}:a:0`,
          '-pix_fmt', 'yuv420p',
          '-color_range', 'tv',
          '-colorspace', 'bt709',
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-profile:v', 'baseline',
          '-level:v', '3.0',
          '-crf', crfValue.toString(),
          '-r', '25',
          '-g', '50',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-ar', '44100',
          '-ac', '2',
          '-f', 'mp4',
          '-movflags', '+faststart',
          '-avoid_negative_ts', 'make_zero',
          '-shortest',
          '-shortest',
          '-y',
          absoluteOutputPath
        );
      }
    }

    console.log('🎥 FFmpeg short video command: ffmpeg', ffmpegArgs.join(' '));

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
        console.log(`📱 Short video progress: ${Math.round(progress)}%`);
      }
    });

    // Handle process completion
    ffmpegProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.stat(absoluteOutputPath);
          console.log(`✅ Short video created: ${absoluteOutputPath} (${Math.round(stats.size / 1024)}KB)`);
          resolve(absoluteOutputPath);
        } catch (error) {
          reject(new Error(`Output file verification failed: ${error.message}`));
        }
      } else {
        console.error('❌ FFmpeg short video stderr:', stderr);
        reject(new Error(`FFmpeg short video failed with exit code ${code}: ${stderr}`));
      }
    });

    // Handle process errors
    ffmpegProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFmpeg short video: ${error.message}`));
    });

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      ffmpegProcess.kill('SIGTERM');
      reject(new Error('FFmpeg short video process timed out after 60 seconds'));
    }, 60000);

    ffmpegProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Creates a video with affiliate overlay text burned into the video
 * @param {string[]} imagePaths - Array of image file paths
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Path for output video
 * @param {Object} productData - Product information for affiliate overlay
 * @param {Object} options - Video creation options
 * @returns {Promise<string>} Path to created video with affiliate overlay
 */
export async function createVideoWithAffiliateOverlay(imagePaths, audioPath, outputPath, productData, options = {}) {
  if (!imagePaths || imagePaths.length === 0) {
    throw new Error('At least one image is required');
  }

  if (!productData || !productData.affiliateUrl) {
    throw new Error('Product data with affiliate URL is required');
  }

  const {
    resolution = '1920x1080',
    fps = 30,
    quality = 'high',
    overlayOptions = {}
  } = options;

  console.log('🎬 Creating video with affiliate overlay...');
  console.log(`📦 Product: ${productData.title}`);
  console.log(`💰 Price: ${productData.price}`);
  console.log(`🔗 Affiliate URL: ${productData.affiliateUrl}`);

  // Generate affiliate overlay configuration
  const overlayConfig = generateAffiliateOverlay(productData, overlayOptions);
  console.log('📝 Overlay text:', overlayConfig.overlayText.replace(/\\n/g, ' | '));

  // Convert quality string to numeric CRF value
  let crfValue = 23;
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

  // Validate input files
  await validateVideoInputs(imagePaths, audioPath);

  // Ensure output directory exists
  const outputDir = path.dirname(absoluteOutputPath);
  await fs.mkdir(outputDir, { recursive: true });

  // Get audio duration
  let audioDuration;
  try {
    audioDuration = await getAudioDuration(absoluteAudioPath);
    console.log(`🎵 Audio duration: ${audioDuration.toFixed(2)}s`);
  } catch (error) {
    console.warn('⚠️ Could not get audio duration, using 30s default');
    audioDuration = 30;
  }

  return new Promise((resolve, reject) => {
    let ffmpegArgs;
    const [width, height] = resolution.split('x').map(Number);

    if (absoluteImagePaths.length === 1) {
      // Single image with overlay
      ffmpegArgs = [
        '-loop', '1',
        '-i', absoluteImagePaths[0],
        '-i', absoluteAudioPath,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,${overlayConfig.overlayFilter}`,
        '-pix_fmt', 'yuv420p',
        '-color_range', 'tv',
        '-colorspace', 'bt709',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-profile:v', 'baseline',
        '-level:v', '3.0',
        '-crf', crfValue.toString(),
        '-r', '25',
        '-g', '50',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'mp4',
        '-movflags', '+faststart',
        '-avoid_negative_ts', 'make_zero',
        '-shortest',
        '-shortest',
        '-y',
        absoluteOutputPath
      ];
    } else {
      // Multiple images slideshow with overlay
      ffmpegArgs = [];
      
      // Calculate duration per image
      const durationPerImage = audioDuration / imagePaths.length;
      console.log(`⏱️ Duration per image: ${durationPerImage.toFixed(2)}s`);

      // Add each image as input
      for (let i = 0; i < absoluteImagePaths.length; i++) {
        ffmpegArgs.push(
          '-loop', '1',
          '-t', durationPerImage.toString(),
          '-i', absoluteImagePaths[i]
        );
      }
      
      // Add audio input
      ffmpegArgs.push('-i', absoluteAudioPath);
      
      // Create filter complex with overlay
      let filterComplex = '';
      
      // Scale and pad each image
      for (let i = 0; i < absoluteImagePaths.length; i++) {
        filterComplex += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1:1,fps=${fps}[v${i}];`;
      }
      
      // Concatenate all scaled images
      filterComplex += absoluteImagePaths.map((_, i) => `[v${i}]`).join('') + `concat=n=${absoluteImagePaths.length}:v=1:a=0[concat_v];`;
      
      // Add overlay to concatenated video
      filterComplex += `[concat_v]${overlayConfig.overlayFilter}[outv]`;
      
      ffmpegArgs.push(
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-map', `${absoluteImagePaths.length}:a:0`,
        '-pix_fmt', 'yuv420p',
        '-color_range', 'tv',
        '-colorspace', 'bt709',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-profile:v', 'baseline',
        '-level:v', '3.0',
        '-crf', crfValue.toString(),
        '-r', '25',
        '-g', '50',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ar', '44100',
        '-ac', '2',
        '-f', 'mp4',
        '-movflags', '+faststart',
        '-avoid_negative_ts', 'make_zero',
        '-shortest',
        '-shortest',
        '-y',
        absoluteOutputPath
      );
    }

    console.log('🎥 FFmpeg command with overlay: ffmpeg', ffmpegArgs.join(' '));

    // Spawn FFmpeg process
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';

    // Capture stderr for error reporting and progress
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      const progressMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})/);
      if (progressMatch) {
        const [, hours, minutes, seconds] = progressMatch;
        const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
        const progress = Math.min((currentTime / audioDuration) * 100, 100);
        console.log(`🎬 Video with overlay progress: ${Math.round(progress)}%`);
      }
    });

    // Handle process completion
    ffmpegProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.stat(absoluteOutputPath);
          console.log(`✅ Video with affiliate overlay created: ${absoluteOutputPath} (${Math.round(stats.size / 1024)}KB)`);
          console.log(`🎯 Overlay shown: ${overlayConfig.timing.startTime}s - ${overlayConfig.timing.startTime + overlayConfig.timing.duration}s`);
          resolve(absoluteOutputPath);
        } catch (error) {
          reject(new Error(`Output file verification failed: ${error.message}`));
        }
      } else {
        console.error('❌ FFmpeg overlay stderr:', stderr);
        reject(new Error(`FFmpeg overlay failed with exit code ${code}: ${stderr}`));
      }
    });

    // Handle process errors
    ffmpegProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFmpeg overlay: ${error.message}`));
    });

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      ffmpegProcess.kill('SIGTERM');
      reject(new Error('FFmpeg overlay process timed out after 120 seconds'));
    }, 120000);

    ffmpegProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}