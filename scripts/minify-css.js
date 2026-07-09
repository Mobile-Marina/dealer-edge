const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'css');
const BUILDERS = [
  'build-page-core-css.js',
  'build-deep-core-css.js',
  'build-sales-css.js',
  'build-marketing-css.js',
  'build-inventory-css.js',
  'build-analytics-css.js',
];
const INPUTS = [
  'style.css',
  'deep-core.css',
  'home-core.css',
  'home-late.css',
  'pricing-core.css',
  'results-core.css',
  'video-boat.css',
  'de-act.css',
  'sales.css',
  'sales-critical.css',
  'sales-late.css',
  'marketing.css',
  'marketing-critical.css',
  'marketing-late.css',
  'inventory.css',
  'inventory-critical.css',
  'inventory-late.css',
  'analytics.css',
  'analytics-critical.css',
  'analytics-late.css',
  'features.css',
  'roi.css',
  'integrations.css',
  'getting-started.css',
];

function stripComments(css) {
  let out = '';
  let quote = null;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += next || '';
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function minify(css) {
  return stripComments(css)
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

let totalBefore = 0;
let totalAfter = 0;

for (const builder of BUILDERS) {
  const result = spawnSync(process.execPath, [path.join(__dirname, builder)], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

for (const file of INPUTS) {
  const srcPath = path.join(CSS_DIR, file);
  if (!fs.existsSync(srcPath)) continue;
  let css = fs.readFileSync(srcPath, 'utf8');
  if (file === 'features.css') {
    const deptPath = path.join(CSS_DIR, 'features-dept.css');
    if (fs.existsSync(deptPath)) {
      css = `${css}\n\n${fs.readFileSync(deptPath, 'utf8')}`;
    }
  }
  const min = minify(css);
  const outPath = path.join(CSS_DIR, file.replace(/\.css$/, '.min.css'));
  fs.writeFileSync(outPath, `${min}\n`, 'utf8');
  totalBefore += Buffer.byteLength(css);
  totalAfter += Buffer.byteLength(min) + 1;
  console.log(`${file}: ${Buffer.byteLength(css)} -> ${Buffer.byteLength(min) + 1}`);
}

console.log(`total: ${totalBefore} -> ${totalAfter}`);
