# Amazon Affiliate Video Automation - TODO

## Project Overview
Create a Node.js application that automates the creation of Amazon affiliate marketing videos by:
- Scraping Amazon product data and images
- Generating AI voiceovers using Eleven Labs
- Creating slideshow videos with FFmpeg
- Publishing directly to YouTube

## Development Tasks

### 1. Project Setup
- [x] Create TODO.md file
- [x] Initialize package.json with ESM configuration
- [x] Install dependencies (puppeteer, fluent-ffmpeg, googleapis, node-fetch, dotenv)
- [x] Create directory structure (src/, test/, temp/)
- [x] Setup ESLint and Prettier configuration
- [x] Create .env.example file

### 2. Core Modules (TDD Approach)

#### 2.1 Amazon Scraper Module
- [x] Write tests for scrapeAmazonProduct function
- [x] Implement Amazon product scraping (title, images, description)
- [x] Add error handling for invalid URLs and missing elements
- [x] Test edge cases (products with no images, restricted access)

#### 2.2 Image Downloader Module
- [x] Write tests for downloadImages function
- [x] Implement image downloading with proper error handling
- [x] Add image validation and format conversion
- [x] Test download failures and network issues

#### 2.3 AI Voiceover Module
- [x] Write tests for generateVoiceover function
- [x] Implement Eleven Labs API integration
- [x] Add text preprocessing and optimization
- [x] Test API failures and rate limiting

#### 2.4 Video Creator Module
- [x] Write tests for createSlideshow function
- [x] Implement FFmpeg video generation
- [x] Add customizable video settings (duration, transitions)
- [x] Test various image formats and audio lengths

#### 2.5 YouTube Publisher Module
- [x] Write tests for uploadToYouTube function
- [x] Implement YouTube API integration with OAuth2
- [x] Add video metadata and affiliate link injection
- [x] Test upload failures and quota limits

### 3. Main Application
- [x] Write integration tests for main workflow
- [x] Implement main orchestration function
- [x] Add comprehensive error handling and logging
- [x] Create CLI interface for easy usage

### 4. Configuration and Documentation
- [x] Create comprehensive README.md
- [x] Add JSDoc comments to all functions
- [x] Create example usage scripts
- [x] Add troubleshooting guide

### 5. Quality Assurance
- [ ] Run ESLint and fix all issues
- [ ] Format code with Prettier
- [ ] Achieve >90% test coverage
- [ ] Test with real Amazon products
- [ ] Performance optimization

## Dependencies Required
- `puppeteer` - Web scraping Amazon product pages
- `fluent-ffmpeg` - Video creation and manipulation
- `googleapis` - YouTube API integration
- `node-fetch` - HTTP requests for APIs and image downloads
- `dotenv` - Environment variable management
- `mocha` - Testing framework
- `chai` - Assertion library
- `eslint` - Code linting
- `prettier` - Code formatting

## Environment Variables Needed
- `ELEVENLABS_API_KEY` - Eleven Labs API key for voiceover generation
- `YOUTUBE_OAUTH2_ACCESS_TOKEN` - YouTube API access token
- `AFFILIATE_TAG` - Amazon affiliate tracking ID