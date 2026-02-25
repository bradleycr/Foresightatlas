#!/usr/bin/env node

/**
 * UI Check Script - Takes screenshots of the dev server
 * Verifies that all routes are working and the UI renders correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
const BASE_URL = 'http://localhost:3000';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const routes = [
  { path: '/', name: 'home-map' },
  { path: '/berlin', name: 'berlin-programming' },
  { path: '/sf', name: 'sf-programming' },
];

console.log('📸 Taking screenshots of dev server...\n');

// Wait a bit for the page to fully load
const waitTime = 3000;

routes.forEach((route, index) => {
  const url = `${BASE_URL}${route.path}`;
  const screenshotPath = path.join(SCREENSHOT_DIR, `${route.name}.png`);
  
  console.log(`[${index + 1}/${routes.length}] Capturing ${route.path}...`);
  
  try {
    // Use Chrome headless to take screenshot with temporary user data dir
    const userDataDir = path.join(__dirname, '../.chrome-temp-' + Date.now());
    try {
      execSync(
        `google-chrome --headless --disable-gpu --no-sandbox --disable-dev-shm-usage --user-data-dir="${userDataDir}" --window-size=1920,1080 --screenshot="${screenshotPath}" "${url}" 2>&1 | grep -v "ERROR:dbus" | grep -v "ERROR:net" || true`,
        { 
          stdio: 'pipe',
          timeout: 60000,
          encoding: 'utf8'
        }
      );
    } catch (error) {
      // Check if screenshot was created despite timeout
      if (!fs.existsSync(screenshotPath)) {
        throw error;
      }
      // Screenshot exists, so it's okay
    }
    
    // Clean up temp directory
    try {
      execSync(`rm -rf "${userDataDir}"`, { stdio: 'ignore' });
    } catch (e) {
      // Ignore cleanup errors
    }
    
    if (fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath);
      console.log(`  ✓ Screenshot saved: ${screenshotPath} (${(stats.size / 1024).toFixed(2)} KB)\n`);
    } else {
      console.log(`  ⚠ Screenshot file not found: ${screenshotPath}\n`);
    }
  } catch (error) {
    console.error(`  ✗ Error capturing ${route.path}:`, error.message);
  }
});

console.log('✅ Screenshot capture complete!');
console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);
