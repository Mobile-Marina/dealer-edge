const fs = require('fs');
const path = require('path');
const terser = require('terser');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const INPUTS = [
  'mobile-nav.js',
  'demo-modal.js',
  'section-video-boat.js',
  'de-core.js',
  'app.js',
  'app-late.js',
  'sales.js',
  'sales-late.js',
  'marketing.js',
  'marketing-late.js',
  'inventory.js',
  'inventory-late.js',
  'analytics.js',
  'analytics-late.js',
  'features.js',
  'features-late.js',
  'pricing.js',
  'roi.js',
  'integrations.js',
  'getting-started.js',
  'case-studies.js',
  'case-study.js',
];

async function main() {
  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of INPUTS) {
    const srcPath = path.join(JS_DIR, file);
    if (!fs.existsSync(srcPath)) continue;

    const code = fs.readFileSync(srcPath, 'utf8');
    const result = await terser.minify(code, {
      compress: {
        passes: 2,
      },
      mangle: true,
      format: {
        comments: false,
      },
    });

    if (result.error) throw result.error;
    const outPath = path.join(JS_DIR, file.replace(/\.js$/, '.min.js'));
    fs.writeFileSync(outPath, `${result.code}\n`, 'utf8');

    const before = Buffer.byteLength(code);
    const after = Buffer.byteLength(result.code) + 1;
    totalBefore += before;
    totalAfter += after;
    console.log(`${file}: ${before} -> ${after}`);
  }

  console.log(`total: ${totalBefore} -> ${totalAfter}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
