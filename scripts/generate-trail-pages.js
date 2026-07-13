#!/usr/bin/env node
/**
 * generate-trail-pages.js — DoloPaws static trail page generator.
 *
 * Reads the three trail datasets (trails-data.js, osm-trails-data.js,
 * osm-trails-savoy-data.js), assigns regions via regions-config.js, and emits:
 *
 *   trails/<slug>.html   one crawlable, pre-rendered page per trail
 *   sitemap.xml          all public pages + every trail page
 *
 * Run at build time only (GitHub Actions or locally). Nothing here ships
 * as client-side JS. Pages reuse styles.css so they match the live site.
 *
 * Usage: node scripts/generate-trail-pages.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'trails');
const BASE_URL = 'https://www.dolopaws.com';

// ---------------------------------------------------------------
// 1. Load trail data exactly the way the browser does: concatenate
//    the scripts so they share one scope, then hand back `trails`.
// ---------------------------------------------------------------
function loadTrails() {
  const files = [
    'trails-data.js',
    'osm-trails-data.js',
    'osm-trails-savoy-data.js',
    'regions-config.js',
  ];
  const src = files
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n;\n');

  let result = null;
  const sandbox = {
    window: {},
    console,
    __capture: (t) => { result = t; },
  };
  vm.runInNewContext(
    src + '\n;window.DoloPawsRegions.assign(trails); __capture(trails);',
    sandbox,
    { filename: 'trail-data-bundle.js' }
  );
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Failed to load trails — got ' + result);
  }
  return result;
}

// ---------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function truncate(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}

function safetyClass(level) {
  if (level === 'low-risk') return 'safety-low';
  if (level === 'moderate') return 'safety-moderate';
  return 'safety-caution';
}

function safetyLabel(level) {
  if (level === 'low-risk') return 'Low-risk';
  if (level === 'moderate') return 'Moderate';
  return 'Caution';
}

const REGION_LABEL = { dolomites: 'Dolomites, Italy', savoy: 'Savoy, France' };

// ---------------------------------------------------------------
// 3. Page template
// ---------------------------------------------------------------
function trailPage(t, slug) {
  const title = `${t.name} — dog-friendly trail — DoloPaws`;
  const desc = truncate(
    t.desc || `${t.name}: a ${t.distance} km dog-friendly trail near ${t.area}.`,
    155
  );
  const canonical = `${BASE_URL}/trails/${slug}.html`;
  const regionLabel = REGION_LABEL[t.region] || 'Dolomites, Italy';
  const verified = t.curated !== false; // curated file entries have no `curated` flag

  const badge = verified
    ? '<span class="badge-verified" style="padding:3px 10px;border-radius:999px;font-size:.78rem;font-weight:600;">🐾 Verified by DoloPaws</span>'
    : '<span class="badge-imported" style="padding:3px 10px;border-radius:999px;font-size:.78rem;font-weight:600;">🗺️ Imported from OpenStreetMap</span>';

  const ogImage = t.imageIcon ? `${BASE_URL}/${t.imageIcon}` : `${BASE_URL}/icon-512.png`;

  // Guard against upstream "NaN%" surface strings (promote-osm-trails.js bug)
  const terrain = /NaN/.test(String(t.terrainType || ''))
    ? 'Surface data not yet mapped'
    : t.terrainType;

  const facts = [
    ['Distance', `${t.distance} km`],
    ['Elevation gain', `${t.elevation} m`],
    ['Duration', `${t.hours} h`],
    ['Terrain', terrain],
    ['Trail rating', safetyLabel(t.safetyLevel)],
    ['Area', `${t.area} · ${regionLabel}`],
  ]
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<div class="sp-fact"><div class="sp-fact-k">${escapeHtml(k)}</div><div class="sp-fact-v">${escapeHtml(v)}</div></div>`
    )
    .join('\n      ');

  const waterHtml =
    Array.isArray(t.waterSources) && t.waterSources.length
      ? `<h2>Water on trail</h2>
    <ul>${t.waterSources
          .map((w) => `<li>km ${escapeHtml(w.km)} — ${escapeHtml(w.label || 'Water source')}</li>`)
          .join('')}</ul>`
      : '';

  const rifugiHtml =
    Array.isArray(t.rifugi) && t.rifugi.length
      ? `<h2>Rifugi &amp; refreshment</h2>
    <ul>${t.rifugi
          .map((r) => `<li>km ${escapeHtml(r.km)} — ${escapeHtml(r.name || 'Rifugio')}</li>`)
          .join('')}</ul>`
      : '';

  const tipsHtml = t.tips
    ? `<h2>Good to know</h2>
    <p>${escapeHtml(t.tips)}</p>`
    : '';

  const startHtml =
    t.startPoint && t.startPoint.label
      ? `<h2>Where to start</h2>
    <p>${escapeHtml(t.startPoint.label)}</p>`
      : '';

  const insightsHtml =
    Array.isArray(t.insights) && t.insights.length
      ? `<h2>Field notes</h2>
    ${t.insights
          .map((i) => {
            const srcLabel = i.source ? escapeHtml(i.source) : '';
            const src = i.url
              ? ` <span class="sp-src">— <a href="${escapeHtml(i.url)}" rel="noopener">${srcLabel}</a></span>`
              : srcLabel
                ? ` <span class="sp-src">— ${srcLabel}</span>`
                : '';
            return `<p>${escapeHtml(i.en || '')}${src}</p>`;
          })
          .join('\n    ')}`
      : '';

  const osmCredit = !verified
    ? `<p class="sp-src" style="margin-top:20px;">Route data © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a> (ODbL). This trail has not yet been walked and reviewed by DoloPaws.</p>`
    : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: t.name,
    description: desc,
    url: canonical,
    geo: { '@type': 'GeoCoordinates', latitude: t.lat, longitude: t.lng },
    isAccessibleForFree: !t.paid,
    address: { '@type': 'PostalAddress', addressCountry: t.region === 'savoy' ? 'FR' : 'IT' },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#2E4034">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../favicon-16.png">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../styles.css">
<style>
  .sp-hero{padding-top:28px;}
  .sp-breadcrumb{font-size:.85rem;color:var(--ink-soft,#666);margin-bottom:14px;}
  .sp-breadcrumb a{color:inherit;}
  .sp-badges{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 18px;}
  .sp-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0 26px;}
  .sp-fact{background:rgba(0,0,0,.035);border-radius:10px;padding:10px 14px;}
  .sp-fact-k{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft,#666);}
  .sp-fact-v{font-weight:600;margin-top:2px;}
  .sp-body h2{margin-top:28px;}
  .sp-src{font-size:.85rem;color:var(--ink-soft,#666);}
  .sp-cta{display:inline-block;margin:26px 0;padding:12px 22px;background:#2E4034;color:#fff;border-radius:10px;font-weight:600;text-decoration:none;}
  .sp-img{max-width:100%;width:480px;max-height:300px;object-fit:cover;border-radius:12px;margin:6px 0 14px;display:block;}
</style>
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 1)}
</script>
</head>
<body>

<div class="topnav">
  <a class="brand" href="../index.html"><img src="../logo.svg?v=3" alt="DoloPaws logo">DoloPaws</a>
  <div class="links">
    <a href="../index.html">Home</a>
    <a href="../browse-trails.html">Browse our trails</a>
    <a href="../safety-guide.html">Dog safety guide</a>
    <a href="../about.html">About</a>
  </div>
</div>

<div class="wrap sp-hero">
  <div class="sp-breadcrumb"><a href="../browse-trails.html">All trails</a> › ${escapeHtml(regionLabel)} › ${escapeHtml(t.valley || t.area)}</div>
  <h1>${escapeHtml(t.name)}</h1>
  <div class="sp-badges">
    <span class="safety-badge ${safetyClass(t.safetyLevel)}">${safetyLabel(t.safetyLevel)}</span>
    ${badge}
    ${t.paid ? '<span class="tag">Paid access</span>' : ''}
  </div>
  ${t.imageIcon ? `<img class="sp-img" src="../${escapeHtml(t.imageIcon)}" alt="${escapeHtml(t.name)}">` : ''}
  <p>${escapeHtml(t.desc || '')}</p>

  <div class="sp-facts">
      ${facts}
  </div>

  <a class="sp-cta" href="../trail.html?id=${encodeURIComponent(t.id)}">Open the interactive map, elevation profile &amp; live weather →</a>

  <div class="sp-body">
    ${startHtml}
    ${waterHtml}
    ${rifugiHtml}
    ${tipsHtml}
    ${insightsHtml}
    <h2>Is this trail right for <em>your</em> dog?</h2>
    <p>The trail rating above describes the mountain — it's the same for every dog. What it can't tell you is how this route pairs with your dog's build, age, and health. <a href="../account.html">Create your dog's free profile</a> and DoloPaws scores every trail against your dog on six real safety factors: terrain, shade, water access, distance, exposure, and heat risk.</p>
    ${osmCredit}
  </div>
</div>

<div class="wrap" style="padding:30px 0 40px;color:var(--ink-soft,#666);font-size:.85rem;">
  DoloPaws | A personalised trail guide for dogs and their humans.
</div>

</body>
</html>
`;
}

// ---------------------------------------------------------------
// 4. Sitemap
// ---------------------------------------------------------------
function sitemap(urls) {
  const today = new Date().toISOString().slice(0, 10);
  const items = urls
    .map(
      (u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

// ---------------------------------------------------------------
// 5. Crawlable trail index injected into browse-trails.html
//    (between TRAIL-INDEX-START/END markers)
// ---------------------------------------------------------------
function updateBrowseIndex(entries) {
  const file = path.join(ROOT, 'browse-trails.html');
  if (!fs.existsSync(file)) return console.warn('browse-trails.html not found — skipping index.');
  const html = fs.readFileSync(file, 'utf8');
  const START = '<!-- TRAIL-INDEX-START (auto-generated by scripts/generate-trail-pages.js — do not edit by hand) -->';
  const END = '<!-- TRAIL-INDEX-END -->';
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a === -1 || b === -1) return console.warn('Index markers not found in browse-trails.html — skipping.');

  const byRegion = { dolomites: [], savoy: [] };
  for (const e of entries) (byRegion[e.region] || byRegion.dolomites).push(e);
  for (const k of Object.keys(byRegion)) byRegion[k].sort((x, y) => x.name.localeCompare(y.name));

  const block = ['dolomites', 'savoy']
    .filter((r) => byRegion[r].length)
    .map(
      (r) =>
        `<p style="font-weight:700;color:var(--ink);break-inside:avoid;">${escapeHtml(REGION_LABEL[r])}</p>\n` +
        byRegion[r]
          .map((e) => `<a href="trails/${e.slug}.html" style="display:block;color:inherit;">${escapeHtml(e.name)}</a>`)
          .join('\n')
    )
    .join('\n');

  fs.writeFileSync(file, html.slice(0, a + START.length) + '\n' + block + '\n' + html.slice(b), 'utf8');
  console.log(`Updated trail index in browse-trails.html (${entries.length} links).`);
}

// ---------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------
function main() {
  const trails = loadTrails();
  console.log(`Loaded ${trails.length} trails.`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const seen = new Set();
  const urls = [
    `${BASE_URL}/`,
    `${BASE_URL}/browse-trails.html`,
    `${BASE_URL}/safety-guide.html`,
    `${BASE_URL}/about.html`,
  ];

  let written = 0;
  const indexEntries = [];
  for (const t of trails) {
    let slug = slugify(t.name) || slugify(t.id);
    if (seen.has(slug)) slug = `${slug}-${slugify(t.id)}`;
    if (seen.has(slug)) { console.warn(`Skipping duplicate slug: ${slug}`); continue; }
    seen.add(slug);

    fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), trailPage(t, slug), 'utf8');
    urls.push(`${BASE_URL}/trails/${slug}.html`);
    indexEntries.push({ slug, name: t.name, region: t.region });
    written++;
  }

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap(urls), 'utf8');
  updateBrowseIndex(indexEntries);

  console.log(`Wrote ${written} trail pages and sitemap.xml (${urls.length} URLs).`);
}

main();
