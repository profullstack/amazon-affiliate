#!/usr/bin/env node

/**
 * Amazon Affiliate Video Automation CLI
 * Global command-line interface for creating, promoting, and publishing affiliate videos
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for module resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Available commands and their descriptions
 */
const COMMANDS = {
  create: {
    description: 'Create affiliate video from Amazon product URL or ID',
    module: '../src/commands/create.js'
  },
  promote: {
    description: 'Promote video on social media platforms',
    module: '../src/commands/promote.js'
  },
  publish: {
    description: 'Upload video to YouTube',
    module: '../src/commands/publish.js'
  }
};

/**
 * Display main help information
 */
const displayHelp = () => {
  console.log(`
🎬 Amazon Affiliate Video Automation CLI

Usage: aff <command> [options]

Commands:
  create <amazon-url-or-id>  Create affiliate video from Amazon product
  promote <video-url>        Promote video on social media platforms  
  publish <video-path>       Upload video to YouTube
  help                       Show this help message

Options:
  --help, -h                 Show help for specific command
  --version, -v              Show version information

Examples:
  # Create video from Amazon product ID
  aff create B0CPZKLJX1 --quality high --auto-upload

  # Create video from full Amazon URL
  aff create "https://www.amazon.com/dp/B08N5WRWNW" --max-images 3

  # Promote existing YouTube video
  aff promote "https://youtube.com/watch?v=abc123" --platforms reddit,twitter

  # Upload video to YouTube
  aff publish ./output/my-video.mp4 --title "Product Review"

Get help for specific commands:
  aff create --help
  aff promote --help
  aff publish --help

For more information, visit: https://github.com/your-repo/amazon-affiliate
`);
};

/**
 * Display version information
 */
const displayVersion = async () => {
  try {
    const packagePath = join(__dirname, '..', 'package.json');
    const { readFile } = await import('fs/promises');
    const packageData = JSON.parse(await readFile(packagePath, 'utf-8'));
    console.log(`aff v${packageData.version}`);
  } catch (error) {
    console.log('aff v1.0.0');
  }
};

/**
 * Parse command line arguments
 */
const parseArgs = (args) => {
  // Check for global flags first
  const isVersion = args.includes('--version') || args.includes('-v');
  const isHelp = args.includes('--help') || args.includes('-h');
  
  // Filter out global flags to find the actual command
  const filteredArgs = args.filter(arg =>
    !['--help', '-h', '--version', '-v'].includes(arg)
  );
  
  const command = filteredArgs[0];
  const remainingArgs = filteredArgs.slice(1);
  
  return {
    command,
    args: remainingArgs,
    isHelp,
    isVersion
  };
};

/**
 * Load and execute command module
 */
const executeCommand = async (commandName, args) => {
  const commandConfig = COMMANDS[commandName];
  
  if (!commandConfig) {
    console.error(`❌ Unknown command: ${commandName}`);
    console.log('Run "aff help" to see available commands.');
    process.exit(1);
  }

  try {
    const modulePath = join(__dirname, commandConfig.module);
    const commandModule = await import(modulePath);
    
    // Execute the command's main function
    if (typeof commandModule.default === 'function') {
      await commandModule.default(args);
    } else if (typeof commandModule.run === 'function') {
      await commandModule.run(args);
    } else {
      throw new Error(`Command module ${commandName} does not export a default function or run function`);
    }
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      console.error(`❌ Command module not found: ${commandName}`);
      console.error('This command may not be implemented yet.');
    } else {
      console.error(`❌ Error executing command ${commandName}:`, error.message);
    }
    process.exit(1);
  }
};

/**
 * Main CLI function
 */
const main = async () => {
  const args = process.argv.slice(2);
  
  // Handle no arguments
  if (args.length === 0) {
    displayHelp();
    process.exit(0);
  }

  const { command, args: commandArgs, isHelp, isVersion } = parseArgs(args);

  // Handle global flags
  if (isVersion) {
    await displayVersion();
    process.exit(0);
  }

  if (command === 'help' || (isHelp && !command)) {
    displayHelp();
    process.exit(0);
  }

  // Handle command-specific help
  if (isHelp && command && COMMANDS[command]) {
    try {
      const modulePath = join(__dirname, COMMANDS[command].module);
      const commandModule = await import(modulePath);
      
      if (typeof commandModule.displayHelp === 'function') {
        commandModule.displayHelp();
      } else {
        console.log(`Help for command: ${command}`);
        console.log(COMMANDS[command].description);
      }
    } catch (error) {
      console.log(`Help for command: ${command}`);
      console.log(COMMANDS[command].description);
    }
    process.exit(0);
  }

  // Execute command
  await executeCommand(command, commandArgs);
};

// Global error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run CLI
main().catch((error) => {
  console.error('💥 CLI Error:', error.message);
  process.exit(1);
});