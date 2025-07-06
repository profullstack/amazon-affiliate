# User Confirmation Feature

## Overview

The Amazon Affiliate Video Automation application now includes a user confirmation prompt before YouTube upload. This prevents accidental uploads during testing and gives users control over when their videos are published.

## Features

### 🎯 Core Functionality

- **Video Review**: After video creation, users can review the local file before deciding to upload
- **Interactive Prompt**: Clear y/N confirmation prompt with default to "No" for safety
- **Auto-Upload Option**: `--auto-upload` flag for automated workflows
- **File Information**: Shows local video path, file size, and creation details
- **Graceful Handling**: Proper cleanup and status reporting regardless of upload choice

### 📋 Usage Examples

#### 1. Manual Confirmation (Default Behavior)
```bash
node src/index.js "https://www.amazon.com/dp/EXAMPLE"
```

**Expected Flow:**
1. Video is created successfully
2. Application shows video details and local file path
3. User is prompted: "Do you want to upload this video to YouTube now? (y/N):"
4. User types 'y' or 'n' to confirm or skip upload

#### 2. Automatic Upload
```bash
node src/index.js "https://www.amazon.com/dp/EXAMPLE" --auto-upload
```

**Expected Flow:**
1. Video is created successfully
2. Application automatically proceeds to YouTube upload without prompting
3. Useful for automated scripts and CI/CD pipelines

#### 3. Programmatic Usage
```javascript
import { createAffiliateVideo } from './src/index.js';

// Manual confirmation
const result1 = await createAffiliateVideo(url, { autoUpload: false });

// Auto-upload
const result2 = await createAffiliateVideo(url, { autoUpload: true });

// Default behavior (manual confirmation)
const result3 = await createAffiliateVideo(url);
```

## Implementation Details

### 🔧 Technical Components

#### 1. `promptUserConfirmation()` Function
```javascript
const promptUserConfirmation = async (message, autoConfirm = false) => {
  if (autoConfirm) {
    console.log(`${message} (auto-confirmed)`);
    return true;
  }

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().trim() === 'y' || 
                       answer.toLowerCase().trim() === 'yes';
      resolve(confirmed);
    });
  });
};
```

#### 2. CLI Flag Support
- Added `--auto-upload` flag to command line parser
- Updated help text and usage examples
- Proper flag handling in `runCLI()` function

#### 3. Result Object Updates
```javascript
// When upload is skipped
{
  success: true,
  skippedUpload: true,
  productTitle: "Product Name",
  videoTitle: "Generated Title",
  files: { video: "/path/to/video.mp4", ... },
  // ... other properties
}

// When upload succeeds
{
  success: true,
  youtubeUrl: "https://youtube.com/watch?v=...",
  videoId: "abc123",
  // ... other properties
}
```

### 🎬 User Experience Flow

#### Step-by-Step Process

1. **Video Creation**: Normal video creation process (scraping, images, voiceover, video)

2. **Video Review Phase**:
   ```
   🎬 Video creation completed successfully!
   📹 Video details:
      📁 File: ./output/product-review-123456.mp4
      📏 Title: Amazing Product - Honest Review
      ⏱️ Duration: ~45s to create
      📊 File size: 12.3MB

   🔍 Please review your video before uploading to YouTube:
      🎥 Local file: ./output/product-review-123456.mp4
      💡 You can open this file in any video player to preview it
   ```

3. **Upload Confirmation**:
   ```
   📤 Do you want to upload this video to YouTube now? (y/N):
   ```

4. **User Response Handling**:
   - **'y' or 'yes'**: Proceeds with YouTube upload
   - **'n', 'no', or Enter**: Skips upload, keeps video locally
   - **Invalid input**: Treats as 'no' for safety

5. **Final Status**:
   - **Upload Success**: Shows YouTube URL and completion message
   - **Upload Skipped**: Shows local file path and skip confirmation

### 🛡️ Safety Features

- **Default to No**: Pressing Enter defaults to skipping upload
- **Case Insensitive**: Accepts 'Y', 'y', 'Yes', 'yes' for confirmation
- **Input Validation**: Invalid responses are treated as 'no'
- **Cleanup Handling**: Temporary files are cleaned up regardless of upload choice
- **Error Recovery**: Proper error handling if upload fails after confirmation

### 🚀 Benefits

1. **Prevents YouTube Spam**: No more accidental test video uploads
2. **Quality Control**: Users can review videos before publishing
3. **Flexible Workflows**: Supports both interactive and automated usage
4. **Better Testing**: Developers can test video creation without YouTube uploads
5. **User Control**: Clear choice and feedback at every step

## Testing

Run the test script to verify functionality:

```bash
node test-user-confirmation.js
```

This will show usage examples and verify the implementation is working correctly.

## Backward Compatibility

- **Existing Scripts**: Old scripts will now prompt for confirmation (safer default)
- **API Compatibility**: The `createAffiliateVideo()` function signature remains the same
- **Migration Path**: Add `{ autoUpload: true }` to maintain old behavior programmatically
- **CLI Migration**: Add `--auto-upload` flag to maintain old CLI behavior

## Future Enhancements

Potential improvements for future versions:

- **Video Preview**: Open video in default player automatically
- **Upload Scheduling**: Schedule uploads for specific times
- **Batch Processing**: Handle multiple videos with single confirmation
- **Upload Queuing**: Queue videos for later batch upload
- **Preview Thumbnails**: Show thumbnail preview in terminal