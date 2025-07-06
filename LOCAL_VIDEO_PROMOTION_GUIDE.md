# Local Video Promotion Guide

## 🎯 Quick Start - Promote Videos from ./output Folder

You now have multiple ways to promote videos that are already created and stored in your `./output` folder:

### 📱 **Interactive Mode (Recommended)**
```bash
# Launch interactive promoter
pnpm run promote:local

# Or directly
node src/local-video-promoter.js
```

This will:
1. 📹 Scan and display all videos in `./output`
2. 🎯 Let you select which video to promote
3. ✏️ Prompt for video details (title, YouTube URL, tags, etc.)
4. 🚀 Run promotion across selected platforms

### ⚡ **Quick Mode**
```bash
# Quick promotion with minimal prompts
node src/local-video-promoter.js "video-filename.mp4" "https://youtube.com/watch?v=VIDEO_ID"

# With custom options
node src/local-video-promoter.js "delonghi-rivelia-automatic-espresso-186634.mp4" \
  "https://youtube.com/watch?v=abc123" \
  --title "DeLonghi Rivelia Espresso Machine Review" \
  --tags "coffee,espresso,delonghi,kitchen,review" \
  --platforms "reddit,pinterest,twitter"
```

### 🎛️ **Available Options**

| Option | Description | Example |
|--------|-------------|---------|
| `--title` | Custom video title | `"Amazing Coffee Machine Review"` |
| `--description` | Video description | `"Honest review of this espresso machine"` |
| `--tags` | Comma-separated tags | `"coffee,espresso,kitchen,review"` |
| `--platforms` | Target platforms | `"reddit,pinterest,twitter"` |

### 📁 **What the Tool Does**

1. **Scans ./output folder** for video files (.mp4, .mov, .avi)
2. **Looks for thumbnails** automatically (searches for matching .jpg/.png files)
3. **Extracts titles** from filenames intelligently
4. **Promotes across platforms** using the same system as the main workflow

### 🎯 **Example Workflow**

Based on your current videos, here's how you'd promote one:

```bash
# Interactive mode
pnpm run promote:local
# Select: 1 (delonghi-rivelia-automatic-espresso-186634.mp4)
# Enter YouTube URL: https://youtube.com/watch?v=YOUR_VIDEO_ID
# Title will auto-populate as: "Delonghi Rivelia Automatic Espresso - Review"
# Tags: coffee,espresso,delonghi,kitchen,review
# Platforms: reddit,pinterest,twitter
```

### 🔧 **Smart Features**

#### **Automatic Title Generation**
- `delonghi-rivelia-automatic-espresso-186634.mp4` → `"Delonghi Rivelia Automatic Espresso - Review"`
- Removes timestamps, capitalizes words, adds "Review" if missing

#### **Thumbnail Detection**
- Automatically looks for matching thumbnails:
  - `video-name-thumbnail.jpg`
  - `video-name-thumbnail.png`
  - `video-name.jpg`
  - `video-name.png`

#### **Platform Targeting**
- **Coffee/Kitchen products** → Reddit: r/Coffee, r/espresso, r/Kitchen
- **Pinterest** → Coffee boards, Kitchen Gadgets
- **Twitter** → Coffee hashtags, kitchen tags

### 📊 **Current Videos Available**

From your `./output` folder:
```
1. delonghi-rivelia-automatic-espresso-186634.mp4 (3.9MB) ⭐ Best size
2. delonghi-rivelia-automatic-espresso-210086.mp4 (3.9MB) ⭐ Best size  
3. delonghi-rivelia-automatic-espresso-290072.mp4 (4.4MB) ⭐ Best size
4. delonghi-rivelia-automatic-espresso-584857.mp4 (1.4MB)
5. delonghi-rivelia-automatic-espresso-725739.mp4 (0.3MB) ⚠️ Small
... and more
```

**Recommendation**: Use videos #1, #2, or #3 as they have the best file sizes (3.9-4.4MB).

### 🚀 **Complete Example**

```bash
# 1. Run interactive promoter
pnpm run promote:local

# 2. Select video (e.g., option 1)
# 3. Enter details:
#    - YouTube URL: https://youtube.com/watch?v=abc123
#    - Title: DeLonghi Rivelia Espresso Machine - Honest Review
#    - Tags: coffee,espresso,delonghi,kitchen,review,amazon
#    - Platforms: reddit,pinterest,twitter

# 4. Confirm and watch it promote across all platforms!
```

### 🎯 **Pro Tips**

1. **Upload to YouTube first** - You need the YouTube URL before promoting
2. **Use good tags** - Include product category, brand, and "review"
3. **Check file sizes** - Larger videos (3-5MB) usually have better quality
4. **Create thumbnails** - Pinterest works better with custom thumbnails
5. **Time your promotions** - Best times are weekday business hours

### 🔗 **Integration with Main Workflow**

You can also promote during video creation:
```bash
# Create video with auto-promotion
node src/index.js "https://amazon.com/dp/PRODUCT_ID" --auto-promote

# Or create first, then promote later
node src/index.js "https://amazon.com/dp/PRODUCT_ID"
# ... then later ...
pnpm run promote:local