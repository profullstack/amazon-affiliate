# Amazon Affiliate Video Automation

🎬 Automated Amazon affiliate video creation with AI voiceover and YouTube publishing

## Overview

This tool automates the entire process of creating affiliate marketing videos from Amazon product URLs or IDs. It uses the **Rainforest API** to fetch reliable product information, downloads high-quality images, generates AI-powered review scripts and voiceovers, creates professional slideshow videos, and can automatically upload to YouTube and promote on social media platforms.

> **🌧️ Now powered by Rainforest API** - More reliable, faster, and higher quality data than web scraping!

## Features

- 🤖 **AI-Powered Content**: Generate review scripts, video titles, and descriptions using OpenAI
- 🎤 **Professional Voiceovers**: Create natural-sounding voiceovers with ElevenLabs
- 📹 **Automated Video Creation**: Generate both full-length and short-form videos
- 🖼️ **Custom Thumbnails**: Create eye-catching thumbnails automatically
- 📤 **YouTube Integration**: Upload videos directly to YouTube with metadata
- 📢 **Social Media Promotion**: Promote videos on Reddit, Pinterest, and Twitter
- 🔗 **Affiliate Link Integration**: Automatically add affiliate links to descriptions

## Installation

### Prerequisites

- Node.js 20 or newer
- pnpm (recommended) or npm
- FFmpeg (for video processing)

### Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd amazon-affiliate-video-automation

# Install dependencies
pnpm install

# Install globally for CLI access
pnpm run install:global
```

### Environment Setup

Copy `.env.example` to `.env` and configure your API keys:

```bash
cp .env.example .env
```

Required environment variables:
- `RAINFOREST_API_KEY` - Rainforest API key for Amazon product data
- `OPENAI_API_KEY` - OpenAI API key for script generation
- `ELEVENLABS_API_KEY` - ElevenLabs API key for voiceovers
- `YOUTUBE_CLIENT_ID` - YouTube API client ID
- `YOUTUBE_CLIENT_SECRET` - YouTube API client secret
- `YOUTUBE_OAUTH2_ACCESS_TOKEN` - YouTube OAuth access token
- `YOUTUBE_OAUTH2_REFRESH_TOKEN` - YouTube OAuth refresh token
- `AFFILIATE_TAG` - Your Amazon affiliate tag

See the [setup guides](docs/) for detailed API configuration instructions.

## CLI Usage

The tool provides a global `aff` command with three main subcommands:

### Create Videos

Create affiliate videos from Amazon product URLs or IDs:

```bash
# Create from product ID (easiest)
aff create B0CPZKLJX1

# Create from full Amazon URL
aff create "https://www.amazon.com/dp/B08N5WRWNW"

# Create with custom options
aff create B0CPZKLJX1 \
  --quality high \
  --max-images 3 \
  --auto-upload \
  --auto-promote

# Create without short video
aff create B08N5WRWNW --no-short-video
```

**Options:**
- `--max-images <number>` - Maximum images to download (default: 5)
- `--quality <level>` - Video quality: low, medium, high, ultra (default: medium)
- `--temp-dir <path>` - Temporary directory (default: ./temp)
- `--output-dir <path>` - Output directory (default: ./output)
- `--no-cleanup` - Don't cleanup temporary files
- `--auto-upload` - Automatically upload to YouTube
- `--auto-promote` - Automatically promote on social media
- `--promotion-platforms <list>` - Platforms to promote on (default: reddit,pinterest,twitter)
- `--create-short-video` - Create 30-second short video (default: true)
- `--no-short-video` - Disable short video creation
- `--headless` - Run browser automation in headless mode

### Promote Videos

Promote existing YouTube videos on social media:

```bash
# Promote with interactive prompts
aff promote "https://youtube.com/watch?v=abc123"

# Promote with full details
aff promote "https://youtube.com/watch?v=abc123" \
  --title "Amazing Kitchen Gadget Review" \
  --description "Honest review of this kitchen gadget" \
  --tags "kitchen,gadget,review,amazon" \
  --thumbnail "./output/thumbnail.jpg"

# Promote to specific platforms
aff promote "https://youtube.com/watch?v=abc123" \
  --title "Product Review" \
  --platforms "reddit,twitter"

# Test platform connectivity
aff promote test

# View promotion statistics
aff promote stats

# View campaign history
aff promote history
```

**Options:**
- `--title <title>` - Video title (required)
- `--description <desc>` - Video description
- `--tags <tags>` - Comma-separated tags
- `--thumbnail <path>` - Path to thumbnail image
- `--platforms <list>` - Platforms to promote on
- `--headless <bool>` - Run in headless mode (default: true)
- `--auto-confirm` - Skip confirmation prompts

### Publish Videos

Upload videos directly to YouTube:

```bash
# Upload with interactive prompts
aff publish ./output/my-video.mp4

# Upload with full details
aff publish ./output/product-review.mp4 \
  --title "Kitchen Gadget Review - Worth It?" \
  --description "Detailed review of this amazing kitchen gadget" \
  --tags "kitchen,gadget,review,amazon,cooking" \
  --thumbnail ./output/thumbnail.jpg \
  --product-url "https://amazon.com/dp/B123456789"

# Upload as unlisted video
aff publish ./output/video.mp4 \
  --title "Product Review" \
  --privacy unlisted

# Check upload quota
aff publish quota
```

**Options:**
- `--title <title>` - Video title (required)
- `--description <desc>` - Video description
- `--description-file <path>` - Path to description file
- `--tags <tags>` - Comma-separated video tags
- `--category <id>` - YouTube category ID (default: 26)
- `--privacy <status>` - Privacy: public, unlisted, private (default: public)
- `--thumbnail <path>` - Path to custom thumbnail
- `--product-url <url>` - Amazon product URL for affiliate link
- `--auto-confirm` - Skip confirmation prompts
- `--check-quota` - Check upload quota before uploading

## Development

### Project Structure

```
├── bin/
│   └── aff.js              # Main CLI entry point
├── src/
│   ├── commands/           # CLI command modules
│   │   ├── create.js       # Create command
│   │   ├── promote.js      # Promote command
│   │   ├── publish.js      # Publish command
│   │   └── utils.js        # Shared utilities
│   ├── promoters/          # Social media promoters
│   ├── *.js               # Core functionality modules
├── test/
│   ├── cli/               # CLI tests
│   └── *.test.js          # Unit tests
└── docs/                  # Documentation
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run CLI tests only
pnpm run test:cli

# Run tests in watch mode
pnpm run test:watch

# Run linting
pnpm run lint

# Format code
pnpm run format
```

### Legacy Scripts

For backward compatibility, the following npm scripts are still available:

```bash
# Legacy create command
pnpm start <amazon-url>

# Legacy promotion commands
pnpm run promote
pnpm run promote:test
pnpm run promote:stats
```

## API Documentation

### Core Functions

The main functionality is exposed through these functions:

- `createAffiliateVideo(productInput, options)` - Create complete affiliate video
- `uploadToYouTube(videoPath, title, description, productUrl, options)` - Upload to YouTube
- `PromotionManager` - Manage social media promotions

### Configuration Options

All commands support extensive configuration through command-line flags or options objects. See individual command help for details.

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Install FFmpeg and ensure it's in your PATH
2. **API key errors**: Verify all required environment variables are set
3. **YouTube upload fails**: Run `node youtube-auth.js` to refresh tokens
4. **Social media promotion fails**: Check platform-specific credentials

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
DEBUG=aff:* aff create B0CPZKLJX1
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/your-repo/issues)
- 💬 [Discussions](https://github.com/your-repo/discussions)

---

Made with ❤️ for affiliate marketers and content creators