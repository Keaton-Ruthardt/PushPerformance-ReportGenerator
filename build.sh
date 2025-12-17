#!/bin/bash
set -e

echo "Installing npm dependencies..."
npm install

echo "Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

echo "Building client application..."
npm run build

echo "Build completed successfully!"
