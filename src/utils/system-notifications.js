/**
 * System notification utilities for CLI feedback
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

/**
 * Plays a WAV audio file using system audio player
 * @param {string} audioPath - Path to the audio file
 * @returns {Promise<void>} - Resolves when audio finishes playing
 */
export async function playAudioFile(audioPath) {
  try {
    // Check if file exists
    await fs.access(audioPath);
    
    // Determine the appropriate audio player based on platform
    let command, args;
    
    switch (process.platform) {
      case 'darwin': // macOS
        command = 'afplay';
        args = [audioPath];
        break;
      case 'linux':
        // Try different audio players in order of preference
        const linuxPlayers = ['aplay', 'paplay', 'ffplay', 'mpv', 'vlc'];
        command = linuxPlayers[0]; // Default to aplay
        args = [audioPath];
        break;
      case 'win32': // Windows
        command = 'powershell';
        args = ['-c', `(New-Object Media.SoundPlayer '${audioPath}').PlaySync()`];
        break;
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
    
    return new Promise((resolve, reject) => {
      const audioProcess = spawn(command, args, {
        stdio: ['ignore', 'ignore', 'pipe']
      });
      
      audioProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Audio player exited with code ${code}`));
        }
      });
      
      audioProcess.on('error', (error) => {
        reject(error);
      });
      
      // Set a timeout to prevent hanging
      setTimeout(() => {
        audioProcess.kill();
        resolve(); // Resolve anyway to not block the process
      }, 5000); // 5 second timeout
    });
    
  } catch (error) {
    // Fall back to system beep if audio file playback fails
    console.debug('Audio file playback failed, using system beep:', error.message);
    systemBeep();
  }
}

/**
 * Plays a system beep sound to notify the user
 * Uses the ASCII bell character (BEL) which triggers the system beep
 * @param {number} count - Number of beeps (default: 1)
 * @param {number} delay - Delay between beeps in milliseconds (default: 200)
 */
export function systemBeep(count = 1, delay = 200) {
  try {
    for (let i = 0; i < count; i++) {
      // ASCII bell character (0x07) triggers system beep
      process.stdout.write('\x07');
      
      // Add delay between multiple beeps
      if (i < count - 1 && delay > 0) {
        // Use setTimeout for non-blocking delay
        setTimeout(() => {}, delay);
      }
    }
  } catch (error) {
    // Silently fail if beep is not supported
    console.debug('System beep not supported:', error.message);
  }
}

/**
 * Plays a notification beep for video completion
 * Uses the beep.wav file if available, falls back to system beep
 */
export async function videoCompletionBeep() {
  const beepPath = path.resolve('./src/media/beep.wav');
  
  try {
    await playAudioFile(beepPath);
    console.log('🔔 Video creation completed!');
  } catch (error) {
    // Fall back to system beep
    console.debug('WAV file playback failed, using system beep:', error.message);
    systemBeep(2, 150);
  }
}

/**
 * Plays a notification beep for YouTube upload ready
 * Uses a distinctive pattern: 3 short beeps
 */
export function youtubeReadyBeep() {
  systemBeep(3, 100);
}