# Amazon Affiliate Video Automation

A complete Node.js application that automates the creation of Amazon affiliate marketing videos by scraping product data, generating AI voiceovers, creating slideshow videos, and publishing directly to YouTube.

## 🚀 Features

- **Amazon Product Scraping**: Automatically extracts product titles, images, and descriptions
- **AI-Powered Voiceovers**: Generates realistic voiceovers using Eleven Labs API
- **Professional Video Creation**: Creates slideshow videos with FFmpeg
- **YouTube Publishing**: Automatically uploads videos with affiliate links
- **Progress Tracking**: Real-time progress reporting throughout the process
- **Error Handling**: Robust error handling with detailed logging
- **Cleanup Management**: Automatic cleanup of temporary files

## 📋 Prerequisites

### System Requirements
- Node.js 20 or newer
- FFmpeg installed on your system
- pnpm package manager

### API Keys Required
- **Eleven Labs API Key**: For AI voiceover generation
- **YouTube API Credentials**: For video uploading
- **Amazon Affiliate Tag**: For affiliate link generation

## 🛠️ Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd amazon-affiliate-video-automation
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Install FFmpeg** (if not already installed):
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

4. **Setup environment variables**:
```bash
cp .env.example .env
```

Edit `.env` file with your API credentials:
```env
# Eleven Labs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# YouTube API Configuration
YOUTUBE_CLIENT_ID=your_youtube_client_id_here
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret_here
YOUTUBE_OAUTH2_ACCESS_TOKEN=your_youtube_oauth2_access_token_here

# Amazon Affiliate Configuration
AFFILIATE_TAG=your-amazon-affiliate-tag
```

## 🎯 Usage

### Command Line Interface

**Basic usage**:
```bash
node src/index.js "https://www.amazon.com/dp/B08N5WRWNW"
```

**With options**:
```bash
node src/index.js "https://www.amazon.com/dp/B08N5WRWNW" \
  --quality high \
  --max-images 3 \
  --output-dir ./videos
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--max-images <number>` | Maximum images to download | 5 |
| `--quality <level>` | Video quality (low, medium, high, ultra) | medium |
| `--temp-dir <path>` | Temporary files directory | ./temp |
| `--output-dir <path>` | Output videos directory | ./output |
| `--no-cleanup` | Don't delete temporary files | false |

### Programmatic Usage

```javascript
import { createAffiliateVideo } from './src/index.js';

const result = await createAffiliateVideo(
  'https://www.amazon.com/dp/B08N5WRWNW',
  {
    maxImages: 3,
    videoQuality: 'high',
    onProgress: (progress) => {
      console.log(`${progress.step}: ${progress.progress}%`);
    }
  }
);

if (result.success) {
  console.log('Video uploaded:', result.youtubeUrl);
} else {
  console.error('Failed:', result.error);
}
```

## 🏗️ Architecture

The application is built with a modular architecture:

```
src/
├── amazon-scraper.js      # Amazon product data extraction
├── image-downloader.js    # Image downloading and management
├── voiceover-generator.js # AI voiceover generation
├── video-creator.js       # Video creation with FFmpeg
├── youtube-publisher.js   # YouTube API integration
└── index.js              # Main orchestrator and CLI
```

## 🧪 Testing

The project follows Test-Driven Development (TDD) principles with comprehensive test coverage.

**Run all tests**:
```bash
pnpm test
```

**Run tests in watch mode**:
```bash
pnpm run test:watch
```

**Run linting**:
```bash
pnpm run lint
```

**Format code**:
```bash
pnpm run format
```

## 📊 Workflow

The application follows this automated workflow:

1. **Validation** (5%): Validates Amazon URL format
2. **Scraping** (10%): Extracts product data from Amazon
3. **Image Download** (25%): Downloads product images
4. **Voiceover Generation** (45%): Creates AI voiceover
5. **Video Creation** (65%): Generates slideshow video
6. **YouTube Upload** (85%): Publishes to YouTube
7. **Cleanup** (95%): Removes temporary files
8. **Complete** (100%): Returns results

## ⚙️ Configuration

### Video Quality Settings

| Quality | CRF | Preset | Use Case |
|---------|-----|--------|----------|
| low | 28 | fast | Quick testing |
| medium | 23 | medium | Standard quality |
| high | 18 | slow | High quality |
| ultra | 15 | veryslow | Maximum quality |

### Eleven Labs Voice Settings

Default voice settings can be customized:
```javascript
const voiceSettings = {
  stability: 0.75,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
};
```

## 🔧 API Setup Guides

### 📚 Detailed Setup Instructions

For complete step-by-step guides with screenshots and troubleshooting:

- **📺 [YouTube API Setup Guide](docs/YOUTUBE_API_SETUP.md)** - Complete walkthrough for getting YouTube credentials
- **🎤 [Eleven Labs API Setup Guide](docs/ELEVENLABS_API_SETUP.md)** - Detailed guide for AI voiceover setup

### ⚡ Quick Setup Summary

**Eleven Labs API:**
1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Get your API key from the dashboard
3. Choose a voice ID (default: `21m00Tcm4TlvDq8ikWAM`)

**YouTube API:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project and enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Use [OAuth Playground](https://developers.google.com/oauthplayground) to get access token

**Amazon Affiliate Program:**
1. Join [Amazon Associates](https://affiliate-program.amazon.com)
2. Get your affiliate tag/tracking ID
3. Ensure compliance with Amazon's terms of service

## 🚨 Error Handling

The application includes comprehensive error handling for:

- Invalid Amazon URLs
- Network connectivity issues
- API rate limiting and quotas
- File system permissions
- FFmpeg processing errors
- YouTube upload failures

## 📝 Logging

All operations are logged with appropriate levels:
- ✅ Success operations
- ⚠️ Warnings for recoverable issues
- ❌ Errors for failures
- 🧹 Cleanup operations

## 🔒 Security Considerations

- Store API keys securely in environment variables
- Never commit `.env` files to version control
- Respect API rate limits and terms of service
- Ensure compliance with Amazon's affiliate program policies
- Follow YouTube's community guidelines

## 📈 Performance Tips

1. **Optimize Images**: Limit `maxImages` for faster processing
2. **Video Quality**: Use `medium` quality for faster encoding
3. **Concurrent Limits**: Image downloads are rate-limited to prevent blocking
4. **Cleanup**: Enable cleanup to save disk space

## 🐛 Troubleshooting

### Common Issues

**FFmpeg not found**:
```bash
# Install FFmpeg
sudo apt-get install ffmpeg  # Ubuntu/Debian
brew install ffmpeg          # macOS
```

**YouTube quota exceeded**:
- Wait for quota reset (daily)
- Implement exponential backoff
- Consider multiple API keys

**Eleven Labs API errors**:
- Check API key validity
- Verify account credits
- Reduce text length if needed

**Amazon scraping blocked**:
- Use different user agents
- Implement delays between requests
- Consider using proxies

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review existing GitHub issues
- Create a new issue with detailed information

## ⚠️ Disclaimer

This tool is for educational and legitimate affiliate marketing purposes only. Users must:
- Comply with Amazon's Terms of Service
- Follow YouTube's Community Guidelines
- Respect Eleven Labs' usage policies
- Ensure content accuracy and transparency
- Disclose affiliate relationships as required by law

The authors are not responsible for misuse of this software or violations of third-party terms of service.