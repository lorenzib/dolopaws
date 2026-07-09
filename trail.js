function safetyLabel(level){
  if(level === 'low-risk') return 'Low-risk terrain';
  if(level === 'moderate') return 'Moderate — some caution';
  return 'Caution — exposed sections';
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
    : `<p style="margin:0 0 14px;">No rifugi along this route.</p>`;

  const waterHtml = water.length > 0
    ? `<ul style="margin:0 0 14px;padding-left:18px;">${water.map(w => `<li>Km ${w.km} — ${w.label}</li>`).join('')}</ul>`
    : `<p style="margin:0 0 14px;">No drinking water sources recorded along this route — bring enough for your dog.</p>`;

  return `
    <div style="margin-bottom:14px;">
      <div style="font-weight:700;color:var(--ink);margin-bottom:4px;">🏔️ Rifugi on the way</div>
      ${rifugiHtml}
    </div>
    <div style="margin-bottom:14px;">
      <div style="font-weight:700;color:var(--ink);margin-bottom:4px;">💧 Drinking water</div>
      ${waterHtml}
    </div>
    <div style="margin-bottom:14px;">
      <div style="font-weight:700;color:var(--ink);margin-bottom:4px;">🪑 Resting stations</div>
      <p style="margin:0;font-style:italic;">Not tracked separately yet — rifugi above often double as rest stops.</p>
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

function makeIconEl(emoji, bgColor){
  const el = document.createElement('div');
  el.style.cssText = `width:28px;height:28px;border-radius:50%;background:${bgColor};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:14px;`;
  el.textContent = emoji;
  return el;
}

function addTerrainToggle(map, containerId, exaggeration, pitch3D){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.style.position = container.style.position || 'relative';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'View 3D terrain';
  btn.style.cssText = 'position:absolute;bottom:10px;left:10px;z-index:5;padding:8px 16px;border-radius:14px;background:var(--ink);color:#fff;border:none;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.25);';
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
      btn.textContent = 'View flat map';
    } else {
      map.setTerrain(null);
      if(map.getLayer('hillshade-layer')) map.removeLayer('hillshade-layer');
      map.easeTo({ pitch: 0, duration: 500 });
      btn.textContent = 'View 3D terrain';
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

const params = new URLSearchParams(window.location.search);
const trailId = params.get('id');

function init(){
  const t = (typeof trails !== 'undefined') ? trails.find(x => x.id === trailId) : null;

  if(!t){
    document.getElementById('trailName').textContent = 'Trail not found';
    document.getElementById('trailMeta').textContent = 'This trail may have moved — try browsing all trails instead.';
    document.getElementById('detailSaveBtn').hidden = true;
    return;
  }

  document.title = `${t.name} — DoloPaws`;
  document.getElementById('pageTitle').textContent = `${t.name} — DoloPaws`;
  document.getElementById('trailName').textContent = t.name;
  document.getElementById('trailMeta').textContent =
    `${t.area} · ${t.distance} km · ${t.elevation} m gain · ${t.hours} h · ${t.terrainType}`;
  document.getElementById('trailBadges').innerHTML =
    `<span class="safety-badge ${safetyClass(t.safetyLevel)}">${safetyLabel(t.safetyLevel)}</span>` +
    (t.paid ? `<span class="tag">Paid access</span>` : '');
  document.getElementById('routeSwatch').style.background = safetyColor(t.safetyLevel);
  document.getElementById('routeSwatchLabel').textContent = `Trail route (${safetyLabel(t.safetyLevel)})`;
  document.getElementById('trailDesc').textContent = t.desc || '';
  document.getElementById('trailTips').textContent = t.tips ? `Tip: ${t.tips}` : '';

  // Community v0: "N dogs hiked this trail this week" — anonymous counts
  // from hike-mode starts. Deliberately renders NOTHING at zero: an empty
  // trail should look quiet, not dead.
  function showWeeklyHikes(){
    if (!window.DoloPawsCommunity) return;
    window.DoloPawsCommunity.getWeeklyHikeCount(t.id).then(n => {
      if (!n || n < 1) return;
      const el = document.createElement('div');
      el.style.cssText = 'margin-top:10px;font-size:13px;font-weight:600;color:var(--ink);';
      el.textContent = `🐾 ${n} dog${n === 1 ? '' : 's'} hiked this trail this week`;
      const badges = document.getElementById('trailBadges');
      if (badges && badges.parentNode) badges.parentNode.insertBefore(el, badges.nextSibling);
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
      box.innerHTML = '🗺️ <strong>Imported trail</strong> — route, elevation, fountains and rifugi come from verified map data, '
        + 'but DoloPaws hasn\'t field-reviewed this trail yet.'
        + (t.waymarkedtrails ? ` <a href="${t.waymarkedtrails}" target="_blank" rel="noopener">View source route on Waymarked Trails ↗</a>` : '');
    } else {
      box.style.cssText = 'margin:10px 0 14px;padding:10px 14px;border-left:4px solid #2E4034;background:#eef3ef;border-radius:6px;font-size:13px;line-height:1.5;';
      box.innerHTML = '🐾 <strong>Verified by DoloPaws</strong> — route, terrain, water points and dog-specific details individually checked against independent sources.';
    }
    descEl.parentNode.insertBefore(box, descEl);
  })();

  // Coordinates — shown in plain decimal-degree format, matching how most
  // real trail sites display a trailhead location.
  const coordSource = t.startPoint || t;
  if(typeof coordSource.lat === 'number'){
    document.getElementById('trailCoords').textContent =
      `Trailhead coordinates: ${coordSource.lat.toFixed(5)}, ${coordSource.lng.toFixed(5)}`;
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
  if(Array.isArray(t.elevationProfile) && t.elevationProfile.length > 1){
    const elevs = t.elevationProfile.map(p => p.elev);
    const facts = [
      ['Distance', `${t.distance} km`],
      ['Ascent', `${t.elevation} m`],
      ['Descent', `${t.elevation} m`],
      ['Highest point', `${Math.max(...elevs)} m`],
      ['Lowest point', `${Math.min(...elevs)} m`],
      ['Duration', `${t.hours} h`],
    ];
    document.getElementById('quickFacts').innerHTML = facts.map(([label, val]) => `
      <div style="text-align:center;">
        <div style="font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.03em;">${label}</div>
        <div style="font-size:16px;font-weight:700;color:var(--ink);margin-top:2px;">${val}</div>
      </div>`).join('');
  }

  // Tag badges — derived only from data that already exists on the trail,
  // never invented just to fill space.
  const tags = [];
  if(Array.isArray(t.path) && t.path.length > 1){
    const first = t.path[0], last = t.path[t.path.length-1];
    if(Math.hypot(first[0]-last[0], first[1]-last[1]) * 111000 < 30) tags.push('🔁 Loop route');
  }
  if(t.rifugi && t.rifugi.length > 0) tags.push('🍽️ Rest stops on route');
  if(t.terrainRank === 0) tags.push('👨‍👩‍👧 Family-friendly');
  if(/geolog/i.test(t.desc || '')) tags.push('🪨 Geological interest');
  if(!t.paid) tags.push('🎟️ Free access');
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
        const codeText = {
          0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
          45:'Fog',48:'Fog',51:'Light drizzle',61:'Light rain',63:'Rain',
          65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
          80:'Rain showers',95:'Thunderstorm',
        }[c.weathercode] || 'Mixed conditions';
        weatherEl.innerHTML = `<b>Weather at the trailhead right now:</b> ${c.temperature_2m}°C, ${codeText}, wind ${c.windspeed_10m} km/h` +
          (c.precipitation > 0 ? `, ${c.precipitation}mm precipitation` : '') +
          `<div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">Live forecast via Open-Meteo</div>`;
        weatherEl.hidden = false;
      })
      .catch(() => { /* weather is a nice-to-have — fail silently, don't break the page */ });
  }
  document.getElementById('trailDetailContent').innerHTML = renderTrailDetailContent(t);

  // Build turn-by-turn directions for trails stitched from more than one
  // numbered route, or a simpler start-only note for single-path loops
  // (a lake loop doesn't need "switch trails" instructions, but it still
  // deserves a clear "start here" pointer).
  if(Array.isArray(t.path) && ((Array.isArray(t.decisionPoints) && t.decisionPoints.length > 0) || t.startPoint)){
    const totalKm = t.distance;
    const firstStep = t.startPoint
      ? `${t.startPoint.label} (km 0).`
      : `Start at ${(t.rifugi || []).find(r => r.km === 0)?.name || t.area} (km 0).`;
    const steps = [firstStep];

    if(Array.isArray(t.decisionPoints) && t.decisionPoints.length > 0){
      // Merge rifugi and decision points that share a km value into one step,
      // rather than listing "pass X" and "switch trails at X" separately when
      // they're literally the same spot.
      const byKm = new Map();
      (t.rifugi || []).filter(r => r.km > 0).forEach(r => {
        byKm.set(r.km, [...(byKm.get(r.km) || []), { text: `pass ${r.name}`, name: r.name }]);
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
      events.forEach(([km, items]) => steps.push(`Km ${km}: ${items.map(i => i.text).join(', then ')}.`));
    }

    steps.push(`Continue back to the start, completing the loop at km ${totalKm}.`);

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
    // Live blue-dot location control — tap to see yourself on the map,
    // with heading arrow and follow-me tracking (Google Maps-style).
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      fitBoundsOptions: { maxZoom: 15.5 },
    }), 'top-right');

    map.on('load', () => {
      addTerrainSource(map);
      increaseLabelDensity(map);
      addTerrainToggle(map, 'trailDetailMap', 1.5, 45);

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

        // Rifugi and water-source icons — positioned using the REAL GPS
        // path, not guessed coordinates. Km markers were recorded against
        // the trail's stated distance, so we convert to a fraction of that
        // distance, then find the matching point on the real path.
        //
        // OFFSET NOTE: rifugi/water/decision/start markers frequently share
        // the exact same coordinate (e.g. a rifugio + fountain both at km 0,
        // right at the trailhead). Without an offset, later-added markers
        // render on top of earlier ones and silently hide them - this is
        // what happened to lago-braies's rifugio marker (identical coords
        // to its water source AND start flag, buried under both). Each
        // marker type now gets its own quadrant, matching the existing
        // pattern used for decisionPoints [14,-14] and startPoint [-14,-14]:
        //   startPoint (🚩)      -> top-left  [-14, -14]  (existing)
        //   decisionPoints (🔀)  -> top-right [ 14, -14]  (existing)
        //   rifugi (🏠)          -> bottom-left  [-14, 14]  (new)
        //   waterSources (💧)    -> bottom-right [ 14, 14]  (new)
        // This only separates markers of DIFFERENT types sharing a
        // coordinate. Two rifugi (or two water sources) at the exact same
        // point would still stack on each other - not handled here, since
        // it wasn't the observed bug and no current trail data has that case.
        (t.rifugi || []).forEach(r => {
          let lat, lng;
          if(typeof r.lat === 'number' && typeof r.lng === 'number'){
            lat = r.lat; lng = r.lng; // verified real coordinates
          } else {
            const fraction = t.distance > 0 ? r.km / t.distance : 0;
            [lat, lng] = pointAtFraction(t.path, fraction); // approximate fallback
          }
          new maplibregl.Marker({ element: makeIconEl('🏠', '#2E4034'), offset: [-14, 14] })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<b>${r.name}</b><br>Km ${r.km}`))
            .addTo(map);
        });
        (t.waterSources || []).forEach(w => {
          let lat, lng;
          if(typeof w.lat === 'number' && typeof w.lng === 'number'){
            lat = w.lat; lng = w.lng; // verified real coordinates
          } else {
            const fraction = t.distance > 0 ? w.km / t.distance : 0;
            [lat, lng] = pointAtFraction(t.path, fraction); // approximate fallback
          }
          new maplibregl.Marker({ element: makeIconEl('💧', '#4E90A8'), offset: [14, 14] })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<b>${w.label}</b><br>Km ${w.km}`))
            .addTo(map);
        });

        // Decision points — where a hiker needs to switch from one numbered
        // route onto another. Always real, verified coordinates (these come
        // from actual confirmed junctions between two GPX tracks, never
        // interpolated) so no fallback branch is needed here.
        (t.decisionPoints || []).forEach(d => {
          new maplibregl.Marker({ element: makeIconEl('🔀', '#D6A038'), offset: [14, -14] })
            .setLngLat([d.lng, d.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<b>Km ${d.km}</b><br>${d.instruction}`))
            .addTo(map);
        });

        // Recommended starting point — a loop can technically be walked
        // from anywhere on it, but a real, well-marked access/parking point
        // is worth calling out explicitly rather than leaving people to
        // guess where to begin.
        if(t.startPoint){
          new maplibregl.Marker({ element: makeIconEl('🚩', '#2E4034'), offset: [-14, -14] })
            .setLngLat([t.startPoint.lng, t.startPoint.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<b>${t.startPoint.label}</b>`))
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
    saveBtn.textContent = isFav ? 'Saved' : 'Save';
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
