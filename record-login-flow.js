import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

/**
 * Login Flow Recorder
 * Records user interactions during login to capture the sequence for automation
 */

class LoginFlowRecorder {
  constructor(platform) {
    this.platform = platform;
    this.browser = null;
    this.page = null;
    this.actions = [];
    this.startTime = Date.now();
    
    // Platform configurations
    this.platformConfigs = {
      'x': {
        name: 'X.com (Twitter)',
        url: 'https://x.com/login',
        loginUrl: 'https://x.com/i/flow/login'
      },
      'tiktok': {
        name: 'TikTok',
        url: 'https://www.tiktok.com/login',
        loginUrl: 'https://www.tiktok.com/login'
      },
      'pinterest': {
        name: 'Pinterest',
        url: 'https://www.pinterest.com/login',
        loginUrl: 'https://www.pinterest.com/login'
      }
    };
  }

  /**
   * Start recording the login flow
   */
  async startRecording() {
    const config = this.platformConfigs[this.platform];
    if (!config) {
      throw new Error(`Unsupported platform: ${this.platform}`);
    }

    console.log(`🎬 Starting login flow recording for ${config.name}`);
    console.log(`📍 Platform: ${this.platform}`);
    console.log(`🔗 URL: ${config.url}`);
    console.log('');

    // Launch browser in non-headless mode for manual interaction
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 720 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Set user agent to avoid detection
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Record page events
    this.setupEventListeners();

    // Navigate to login page
    console.log(`🌐 Navigating to ${config.url}...`);
    await this.page.goto(config.url, { waitUntil: 'networkidle2' });
    
    this.recordAction('navigate', { url: config.url });

    console.log('');
    console.log('📝 INSTRUCTIONS:');
    console.log('1. Manually perform the login process in the browser window');
    console.log('2. Click elements, type text, and complete the login');
    console.log('3. Once logged in successfully, press ENTER in this terminal');
    console.log('4. The recorder will capture all your interactions');
    console.log('');
    console.log('⚠️  NOTE: Your actual credentials will NOT be saved - only the interaction sequence');
    console.log('');

    // Wait for user to complete login
    await this.waitForUserCompletion();
  }

  /**
   * Setup event listeners to record user interactions
   */
  setupEventListeners() {
    // Record clicks
    this.page.on('click', (event) => {
      this.recordAction('click', {
        x: event.x,
        y: event.y,
        target: event.target
      });
    });

    // Record navigation
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) {
        this.recordAction('navigation', {
          url: frame.url()
        });
      }
    });

    // Inject client-side recording script
    this.page.evaluateOnNewDocument(() => {
      // Record clicks with element selectors
      document.addEventListener('click', (event) => {
        const element = event.target;
        const selector = getElementSelector(element);
        
        window.recordedActions = window.recordedActions || [];
        window.recordedActions.push({
          type: 'click',
          selector,
          timestamp: Date.now(),
          elementInfo: {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            textContent: element.textContent?.substring(0, 50)
          }
        });
      });

      // Record input events
      document.addEventListener('input', (event) => {
        const element = event.target;
        const selector = getElementSelector(element);
        
        window.recordedActions = window.recordedActions || [];
        window.recordedActions.push({
          type: 'input',
          selector,
          timestamp: Date.now(),
          inputType: element.type,
          placeholder: element.placeholder,
          value: element.value.replace(/./g, '*') // Mask actual input
        });
      });

      // Record form submissions
      document.addEventListener('submit', (event) => {
        const form = event.target;
        const selector = getElementSelector(form);
        
        window.recordedActions = window.recordedActions || [];
        window.recordedActions.push({
          type: 'submit',
          selector,
          timestamp: Date.now(),
          action: form.action,
          method: form.method
        });
      });

      // Helper function to generate CSS selector
      function getElementSelector(element) {
        if (element.id) {
          return `#${element.id}`;
        }
        
        if (element.className) {
          const classes = element.className.split(' ').filter(c => c.trim());
          if (classes.length > 0) {
            return `.${classes.join('.')}`;
          }
        }
        
        // Generate path-based selector
        const path = [];
        let current = element;
        
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let selector = current.nodeName.toLowerCase();
          
          if (current.id) {
            selector += `#${current.id}`;
            path.unshift(selector);
            break;
          }
          
          if (current.className) {
            const classes = current.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
              selector += `.${classes[0]}`;
            }
          }
          
          // Add nth-child if needed
          const siblings = Array.from(current.parentNode?.children || []);
          const sameTagSiblings = siblings.filter(s => s.nodeName === current.nodeName);
          if (sameTagSiblings.length > 1) {
            const index = sameTagSiblings.indexOf(current) + 1;
            selector += `:nth-child(${index})`;
          }
          
          path.unshift(selector);
          current = current.parentNode;
          
          if (path.length > 5) break; // Limit depth
        }
        
        return path.join(' > ');
      }
    });
  }

  /**
   * Record an action
   */
  recordAction(type, data) {
    const action = {
      type,
      timestamp: Date.now() - this.startTime,
      data,
      url: this.page.url()
    };
    
    this.actions.push(action);
    console.log(`📝 Recorded: ${type} - ${JSON.stringify(data).substring(0, 100)}...`);
  }

  /**
   * Wait for user to complete the login process
   */
  async waitForUserCompletion() {
    return new Promise(async (resolve) => {
      const { createInterface } = await import('readline');
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('⏳ Waiting for you to complete the login process...');
      console.log('Press ENTER when you have successfully logged in:');
      
      rl.question('', async () => {
        rl.close();
        
        // Capture final client-side actions
        const clientActions = await this.page.evaluate(() => {
          return window.recordedActions || [];
        });
        
        // Merge client-side actions with server-side actions
        this.actions.push(...clientActions.map(action => ({
          ...action,
          source: 'client'
        })));
        
        // Sort actions by timestamp
        this.actions.sort((a, b) => a.timestamp - b.timestamp);
        
        await this.saveRecording();
        await this.generateAutomationCode();
        
        resolve();
      });
    });
  }

  /**
   * Save the recorded actions to a file
   */
  async saveRecording() {
    const config = this.platformConfigs[this.platform];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `login-flow-${this.platform}-${timestamp}.json`;
    
    const recording = {
      platform: this.platform,
      platformName: config.name,
      recordedAt: new Date().toISOString(),
      startUrl: config.url,
      totalActions: this.actions.length,
      duration: Date.now() - this.startTime,
      actions: this.actions
    };

    // Ensure recordings directory exists
    await fs.mkdir('./recordings', { recursive: true });
    
    const filepath = path.join('./recordings', filename);
    await fs.writeFile(filepath, JSON.stringify(recording, null, 2));
    
    console.log('');
    console.log(`💾 Recording saved: ${filepath}`);
    console.log(`📊 Total actions recorded: ${this.actions.length}`);
    console.log(`⏱️  Total duration: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
  }

  /**
   * Generate automation code based on recorded actions
   */
  async generateAutomationCode() {
    const config = this.platformConfigs[this.platform];
    
    // Filter and analyze actions to create automation steps
    const clickActions = this.actions.filter(a => a.type === 'click' && a.data.selector);
    const inputActions = this.actions.filter(a => a.type === 'input');
    const navigationActions = this.actions.filter(a => a.type === 'navigation');
    
    const automationCode = `
/**
 * Auto-generated login automation for ${config.name}
 * Generated on: ${new Date().toISOString()}
 * Platform: ${this.platform}
 */

export async function autoLogin${this.platform.charAt(0).toUpperCase() + this.platform.slice(1)}(page, credentials) {
  try {
    console.log('🔐 Starting automated login for ${config.name}...');
    
    // Navigate to login page
    await page.goto('${config.url}', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    
    ${this.generateAutomationSteps(clickActions, inputActions, navigationActions)}
    
    // Wait for login completion
    await page.waitForTimeout(5000);
    
    // Verify login success
    const isLoggedIn = await verifyLogin(page);
    if (isLoggedIn) {
      console.log('✅ Login successful for ${config.name}');
      return { success: true };
    } else {
      throw new Error('Login verification failed');
    }
    
  } catch (error) {
    console.error('❌ Login failed for ${config.name}:', error.message);
    return { success: false, error: error.message };
  }
}

async function verifyLogin(page) {
  // Add platform-specific login verification logic here
  // This should check for elements that only appear when logged in
  ${this.generateLoginVerification()}
}
`;

    const filename = `auto-login-${this.platform}.js`;
    const filepath = path.join('./recordings', filename);
    await fs.writeFile(filepath, automationCode);
    
    console.log(`🤖 Automation code generated: ${filepath}`);
  }

  /**
   * Generate automation steps from recorded actions
   */
  generateAutomationSteps(clickActions, inputActions, navigationActions) {
    let steps = '';
    
    // Group actions by type and generate appropriate automation code
    const uniqueSelectors = [...new Set(clickActions.map(a => a.data.selector))];
    
    uniqueSelectors.forEach((selector, index) => {
      const action = clickActions.find(a => a.data.selector === selector);
      if (action) {
        steps += `
    // Step ${index + 1}: Click ${action.data.elementInfo?.textContent || 'element'}
    try {
      await page.waitForSelector('${selector}', { timeout: 10000 });
      await page.click('${selector}');
      await page.waitForTimeout(1000);
    } catch (error) {
      console.warn('Could not click ${selector}:', error.message);
    }
`;
      }
    });

    // Add input steps
    const uniqueInputs = [...new Set(inputActions.map(a => a.selector))];
    uniqueInputs.forEach((selector, index) => {
      const action = inputActions.find(a => a.selector === selector);
      if (action) {
        const fieldType = action.inputType === 'password' ? 'password' : 'username';
        steps += `
    // Input ${index + 1}: Enter ${fieldType}
    try {
      await page.waitForSelector('${selector}', { timeout: 10000 });
      await page.type('${selector}', credentials.${fieldType});
      await page.waitForTimeout(500);
    } catch (error) {
      console.warn('Could not type in ${selector}:', error.message);
    }
`;
      }
    });

    return steps;
  }

  /**
   * Generate login verification code
   */
  generateLoginVerification() {
    const verificationSelectors = {
      'x': [
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        '[data-testid="AppTabBar_Profile_Link"]',
        '[aria-label="Profile"]'
      ],
      'tiktok': [
        '[data-e2e="profile-icon"]',
        '[data-e2e="nav-profile"]',
        '[data-e2e="upload-icon"]'
      ],
      'pinterest': [
        '[data-test-id="header-profile"]',
        '[aria-label="Profile"]',
        '.profileImage'
      ]
    };

    const selectors = verificationSelectors[this.platform] || [];
    
    return `
  const loginIndicators = ${JSON.stringify(selectors, null, 4)};
  
  for (const selector of loginIndicators) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      return true;
    } catch (error) {
      // Continue to next selector
    }
  }
  
  return false;`;
  }

  /**
   * Close the browser and cleanup
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

/**
 * Main function to start recording
 */
async function main() {
  const platform = process.argv[2];
  
  if (!platform) {
    console.log('❌ Please specify a platform to record:');
    console.log('');
    console.log('Usage: node record-login-flow.js <platform>');
    console.log('');
    console.log('Available platforms:');
    console.log('  x        - X.com (Twitter)');
    console.log('  tiktok   - TikTok');
    console.log('  pinterest - Pinterest');
    console.log('');
    console.log('Example: node record-login-flow.js x');
    process.exit(1);
  }

  const recorder = new LoginFlowRecorder(platform);
  
  try {
    await recorder.startRecording();
    console.log('');
    console.log('🎉 Recording completed successfully!');
    console.log('📁 Check the ./recordings directory for generated files');
    
  } catch (error) {
    console.error('❌ Recording failed:', error.message);
  } finally {
    await recorder.cleanup();
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { LoginFlowRecorder };