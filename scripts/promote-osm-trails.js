#!/usr/bin/env node
'use strict';

/**
 * promote-osm-trails.js
 *
 * Promotes every route in dog-friendly-routes.geojson to a full DoloPaws trail
 * entry, computing everything that can be honestly derived from verified data:
 *
 *   - path            converted to the site's [lat, lng] convention
 *   - distance        computed from geometry
 *   - elevationProfile + elevation gain   via Open-Meteo elevation API
 *   - safetyLevel / terrainRank           from computed sustained grade
 *   - hours           Naismith's rule estimate
 *   - waterSources    proximity-matched from water-sources-all-regions.geojson
 *   - rifugi          proximity-matched from huts-bars-all-regions.geojson
 *   - area            nearest known Dolomites locality
 *
 * Fields that CANNOT be derived (shade, hazards, paid access, preferred
 * direction, dog-specific notes) are left out or honestly marked unverified.
 * Every entry carries curated:false and its Waymarked Trails link.
 *
 * Output: osm-trails-data.js — loaded AFTER trails-data.js, it appends to the
 * trails array. trails-data.js stays the hand-curated single source of truth
 * and is never touched by this script.
 *
 * NOTE: Open-Meteo is used under its free non-commercial tier (same caveat as
 * the live weather integration).
 */

const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTES_PATH = path.join(ROOT, 'dog-friendly-routes.geojson');
const WATER_PATH = path.join(ROOT, 'water-sources-all-regions.geojson');
const HUTS_PATH = path.join(ROOT, 'huts-bars-all-regions.geojson');
const OUTPUT_PATH = path.join(ROOT, 'osm-trails-data.js');

const WATER_MATCH_METERS = 150;
const HUT_MATCH_METERS = 250;
const ACCESS_MATCH_METERS = 400;      // access point must be this close to the route
const ELEVATION_BATCH = 100;          // Open-Meteo max per request
const ELEVATION_SAMPLES = 80;         // sampled points per route
const ACCESS_PATH = path.join(ROOT, 'data', 'access-points.geojson');

// Real, well-known Dolomites localities used only to give each imported
// trail a meaningful "area" label (nearest locality to the route start).
const LOCALITIES = [
  ['Cortina d\'Ampezzo', 46.5405, 12.1357], ['Ortisei / Val Gardena', 46.5747, 11.6717],
  ['Selva di Val Gardena', 46.5551, 11.7605], ['Canazei / Val di Fassa', 46.4770, 11.7714],
  ['Corvara / Alta Badia', 46.5504, 11.8746], ['San Cassiano / Alta Badia', 46.5687, 11.9312],
  ['Dobbiaco / Toblach', 46.7357, 12.2210], ['San Candido / Innichen', 46.7327, 12.2800],
  ['Sesto / Sexten', 46.7025, 12.3500], ['Braies / Prags', 46.7207, 12.1350],
  ['Alpe di Siusi / Seiser Alm', 46.5402, 11.6181], ['Castelrotto / Kastelruth', 46.5670, 11.5599],
  ['San Martino di Castrozza', 46.2612, 11.8022], ['Madonna di Campiglio', 46.2295, 10.8269],
  ['Falcade / Val Biois', 46.3576, 11.8712], ['Arabba', 46.4977, 11.8747],
  ['Alleghe', 46.4066, 12.0209], ['Auronzo di Cadore', 46.5527, 12.4419],
  ['Val di Funes / Villnöss', 46.6440, 11.6810], ['Nova Levante / Carezza', 46.4300, 11.5380],
  ['Predazzo / Val di Fiemme', 46.3110, 11.6010], ['Bolzano / Bozen', 46.4983, 11.3548],
  ['Bressanone / Brixen', 46.7151, 11.6570], ['Vipiteno / Sterzing', 46.8977, 11.4331],
  ['Brunico / Bruneck', 46.7966, 11.9376], ['Belluno', 46.1420, 12.2167],
  ['Agordo', 46.2820, 12.0330], ['Pieve di Cadore', 46.4276, 12.3730],
  ['Fiera di Primiero', 46.1770, 11.8290], ['Cavalese', 46.2910, 11.4600]
];

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Flatten a (Multi)LineString into one [lat, lng] path, plus cumulative km.
function toPath(geometry) {
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  const pts = [];
  for (const line of lines) for (const [lng, lat] of line) pts.push([lat, lng]);
  const cumKm = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cumKm.push(cumKm[i - 1] + haversineMeters(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) / 1000);
  }
  return { pts, cumKm, segments: lines.length };
}

function sampleAlong(pts, cumKm, count) {
  if (pts.length <= count) return pts.map((p, i) => ({ lat: p[0], lng: p[1], km: cumKm[i] }));
  const total = cumKm[cumKm.length - 1];
  const out = [];
  let idx = 0;
  for (let s = 0; s < count; s += 1) {
    const target = (total * s) / (count - 1);
    while (idx < cumKm.length - 1 && cumKm[idx] < target) idx += 1;
    out.push({ lat: pts[idx][0], lng: pts[idx][1], km: cumKm[idx] });
  }
  return out;
}

async function fetchElevations(samples) {
  const elevations = [];
  for (let i = 0; i < samples.length; i += ELEVATION_BATCH) {
    const batch = samples.slice(i, i + ELEVATION_BATCH);
    const url = 'https://api.open-meteo.com/v1/elevation'
      + `?latitude=${batch.map((p) => p.lat.toFixed(5)).join(',')}`
      + `&longitude=${batch.map((p) => p.lng.toFixed(5)).join(',')}`;
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt += 1) {
      try {
        const res = await fetch(url, { headers: { 'user-agent': 'DoloPaws-trail-builder/1.0 (+https://dolopaws.com)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        elevations.push(...data.elevation);
        ok = true;
      } catch (err) {
        console.warn(`[elev] attempt ${attempt} failed: ${err.message}`);
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
    if (!ok) return null; // give up on this route's elevation, keep the trail
    await new Promise((r) => setTimeout(r, 250));
  }
  return elevations;
}

function buildProfile(samples, elevations, totalKm) {
  // Reduce to ~12 evenly spaced profile points for the chart.
  const step = Math.max(1, Math.floor(samples.length / 12));
  const profile = [];
  for (let i = 0; i < samples.length; i += step) {
    profile.push({ km: Math.round(samples[i].km * 10) / 10, elev: Math.round(elevations[i]) });
  }
  const last = samples.length - 1;
  if (profile[profile.length - 1].km !== Math.round(samples[last].km * 10) / 10) {
    profile.push({ km: Math.round(totalKm * 10) / 10, elev: Math.round(elevations[last]) });
  }
  return profile;
}

function computeGainAndGrade(samples, elevations) {
  let gain = 0;
  let maxGrade = 0;
  for (let i = 1; i < elevations.length; i += 1) {
    const dElev = elevations[i] - elevations[i - 1];
    const dKm = samples[i].km - samples[i - 1].km;
    if (dElev > 2) gain += dElev; // ignore sub-noise wiggles
    if (dKm > 0.05) maxGrade = Math.max(maxGrade, Math.abs(dElev) / (dKm * 1000));
  }
  return { gain: Math.round(gain), maxGrade };
}

function rateSafety(maxGrade) {
  // Sustained grade thresholds; conservative because unverified.
  if (maxGrade < 0.10) return { safetyLevel: 'low-risk', terrainRank: 0 };
  if (maxGrade < 0.18) return { safetyLevel: 'moderate', terrainRank: 1 };
  return { safetyLevel: 'caution', terrainRank: 2 };
}

function naismithHours(km, gainM) {
  const h = km / 4.5 + gainM / 600;
  const lo = Math.max(0.5, Math.round(h * 2) / 2);
  const hi = Math.round((h * 1.3) * 2) / 2;
  return hi > lo ? `${fmtH(lo)}–${fmtH(hi)}` : `${fmtH(lo)}`;
  function fmtH(v) { return Number.isInteger(v) ? String(v) : v.toFixed(1); }
}

// Spatial grid index so 178 routes x 28k POIs stays fast.
function buildIndex(features, cell = 0.01) {
  const grid = new Map();
  for (const f of features) {
    if (!f.geometry) continue;
    const [lng, lat] = f.geometry.type === 'Point'
      ? f.geometry.coordinates
      : (f.geometry.coordinates[0][0] ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0]);
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const key = `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push({ lat, lng, props: f.properties || {} });
  }
  return { grid, cell };
}

function nearIndex(index, lat, lng) {
  const { grid, cell } = index;
  const r = Math.floor(lat / cell);
  const c = Math.floor(lng / cell);
  const out = [];
  for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
    const bucket = grid.get(`${r + dr}:${c + dc}`);
    if (bucket) out.push(...bucket);
  }
  return out;
}

function matchAlongPath(pts, cumKm, index, maxMeters, labelFn) {
  const found = new Map(); // dedupe by POI identity
  for (let i = 0; i < pts.length; i += 2) {
    for (const poi of nearIndex(index, pts[i][0], pts[i][1])) {
      const d = haversineMeters(pts[i][0], pts[i][1], poi.lat, poi.lng);
      if (d <= maxMeters) {
        const id = `${poi.lat.toFixed(5)},${poi.lng.toFixed(5)}`;
        const km = Math.round(cumKm[i] * 10) / 10;
        if (!found.has(id) || found.get(id).km > km) {
          found.set(id, { km, ...labelFn(poi) });
        }
      }
    }
  }
  return [...found.values()].sort((a, b) => a.km - b.km);
}

function nearestLocality(lat, lng) {
  let best = null;
  let bestD = Infinity;
  for (const [name, la, ln] of LOCALITIES) {
    const d = haversineMeters(lat, lng, la, ln);
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

/* ---------------- Verified start points, orientation, terrain, direction --- */

// Find the access point (parking / lift / bus stop) closest to the route,
// and the path vertex closest to it.
function findBestAccess(pts, accessIndex) {
  let best = null;
  for (let i = 0; i < pts.length; i += 2) {
    for (const ap of nearIndex(accessIndex, pts[i][0], pts[i][1])) {
      const d = haversineMeters(pts[i][0], pts[i][1], ap.lat, ap.lng);
      if (d <= ACCESS_MATCH_METERS && (!best || d < best.dist)) {
        best = { dist: Math.round(d), vertexIndex: i, ap };
      }
    }
  }
  return best;
}

// Rotate a closed-loop path so it starts at the given vertex.
function rotateLoop(pts, startIndex) {
  if (startIndex === 0) return pts;
  const rotated = pts.slice(startIndex).concat(pts.slice(1, startIndex + 1));
  return rotated;
}

function recomputeCumKm(pts) {
  const cumKm = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cumKm.push(cumKm[i - 1] + haversineMeters(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) / 1000);
  }
  return cumKm;
}

function accessLabel(best, isLoop) {
  const kindLabel = best.ap.props.kind === 'parking' ? 'Parking'
    : best.ap.props.kind === 'lift station' ? 'Lift station' : 'Bus stop';
  const name = best.ap.props.name ? ` ${best.ap.props.name}` : '';
  return `Start here — ${kindLabel}${name}, ${best.dist} m from the route (OSM-verified access point)`;
}

// Human terrain description from OSM surface tags (km per surface).
const SURFACE_LABELS = {
  gravel: 'gravel', fine_gravel: 'fine gravel', compacted: 'compacted gravel',
  asphalt: 'paved', paved: 'paved', concrete: 'paved', paving_stones: 'paved',
  ground: 'natural ground', dirt: 'dirt', earth: 'dirt', grass: 'grass',
  rock: 'rock', stone: 'rock', gravel_turf: 'gravel-turf', unpaved: 'unpaved',
  sand: 'sand', wood: 'boardwalk', mud: 'mud'
};

function describeTerrain(surfaces, totalKm) {
  if (!surfaces) return { text: 'Surface not yet field-verified', rocky: false, coverage: 0 };
  const grouped = {};
  let taggedKm = 0;
  for (const [key, km] of Object.entries(surfaces)) {
    const label = SURFACE_LABELS[key] || key.replace(/_/g, ' ');
    grouped[label] = (grouped[label] || 0) + km;
    taggedKm += km;
  }
  const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3).map(([label, km]) => `${label} (${Math.round((km / taggedKm) * 100)}%)`);
  const coverage = Math.min(1, taggedKm / Math.max(totalKm, 0.1));
  const prefix = coverage >= 0.75 ? '' : coverage >= 0.4 ? 'Partially mapped: ' : 'Sparsely mapped: ';
  return {
    text: `${prefix}${top.join(', ')} — from OSM surface data`,
    rocky: sorted.some(([label], idx) => idx < 2 && (label === 'rock' || label === 'mud')),
    coverage
  };
}

// For loops with elevation data: does the route climb more gently as-is or
// reversed? Returns { reverse: bool, note: string } — computed, not opinion.
function pickGentlerDirection(samples, elevations) {
  const grade = (dir) => {
    let maxG = 0;
    const n = samples.length;
    for (let i = 1; i < n; i += 1) {
      const a = dir === 1 ? i - 1 : n - i;
      const b = dir === 1 ? i : n - 1 - i;
      const dElev = elevations[b] - elevations[a];
      const dKm = Math.abs(samples[b].km - samples[a].km);
      if (dElev > 0 && dKm > 0.05) maxG = Math.max(maxG, dElev / (dKm * 1000));
    }
    return maxG;
  };
  const fwd = grade(1);
  const rev = grade(-1);
  if (rev < fwd * 0.85) {
    return { reverse: true, note: 'Direction shown climbs more gradually (computed from elevation data).' };
  }
  if (fwd < rev * 0.85) {
    return { reverse: false, note: 'Direction shown climbs more gradually (computed from elevation data).' };
  }
  return { reverse: false, note: null }; // symmetric — no recommendation
}

async function main() {
  const routes = JSON.parse(await fs.readFile(ROUTES_PATH, 'utf8'));
  const water = JSON.parse(await fs.readFile(WATER_PATH, 'utf8'));
  const huts = JSON.parse(await fs.readFile(HUTS_PATH, 'utf8'));
  let accessIndex = null;
  try {
    const access = JSON.parse(await fs.readFile(ACCESS_PATH, 'utf8'));
    accessIndex = buildIndex(access.features);
    console.log(`[promote] ${access.features.length} access points loaded.`);
  } catch {
    console.warn('[promote] No access-points.geojson — start points fall back to route geometry.');
  }

  const waterIndex = buildIndex(water.features);
  const hutIndex = buildIndex(huts.features.filter((f) =>
    (f.properties || {}).name && /alpine_hut|wilderness_hut|restaurant|cafe|bar/.test(
      `${f.properties.tourism || ''}|${f.properties.amenity || ''}`)));

  console.log(`[promote] ${routes.features.length} routes to promote.`);
  const entries = [];

  for (const [n, feature] of routes.features.entries()) {
    const p = feature.properties;
    const isLoop = p.loop === true || p.loop === 'true';
    let { pts, segments } = toPath(feature.geometry);
    let cumKm = recomputeCumKm(pts);

    // --- Verified start point: anchor to the nearest real access point ---
    let startLabel = 'Route start per OpenStreetMap — best parking/access not yet verified';
    if (accessIndex && segments === 1) {
      const best = findBestAccess(pts, accessIndex);
      if (best) {
        if (isLoop) {
          pts = rotateLoop(pts, best.vertexIndex);         // loop now begins at the access point
        } else if (best.vertexIndex > pts.length / 2) {
          pts = pts.slice().reverse();                     // start the line from the accessible end
        }
        cumKm = recomputeCumKm(pts);
        startLabel = accessLabel(best, isLoop);
      }
    }

    const totalKm = Math.round(cumKm[cumKm.length - 1] * 10) / 10;
    const samples = sampleAlong(pts, cumKm, ELEVATION_SAMPLES);

    console.log(`[promote] ${n + 1}/${routes.features.length} ${p.name} (${totalKm} km)…`);
    const elevations = await fetchElevations(samples);

    let elevationProfile = null;
    let gain = null;
    let directionNote = null;
    let rating = { safetyLevel: 'moderate', terrainRank: 1 }; // conservative default if elevation unavailable
    if (elevations && elevations.length === samples.length) {
      // --- Recommended direction for loops: the gentler climb, computed ---
      if (isLoop) {
        const dir = pickGentlerDirection(samples, elevations);
        if (dir.reverse) {
          pts = pts.slice().reverse();
          cumKm = recomputeCumKm(pts);
          // Even sampling is symmetric, so reversed elevations line up with
          // freshly sampled points on the reversed path.
          const fresh = sampleAlong(pts, cumKm, ELEVATION_SAMPLES);
          samples.length = 0; samples.push(...fresh);
          elevations.reverse();
        }
        directionNote = dir.note;
      }
      elevationProfile = buildProfile(samples, elevations, totalKm);
      const g = computeGainAndGrade(samples, elevations);
      gain = g.gain;
      rating = rateSafety(g.maxGrade);
    }

    // --- Terrain from OSM surface tags ---
    const terrain = describeTerrain(p.surfaces, totalKm);
    if (terrain.rocky && rating.terrainRank < 2) rating.terrainRank += 1;

    const waterSources = matchAlongPath(pts, cumKm, waterIndex, WATER_MATCH_METERS,
      (poi) => ({ label: poi.props.name || 'Drinking water (OSM-verified location)' }));
    const rifugi = matchAlongPath(pts, cumKm, hutIndex, HUT_MATCH_METERS,
      (poi) => ({ name: poi.props.name }));
    const entry = {
      id: `osm-${p.osm_relation}`,
      source: 'osm', curated: false,
      osmRelation: p.osm_relation,
      waymarkedtrails: p.waymarkedtrails,
      name: p.name, area: nearestLocality(pts[0][0], pts[0][1]),
      lat: pts[0][0], lng: pts[0][1],
      path: pts.map(([la, ln]) => [Math.round(la * 1e5) / 1e5, Math.round(ln * 1e5) / 1e5]),
      distance: totalKm,
      elevation: gain,
      hours: gain !== null ? naismithHours(totalKm, gain) : null,
      terrainType: terrain.text,
      terrainRank: rating.terrainRank,
      elevationProfile,
      surfaceHazards: [],
      safetyLevel: rating.safetyLevel,
      waterSources,
      rifugi,
      startPoint: { lat: pts[0][0], lng: pts[0][1], label: startLabel },
      desc: `${isLoop ? 'A' : 'An'} ${totalKm} km ${isLoop ? 'loop' : 'route'} near ${nearestLocality(pts[0][0], pts[0][1])}, imported from the OpenStreetMap hiking network${p.ref ? ` (trail ${p.ref})` : ''}. Passed automated dog-suitability screening: no via ferrata, ladders, or alpine-grade (T3+) sections on record.${directionNote ? ' ' + directionNote : ''}`,
      tips: 'Imported route — elevation, distance, fountains and rifugi are computed from verified map data, but this trail has not yet been walked and reviewed by DoloPaws. Check conditions locally.',
      ...(segments > 1 ? { osmGeometryGaps: segments - 1 } : {})
    };
    if (p.leash) entry.leash = p.leash;
    if (p.dogFriendlyNotes) entry.dogNotes = p.dogFriendlyNotes;
    entries.push(entry);
  }

  const banner = '// AUTO-GENERATED by scripts/promote-osm-trails.js — do not edit by hand.\n'
    + '// Curated trails live in trails-data.js; this file appends OSM-imported trails.\n'
    + '// Data: © OpenStreetMap contributors (ODbL); elevation: Open-Meteo (non-commercial).\n';
  const js = `${banner}const osmTrails = ${JSON.stringify(entries)};\n`
    + `if (typeof trails !== 'undefined' && Array.isArray(trails)) { trails.push(...osmTrails); }\n`;
  await fs.writeFile(OUTPUT_PATH, js);
  console.log(`[done] Wrote ${entries.length} promoted trails -> ${OUTPUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
