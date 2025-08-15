// Node 18+ CJS script
const fs = require("fs");
const path = require("path");
const glob = require("glob");

const ROOT = process.cwd();
const TEST_GLOB = "test/**/*.@(ts|tsx|js|jsx)";

function relImport(fromFile) {
  const fromDir = path.dirname(fromFile);
  const utilPath = path.relative(fromDir, path.join(ROOT, "test/utils/time-helpers")).replace(/\\/g, "/");
  return utilPath.startsWith(".") ? utilPath : "./" + utilPath;
}

function ensureImport(src, importPath) {
  const hasImport =
    /from\s+["'].*time-helpers["']/.test(src) ||
    /require\(.+time-helpers.+\)/.test(src);

  if (hasImport) return src;

  const line = `import { safeIncreaseTo } from "${importPath}";\n`;
  // insert after first import or at top
  if (/^import .+$/m.test(src)) {
    return src.replace(/^import .+$/m, (m) => `${m}\n${line}`);
  }
  return line + src;
}

function transform(src) {
  // 1) Replace setNextBlockTimestamp + optional next-line evm_mine
  //    Matches arrays [EXPR] and also numbers directly in some codebases.
  const setNextRe = /await\s+ethers\.provider\.send\(\s*["']evm_setNextBlockTimestamp["']\s*,\s*\[\s*([^\]]+?)\s*\]\s*\)\s*;?\s*(?:\r?\n\s*await\s+ethers\.provider\.send\(\s*["']evm_mine["']\s*,\s*\[\s*\]\s*\)\s*;?)?/g;
  let out = src.replace(setNextRe, (_m, expr) => `await safeIncreaseTo(${expr.trim()});`);

  // also handle rare variant with non-array second param
  const setNextAlt = /await\s+ethers\.provider\.send\(\s*["']evm_setNextBlockTimestamp["']\s*,\s*([^)]+?)\s*\)\s*;?\s*(?:\r?\n\s*await\s+ethers\.provider\.send\(\s*["']evm_mine["']\s*,\s*\[\s*\]\s*\)\s*;?)?/g;
  out = out.replace(setNextAlt, (_m, expr) => `await safeIncreaseTo(${expr.trim()});`);

  // 2) If there are standalone evm_mine with empty args following a setNext we may have already removed them.
  //    As a safety, collapse orphan mines that appear immediately after a safeIncreaseTo call.
  out = out.replace(/\r?\n\s*await\s+ethers\.provider\.send\(\s*["']evm_mine["']\s*,\s*\[\s*\]\s*\)\s*;?/g, "\n");

  return out;
}

const files = glob.sync(TEST_GLOB, { nodir: true });
let touched = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  if (!/evm_setNextBlockTimestamp/.test(src)) continue;

  const transformed = transform(src);
  if (transformed !== src) {
    const importPath = relImport(file);
    const withImport = ensureImport(transformed, importPath);
    fs.writeFileSync(file, withImport, "utf8");
    touched++;
  }
}

console.log(`safe-increase-to codemod: updated ${touched} file(s).`);
