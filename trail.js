function safetyLabel(level){
  if(level === 'low-risk') return t('safety.low');
  if(level === 'moderate') return t('safety.moderate');
  return t('safety.caution');
}
function safetyColor(level){
  if(level === 'low-risk') return '#2C5C34';
  if(level === 'moderate') return '#8A5A16';
  return '#9C3A25';
}

function safetyClass(level){
  if(level === 'low-risk') return 'safety-low';
  if(level === 'moderate') return 'safety-moderate';
  return 'safety-caution';
}

function renderTrailDetailContent(t){
  const rifugi = Array.isArray(t.rifugi) ? t.rifugi : [];
  const water = Array.isArray(t.waterSources) ? t.waterSources : [];

  const rifugiHtml = rifugi.length > 0
    ? `<ul style="margin:0 0 14px;padding-left:18px;">${rifugi.map(r => `<li>Km ${r.km} — ${r.name}</li>`).join('')}</ul>`
    : `<p style="margin:0 0 14px;">${window.t('trail.noRifugi')}</p>`;

  const waterHtml = water.length > 0
    ? `<ul style="margin:0 0 14px;padding-left:18px;">${water.map(w => `<li>Km ${w.km} — ${w.label}</li>`).join('')}</ul>`
    : `<p style="margin:0 0 14px;">${window.t('trail.noWater')}</p>`;

  return `
    <div style="margin-bottom:14px;">
      <div style="font-weight:700;color:var(--ink);margin-bottom:4px;">${window.t('trail.rifugiHead')}</div>
      ${rifugiHtml}
    </div>
    <div style="margin-bottom:14px;">
      <div style="font-weight:700;color:var(--ink);margin-bottom:4px;">${window.t('trail.waterHead')}</div>
      ${waterHtml}
    </div>
  `;
}

function distMeters(a, b){
  return Math.hypot(a[0]-b[0], a[1]-b[1]) * 111000;
}

// Finds the real point along an actual GPS path at a given fraction of its
// total length (0 = start, 1 = end). Used to place rifugi/water icons at
// their true position on the map, rather than guessing coordinates.
function pointAtFraction(path, fraction){
  const total = path.reduce((sum, p, i) => i === 0 ? 0 : sum + distMeters(path[i-1], p), 0);
  const target = total * Math.max(0, Math.min(1, fraction));
  let acc = 0;
  for(let i = 0; i < path.length - 1; i++){
    const seg = distMeters(path[i], path[i+1]);
    if(acc + seg >= target){
      const t = seg > 0 ? (target - acc) / seg : 0;
      return [
        path[i][0] + (path[i+1][0] - path[i][0]) * t,
        path[i][1] + (path[i+1][1] - path[i][1]) * t,
      ];
    }
    acc += seg;
  }
  return path[path.length - 1];
}

// Elevation profile chart with two-way hover sync: hovering the chart moves
// a cursor dot on the map; hovering near the route on the map highlights
// the matching point on the chart. Honest note on data granularity: this
// draws whatever is in t.elevationProfile — currently a sparse 5-6 point
// sample for hand-built trails, but it'll render just as correctly (and
// more smoothly) once a trail has real per-vertex elevation from the
// build-trail.mjs/build-route.mjs pipeline. The chart code doesn't care
// which source the numbers came from.
function setupElevationProfile(map, t){
  if(!Array.isArray(t.elevationProfile) || t.elevationProfile.length < 2 || !Array.isArray(t.path)) return;

  const wrap = document.getElementById('elevationProfileWrap');
  const svg = document.getElementById('elevProf');
  const readout = document.getElementById('elevReadout');
  wrap.hidden = false;

  const profile = t.elevationProfile; // [{km, elev}, ...]
  const totalKm = t.distance;
  const elevs = profile.map(p => p.elev);
  const eMin = Math.min(...elevs), eMax = Math.max(...elevs);
  const VW = 1000, VH = 170, padL = 6, padR = 6, padT = 14, padB = 20;
  const x = km => padL + (km / totalKm) * (VW - padL - padR);
  const y = elev => padT + (1 - (elev - eMin) / ((eMax - eMin) || 1)) * (VH - padT - padB);

  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for(const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  let dLine = `M ${x(profile[0].km)} ${y(profile[0].elev)}`;
  profile.slice(1).forEach(p => { dLine += ` L ${x(p.km)} ${y(p.elev)}`; });
  const areaD = `${dLine} L ${x(profile[profile.length-1].km)} ${VH-padB} L ${x(profile[0].km)} ${VH-padB} Z`;
  svg.appendChild(mk('path', { d: areaD, fill: '#2E4034', opacity: '0.1' }));
  svg.appendChild(mk('path', { d: dLine, fill: 'none', stroke: '#2E4034', 'stroke-width': '2' }));

  [eMin, (eMin+eMax)/2, eMax].forEach(v => {
    svg.appendChild(mk('line', { x1: padL, x2: VW-padR, y1: y(v), y2: y(v), stroke: 'var(--paper-line)', 'stroke-width': '1' }));
    const label = mk('text', { x: padL+4, y: y(v)-3, 'font-size': '10', fill: 'var(--ink-soft)' });
    label.textContent = `${Math.round(v)} m`;
    svg.appendChild(label);
  });

  const cursorLine = mk('line', { y1: padT, y2: VH-padB, stroke: '#6FA8BE', 'stroke-width': '1.5', 'stroke-dasharray': '3 3', opacity: '0' });
  const cursorDot = mk('circle', { r: '4', fill: '#6FA8BE', stroke: '#fff', 'stroke-width': '1.5', opacity: '0' });
  svg.appendChild(cursorLine);
  svg.appendChild(cursorDot);

  // Map cursor marker
  map.addSource('elev-cursor', { type: 'geojson', data: { type: 'Point', coordinates: t.path[0].slice().reverse() } });
  map.addLayer({
    id: 'elev-cursor-layer', type: 'circle', source: 'elev-cursor',
    paint: { 'circle-radius': 6, 'circle-color': '#6FA8BE', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-opacity': 0 },
  });

  function highlightAtKm(km){
    cursorLine.setAttribute('x1', x(km)); cursorLine.setAttribute('x2', x(km)); cursorLine.setAttribute('opacity', '1');
    // interpolate elevation for a smooth readout even between sparse samples
    let elev = profile[0].elev;
    for(let i = 1; i < profile.length; i++){
      if(km <= profile[i].km){
        const span = profile[i].km - profile[i-1].km;
        const frac = span > 0 ? (km - profile[i-1].km) / span : 0;
        elev = profile[i-1].elev + (profile[i].elev - profile[i-1].elev) * frac;
        break;
      }
    }
    cursorDot.setAttribute('cx', x(km)); cursorDot.setAttribute('cy', y(elev)); cursorDot.setAttribute('opacity', '1');
    readout.textContent = `${km.toFixed(1)} km · ${Math.round(elev)} m`;

    const [lat, lng] = pointAtFraction(t.path, totalKm > 0 ? km / totalKm : 0);
    const src = map.getSource('elev-cursor');
    if(src){ src.setData({ type: 'Point', coordinates: [lng, lat] }); map.setPaintProperty('elev-cursor-layer', 'circle-opacity', 1); }
  }

  // Let hike-mode.js drive the same cursor from live GPS position.
  window._dolopawsElevHighlight = highlightAtKm;

  svg.addEventListener('mousemove', (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = (ev.clientX - rect.left) / rect.width * VW;
    const km = Math.max(0, Math.min(totalKm, ((px - padL) / (VW - padL - padR)) * totalKm));
    highlightAtKm(km);
  });

  // Map -> chart: hovering near the route line highlights the matching point
  map.on('mousemove', (e) => {
    let bestKm = 0, bestDist = Infinity, acc = 0;
    for(let i = 0; i < t.path.length; i++){
      const d = distMeters([e.lngLat.lat, e.lngLat.lng], t.path[i]);
      if(d < bestDist){ bestDist = d; bestKm = (i / (t.path.length - 1)) * totalKm; }
    }
    if(bestDist < 80) highlightAtKm(bestKm); // only react when hovering near the actual route
  });
}

function makeIconEl(iconKey, bgColor){
  if(window.DoloPawsIcons) return window.DoloPawsIcons.createMarkerElement(iconKey, { color: bgColor });
  const fallback = document.createElement('div');
  fallback.className = 'dp-marker';
  fallback.style.background = bgColor;
  fallback.style.borderRadius = '50%';
  fallback.style.border = '2px solid #fff';
  fallback.textContent = '•';
  return fallback;
}

function addTerrainToggle(map, containerId, exaggeration, pitch3D){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.style.position = container.style.position || 'relative';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = window.t('trail.view3d');
  btn.className = 'map-btn';
  btn.style.left = '10px';
  container.appendChild(btn);

  let is3D = false; // clean, flat, label-first map by default
  btn.addEventListener('click', () => {
    if(!is3D){
      map.setTerrain({ source: 'terrain-dem', exaggeration });
      if(!map.getLayer('hillshade-layer')){
        map.addLayer({
          id: 'hillshade-layer',
          type: 'hillshade',
          source: 'terrain-dem',
          paint: { 'hillshade-exaggeration': 0.3 },
        }, 'waymarked-hiking-layer'); // keep hillshade below the trail overlay and labels
      }
      map.easeTo({ pitch: pitch3D || 0, duration: 500 });
      btn.textContent = window.t('trail.viewFlat');
    } else {
      map.setTerrain(null);
      if(map.getLayer('hillshade-layer')) map.removeLayer('hillshade-layer');
      map.easeTo({ pitch: 0, duration: 500 });
      btn.textContent = window.t('trail.view3d');
    }
    is3D = !is3D;
  });
}

function increaseLabelDensity(map){
  const layers = map.getStyle().layers || [];
  layers.forEach(layer => {
    if(layer.type !== 'symbol') return;
    const sl = layer['source-layer'];
    // Only boost PLACE names (towns, villages, hamlets) and mountain peaks:
    // clearing their minzoom makes them appear even when zoomed far out,
    // which is the effect that was actually wanted. Everything else (POI
    // icons, road names, house numbers) keeps the style's own collision
    // rules — forcing those all visible at once made town centers like
    // Canazei unreadably dense.
    if(sl !== 'place' && sl !== 'mountain_peak') return;
    try {
      map.setLayerZoomRange(layer.id, 0, 24);
      map.setLayoutProperty(layer.id, 'text-optional', true);
      // NOTE: deliberately NOT setting text-allow-overlap/icon-allow-overlap
      // anymore — that disabled collision detection entirely and was the
      // root cause of the overcrowded map. MapLibre's collision logic now
      // prunes overlapping labels automatically at every zoom.
    } catch(e) { /* some layers may not support one of these props — skip silently */ }
  });
}

function addTerrainSource(map){
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 15,
  });
}

// Lifts on the trail detail map — ALL of them, same data as the homepage
// (the global `gondolas` array from trails-data.js). Lines and stations are
// GeoJSON layers rather than DOM markers, so rendering all ~700 lifts and
// ~1,400 stations costs nothing.
function renderAllLifts(map){
  if (typeof gondolas === 'undefined' || !Array.isArray(gondolas) || !gondolas.length) return;

  const lineFeatures = [], stationFeatures = [];
  gondolas.forEach(g => {
    if (!g.from || !g.to || typeof g.from.lat !== 'number' || typeof g.to.lat !== 'number') return;
    lineFeatures.push({
      type: 'Feature',
      properties: { name: g.name, note: g.note || '', status: g.status },
      geometry: { type: 'LineString', coordinates: [[g.from.lng, g.from.lat], [g.to.lng, g.to.lat]] },
    });
    [g.from, g.to].forEach(st => {
      stationFeatures.push({
        type: 'Feature',
        properties: { name: g.name, label: st.label || '', note: g.note || '' },
        geometry: { type: 'Point', coordinates: [st.lng, st.lat] },
      });
    });
  });

  map.addSource('detail-gondolas', { type: 'geojson', data: { type: 'FeatureCollection', features: lineFeatures } });
  map.addLayer({
    id: 'detail-gondolas-line',
    type: 'line',
    source: 'detail-gondolas',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['match', ['get', 'status'], 'summer', '#4E90A8', 'no-summer', '#9C3A25', '#5A5548'],
      'line-width': 1.5,
      'line-opacity': 0.9,
      'line-dasharray': ['match', ['get', 'status'], 'summer', ['literal', [1, 0]], ['literal', [2, 1]]],
    },
  });
  map.addSource('detail-gondola-stations', { type: 'geojson', data: { type: 'FeatureCollection', features: stationFeatures } });
  if(window.DoloPawsIcons){
    map.addLayer({
      id: 'detail-gondola-stations-layer',
      type: 'symbol',
      source: 'detail-gondola-stations',
      layout: {
        'icon-image': window.DoloPawsIcons.getMapImageName('lifts'),
        'icon-size': 1,
      },
    });
  } else {
    map.addLayer({
      id: 'detail-gondola-stations-layer',
      type: 'circle',
      source: 'detail-gondola-stations',
      paint: { 'circle-radius': 5, 'circle-color': '#4E90A8', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' },
    });
  }

  ['detail-gondolas-line', 'detail-gondola-stations-layer'].forEach(id => {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    map.on('click', id, (e) => {
      const p = e.features[0].properties;
      new maplibregl.Popup({ offset: 10 })
        .setLngLat(e.lngLat)
        .setHTML(`<b>🚡 ${p.name}</b>${p.label ? '<br>' + p.label : ''}${p.note ? '<br>' + p.note : ''}`)
        .addTo(map);
    });
  });
}

// ============================================================
// IMPORTED CIRCUITS — start where you can actually park.
// OSM route relations have no official start point: the import stitches
// their segments into one line and begins wherever stitching happened to
// start, so a loop's km 0 can land mid-slope, far from any access.
// Before rendering, look up real amenity=parking spots around the route
// (Overpass, cached locally for 30 days) and rotate the loop so km 0
// sits at the path point nearest a parking area. Everything downstream —
// 🚩 flag, directions, arrows, weather anchor, hike mode — follows the
// rotated order automatically. Falls back silently to the imported order
// when no parking is close enough or the lookup fails or times out.
// ============================================================
const PARK_CACHE_TTL = 30 * 24 * 3600 * 1000;
const PARK_MAX_DIST_M = 350;      // parking must be this close to the route
const PARK_LOOKUP_WAIT_MS = 2800; // never block first paint longer than this

function isLoopPath(path){
  return Array.isArray(path) && path.length > 20 &&
    distMeters(path[0], path[path.length - 1]) < 250;
}

function fetchNearbyParking(path){
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  path.forEach(([lat, lng]) => {
    if(lat < minLat) minLat = lat;
    if(lat > maxLat) maxLat = lat;
    if(lng < minLng) minLng = lng;
    if(lng > maxLng) maxLng = lng;
  });
  const PAD = 0.008; // ~800 m beyond the route's bounding box
  const bbox = `${minLat - PAD},${minLng - PAD},${maxLat + PAD},${maxLng + PAD}`;
  const query = `[out:json][timeout:8];(node["amenity"="parking"](${bbox});way["amenity"="parking"](${bbox}););out center 60;`;
  const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  const tryMirror = (i) => fetch(mirrors[i], {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
    .then(r => { if(!r.ok) throw new Error('overpass ' + r.status); return r.json(); })
    .catch(err => { if(i + 1 < mirrors.length) return tryMirror(i + 1); throw err; });
  return tryMirror(0).then(data => (data.elements || []).map(el => {
    const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lng = el.lon != null ? el.lon : (el.center && el.center.lon);
    return (lat == null || lng == null) ? null : { lat, lng, name: (el.tags && el.tags.name) || '' };
  }).filter(Boolean));
}

function nearestPathIndex(path, pt){
  let best = 0, bestD = Infinity;
  for(let i = 0; i < path.length; i++){
    const d = distMeters(path[i], [pt.lat, pt.lng]);
    if(d < bestD){ bestD = d; best = i; }
  }
  return { index: best, dist: bestD };
}

function applyLoopRotation(trail, rot){
  if(rot.index > 0){
    const path = trail.path;
    const closed = distMeters(path[0], path[path.length - 1]) < 30;
    const open = closed ? path.slice(0, -1) : path.slice();
    const rotated = open.slice(rot.index).concat(open.slice(0, rot.index));
    rotated.push(rotated[0].slice()); // close the loop at the new start
    trail.path = rotated;
  }
  trail.startPoint = {
    lat: trail.path[0][0],
    lng: trail.path[0][1],
    label: rot.name
      ? window.t('trail.startParkName', { name: rot.name })
      : window.t('trail.startParking'),
  };
  trail.lat = trail.path[0][0];
  trail.lng = trail.path[0][1];
}

function improveLoopStart(trail){
  if(!trail || trail.curated !== false || !isLoopPath(trail.path)) return Promise.resolve();
  const cacheKey = 'dolopaws-parkstart-' + trail.id;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if(cached && Date.now() - cached.at < PARK_CACHE_TTL){
      if(cached.rot) applyLoopRotation(trail, cached.rot);
      return Promise.resolve();
    }
  } catch (e) { /* unreadable cache — just refetch */ }

  const lookup = fetchNearbyParking(trail.path).then(parkings => {
    let best = null;
    parkings.forEach(p => {
      const near = nearestPathIndex(trail.path, p);
      if(near.dist <= PARK_MAX_DIST_M && (!best || near.dist < best.dist)){
        best = { index: near.index, dist: near.dist, name: p.name };
      }
    });
    const rot = best ? { index: best.index, name: best.name } : null;
    try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), rot })); } catch (e) {}
    return rot;
  }).catch(() => null);

  // Wait briefly; if Overpass is slow, render with the imported order now —
  // the lookup still finishes into the cache for the next visit.
  const timeout = new Promise(res => setTimeout(() => res('timeout'), PARK_LOOKUP_WAIT_MS));
  return Promise.race([lookup, timeout]).then(rot => {
    if(rot && rot !== 'timeout') applyLoopRotation(trail, rot);
  });
}


// ============================================================
// "FROM PARKING TO PAWS" — one named, km-ordered itinerary that
// replaces the separate directions/rifugi/water lists. Base steps
// (parking, start, decision points, finish) render immediately;
// named amenities from the OSM files arrive asynchronously via
// detail-pois.js callbacks and slot in by km.
// ============================================================
const itin = { trail: null, items: [], cumKm: null };

// Curated trail data stores labels in English; translate the known
// templates on the fly in Italian mode (same approach as imported descs).
function trLabel(label){
  if(!label || (window.DoloPawsI18n && window.DoloPawsI18n.lang) !== 'it') return label;
  const RULES = [
    [/^Start here — main parking area at (.+)$/, 'Parti qui — parcheggio principale a $1'],
    [/^Start here — main lake access & parking, by (.+)$/, 'Parti qui — accesso principale al lago e parcheggio, presso $1'],
    [/^Route start per OpenStreetMap — best parking\/access not yet verified$/, 'Inizio del percorso secondo OpenStreetMap — parcheggio/accesso migliore non ancora verificato'],
    [/^Lakeside fountain$/, 'Fontana in riva al lago'],
    [/^Trailhead fountain$/, 'Fontana alla partenza'],
    [/^Village fountain$/, 'Fontana del paese'],
    [/^Waterfall stream$/, 'Torrente della cascata'],
    [/^Stream crossing$/, 'Attraversamento del torrente'],
    [/^Drinking water \(OSM-verified location\)$/, 'Acqua potabile (posizione verificata su OSM)'],
    [/^Mountain\/upper station$/, 'Stazione a monte'],
    [/^Valley\/lower station$/, 'Stazione a valle'],
  ];
  for(const [re, out] of RULES){ if(re.test(label)) return label.replace(re, out); }
  return label;
}

function itinIcon(kind){
  const S = 'width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex:none;"';
  if(kind === 'park') return `<svg ${S}><rect x="3" y="3" width="18" height="18" rx="5" fill="#378ADD"/><path d="M9 17V7h4a3.2 3.2 0 010 6.4H9" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if(kind === 'flag') return `<svg ${S}><path d="M7 21V4" stroke="#2E4034" stroke-width="2" stroke-linecap="round"/><path d="M7 5h10l-2.4 3.5L17 12H7z" fill="#E24B4A"/></svg>`;
  if(kind === 'food') return `<svg ${S}><path d="M5 9h11v6a4 4 0 01-4 4H9a4 4 0 01-4-4z" fill="#BA7517"/><path d="M16 10h1.6a2.2 2.2 0 010 4.4H16" fill="none" stroke="#BA7517" stroke-width="1.8"/><path d="M8.5 6.5c0-1 .8-1.4.8-2.3M12 6.5c0-1 .8-1.4.8-2.3" stroke="#BA7517" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`;
  if(kind === 'hut') return `<svg ${S}><path d="M4 11l8-7 8 7" fill="none" stroke="#8A5A16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9h12v-9" fill="#D6A038" stroke="#8A5A16" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 19v-5h4v5" fill="#8A5A16"/></svg>`;
  if(kind === 'water') return `<svg ${S}><path d="M12 3c3 3.6 4.8 6.3 4.8 8.8a4.8 4.8 0 11-9.6 0C7.2 9.3 9 6.6 12 3z" fill="#378ADD"/></svg>`;
  if(kind === 'switch') return `<svg ${S}><path d="M12 20v-8M12 12L6.5 6M12 12l5.5-6" fill="none" stroke="#7F77DD" stroke-width="2.2" stroke-linecap="round"/><circle cx="6.5" cy="6" r="1.7" fill="#7F77DD"/><circle cx="17.5" cy="6" r="1.7" fill="#AFA9EC"/></svg>`;
  return `<svg ${S}><ellipse cx="12" cy="15.5" rx="4" ry="3.4" fill="#1D9E75"/><ellipse cx="7" cy="10.8" rx="1.5" ry="2" fill="#5DCAA5"/><ellipse cx="10.5" cy="8.6" rx="1.5" ry="2" fill="#5DCAA5"/><ellipse cx="14" cy="8.6" rx="1.5" ry="2" fill="#5DCAA5"/><ellipse cx="17.5" cy="10.8" rx="1.5" ry="2" fill="#5DCAA5"/></svg>`;
}

function itinCumKm(path){
  const cum = [0];
  for(let i = 1; i < path.length; i++) cum.push(cum[i-1] + distMeters(path[i-1], path[i]) / 1000);
  return cum;
}

function itinEsc(x){
  return String(x).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function itinRender(){
  const box = document.getElementById('trailItinerary');
  if(!box || !itin.trail) return;
  const items = itin.items.slice().sort((a, b) => a.sort - b.sort);
  box.innerHTML = items.map(it =>
    `<div class="itin-row">${itinIcon(it.icon)}<span>${it.html}</span></div>`).join('');
}

function itinAdd(icon, sort, html){
  itin.items.push({ icon, sort, html });
}

function itinKmLabel(km){
  return `<b style="font-weight:700;">Km ${km % 1 === 0 ? km : km.toFixed(1)}</b>`;
}

function renderLegendChips(t){
  const box = document.getElementById('legendChips');
  if(!box) return;
  const chips = [];
  const chip = (iconHtml, label) => chips.push(`<span class="sign-chip">${iconHtml}<span>${label}</span></span>`);
  const swatch = (css) => `<span style="width:16px;height:0;${css};flex:none;"></span>`;

  chip(itinIcon('flag'), window.t('legendTrail.start').replace('🚩 ', ''));
  chip(swatch(`border-top:3px solid ${safetyColor(t.safetyLevel)};border-radius:2px`),
       window.t('trail.route', {label: safetyLabel(t.safetyLevel)}));
  chip('<span style="font-size:13px;flex:none;">➤</span>', window.t('legendTrail.dir').replace('➤ ', ''));
  if(Array.isArray(t.decisionPoints) && t.decisionPoints.length){
    chip(itinIcon('switch'), window.t('legendTrail.switch').replace('🔀 ', ''));
  }
  // Lift entries only when a lift actually exists near this trail.
  const liftNear = (typeof gondolas !== 'undefined' && Array.isArray(gondolas)) && gondolas.some(g =>
    g.from && g.to && [g.from, g.to].some(st =>
      typeof st.lat === 'number' && Math.abs(st.lat - t.lat) < 0.05 && Math.abs(st.lng - t.lng) < 0.07));
  if(liftNear){
    chip(swatch('border-top:3px solid #4E90A8;border-radius:2px'), window.t('legend.liftConfirmed'));
    chip(swatch('border-top:2px dashed #5A5548'), window.t('legend.liftUnknown'));
  }
  chip(itinIcon('hut'), window.t('legend.hut'));
  chip(itinIcon('food'), window.t('legend.food'));
  chip(itinIcon('water'), window.t('legend.water'));
  box.innerHTML = chips.join('');
}

function buildItinerary(t){
  itin.trail = t;
  itin.items = [];
  itin.cumKm = Array.isArray(t.path) && t.path.length > 1 ? itinCumKm(t.path) : null;
  const isLoop = Array.isArray(t.path) && t.path.length > 1
    && distMeters(t.path[0], t.path[t.path.length-1]) < 200;

  // 1. Parking / access — the named startPoint label plus a directions
  // link into whatever navigation app this device prefers: Apple Maps on
  // iOS/macOS, Google Maps elsewhere. Neutral label, destination pre-filled.
  const sp = t.startPoint || { lat: t.lat, lng: t.lng, label: '' };
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const mapsUrl = isApple
    ? `https://maps.apple.com/?daddr=${sp.lat},${sp.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${sp.lat},${sp.lng}`;
  const parkLabel = sp.label ? itinEsc(trLabel(sp.label)) : window.t('trail.itinParkFallback');
  itinAdd('park', -2, `${parkLabel} · <a href="${mapsUrl}" target="_blank" rel="noopener">${window.t('trail.openMaps')}</a>`);

  // 2. The start flag.
  itinAdd('flag', -1, window.t('trail.itinStart'));

  // 3. Curated rifugi and water points (they carry real names + km).
  (Array.isArray(t.rifugi) ? t.rifugi : []).forEach(r => {
    if(r.km > 0) itinAdd('hut', r.km, `${itinKmLabel(r.km)} — ${itinEsc(r.name)}`);
  });
  (Array.isArray(t.waterSources) ? t.waterSources : []).forEach(w => {
    if(w.km > 0) itinAdd('water', w.km, `${itinKmLabel(w.km)} — ${itinEsc(trLabel(w.label))}`);
  });

  // 4. Decision points — where the route switches numbered trails.
  (Array.isArray(t.decisionPoints) ? t.decisionPoints : []).forEach(d => {
    itinAdd('switch', d.km, `${itinKmLabel(d.km)} — ${itinEsc(d.instruction)}`);
  });

  // 5. Closing step.
  itinAdd('paw', 1e9, isLoop
    ? window.t('trail.itinLoopEnd', {d: t.distance})
    : window.t('trail.itinEnd', {d: t.distance}));

  itinRender();

  // 6. Named amenities from the OSM datasets, joined to their km on the
  // route (only places within ~120 m of the actual path).
  const MAX_OFF_M = 120;
  function kmOnPath(lat, lng){
    if(!itin.cumKm) return null;
    let best = -1, bestD = Infinity;
    for(let i = 0; i < t.path.length; i++){
      const d = distMeters(t.path[i], [lat, lng]);
      if(d < bestD){ bestD = d; best = i; }
    }
    return bestD <= MAX_OFF_M ? { km: itin.cumKm[best], off: bestD } : null;
  }
  const seen = new Set(itin.items.map(i => i.html.toLowerCase()));

  window.onDetailPoisReady = (features) => {
    let added = 0;
    (features || []).forEach(f => {
      if(added >= 4) return;
      const p = f.properties || {};
      if(!p.name) return;
      const [lng, lat] = f.geometry.coordinates;
      const hit = kmOnPath(lat, lng);
      if(!hit || hit.km <= 0.05) return;
      const nameKey = p.name.toLowerCase();
      if([...seen].some(h => h.includes(nameKey))) return;
      const isHut = p.tourism === 'alpine_hut' || p.tourism === 'wilderness_hut' || p.amenity === 'shelter';
      itinAdd(isHut ? 'hut' : 'food', hit.km, `${itinKmLabel(Math.round(hit.km*10)/10)} — ${itinEsc(p.name)}`);
      seen.add(nameKey);
      added++;
    });
    if(added) itinRender();
  };

  window.onDetailWaterReady = (features) => {
    // Only fill from OSM when the trail has no curated water list.
    if(Array.isArray(t.waterSources) && t.waterSources.length) return;
    let added = 0;
    (features || []).forEach(f => {
      if(added >= 2) return;
      const [lng, lat] = f.geometry.coordinates;
      const hit = kmOnPath(lat, lng);
      if(!hit || hit.km <= 0.05) return;
      const label = (f.properties && f.properties.name) ? f.properties.name : window.t('legend.water');
      itinAdd('water', hit.km, `${itinKmLabel(Math.round(hit.km*10)/10)} — ${itinEsc(label)}`);
      added++;
    });
    if(added) itinRender();
  };
}

const params = new URLSearchParams(window.location.search);
const trailId = params.get('id');

function init(){
  const trail = (typeof trails !== 'undefined') ? trails.find(x => x.id === trailId) : null;

  if(!trail){
    document.getElementById('trailName').textContent = window.t('trail.notFound');
    document.getElementById('trailMeta').textContent = window.t('trail.notFoundSub');
    document.getElementById('detailSaveBtn').hidden = true;
    return;
  }

  // Imported circuits: settle the real-world start FIRST, so every consumer
  // below (map, flag, directions, weather, hike mode) sees the same km 0.
  improveLoopStart(trail).then(() => renderTrail(trail), () => renderTrail(trail));
}

function renderTrail(t){
  buildItinerary(t);
  renderLegendChips(t);
  document.title = `${t.name} — DoloPaws`;
  document.getElementById('pageTitle').textContent = `${t.name} — DoloPaws`;
  document.getElementById('trailName').textContent = t.name;
  document.getElementById('trailMeta').textContent =
    `${t.area} · ${t.distance} km · ${t.elevation} m gain · ${t.hours} h · ${t.terrainType}`;
  document.getElementById('trailBadges').innerHTML =
    `<span class="safety-badge ${safetyClass(t.safetyLevel)}">${safetyLabel(t.safetyLevel)}</span>` +
    (t.paid ? `<span class="tag">${window.t('card.paid')}</span>` : '');
  document.getElementById('routeSwatch').style.background = safetyColor(t.safetyLevel);
  document.getElementById('routeSwatchLabel').textContent = window.t('trail.route', {label: safetyLabel(t.safetyLevel)});
  document.getElementById('trailDesc').textContent = trField(t, 'desc');
  document.getElementById('trailTips').textContent = t.tips ? window.t('trail.tip', {tip: trField(t, 'tips')}) : '';

  // Community v0: "N dogs hiked this trail this week" — anonymous counts
  // from hike-mode starts. Deliberately renders NOTHING at zero: an empty
  // trail should look quiet, not dead.
  function showWeeklyHikes(){
    if (!window.DoloPawsCommunity) return;
    window.DoloPawsCommunity.getWeeklyHikeCount(t.id).then(n => {
      if (!n || n < 1) return;
      const chip = document.getElementById('dogsChip');
      if (!chip) return;
      chip.textContent = n === 1 ? window.t('trail.dogsWeek1') : window.t('trail.dogsWeek', {n});
      chip.hidden = false;
    });
  }
  if (window.DoloPawsCommunity) showWeeklyHikes();
  else window.addEventListener('dolopaws-auth-ready', showWeeklyHikes, { once: true });

  // Provenance banner: imported (OSM) vs verified (curated) trails.
  (function () {
    const descEl = document.getElementById('trailDesc');
    if (!descEl || document.getElementById('osmProvenance')) return;
    const box = document.createElement('div');
    box.id = 'osmProvenance';
    if (t.curated === false) {
      box.style.cssText = 'margin:10px 0 14px;padding:10px 14px;border-left:4px solid #00897b;background:#e0f2f1;border-radius:6px;font-size:13px;line-height:1.5;';
      box.innerHTML = window.t('trail.importedBox')
        + (t.waymarkedtrails ? ` <a href="${t.waymarkedtrails}" target="_blank" rel="noopener">${window.t('trail.viewSource')}</a>` : '');
    } else {
      box.style.cssText = 'margin:10px 0 14px;padding:10px 14px;border-left:4px solid #2E4034;background:#eef3ef;border-radius:6px;font-size:13px;line-height:1.5;';
      box.innerHTML = window.t('trail.verifiedBox');
    }
    descEl.parentNode.insertBefore(box, descEl);
  })();

  // Coordinates — shown in plain decimal-degree format, matching how most
  // real trail sites display a trailhead location.
  const coordSource = t.startPoint || t;
  if(typeof coordSource.lat === 'number'){
    document.getElementById('trailCoords').textContent =
      `${window.t('trail.coords')} ${coordSource.lat.toFixed(5)}, ${coordSource.lng.toFixed(5)}`;
  }

  // Quick facts — ascent/descent, highest/lowest point.
  // Note: summing the sparse elevationProfile points (usually just 5-6
  // samples) systematically UNDERSTATES real ascent, since it misses the
  // smaller ups and downs between samples — confirmed by comparing against
  // Tre Cime's already-researched 430m gain figure, which came out much
  // higher than summing its profile points did. Using the existing
  // `elevation` field for ascent is more trustworthy, and since every trail
  // here is a loop (same start/end point), descent is the same figure —
  // net elevation change over a full loop is ~0 by definition.
  // Facts live inside the dark hero now — one place, no duplicates.
  (function(){
    const factsEl = document.getElementById('trailFacts');
    if(!factsEl) return;
    const facts = [
      [`${t.distance} km`, window.t('trail.fact.distance')],
      [`${t.elevation} m`, window.t('trail.fact.ascent')],
      [`${t.hours} h`, window.t('trail.fact.duration')],
    ];
    if(Array.isArray(t.elevationProfile) && t.elevationProfile.length > 1){
      facts.splice(2, 0, [`${Math.max(...t.elevationProfile.map(p => p.elev))} m`, window.t('trail.fact.high')]);
    }
    factsEl.innerHTML = facts.map(([val, label]) =>
      `<span class="f"><b>${val}</b><span>${label}</span></span>`).join('')
      + `<span class="f safe"><b>${safetyLabel(t.safetyLevel)}</b><span>${window.t('trail.fact.terrain')}</span></span>`;

    // Personal match — needs a logged-in profile; guests just see the facts.
    function paintMatch(){
      if(!window.DoloPawsAuth || !window.DoloPawsAuth.currentUser || typeof scoreTrail !== 'function') return;
      window.DoloPawsAuth.getDogProfile().then(profile => {
        if(!profile) return;
        const n = scoreTrail(t, effectiveOverrides(profile, null));
        const el = document.getElementById('trailMatch');
        if(!el) return;
        el.textContent = (t.curated === false ? '≈' : '') + n + '% ' +
          window.t('trail.matchFor', {name: profile.name || window.t('trail.yourDog')});
        el.hidden = false;
      });
    }
    if(window.DoloPawsAuth) paintMatch();
    else window.addEventListener('dolopaws-auth-ready', paintMatch, { once: true });
  })();

  // Tag badges — derived only from data that already exists on the trail,
  // never invented just to fill space.
  const tags = [];
  if(Array.isArray(t.path) && t.path.length > 1){
    const first = t.path[0], last = t.path[t.path.length-1];
    if(Math.hypot(first[0]-last[0], first[1]-last[1]) * 111000 < 30) tags.push(window.t('trail.tag.loop'));
  }
  if(t.rifugi && t.rifugi.length > 0) tags.push(window.t('trail.tag.rest'));
  if(t.terrainRank === 0) tags.push(window.t('trail.tag.family'));
  if(/geolog/i.test(t.desc || '')) tags.push(window.t('trail.tag.geo'));
  if(!t.paid) tags.push(window.t('trail.tag.free'));
  document.getElementById('trailTags').innerHTML = tags.map(tag =>
    `<span style="font-size:12px;font-weight:600;padding:5px 12px;border-radius:12px;background:var(--sage-dim);color:var(--ink);">${tag}</span>`
  ).join('');

  // Live weather at the trailhead — real forecast via Open-Meteo, a free
  // API that requires no key and permits non-commercial client-side use
  // (worth re-checking their terms if DoloPaws ever becomes a paid product).
  if(typeof coordSource.lat === 'number'){
    const weatherEl = document.getElementById('weatherWidget');
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coordSource.lat}&longitude=${coordSource.lng}&current=temperature_2m,weathercode,windspeed_10m,precipitation&timezone=auto`)
      .then(r => r.json())
      .then(data => {
        if(!data.current) return;
        const c = data.current;
        const isIt = (window.DoloPawsI18n && window.DoloPawsI18n.lang) === 'it';
        const codeText = (isIt ? {
          0:'Sereno',1:'Prevalentemente sereno',2:'Parzialmente nuvoloso',3:'Coperto',
          45:'Nebbia',48:'Nebbia',51:'Pioviggine',61:'Pioggia debole',63:'Pioggia',
          65:'Pioggia forte',71:'Neve debole',73:'Neve',75:'Neve forte',
          80:'Rovesci',95:'Temporale',
        } : {
          0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
          45:'Fog',48:'Fog',51:'Light drizzle',61:'Light rain',63:'Rain',
          65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
          80:'Rain showers',95:'Thunderstorm',
        })[c.weathercode] || (isIt ? 'Variabile' : 'Mixed conditions');
        const chip = document.getElementById('weatherChip');
        if(chip){
          chip.textContent = `${c.temperature_2m}°C · ${codeText} · ${window.t('trail.weatherWind')} ${c.windspeed_10m} km/h`;
          chip.hidden = false;
        }
        weatherEl.innerHTML = `<b>${window.t('trail.weatherNow')}</b> ${c.temperature_2m}°C, ${codeText}, ${window.t('trail.weatherWind')} ${c.windspeed_10m} km/h` +
          (c.precipitation > 0 ? `, ${c.precipitation}mm precipitation` : '') +
          `<div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">${window.t('trail.weatherVia')}</div>`;
        weatherEl.hidden = false;
      })
      .catch(() => {
        weatherEl.innerHTML = `<span style="color:var(--ink-soft);">${window.t('trail.weatherUnavail')}</span>`;
        weatherEl.hidden = false;
      });
  }
  document.getElementById('trailDetailContent').innerHTML = renderTrailDetailContent(t);

  // "Good to know" — curated insights (history, geology, best practice)
  // with cited sources, for trails that have them in trails-data.js.
  if (Array.isArray(t.insights) && t.insights.length){
    const lang = (window.DoloPawsI18n && window.DoloPawsI18n.lang) || 'en';
    const box = document.createElement('div');
    box.style.cssText = 'margin-top:20px;';
    box.innerHTML = `<h2 style="font-size:18px;margin-bottom:10px;">${window.t('trail.insightsTitle')}</h2>` +
      t.insights.map(i => `
        <div style="background:var(--card);border:1px solid var(--paper-line);border-radius:12px;padding:12px 16px;margin-bottom:10px;font-size:13.5px;color:var(--ink);line-height:1.55;">
          ${(lang === 'it' && i.it) ? i.it : i.en}
          <div style="font-size:11.5px;color:var(--ink-soft);margin-top:6px;">${window.t('trail.source')}: ${i.url ? `<a href="${i.url}" target="_blank" rel="noopener">${i.source}</a>` : i.source}</div>
        </div>`).join('');
    const gtk = document.getElementById('goodToKnowBox');
    if (gtk){
      box.style.cssText = '';
      box.querySelector('h2').remove(); // card already has the heading
      gtk.appendChild(box);
    } else {
      const coords = document.getElementById('trailCoords');
      if (coords && coords.parentNode) coords.parentNode.appendChild(box);
    }
  } else {
    // No hand-researched notes yet — fill the card with honest facts
    // derived from the route data itself, clearly labelled as such.
    const gtk = document.getElementById('goodToKnowBox');
    if (gtk){
      const facts = [];
      if (Array.isArray(t.elevationProfile) && t.elevationProfile.length){
        facts.push(window.t('gtk.autoAltitude', {m: Math.max(...t.elevationProfile.map(p => p.elev))}));
      }
      if (t.terrainType) facts.push(window.t('gtk.autoTerrain', {surface: t.terrainType}));
      const isLoopG = Array.isArray(t.path) && t.path.length > 1
        && distMeters(t.path[0], t.path[t.path.length-1]) < 200;
      facts.push(isLoopG ? window.t('gtk.autoLoop', {d: t.distance}) : window.t('gtk.autoPointToPoint', {d: t.distance}));
      gtk.innerHTML = facts.map(f =>
        `<div style="border:1px solid var(--paper-line);border-radius:12px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:var(--ink);line-height:1.55;">${f}</div>`).join('')
        + `<p style="font-size:11px;color:var(--ink-soft);margin:6px 0 0;">${window.t('gtk.autoNote')}</p>`;
    }
  }

  // Build turn-by-turn directions for trails stitched from more than one
  // numbered route, or a simpler start-only note for single-path loops
  // (a lake loop doesn't need "switch trails" instructions, but it still
  // deserves a clear "start here" pointer).
  if(Array.isArray(t.path) && ((Array.isArray(t.decisionPoints) && t.decisionPoints.length > 0) || t.startPoint)){
    const totalKm = t.distance;
    const firstStep = t.startPoint
      ? window.t('trail.dirStart', {label: trLabel(t.startPoint.label)})
      : window.t('trail.dirStartAt', {name: (t.rifugi || []).find(r => r.km === 0)?.name || t.area});
    const steps = [firstStep];

    if(Array.isArray(t.decisionPoints) && t.decisionPoints.length > 0){
      // Merge rifugi and decision points that share a km value into one step,
      // rather than listing "pass X" and "switch trails at X" separately when
      // they're literally the same spot.
      const byKm = new Map();
      (t.rifugi || []).filter(r => r.km > 0).forEach(r => {
        byKm.set(r.km, [...(byKm.get(r.km) || []), { text: window.t('trail.dirPass', {name: r.name}), name: r.name }]);
      });
      t.decisionPoints.forEach(d => {
        const existing = byKm.get(d.km) || [];
        const instructionText = d.instruction.charAt(0).toLowerCase() + d.instruction.slice(1);
        // If a rifugio at this exact km is already named inside the decision
        // instruction, drop the separate "pass X" so the name isn't repeated.
        const deduped = existing.filter(e => !instructionText.toLowerCase().includes(e.name.toLowerCase()));
        byKm.set(d.km, [...deduped, { text: instructionText }]);
      });
      const events = [...byKm.entries()].sort((a, b) => a[0] - b[0]);
      events.forEach(([km, items]) => steps.push(`Km ${km}: ${items.map(i => i.text).join(window.t('trail.dirThen'))}.`));
    }

    steps.push(window.t('trail.dirEnd', {n: totalKm}));

    document.getElementById('trailDirections').innerHTML = steps.map(s => `<li>${s}</li>`).join('');
    document.getElementById('directionsWrap').hidden = false;
  }

  // Map
  if(typeof maplibregl !== 'undefined' && typeof t.lat === 'number' && typeof t.lng === 'number'){
    const map = new maplibregl.Map({
      container: 'trailDetailMap',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [t.lng, t.lat],
      zoom: 14,
      pitch: 0, // clean, flat, label-first by default — 3D is opt-in via the toggle
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Fullscreen map — manual ⤢ toggle, and automatic during hike mode.
    const mapBox = document.getElementById('trailMapBox');
    const expandBtn = document.getElementById('mapExpandBtn');
    function setMapFS(on){
      if(!mapBox) return;
      mapBox.classList.toggle('map-fs', on);
      document.body.classList.toggle('map-fs-open', on);
      if(expandBtn) expandBtn.textContent = on ? '✕' : '⤢';
      setTimeout(() => map.resize(), 60);
    }
    window.DoloPawsMapFS = { enter: () => setMapFS(true), exit: () => setMapFS(false) };
    if(expandBtn) expandBtn.addEventListener('click', () => setMapFS(!mapBox.classList.contains('map-fs')));
    // Live blue-dot location control — tap to see yourself on the map,
    // with heading arrow and follow-me tracking (Google Maps-style).
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      fitBoundsOptions: { maxZoom: 15.5 },
    }), 'top-right');

    map.on('load', async () => {
      if(window.DoloPawsIcons) await window.DoloPawsIcons.registerMapImages(map);
      addTerrainSource(map);
      increaseLabelDensity(map);
      addTerrainToggle(map, 'trailDetailMap', 1.5, 45);
      renderAllLifts(map);
      if (typeof initDetailPois === 'function') initDetailPois(map, t);

      // Waymarked Trails' own public hiking overlay — same underlying OSM
      // data as our base map, but with their dedicated trail-route styling
      // (numbered routes, waymarking) that a general basemap doesn't draw.
      //
      // IMPORTANT: adding a layer with no target position stacks it on top
      // of EVERYTHING in the base style, including all its text labels —
      // that's what was actually causing the "hard to read" problem, in
      // both 3D and flat mode. Finding the first text/label layer and
      // inserting before it keeps the overlay above roads/fills but below
      // every place name, so labels stay legible either way.
      const firstLabelLayer = map.getStyle().layers.find(l => l.type === 'symbol');
      map.addSource('waymarked-hiking', {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org',
      });
      map.addLayer({
        id: 'waymarked-hiking-layer',
        type: 'raster',
        source: 'waymarked-hiking',
        paint: { 'raster-opacity': 0.4 },
      }, firstLabelLayer ? firstLabelLayer.id : undefined);

      if(Array.isArray(t.path) && t.path.length > 1){
        map.addSource('single-trail-path', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: t.path.map(([lat, lng]) => [lng, lat]) },
          },
        });
        // Casing — a wider Pine line underneath the safety-colored route.
        // This is the detail that makes a route line read as intentional/
        // premium rather than a thin stroke — same visual trick Komoot uses.
        map.addLayer({
          id: 'single-trail-path-casing',
          type: 'line',
          source: 'single-trail-path',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2E4034', 'line-width': 7, 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: 'single-trail-path-line',
          type: 'line',
          source: 'single-trail-path',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': safetyColor(t.safetyLevel), 'line-width': 4 },
        });

        // Direction-of-travel arrows, Komoot-style — repeated along the
        // route line, automatically oriented by the order points appear in
        // the path array. That order was deliberately built to match the
        // walking direction described in the turn-by-turn directions above
        // (e.g. Auronzo → Lavaredo → Locatelli → back to Auronzo), so the
        // arrows and the written instructions always agree with each other
        // without needing any separate direction flag.
        map.addLayer({
          id: 'single-trail-direction-arrows',
          type: 'symbol',
          source: 'single-trail-path',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 70,
            'text-field': '➤',
            'text-size': 18,
            'text-rotation-alignment': 'map',
            'text-keep-upright': false,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': safetyColor(t.safetyLevel),
            'text-halo-width': 2,
          },
        });
        const bounds = new maplibregl.LngLatBounds();
        t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 17 });

        setupElevationProfile(map, t);

        // "Start hike" companion — live progress, off-route warning, wake lock.
        if (typeof initHikeMode === 'function') initHikeMode(map, t);

        // NOTE: curated rifugi/water emoji markers used to be placed here
        // from the trail's km data — removed: they duplicated the real OSM
        // amenity dots (detail-pois.js), showing two markers for the same
        // rifugio. The OSM dot layers are now the single amenity language
        // on every map; the curated km list still renders as text in the
        // "Trail details" column. Emoji markers remain only for things OSM
        // can't know: recommended start, decision points, community flags.

        // Decision points — where a hiker needs to switch from one numbered
        // route onto another. Always real, verified coordinates (these come
        // from actual confirmed junctions between two GPX tracks, never
        // interpolated) so no fallback branch is needed here.
        (t.decisionPoints || []).forEach(d => {
          new maplibregl.Marker({ element: makeIconEl('switch', '#D6A038'), offset: [14, -14] })
            .setLngLat([d.lng, d.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<b>Km ${d.km}</b><br>${d.instruction}`))
            .addTo(map);
        });

        // Curated rifugi and water stops — every step in the itinerary must
        // be findable on the map, in the same icon language (white bubble,
        // colorful glyph), placed at its true km along the route.
        if(Array.isArray(t.path) && t.path.length > 1 && t.distance > 0){
          const addWaypoint = (km, icon, label) => {
            const [wLat, wLng] = pointAtFraction(t.path, Math.max(0, Math.min(1, km / t.distance)));
            new maplibregl.Marker({ element: makeIconEl(icon), offset: [0, -6] })
              .setLngLat([wLng, wLat])
              .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(`<b>${itinEsc(label)}</b><br>Km ${km}`))
              .addTo(map);
          };
          (t.rifugi || []).forEach(r => { if(r.km > 0) addWaypoint(r.km, 'hut', trLabel(r.name)); });
          (t.waterSources || []).forEach(w => { if(w.km > 0) addWaypoint(w.km, 'water', trLabel(w.label)); });
        }

        // Recommended starting point — a loop can technically be walked
        // from anywhere on it, but a real, well-marked access/parking point
        // is worth calling out explicitly rather than leaving people to
        // guess where to begin.
        if(t.startPoint){
          new maplibregl.Marker({ element: makeIconEl('start', '#2E4034'), offset: [-14, -14] })
            .setLngLat([t.startPoint.lng, t.startPoint.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<b>${trLabel(t.startPoint.label)}</b>`))
            .addTo(map);
        }
      } else {
        new maplibregl.Marker({ color: '#6FA8BE' }).setLngLat([t.lng, t.lat]).addTo(map);
        const legend = document.getElementById('mapLegend');
        if(legend){
          legend.insertAdjacentHTML('beforeend',
            '<span style="font-style:italic;">— Rifugi/water map icons need this trail\'s real GPS route, not yet added. See the list below instead.</span>');
        }
      }

      if (typeof makeBasemapPoisClickable === 'function') makeBasemapPoisClickable(map);

      // Community dog-safety flags — list, map markers, report modal.
      if (typeof initTrailReports === 'function') initTrailReports(map, t);
    });
  }

  // Save button — reflects and updates real account state, same pattern as the trail cards.
  const saveBtn = document.getElementById('detailSaveBtn');
  function paintSaveBtn(isFav){
    saveBtn.textContent = isFav ? window.t('card.saved') : window.t('card.save');
    saveBtn.classList.toggle('saved', isFav);
  }
  window.addEventListener('dolopaws-auth-changed', async (e) => {
    if(!e.detail.user || !window.DoloPawsAuth){
      saveBtn.onclick = () => { if(window.DoloPawsAuthUI) window.DoloPawsAuthUI.openLogin(); };
      paintSaveBtn(false);
      return;
    }
    const favorites = await window.DoloPawsAuth.getFavorites();
    paintSaveBtn(!!favorites[t.id]);
    saveBtn.onclick = async () => {
      const current = await window.DoloPawsAuth.getFavorites();
      if(current[t.id]) delete current[t.id]; else current[t.id] = true;
      await window.DoloPawsAuth.setFavorites(current);
      paintSaveBtn(!!current[t.id]);
    };
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
