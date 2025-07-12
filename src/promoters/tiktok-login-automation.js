/**
 * TikTok Login Automation
 * Based on TikTok login flow patterns
 */

export class TikTokLoginAutomation {
  constructor(page) {
    this.page = page;
  }

  /**
   * Automated login to TikTok
   */
  async login(credentials) {
    try {
      console.log('🔐 Starting automated TikTok login...');
      
      // Navigate to TikTok login page
      await this.page.goto('https://www.tiktok.com/login', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.page.waitForTimeout(3000);

      // Handle login method selection
      await this.selectLoginMethod();

      // Step 1: Enter email/username
      console.log('📧 Entering email/username...');
      const emailSelectors = [
        'input[name="username"]',
        'input[placeholder*="email"]',
        'input[placeholder*="username"]',
        'input[type="email"]',
        'input[data-e2e="email-input"]',
        'input[data-e2e="username-input"]'
      ];

      let emailInput = null;
      for (const selector of emailSelectors) {
        try {
          emailInput = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (emailInput) break;
        } catch (error) {
          continue;
        }
      }

      if (!emailInput) {
        throw new Error('Could not find email/username input field');
      }

      await emailInput.click();
      await this.page.waitForTimeout(1000);
      await emailInput.type(credentials.email || credentials.username, { delay: 100 });
      await this.page.waitForTimeout(1000);

      // Step 2: Enter password
      console.log('🔒 Entering password...');
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[placeholder*="password"]',
        'input[data-e2e="password-input"]'
      ];

      let passwordInput = null;
      for (const selector of passwordSelectors) {
        try {
          passwordInput = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (passwordInput) break;
        } catch (error) {
          continue;
        }
      }

      if (!passwordInput) {
        throw new Error('Could not find password input field');
      }

      await passwordInput.click();
      await this.page.waitForTimeout(1000);
      await passwordInput.type(credentials.password, { delay: 100 });
      await this.page.waitForTimeout(1000);

      // Step 3: Click login button
      console.log('🚀 Clicking Login...');
      const loginSelectors = [
        'button[data-e2e="login-button"]',
        'button[type="submit"]',
        'button:has-text("Log in")',
        'div[data-e2e="login-button"]',
        'input[type="submit"]'
      ];

      let loginButton = null;
      for (const selector of loginSelectors) {
        try {
          loginButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (loginButton) break;
        } catch (error) {
          continue;
        }
      }

      if (loginButton) {
        await loginButton.click();
        await this.page.waitForTimeout(5000);
      }

      // Handle potential captcha or verification
      await this.handleVerification(credentials);

      // Verify login success
      const isLoggedIn = await this.verifyLogin();
      if (isLoggedIn) {
        console.log('✅ TikTok login successful');
        return { success: true };
      } else {
        throw new Error('Login verification failed');
      }

    } catch (error) {
      console.error('❌ TikTok login failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Select login method (email/phone)
   */
  async selectLoginMethod() {
    try {
      // Look for email/phone login option
      const emailLoginSelectors = [
        '[data-e2e="email-login"]',
        'a[href*="email"]',
        'button:has-text("Use email")',
        'div:has-text("Use email")'
      ];

      for (const selector of emailLoginSelectors) {
        try {
          const emailOption = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (emailOption) {
            await emailOption.click();
            await this.page.waitForTimeout(2000);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.warn('Could not select login method:', error.message);
    }
  }

  /**
   * Handle verification steps (captcha, 2FA, etc.)
   */
  async handleVerification(credentials) {
    try {
      // Check for captcha
      const captchaSelectors = [
        '.captcha',
        '[data-e2e="captcha"]',
        'iframe[src*="captcha"]',
        '.verification-code'
      ];

      for (const selector of captchaSelectors) {
        try {
          const captchaElement = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (captchaElement) {
            console.log('🤖 Captcha detected - manual intervention may be required');
            await this.page.waitForTimeout(10000); // Wait for manual captcha solving
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Check for 2FA/verification code
      const verificationSelectors = [
        'input[placeholder*="verification"]',
        'input[placeholder*="code"]',
        'input[data-e2e="verification-code"]',
        'input[name="verificationCode"]'
      ];

      for (const selector of verificationSelectors) {
        try {
          const verificationInput = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (verificationInput && credentials.verificationCode) {
            console.log('📱 Entering verification code...');
            await verificationInput.type(credentials.verificationCode, { delay: 100 });
            
            const submitButton = await this.page.waitForSelector('button[type="submit"]', { timeout: 3000 });
            if (submitButton) {
              await submitButton.click();
              await this.page.waitForTimeout(3000);
            }
            break;
          }
        } catch (error) {
          continue;
        }
      }

    } catch (error) {
      console.warn('Verification handling failed:', error.message);
    }
  }

  /**
   * Verify successful login
   */
  async verifyLogin() {
    const loginIndicators = [
      '[data-e2e="profile-icon"]',
      '[data-e2e="upload-icon"]',
      '.avatar',
      '[data-e2e="nav-upload"]',
      'a[href*="/upload"]'
    ];

    for (const selector of loginIndicators) {
      try {
        await this.page.waitForSelector(selector, { timeout: 5000 });
        return true;
      } catch (error) {
        continue;
      }
    }

    return false;
  }

  /**
   * Upload video to TikTok
   */
  async uploadVideo(content, videoPath) {
    try {
      console.log('📹 Uploading video to TikTok...');

      // Navigate to upload page
      await this.page.goto('https://www.tiktok.com/upload', {
        waitUntil: 'networkidle2'
      });
      await this.page.waitForTimeout(3000);

      // Upload video file
      console.log('📁 Selecting video file...');
      const fileInputSelectors = [
        'input[type="file"]',
        'input[accept*="video"]',
        '[data-e2e="upload-btn"] input',
        'input[name="upload"]'
      ];

      let fileInput = null;
      for (const selector of fileInputSelectors) {
        try {
          fileInput = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (fileInput) break;
        } catch (error) {
          continue;
        }
      }

      if (!fileInput) {
        throw new Error('Could not find file upload input');
      }

      await fileInput.uploadFile(videoPath);
      await this.page.waitForTimeout(10000); // Wait for video processing

      // Add caption/description
      console.log('📝 Adding caption...');
      const captionSelectors = [
        '[data-e2e="video-caption"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="caption"]',
        'div[data-contents="true"]'
      ];

      let captionInput = null;
      for (const selector of captionSelectors) {
        try {
          captionInput = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (captionInput) break;
        } catch (error) {
          continue;
        }
      }

      if (captionInput) {
        await captionInput.click();
        await this.page.waitForTimeout(1000);
        await captionInput.type(content.caption, { delay: 50 });
      }

      // Set privacy settings (if needed)
      await this.setPrivacySettings();

      // Post the video
      console.log('🚀 Publishing video...');
      const postSelectors = [
        '[data-e2e="post-btn"]',
        'button:has-text("Post")',
        'button[type="submit"]',
        '.btn-post'
      ];

      let postButton = null;
      for (const selector of postSelectors) {
        try {
          postButton = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (postButton) break;
        } catch (error) {
          continue;
        }
      }

      if (!postButton) {
        throw new Error('Could not find post button');
      }

      await postButton.click();
      await this.page.waitForTimeout(10000);

      // Verify upload success
      const currentUrl = this.page.url();
      if (currentUrl.includes('tiktok.com/@') || currentUrl.includes('success')) {
        console.log('✅ Video uploaded successfully');
        return { success: true, videoUrl: currentUrl };
      } else {
        throw new Error('Video upload verification failed');
      }

    } catch (error) {
      console.error('❌ Failed to upload video:', error.message);
      throw error;
    }
  }

  /**
   * Set privacy settings for the video
   */
  async setPrivacySettings() {
    try {
      // Look for privacy/visibility settings
      const privacySelectors = [
        '[data-e2e="privacy-setting"]',
        'input[value="public"]',
        'button:has-text("Public")',
        '.privacy-option'
      ];

      for (const selector of privacySelectors) {
        try {
          const privacyOption = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (privacyOption) {
            await privacyOption.click();
            break;
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.warn('Could not set privacy settings:', error.message);
    }
  }
}