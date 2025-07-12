/**
 * Pinterest Login Automation
 * Based on Pinterest login flow patterns
 */

export class PinterestLoginAutomation {
  constructor(page) {
    this.page = page;
  }

  /**
   * Automated login to Pinterest
   */
  async login(credentials) {
    try {
      console.log('🔐 Starting automated Pinterest login...');
      
      // Navigate to Pinterest login page
      await this.page.goto('https://www.pinterest.com/login/', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.page.waitForTimeout(3000);

      // Step 1: Enter email
      console.log('📧 Entering email...');
      const emailSelectors = [
        'input[id="email"]',
        'input[name="id"]',
        'input[type="email"]',
        'input[placeholder*="email"]',
        'input[data-test-id="email"]'
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
        throw new Error('Could not find email input field');
      }

      await emailInput.click();
      await this.page.waitForTimeout(1000);
      await emailInput.type(credentials.email, { delay: 100 });
      await this.page.waitForTimeout(1000);

      // Step 2: Enter password
      console.log('🔒 Entering password...');
      const passwordSelectors = [
        'input[id="password"]',
        'input[name="password"]',
        'input[type="password"]',
        'input[data-test-id="password"]'
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
        'button[data-test-id="registerFormSubmitButton"]',
        'button[type="submit"]',
        'div[data-test-id="login-button"]',
        'button:has-text("Log in")',
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

      // Handle potential additional verification
      await this.handleAdditionalVerification(credentials);

      // Verify login success
      const isLoggedIn = await this.verifyLogin();
      if (isLoggedIn) {
        console.log('✅ Pinterest login successful');
        return { success: true };
      } else {
        throw new Error('Login verification failed');
      }

    } catch (error) {
      console.error('❌ Pinterest login failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle additional verification steps
   */
  async handleAdditionalVerification(credentials) {
    try {
      // Check for email verification
      const emailVerificationSelectors = [
        'input[placeholder*="verification"]',
        'input[placeholder*="code"]',
        'input[data-test-id="verification-code"]'
      ];

      for (const selector of emailVerificationSelectors) {
        try {
          const verificationInput = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (verificationInput && credentials.verificationCode) {
            console.log('📧 Entering verification code...');
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
      console.warn('Additional verification handling failed:', error.message);
    }
  }

  /**
   * Verify successful login
   */
  async verifyLogin() {
    const loginIndicators = [
      '[data-test-id="header-profile"]',
      '[aria-label="Profile"]',
      '.profileImage',
      '[data-test-id="user-menu"]',
      '[data-test-id="create-pin-button"]'
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
   * Create a pin
   */
  async createPin(content, imagePath) {
    try {
      console.log('📌 Creating Pinterest pin...');

      // Navigate to create pin page
      await this.page.goto('https://www.pinterest.com/pin-creation-tool/', {
        waitUntil: 'networkidle2'
      });
      await this.page.waitForTimeout(3000);

      // Upload image
      console.log('🖼️ Uploading image...');
      const fileInputSelectors = [
        'input[type="file"]',
        'input[accept*="image"]',
        '[data-test-id="media-upload-input"]'
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

      await fileInput.uploadFile(imagePath);
      await this.page.waitForTimeout(5000);

      // Add title
      console.log('📝 Adding pin title...');
      const titleSelectors = [
        '[data-test-id="pin-draft-title"]',
        'input[placeholder*="title"]',
        'textarea[placeholder*="title"]'
      ];

      let titleInput = null;
      for (const selector of titleSelectors) {
        try {
          titleInput = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (titleInput) break;
        } catch (error) {
          continue;
        }
      }

      if (titleInput) {
        await titleInput.click();
        await this.page.waitForTimeout(1000);
        await titleInput.type(content.title, { delay: 50 });
      }

      // Add description
      console.log('📄 Adding pin description...');
      const descriptionSelectors = [
        '[data-test-id="pin-draft-description"]',
        'textarea[placeholder*="description"]',
        'div[contenteditable="true"]'
      ];

      let descriptionInput = null;
      for (const selector of descriptionSelectors) {
        try {
          descriptionInput = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (descriptionInput) break;
        } catch (error) {
          continue;
        }
      }

      if (descriptionInput) {
        await descriptionInput.click();
        await this.page.waitForTimeout(1000);
        await descriptionInput.type(content.description, { delay: 50 });
      }

      // Add destination link
      if (content.url) {
        console.log('🔗 Adding destination link...');
        const linkSelectors = [
          '[data-test-id="pin-draft-link"]',
          'input[placeholder*="link"]',
          'input[placeholder*="website"]'
        ];

        let linkInput = null;
        for (const selector of linkSelectors) {
          try {
            linkInput = await this.page.waitForSelector(selector, { timeout: 3000 });
            if (linkInput) break;
          } catch (error) {
            continue;
          }
        }

        if (linkInput) {
          await linkInput.click();
          await this.page.waitForTimeout(1000);
          await linkInput.type(content.url, { delay: 50 });
        }
      }

      // Select board
      console.log('📋 Selecting board...');
      const boardSelectors = [
        '[data-test-id="board-dropdown"]',
        '[data-test-id="pin-draft-board"]',
        'button[aria-label*="board"]'
      ];

      let boardSelector = null;
      for (const selector of boardSelectors) {
        try {
          boardSelector = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (boardSelector) break;
        } catch (error) {
          continue;
        }
      }

      if (boardSelector) {
        await boardSelector.click();
        await this.page.waitForTimeout(2000);
        
        // Select first available board or create new one
        const boardOptions = await this.page.$$('[data-test-id="board-row"]');
        if (boardOptions.length > 0) {
          await boardOptions[0].click();
        }
      }

      // Publish pin
      console.log('🚀 Publishing pin...');
      const publishSelectors = [
        '[data-test-id="pin-draft-publish-button"]',
        'button:has-text("Publish")',
        'button[type="submit"]'
      ];

      let publishButton = null;
      for (const selector of publishSelectors) {
        try {
          publishButton = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (publishButton) break;
        } catch (error) {
          continue;
        }
      }

      if (!publishButton) {
        throw new Error('Could not find publish button');
      }

      await publishButton.click();
      await this.page.waitForTimeout(5000);

      // Verify pin was created
      const currentUrl = this.page.url();
      if (currentUrl.includes('pinterest.com/pin/') || currentUrl.includes('created')) {
        console.log('✅ Pin created successfully');
        return { success: true, pinUrl: currentUrl };
      } else {
        throw new Error('Pin creation verification failed');
      }

    } catch (error) {
      console.error('❌ Failed to create pin:', error.message);
      throw error;
    }
  }
}