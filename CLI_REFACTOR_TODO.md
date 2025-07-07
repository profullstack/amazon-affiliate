# CLI Refactor TODO

## Overview
Refactor the project to have a global CLI command called "aff" with subcommands for different operations.

## Tasks

### 1. Create Main CLI Entry Point
- [x] Create `bin/aff.js` as the main CLI entry point
- [x] Add shebang for global execution
- [x] Implement command routing and help system
- [x] Add global error handling

### 2. Create Command Modules
- [x] Create `src/commands/create.js` for video creation
- [x] Create `src/commands/promote.js` for social media promotion
- [x] Create `src/commands/publish.js` for YouTube publishing
- [x] Extract shared utilities to `src/commands/utils.js`

### 3. Refactor Existing Functionality
- [x] Extract video creation logic from `src/index.js`
- [x] Extract promotion logic from `src/promotion-cli.js`
- [x] Extract YouTube publishing logic from `src/youtube-publisher.js`
- [x] Maintain backward compatibility

### 4. Update Package Configuration
- [x] Add `bin` field to `package.json`
- [x] Update scripts to use new CLI
- [x] Add installation instructions

### 5. Create Tests
- [x] Test CLI argument parsing
- [x] Test command routing
- [x] Test error handling
- [x] Test each command module

### 6. Documentation
- [x] Update README with new CLI usage
- [x] Create command-specific help documentation
- [x] Add examples for each command

## Command Structure

```
aff create <amazon-url-or-id> [options]
aff promote <video-url> [options]
aff publish <video-path> [options]
aff --help
aff <command> --help
```

## Implementation Priority
1. Main CLI entry point and routing
2. Create command (most complex)
3. Promote command (existing logic)
4. Publish command (extract from create)
5. Tests and documentation