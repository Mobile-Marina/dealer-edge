#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   export-platform.mjs — package the cinematic pages for the
   DealerEdge platform (vanilla-island architecture, see
   PLATFORM-MIGRATION-PLAN.md v2 §1).

   For each page it emits:
     lib/de-site/fragments/<page>.html       body content, nav/footer/scripts stripped,
                                             asset paths rewritten to /de-site/...
     lib/de-site/fragments/<page>.meta.json  title/description/og + bodyClass +
                                             ordered css/js lists for the island loader
   and copies into public/de-site/:
     css/  js/  assets/ (only assets actually referenced)  vendor/ (lenis+gsap+ScrollTrigger,
     downloaded once into this repo's vendor/ then copied — the platform CSP
     only allows same-origin scripts, so the CDN tags can't be used there)

   Usage:  node scripts/export-platform.mjs [platform-repo-path]
   Default target: C:\Users\jason\repos\dealerEdge-demo-generator
   Re-running is a full refresh: the de-site output dirs are owned by this
   script and rebuilt from scratch every time.
   ═══════════════════════════════════════════════════════════════ */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.resolve(process.argv[2] || 'C:\\Users\\jason\\repos\\dealerEdge-demo-generator');

const PAGES = ['sales', 'marketing', 'inventory', 'analytics', 'features', 'index', 'roi', 'integrations', 'getting-started', 'pricing', 'case-study', 'support'];
// Platform route when it isn't just /<page> — keeps site-kb.json doc URLs
// (what the AI agent cites) in sync with the platform's island routes.
const KB_ROUTES = { 'case-study': '/case-studies/premier-watersports' };
// index.html (homepage) now ships: app.js is on the DE.boot/DE.destroy lifecycle
// and uses the shared demo-modal (js/demo-modal.js) for lead capture.
// mobile-nav.js is excluded everywhere: the platform renders DeHeader instead.
const EXCLUDED_SCRIPTS = new Set(['js/mobile-nav.js', 'js/mobile-nav.min.js']);

const VENDOR = [
  { file: 'lenis.min.js', url: 'https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.min.js' },
  { file: 'gsap.min.js', url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js' },
  { file: 'ScrollTrigger.min.js', url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js' },
];

// Referenced only by the stripped nav/footer (now the platform's DeHeader/DeFooter
// components) — must ship even though no fragment references them.
const ALWAYS_INCLUDE_ASSETS = ['dealer-edge-logo-horiz.webp', 'dealer-edge-logo-horiz.svg'];

// style.css sections (by `/* ─── NAME ─── */` header) that make up the DE
// chrome stylesheet consumed by the platform's DeHeader/DeFooter on BOTH
// island and CMS pages. Section-based so line drift in style.css is harmless.
const CHROME_SECTIONS = [
  'VARIABLES',
  'NAVBAR',
  'PLATFORM DROPDOWN (desktop)',
  'BUTTONS',
  'FOOTER',
  'MOBILE NAV',
  'PLATFORM GROUP (mobile accordion)',
  'FOOTER RESPONSIVE',
];
const CHROME_ADDENDUM = `
/* ─── DE-CHROME ADDENDUM (export-platform.mjs) ─── */
/* the one chrome rule that lives in style.css's general RESPONSIVE section */
@media (max-width: 960px) { .nav-links { display: none; } }
/* CMS pages don't load the island reset — pin the chrome's own typography */
.navbar, .nav-mobile-panel, .footer { font-family: var(--font); }
/* DE CMS page-header (shared <PageHeader variant=gradient|solid>): dark on-brand
   surface + clear the fixed nav. Fixes the red-band-vs-red-utility-bar clash AND
   the H1/logo collision in one rule. Scoped to the gradient/solid header so the
   full-bleed island heroes are untouched; primary stays the CTA/accent red. */
#main-content header.from-primary,
#main-content header.bg-primary {
  background: linear-gradient(165deg, #0c0c0e 0%, #000 72%);
  border-bottom-color: rgba(255, 255, 255, 0.08);
  padding-top: calc(var(--nav-height) + 38px + 2.5rem);
}
@media (max-width: 1100px) {
  #main-content header.from-primary,
  #main-content header.bg-primary { padding-top: calc(var(--nav-height) + 1.5rem); }
}
`;

function extractChromeCss(styleCss) {
  const parts = styleCss.split(/(?=\/\* ─── [^─]+ ─── \*\/)/);
  const picked = [];
  for (const name of CHROME_SECTIONS) {
    const section = parts.find((p) => p.startsWith(`/* ─── ${name} ─── */`));
    if (!section) { warn.push(`de-chrome: style.css section not found: ${name}`); continue; }
    picked.push(section.trimEnd());
  }
  return picked.join('\n\n') + '\n' + CHROME_ADDENDUM;
}

// Same comment-stripping + whitespace-collapse pass as scripts/minify-css.js —
// de-chrome.css is render-blocking on every platform page, so ship it minified.
function minifyCss(css) {
  let out = '';
  let quote = null;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    const next = css[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') { out += next || ''; i += 1; }
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; continue; }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

const FRAGMENTS_DIR = path.join(TARGET, 'lib', 'de-site', 'fragments');
const PUBLIC_DIR = path.join(TARGET, 'public', 'de-site');

const warn = [];

function stripBlock(html, openRe, closeTag, label) {
  const open = html.match(openRe);
  if (!open) { warn.push(`${label}: open tag not found`); return html; }
  const start = open.index;
  const end = html.indexOf(closeTag, start);
  if (end === -1) { warn.push(`${label}: close tag not found`); return html; }
  return html.slice(0, start) + html.slice(end + closeTag.length);
}

function rewriteAssetPaths(s) {
  // src/href/srcset/poster attributes + inline style url() pointing at assets/
  return s
    .replace(/(src|href|poster)="assets\//g, '$1="/de-site/assets/')
    .replace(/srcset="([^"]*)"/g, (m, v) => `srcset="${v.replace(/(^|,\s*)assets\//g, '$1/de-site/assets/')}"`)
    .replace(/url\((['"]?)assets\//g, 'url($1/de-site/assets/');
}

// Internal page links in the static source are authored as `features.html`,
// `/sales.html`, etc. On the platform those routes are clean (`/features`,
// `/sales`); `index.html` is the homepage `/`. Rewrite them so fragments never
// ship `.html` hrefs (they'd hit the catch-all → soft-404). External links
// (https://…/x.html) don't match — the pattern only catches a bare page name
// optionally prefixed with a single leading slash.
function rewriteInternalLinks(s) {
  return s.replace(/href="(\/?)([a-z][a-z0-9-]*)\.html((?:#[^"]*)?)"/g, (m, _slash, name, hash) =>
    name === 'index' ? `href="/${hash}"` : `href="/${name}${hash}"`);
}

// React hydrates the injected island via dangerouslySetInnerHTML; non-void
// elements authored self-closing (`<polygon …/>`, `<path …/>`) re-serialize to
// explicit close tags when the browser parses the DOM, which trips React #418
// (hydration mismatch). Expand every self-closing tag EXCEPT the HTML void
// elements so the fragment string matches the parsed DOM byte-for-byte.
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function expandSelfClosingTags(s) {
  return s.replace(/<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)\s*\/>/g, (m, tag, attrs) =>
    VOID_TAGS.has(tag.toLowerCase()) ? m : `<${tag}${attrs}></${tag}>`);
}

// The platform chrome (DeHeader/DeFooter + the marketing layout's
// <main id="main-content">) owns the page-level landmarks. Island content
// authors its own <main> (full-page hero) and <header class="de-act-head">
// act headers — inside the chrome those become a nested/duplicate <main> and
// extra <header> landmarks (QA: "2 mains", "5 headers"). Demote both to <div>;
// styling and the act controller are class-driven, so nothing else changes,
// and the headings (h1/h2/h3) inside are preserved for screen-reader nav.
function neutralizeLandmarks(s) {
  return s
    .replace(/<main\b/g, '<div').replace(/<\/main>/g, '</div>')
    .replace(/<header\b/g, '<div').replace(/<\/header>/g, '</div>');
}

// ── site KB extraction ──
// Visible text per page (fragment + its lazy late-content partial) becomes
// lib/de-site/site-kb.json in the platform repo — the SMS/chat agents'
// search_site_content reads it, so the marketing site IS the AI's knowledge
// base and every copy change ships to the AI on the next export.
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&rsquo;': '’', '&lsquo;': '‘',
  '&ldquo;': '“', '&rdquo;': '”', '&mdash;': ' - ', '&ndash;': '-',
  '&hellip;': '...', '&times;': 'x', '&rarr;': '->', '&larr;': '<-',
};

function htmlToText(html) {
  let s = html;
  // Drop non-content blocks entirely (scripts already stripped from fragments,
  // but partials come in raw).
  for (const tag of ['script', 'style', 'svg', 'noscript', 'template']) {
    s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi'), ' ');
  }
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  // Block-level boundaries become line breaks so headings/lines don't fuse.
  s = s.replace(/<\/(?:p|div|section|article|li|h[1-6]|tr|blockquote|figcaption)>/gi, '\n');
  s = s.replace(/<(?:br|hr)\b[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  for (const [ent, ch] of Object.entries(ENTITIES)) s = s.split(ent).join(ch);
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  // Collapse whitespace: runs of spaces/tabs, then 3+ newlines to 2.
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/ ?\n ?/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function collectAssetRefs(s, refs) {
  for (const m of s.matchAll(/(?:src|href|poster)="assets\/([^"]+)"/g)) refs.add(m[1]);
  for (const m of s.matchAll(/url\((['"]?)(?:\.\.\/)?assets\/([^'")]+)\1\)/g)) refs.add(m[2]);
  for (const m of s.matchAll(/srcset="([^"]*)"/g)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u.startsWith('assets/')) refs.add(u.slice('assets/'.length));
    }
  }
}

function collectDynamicDeps(jsText, jsRefs, cssRefs) {
  for (const m of jsText.matchAll(/['"`](js\/[^'"`?]+\.js)(?:\?[^'"`]*)?['"`]/g)) {
    if (!EXCLUDED_SCRIPTS.has(m[1])) jsRefs.add(m[1]);
  }
  for (const m of jsText.matchAll(/['"`](css\/[^'"`?]+\.css)(?:\?[^'"`]*)?['"`]/g)) {
    cssRefs.add(m[1]);
  }
}

async function ensureVendor() {
  const vendorSrc = path.join(SITE_ROOT, 'vendor');
  await fs.mkdir(vendorSrc, { recursive: true });
  for (const v of VENDOR) {
    const dest = path.join(vendorSrc, v.file);
    try { await fs.access(dest); continue; } catch { /* download */ }
    process.stdout.write(`vendoring ${v.file} from ${v.url}\n`);
    const res = await fetch(v.url);
    if (!res.ok) throw new Error(`vendor download failed: ${v.url} -> ${res.status}`);
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
  }
  return vendorSrc;
}

async function main() {
  // target sanity: refuse to write into a non-platform-looking directory
  try { await fs.access(path.join(TARGET, 'package.json')); }
  catch { throw new Error(`target does not look like the platform repo: ${TARGET}`); }

  const vendorSrc = await ensureVendor();

  // fresh output dirs (fully owned by this script)
  await fs.rm(FRAGMENTS_DIR, { recursive: true, force: true });
  await fs.rm(PUBLIC_DIR, { recursive: true, force: true });
  await fs.mkdir(FRAGMENTS_DIR, { recursive: true });
  for (const d of ['css', 'js', 'assets', 'partials', 'vendor']) await fs.mkdir(path.join(PUBLIC_DIR, d), { recursive: true });

  const assetRefs = new Set();
  const cssToCopy = new Set();
  const jsToCopy = new Set();
  const kbDocs = [];

  for (const page of PAGES) {
    const html = await fs.readFile(path.join(SITE_ROOT, `${page}.html`), 'utf8');

    // ── meta from <head> + <body> ──
    // Meta values are consumed as plain text (Next metadata + the site-kb
    // docs), so decode the entities HTML requires in attribute/title text.
    const decodeEntities = (s) => s
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'");
    const title = decodeEntities(html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? '');
    const description = decodeEntities(html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] ?? '');
    const og = {};
    for (const m of html.matchAll(/<meta\s+property="og:(\w+)"\s+content="([^"]*)"/g)) og[m[1]] = decodeEntities(m[2]);
    const bodyClass = html.match(/<body\s+class="([^"]*)"/)?.[1] ?? '';
    const css = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="(css\/[^"?]+)(?:\?[^"]*)?"/g)].map((m) => m[1]);
    const fonts = [...html.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"[^>]*>/g)].map((m) => m[1]);
    const js = [...html.matchAll(/<script\b[^>]*\bsrc="(js\/[^"?]+)(?:\?[^"]*)?"[^>]*><\/script>/g)]
      .map((m) => m[1])
      .filter((s) => !EXCLUDED_SCRIPTS.has(s));
    css.forEach((c) => cssToCopy.add(c));
    js.forEach((j) => jsToCopy.add(j));

    // ── fragment: body inner, minus nav/footer/scripts ──
    const bodyInner = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1];
    if (!bodyInner) throw new Error(`${page}: no <body> found`);
    let frag = bodyInner;
    frag = stripBlock(frag, /<nav\s+class="navbar"[^>]*>/, '</nav>', `${page}: navbar`);
    frag = stripBlock(frag, /<footer\s+class="footer"[^>]*>/, '</footer>', `${page}: footer`);
    frag = frag.replace(/\s*<script\b[^>]*\bsrc="[^"]*"[^>]*><\/script>/g, '');
    if (/<script[\s>]/.test(frag)) warn.push(`${page}: inline <script> left in fragment — review`);
    collectAssetRefs(frag, assetRefs);
    frag = neutralizeLandmarks(frag);
    frag = expandSelfClosingTags(frag);
    frag = rewriteInternalLinks(frag);
    frag = rewriteAssetPaths(frag).trim();

    await fs.writeFile(path.join(FRAGMENTS_DIR, `${page}.html`), frag + '\n');
    await fs.writeFile(
      path.join(FRAGMENTS_DIR, `${page}.meta.json`),
      JSON.stringify({
        page, title, description, og, bodyClass, fonts,
        css: css.map((c) => `/de-site/${c}`),
        js: [...VENDOR.map((v) => `/de-site/vendor/${v.file}`), ...js.map((j) => `/de-site/${j}`)],
      }, null, 2) + '\n'
    );
    process.stdout.write(`fragment: ${page} (${(frag.length / 1024).toFixed(1)} KB, ${js.length} scripts, ${css.length} css)\n`);

    // ── site KB doc: fragment text + the lazy late-content partial (most of
    // a deep-dive page's copy lives in the partial, not the fragment) ──
    let kbContent = htmlToText(frag);
    try {
      const late = await fs.readFile(path.join(SITE_ROOT, 'partials', `${page}-late-content.html`), 'utf8');
      kbContent += '\n\n' + htmlToText(late);
    } catch { /* no late partial for this page */ }
    kbDocs.push({
      page,
      url: KB_ROUTES[page] ?? (page === 'index' ? '/' : `/${page}`),
      title,
      description,
      content: kbContent.slice(0, 16000),
    });
  }

  await fs.writeFile(
    path.join(TARGET, 'lib', 'de-site', 'site-kb.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), docs: kbDocs }, null, 2) + '\n'
  );
  process.stdout.write(`site-kb: ${kbDocs.length} docs (${(kbDocs.reduce((n, d) => n + d.content.length, 0) / 1024).toFixed(0)} KB text)\n`);

  // ── css (scan for asset refs, rewrite nothing — ../assets resolves under /de-site/css/) ──
  // Page scripts lazy-load late JS/CSS after user intent. Discover that graph
  // before copying so platform routes don't request /inventory/js/... etc.
  for (let scanned = 0; scanned < jsToCopy.size; scanned += 1) {
    const j = [...jsToCopy][scanned];
    const text = await fs.readFile(path.join(SITE_ROOT, j), 'utf8');
    collectDynamicDeps(text, jsToCopy, cssToCopy);
  }

  let styleCssText = null;
  for (const c of cssToCopy) {
    const text = await fs.readFile(path.join(SITE_ROOT, c), 'utf8');
    if (c === 'css/style.css') styleCssText = text;
    collectAssetRefs(text, assetRefs);
    await fs.writeFile(path.join(PUBLIC_DIR, c.replace(/^css\//, 'css/')), text);
  }
  if (!styleCssText) {
    try {
      styleCssText = await fs.readFile(path.join(SITE_ROOT, 'css', 'style.css'), 'utf8');
    } catch {
      warn.push('de-chrome: css/style.css source not found — chrome css not emitted');
    }
  }
  // ── de-chrome.css for the platform's DeHeader/DeFooter ──
  if (styleCssText) {
    const chrome = extractChromeCss(styleCssText);
    collectAssetRefs(chrome, assetRefs);
    const chromeMin = minifyCss(chrome);
    await fs.writeFile(path.join(PUBLIC_DIR, 'css', 'de-chrome.css'), chromeMin);
    process.stdout.write(`de-chrome.css: ${(chromeMin.length / 1024).toFixed(1)} KB minified (${CHROME_SECTIONS.length} sections)\n`);
  } else {
    warn.push('de-chrome: css/style.css not among page stylesheets — chrome css not emitted');
  }
  ALWAYS_INCLUDE_ASSETS.forEach((a) => assetRefs.add(a));
  // ── partials (lazy-loaded by page JS via fetch("/de-site/partials/...")) ──
  const partialsSrc = path.join(SITE_ROOT, 'partials');
  try {
    const partialNames = await fs.readdir(partialsSrc);
    let partialCount = 0;
    for (const name of partialNames) {
      if (!name.endsWith('.html')) continue;
      const src = path.join(partialsSrc, name);
      let text = await fs.readFile(src, 'utf8');
      collectAssetRefs(text, assetRefs);
      text = neutralizeLandmarks(text);
      text = expandSelfClosingTags(text);
      text = rewriteInternalLinks(text);
      text = rewriteAssetPaths(text);
      await fs.writeFile(path.join(PUBLIC_DIR, 'partials', name), text);
      partialCount += 1;
    }
    process.stdout.write(`partials: ${partialCount} copied\n`);
  } catch {
    warn.push('partials: source directory not found');
  }

  // ── js (copy + scan string-literal asset refs the HTML scan can't see:
  //    app.js loads the hero frame sequence + case-study logos + ripple bg
  //    via JS, not markup) ──
  let copyFramesDir = false;
  for (const j of jsToCopy) {
    let text = await fs.readFile(path.join(SITE_ROOT, j), 'utf8');
    for (const m of text.matchAll(/assets\/([\w./-]+\.(?:svg|jpe?g|png|webp|mp4|webm|gif|avif))/gi)) assetRefs.add(m[1]);
    if (/assets\/frames\//.test(text)) copyFramesDir = true; // dynamic frame_${i}.webp sequence
    // Rewrite in-JS asset refs (string literals) to the served path, mirroring
    // rewriteAssetPaths for HTML/CSS. Without this, app.js requests e.g.
    // `assets/frames/frame_0001.webp` which on the platform resolves to
    // /assets/frames/... — the catch-all returns 200 HTML, the <img> fails to
    // decode (naturalWidth 0), and the hero canvas never paints.
    text = text
      .replace(/(['"`])assets\//g, '$1/de-site/assets/')
      .replace(/(['"`])partials\//g, '$1/de-site/partials/')
      .replace(/(['"`])js\//g, '$1/de-site/js/')
      .replace(/(['"`])css\//g, '$1/de-site/css/');
    await fs.writeFile(path.join(PUBLIC_DIR, j), text);
  }
  // ── vendor ──
  for (const v of VENDOR) {
    await fs.copyFile(path.join(vendorSrc, v.file), path.join(PUBLIC_DIR, 'vendor', v.file));
  }
  // ── referenced assets only (the full assets/ dir is ~90 MB; frames/ is homepage-only) ──
  let copied = 0, missing = 0, bytes = 0;
  for (const rel of [...assetRefs].sort()) {
    const src = path.join(SITE_ROOT, 'assets', rel);
    const dest = path.join(PUBLIC_DIR, 'assets', rel);
    try {
      const st = await fs.stat(src);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
      copied += 1; bytes += st.size;
    } catch {
      missing += 1;
      warn.push(`asset referenced but not found: assets/${rel}`);
    }
  }

  process.stdout.write(`assets: ${copied} copied (${(bytes / 1048576).toFixed(1)} MB), ${missing} missing\n`);

  // ── whole frames/ dir (homepage hero canvas — frame_${i}.webp built dynamically in app.js) ──
  if (copyFramesDir) {
    const framesSrc = path.join(SITE_ROOT, 'assets', 'frames');
    const framesDest = path.join(PUBLIC_DIR, 'assets', 'frames');
    await fs.mkdir(framesDest, { recursive: true });
    let fc = 0, fb = 0;
    for (const f of await fs.readdir(framesSrc)) {
      const st = await fs.stat(path.join(framesSrc, f));
      await fs.copyFile(path.join(framesSrc, f), path.join(framesDest, f));
      fc += 1; fb += st.size;
    }
    process.stdout.write(`frames/: ${fc} copied (${(fb / 1048576).toFixed(1)} MB)\n`);
  }
  if (warn.length) {
    process.stdout.write(`\nWARNINGS (${warn.length}):\n` + warn.map((w) => `  - ${w}`).join('\n') + '\n');
  }
  process.stdout.write(`\nexported ${PAGES.length} pages -> ${TARGET}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
