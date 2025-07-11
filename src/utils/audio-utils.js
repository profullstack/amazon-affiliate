import { spawn } from 'child_process';

/**
 * Audio utility functions for volume normalization and audio processing
 * Prevents loud noise issues and audio clipping in video creation
 */

/**
 * Safe audio volume limits to prevent clipping and loud noise
 */
export const AUDIO_LIMITS = {
  MAX_VOICE_VOLUME: 1.0,        // 100% for voice (primary content)
  MAX_INTRO_VOLUME: 0.4,        // 40% for intro music (reduced from 100%)
  MAX_BACKGROUND_VOLUME: 0.2,   // 20% for background music (increased from 15%)
  MIN_VOLUME: 0.05,             // 5% minimum to avoid silence
  MAX_VOLUME_JUMP: 0.2,         // 20% maximum volume change
  SAFE_MIXING_THRESHOLD: 1.2,   // Total volume should not exceed 120%
  MIN_FADE_DURATION: 1.0,       // 1 second minimum fade
  MAX_FADE_DURATION: 3.0,       // 3 seconds maximum fade
  RECOMMENDED_FADE: 2.0         // 2 seconds recommended fade
};

/**
 * Validates and normalizes volume levels to prevent audio issues
 * @param {number} volume - Input volume level
 * @param {string} type - Audio type ('voice', 'intro', 'background')
 * @returns {number} Normalized safe volume level
 */
export const normalizeVolume = (volume, type = 'background') => {
  if (typeof volume !== 'number' || isNaN(volume)) {
    console.warn(`⚠️ Invalid volume value: ${volume}, using default`);
    return getDefaultVolume(type);
  }

  let maxVolume;
  switch (type) {
    case 'voice':
      maxVolume = AUDIO_LIMITS.MAX_VOICE_VOLUME;
      break;
    case 'intro':
      maxVolume = AUDIO_LIMITS.MAX_INTRO_VOLUME;
      break;
    case 'background':
      maxVolume = AUDIO_LIMITS.MAX_BACKGROUND_VOLUME;
      break;
    default:
      maxVolume = AUDIO_LIMITS.MAX_BACKGROUND_VOLUME;
  }

  // Ensure volume is within safe limits
  const normalizedVolume = Math.max(
    AUDIO_LIMITS.MIN_VOLUME,
    Math.min(volume, maxVolume)
  );

  if (normalizedVolume !== volume) {
    console.log(`🔧 Volume normalized: ${volume} → ${normalizedVolume} (${type})`);
  }

  return normalizedVolume;
};

/**
 * Gets default safe volume for audio type
 * @param {string} type - Audio type
 * @returns {number} Default volume level
 */
export const getDefaultVolume = (type) => {
  switch (type) {
    case 'voice':
      return AUDIO_LIMITS.MAX_VOICE_VOLUME;
    case 'intro':
      return AUDIO_LIMITS.MAX_INTRO_VOLUME;
    case 'background':
      return AUDIO_LIMITS.MAX_BACKGROUND_VOLUME;
    default:
      return AUDIO_LIMITS.MAX_BACKGROUND_VOLUME;
  }
};

/**
 * Validates fade duration to ensure smooth transitions
 * @param {number} duration - Fade duration in seconds
 * @returns {number} Validated fade duration
 */
export const validateFadeDuration = (duration) => {
  if (typeof duration !== 'number' || isNaN(duration)) {
    console.warn(`⚠️ Invalid fade duration: ${duration}, using recommended`);
    return AUDIO_LIMITS.RECOMMENDED_FADE;
  }

  const validatedDuration = Math.max(
    AUDIO_LIMITS.MIN_FADE_DURATION,
    Math.min(duration, AUDIO_LIMITS.MAX_FADE_DURATION)
  );

  if (validatedDuration !== duration) {
    console.log(`🔧 Fade duration adjusted: ${duration}s → ${validatedDuration}s`);
  }

  return validatedDuration;
};

/**
 * Checks if volume combination will cause clipping
 * @param {Object} volumes - Volume levels for different audio tracks
 * @returns {Object} Clipping analysis result
 */
export const checkAudioClipping = (volumes) => {
  const { voice = 0, intro = 0, background = 0 } = volumes;
  
  const totalVolume = voice + intro + background;
  const willClip = totalVolume > AUDIO_LIMITS.SAFE_MIXING_THRESHOLD;
  
  const analysis = {
    totalVolume,
    willClip,
    safeThreshold: AUDIO_LIMITS.SAFE_MIXING_THRESHOLD,
    recommendation: null
  };

  if (willClip) {
    analysis.recommendation = {
      voice: Math.min(voice, AUDIO_LIMITS.MAX_VOICE_VOLUME),
      intro: Math.min(intro, AUDIO_LIMITS.MAX_INTRO_VOLUME),
      background: Math.min(background, AUDIO_LIMITS.MAX_BACKGROUND_VOLUME)
    };
    
    console.warn(`⚠️ Audio clipping detected! Total: ${totalVolume.toFixed(2)} > ${AUDIO_LIMITS.SAFE_MIXING_THRESHOLD}`);
    console.log('💡 Recommended volumes:', analysis.recommendation);
  }

  return analysis;
};

/**
 * Creates smooth volume transition steps to prevent jarring changes
 * @param {number} startVolume - Starting volume level
 * @param {number} endVolume - Target volume level
 * @param {number} duration - Transition duration in seconds
 * @param {number} steps - Number of transition steps
 * @returns {Array} Array of volume transition points
 */
export const createSmoothVolumeTransition = (startVolume, endVolume, duration, steps = 10) => {
  const volumeChange = endVolume - startVolume;
  const maxChangeRate = AUDIO_LIMITS.MAX_VOLUME_JUMP / (duration / steps);
  
  // If change rate is too high, extend the duration
  if (Math.abs(volumeChange / duration) > maxChangeRate) {
    const recommendedDuration = Math.abs(volumeChange) / maxChangeRate;
    console.warn(`⚠️ Volume change too rapid, recommend ${recommendedDuration.toFixed(1)}s duration`);
  }

  const transitions = [];
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const volume = startVolume + (volumeChange * progress);
    const time = (duration * progress);
    
    transitions.push({
      time: parseFloat(time.toFixed(2)),
      volume: parseFloat(volume.toFixed(3))
    });
  }

  return transitions;
};

/**
 * Generates safe FFmpeg audio filter with volume normalization
 * @param {Object} config - Audio configuration
 * @returns {Object} Safe audio filter configuration
 */
export const createSafeAudioFilter = (config) => {
  const {
    backgroundMusicPath,
    videoDuration,
    voiceVolume = 1.0,
    backgroundVolume = 0.15,
    introVolume = 0.4,
    fadeInDuration = 2.0,
    fadeOutDuration = 2.0
  } = config;

  // Normalize all volumes
  const safeVoiceVolume = normalizeVolume(voiceVolume, 'voice');
  const safeBackgroundVolume = normalizeVolume(backgroundVolume, 'background');
  const safeIntroVolume = normalizeVolume(introVolume, 'intro');
  
  // Validate fade durations
  const safeFadeIn = validateFadeDuration(fadeInDuration);
  const safeFadeOut = validateFadeDuration(fadeOutDuration);

  // Check for clipping
  const clippingAnalysis = checkAudioClipping({
    voice: safeVoiceVolume,
    background: safeBackgroundVolume,
    intro: safeIntroVolume
  });

  const fadeOutStart = Math.max(0, videoDuration - safeFadeOut);

  // Create audio filter with safe volumes
  const audioFilter = [
    // Background music processing with safe volume
    `[1:a]aloop=loop=-1:size=2e+09,afade=t=in:st=0:d=${safeFadeIn},afade=t=out:st=${fadeOutStart}:d=${safeFadeOut},volume=${safeBackgroundVolume}[bg];`,
    // Voiceover processing with safe volume
    `[0:a]volume=${safeVoiceVolume}[voice];`,
    // Mix both audio streams with dropout transition for smooth mixing
    `[voice][bg]amix=inputs=2:duration=first:dropout_transition=2[audio_out]`
  ].join('');

  return {
    audioFilter,
    backgroundMusicPath,
    settings: {
      voiceVolume: safeVoiceVolume,
      backgroundVolume: safeBackgroundVolume,
      introVolume: safeIntroVolume,
      fadeInDuration: safeFadeIn,
      fadeOutDuration: safeFadeOut
    },
    clippingAnalysis,
    isClippingSafe: !clippingAnalysis.willClip
  };
};

/**
 * Analyzes audio file for potential issues
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Object>} Audio analysis result
 */
export const analyzeAudioFile = async (audioPath) => {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-select_streams', 'a:0',
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
          const audioStream = metadata.streams?.[0];
          const format = metadata.format;

          if (!audioStream) {
            reject(new Error('No audio stream found in file'));
            return;
          }

          const analysis = {
            duration: parseFloat(format.duration) || 0,
            bitrate: parseInt(format.bit_rate) || 0,
            size: parseInt(format.size) || 0,
            codec: audioStream.codec_name,
            sampleRate: parseInt(audioStream.sample_rate) || 0,
            channels: parseInt(audioStream.channels) || 0,
            bitDepth: parseInt(audioStream.bits_per_sample) || 0,
            issues: [],
            quality: 'unknown'
          };

          // Check for potential issues
          if (analysis.duration < 10) {
            analysis.issues.push('File too short (< 10 seconds)');
          }

          if (analysis.sampleRate < 44100) {
            analysis.issues.push('Low sample rate (< 44.1kHz)');
          }

          if (analysis.channels > 2) {
            analysis.issues.push('Too many channels (> 2)');
          }

          if (analysis.bitrate < 128000) {
            analysis.issues.push('Low bitrate (< 128kbps)');
          }

          // Determine quality
          if (analysis.issues.length === 0) {
            analysis.quality = 'good';
          } else if (analysis.issues.length <= 2) {
            analysis.quality = 'acceptable';
          } else {
            analysis.quality = 'poor';
          }

          resolve(analysis);
        } catch (error) {
          reject(new Error(`Failed to parse audio analysis: ${error.message}`));
        }
      } else {
        reject(new Error(`Audio analysis failed: ${stderr}`));
      }
    });

    ffprobeProcess.on('error', (error) => {
      reject(new Error(`Failed to start audio analysis: ${error.message}`));
    });
  });
};

/**
 * Logs audio configuration for debugging
 * @param {Object} config - Audio configuration
 * @param {string} context - Context description
 */
export const logAudioConfig = (config, context = 'Audio Config') => {
  console.log(`🎵 ${context}:`);
  console.log(`   Voice Volume: ${(config.voiceVolume * 100).toFixed(0)}%`);
  console.log(`   Background Volume: ${(config.backgroundVolume * 100).toFixed(0)}%`);
  
  if (config.introVolume !== undefined) {
    console.log(`   Intro Volume: ${(config.introVolume * 100).toFixed(0)}%`);
  }
  
  console.log(`   Fade In: ${config.fadeInDuration}s`);
  console.log(`   Fade Out: ${config.fadeOutDuration}s`);
  
  if (config.clippingAnalysis) {
    const status = config.clippingAnalysis.willClip ? '❌ RISK' : '✅ SAFE';
    console.log(`   Clipping Risk: ${status} (Total: ${config.clippingAnalysis.totalVolume.toFixed(2)})`);
  }
};