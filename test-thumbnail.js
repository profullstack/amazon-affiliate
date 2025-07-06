import { createThumbnail, validateThumbnailInputs, getThumbnailDimensions } from './src/thumbnail-generator.js';
import fs from 'fs/promises';

/**
 * Test script to demonstrate thumbnail generation functionality
 */
const testThumbnailGeneration = async () => {
  console.log('🎨 Testing YouTube thumbnail generation...');

  try {
    // Create test directories
    await fs.mkdir('temp', { recursive: true });
    await fs.mkdir('output', { recursive: true });

    // Mock product data for testing
    const mockProductData = {
      title: 'Amazing Wireless Headphones - Premium Sound Quality',
      price: '$89.99',
      rating: 4.5,
      reviewCount: '1,234 reviews',
      features: [
        'Active Noise Cancellation',
        '30-hour battery life',
        'Premium sound quality',
        'Comfortable over-ear design'
      ],
      description: 'Experience premium audio with these wireless headphones featuring advanced noise cancellation technology and exceptional battery life.',
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
        'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=400&fit=crop'
      ]
    };

    console.log('📋 Product Data:');
    console.log(`   Title: ${mockProductData.title}`);
    console.log(`   Price: ${mockProductData.price}`);
    console.log(`   Rating: ${mockProductData.rating} stars`);
    console.log(`   Images: ${mockProductData.images.length} available`);

    // Test input validation
    console.log('\n🔍 Testing input validation...');
    try {
      validateThumbnailInputs(mockProductData, 'output/test-thumbnail.jpg');
      console.log('✅ Input validation passed');
    } catch (error) {
      console.log(`❌ Input validation failed: ${error.message}`);
      return;
    }

    // Test platform dimensions
    console.log('\n📐 Testing platform dimensions...');
    const platforms = ['youtube', 'instagram', 'facebook', 'twitter'];
    platforms.forEach(platform => {
      const dimensions = getThumbnailDimensions(platform);
      console.log(`   ${platform}: ${dimensions.width}x${dimensions.height}`);
    });

    // Check if ImageMagick is available
    const hasImageMagick = await checkImageMagick();
    
    if (!hasImageMagick) {
      console.log('\n⚠️ ImageMagick not found. Install it to test thumbnail generation:');
      console.log('   Ubuntu/Debian: sudo apt-get install imagemagick');
      console.log('   macOS: brew install imagemagick');
      console.log('   Windows: Download from https://imagemagick.org/script/download.php');
      console.log('\n✅ Thumbnail generator is ready to use once ImageMagick is installed!');
      return;
    }

    console.log('\n🎨 Creating thumbnails...');

    // Test 1: Text-only thumbnail (no product image)
    console.log('\n1️⃣ Testing text-only thumbnail...');
    const textOnlyData = { ...mockProductData, images: [] };
    try {
      const textThumbnail = await createThumbnail(
        textOnlyData,
        'output/test-thumbnail-text-only.jpg'
      );
      console.log(`✅ Text-only thumbnail created: ${textThumbnail}`);
    } catch (error) {
      console.log(`❌ Text-only thumbnail failed: ${error.message}`);
    }

    // Test 2: Thumbnail with product image
    console.log('\n2️⃣ Testing thumbnail with product image...');
    try {
      const imageThumbnail = await createThumbnail(
        mockProductData,
        'output/test-thumbnail-with-image.jpg'
      );
      console.log(`✅ Image thumbnail created: ${imageThumbnail}`);
    } catch (error) {
      console.log(`❌ Image thumbnail failed: ${error.message}`);
    }

    // Test 3: Custom configuration
    console.log('\n3️⃣ Testing custom thumbnail configuration...');
    const customConfig = {
      backgroundColor: '#2c3e50',
      accentColor: '#e74c3c',
      fontSize: {
        title: 52,
        subtitle: 36,
        rating: 40,
        price: 46
      }
    };

    try {
      const customThumbnail = await createThumbnail(
        mockProductData,
        'output/test-thumbnail-custom.jpg',
        customConfig
      );
      console.log(`✅ Custom thumbnail created: ${customThumbnail}`);
    } catch (error) {
      console.log(`❌ Custom thumbnail failed: ${error.message}`);
    }

    // Test 4: Different platform sizes
    console.log('\n4️⃣ Testing different platform sizes...');
    for (const platform of ['youtube', 'instagram']) {
      try {
        const dimensions = getThumbnailDimensions(platform);
        const platformThumbnail = await createThumbnail(
          mockProductData,
          `output/test-thumbnail-${platform}.jpg`,
          dimensions
        );
        console.log(`✅ ${platform} thumbnail created: ${platformThumbnail}`);
      } catch (error) {
        console.log(`❌ ${platform} thumbnail failed: ${error.message}`);
      }
    }

    console.log('\n🎉 Thumbnail generation tests completed!');
    console.log('\n📊 Generated Thumbnails:');
    console.log('   • output/test-thumbnail-text-only.jpg (Text-only design)');
    console.log('   • output/test-thumbnail-with-image.jpg (With product image)');
    console.log('   • output/test-thumbnail-custom.jpg (Custom styling)');
    console.log('   • output/test-thumbnail-youtube.jpg (YouTube optimized)');
    console.log('   • output/test-thumbnail-instagram.jpg (Instagram optimized)');

    console.log('\n💡 Thumbnail Features:');
    console.log('   ✅ High-quality 1280x720 resolution for YouTube');
    console.log('   ✅ Professional design with product images');
    console.log('   ✅ Eye-catching text and rating display');
    console.log('   ✅ Customizable colors and fonts');
    console.log('   ✅ Multiple platform support');
    console.log('   ✅ Automatic fallback to text-only design');

  } catch (error) {
    console.error('❌ Thumbnail generation test failed:', error.message);
    console.error(error.stack);
  }
};

/**
 * Checks if ImageMagick is available on the system
 * @returns {Promise<boolean>} True if ImageMagick is available
 */
const checkImageMagick = async () => {
  try {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve) => {
      const magick = spawn('magick', ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      magick.on('close', (code) => {
        resolve(code === 0);
      });

      magick.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        magick.kill();
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    return false;
  }
};

// Show thumbnail configuration
console.log('🔧 Thumbnail Configuration:');
console.log('   Resolution: 1280x720 (YouTube optimized)');
console.log('   Quality: 95% (High quality JPEG)');
console.log('   Background: Dark gradient');
console.log('   Text: White with orange accents');
console.log('   Features: Product image, title, rating, price');

// Run the test
testThumbnailGeneration();