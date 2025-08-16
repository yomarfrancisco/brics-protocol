import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {createRequire} from 'node:module';

const requireCjs = createRequire(import.meta.url);

const ROOT = process.cwd();
const OUTDIR = path.join(os.tmpdir(), `nav_dbg_${Date.now()}`);
await fs.mkdir(OUTDIR, {recursive: true});

const MAX_HEAD = (content, n=60) =>
  content.split(/\r?\n/).slice(0,n).join('\n');

const exists = async p => !!(await fs.stat(p).catch(()=>null));

const readHeadIfExists = async (p, lines) => {
  if (!(await exists(p))) return null;
  const txt = await fs.readFile(p, 'utf8').catch(()=>null);
  return txt ? MAX_HEAD(txt, lines) : null;
};

const IGNORE_DIRS = new Set(['node_modules','.git','.yarn','dist','build','coverage','.cache','.turbo']);

async function walk(dir, acc=[]) {
  const ents = await fs.readdir(dir, {withFileTypes:true}).catch(()=>[]);
  for (const e of ents) {
    if (IGNORE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function isTsJs(p){ return /\.(ts|js|cjs|mjs)$/.test(p); }
function isTest(p){ return p.includes(`${path.sep}test${path.sep}`) && isTsJs(p); }
function isHelper(p){
  return /(?:^|\/)(nav-helpers|time-helpers)\.(ts|js|cjs|mjs)$/.test(p);
}

function importLines(txt){
  const lines = txt.split(/\r?\n/).filter(l=>
    /from ['"][^'"]*(nav-helpers|time-helpers)/.test(l) ||
    /require\(['"][^'"]*(nav-helpers|time-helpers)/.test(l)
  );
  return lines.slice(0,8).join('\n');
}

async function write(name, data){
  await fs.writeFile(path.join(OUTDIR, name), data, 'utf8');
}

// 1) Collect test files & helpers
const testFiles = (await exists(path.join(ROOT,'test')))
  ? (await walk(path.join(ROOT,'test'))).filter(isTest)
  : [];

const helperFiles = testFiles.filter(isHelper);

// Save helper sources fully (but cap per-file size to ~200KB just in case)
let helpersSrc = '';
for (const f of helperFiles) {
  if (await exists(f)) {
    const txt = await fs.readFile(f, 'utf8').catch(()=>null);
    if (txt){
      const capped = txt.length > 200_000 ? txt.slice(0,200_000) + '\n/*...truncated...*/\n' : txt;
      helpersSrc += `===== ${path.relative(ROOT,f)} =====\n${capped}\n\n`;
    }
  }
}
await write('helpers_source.txt', helpersSrc || 'NO_HELPERS_FOUND\n');

// Find imports & capture test heads
let importsIdx = '';
let testHeads = '';
for (const f of testFiles) {
  const txt = await fs.readFile(f, 'utf8').catch(()=>null);
  if (!txt) continue;
  const imps = importLines(txt);
  if (imps){
    importsIdx += `${path.relative(ROOT,f)}:\n${imps}\n\n`;
    testHeads += `--- ${path.relative(ROOT,f)} (head) ---\n${MAX_HEAD(txt,60)}\n\n`;
  }
}
await write('helpers_imports.txt', importsIdx || 'NO_IMPORTERS_FOUND\n');
await write('importer_test_heads.txt', testHeads || 'NO_IMPORTER_HEADS\n');

// 2) Capture specific file heads mentioned in CI (pause.spec.ts if present)
const suspect = path.join(ROOT,'test','fast','governance','pause.spec.ts');
if (await exists(suspect)){
  const txt = await fs.readFile(suspect,'utf8').catch(()=>null);
  if (txt) await write('pause.spec.head.txt', MAX_HEAD(txt,120));
}

// 3) Runner / loader wiring
let wiring = '';
const tryAdd = async (label, file, lines=300) => {
  const head = await readHeadIfExists(file, lines);
  if (head) wiring += `===== ${label} :: ${path.relative(ROOT,file)} =====\n${head}\n\n`;
};
await tryAdd('package.json', path.join(ROOT,'package.json'), 300);
await tryAdd('hardhat.config.ts', path.join(ROOT,'hardhat.config.ts'), 300);
await tryAdd('hardhat.config.js', path.join(ROOT,'hardhat.config.js'), 300);
await tryAdd('test/bootstrap.ts', path.join(ROOT,'test','bootstrap.ts'), 300);
await tryAdd('mocha.config.js', path.join(ROOT,'mocha.config.js'), 300);
await tryAdd('mocha.cjs', path.join(ROOT,'mocha.cjs'), 300);
await tryAdd('mocha.mjs', path.join(ROOT,'mocha.mjs'), 300);
await tryAdd('tsconfig.json', path.join(ROOT,'tsconfig.json'), 300);
await tryAdd('tsconfig.test.json', path.join(ROOT,'tsconfig.test.json'), 300);
await write('runner_wiring.txt', wiring || 'NO_WIRING_FILES_FOUND\n');

// 4) require.resolve probes (CJS)
const ids = [
  './test/utils/nav-helpers','./test/fast/utils/nav-helpers',
  'test/utils/nav-helpers','test/fast/utils/nav-helpers',
  './test/utils/time-helpers','./test/fast/utils/time-helpers',
  'test/utils/time-helpers','test/fast/utils/time-helpers'
];
let probes = '';
for (const id of ids){
  try {
    const p = requireCjs.resolve(id);
    probes += `${id} => ${p}\n`;
  } catch (e){
    probes += `${id} => FAIL: ${e.code||e.message}\n`;
  }
}
await write('resolve_probes.txt', probes);

// 5) Yarn PnP hints
const pnpHead = await readHeadIfExists(path.join(ROOT,'.pnp.cjs'), 120);
await write('pnp_head.txt', pnpHead || 'NO_PNP\n');
const yarnrc = await readHeadIfExists(path.join(ROOT,'.yarnrc.yml'), 200);
await write('yarnrc.yml.txt', yarnrc || 'NO_YARNRC\n');

// 6) CI workflow heads (first 200 lines)
let wf = '';
const wfDir = path.join(ROOT,'.github','workflows');
if (await exists(wfDir)){
  const files = (await fs.readdir(wfDir).catch(()=>[])).filter(n=>n.endsWith('.yml')||n.endsWith('.yaml'));
  for (const n of files){
    const p = path.join(wfDir, n);
    const head = await readHeadIfExists(p, 200);
    if (head) wf += `===== ${path.relative(ROOT,p)} =====\n${head}\n\n`;
  }
}
await write('ci_workflows_head.txt', wf || 'NO_WORKFLOWS\n');

// 7) Summary file
const summary = {
  outdir: OUTDIR,
  helperFiles: helperFiles.map(p=>path.relative(ROOT,p)),
  importerCount: (importsIdx.match(/\n\n/g)||[]).length,
  testFilesScanned: testFiles.length,
};
await write('SUMMARY.json', JSON.stringify(summary,null,2));

// 8) Tar.gz the directory (single short call)
const tgz = path.join(os.tmpdir(), `nav_dbg_bundle_${Date.now()}.tgz`);
await new Promise((res, rej)=>{
  execFile('tar', ['-czf', tgz, '-C', OUTDIR, '.'], (err)=> err? rej(err): res());
});
console.log('BUNDLE_READY:', tgz);



