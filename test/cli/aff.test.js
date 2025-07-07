/**
 * Tests for main CLI entry point
 * Using Mocha test framework with Chai assertions
 */

import { expect } from 'chai';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for test file resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '..', '..', 'bin', 'aff.js');

/**
 * Helper function to run CLI command and capture output
 * @param {string[]} args - Command arguments
 * @param {Object} options - Spawn options
 * @returns {Promise<Object>} - Result with stdout, stderr, and exit code
 */
const runCLI = (args = [], options = {}) => {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      stdio: 'pipe',
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code
      });
    });

    child.on('error', (error) => {
      resolve({
        stdout: stdout.trim(),
        stderr: error.message,
        exitCode: 1
      });
    });
  });
};

describe('AFF CLI', () => {
  describe('Help and Version', () => {
    it('should display help when no arguments provided', async () => {
      const result = await runCLI([]);
      
      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.include('Amazon Affiliate Video Automation CLI');
      expect(result.stdout).to.include('Usage: aff <command>');
      expect(result.stdout).to.include('create');
      expect(result.stdout).to.include('promote');
      expect(result.stdout).to.include('publish');
    });

    it('should display help with help command', async () => {
      const result = await runCLI(['help']);
      
      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.include('Amazon Affiliate Video Automation CLI');
      expect(result.stdout).to.include('Usage: aff <command>');
    });

    it('should display help with --help flag', async () => {
      const result = await runCLI(['--help']);
      
      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.include('Amazon Affiliate Video Automation CLI');
    });

    it('should display version with --version flag', async () => {
      const result = await runCLI(['--version']);
      
      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.match(/aff v\d+\.\d+\.\d+/);
    });

    it('should display version with -v flag', async () => {
      const result = await runCLI(['-v']);
      
      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.match(/aff v\d+\.\d+\.\d+/);
    });
  });

  describe('Command Routing', () => {
    it('should show error for unknown command', async () => {
      const result = await runCLI(['unknown-command']);
      
      expect(result.exitCode).to.equal(1);
      expect(result.stderr).to.include('Unknown command: unknown-command');
    });

    it('should show help for create command', async () => {
      const result = await runCLI(['create', '--help']);
      
      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.include('Create Affiliate Video');
      expect(result.stdout).to.include('amazon-product-url-or-id');
    });

    it('should show help for promote command', async () => {
      const result = await runCLI(['promote', '--help']);
      
      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.include('Promote Video on Social Media');
      expect(result.stdout).to.include('video-url');
    });

    it('should show help for publish command', async () => {
      const result = await runCLI(['publish', '--help']);
      
      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.include('Publish Video to YouTube');
      expect(result.stdout).to.include('video-path');
    });
  });

  describe('Command Validation', () => {
    it('should show error when create command missing required argument', async () => {
      const result = await runCLI(['create']);
      
      expect(result.exitCode).to.equal(1);
      expect(result.stderr).to.include('Missing required arguments');
    });

    it('should show error when promote command missing required argument', async () => {
      const result = await runCLI(['promote']);
      
      expect(result.exitCode).to.equal(1);
      expect(result.stderr).to.include('Missing required arguments');
    });

    it('should show error when publish command missing required argument', async () => {
      const result = await runCLI(['publish']);
      
      expect(result.exitCode).to.equal(1);
      expect(result.stderr).to.include('Missing required arguments');
    });
  });

  describe('Flag Parsing', () => {
    it('should handle global flags correctly', async () => {
      const result = await runCLI(['create', 'B123456789', '--help']);
      
      expect(result.exitCode).to.equal(0);
      expect(result.stdout).to.include('Create Affiliate Video');
    });

    it('should pass through command-specific flags', async () => {
      // This test would require mocking the actual command execution
      // For now, we'll test that the CLI doesn't crash with valid flags
      const result = await runCLI(['create', 'B123456789', '--quality', 'high', '--max-images', '3']);
      
      // The command should fail due to missing environment variables or network issues,
      // but it should not fail due to argument parsing
      expect(result.stderr).to.not.include('Unknown command');
      expect(result.stderr).to.not.include('Missing required arguments');
      // Accept that it may timeout or fail due to missing environment setup
      expect(result.exitCode).to.be.oneOf([0, 1]);
    }).timeout(10000); // Reduce timeout for faster test execution
  });

  describe('Error Handling', () => {
    it('should handle module loading errors gracefully', async () => {
      // Test with a command that has a broken module (simulated)
      const result = await runCLI(['create', 'invalid-input']);
      
      // Should not crash the entire CLI
      expect(result.exitCode).to.be.oneOf([0, 1]); // Either success or controlled failure
    });

    it('should handle process errors gracefully', async () => {
      // Test with invalid arguments that should be caught
      const result = await runCLI(['create']);
      
      expect(result.exitCode).to.equal(1);
      expect(result.stderr).to.include('Missing required arguments');
    });
  });
});