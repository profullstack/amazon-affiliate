# Media Files for Affiliate Video Creation

This directory contains the media assets used for creating professional affiliate videos with background music and intro/outro segments.

## 📁 Current Files

### 🎵 Background Music
- **`background-music.wav`** - Sample background music file (440Hz sine wave)
  - Used for: Background audio mixing at 15% volume during main content
  - Format: WAV, 44.1kHz, Stereo
  - Duration: 30 seconds (loops automatically for longer videos)

### 🖼️ Intro/Outro Images
- **`banner.jpg`** - Intro segment image (blue background)
  - Used for: 5-second intro with higher volume music (40%)
  - Resolution: 1920x1080
  - Scaling: Zoom to fit (crops to fill frame)

- **`profile.jpg`** - Outro segment image (green background)
  - Used for: 5-second outro with higher volume music (40%)
  - Resolution: 1920x1080
  - Scaling: Centered with aspect ratio preserved

## 🎬 How It Works

### Background Music System
- Randomly selects from `./media/*.wav` files
- Mixes at 15% volume with voiceover at 100%
- Includes 2-second fade in/out
- Loops automatically for video duration

### Intro/Outro System
- **Intro**: Uses `banner.jpg` with 40% music volume
- **Main Content**: Product images with 15% music volume
- **Outro**: Uses `profile.jpg` with 40% music volume
- Total video duration = intro (5s) + main content + outro (5s)

### Video Functions That Use These Files
- ✅ `createVideo()` - Single image videos
- ✅ `createSlideshow()` - Multiple image slideshows
- ✅ `createShortVideo()` - Vertical format for social media
- ✅ `createVideoWithAffiliateOverlay()` - Videos with text overlays

## 🔧 Customization

### Adding Your Own Background Music
1. Add `.wav` files to this directory
2. System will randomly select from all available files
3. Recommended format: 44.1kHz, Stereo, WAV

### Replacing Intro/Outro Images
1. Replace `banner.jpg` with your intro image
2. Replace `profile.jpg` with your outro image
3. Recommended resolution: 1920x1080 or higher
4. Supported formats: JPG, PNG

### Disabling Features
```javascript
// Disable background music
const options = { enableBackgroundMusic: false };

// Disable intro/outro
const options = { enableIntroOutro: false };

// Disable both
const options = { 
  enableBackgroundMusic: false, 
  enableIntroOutro: false 
};
```

## 📋 File Requirements

### Background Music Files
- **Location**: `./media/*.wav`
- **Format**: WAV (recommended)
- **Sample Rate**: 44.1kHz
- **Channels**: Stereo (2 channels)
- **Duration**: Any (will loop automatically)

### Intro Image
- **Location**: `./media/banner.jpg`
- **Format**: JPG or PNG
- **Resolution**: 1920x1080 or higher
- **Aspect Ratio**: Any (will be scaled appropriately)

### Outro Image
- **Location**: `./media/profile.jpg`
- **Format**: JPG or PNG
- **Resolution**: 1920x1080 or higher
- **Aspect Ratio**: Any (will be scaled appropriately)

## 🎯 Audio Mixing Levels

| Segment | Voiceover | Background Music |
|---------|-----------|------------------|
| Intro   | 100%      | 40%              |
| Main    | 100%      | 15%              |
| Outro   | 100%      | 40%              |

## ⚠️ Important Notes

1. **File Existence**: If any required files are missing, the system will gracefully disable that feature
2. **Automatic Detection**: The system automatically scans for available files on each video creation
3. **Fallback Behavior**: Videos will still be created even if media files are missing
4. **Performance**: Larger audio files may increase processing time

## 🚀 Getting Started

The current placeholder files are functional but basic. For professional results:

1. **Replace `background-music.wav`** with royalty-free music
2. **Replace `banner.jpg`** with your brand intro image
3. **Replace `profile.jpg`** with your profile/logo image
4. **Add multiple music files** for variety

Your videos will automatically use these enhanced media assets!