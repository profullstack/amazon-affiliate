/**
 * Shared utilities for CLI commands
 */

import readline from 'readline';

/**
 * Creates a readline interface for user input
 * @returns {Object} - Readline interface
 */
export const createReadlineInterface = () => {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
};

/**
 * Prompts user for confirmation with yes/no input
 * @param {string} message - The question to ask the user
 * @param {boolean} autoConfirm - If true, automatically confirms without prompting
 * @returns {Promise<boolean>} - True if user confirms, false otherwise
 */
export const promptUserConfirmation = async (message, autoConfirm = false) => {
  if (autoConfirm) {
    console.log(`${message} (auto-confirmed)`);
    return true;
  }

  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes';
      resolve(confirmed);
    });
  });
};

/**
 * Prompts user for input with optional default value
 * @param {string} message - The question to ask the user
 * @param {string} defaultValue - Default value if user provides empty input
 * @returns {Promise<string>} - User input or default value
 */
export const promptUserInput = async (message, defaultValue = '') => {
  const rl = createReadlineInterface();
  
  const displayMessage = defaultValue 
    ? `${message} (default: ${defaultValue}): `
    : `${message}: `;

  return new Promise((resolve) => {
    rl.question(displayMessage, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
};

/**
 * Parses command line arguments into options object
 * @param {string[]} args - Command line arguments
 * @param {Object} flagDefinitions - Flag definitions with types and defaults
 * @returns {Object} - Parsed options and remaining arguments
 */
export const parseCommandArgs = (args, flagDefinitions = {}) => {
  const options = {};
  const remainingArgs = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const flagName = arg.slice(2);
      const flagDef = flagDefinitions[flagName];
      
      if (!flagDef) {
        // Unknown flag, add to remaining args
        remainingArgs.push(arg);
        continue;
      }
      
      if (flagDef.type === 'boolean') {
        options[flagName] = true;
      } else {
        // Expect a value for this flag
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          if (flagDef.type === 'number') {
            options[flagName] = parseInt(nextArg, 10);
          } else if (flagDef.type === 'array') {
            options[flagName] = nextArg.split(',').map(item => item.trim());
          } else {
            options[flagName] = nextArg;
          }
          i++; // Skip the next argument as it's the value
        } else {
          console.warn(`⚠️ Flag --${flagName} expects a value`);
        }
      }
    } else {
      remainingArgs.push(arg);
    }
  }
  
  // Apply defaults for missing options
  Object.entries(flagDefinitions).forEach(([flagName, flagDef]) => {
    if (options[flagName] === undefined && flagDef.default !== undefined) {
      options[flagName] = flagDef.default;
    }
  });
  
  return { options, args: remainingArgs };
};

/**
 * Validates required arguments
 * @param {string[]} args - Arguments to validate
 * @param {number} minRequired - Minimum number of required arguments
 * @param {string} usage - Usage message to display on error
 * @throws {Error} When validation fails
 */
export const validateRequiredArgs = (args, minRequired, usage) => {
  if (args.length < minRequired) {
    console.error(`❌ Error: Missing required arguments`);
    console.error(`Usage: ${usage}`);
    process.exit(1);
  }
};

/**
 * Reports progress to console with progress bar
 * @param {string} step - Current step name
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Progress message
 */
export const reportProgress = (step, progress, message = '') => {
  const bar = '█'.repeat(Math.floor(progress / 5)) + 
              '░'.repeat(20 - Math.floor(progress / 5));
  console.log(`[${bar}] ${progress}% - ${step}: ${message}`);
};

/**
 * Creates a progress callback function
 * @returns {Function} - Progress callback function
 */
export const createProgressCallback = () => {
  return (progressData) => {
    reportProgress(
      progressData.step,
      progressData.progress,
      progressData.message
    );
  };
};

/**
 * Validates file existence and accessibility
 * @param {string} filePath - Path to file
 * @param {string} fileType - Type of file for error messages
 * @throws {Error} When file is invalid
 */
export const validateFile = async (filePath, fileType = 'file') => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error(`${fileType} path is required`);
  }

  try {
    const { access } = await import('fs/promises');
    const { constants } = await import('fs');
    await access(filePath, constants.F_OK | constants.R_OK);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`${fileType} not found: ${filePath}`);
    } else if (error.code === 'EACCES') {
      throw new Error(`${fileType} is not readable: ${filePath}`);
    }
    throw new Error(`${fileType} validation failed: ${error.message}`);
  }
};

/**
 * Ensures directory exists, creating it if necessary
 * @param {string} dirPath - Directory path
 */
export const ensureDirectory = async (dirPath) => {
  try {
    const { mkdir } = await import('fs/promises');
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
  }
};

/**
 * Formats file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Formats duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
export const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Displays error message and exits process
 * @param {string} message - Error message
 * @param {number} exitCode - Exit code (default: 1)
 */
export const exitWithError = (message, exitCode = 1) => {
  console.error(`❌ ${message}`);
  process.exit(exitCode);
};

/**
 * Displays success message
 * @param {string} message - Success message
 */
export const displaySuccess = (message) => {
  console.log(`✅ ${message}`);
};

/**
 * Displays warning message
 * @param {string} message - Warning message
 */
export const displayWarning = (message) => {
  console.warn(`⚠️ ${message}`);
};

/**
 * Displays info message
 * @param {string} message - Info message
 */
export const displayInfo = (message) => {
  console.log(`ℹ️ ${message}`);
};

/**
 * Lists video files in a directory
 * @param {string} outputDir - Directory to search for videos
 * @returns {Promise<Array>} - Array of video file objects
 */
export const listVideoFiles = async (outputDir = './output') => {
  try {
    const { readdir, stat } = await import('fs/promises');
    const { join, extname, basename } = await import('path');
    
    // Check if output directory exists
    try {
      await stat(outputDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const files = await readdir(outputDir);
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv'];
    const videoFiles = [];

    for (const file of files) {
      const filePath = join(outputDir, file);
      const fileExt = extname(file).toLowerCase();
      
      if (videoExtensions.includes(fileExt)) {
        try {
          const stats = await stat(filePath);
          videoFiles.push({
            name: file,
            path: filePath,
            basename: basename(file, fileExt),
            size: stats.size,
            modified: stats.mtime,
            extension: fileExt
          });
        } catch (error) {
          // Skip files that can't be accessed
          continue;
        }
      }
    }

    // Sort by modification time (newest first)
    videoFiles.sort((a, b) => b.modified - a.modified);
    
    return videoFiles;
  } catch (error) {
    throw new Error(`Failed to list video files: ${error.message}`);
  }
};

/**
 * Displays a list of video files with selection prompt
 * @param {Array} videoFiles - Array of video file objects
 * @param {string} actionType - Type of action (e.g., 'publish', 'promote')
 * @returns {Promise<Object|null>} - Selected video file or null if cancelled
 */
export const displayVideoSelection = async (videoFiles, actionType = 'select') => {
  if (videoFiles.length === 0) {
    console.log('📁 No video files found in the output directory.');
    console.log('💡 Create some videos first using: aff create <amazon-url>');
    return null;
  }

  console.log(`\n📹 Found ${videoFiles.length} video file${videoFiles.length === 1 ? '' : 's'} in ./output:`);
  console.log('');

  videoFiles.forEach((video, index) => {
    const sizeStr = formatFileSize(video.size);
    const dateStr = video.modified.toLocaleDateString();
    const timeStr = video.modified.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    console.log(`${index + 1}. ${video.name}`);
    console.log(`   📊 Size: ${sizeStr} | 📅 Modified: ${dateStr} ${timeStr}`);
    console.log('');
  });

  const rl = createReadlineInterface();
  
  return new Promise((resolve) => {
    const promptMessage = `Select a video to ${actionType} (1-${videoFiles.length}) or press Enter to cancel: `;
    
    rl.question(promptMessage, (answer) => {
      rl.close();
      
      const selection = answer.trim();
      if (!selection) {
        console.log('❌ Operation cancelled');
        resolve(null);
        return;
      }
      
      const index = parseInt(selection, 10) - 1;
      if (isNaN(index) || index < 0 || index >= videoFiles.length) {
        console.log('❌ Invalid selection');
        resolve(null);
        return;
      }
      
      resolve(videoFiles[index]);
    });
  });
};