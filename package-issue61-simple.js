// Simple Issue #61 packaging script
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

console.log('🔍 Looking for Issue #61 bundle...');

// Find the bundle folder
const supportDir = path.resolve('support');
if (!fs.existsSync(supportDir)) {
  console.error('❌ support/ directory not found');
  process.exit(1);
}

const candidates = fs.readdirSync(supportDir)
  .filter(n => n.startsWith('#61-mintfor-deepdive-'))
  .map(n => path.join(supportDir, n))
  .filter(p => fs.statSync(p).isDirectory());

if (candidates.length === 0) {
  console.error('❌ No bundle folder found: support/#61-mintfor-deepdive-<shortsha>/');
  process.exit(1);
}

// Pick the most recent
candidates.sort((a,b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
const bundleDir = candidates[0];
const baseName = path.basename(bundleDir);
const gzPath = path.join(supportDir, `${baseName}.tar.gz`);
const shaPath = `${gzPath}.sha256.txt`;

console.log('✅ Found bundle:', bundleDir);
console.log('📦 Creating archive:', gzPath);

// Create a simple zip-like archive using Node.js streams
const archiver = require('archiver');
const output = fs.createWriteStream(gzPath);
const archive = archiver('tar', {
  gzip: true,
  gzipOptions: { level: 9 }
});

output.on('close', () => {
  console.log('📦 Archive created successfully');
  
  // Generate SHA256 checksum
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(gzPath);
  hash.update(data);
  const digest = hash.digest('hex');
  
  fs.writeFileSync(shaPath, `${digest}  ${path.basename(gzPath)}\n`);
  
  console.log('🔐 SHA256 checksum:', shaPath);
  console.log('📊 Archive size:', (archive.pointer() / 1024 / 1024).toFixed(2), 'MB');
  console.log('✅ Issue #61 bundle packaged successfully!');
});

archive.on('error', (err) => {
  console.error('❌ Archive error:', err);
  process.exit(1);
});

archive.pipe(output);

// Add the entire bundle directory
archive.directory(bundleDir, baseName);
archive.finalize();
