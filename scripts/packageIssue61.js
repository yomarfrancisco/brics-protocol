// scripts/packageIssue61.js
// Packages an existing folder (support/#61-mintfor-deepdive-<shortsha>) into .tar.gz
// and writes a SHA256 checksum. Pure Node; no shell commands; no extra deps.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

// 1) find the existing bundle folder under support/#61-mintfor-deepdive-*
const supportDir = path.resolve('support');
if (!fs.existsSync(supportDir)) {
  console.error('support/ directory not found.');
  process.exit(1);
}
const candidates = fs.readdirSync(supportDir)
  .filter(n => n.startsWith('#61-mintfor-deepdive-'))
  .map(n => path.join(supportDir, n))
  .filter(p => fs.statSync(p).isDirectory());
if (candidates.length === 0) {
  console.error('No bundle folder found: support/#61-mintfor-deepdive-<shortsha>/');
  process.exit(1);
}

// pick the most recent
candidates.sort((a,b)=>fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
const bundleDir = candidates[0];
const baseName = path.basename(bundleDir); // e.g. #61-mintfor-deepdive-fe6a1f6
const tarPath = path.join(supportDir, `${baseName}.tar`);
const gzPath  = `${tarPath}.gz`;
const shaPath = `${gzPath}.sha256.txt`;

// --- Minimal TAR writer (USTAR) ---
function pad(buf, size) { const out = Buffer.alloc(size); buf.copy(out); return out; }
function oct(n, len) {
  const s = n.toString(8); const b = Buffer.alloc(len, 0);
  Buffer.from(s).copy(b, len - s.length - 1);
  return b;
}
function cksum(header) {
  const buf = Buffer.from(header);
  for (let i=148;i<156;i++) buf[i]=0x20;
  let sum=0; for (let i=0;i<buf.length;i++) sum+=buf[i];
  oct(sum,8).copy(buf,148);
  return buf;
}
function tarHeader(name, size, typeflag='0') {
  const hdr = Buffer.alloc(512,0);
  pad(Buffer.from(name),100).copy(hdr,0);
  oct(0o644,8).copy(hdr,100);
  oct(0,8).copy(hdr,108); oct(0,8).copy(hdr,116);
  oct(size,12).copy(hdr,124);
  oct(Math.floor(Date.now()/1000),12).copy(hdr,136);
  Buffer.from(typeflag).copy(hdr,156);
  Buffer.from('ustar\0').copy(hdr,257);
  Buffer.from('00').copy(hdr,263);
  return cksum(hdr);
}
function* tarFileEntry(rel, data) {
  yield tarHeader(rel, data.length, '0');
  yield data;
  const rem = data.length % 512;
  if (rem) yield Buffer.alloc(512 - rem, 0);
}
function* tarDirHeader(rel) { yield tarHeader(rel.endsWith('/')?rel:rel+'/', 0, '5'); }

function addDirRecursively(root, rel, stream) {
  const abs = path.join(root, rel);
  const st = fs.statSync(abs);
  const relTar = path.join(path.basename(bundleDir), rel).replace(/\\/g,'/');
  if (st.isDirectory()) {
    for (const chunk of tarDirHeader(relTar)) stream.write(chunk);
    for (const e of fs.readdirSync(abs)) addDirRecursively(root, path.join(rel, e), stream);
  } else if (st.isFile()) {
    const data = fs.readFileSync(abs);
    for (const chunk of tarFileEntry(relTar, data)) stream.write(chunk);
  }
}

(async () => {
  // 2) write TAR
  if (fs.existsSync(tarPath)) fs.rmSync(tarPath);
  if (fs.existsSync(gzPath)) fs.rmSync(gzPath);
  if (fs.existsSync(shaPath)) fs.rmSync(shaPath);

  const tarStream = fs.createWriteStream(tarPath);
  // add folder root header first
  for (const chunk of tarDirHeader(path.basename(bundleDir)+'/')) tarStream.write(chunk);
  // recursively add everything inside the bundleDir
  for (const e of fs.readdirSync(bundleDir)) addDirRecursively(bundleDir, e, tarStream);
  // two zero blocks to finish
  tarStream.write(Buffer.alloc(1024, 0));
  await new Promise(res => tarStream.end(res));

  // 3) gzip the tar
  await new Promise((res, rej) => {
    fs.createReadStream(tarPath)
      .pipe(zlib.createGzip({ level: 9 }))
      .pipe(fs.createWriteStream(gzPath))
      .on('finish', res).on('error', rej);
  });

  // 4) checksum
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(gzPath));
  const digest = hash.digest('hex');
  fs.writeFileSync(shaPath, `${digest}  ${path.basename(gzPath)}\n`);

  // 5) clean raw tar
  fs.rmSync(tarPath, { force: true });

  console.log('✅ Bundle folder :', bundleDir);
  console.log('📦 Archive      :', gzPath);
  console.log('🔐 SHA256       :', shaPath);
})();
