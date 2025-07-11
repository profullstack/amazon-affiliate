#!/usr/bin/env node

/**
 * Test script to verify unique temporary file naming prevents concurrent execution conflicts
 */

import { generateSessionId, createVoiceoverFilePaths, createOutputFilePaths, createTempFilePath } from './src/utils/temp-file-manager.js';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 Testing Unique Temporary File Naming');
console.log('=' .repeat(60));

async function testUniqueFileNaming() {
  try {
    console.log('📋 Testing session ID generation...');
    
    // Test 1: Generate multiple session IDs
    const sessionIds = [];
    for (let i = 0; i < 5; i++) {
      const sessionId = generateSessionId();
      sessionIds.push(sessionId);
      console.log(`   Session ${i + 1}: ${sessionId}`);
    }
    
    // Verify all session IDs are unique
    const uniqueIds = new Set(sessionIds);
    if (uniqueIds.size === sessionIds.length) {
      console.log('✅ All session IDs are unique');
    } else {
      console.log('❌ Duplicate session IDs detected!');
      return false;
    }
    
    console.log('\n📋 Testing voiceover file paths...');
    
    // Test 2: Create voiceover file paths with different session IDs
    const session1 = generateSessionId();
    const session2 = generateSessionId();
    
    const voiceover1 = createVoiceoverFilePaths('./temp', {
      includeMain: true,
      includeShort: true,
      includeIntro: true
    }, session1);
    
    const voiceover2 = createVoiceoverFilePaths('./temp', {
      includeMain: true,
      includeShort: true,
      includeIntro: true
    }, session2);
    
    console.log('   Session 1 voiceover paths:');
    console.log(`     Main: ${path.basename(voiceover1.paths.main)}`);
    console.log(`     Short: ${path.basename(voiceover1.paths.short)}`);
    console.log(`     Intro: ${path.basename(voiceover1.paths.intro)}`);
    
    console.log('   Session 2 voiceover paths:');
    console.log(`     Main: ${path.basename(voiceover2.paths.main)}`);
    console.log(`     Short: ${path.basename(voiceover2.paths.short)}`);
    console.log(`     Intro: ${path.basename(voiceover2.paths.intro)}`);
    
    // Verify paths are different
    if (voiceover1.paths.main !== voiceover2.paths.main &&
        voiceover1.paths.short !== voiceover2.paths.short &&
        voiceover1.paths.intro !== voiceover2.paths.intro) {
      console.log('✅ Voiceover file paths are unique between sessions');
    } else {
      console.log('❌ Voiceover file paths are not unique!');
      return false;
    }
    
    console.log('\n📋 Testing output file paths...');
    
    // Test 3: Create output file paths with different session IDs
    const output1 = createOutputFilePaths('./output', 'test-product', {
      includeShort: true,
      includeThumbnails: true
    }, session1);
    
    const output2 = createOutputFilePaths('./output', 'test-product', {
      includeShort: true,
      includeThumbnails: true
    }, session2);
    
    console.log('   Session 1 output paths:');
    console.log(`     Video: ${path.basename(output1.paths.video)}`);
    console.log(`     Short: ${path.basename(output1.paths.shortVideo)}`);
    console.log(`     Thumbnail: ${path.basename(output1.paths.thumbnail)}`);
    
    console.log('   Session 2 output paths:');
    console.log(`     Video: ${path.basename(output2.paths.video)}`);
    console.log(`     Short: ${path.basename(output2.paths.shortVideo)}`);
    console.log(`     Thumbnail: ${path.basename(output2.paths.thumbnail)}`);
    
    // Verify paths are different
    if (output1.paths.video !== output2.paths.video &&
        output1.paths.shortVideo !== output2.paths.shortVideo &&
        output1.paths.thumbnail !== output2.paths.thumbnail) {
      console.log('✅ Output file paths are unique between sessions');
    } else {
      console.log('❌ Output file paths are not unique!');
      return false;
    }
    
    console.log('\n📋 Testing image file paths...');
    
    // Test 4: Test image file paths (simulating downloadImages behavior)
    const imageFiles = [];
    for (let i = 1; i <= 3; i++) {
      const filename = `image-${i}.jpg`;
      const path1 = createTempFilePath('./temp', filename, session1);
      const path2 = createTempFilePath('./temp', filename, session2);
      
      imageFiles.push({ session1: path1, session2: path2 });
      console.log(`   Image ${i}:`);
      console.log(`     Session 1: ${path.basename(path1)}`);
      console.log(`     Session 2: ${path.basename(path2)}`);
    }
    
    // Verify all image paths are unique between sessions
    const allUnique = imageFiles.every(img => img.session1 !== img.session2);
    if (allUnique) {
      console.log('✅ Image file paths are unique between sessions');
    } else {
      console.log('❌ Image file paths are not unique!');
      return false;
    }
    
    console.log('\n📋 Testing concurrent execution simulation...');
    
    // Test 5: Simulate concurrent executions
    const concurrentSessions = [];
    for (let i = 0; i < 3; i++) {
      const sessionId = generateSessionId();
      const voiceoverPaths = createVoiceoverFilePaths('./temp', { includeMain: true }, sessionId);
      const outputPaths = createOutputFilePaths('./output', 'concurrent-test', {}, sessionId);
      
      concurrentSessions.push({
        sessionId,
        voiceover: voiceoverPaths.paths.main,
        video: outputPaths.paths.video
      });
      
      console.log(`   Execution ${i + 1}:`);
      console.log(`     Session: ${sessionId}`);
      console.log(`     Voiceover: ${path.basename(voiceoverPaths.paths.main)}`);
      console.log(`     Video: ${path.basename(outputPaths.paths.video)}`);
    }
    
    // Verify all concurrent sessions have unique file paths
    const allVoiceovers = concurrentSessions.map(s => s.voiceover);
    const allVideos = concurrentSessions.map(s => s.video);
    const uniqueVoiceovers = new Set(allVoiceovers);
    const uniqueVideos = new Set(allVideos);
    
    if (uniqueVoiceovers.size === allVoiceovers.length && uniqueVideos.size === allVideos.length) {
      console.log('✅ All concurrent executions have unique file paths');
    } else {
      console.log('❌ Concurrent executions have conflicting file paths!');
      return false;
    }
    
    console.log('\n📋 Testing file path format validation...');
    
    // Test 6: Validate file path format
    const testSessionId = generateSessionId();
    const testPath = createTempFilePath('./temp', 'test-file.mp3', testSessionId);
    const expectedPattern = new RegExp(`test-file-${testSessionId}\\.mp3$`);
    
    if (expectedPattern.test(testPath)) {
      console.log(`✅ File path format is correct: ${path.basename(testPath)}`);
    } else {
      console.log(`❌ File path format is incorrect: ${path.basename(testPath)}`);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

// Run the test
console.log('🚀 Starting unique temporary file naming test...\n');

testUniqueFileNaming()
  .then(success => {
    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('🎉 UNIQUE TEMPORARY FILE NAMING TEST PASSED!');
      console.log('✅ Session IDs are unique');
      console.log('✅ Voiceover file paths are unique between sessions');
      console.log('✅ Output file paths are unique between sessions');
      console.log('✅ Image file paths are unique between sessions');
      console.log('✅ Concurrent executions have unique file paths');
      console.log('✅ File path format is correct');
      console.log('\n🔒 Concurrent execution conflicts are now prevented!');
      process.exit(0);
    } else {
      console.log('❌ UNIQUE TEMPORARY FILE NAMING TEST FAILED!');
      console.log('🔧 Concurrent execution conflicts may still occur');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Test script error:', error.message);
    process.exit(1);
  });