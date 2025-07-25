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
    
    // Filter out beep files and other non-music files
    const musicFiles = mediaFiles.filter(file => {
      const filename = path.basename(file).toLowerCase();
      return !filename.includes('beep') &&
             !filename.includes('test') &&
             !filename.includes('short') &&
             !filename.startsWith('temp');
    });
    
    if (musicFiles.length === 0) {
      console.log('📵 No background music files found in ./src/media/*.wav (excluding beep/test files)');
      return null;
    }
    
    const selectedFile = musicFiles[Math.floor(Math.random() * musicFiles.length)];
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
    // Voiceover processing: use full volume for clear narration
    `[0:a]volume=${safeVoiceVolume}[voice];`,
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
 * Creates intro segment for professional video branding and QR code outro
 * @param {string} backgroundMusicPath - Path to background music file
 * @param {Object} options - Intro/outro options
 * @returns {Object} Intro/outro configuration
 */
const createIntroOutroSegments = async (backgroundMusicPath, options = {}) => {
  const {
    introDuration = 5.0,        // 5 second intro
    introVolume = 0.4,          // FIXED: 40% volume for intro music (was 100% - too loud!)
    introImagePath = './src/media/banner.jpg',
    introVoiceoverText = 'Welcome to The Professional Prompt where we review your favorite products',
    // QR code outro options
    enableQROutro = false,      // Enable QR code outro
    outroDuration = 10.0,       // 10 second outro for QR code
    amazonUrl = null,           // Amazon affiliate URL for QR code
    qrCodePath = null           // Path to generated QR code image
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

  // Check if QR code outro should be enabled
  let outroEnabled = false;
  let qrCodeImagePath = null;
  
  console.log(`🔍 QR code outro check: enableQROutro=${enableQROutro}, amazonUrl=${amazonUrl ? 'provided' : 'missing'}`);
  
  if (enableQROutro && amazonUrl) {
    try {
      console.log(`🔗 Attempting to generate QR code for: ${amazonUrl}`);
      
      // Import QR code generator
      const { generateQRCode } = await import('./utils/qr-code-generator.js');
      
      // Generate QR code if not provided
      if (!qrCodePath) {
        const tempDir = './temp';
        await fs.mkdir(tempDir, { recursive: true });
        qrCodeImagePath = path.resolve(`${tempDir}/qr-code-${Date.now()}.png`);
        console.log(`📁 Generating QR code to: ${qrCodeImagePath}`);
        await generateQRCode(amazonUrl, qrCodeImagePath);
        console.log(`✅ QR code generated successfully`);
      } else {
        qrCodeImagePath = path.resolve(qrCodePath);
        console.log(`📁 Using provided QR code path: ${qrCodeImagePath}`);
      }
      
      outroEnabled = await checkFileExists(qrCodeImagePath);
      if (outroEnabled) {
        console.log(`✅ QR code outro enabled with image: ${qrCodeImagePath}`);
      } else {
        console.log(`❌ QR code file does not exist: ${qrCodeImagePath}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to generate QR code outro: ${error.message}`);
      console.error(`🔍 QR code error details:`, error);
      outroEnabled = false;
    }
  } else {
    console.log(`❌ QR code outro not enabled: enableQROutro=${enableQROutro}, amazonUrl=${amazonUrl ? 'provided' : 'missing'}`);
  }

  const totalExtraDuration = (introExists ? introDuration : 0) + (outroEnabled ? outroDuration : 0);

  console.log(`🎭 Intro/Outro configuration: intro=${introExists}, outro=${outroEnabled}, totalExtra=${totalExtraDuration}s`);

  const config = {
    intro: {
      enabled: introExists,
      imagePath: introImagePath,
      duration: introDuration,
      volume: safeIntroVolume,  // Use normalized safe volume
      voiceoverText: introVoiceoverText
    },
    outro: {
      enabled: outroEnabled,
      imagePath: qrCodeImagePath,
      duration: outroDuration,
      volume: 0.3,  // Moderate volume for outro
      voiceoverText: 'Scan the QR code or on mobile take a screenshot and scan it to go to the product page'
    },
    totalExtraDuration: totalExtraDuration
  };

  console.log(`🎬 Final intro/outro config:`, JSON.stringify(config, null, 2));
  
  return config;
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
 * Creates a small QR code overlay filter for the lower left corner
 * @param {string} qrCodeImagePath - Path to the QR code image
 * @param {Object} options - Overlay options
 * @returns {string} FFmpeg overlay filter string
 */
const createSmallQROverlay = (qrCodeImagePath, options = {}) => {
  const {
    size = 80,           // Small size for corner overlay
    x = 20,              // 20px from left edge
    y = 'H-h-20',        // 20px from bottom edge
    opacity = 0.8        // Slightly transparent
  } = options;
  
  // Create overlay filter for small QR code in lower left corner
  return `overlay=${x}:${y}:enable='between(t,0,${options.endTime || 'inf'})':alpha=${opacity}`;
};

/**
 * Creates complex FFmpeg filter for intro, main content, and QR code outro with optional small QR overlay
 * @param {Object} config - Configuration object
 * @returns {string} FFmpeg filter complex string
 */
export const createIntroOutroFilter = (config) => {
  const {
    introConfig,
    outroConfig,
    mainContentConfig,
    backgroundMusicPath,
    totalDuration,
    resolution,
    introVoiceoverIndex = null,  // New parameter for intro voiceover audio
    mainVoiceoverIndex = null,   // New parameter for main voiceover audio
    outroVoiceoverIndex = null,  // New parameter for outro voiceover audio
    smallQRConfig = null         // New parameter for small QR code overlay
  } = config;

  const [width, height] = resolution.split('x').map(Number);
  let filterComplex = '';
  let inputIndex = 0;
  let segmentFilters = [];
  let smallQRInputIndex = null;

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

  // Outro segment with QR code
  if (outroConfig && outroConfig.enabled) {
    // Calculate the correct outro input index
    // Input order: intro image (0) + main images (1 to N) + intro voiceover + main voiceover + outro voiceover + outro image
    let outroInputIndex = mainContentStart + mainContentConfig.imageCount; // After main images
    
    // Skip voiceover inputs to get to the outro image
    if (introVoiceoverIndex !== null) outroInputIndex++; // Skip intro voiceover
    if (mainVoiceoverIndex !== null) outroInputIndex++; // Skip main voiceover
    if (outroVoiceoverIndex !== null) outroInputIndex++; // Skip outro voiceover
    
    console.log(`🎬 Outro image input index: ${outroInputIndex}`);
    
    // Create QR code outro without text overlay to prevent overlap
    filterComplex += `[${outroInputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,`;
    filterComplex += `setsar=1:1,setpts=PTS-STARTPTS[outro_v];`;
    segmentFilters.push('[outro_v]');
  }

  // Handle small QR code overlay if provided
  if (smallQRConfig && smallQRConfig.enabled && smallQRConfig.imagePath) {
    // Calculate the QR input index - it should be after all other inputs
    // Input order: intro image (0) + main images (1 to N) + intro voiceover + main voiceover + outro voiceover + outro image + small QR + background music
    let qrInputIndex = mainContentStart + mainContentConfig.imageCount; // After main images
    
    // Skip voiceover inputs to get to the small QR image
    if (introVoiceoverIndex !== null) qrInputIndex++; // Skip intro voiceover
    if (mainVoiceoverIndex !== null) qrInputIndex++; // Skip main voiceover
    if (outroVoiceoverIndex !== null) qrInputIndex++; // Skip outro voiceover
    if (outroConfig && outroConfig.enabled) qrInputIndex++; // Skip outro image
    
    smallQRInputIndex = qrInputIndex;
    console.log(`📱 Small QR code overlay input index: ${smallQRInputIndex}`);
    
    // Scale the small QR code to appropriate size
    filterComplex += `[${smallQRInputIndex}:v]scale=${smallQRConfig.size || 80}:${smallQRConfig.size || 80}[small_qr];`;
  }

  // Concatenate video segments (intro + main content + outro)
  let videoStreamName = '[final_v]';
  if (segmentFilters.length > 1) {
    filterComplex += `${segmentFilters.join('')}concat=n=${segmentFilters.length}:v=1:a=0[concat_v];`;
    videoStreamName = '[concat_v]';
  } else if (segmentFilters.length === 1) {
    // Single segment - use it directly
    videoStreamName = segmentFilters[0];
  } else {
    // Fallback - should not happen, but handle gracefully
    throw new Error('No video segments available for concatenation');
  }

  // Apply small QR code overlay if enabled (but not during outro)
  if (smallQRConfig && smallQRConfig.enabled && smallQRConfig.imagePath) {
    const introEnd = introConfig.enabled ? introConfig.duration : 0;
    const mainEnd = introEnd + mainContentConfig.duration;
    
    // Only show QR overlay during intro and main content, not outro
    const overlayEndTime = outroConfig && outroConfig.enabled ? mainEnd : totalDuration;
    
    console.log(`📱 Small QR overlay timing: 0s - ${overlayEndTime}s (excluding outro)`);
    
    const overlayFilter = createSmallQROverlay(smallQRConfig.imagePath, {
      size: smallQRConfig.size || 80,
      x: smallQRConfig.x || 20,
      y: smallQRConfig.y || 'H-h-20',
      opacity: smallQRConfig.opacity || 0.8,
      endTime: overlayEndTime
    });
    
    filterComplex += `${videoStreamName}[small_qr]${overlayFilter}[final_v];`;
  } else {
    // No QR overlay - just copy the video stream
    if (videoStreamName !== '[final_v]') {
      filterComplex += `${videoStreamName}copy[final_v];`;
    }
  }

  // Audio processing: intro voiceover + main voiceover + outro voiceover + background music
  // mainVoiceoverIndex is now passed as a parameter
  // Calculate music index: it should be the last input (after outro image and small QR if present)
  let musicIndex = mainVoiceoverIndex + 1; // Start after main voiceover
  if (outroVoiceoverIndex !== null) musicIndex = outroVoiceoverIndex + 1; // After outro voiceover if present
  if (outroConfig && outroConfig.enabled) musicIndex++; // After outro image if present
  if (smallQRConfig && smallQRConfig.enabled) musicIndex++; // After small QR image if present
  
  // Calculate timing variables that are used in both branches
  const introEnd = introConfig.enabled ? introConfig.duration : 0;
  const mainEnd = introEnd + mainContentConfig.duration;
  const outroStart = mainEnd;
  const outroEnd = outroConfig && outroConfig.enabled ? outroStart + outroConfig.duration : mainEnd;
  
  if (backgroundMusicPath) {
    // Create volume-varying background music with dynamic intro volume control

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
    
    // Lower volume during outro with normalization
    if (outroConfig && outroConfig.enabled) {
      const safeOutroVolume = normalizeVolume(0.2, 'background'); // 20% during outro
      musicFilter += `,volume=enable='between(t,${outroStart},${outroEnd})':volume=${safeOutroVolume}`;
      console.log(`🎵 Outro background volume: ${(safeOutroVolume*100).toFixed(0)}%`);
    }
    
    // Add fade in/out with validated durations
    const safeFadeIn = validateFadeDuration(2.0);
    const safeFadeOut = validateFadeDuration(2.0);
    musicFilter += `,afade=t=in:st=0:d=${safeFadeIn},afade=t=out:st=${totalDuration - safeFadeOut}:d=${safeFadeOut}[bg];`;
    
    filterComplex += musicFilter;

    // Handle multiple voiceovers with proper timing
    let voiceFilters = [];
    
    // Use consistent normalized volume for all voiceovers - full volume for clear narration
    const safeVoiceVolume = normalizeVolume(1.0, 'voice'); // Full volume (100%) for clear narration
    
    if (introVoiceoverIndex !== null && introConfig.enabled) {
      // Intro voiceover: trim to intro duration and play from start
      filterComplex += `[${introVoiceoverIndex}:a]volume=${safeVoiceVolume},atrim=0:${introEnd}[intro_voice];`;
      voiceFilters.push('[intro_voice]');
    }
    
    if (mainVoiceoverIndex !== null) {
      // Main voiceover: delay by intro duration so it starts after intro ends
      const mainDelay = introEnd * 1000;
      filterComplex += `[${mainVoiceoverIndex}:a]volume=${safeVoiceVolume},adelay=${mainDelay}|${mainDelay}[delayed_main_voice];`;
      voiceFilters.push('[delayed_main_voice]');
    }
    
    if (outroVoiceoverIndex !== null && outroConfig && outroConfig.enabled) {
      // Outro voiceover: delay by intro + main duration so it starts after main ends
      const outroDelay = outroStart * 1000;
      filterComplex += `[${outroVoiceoverIndex}:a]volume=${safeVoiceVolume},adelay=${outroDelay}|${outroDelay}[delayed_outro_voice];`;
      voiceFilters.push('[delayed_outro_voice]');
    }
    
    // Combine all voiceovers
    if (voiceFilters.length > 1) {
      filterComplex += `${voiceFilters.join('')}amix=inputs=${voiceFilters.length}:duration=longest:dropout_transition=0[combined_voice];`;
      filterComplex += `[combined_voice][bg]amix=inputs=2:duration=first:dropout_transition=2[audio_out];`;
    } else if (voiceFilters.length === 1) {
      filterComplex += `${voiceFilters[0]}[combined_voice];`;
      filterComplex += `[combined_voice][bg]amix=inputs=2:duration=first:dropout_transition=2[audio_out];`;
    } else {
      // No voiceovers - just background music
      filterComplex += `[bg]copy[audio_out];`;
    }
  } else {
    // No background music - handle voiceovers only
    let voiceFilters = [];
    
    // Use consistent normalized volume for all voiceovers - full volume for clear narration
    const safeVoiceVolume = normalizeVolume(1.0, 'voice'); // Full volume (100%) for clear narration
    
    if (introVoiceoverIndex !== null && introConfig.enabled) {
      // Intro voiceover: trim to intro duration and play from start
      filterComplex += `[${introVoiceoverIndex}:a]volume=${safeVoiceVolume},atrim=0:${introEnd}[intro_voice];`;
      voiceFilters.push('[intro_voice]');
    }
    
    if (mainVoiceoverIndex !== null) {
      // Main voiceover: delay by intro duration so it starts after intro ends
      const mainDelay = introEnd * 1000;
      filterComplex += `[${mainVoiceoverIndex}:a]volume=${safeVoiceVolume},adelay=${mainDelay}|${mainDelay}[delayed_main_voice];`;
      voiceFilters.push('[delayed_main_voice]');
    }
    
    if (outroVoiceoverIndex !== null && outroConfig && outroConfig.enabled) {
      // Outro voiceover: delay by intro + main duration so it starts after main ends
      const outroDelay = outroStart * 1000;
      filterComplex += `[${outroVoiceoverIndex}:a]volume=${safeVoiceVolume},adelay=${outroDelay}|${outroDelay}[delayed_outro_voice];`;
      voiceFilters.push('[delayed_outro_voice]');
    }
    
    // Combine all voiceovers
    if (voiceFilters.length > 1) {
      filterComplex += `${voiceFilters.join('')}amix=inputs=${voiceFilters.length}:duration=longest:dropout_transition=0[audio_out];`;
    } else if (voiceFilters.length === 1) {
      filterComplex += `${voiceFilters[0]}copy[audio_out];`;
    } else {
      // No audio at all - create silent audio
      filterComplex += `anullsrc=channel_layout=stereo:sample_rate=44100[audio_out];`;
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

  // Create intro/outro configuration with QR code support
  let introOutroConfig = null;
  let totalVideoDuration = audioDuration;
  let introVoiceoverPath = null;
  let outroVoiceoverPath = null;
  let smallQRConfig = null;
  
  if (enableIntroOutro) {
    // Pass Amazon URL for QR code generation
    const qrOutroOptions = {
      ...introOutroOptions,
      enableQROutro: !!options.amazonUrl,
      amazonUrl: options.amazonUrl,
      outroDuration: introOutroOptions.outroDuration || 10.0
    };
    
    console.log(`🎯 QR code outro options: enableQROutro=${qrOutroOptions.enableQROutro}, amazonUrl=${qrOutroOptions.amazonUrl ? 'provided' : 'missing'}`);
    
    introOutroConfig = await createIntroOutroSegments(backgroundMusicPath, qrOutroOptions);
    totalVideoDuration += introOutroConfig.totalExtraDuration;
    console.log(`🎭 Intro/Outro segments: intro=${introOutroConfig.intro.enabled}, outro=${introOutroConfig.outro.enabled}`);
    console.log(`⏱️ Total video duration: ${totalVideoDuration.toFixed(2)}s (including intro/outro)`);
  }

  // Generate small QR code for corner overlay if Amazon URL is provided
  if (options.amazonUrl && options.enableSmallQROverlay !== false) {
    try {
      console.log('📱 Generating small QR code for corner overlay...');
      const { generateQRCode } = await import('./utils/qr-code-generator.js');
      
      const tempDir = './temp';
      await fs.mkdir(tempDir, { recursive: true });
      const smallQRPath = path.resolve(`${tempDir}/small-qr-code-${Date.now()}.png`);
      
      // Generate smaller QR code for overlay
      await generateQRCode(options.amazonUrl, smallQRPath, { size: 150 });
      
      smallQRConfig = {
        enabled: true,
        imagePath: smallQRPath,
        size: 80,
        x: 20,
        y: 'H-h-20',
        opacity: 0.8
      };
      
      console.log(`✅ Small QR code generated for overlay: ${smallQRPath}`);
    } catch (error) {
      console.warn(`⚠️ Failed to generate small QR code overlay: ${error.message}`);
      smallQRConfig = null;
    }
  }

  // Generate intro and outro voiceovers if intro/outro is enabled
  if (enableIntroOutro && introOutroConfig) {
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
    
    // Generate outro voiceover if outro is enabled
    if (introOutroConfig.outro.enabled && introOutroConfig.outro.voiceoverText) {
      console.log('🎤 Generating QR code outro voiceover...');
      const { generateVoiceover } = await import('./voiceover-generator.js');
      outroVoiceoverPath = path.resolve(`${path.dirname(outputPath)}/outro-voiceover.mp3`);
      
      try {
        // Use the same voice as intro/main for consistency
        const selectedVoice = options.selectedVoiceId;
        console.log(`🎤 Using consistent voice for outro: ${selectedVoice}`);
        
        await generateVoiceover(
          introOutroConfig.outro.voiceoverText,
          outroVoiceoverPath,
          undefined, // Use default voice settings
          options.voiceGender, // Pass voice gender for consistency
          selectedVoice // Pass the specific voice ID to ensure consistency
        );
        console.log(`✅ QR code outro voiceover generated: ${outroVoiceoverPath}`);
      } catch (error) {
        console.warn(`⚠️ Failed to generate outro voiceover: ${error.message}`);
        outroVoiceoverPath = null;
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
      
      // Add outro voiceover if available
      let outroVoiceoverIndex = null;
      if (outroVoiceoverPath) {
        ffmpegArgs.push('-i', outroVoiceoverPath);
        outroVoiceoverIndex = inputIndex;
        inputIndex++;
      }
      
      // Add outro image if outro is enabled
      if (introOutroConfig.outro.enabled) {
        ffmpegArgs.push('-loop', '1', '-t', introOutroConfig.outro.duration.toString(), '-i', introOutroConfig.outro.imagePath);
        inputIndex++;
      }
      
      // Add small QR code image if enabled
      if (smallQRConfig && smallQRConfig.enabled) {
        ffmpegArgs.push('-i', smallQRConfig.imagePath);
        inputIndex++;
      }
      
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
        outroConfig: introOutroConfig.outro,
        mainContentConfig: mainContentConfig,
        backgroundMusicPath: backgroundMusicPath,
        totalDuration: totalVideoDuration,
        resolution: resolution,
        introVoiceoverIndex: introVoiceoverIndex,
        mainVoiceoverIndex: mainVoiceoverIndex,
        outroVoiceoverIndex: outroVoiceoverIndex,
        smallQRConfig: smallQRConfig
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
  console.log('🎬 createSlideshow called with options:', JSON.stringify(options, null, 2));
  
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
  
  console.log(`🎬 Slideshow configuration: enableIntroOutro=${enableIntroOutro}, amazonUrl=${options.amazonUrl ? 'provided' : 'missing'}`);

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
  let outroVoiceoverPath = null;
  let smallQRConfig = null;
  
  if (enableIntroOutro) {
    // Pass Amazon URL for QR code generation in slideshow
    const qrOutroOptions = {
      ...introOutroOptions,
      enableQROutro: !!options.amazonUrl,
      amazonUrl: options.amazonUrl,
      outroDuration: introOutroOptions.outroDuration || 10.0
    };
    
    console.log(`🎯 Slideshow QR code outro options: enableQROutro=${qrOutroOptions.enableQROutro}, amazonUrl=${qrOutroOptions.amazonUrl ? 'provided' : 'missing'}`);
    
    introOutroConfig = await createIntroOutroSegments(backgroundMusicPath, qrOutroOptions);
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
      
      // Generate outro voiceover if outro is enabled
      if (introOutroConfig.outro.enabled && introOutroConfig.outro.voiceoverText) {
        console.log('🎤 Generating slideshow QR code outro voiceover...');
        const { generateVoiceover } = await import('./voiceover-generator.js');
        outroVoiceoverPath = path.resolve(`${path.dirname(outputPath)}/slideshow-outro-voiceover.mp3`);
        
        try {
          // Use the same voice as intro/main for consistency
          const selectedVoice = options.selectedVoiceId;
          console.log(`🎤 Using consistent voice for slideshow outro: ${selectedVoice}`);
          
          await generateVoiceover(
            introOutroConfig.outro.voiceoverText,
            outroVoiceoverPath,
            undefined, // Use default voice settings
            options.voiceGender, // Pass voice gender for consistency
            selectedVoice // Pass the specific voice ID to ensure consistency
          );
          console.log(`✅ Slideshow QR code outro voiceover generated: ${outroVoiceoverPath}`);
        } catch (error) {
          console.warn(`⚠️ Failed to generate slideshow outro voiceover: ${error.message}`);
          outroVoiceoverPath = null;
        }
      }
    }
  }

  // Generate small QR code for corner overlay if Amazon URL is provided
  if (options.amazonUrl && options.enableSmallQROverlay !== false) {
    try {
      console.log('📱 Generating small QR code for slideshow corner overlay...');
      const { generateQRCode } = await import('./utils/qr-code-generator.js');
      
      const tempDir = './temp';
      await fs.mkdir(tempDir, { recursive: true });
      const smallQRPath = path.resolve(`${tempDir}/slideshow-small-qr-code-${Date.now()}.png`);
      
      // Generate smaller QR code for overlay
      await generateQRCode(options.amazonUrl, smallQRPath, { size: 150 });
      
      smallQRConfig = {
        enabled: true,
        imagePath: smallQRPath,
        size: 80,
        x: 20,
        y: 'H-h-20',
        opacity: 0.8
      };
      
      console.log(`✅ Small QR code generated for slideshow overlay: ${smallQRPath}`);
    } catch (error) {
      console.warn(`⚠️ Failed to generate small QR code overlay for slideshow: ${error.message}`);
      smallQRConfig = null;
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
      
      // Add outro voiceover if available
      let outroVoiceoverIndex = null;
      if (outroVoiceoverPath) {
        ffmpegArgs.push('-i', outroVoiceoverPath);
        outroVoiceoverIndex = inputIndex;
        inputIndex++;
      }
      
      // Add outro image if outro is enabled
      if (introOutroConfig.outro.enabled) {
        ffmpegArgs.push('-loop', '1', '-t', introOutroConfig.outro.duration.toString(), '-i', introOutroConfig.outro.imagePath);
        inputIndex++;
      }
      
      // Add small QR code image if enabled
      if (smallQRConfig && smallQRConfig.enabled) {
        ffmpegArgs.push('-i', smallQRConfig.imagePath);
        inputIndex++;
      }
      
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
        outroConfig: introOutroConfig.outro, // FIXED: Add outro config
        mainContentConfig: mainContentConfig,
        backgroundMusicPath: backgroundMusicPath,
        totalDuration: totalVideoDuration,
        resolution: resolution,
        introVoiceoverIndex: introVoiceoverIndex,
        mainVoiceoverIndex: mainVoiceoverIndex,
        outroVoiceoverIndex: outroVoiceoverIndex, // FIXED: Add outro voiceover index
        smallQRConfig: smallQRConfig
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
        
        // Update the filter complex to include background music mixing with full voice volume
        filterComplex += `[${audioInputIndex}:a]volume=${backgroundMusicConfig.settings.voiceoverVolume}[voice];`;
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
  console.log('📱 createShortVideo called with options:', JSON.stringify(options, null, 2));
  
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
  
  console.log(`📱 Short video configuration: enableIntroOutro=${enableIntroOutro}, amazonUrl=${options.amazonUrl ? 'provided' : 'missing'}`);

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

  // DISABLE background music for short videos to prevent buzzing noise
  let backgroundMusicPath = null;
  let backgroundMusicConfig = null;
  console.log('🔇 Background music disabled for short videos to prevent audio buzzing');

  // Create intro configuration if enabled (outro removed per user request)
  let introOutroConfig = null;
  let totalVideoDuration = audioDuration;
  let introVoiceoverPath = null;
  let outroVoiceoverPath = null;
  let smallQRConfig = null;
  
  if (enableIntroOutro) {
    // Pass Amazon URL for QR code generation in short video
    const qrOutroOptions = {
      ...introOutroOptions,
      enableQROutro: !!options.amazonUrl,
      amazonUrl: options.amazonUrl,
      outroDuration: introOutroOptions.outroDuration || 10.0
    };
    
    console.log(`🎯 Short video QR code outro options: enableQROutro=${qrOutroOptions.enableQROutro}, amazonUrl=${qrOutroOptions.amazonUrl ? 'provided' : 'missing'}`);
    
    introOutroConfig = await createIntroOutroSegments(backgroundMusicPath, qrOutroOptions);
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
      
      // Generate outro voiceover if outro is enabled
      if (introOutroConfig.outro.enabled && introOutroConfig.outro.voiceoverText) {
        console.log('🎤 Generating short video QR code outro voiceover...');
        const { generateVoiceover } = await import('./voiceover-generator.js');
        outroVoiceoverPath = path.resolve(`${path.dirname(outputPath)}/short-outro-voiceover.mp3`);
        
        try {
          // Use the same voice as intro/main for consistency
          const selectedVoice = options.selectedVoiceId;
          console.log(`🎤 Using consistent voice for short video outro: ${selectedVoice}`);
          
          await generateVoiceover(
            introOutroConfig.outro.voiceoverText,
            outroVoiceoverPath,
            undefined, // Use default voice settings
            options.voiceGender, // Pass voice gender for consistency
            selectedVoice // Pass the specific voice ID to ensure consistency
          );
          console.log(`✅ Short video QR code outro voiceover generated: ${outroVoiceoverPath}`);
        } catch (error) {
          console.warn(`⚠️ Failed to generate short video outro voiceover: ${error.message}`);
          outroVoiceoverPath = null;
        }
      }
    }
  }

  // Generate small QR code for corner overlay if Amazon URL is provided
  if (options.amazonUrl && options.enableSmallQROverlay !== false) {
    try {
      console.log('📱 Generating small QR code for short video corner overlay...');
      const { generateQRCode } = await import('./utils/qr-code-generator.js');
      
      const tempDir = './temp';
      await fs.mkdir(tempDir, { recursive: true });
      const smallQRPath = path.resolve(`${tempDir}/short-small-qr-code-${Date.now()}.png`);
      
      // Generate smaller QR code for overlay
      await generateQRCode(options.amazonUrl, smallQRPath, { size: 150 });
      
      smallQRConfig = {
        enabled: true,
        imagePath: smallQRPath,
        size: 80,
        x: 20,
        y: 'H-h-20',
        opacity: 0.8
      };
      
      console.log(`✅ Small QR code generated for short video overlay: ${smallQRPath}`);
    } catch (error) {
      console.warn(`⚠️ Failed to generate small QR code overlay for short video: ${error.message}`);
      smallQRConfig = null;
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
      
      // Add outro voiceover if available
      let outroVoiceoverIndex = null;
      if (outroVoiceoverPath) {
        ffmpegArgs.push('-i', outroVoiceoverPath);
        outroVoiceoverIndex = inputIndex;
        inputIndex++;
      }
      
      // Add outro image if outro is enabled
      if (introOutroConfig.outro.enabled) {
        ffmpegArgs.push('-loop', '1', '-t', introOutroConfig.outro.duration.toString(), '-i', introOutroConfig.outro.imagePath);
        inputIndex++;
      }
      
      // Add small QR code image if enabled
      if (smallQRConfig && smallQRConfig.enabled) {
        ffmpegArgs.push('-i', smallQRConfig.imagePath);
        inputIndex++;
      }
      
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
        outroConfig: introOutroConfig.outro, // FIXED: Add outro config
        mainContentConfig: mainContentConfig,
        backgroundMusicPath: backgroundMusicPath,
        totalDuration: totalVideoDuration,
        resolution: resolution,
        introVoiceoverIndex: introVoiceoverIndex,
        mainVoiceoverIndex: mainVoiceoverIndex,
        outroVoiceoverIndex: outroVoiceoverIndex, // FIXED: Add outro voiceover index
        smallQRConfig: smallQRConfig
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
        
        // Use proper audio mixing for short videos with clear narration
        // Keep voice volume high for clarity while reducing background music
        const safeVoiceVolume = Math.min(backgroundMusicConfig.settings.voiceoverVolume, 1.0); // Full voice volume
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