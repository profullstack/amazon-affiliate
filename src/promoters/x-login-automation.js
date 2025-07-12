/**
 * X.com Login Automation
 * Based on recorded login flow patterns
 */

export class XLoginAutomation {
  constructor(page) {
    this.page = page;
  }

  /**
   * Automated login to X.com
   */
  async login(credentials) {
    try {
      console.log('🔐 Starting automated X.com login...');
      
      // Navigate to X.com login page
      await this.page.goto('https://x.com/i/flow/login', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      await this.page.waitForTimeout(3000);

      // Step 1: Enter username/email
      console.log('📧 Entering username/email...');
      const usernameSelectors = [
        'input[name="text"]',
        'input[autocomplete="username"]',
        'input[data-testid="ocfEnterTextTextInput"]',
        'input[placeholder*="email"]',
        'input[placeholder*="username"]'
      ];

      let usernameInput = null;
      for (const selector of usernameSelectors) {
        try {
          usernameInput = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (usernameInput) break;
        } catch (error) {
          continue;
        }
      }

      if (!usernameInput) {
        throw new Error('Could not find username input field');
      }

      await usernameInput.click();
      await this.page.waitForTimeout(1000);
      await usernameInput.type(credentials.username, { delay: 100 });
      await this.page.waitForTimeout(1000);

      // Click Next button
      console.log('➡️ Clicking Next...');
      const nextSelectors = [
        '[data-testid="LoginForm_Login_Button"]',
        'div[role="button"]:has-text("Next")',
        'button:has-text("Next")',
        '[data-testid="ocfEnterTextNextButton"]'
      ];

      let nextButton = null;
      for (const selector of nextSelectors) {
        try {
          nextButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (nextButton) break;
        } catch (error) {
          continue;
        }
      }

      if (nextButton) {
        await nextButton.click();
        await this.page.waitForTimeout(3000);
      }

      // Step 2: Enter password
      console.log('🔒 Entering password...');
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[autocomplete="current-password"]',
        'input[data-testid="ocfEnterTextTextInput"]'
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

      // Click Login button
      console.log('🚀 Clicking Login...');
      const loginSelectors = [
        '[data-testid="LoginForm_Login_Button"]',
        'div[role="button"]:has-text("Log in")',
        'button:has-text("Log in")',
        '[data-testid="ocfEnterTextNextButton"]'
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

      // Handle potential 2FA or additional verification
      await this.handleAdditionalVerification(credentials);

      // Verify login success
      const isLoggedIn = await this.verifyLogin();
      if (isLoggedIn) {
        console.log('✅ X.com login successful');
        return { success: true };
      } else {
        throw new Error('Login verification failed');
      }

    } catch (error) {
      console.error('❌ X.com login failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle additional verification steps (2FA, phone verification, etc.)
   */
  async handleAdditionalVerification(credentials) {
    try {
      // Check for 2FA code input
      const twoFASelectors = [
        'input[data-testid="ocfEnterTextTextInput"]',
        'input[placeholder*="code"]',
        'input[placeholder*="verification"]'
      ];

      for (const selector of twoFASelectors) {
        try {
          const twoFAInput = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (twoFAInput && credentials.twoFactorCode) {
            console.log('🔐 Entering 2FA code...');
            await twoFAInput.type(credentials.twoFactorCode, { delay: 100 });
            
            // Click verify button
            const verifyButton = await this.page.waitForSelector('[data-testid="ocfEnterTextNextButton"]', { timeout: 3000 });
            if (verifyButton) {
              await verifyButton.click();
              await this.page.waitForTimeout(3000);
            }
            break;
          }
        } catch (error) {
          continue;
        }
      }

      // Check for phone verification
      const phoneSelectors = [
        'input[placeholder*="phone"]',
        'input[data-testid="ocfEnterTextTextInput"]'
      ];

      for (const selector of phoneSelectors) {
        try {
          const phoneInput = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (phoneInput && credentials.phoneNumber) {
            console.log('📱 Entering phone number...');
            await phoneInput.type(credentials.phoneNumber, { delay: 100 });
            
            const nextButton = await this.page.waitForSelector('[data-testid="ocfEnterTextNextButton"]', { timeout: 3000 });
            if (nextButton) {
              await nextButton.click();
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
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[data-testid="AppTabBar_Profile_Link"]',
      '[aria-label="Profile"]',
      '[data-testid="primaryColumn"]',
      '[data-testid="tweet"]'
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
   * Post a tweet
   */
  async postTweet(content) {
    try {
      console.log('📝 Posting tweet to X.com...');

      // Find compose tweet button
      const composeSelectors = [
        '[data-testid="SidNav_NewTweet_Button"]',
        '[aria-label="Post"]',
        '[data-testid="tweetButtonInline"]',
        'a[href="/compose/tweet"]',
        '[data-testid="toolBar"] [role="button"]'
      ];

      let composeButton = null;
      for (const selector of composeSelectors) {
        try {
          composeButton = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (composeButton) break;
        } catch (error) {
          continue;
        }
      }

      if (!composeButton) {
        throw new Error('Could not find compose tweet button');
      }

      await composeButton.click();
      await this.page.waitForTimeout(2000);

      // Find tweet text area
      const textAreaSelectors = [
        '[data-testid="tweetTextarea_0"]',
        '[aria-label="Post text"]',
        '[placeholder*="happening"]',
        '.public-DraftEditor-content',
        '[contenteditable="true"]'
      ];

      let textArea = null;
      for (const selector of textAreaSelectors) {
        try {
          textArea = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (textArea) break;
        } catch (error) {
          continue;
        }
      }

      if (!textArea) {
        throw new Error('Could not find tweet text area');
      }

      // Type the content
      await textArea.click();
      await this.page.waitForTimeout(1000);
      await textArea.type(content, { delay: 50 });
      await this.page.waitForTimeout(2000);

      // Find and click post button
      const postSelectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        '[aria-label="Post"]',
        'div[role="button"]:has-text("Post")'
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
      await this.page.waitForTimeout(3000);

      // Verify post was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('/status/') || currentUrl.includes('x.com')) {
        console.log('✅ Tweet posted successfully');
        return { success: true, postUrl: currentUrl };
      } else {
        throw new Error('Tweet posting verification failed');
      }

    } catch (error) {
      console.error('❌ Failed to post tweet:', error.message);
      throw error;
    }
  }
}