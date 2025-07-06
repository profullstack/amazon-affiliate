# YouTube API Setup Guide

This guide will walk you through obtaining the required YouTube API credentials for the Amazon Affiliate Video Automation application.

## 📋 Required Credentials

You need these three values for your `.env` file:
- `YOUTUBE_CLIENT_ID` - OAuth 2.0 Client ID
- `YOUTUBE_CLIENT_SECRET` - OAuth 2.0 Client Secret  
- `YOUTUBE_OAUTH2_ACCESS_TOKEN` - Access Token for API calls

## 🚀 Step-by-Step Setup

### Step 1: Create a Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create a New Project**
   - Click "Select a project" dropdown at the top
   - Click "NEW PROJECT"
   - Enter project name: `amazon-affiliate-videos` (or your preferred name)
   - Click "CREATE"

3. **Select Your Project**
   - Make sure your new project is selected in the dropdown

### Step 2: Enable YouTube Data API v3

1. **Navigate to APIs & Services**
   - In the left sidebar, click "APIs & Services" → "Library"

2. **Search for YouTube API**
   - In the search box, type "YouTube Data API v3"
   - Click on "YouTube Data API v3" from the results

3. **Enable the API**
   - Click the "ENABLE" button
   - Wait for the API to be enabled

### Step 3: Create OAuth 2.0 Credentials

**⚠️ Important Note**: Google Cloud Console interface may vary slightly depending on when you access it. The core steps remain the same, but some button labels or layouts might differ.

1. **Go to Credentials Page**
   - In the left sidebar, click "APIs & Services" → "Credentials"

2. **Configure OAuth Consent Screen** (if not done already)
   - Click "OAuth consent screen" tab
   - Choose "External" user type (unless you have a Google Workspace account)
   - Click "CREATE"
   - Fill in required fields on the "OAuth consent screen" page:
     - **App name**: `Amazon Affiliate Video Automation`
     - **User support email**: Select your email from dropdown
     - **App logo**: (Optional) Upload a logo if you have one
     - **App domain**: (Optional) Leave blank for now
     - **Authorized domains**: (Optional) Leave blank for now
     - **Developer contact information**: Enter your email address
   - Click "SAVE AND CONTINUE"
   
   - On the "Scopes" page:
     - Click "ADD OR REMOVE SCOPES"
     - Search for and add these scopes:
       - `../auth/youtube.upload`
       - `../auth/youtube`
     - Click "UPDATE" then "SAVE AND CONTINUE"
   
   - On the "Test users" page:
     - Click "ADD USERS"
     - Add your email address (the one you'll use to upload videos)
     - Click "SAVE AND CONTINUE"
   
   - On the "Summary" page:
     - Review your settings
     - Click "BACK TO DASHBOARD"

3. **Create OAuth 2.0 Client ID**
   - Go back to "Credentials" tab
   - Click "CREATE CREDENTIALS" → "OAuth 2.0 Client IDs"
   - Application type: "Web application" (NOT Desktop application)
   - Name: `Amazon Affiliate Video App`
   - Under "Authorized redirect URIs", click "ADD URI"
   - Add this exact URI: `https://developers.google.com/oauthplayground`
   - Click "CREATE"

4. **Save Your Credentials**
   - A popup will show your credentials:
     - **Client ID**: Copy this value (starts with something like `123456789-abc...googleusercontent.com`)
     - **Client Secret**: Copy this value (looks like `GOCSPX-...`)
   - Click "DOWNLOAD JSON" to save the credentials file
   - Click "OK"

### Step 4: Get Access Token

Now you need to get an access token that allows your app to upload videos to YouTube.

#### Option A: Using Google OAuth 2.0 Playground (Recommended)

**⚠️ IMPORTANT**: Make sure you created a "Web application" OAuth client (not "Desktop application") with the redirect URI `https://developers.google.com/oauthplayground` or you'll get a `redirect_uri_mismatch` error.

1. **Go to OAuth 2.0 Playground**
   - Visit: https://developers.google.com/oauthplayground/

2. **Configure the Playground**
   - Click the gear icon (⚙️) in the top right
   - Check "Use your own OAuth credentials"
   - Enter your Client ID and Client Secret from Step 3
   - Close the configuration

3. **Authorize APIs**
   - In the left panel, find "YouTube Data API v3"
   - Expand it and select:
     - `https://www.googleapis.com/auth/youtube.upload`
     - `https://www.googleapis.com/auth/youtube`
   - Click "Authorize APIs"

4. **Sign In and Authorize**
   - Sign in with the Google account you want to upload videos to
   - Click "Allow" to grant permissions

5. **Exchange Authorization Code**
   - You'll be redirected back to the playground
   - Click "Exchange authorization code for tokens"
   - Copy the **Access token** value

#### Option B: Using the Downloaded JSON File (Advanced)

If you prefer to use the downloaded credentials file:

1. **Install Google Auth Library**
   ```bash
   pnpm add googleapis
   ```

2. **Create a Setup Script**
   ```javascript
   // setup-youtube-auth.js
   import { google } from 'googleapis';
   import fs from 'fs';
   import readline from 'readline';

   const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
   const TOKEN_PATH = 'token.json';
   const CREDENTIALS_PATH = 'credentials.json'; // Your downloaded file

   // Load credentials and authorize
   const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
   const { client_secret, client_id, redirect_uris } = credentials.installed;
   const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

   const authUrl = oAuth2Client.generateAuthUrl({
     access_type: 'offline',
     scope: SCOPES,
   });

   console.log('Authorize this app by visiting this url:', authUrl);
   
   const rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
   });

   rl.question('Enter the code from that page here: ', (code) => {
     rl.close();
     oAuth2Client.getToken(code, (err, token) => {
       if (err) return console.error('Error retrieving access token', err);
       console.log('Access Token:', token.access_token);
       fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
     });
   });
   ```

### Step 5: Update Your .env File

Add the credentials to your `.env` file:

```env
# YouTube API Configuration
YOUTUBE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
YOUTUBE_OAUTH2_ACCESS_TOKEN=ya29.a0AfH6SMC...your-access-token-here
```

## 🔧 Testing Your Setup

Create a simple test script to verify your credentials work:

```javascript
// test-youtube-auth.js
import { google } from 'googleapis';
import 'dotenv/config';

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  access_token: process.env.YOUTUBE_OAUTH2_ACCESS_TOKEN
});

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client
});

// Test by getting channel info
youtube.channels.list({
  part: 'snippet',
  mine: true
}).then(response => {
  console.log('✅ YouTube API connection successful!');
  console.log('Channel:', response.data.items[0].snippet.title);
}).catch(error => {
  console.error('❌ YouTube API connection failed:', error.message);
});
```

Run the test:
```bash
node test-youtube-auth.js
```

## 🚨 Important Notes

### Token Expiration
- Access tokens typically expire after 1 hour
- For production use, you should implement refresh token logic
- The playground method gives you a token that expires quickly

### Refresh Tokens (For Production)
If you need long-term access, you should:
1. Use `access_type: 'offline'` when generating the auth URL
2. Store and use the `refresh_token` to get new access tokens
3. Implement automatic token refresh in your application

### Quota Limits
- YouTube API has daily quota limits
- Default quota is 10,000 units per day
- Video uploads cost 1,600 units each
- Monitor your usage in the Google Cloud Console

### Security Best Practices
- Never commit your `.env` file to version control
- Keep your client secret secure
- Regularly rotate your credentials
- Use the principle of least privilege for scopes

## 🔗 Useful Links

- [Google Cloud Console](https://console.cloud.google.com/)
- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Google APIs Node.js Client](https://github.com/googleapis/google-api-nodejs-client)

## 🆘 Troubleshooting

### Common Issues

**"Access blocked: This app's request is invalid"**
- Make sure you've configured the OAuth consent screen completely
- Verify you've added the required scopes (`../auth/youtube.upload` and `../auth/youtube`)
- Add your email as a test user in the OAuth consent screen
- Ensure the redirect URI in OAuth playground matches your OAuth client settings

**"Invalid client: no application name"**
- Complete the OAuth consent screen configuration
- Fill in all required fields including app name and user support email
- Make sure you clicked "SAVE AND CONTINUE" on each step

**"This app isn't verified"**
- This is normal for test applications
- Click "Advanced" then "Go to [App Name] (unsafe)" to proceed
- For production use, you'll need to submit for verification

**"The request is missing a valid API key"**
- Make sure the YouTube Data API v3 is enabled in your project
- Check that you're using the correct project in Google Cloud Console
- Verify the API is enabled under "APIs & Services" → "Enabled APIs"

**"Access token expired"**
- Access tokens typically expire after 1 hour
- Get a new access token from the OAuth playground
- For production, implement refresh token logic

**"Scope not found" or "Invalid scope"**
- Double-check the scopes in OAuth consent screen configuration
- Ensure you added: `https://www.googleapis.com/auth/youtube.upload`
- Make sure there are no typos in the scope URLs

**"Error 400: redirect_uri_mismatch"**
- **Most Common Fix**: Change your OAuth client type from "Desktop application" to "Web application"
- Add `https://developers.google.com/oauthplayground` as an authorized redirect URI
- If you already created a Desktop application, delete it and create a new Web application
- Make sure the redirect URI exactly matches: `https://developers.google.com/oauthplayground`

**If you still get redirect_uri_mismatch:**
1. Go back to Google Cloud Console → APIs & Services → Credentials
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", ensure you have: `https://developers.google.com/oauthplayground`
4. Save the changes and wait a few minutes for propagation
5. Try the OAuth playground again

If you encounter other issues, check the Google Cloud Console logs and ensure all steps were completed correctly. The Google Cloud Console interface may change over time, but the core concepts remain the same.