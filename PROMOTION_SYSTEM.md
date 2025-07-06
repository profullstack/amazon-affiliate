# YouTube Video Promotion Automation System

A comprehensive automation system for promoting YouTube product review videos across multiple social media platforms using Puppeteer-based browser automation.

## 🚀 Features

### Supported Platforms
- **Reddit**: Automated posting to relevant subreddits with smart targeting
- **Pinterest**: Pin creation with SEO-optimized descriptions and hashtags
- **Twitter/X**: Tweet and thread posting with engagement optimization

### Key Capabilities
- **Smart Platform Selection**: Automatically selects relevant communities based on product categories
- **Rate Limiting**: Respects platform limits to avoid spam detection
- **Human-like Behavior**: Random delays and realistic interaction patterns
- **User Login Handling**: Prompts for manual login when required
- **Campaign Tracking**: Comprehensive logging and analytics
- **Error Recovery**: Robust error handling with detailed logging

## 📁 Project Structure

```
src/
├── promoters/
│   ├── base-promoter.js      # Base class with common functionality
│   ├── reddit-promoter.js    # Reddit-specific automation
│   ├── pinterest-promoter.js # Pinterest-specific automation
│   └── twitter-promoter.js   # Twitter-specific automation
├── promotion-manager.js      # Main coordination class
├── promotion-cli.js          # Command-line interface
└── index.js                  # Integrated with video creation workflow

test/
├── promotion-manager.test.js
├── reddit-promoter.test.js
├── pinterest-promoter.test.js
└── twitter-promoter.test.js
```

## 🛠️ Installation

```bash
# Install dependencies
pnpm install

# The following packages are required for promotion:
# - puppeteer: Browser automation
# - sharp: Image processing for Pinterest
# - winston: Logging
# - cheerio: HTML parsing
# - node-cron: Scheduling (future feature)
```

## 📖 Usage

### Integrated with Video Creation

```bash
# Create and promote video in one command
node src/index.js "https://amazon.com/dp/PRODUCT_ID" \
  --auto-upload \
  --auto-promote \
  --promotion-platforms "reddit,pinterest,twitter"
```

### Standalone Promotion CLI

```bash
# Promote an existing YouTube video
node src/promotion-cli.js promote "https://youtube.com/watch?v=VIDEO_ID" \
  --title "Amazing Kitchen Gadget Review" \
  --description "Honest review of this kitchen gadget" \
  --tags "kitchen,gadget,review,amazon" \
  --thumbnail "./output/thumbnail.jpg"

# Test platform connectivity
node src/promotion-cli.js test

# View promotion statistics
node src/promotion-cli.js stats

# View campaign history
node src/promotion-cli.js history
```

### Programmatic Usage

```javascript
import { PromotionManager } from './src/promotion-manager.js';

const promotionManager = new PromotionManager({
  headless: true,
  enabledPlatforms: ['reddit', 'pinterest', 'twitter']
});

const videoData = {
  title: 'Amazing Kitchen Gadget Review',
  url: 'https://youtube.com/watch?v=VIDEO_ID',
  description: 'Honest review of this kitchen gadget',
  tags: ['kitchen', 'gadget', 'review', 'amazon'],
  thumbnailPath: './thumbnail.jpg'
};

const results = await promotionManager.promoteVideo(videoData);
console.log('Promotion results:', results);
```

## 🎯 Platform-Specific Features

### Reddit Automation
- **Smart Subreddit Selection**: Automatically chooses relevant subreddits based on product category
- **Engaging Titles**: Generates Reddit-friendly post titles
- **Rate Limiting**: 24-hour cooldown between posts to same subreddit
- **Flair Support**: Automatically adds relevant post flairs when available
- **Affiliate Disclosure**: Includes proper affiliate link disclosure

**Supported Categories & Subreddits**:
- Kitchen: r/Kitchen, r/Cooking, r/KitchenGadgets, r/BuyItForLife
- Tech: r/gadgets, r/technology, r/ProductReviews
- Home: r/HomeImprovement, r/organization
- Fitness: r/fitness, r/homegym
- And more...

### Pinterest Automation
- **Pin Optimization**: Creates 1000x1500 Pinterest-optimized images
- **SEO Descriptions**: Generates keyword-rich pin descriptions
- **Board Management**: Posts to relevant boards based on product category
- **Hashtag Strategy**: Uses up to 20 relevant hashtags per pin
- **Rate Limiting**: Maximum 5 pins per hour with 15-minute intervals

**Pin Features**:
- Automatic image resizing and optimization
- Call-to-action text
- Product category targeting
- Seasonal hashtag integration

### Twitter Automation
- **Smart Content**: Generates tweets within 280-character limit
- **Thread Support**: Creates multi-tweet threads for longer content
- **Hashtag Optimization**: Uses 3-5 relevant hashtags per tweet
- **Timing Optimization**: Suggests best posting times
- **Rate Limiting**: Maximum 25 tweets per hour with 5-minute intervals

**Tweet Features**:
- Engaging prefixes and emojis
- Automatic URL shortening consideration
- Thread numbering for multi-part content
- Relevant account suggestions for engagement

## 🔧 Configuration

### Environment Variables

```bash
# Optional: Configure browser settings
PROMOTION_HEADLESS=true
PROMOTION_TIMEOUT=30000

# Optional: Platform-specific settings
REDDIT_MIN_INTERVAL=86400000  # 24 hours
PINTEREST_MAX_PINS_PER_HOUR=5
TWITTER_MAX_TWEETS_PER_HOUR=25
```

### Platform Configuration

```javascript
const config = {
  headless: true,                    // Run browser in headless mode
  timeout: 30000,                    // Default timeout for operations
  enabledPlatforms: ['reddit', 'pinterest', 'twitter'],
  maxConcurrentPromotions: 1,        // Run promotions sequentially
  
  // Platform-specific overrides
  reddit: {
    minPostInterval: 24 * 60 * 60 * 1000,  // 24 hours
    maxSubreddits: 3                        // Limit subreddits per campaign
  },
  
  pinterest: {
    maxPinsPerHour: 5,
    minPinInterval: 15 * 60 * 1000          // 15 minutes
  },
  
  twitter: {
    maxTweetsPerHour: 25,
    minTweetInterval: 5 * 60 * 1000         // 5 minutes
  }
};
```

## 📊 Analytics & Tracking

### Campaign Tracking
- **Unique Campaign IDs**: Each promotion gets a unique identifier
- **Detailed Logging**: Comprehensive logs for debugging and analysis
- **Success Metrics**: Track successful vs failed promotions per platform
- **Performance Data**: Duration, error rates, and engagement metrics

### Log Files
```
logs/
├── promotion-manager.log     # Main system logs
├── reddit.log               # Reddit-specific logs
├── pinterest.log            # Pinterest-specific logs
├── twitter.log              # Twitter-specific logs
├── screenshots/             # Error screenshots for debugging
└── campaign-*.json          # Individual campaign results
```

### Statistics API
```javascript
const stats = promotionManager.getPromotionStats();
console.log(stats);
// Output:
// {
//   totalPromotions: 10,
//   successfulPromotions: 8,
//   failedPromotions: 2,
//   platformStats: {
//     reddit: { total: 10, successful: 9, failed: 1 },
//     pinterest: { total: 10, successful: 8, failed: 2 },
//     twitter: { total: 10, successful: 7, failed: 3 }
//   }
// }
```

## 🛡️ Safety & Compliance

### Rate Limiting
- **Platform Respect**: Adheres to each platform's rate limits
- **Human-like Delays**: Random delays between actions (1-10 minutes between platforms)
- **Cooldown Periods**: Enforced waiting periods between posts to same communities
- **Detection Avoidance**: Randomized user agents and realistic interaction patterns

### Terms of Service Compliance
- **Manual Login**: Requires user to manually log in to each platform
- **Affiliate Disclosure**: Automatically includes affiliate link disclosures
- **Content Guidelines**: Generates content that follows platform guidelines
- **Spam Prevention**: Built-in limits to prevent spam-like behavior

### Error Handling
- **Graceful Degradation**: Continues with other platforms if one fails
- **Detailed Error Logging**: Captures screenshots and error details
- **Retry Logic**: Intelligent retry mechanisms for transient failures
- **User Notifications**: Clear error messages and recovery suggestions

## 🔍 Troubleshooting

### Common Issues

**Login Problems**:
```bash
# Test platform connectivity
node src/promotion-cli.js test

# Check browser logs
tail -f logs/reddit.log
```

**Rate Limiting**:
```bash
# Check recent activity
node src/promotion-cli.js stats

# Wait for cooldown period or adjust settings
```

**Image Upload Issues (Pinterest)**:
```bash
# Verify thumbnail exists and is valid
ls -la ./output/thumbnail.jpg

# Check image processing logs
tail -f logs/pinterest.log
```

### Debug Mode
```bash
# Run with visible browser for debugging
node src/promotion-cli.js promote "VIDEO_URL" \
  --title "Test" \
  --headless false
```

## 🚀 Future Enhancements

### Planned Features
- **Quora Automation**: Answer relevant questions with video links
- **YouTube Comment Engagement**: Engage with similar videos
- **Scheduling System**: Schedule promotions for optimal times
- **A/B Testing**: Test different content variations
- **Analytics Dashboard**: Web-based analytics interface
- **Proxy Support**: IP rotation for larger scale operations

### Integration Opportunities
- **Zapier/Make.com**: Webhook integrations for automation
- **Google Analytics**: Track traffic from promotions
- **Social Media APIs**: Direct API integration where available
- **CRM Integration**: Track leads and conversions

## 📄 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review log files for error details
3. Create an issue with detailed information
4. Include relevant log snippets and screenshots