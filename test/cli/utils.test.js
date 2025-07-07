/**
 * Tests for CLI utilities
 * Using Mocha test framework with Chai assertions
 */

import { expect } from 'chai';
import {
  parseCommandArgs,
  validateRequiredArgs,
  formatFileSize,
  formatDuration
} from '../../src/commands/utils.js';

describe('CLI Utils', () => {
  describe('parseCommandArgs', () => {
    it('should parse boolean flags correctly', () => {
      const flagDefs = {
        'auto-upload': { type: 'boolean', default: false },
        'cleanup': { type: 'boolean', default: true }
      };
      
      const { options, args } = parseCommandArgs(['--auto-upload', 'remaining'], flagDefs);
      
      expect(options['auto-upload']).to.be.true;
      expect(options.cleanup).to.be.true; // default value
      expect(args).to.deep.equal(['remaining']);
    });

    it('should parse string flags correctly', () => {
      const flagDefs = {
        'quality': { type: 'string', default: 'medium' },
        'output-dir': { type: 'string' }
      };
      
      const { options, args } = parseCommandArgs(['--quality', 'high', '--output-dir', './custom', 'remaining'], flagDefs);
      
      expect(options.quality).to.equal('high');
      expect(options['output-dir']).to.equal('./custom');
      expect(args).to.deep.equal(['remaining']);
    });

    it('should parse number flags correctly', () => {
      const flagDefs = {
        'max-images': { type: 'number', default: 5 }
      };
      
      const { options } = parseCommandArgs(['--max-images', '10'], flagDefs);
      
      expect(options['max-images']).to.equal(10);
    });

    it('should parse array flags correctly', () => {
      const flagDefs = {
        'platforms': { type: 'array', default: ['reddit'] }
      };
      
      const { options } = parseCommandArgs(['--platforms', 'reddit,twitter,pinterest'], flagDefs);
      
      expect(options.platforms).to.deep.equal(['reddit', 'twitter', 'pinterest']);
    });

    it('should apply default values for missing flags', () => {
      const flagDefs = {
        'quality': { type: 'string', default: 'medium' },
        'max-images': { type: 'number', default: 5 }
      };
      
      const { options } = parseCommandArgs(['remaining'], flagDefs);
      
      expect(options.quality).to.equal('medium');
      expect(options['max-images']).to.equal(5);
    });

    it('should handle unknown flags by adding them to remaining args', () => {
      const flagDefs = {
        'known': { type: 'string' }
      };
      
      const { options, args } = parseCommandArgs(['--unknown', '--known', 'value', 'remaining'], flagDefs);
      
      expect(options.known).to.equal('value');
      expect(args).to.deep.equal(['--unknown', 'remaining']);
    });
  });

  describe('validateRequiredArgs', () => {
    it('should not throw when sufficient arguments provided', () => {
      expect(() => {
        validateRequiredArgs(['arg1', 'arg2'], 2, 'test usage');
      }).to.not.throw();
    });

    it('should throw when insufficient arguments provided', () => {
      // Mock process.exit to prevent actual exit during tests
      const originalExit = process.exit;
      let exitCode = null;
      process.exit = (code) => { exitCode = code; throw new Error('Process exit called'); };

      try {
        expect(() => {
          validateRequiredArgs(['arg1'], 2, 'test usage');
        }).to.throw('Process exit called');
        expect(exitCode).to.equal(1);
      } finally {
        process.exit = originalExit;
      }
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).to.equal('0 B');
      expect(formatFileSize(512)).to.equal('512 B');
      expect(formatFileSize(1023)).to.equal('1023 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).to.equal('1 KB');
      expect(formatFileSize(1536)).to.equal('1.5 KB');
      expect(formatFileSize(1024 * 1023)).to.equal('1023 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).to.equal('1 MB');
      expect(formatFileSize(1024 * 1024 * 1.5)).to.equal('1.5 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).to.equal('1 GB');
      expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).to.equal('2.5 GB');
    });

    it('should format terabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1024)).to.equal('1 TB');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(1000)).to.equal('1s');
      expect(formatDuration(30000)).to.equal('30s');
      expect(formatDuration(59000)).to.equal('59s');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(60000)).to.equal('1m 0s');
      expect(formatDuration(90000)).to.equal('1m 30s');
      expect(formatDuration(3540000)).to.equal('59m 0s');
    });

    it('should format hours correctly', () => {
      expect(formatDuration(3600000)).to.equal('1h 0m 0s');
      expect(formatDuration(3690000)).to.equal('1h 1m 30s');
      expect(formatDuration(7200000)).to.equal('2h 0m 0s');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).to.equal('0s');
    });

    it('should handle fractional seconds', () => {
      expect(formatDuration(1500)).to.equal('1s');
      expect(formatDuration(500)).to.equal('0s');
    });
  });
});