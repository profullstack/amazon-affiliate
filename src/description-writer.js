import fs from 'fs/promises';
import path from 'path';

/**
 * Clean markdown formatting from text for YouTube compatibility
 * @param {string} text - Text with markdown formatting
 * @returns {string} - Clean text without markdown
 */
const cleanMarkdownFormatting = (text) => {
  if (!text) return '';
  
  return text
    // Remove bold markdown (**text**)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Remove italic markdown (*text*)
    .replace(/\*(.*?)\*/g, '$1')
    // Remove headers (# text)
    .replace(/#{1,6}\s*/g, '')
    // Remove inline code (`text`)
    .replace(/`(.*?)`/g, '$1')
    // Remove links ([text](url))
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // Remove strikethrough (~~text~~)
    .replace(/~~(.*?)~~/g, '$1')
    // Remove blockquotes (> text)
    .replace(/^>\s*/gm, '')
    // Remove horizontal rules (--- or ***)
    .replace(/^[-*]{3,}$/gm, '')
    // Remove list markers (- item, * item, 1. item)
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Generates a safe filename from video title for description file
 * @param {string} videoTitle - Video title
 * @returns {string} - Safe filename with .txt extension
 * @throws {Error} When video title is invalid
 */
export const generateDescriptionFilename = (videoTitle) => {
  if (!videoTitle || typeof videoTitle !== 'string' || videoTitle.trim().length === 0) {
    throw new Error('Video title is required');
  }

  // Extract key words and create a safe filename
  const words = videoTitle
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .split(/\s+/)
    .filter(word => word.length > 2) // Only keep words longer than 2 chars
    .slice(0, 4); // Take only first 4 meaningful words

  // Remove duplicates while preserving order
  const uniqueWords = [];
  const seenWords = new Set();
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    if (!seenWords.has(lowerWord)) {
      seenWords.add(lowerWord);
      uniqueWords.push(lowerWord);
    }
  }

  const shortName = uniqueWords.join('-');
  
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now().toString().slice(-6);
  
  // Ensure filename is not too long (max 80 chars before extension)
  const baseFilename = `${shortName}-${timestamp}`;
  const maxLength = 80;
  
  const finalBasename = baseFilename.length > maxLength 
    ? baseFilename.substring(0, maxLength)
    : baseFilename;
  
  return `${finalBasename}.txt`;
};

/**
 * Writes video description to a text file in the output directory
 * @param {string} description - Video description content
 * @param {string} videoTitle - Video title (used for filename generation)
 * @param {string} outputDir - Output directory path
 * @param {string} [customFilename] - Optional custom filename (with .txt extension)
 * @returns {Promise<Object>} - Result object with file path, filename, and stats
 * @throws {Error} When parameters are invalid or file operation fails
 */
export const writeVideoDescription = async (description, videoTitle, outputDir, customFilename = null) => {
  // Validate inputs
  if (description === null || description === undefined) {
    throw new Error('Description is required');
  }

  if (!videoTitle || typeof videoTitle !== 'string' || videoTitle.trim().length === 0) {
    throw new Error('Video title is required');
  }

  if (!outputDir || typeof outputDir !== 'string' || outputDir.trim().length === 0) {
    throw new Error('Output directory is required');
  }

  // Convert description to string
  const rawDescriptionText = String(description);
  const cleanDescriptionText = cleanMarkdownFormatting(rawDescriptionText);

  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Generate base filename (without extension)
    const baseFilename = customFilename
      ? path.parse(customFilename).name
      : path.parse(generateDescriptionFilename(videoTitle)).name;

    // Create both .txt (clean) and .md (original) files
    const txtFilename = `${baseFilename}.txt`;
    const mdFilename = `${baseFilename}.md`;
    const txtFilePath = path.join(outputDir, txtFilename);
    const mdFilePath = path.join(outputDir, mdFilename);

    // Clean the title for .txt file (remove markdown)
    const cleanTitle = cleanMarkdownFormatting(videoTitle);
    
    // Prepare content with title as first line
    const txtContent = `${cleanTitle}\n\n${cleanDescriptionText}`;
    const mdContent = `${videoTitle}\n\n${rawDescriptionText}`;

    // Write clean description to .txt file (for YouTube)
    await fs.writeFile(txtFilePath, txtContent, 'utf-8');
    
    // Write original markdown description to .md file (for Reddit, etc.)
    await fs.writeFile(mdFilePath, mdContent, 'utf-8');

    // Get file stats for the main .txt file
    const stats = await fs.stat(txtFilePath);

    console.log(`📝 Video description saved:`);
    console.log(`   📄 Clean version (YouTube): ${txtFilePath}`);
    console.log(`   📝 Markdown version (Reddit): ${mdFilePath}`);

    return {
      filePath: txtFilePath,
      filename: txtFilename,
      markdownFilePath: mdFilePath,
      markdownFilename: mdFilename,
      stats: {
        size: stats.size,
        created: stats.birthtime || stats.mtime
      }
    };

  } catch (error) {
    throw new Error(`Failed to write video description: ${error.message}`);
  }
};

/**
 * Reads video description from a text file
 * @param {string} filePath - Path to description file
 * @returns {Promise<string>} - Description content
 * @throws {Error} When file cannot be read
 */
export const readVideoDescription = async (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required');
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Description file not found: ${filePath}`);
    }
    throw new Error(`Failed to read description file: ${error.message}`);
  }
};

/**
 * Lists all description files in a directory
 * @param {string} outputDir - Directory to search for description files
 * @returns {Promise<Array>} - Array of description file information
 */
export const listDescriptionFiles = async (outputDir) => {
  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('Output directory is required');
  }

  try {
    const files = await fs.readdir(outputDir);
    const descriptionFiles = [];

    for (const file of files) {
      if (file.endsWith('.txt')) {
        const filePath = path.join(outputDir, file);
        try {
          const stats = await fs.stat(filePath);
          descriptionFiles.push({
            filename: file,
            filePath,
            size: stats.size,
            created: stats.birthtime || stats.mtime,
            modified: stats.mtime
          });
        } catch (statError) {
          // Skip files that can't be accessed
          console.warn(`⚠️ Could not access file stats for: ${file}`);
        }
      }
    }

    return descriptionFiles.sort((a, b) => b.created - a.created); // Sort by creation date, newest first
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Output directory not found: ${outputDir}`);
    }
    throw new Error(`Failed to list description files: ${error.message}`);
  }
};

/**
 * Deletes a description file
 * @param {string} filePath - Path to description file to delete
 * @returns {Promise<boolean>} - True if file was deleted successfully
 */
export const deleteDescriptionFile = async (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required');
  }

  try {
    await fs.unlink(filePath);
    console.log(`🗑️ Description file deleted: ${filePath}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Description file not found: ${filePath}`);
    }
    throw new Error(`Failed to delete description file: ${error.message}`);
  }
};