import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if Chrome is already installed
const puppeteerCachePath = process.env.PUPPETEER_CACHE_DIR || join(__dirname, '.cache', 'puppeteer');
const chromeVersionPath = join(puppeteerCachePath, 'chrome');

console.log('🔍 Checking for Chrome installation...');
console.log('   Cache path:', puppeteerCachePath);

if (existsSync(chromeVersionPath)) {
  console.log('✅ Chrome already installed');
  process.exit(0);
}

console.log('📥 Chrome not found, installing...');
try {
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env: { ...process.env }
  });
  console.log('✅ Chrome installed successfully');
} catch (error) {
  console.error('❌ Failed to install Chrome:', error.message);
  console.error('   PDF generation will not work until Chrome is installed');
  // Don't fail the server start
  process.exit(0);
}
