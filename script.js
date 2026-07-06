
// ============================================================
// FITNESS DEFAULTS — used both to derive the guest teaser scores
// and to score the real returning-user list against a saved profile.
// ============================================================
const FITNESS_DEFAULTS = {
  low:      { terrain:'0', distance:'5'  },
  moderate: { terrain:'1', distance:'10' },
  high:     { terrain:'2', distance:'99' },
};

function scoreTrail(t, overrides){
  let score = 100;
  const terrain = parseInt(overrides.terrain, 10);
  const maxDistance = parseFloat(overrides.distance);

  // Terrain difficulty
  if(t.terrainRank > terrain) score -= (t.terrainRank - terrain) * 30;

  // Distance
  if(t.distance > maxDistance) score -= Math.min(35, (t.distance - maxDistance) * 5);

  // Exposure — narrow ledges / drop-offs are a caution regardless of breed
  if(t.exposure) score -= 30;

  // Heat risk — a baseline penalty applies to every dog; heat-sensitive
  // breeds take a heavier hit on top of that.
  if(t.heatRisk === 'high') score -= overrides.heatSensitive ? 25 : 12;
  else if(t.heatRisk === 'moderate') score -= overrides.heatSensitive ? 10 : 4;

  // Shade coverage — low shade compounds heat risk for every dog, not
  // just breeds flagged as heat-sensitive.
  if(t.shadeCoverage < 20) score -= 10;
  else if(t.shadeCoverage < 40) score -= 5;

  // Surface hazards — sharp rock, loose scree, fixed cables, etc.
  if(t.surfaceHazards && t.surfaceHazards.length > 0){
    score -= Math.min(20, t.surfaceHazards.length * 8);
  }

  return Math.max(5, Math.round(score));
}

function safetyLabel(level){
  if(level === 'low-risk') return 'Low-risk terrain';
  if(level === 'moderate') return 'Moderate — some caution';
  return 'Caution — exposed sections';
}
function safetyClass(level){
  if(level === 'low-risk') return 'safety-low';
  if(level === 'moderate') return 'safety-moderate';
  return 'safety-caution';
}

// ============================================================
// GUEST TEASER — generic default profile, illustrative blurred scores
// ============================================================
function renderTeaser(){
  const grid = document.getElementById('teaserGrid');
  if(!grid || typeof trails === 'undefined') return;

  const generic = { terrain:'1', distance:'10', heatSensitive:false };
  const picks = ['lago-braies', 'alpe-siusi', 'santa-maddalena']
    .map(id => trails.find(t => t.id === id))
    .filter(Boolean);

  grid.innerHTML = picks.map(t => `
    <div class="teaser-card">
      <div class="photo"></div>
      <div class="row">
        <div class="name">${t.name}</div>
        <div class="match">${scoreTrail(t, generic)}%</div>
      </div>
      <div class="meta">${t.ref ? `Trail ${t.ref} · ` : ''}${t.area} · ${t.distance} km</div>
    </div>
  `).join('');
}

function goToProfileCreation(){
  const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
  if(user){
    window.location.href = 'account.html';
  } else if(window.DoloPawsAuthUI){
    window.DoloPawsAuthUI.openSignup();
  }
}

renderTeaser();
const createProfileBtn = document.getElementById('createProfileBtn');
if(createProfileBtn) createProfileBtn.addEventListener('click', goToProfileCreation);
const unlockBtn = document.getElementById('unlockBtn');
if(unlockBtn) unlockBtn.addEventListener('click', goToProfileCreation);

// ============================================================
// RETURNING VISITOR — real profile, real scoring, real favorites,
// genuine "new since last visit" detection (not a decorative badge).
// ============================================================
const NEW_MATCH_THRESHOLD = 70; // trails scoring at/above this count as "a match" for new-match tracking
let adjustOverride = null; // session-only override, never saved to the profile
let currentFavorites = {};

function effectiveOverrides(profile){
  if(adjustOverride) return adjustOverride;
  const defaults = FITNESS_DEFAULTS[profile.fitness] || FITNESS_DEFAULTS.moderate;
  const breedIsHeatSensitive = (typeof HEAT_SENSITIVE_BREEDS !== 'undefined')
    && HEAT_SENSITIVE_BREEDS.includes(profile.breed);
  return { terrain: defaults.terrain, distance: defaults.distance, heatSensitive: breedIsHeatSensitive };
}

let guestMapInstance = null;
let showingSavedOnly = false;
let activeArea = 'all';

function createMapOverlayControls(map, containerId, allLiftMarkers){
  const container = document.getElementById(containerId);
  if(!container) return;
  
  container.style.position = container.style.position || 'relative';
  
  // Create a button group container
  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = 'position:absolute;bottom:10px;left:10px;z-index:5;display:flex;flex-direction:column;gap:8px;';
  container.appendChild(buttonGroup);
  
  // Track visibility state
  const overlayStates = {
    routes: false,
    lifts: false,
    fountains: false,
  };
  
  // Helper function to create a button
  function createButton(label, overlayKey, sourceIds = []){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = 'padding:7px 14px;border-radius:8px;background:var(--ink);color:#fff;border:none;font-size:11.5px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:all 0.2s ease;';
    btn.addEventListener('mouseover', () => btn.style.opacity = '0.9');
    btn.addEventListener('mouseout', () => btn.style.opacity = '1');
    
    btn.addEventListener('click', () => {
      overlayStates[overlayKey] = !overlayStates[overlayKey];
      const visibility = overlayStates[overlayKey] ? 'visible' : 'none';
      
      // Update layer visibility based on overlay type
      if(overlayKey === 'routes'){
        map.setLayoutProperty('waymarked-hiking-layer', 'visibility', visibility);
      } else if(overlayKey === 'lifts'){
        map.setLayoutProperty('trailmap-gondolas-line', 'visibility', visibility);
        map.setLayoutProperty('trailmap-gondolas-labels', 'visibility', visibility);
        if(allLiftMarkers) allLiftMarkers.forEach(el => { el.style.visibility = visibility; });
      } else if(overlayKey === 'fountains'){
        map.setLayoutProperty('water-sources-layer', 'visibility', visibility);
      }
      
      // Update button text and style
      updateButtonAppearance(btn, overlayKey, overlayStates[overlayKey]);
    });
    
    buttonGroup.appendChild(btn);
    return btn;
  }
  
  function updateButtonAppearance(btn, overlayKey, isVisible){
    const labels = {
      routes: isVisible ? '🥾 Hide trail routes' : '🥾 Show trail routes',
      lifts: isVisible ? '🚡 Hide lifts' : '🚡 Show lifts',
      fountains: isVisible ? '💧 Hide fountains' : '💧 Show fountains',
    };
    btn.textContent = labels[overlayKey];
    btn.style.opacity = isVisible ? '1' : '0.8';
  }
  
  // Create the three buttons
  const routesBtn = createButton('🥾 Show trail routes', 'routes');
  const liftsBtn = createButton('🚡 Show lifts', 'lifts');
  const fountainsBtn = createButton('💧 Show fountains', 'fountains');
}


function renderGondolas(map, sourceId){
  if(typeof gondolas === 'undefined' || !gondolas.length) return null;
  const features = gondolas.map(g => ({
    type: 'Feature',
    properties: { name: g.name, note: g.note, status: g.status },
    geometry: { type: 'LineString', coordinates: [[g.from.lng, g.from.lat], [g.to.lng, g.to.lat]] },
  }));
  map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } });

  map.addLayer({
    id: sourceId + '-line',
    type: 'line',
    source: sourceId,
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'none' },
    paint: {
      'line-color': [
        'match', ['get', 'status'],
        'summer', '#4E90A8',
        'no-summer', '#9C3A25',
        '#5A5548',
      ],
      'line-width': 2.5,
      'line-opacity': 0.9,
      'line-dasharray': ['match', ['get', 'status'], 'summer', ['literal', [1, 0]], ['literal', [2, 1]]],
    },
  });

  map.addLayer({
    id: sourceId + '-labels',
    type: 'symbol',
    source: sourceId,
    layout: {
      visibility: 'none',
      'symbol-placement': 'line',
      'symbol-spacing': 250,
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-rotation-alignment': 'map',
      'text-keep-upright': true,
    },
    paint: {
      'text-color': [
        'match', ['get', 'status'],
        'summer', '#2E4034',
        'no-summer', '#7a2818',
        '#4a4638',
      ],
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  });

  map.on('click', sourceId + '-line', (e) => {
    const p = e.features[0].properties;
    new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat)
      .setHTML(`<b>${p.name}</b><br>${p.note}`).addTo(map);
  });
  map.on('mouseenter', sourceId + '-line', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', sourceId + '-line', () => map.getCanvas().style.cursor = '');

  const allLiftMarkers = [];
  gondolas.forEach(g => {
    [g.from, g.to].forEach(station => {
      const el = document.createElement('div');
      el.style.cssText = 'width:22px;height:22px;border-radius:50%;background:#4E90A8;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer;visibility:hidden;';
      el.textContent = '🚡';
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.lng, station.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(`<b>${g.name}</b><br>${station.label}<br>${g.note}`))
        .addTo(map);
      allLiftMarkers.push(el);
    });
  });
  
  return allLiftMarkers;
}

function initGuestMap(){
  if(guestMapInstance || typeof maplibregl === 'undefined' || typeof trails === 'undefined') return;
  const el = document.getElementById('guestPreviewMap');
  if(!el) return;

  guestMapInstance = new maplibregl.Map({
    container: 'guestPreviewMap',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [12.05, 46.55],
    zoom: 8,
    scrollZoom: false,
  });

  guestMapInstance.on('load', () => {
    addTerrainSource(guestMapInstance);
    increaseLabelDensity(guestMapInstance);
    addTerrainToggle(guestMapInstance, 'guestPreviewMap', 1.3, 0);
    renderGondolas(guestMapInstance, 'guest-gondolas');
    // Real route lines for any trail that has one — same data the logged-in map uses.
    const pathFeatures = trails
      .filter(t => Array.isArray(t.path) && t.path.length > 1)
      .map(t => ({
        type: 'Feature',
        properties: { name: t.name, safetyLevel: t.safetyLevel },
        geometry: { type: 'LineString', coordinates: t.path.map(([lat, lng]) => [lng, lat]) },
      }));
    guestMapInstance.addSource('guest-trail-paths', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: pathFeatures },
    });
    guestMapInstance.addLayer({
      id: 'guest-trail-paths-line',
      type: 'line',
      source: 'guest-trail-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': [
          'match', ['get', 'safetyLevel'],
          'low-risk', '#2C5C34',
          'moderate', '#8A5A16',
          'caution', '#9C3A25',
          '#2E4034',
        ],
        'line-width': 2.5,
      },
    });

    const bounds = new maplibregl.LngLatBounds();
    trails.forEach(t => {
      if(typeof t.lat !== 'number' || typeof t.lng !== 'number') return;
      let markerLat = t.lat, markerLng = t.lng;
      if(t.startPoint){
        markerLat = t.startPoint.lat; markerLng = t.startPoint.lng;
      } else if(Array.isArray(t.path) && t.path.length > 0){
        [markerLat, markerLng] = t.path[0];
      }
      const trailNumber = t.ref ? `Trail ${t.ref}<br>` : '';
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<b>${t.name}</b><br>${trailNumber}${t.area}<br><a href="trail.html?id=${t.id}" style="display:inline-block;margin-top:6px;font-weight:700;color:#D6A038;text-decoration:none;">Trail details →</a>`
      );
      new maplibregl.Marker({ color: '#D6A038' }).setLngLat([markerLng, markerLat]).setPopup(popup).addTo(guestMapInstance);
      bounds.extend([markerLng, markerLat]);
    });
    guestMapInstance.fitBounds(bounds, { padding: 40, maxZoom: 10 });
  });
}


let trailMapInstance = null;
let trailMarkers = {};

let trailMapLoaded = false;
let pendingPathList = null;

function initTrailMap(){
  if(trailMapInstance || typeof maplibregl === 'undefined') return;
  const el = document.getElementById('trailMap');
  if(!el) return;
  // Note: MapLibre uses [lng, lat] order — the opposite of Leaflet's [lat, lng].
  trailMapInstance = new maplibregl.Map({
    container: 'trailMap',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [12.05, 46.55],
    zoom: 9,
    scrollZoom: false,
  });
  trailMapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

  trailMapInstance.on('load', () => {
    addTerrainSource(trailMapInstance);
    increaseLabelDensity(trailMapInstance);
    addTerrainToggle(trailMapInstance, 'trailMap', 1.3, 0);
    
    const allLiftMarkers = renderGondolas(trailMapInstance, 'trailmap-gondolas');
    
    // Waymarked Trails hiking overlay — shows route numbers, waymarking, and trail network detail
    const firstLabelLayer = trailMapInstance.getStyle().layers.find(l => l.type === 'symbol');
    trailMapInstance.addSource('waymarked-hiking', {
      type: 'raster',
      tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© Sarah Hoffmann (CC-BY-SA) — waymarkedtrails.org',
    });
    trailMapInstance.addLayer({
      id: 'waymarked-hiking-layer',
      type: 'raster',
      source: 'waymarked-hiking',
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.4 },
    }, firstLabelLayer ? firstLabelLayer.id : undefined);
    
    trailMapInstance.addSource('trail-paths', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    trailMapInstance.addLayer({
      id: 'trail-paths-line',
      type: 'line',
      source: 'trail-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': [
          'match', ['get', 'safetyLevel'],
          'low-risk', '#2C5C34',
          'moderate', '#8A5A16',
          'caution', '#9C3A25',
          '#2E4034', // fallback if safetyLevel is missing
        ],
        'line-width': 3,
      },
    });

    // Water sources (fountains, springs) — clickable markers on the map
    trailMapInstance.addSource('water-sources', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    trailMapInstance.addLayer({
      id: 'water-sources-layer',
      type: 'circle',
      source: 'water-sources',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 6,
        'circle-color': '#4E90A8',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.8,
      },
    });
    trailMapInstance.on('click', 'water-sources-layer', (e) => {
      const p = e.features[0].properties;
      new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat)
        .setHTML(`<b>💧 ${p.label}</b><br>Km ${p.km}`).addTo(trailMapInstance);
    });
    trailMapInstance.on('mouseenter', 'water-sources-layer', () => trailMapInstance.getCanvas().style.cursor = 'pointer');
    trailMapInstance.on('mouseleave', 'water-sources-layer', () => trailMapInstance.getCanvas().style.cursor = '');
    
    // Create overlay toggle controls
    createMapOverlayControls(trailMapInstance, 'trailMap', allLiftMarkers);
    
    trailMapLoaded = true;
    if(pendingPathList) updatePathLayer(pendingPathList);
  });
}

function pathThumbnailSvg(path){
  if(!Array.isArray(path) || path.length < 2) return null;
  const lats = path.map(p => p[0]), lngs = path.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 120, H = 90, pad = 10;
  const spanLat = (maxLat - minLat) || 0.0001;
  const spanLng = (maxLng - minLng) || 0.0001;
  const scale = Math.min((W - pad*2) / spanLng, (H - pad*2) / spanLat);
  const points = path.map(([lat, lng]) => {
    const x = pad + (lng - minLng) * scale + (W - pad*2 - spanLng*scale) / 2;
    const y = pad + (maxLat - lat) * scale + (H - pad*2 - spanLat*scale) / 2; // flip Y (lat increases upward)
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
    <rect width="${W}" height="${H}" fill="var(--sage-dim)"/>
    <polyline points="${points}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

// Increases label density by telling every text/icon layer in the base
// style to render even when it would otherwise overlap a neighbor. By
// default, vector styles hide crowded labels for cleanliness — this trades
// some visual tidiness for more names actually being visible, which is
// what was being asked for here. Works on any style without needing to
// know its specific internal layer names, since it targets every layer of
// type 'symbol' generically rather than hardcoded IDs.
function increaseLabelDensity(map){
  const layers = map.getStyle().layers || [];
  layers.forEach(layer => {
    if(layer.type !== 'symbol') return;
    try {
      map.setLayoutProperty(layer.id, 'text-allow-overlap', true);
      map.setLayoutProperty(layer.id, 'icon-allow-overlap', true);
      map.setLayoutProperty(layer.id, 'text-optional', true);
      // The overlap settings above only stop labels being hidden due to
      // crowding — they don't touch a layer's own built-in minzoom, which
      // is the actual reason a wide, zoomed-out overview map shows far
      // fewer labels than a zoomed-in single-trail view: many place-name
      // layers in a style simply don't exist below a certain zoom at all.
      // Clearing that floor makes every label the style is capable of
      // showing become a candidate at any zoom, so overlap logic (not a
      // hard cutoff) becomes the only thing controlling what's visible.
      map.setLayerZoomRange(layer.id, 0, 24);
    } catch(e) { /* some layers may not support one of these props — skip silently */ }
  });
}

function addTerrainToggle(map, containerId, exaggeration, defaultPitch){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.style.position = container.style.position || 'relative';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'View 3D';
  btn.style.cssText = 'position:absolute;bottom:10px;left:10px;z-index:5;padding:7px 14px;border-radius:14px;background:var(--ink);color:#fff;border:none;font-size:11.5px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);';
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
        }, map.getLayer('trail-paths-line') ? 'trail-paths-line' : undefined);
      }
      map.easeTo({ pitch: defaultPitch || 0, duration: 500 });
      btn.textContent = 'View flat';
    } else {
      map.setTerrain(null);
      if(map.getLayer('hillshade-layer')) map.removeLayer('hillshade-layer');
      map.easeTo({ pitch: 0, duration: 500 });
      btn.textContent = 'View 3D';
    }
    is3D = !is3D;
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

function jumpToCard(trailId){
  const card = document.getElementById(`trail-card-${trailId}`);
  if(!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('highlighted');
  setTimeout(() => card.classList.remove('highlighted'), 2000);
}

function updatePathLayer(list){
  if(!trailMapLoaded){
    pendingPathList = list;
    return;
  }
  const features = list
    .filter(t => Array.isArray(t.path) && t.path.length > 1)
    .map(t => ({
      type: 'Feature',
      properties: { id: t.id, name: t.name, safetyLevel: t.safetyLevel },
      geometry: { type: 'LineString', coordinates: t.path.map(([lat, lng]) => [lng, lat]) },
    }));
  trailMapInstance.getSource('trail-paths').setData({ type: 'FeatureCollection', features });
  
  // Also populate water sources from the visible trails
  const waterFeatures = [];
  list.forEach(t => {
    if(Array.isArray(t.waterSources) && Array.isArray(t.path) && t.path.length > 1){
      t.waterSources.forEach(w => {
        const fraction = t.distance > 0 ? w.km / t.distance : 0;
        let lat, lng;
        if(typeof w.lat === 'number' && typeof w.lng === 'number'){
          lat = w.lat; lng = w.lng;
        } else {
          // Interpolate position along the path
          const totalDist = t.path.reduce((sum, p, i) => i === 0 ? 0 : sum + Math.hypot(p[0]-t.path[i-1][0], p[1]-t.path[i-1][1]) * 111000, 0);
          const targetDist = totalDist * Math.max(0, Math.min(1, fraction));
          let acc = 0;
          for(let i = 0; i < t.path.length - 1; i++){
            const seg = Math.hypot(t.path[i+1][0]-t.path[i][0], t.path[i+1][1]-t.path[i][1]) * 111000;
            if(acc + seg >= targetDist){
              const t_frac = seg > 0 ? (targetDist - acc) / seg : 0;
              lat = t.path[i][0] + (t.path[i+1][0] - t.path[i][0]) * t_frac;
              lng = t.path[i][1] + (t.path[i+1][1] - t.path[i][1]) * t_frac;
              break;
            }
            acc += seg;
          }
          if(!lat) [lat, lng] = t.path[t.path.length - 1];
        }
        waterFeatures.push({
          type: 'Feature',
          properties: { label: w.label, km: w.km, trailId: t.id },
          geometry: { type: 'Point', coordinates: [lng, lat] },
        });
      });
    }
  });
  if(trailMapInstance.getSource('water-sources')){
    trailMapInstance.getSource('water-sources').setData({ type: 'FeatureCollection', features: waterFeatures });
  }
}

function updateMapMarkers(list){
  if(!trailMapInstance) return;
  updatePathLayer(list);
  const visibleIds = new Set(list.map(t => t.id));

  // Remove markers for trails no longer in the filtered view
  Object.keys(trailMarkers).forEach(id => {
    if(!visibleIds.has(id)){
      trailMarkers[id].remove();
      delete trailMarkers[id];
    }
  });

  // Add markers for newly-visible trails
  list.forEach(t => {
    if(trailMarkers[t.id] || typeof t.lat !== 'number' || typeof t.lng !== 'number') return;
    // Prefer the real, verified starting point over the general reference
    // coordinate — a trail's own `lat`/`lng` is sometimes just an
    // approximate area marker, while `startPoint` (or the path's own first
    // point) is the actual real trailhead when we have real GPS data.
    let markerLat = t.lat, markerLng = t.lng;
    if(t.startPoint){
      markerLat = t.startPoint.lat; markerLng = t.startPoint.lng;
    } else if(Array.isArray(t.path) && t.path.length > 0){
      [markerLat, markerLng] = t.path[0];
    }
    const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
      `<b>${t.name}</b><br>${t.score}% match<br><a href="trail.html?id=${t.id}" style="display:inline-block;margin-top:6px;font-weight:700;color:#D6A038;text-decoration:none;">Trail details →</a>`
    );
    const marker = new maplibregl.Marker({ color: '#D6A038' })
      .setLngLat([markerLng, markerLat])
      .setPopup(popup)
      .addTo(trailMapInstance);
    marker.getElement().style.cursor = 'pointer';
    marker.getElement().addEventListener('click', () => jumpToCard(t.id));
    trailMarkers[t.id] = marker;
  });

  // Fit the view to whatever's currently visible, so filtering the list
  // also re-frames the map instead of leaving it zoomed to the wrong area.
  const validList = list.filter(t => typeof t.lat === 'number' && typeof t.lng === 'number');
  if(validList.length > 0){
    const bounds = new maplibregl.LngLatBounds();
    validList.forEach(t => {
      if(Array.isArray(t.path) && t.path.length > 1){
        t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
      } else {
        bounds.extend([t.lng, t.lat]);
      }
    });
    trailMapInstance.fitBounds(bounds, { padding: 40, maxZoom: 12 });
  }
}

function renderAreaFilters(profile){
  const row = document.getElementById('areaFilterRow');
  if(!row || typeof trails === 'undefined') return;
  const areas = Array.from(new Set(trails.map(t => t.area))).sort();
  const pills = ['all', ...areas];
  row.innerHTML = pills.map(a => `
    <div class="area-pill ${a === activeArea ? 'active' : ''}" data-area="${a}">${a === 'all' ? 'All areas' : a}</div>
  `).join('');
  row.querySelectorAll('.area-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      activeArea = pill.dataset.area;
      renderAreaFilters(profile);
      renderReturningHomepage(profile);
    });
  });
}

async function renderReturningHomepage(profile){
  const heading = document.getElementById('returningHeading');
  const subline = document.getElementById('returningSubline');
  const countEl = document.getElementById('returningCount');
  const listEl = document.getElementById('returningTrailList');
  if(!heading || typeof trails === 'undefined') return;

  renderAreaFilters(profile);

  const name = (profile && profile.name) ? profile.name : 'there';
  const overrides = profile ? effectiveOverrides(profile) : { terrain:'1', distance:'10', heatSensitive:false };

  const scored = trails.map(t => ({...t, score: scoreTrail(t, overrides)})).sort((a,b) => b.score - a.score);

  // Genuine new-match detection: compare today's strong matches against
  // what was stored on the account the last time they visited. This is
  // computed against the FULL list, regardless of which view is showing,
  // so a saved trail's NEW MATCH badge stays accurate either way.
  let newIds = new Set();
  if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
    const previous = await window.DoloPawsAuth.getLastMatches();
    const currentTopIds = scored.filter(t => t.score >= NEW_MATCH_THRESHOLD).map(t => t.id);
    if(Array.isArray(previous)){
      newIds = new Set(currentTopIds.filter(id => !previous.includes(id)));
    }
    // Store today's snapshot for next visit — after comparing, not before.
    await window.DoloPawsAuth.setLastMatches(currentTopIds);
  }

  heading.textContent = profile && profile.name ? `Welcome back — trail matches for ${name}` : 'Welcome back';
  const baseSubline = newIds.size > 0
    ? `${newIds.size} new match${newIds.size === 1 ? '' : 'es'} since your last visit.`
    : profile && profile.name ? `Ranked for ${name}'s saved profile.` : 'Add your dog’s details to personalize this list.';
  subline.innerHTML = `${baseSubline} <a href="account.html" style="color:var(--ink);font-weight:700;text-decoration:underline;">Edit profile →</a>`;

  let displayList = showingSavedOnly ? scored.filter(t => currentFavorites[t.id]) : scored;
  if(activeArea !== 'all') displayList = displayList.filter(t => t.area === activeArea);

  countEl.textContent = showingSavedOnly
    ? `${displayList.length} saved trail${displayList.length === 1 ? '' : 's'}`
    : `${displayList.length} trails`;

  updateMapMarkers(displayList);

  if(savedTrailsBtn){
    savedTrailsBtn.textContent = showingSavedOnly ? '← All trails' : 'Saved trails';
    savedTrailsBtn.classList.toggle('active', showingSavedOnly);
  }

  if(displayList.length === 0){
    const msg = showingSavedOnly && activeArea !== 'all'
      ? `No saved trails in ${activeArea}. Try a different area, or go back to all trails.`
      : showingSavedOnly
        ? `You haven't saved any trails yet. Click "Save" on a trail below to keep it here.`
        : `No trails in ${activeArea}. Try a different area.`;
    listEl.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--ink-soft);font-size:14px;">${msg}</div>`;
    return;
  }

  listEl.innerHTML = displayList.map(t => {
    const isFav = !!currentFavorites[t.id];
    const isNew = newIds.has(t.id);
    const thumb = pathThumbnailSvg(t.path);
    return `
    <div class="trail-card" id="trail-card-${t.id}" data-id="${t.id}">
      <div class="photo" data-trail-id="${t.id}" style="${thumb ? 'cursor:pointer;' : ''}">${thumb || ''}</div>
      <div class="body">
        <div class="top-row">
          <span class="safety-badge ${safetyClass(t.safetyLevel)}">${safetyLabel(t.safetyLevel)}</span>
          ${isNew ? `<span style="font-size:10px;font-weight:700;color:#fff;background:var(--accent);padding:3px 8px;border-radius:10px;">NEW MATCH</span>` : ''}
          <div style="display:flex;align-items:center;gap:10px;margin-left:auto;">
            <span style="font-weight:700;font-size:12px;color:var(--success);white-space:nowrap;">${t.score}% match</span>
            <button class="fav-btn save-btn ${isFav ? 'saved' : ''}" data-id="${t.id}" style="font-size:11.5px;padding:5px 14px;">${isFav ? 'Saved' : 'Save'}</button>
          </div>
        </div>
        <a href="trail.html?id=${t.id}" class="name" style="margin-top:6px;display:block;text-decoration:none;color:inherit;">${t.name}</a>
        <div class="meta">${t.ref ? `Trail ${t.ref} · ` : ''}${t.area} · ${t.distance} km · ${t.elevation} m gain · ${t.hours} h</div>
        <span class="tag">${t.terrainType}</span>
        ${thumb ? `<div style="font-size:10.5px;color:var(--ink-soft);margin-top:6px;">↑ actual route shape, from real trail data</div>` : ''}
        <a href="trail.html?id=${t.id}" style="display:inline-block;margin-top:10px;font-size:12.5px;font-weight:700;color:var(--accent);text-decoration:none;">Trail details →</a>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if(currentFavorites[id]) delete currentFavorites[id];
      else currentFavorites[id] = true;
      if(window.DoloPawsAuth) await window.DoloPawsAuth.setFavorites(currentFavorites);
      renderReturningHomepage(profile);
    });
  });

  listEl.querySelectorAll('.photo[data-trail-id]').forEach(el => {
    el.addEventListener('click', () => focusMapOnTrail(el.dataset.trailId, displayList));
  });
}

function focusMapOnTrail(trailId, list){
  if(!trailMapInstance) return;
  const t = list.find(x => x.id === trailId);
  if(!t) return;
  document.getElementById('trailMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if(Array.isArray(t.path) && t.path.length > 1){
    const bounds = new maplibregl.LngLatBounds();
    t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
    trailMapInstance.fitBounds(bounds, { padding: 60, maxZoom: 15 });
  } else if(typeof t.lat === 'number' && typeof t.lng === 'number'){
    trailMapInstance.flyTo({ center: [t.lng, t.lat], zoom: 13 });
  }
  const marker = trailMarkers[trailId];
  if(marker) marker.togglePopup();
}

// Adjust-for-today panel wiring
const adjustToggle = document.getElementById('adjustToggle');
const adjustPanel = document.getElementById('adjustPanel');
const adjustCloseBtn = document.getElementById('adjustCloseBtn');
let currentProfileForAdjust = null;

const savedTrailsBtn = document.getElementById('savedTrailsBtn');
if(savedTrailsBtn){
  savedTrailsBtn.addEventListener('click', () => {
    showingSavedOnly = !showingSavedOnly;
    renderReturningHomepage(currentProfileForAdjust);
  });
}

if(adjustToggle){
  adjustToggle.addEventListener('click', () => {
    adjustPanel.hidden = false;
    adjustToggle.hidden = true;
  });
}
if(adjustCloseBtn){
  adjustCloseBtn.addEventListener('click', () => {
    adjustPanel.hidden = true;
    adjustToggle.hidden = false;
    adjustOverride = null;
    renderReturningHomepage(currentProfileForAdjust);
  });
}
document.querySelectorAll('.adj-pill-row').forEach(row => {
  row.addEventListener('click', (e) => {
    const pill = e.target.closest('.adj-pill');
    if(!pill) return;
    row.querySelectorAll('.adj-pill').forEach(p => {
      p.style.background = 'none';
      p.style.color = 'var(--ink)';
      p.style.borderColor = 'var(--paper-line)';
      p.classList.remove('active');
    });
    pill.style.background = 'var(--ink)';
    pill.style.color = '#fff';
    pill.style.borderColor = 'var(--ink)';
    pill.classList.add('active');

    const group = row.dataset.group;
    if(!adjustOverride){
      const base = currentProfileForAdjust ? effectiveOverrides(currentProfileForAdjust) : { terrain:'1', distance:'10', heatSensitive:false };
      adjustOverride = {...base};
    }
    adjustOverride[group] = pill.dataset.value;
    renderReturningHomepage(currentProfileForAdjust);
  });
});
document.querySelectorAll('.adj-pill').forEach(p => {
  p.style.padding = '8px 14px';
  p.style.borderRadius = '14px';
  p.style.border = '1.5px solid var(--paper-line)';
  p.style.fontSize = '12px';
  p.style.fontWeight = '600';
  p.style.color = 'var(--ink)';
  p.style.cursor = 'pointer';
  p.style.fontFamily = "'Inter',sans-serif";
});

// ============================================================
// AUTH STATE — switch between guest and returning homepage
// ============================================================
window.addEventListener('dolopaws-auth-changed', async (e) => {
  const user = e.detail.user;
  const newHome = document.getElementById('newCustomerHomepage');
  const returningHome = document.getElementById('returningCustomerHomepage');
  const browseNavLink = document.getElementById('browseNavLink');
  if(browseNavLink) browseNavLink.href = user ? 'my-trails.html' : 'browse-trails.html';
  if(!newHome || !returningHome) return;

  if(user && window.DoloPawsAuth){
    newHome.hidden = true;
    returningHome.hidden = false;
    adjustOverride = null;
    initTrailMap();

    const profile = await window.DoloPawsAuth.getDogProfile();
    currentProfileForAdjust = profile;
    currentFavorites = await window.DoloPawsAuth.getFavorites();
    renderReturningHomepage(profile);
  } else {
    newHome.hidden = false;
    returningHome.hidden = true;
    initGuestMap();
  }
});
