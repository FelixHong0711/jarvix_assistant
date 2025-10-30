// Build script to compile Electron main process TypeScript files
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building Electron main process...');

// Create dist-electron directory
const distDir = path.join(__dirname, 'dist-electron');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Compile TypeScript files
try {
  execSync(
    'tsc --project tsconfig.node.json --outDir dist-electron',
    { stdio: 'inherit', cwd: __dirname }
  );
  console.log('✓ Electron main process compiled successfully');
  
  // Verify critical files exist
  const distElectronPath = path.join(__dirname, 'dist-electron', 'app', 'electron');
  const requiredFiles = ['preload.js', 'ipc.js', 'main.dev.js'];
  for (const file of requiredFiles) {
    const filePath = path.join(distElectronPath, file);
    if (!fs.existsSync(filePath)) {
      console.error(`✗ Missing required file: ${filePath}`);
      process.exit(1);
    }
  }
  console.log('✓ All required files verified');
} catch (error) {
  console.error('✗ Failed to compile Electron main process:', error);
  process.exit(1);
}

