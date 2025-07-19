import { generateSessionId, createOutputFilePaths } from './src/utils/temp-file-manager.js';

/**
 * Test script to verify filename consistency across all generated files
 */
async function testFilenameConsistency() {
  console.log('🧪 Testing filename consistency...\n');
  
  // Simulate the video title generation process
  const mockVideoTitle = "Amazing Wireless Headphones - Honest Review";
  
  // Generate safe filename (same logic as in index.js)
  const generateSafeFilename = videoTitle => {
    const words = videoTitle
      .replace(/[^\w\s]/g, '') // Remove special characters
      .split(/\s+/)
      .filter(word => word.length > 2) // Only keep words longer than 2 chars
      .slice(0, 4); // Take only first 4 meaningful words
    
    const shortName = words.join('-').toLowerCase();
    const timestamp = Date.now().toString().slice(-6);
    
    return `${shortName}-${timestamp}`;
  };
  
  const safeFilename = generateSafeFilename(mockVideoTitle);
  console.log(`📝 Generated safe filename: ${safeFilename}`);
  
  // Generate session ID
  const sessionId = generateSessionId();
  console.log(`🔑 Session ID: ${sessionId}`);
  
  // Create output paths using the meaningful filename
  const outputPaths = createOutputFilePaths('./output', safeFilename, {
    includeShort: true,
    includeThumbnails: true
  }, sessionId);
  
  console.log('\n📁 Generated file paths:');
  console.log(`   📹 Main video: ${outputPaths.paths.video}`);
  console.log(`   📱 Short video: ${outputPaths.paths.shortVideo}`);
  console.log(`   🖼️  Main thumbnail: ${outputPaths.paths.thumbnail}`);
  console.log(`   🖼️  Short thumbnail: ${outputPaths.paths.shortThumbnail}`);
  
  // Verify all files use the same base name and session ID
  const extractBaseName = (filePath) => {
    const filename = filePath.split('/').pop();
    const match = filename.match(/^(.+)-([a-z0-9]+-[a-f0-9]{8})\./);
    return match ? { baseName: match[1], sessionId: match[2] } : null;
  };
  
  const videoInfo = extractBaseName(outputPaths.paths.video);
  const shortVideoInfo = extractBaseName(outputPaths.paths.shortVideo);
  const thumbnailInfo = extractBaseName(outputPaths.paths.thumbnail);
  const shortThumbnailInfo = extractBaseName(outputPaths.paths.shortThumbnail);
  
  console.log('\n🔍 Filename analysis:');
  console.log(`   Video base name: ${videoInfo?.baseName}`);
  console.log(`   Short video base name: ${shortVideoInfo?.baseName}`);
  console.log(`   Thumbnail base name: ${thumbnailInfo?.baseName}`);
  console.log(`   Short thumbnail base name: ${shortThumbnailInfo?.baseName}`);
  
  console.log(`\n   Video session ID: ${videoInfo?.sessionId}`);
  console.log(`   Short video session ID: ${shortVideoInfo?.sessionId}`);
  console.log(`   Thumbnail session ID: ${thumbnailInfo?.sessionId}`);
  console.log(`   Short thumbnail session ID: ${shortThumbnailInfo?.sessionId}`);
  
  // Check consistency - all files should share the same core base name and session ID
  // but may have different suffixes (like -short, -thumbnail, etc.)
  const coreBaseName = safeFilename; // The original meaningful name we generated
  const allSessionIds = [videoInfo?.sessionId, shortVideoInfo?.sessionId, thumbnailInfo?.sessionId, shortThumbnailInfo?.sessionId];
  
  // Check if all base names start with the core base name
  const baseNameConsistent = [
    videoInfo?.baseName === coreBaseName,
    shortVideoInfo?.baseName === `${coreBaseName}-short`,
    thumbnailInfo?.baseName === `${coreBaseName}-thumbnail`,
    shortThumbnailInfo?.baseName === `${coreBaseName}-short-thumb`
  ].every(Boolean);
  
  const sessionIdConsistent = allSessionIds.every(id => id === allSessionIds[0]);
  
  console.log('\n✅ Consistency check:');
  console.log(`   Core base name used: ${baseNameConsistent ? '✅ YES' : '❌ NO'}`);
  console.log(`   Session IDs consistent: ${sessionIdConsistent ? '✅ YES' : '❌ NO'}`);
  
  if (baseNameConsistent && sessionIdConsistent) {
    console.log('\n🎉 SUCCESS: All files will use consistent naming!');
    console.log(`📝 Pattern: [meaningful-name][-suffix]-[session-id].[extension]`);
    console.log(`📝 Core name: ${coreBaseName}`);
    console.log(`📝 Session ID: ${allSessionIds[0]}`);
  } else {
    console.log('\n❌ FAILURE: Filename inconsistency detected!');
  }
}

// Run the test
testFilenameConsistency().catch(console.error);