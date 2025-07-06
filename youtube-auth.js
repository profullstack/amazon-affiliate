import 'dotenv/config';
import { google } from 'googleapis';
import http from 'http';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * YouTube OAuth2 Authentication Script
 * 
 * This script handles the complete OAuth2 flow for YouTube API access:
 * 1. Opens browser for user authentication
 * 2. Handles the callback with authorization code
 * 3. Exchanges code for access and refresh tokens
 * 4. Updates .env file with new tokens
 * 5. Tests the authentication
 */

// OAuth2 configuration
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube'
];

const REDIRECT_URI = 'http://localhost:8080/oauth2callback';
const PORT = 8080;

/**
 * Validates required environment variables
 */
const validateEnvironment = () => {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = process.env;
  
  if (!YOUTUBE_CLIENT_ID) {
    throw new Error('YOUTUBE_CLIENT_ID is required in .env file');
  }
  
  if (!YOUTUBE_CLIENT_SECRET) {
    throw new Error('YOUTUBE_CLIENT_SECRET is required in .env file');
  }
  
  return { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET };
};

/**
 * Creates OAuth2 client
 */
const createOAuth2Client = (credentials) => {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = credentials;
  
  return new google.auth.OAuth2(
    YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET,
    REDIRECT_URI
  );
};

/**
 * Opens URL in default browser
 */
const openBrowser = async (url) => {
  const platform = process.platform;
  let command;
  
  switch (platform) {
    case 'darwin': // macOS
      command = `open "${url}"`;
      break;
    case 'win32': // Windows
      command = `start "${url}"`;
      break;
    default: // Linux and others
      command = `xdg-open "${url}"`;
      break;
  }
  
  try {
    await execAsync(command);
    console.log('✅ Browser opened successfully');
  } catch (error) {
    console.warn('⚠️  Could not open browser automatically');
    console.log(`Please manually open this URL: ${url}`);
  }
};

/**
 * Starts local server to handle OAuth callback
 */
const startCallbackServer = (oauth2Client) => {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      
      if (url.pathname === '/oauth2callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>❌ Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>❌ No Authorization Code</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }
        
        try {
          // Exchange code for tokens
          const { tokens } = await oauth2Client.getToken(code);
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>✅ Authentication Successful!</h1>
                <p>You have successfully authenticated with YouTube.</p>
                <p>Your tokens have been saved. You can close this window.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);
          
          server.close();
          resolve(tokens);
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body>
                <h1>❌ Token Exchange Failed</h1>
                <p>Error: ${error.message}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(error);
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
    
    server.listen(PORT, () => {
      console.log(`🌐 Callback server started on http://localhost:${PORT}`);
    });
    
    server.on('error', (error) => {
      reject(new Error(`Server error: ${error.message}`));
    });
  });
};

/**
 * Updates .env file with new tokens
 */
const updateEnvFile = async (tokens) => {
  try {
    // Read current .env file
    let envContent = '';
    try {
      envContent = await fs.readFile('.env', 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, will create new one
    }
    
    // Parse existing environment variables
    const envVars = {};
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    
    // Update tokens
    envVars.YOUTUBE_OAUTH2_ACCESS_TOKEN = tokens.access_token;
    if (tokens.refresh_token) {
      envVars.YOUTUBE_OAUTH2_REFRESH_TOKEN = tokens.refresh_token;
    }
    
    // Add expiry information as comment
    const expiryDate = new Date(Date.now() + (tokens.expiry_date || 3600000));
    envVars['# YOUTUBE_TOKEN_EXPIRES'] = expiryDate.toISOString();
    
    // Rebuild .env content
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => {
        if (key.startsWith('#')) {
          return `${key}=${value}`;
        }
        return `${key}=${value}`;
      })
      .join('\n');
    
    // Write updated .env file
    await fs.writeFile('.env', newEnvContent);
    
    console.log('✅ .env file updated with new tokens');
    console.log(`📅 Tokens expire: ${expiryDate.toLocaleString()}`);
    
  } catch (error) {
    throw new Error(`Failed to update .env file: ${error.message}`);
  }
};

/**
 * Tests the authentication by making a simple API call
 */
const testAuthentication = async (oauth2Client) => {
  try {
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const response = await youtube.channels.list({
      part: 'snippet,statistics',
      mine: true
    });
    
    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      console.log('✅ Authentication test successful!');
      console.log(`📺 Channel: ${channel.snippet.title}`);
      console.log(`👥 Subscribers: ${channel.statistics.subscriberCount || 'Hidden'}`);
      console.log(`🎬 Videos: ${channel.statistics.videoCount || '0'}`);
      return true;
    } else {
      console.warn('⚠️  No channel data found');
      return false;
    }
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    return false;
  }
};

/**
 * Main authentication flow
 */
const authenticateYouTube = async () => {
  console.log('🔐 YouTube OAuth2 Authentication');
  console.log('================================\n');
  
  try {
    // Validate environment
    console.log('1️⃣  Validating environment variables...');
    const credentials = validateEnvironment();
    console.log('✅ Environment variables validated\n');
    
    // Create OAuth2 client
    console.log('2️⃣  Creating OAuth2 client...');
    const oauth2Client = createOAuth2Client(credentials);
    console.log('✅ OAuth2 client created\n');
    
    // Generate authorization URL
    console.log('3️⃣  Generating authorization URL...');
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent' // Force consent to get refresh token
    });
    console.log('✅ Authorization URL generated\n');
    
    // Start callback server
    console.log('4️⃣  Starting callback server...');
    const tokenPromise = startCallbackServer(oauth2Client);
    console.log('✅ Callback server started\n');
    
    // Open browser
    console.log('5️⃣  Opening browser for authentication...');
    console.log('🌐 Please complete the authentication in your browser');
    console.log('📋 If browser doesn\'t open, use this URL:');
    console.log(`   ${authUrl}\n`);
    
    await openBrowser(authUrl);
    
    // Wait for tokens
    console.log('6️⃣  Waiting for authentication...');
    const tokens = await tokenPromise;
    console.log('✅ Tokens received\n');
    
    // Set credentials
    oauth2Client.setCredentials(tokens);
    
    // Update .env file
    console.log('7️⃣  Updating .env file...');
    await updateEnvFile(tokens);
    console.log('✅ .env file updated\n');
    
    // Test authentication
    console.log('8️⃣  Testing authentication...');
    const testResult = await testAuthentication(oauth2Client);
    
    if (testResult) {
      console.log('\n🎉 YouTube authentication completed successfully!');
      console.log('🚀 You can now upload videos to YouTube');
      console.log('\n💡 Next steps:');
      console.log('   • Run your video creation script');
      console.log('   • Videos will now upload to YouTube automatically');
      console.log('   • Tokens will be refreshed automatically when needed');
    } else {
      console.log('\n⚠️  Authentication completed but test failed');
      console.log('🔧 You may need to check your YouTube channel settings');
    }
    
  } catch (error) {
    console.error('\n❌ Authentication failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Check your YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET');
    console.log('   • Ensure your OAuth2 app is configured correctly');
    console.log('   • Make sure YouTube Data API v3 is enabled');
    console.log('   • Try running the script again');
    process.exit(1);
  }
};

// Run authentication if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  authenticateYouTube().catch(console.error);
}

export { authenticateYouTube };