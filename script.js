

function safetyLabel(level){
  if(level === 'low-risk') return t('safety.low');
  if(level === 'moderate') return t('safety.moderate');
  return t('safety.caution');
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
      <div class="photo">${t.imageIcon
        ? `<img src="${t.imageIcon}" alt="${t.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">`
        : (pathThumbnailSvg(t.path) || '')}</div>
      <div class="row">
        <div class="name">${t.name}</div>
        <div class="match">${scoreTrail(t, generic)}%</div>
      </div>
      <div class="meta">${t.ref ? window.t('card.trailRef', {ref: t.ref}) + ' · ' : ''}${t.area} · ${t.distance} km</div>
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
// The teaser button previews the catalog (30 trails visible, details
// locked behind login) instead of jumping straight to signup.
if(unlockBtn) unlockBtn.addEventListener('click', () => { window.location.href = 'browse-trails.html'; });

// ============================================================
// RETURNING VISITOR — real profile, real scoring, real favorites,
// genuine "new since last visit" detection (not a decorative badge).
// ============================================================
const NEW_MATCH_THRESHOLD = 70; // trails scoring at/above this count as "a match" for new-match tracking
let adjustOverride = null; // session-only override, never saved to the profile
let showFullList = false;  // homepage: top matches first, full catalog on demand
const TOP_MATCHES = 6;
let currentFavorites = {};

let guestMapInstance = null;
let showingSavedOnly = false;
let activeArea = 'all';

// Pagination for the trail list — 15 cards per page. The map always shows
// ALL trails matching the current filters; only the card list paginates.
const TRAILS_PER_PAGE = 15;
let currentPage = 1;
let lastFilterKey = '';            // legacy, kept for safety
let activeRegion = 'dolomites';
let activeValley = 'all';
let activeProvenance = 'all';      // 'all' | 'verified' | 'imported'

function createMapOverlayControls(map, containerId, allLiftMarkers){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.style.position = container.style.position || 'relative';
  const icons = window.DoloPawsIcons;

  // UI: one compact "Layers" button that expands into a chip panel —
  // replaces the old stack of full-width buttons that covered a third of
  // the map on mobile.
  const overlayStates = { routes: false, lifts: false, fountains: false, huts: false, barsCafes: false };
  let dogFilterOn = false;

  const layersBtn = document.createElement('button');
  layersBtn.type = 'button';
  layersBtn.textContent = t('map.layers');
  layersBtn.className = 'map-btn';
  layersBtn.style.left = '10px';
  container.appendChild(layersBtn);

  const panel = document.createElement('div');
  panel.className = 'map-panel';
  container.appendChild(panel);

  layersBtn.addEventListener('click', () => {
    const open = panel.style.display === 'flex';
    panel.style.display = open ? 'none' : 'flex';
    layersBtn.textContent = open ? t('map.layers') : t('map.closeLayers');
  });

  function chipStyle(el, on){
    el.className = 'map-chip' + (on ? ' on' : '');
  }

  const LAYER_SETS = {
    routes:   ['waymarked-hiking-layer'],
    lifts:    ['trailmap-gondolas-labels'],
    fountains:['water-sources-layer-lowzoom', 'water-sources-layer', 'water-sources-cluster', 'water-sources-cluster-count'],
    huts:     ['mountain-huts-layer-lowzoom', 'mountain-huts-layer', 'mountain-huts-cluster', 'mountain-huts-cluster-count'],
    barsCafes:['bars-cafes-layer-lowzoom', 'bars-cafes-layer', 'bars-cafes-cluster', 'bars-cafes-cluster-count'],
  };

  function applyVisibility(key){
    const visibility = overlayStates[key] ? 'visible' : 'none';
    LAYER_SETS[key].forEach(id => {
      if(map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
    });
    if(key === 'lifts' && allLiftMarkers){
      allLiftMarkers.forEach(el => { el.style.visibility = overlayStates.lifts ? 'visible' : 'hidden'; });
    }
  }

  function mkChip(label, key){
    const chip = document.createElement('button');
    chip.type = 'button';
    const iconKey = key === 'fountains' ? 'water'
      : key === 'huts' ? 'hut'
      : key === 'barsCafes' ? 'food'
      : key;
    chip.innerHTML = icons ? icons.chipHtml(iconKey, label) : label;
    chipStyle(chip, overlayStates[key]);
    chip.addEventListener('click', () => {
      overlayStates[key] = !overlayStates[key];
      applyVisibility(key);
      chipStyle(chip, overlayStates[key]);
      renderMapLegend();
    });
    panel.appendChild(chip);
    return chip;
  }

  mkChip(t('chips.routes'), 'routes');
  mkChip(t('chips.lifts'), 'lifts');
  mkChip(t('chips.fountains'), 'fountains');
  mkChip(t('chips.huts'), 'huts');
  const barsChip = mkChip(t('chips.food'), 'barsCafes');

  // 🐾 Dog-friendly filter — narrows food & drink to places OSM marks
  // dog=yes/leashed or with outdoor seating; dog=no always excluded.
  // Swaps the source data because a layer filter alone wouldn't change
  // the cluster bubbles' counts.
  const dogChip = document.createElement('button');
  dogChip.type = 'button';
  dogChip.innerHTML = icons ? icons.chipHtml('dog', t('chips.dog')) : t('chips.dog');
  chipStyle(dogChip, false);
  dogChip.addEventListener('click', () => {
    if(!window._dolopawsBars) return; // GeoJSON not loaded yet
    const srcData = map.getSource('bars-cafes');
    if(!srcData) return;
    dogFilterOn = !dogFilterOn;
    const feats = dogFilterOn
      ? window._dolopawsBars.filter(f => {
          const p = f.properties || {};
          if(p.dog === 'no') return false;
          return p.dog === 'yes' || p.dog === 'leashed' || p.outdoor_seating === 'yes';
        })
      : window._dolopawsBars;
    srcData.setData({ type: 'FeatureCollection', features: feats });
    if(dogFilterOn && !overlayStates.barsCafes){
      overlayStates.barsCafes = true;
      applyVisibility('barsCafes');
      chipStyle(barsChip, true);
    }
    chipStyle(dogChip, dogFilterOn);
    renderMapLegend();
  });
  panel.appendChild(dogChip);

  // UI: dynamic legend — only describes what is actually visible on the
  // map right now, instead of a fixed list of every possible layer.
  function renderMapLegend(){
    const legend = document.getElementById('trailMapLegend');
    if(!legend) return;
    const line = (color, label) => `<span><span style="width:14px;height:3px;background:${color};display:inline-block;border-radius:2px;margin-right:4px;vertical-align:middle;"></span>${label}</span>`;
    const dash = (color, label) => `<span><span style="width:14px;height:0;border-top:2px dashed ${color};display:inline-block;margin-right:4px;vertical-align:middle;"></span>${label}</span>`;
    const category = (iconKey, color, label) => icons
      ? icons.legendItemHtml(iconKey, label, { color })
      : `<span><span style="width:9px;height:9px;background:${color};display:inline-block;border-radius:50%;margin-right:4px;vertical-align:middle;border:1px solid #fff;"></span>${label}</span>`;
    let html = line('#2C5C34', t('legend.low')) + line('#8A5A16', t('legend.moderate')) + line('#9C3A25', t('legend.caution'))
      + line('#4E90A8', t('legend.liftConfirmed')) + dash('#5A5548', t('legend.liftUnknown'));
    if(overlayStates.fountains) html += category('water', '#4E90A8', t('legend.water'));
    if(overlayStates.huts) html += category('hut', '#8A5A16', t('legend.hut'));
    if(overlayStates.barsCafes) html += category('food', '#C4652F', t('legend.food'));
    if(dogFilterOn) html += category('dog', '#2E4034', t('legend.dogOn'));
    legend.innerHTML = html;
  }
  renderMapLegend();
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
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'visible' },
    paint: {
      'line-color': [
        'match', ['get', 'status'],
        'summer', '#4E90A8',
        'no-summer', '#9C3A25',
        '#5A5548',
      ],
      'line-width': 1.5,
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
      const el = window.DoloPawsIcons
        ? window.DoloPawsIcons.createMarkerElement('lifts', { color: '#4E90A8' })
        : Object.assign(document.createElement('div'), { className: 'dp-marker', textContent: '🚡' });
      el.style.visibility = 'hidden';
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

  guestMapInstance.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true,
    fitBoundsOptions: { maxZoom: 15.5 },
  }), 'top-right');

  // Teaser pill: how much is waiting behind the profile gate.
  const guestMapEl = document.getElementById('guestPreviewMap');
  if (guestMapEl && typeof trails !== 'undefined'){
    guestMapEl.style.position = guestMapEl.style.position || 'relative';
    const pill = document.createElement('div');
    pill.textContent = t('guest.trailCount', {n: trails.length});
    pill.style.cssText = 'position:absolute;top:10px;left:10px;z-index:5;background:var(--ink);color:#fff;font-size:12px;font-weight:700;padding:8px 14px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none;';
    guestMapEl.appendChild(pill);

    // France announcement as a sticker slapped on the map's corner:
    // slightly rotated, bordered, with the beret-dog icon.
    const sticker = document.createElement('div');
    sticker.style.cssText = 'position:absolute;top:58px;right:14px;z-index:5;background:#fff;border:2px solid var(--ink);border-radius:14px;padding:10px 14px;max-width:210px;transform:rotate(4deg);box-shadow:0 4px 12px rgba(0,0,0,.18);display:flex;align-items:center;gap:9px;pointer-events:none;';
    sticker.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex:none;"><circle cx="12" cy="14" r="6" stroke="var(--ink)" stroke-width="1.8"/><path d="M8 10.5L6.5 6l4.5 2.5z" fill="var(--ink)"/><path d="M6.5 9.5c1-2.5 3-3.8 5.5-3.8s4.5 1.3 5.5 3.8" fill="var(--accent-light)"/><circle cx="12" cy="5" r="1" fill="var(--accent-light)"/><circle cx="15.8" cy="15.2" r="1.3" fill="var(--accent-light)"/></svg>'
      + '<span style="font-size:12px;font-weight:700;color:var(--ink);line-height:1.35;">' + t('guest.franceBanner') + '</span>';
    guestMapEl.appendChild(sticker);

  }

  guestMapInstance.on('load', async () => {
    addTerrainSource(guestMapInstance);
    increaseLabelDensity(guestMapInstance);
    preventTransitPoiDuplication(guestMapInstance);
    addTerrainToggle(guestMapInstance, 'guestPreviewMap', 1.3, 0);
    if(window.DoloPawsIcons) await window.DoloPawsIcons.registerMapImages(guestMapInstance);
    renderGondolas(guestMapInstance, 'guest-gondolas');
    if (typeof makeBasemapPoisClickable === 'function') makeBasemapPoisClickable(guestMapInstance);
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
      const trailNumber = t.ref ? window.t('card.trailRef', {ref: t.ref}) + '<br>' : '';
      // Guests get name + area only — trail pages stay behind a profile.
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<b>${t.name}</b><br>${trailNumber}${t.area}<br><span style="display:inline-block;margin-top:6px;font-size:11.5px;color:var(--ink-soft);">${window.t('guest.lockedPopup')}</span>`
      );
      new maplibregl.Marker({ element: makeTrailDot() }).setLngLat([markerLng, markerLat]).setPopup(popup).addTo(guestMapInstance);
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
  trailMapInstance.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true,
    fitBoundsOptions: { maxZoom: 15.5 },
  }), 'top-right');

  trailMapInstance.on('load', async () => {
    addTerrainSource(trailMapInstance);
    increaseLabelDensity(trailMapInstance);
    preventTransitPoiDuplication(trailMapInstance);
    addTerrainToggle(trailMapInstance, 'trailMap', 1.3, 0);
    if(window.DoloPawsIcons) await window.DoloPawsIcons.registerMapImages(trailMapInstance);
    
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

    // Create overlay toggle controls
    createMapOverlayControls(trailMapInstance, 'trailMap', allLiftMarkers);
    
    // Initialize water sources from combined GeoJSON (Trentino, Veneto, Savoy)
    initializeWaterSources(trailMapInstance);

    // Initialize dog-friendly OSM routes from generated GeoJSON
    if (typeof initializeDogRoutes === 'function') initializeDogRoutes(trailMapInstance);

    // Initialize mountain huts & bars from combined GeoJSON (Trentino, Veneto, Savoy)
    initializeHutsBars(trailMapInstance);
    
    if (typeof makeBasemapPoisClickable === 'function') makeBasemapPoisClickable(trailMapInstance);

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

// The "liberty" base style has two independent layers that can both match
// the same transit POI (bus/rail/airport stops):
//   poi_transit (blue, #2e5a80) - filters by class in [airport, bus, rail]
//   poi_r1 / poi_r7 / poi_r20 (grey, #666) - filter by rank only, with no
//     class exclusion, so a bus stop that also carries a rank value gets
//     rendered a SECOND time by whichever of these matches its rank range.
// Normally MapLibre's collision detection would hide one of the two
// duplicates; increaseLabelDensity() disables that (text-allow-overlap),
// so both now render permanently, stacked. Real fix: explicitly exclude
// transit classes from the generic rank-based layers, since poi_transit
// already owns those - only one layer renders each site after this.
function preventTransitPoiDuplication(map){
  const genericPoiLayers = ['poi_r1', 'poi_r7', 'poi_r20'];
  genericPoiLayers.forEach(layerId => {
    const layer = map.getStyle().layers.find(l => l.id === layerId);
    if(!layer || !layer.filter) return;
    try {
      const excludeTransit = ['!', ['match', ['get', 'class'], ['airport', 'bus', 'rail'], true, false]];
      map.setFilter(layerId, ['all', layer.filter, excludeTransit]);
    } catch(e) { /* layer may not exist in this style version — skip silently */ }
  });
}

function addTerrainToggle(map, containerId, exaggeration, defaultPitch){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.style.position = container.style.position || 'relative';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '3D';
  btn.className = 'map-btn';
  btn.style.left = '88px';
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
      btn.textContent = '2D';
    } else {
      map.setTerrain(null);
      if(map.getLayer('hillshade-layer')) map.removeLayer('hillshade-layer');
      map.easeTo({ pitch: 0, duration: 500 });
      btn.textContent = '3D';
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

// Compact dot marker for trails — replaces MapLibre's default teardrop
// pin, which turns into a wall of signposts with 100+ trails on screen.
function makeTrailDot(){
  const el = document.createElement('div');
  el.className = 'dp-marker-dot';
  return el;
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
  
  // NOTE: The 'water-sources' source is managed exclusively by initializeWaterSources(),
  // which loads the full OSM dataset (Trentino, Veneto, Savoy) from
  // water-sources-all-regions.geojson. Do NOT overwrite it here — the old code that
  // replaced its data with per-trail points was wiping out all the fountain markers.
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
    const isEstPopup = t.curated === false;
    const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
      `<b>${t.name}</b>
       <div class="popup-match"><span style="font-size:21px;font-weight:800;color:${matchColor(t.score)};">${isEstPopup ? '≈' : ''}${t.score}%</span><span class="match-lbl">${window.t('card.matchWord')}</span>${isEstPopup ? `<span class="match-est">${window.t('card.estimated')}</span>` : ''}</div>
       <a href="trail.html?id=${t.id}" style="display:inline-block;font-weight:700;color:#3E7A91;text-decoration:none;">${window.t('card.details')}</a>`
    );
    const marker = new maplibregl.Marker({ element: makeTrailDot() })
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
  if(window.DoloPawsRegions) window.DoloPawsRegions.assign(trails);

  const regionCounts = { dolomites: 0, savoy: 0 };
  trails.forEach(t => { if(regionCounts[t.region] !== undefined) regionCounts[t.region]++; });

  const valleys = window.DoloPawsRegions
    ? window.DoloPawsRegions.valleysFor(trails, activeRegion)
    : [];

  row.innerHTML = `
    <div class="region-tabs">
      ${['dolomites','savoy'].map(r => `
        <button class="region-tab ${r === activeRegion ? 'active' : ''}" data-region="${r}">
          ${r === 'dolomites' ? t('region.dolomites') : t('region.savoy')} <span class="count">${regionCounts[r]}</span>
        </button>`).join('')}
    </div>
    <div class="prov-row">
      <div class="valley-pills">
        <div class="area-pill ${activeValley === 'all' ? 'active' : ''}" data-valley="all">${t('areas.allValleys')}</div>
        ${valleys.map(([v, n]) => `
          <div class="area-pill ${v === activeValley ? 'active' : ''}" data-valley="${v}">${v} <span class="pill-count">${n}</span></div>`).join('')}
      </div>
      <div class="prov-toggle">
        ${[['all', t('filter.all')],['verified', t('filter.verified')],['imported', t('filter.imported')]].map(([k, label]) => `
          <div class="prov-opt ${k === activeProvenance ? 'active' : ''}" data-prov="${k}">${label}</div>`).join('')}
      </div>
    </div>
  `;

  row.querySelectorAll('.region-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeRegion = tab.dataset.region;
      activeValley = 'all'; // valleys are region-scoped
      renderReturningHomepage(profile);
    });
  });
  row.querySelectorAll('[data-valley]').forEach(pill => {
    pill.addEventListener('click', () => {
      activeValley = pill.dataset.valley;
      renderReturningHomepage(profile);
    });
  });
  row.querySelectorAll('.prov-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      activeProvenance = opt.dataset.prov;
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
  const overrides = profile ? effectiveOverrides(profile, adjustOverride) : { terrain:'1', distance:'10', heatSensitive:false };

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

  // The cloud is Eddie speaking — one line, no counts, true for any area.
  heading.textContent = '\u201C' + t('home.bubble') + '\u201D';
  const pickLine = profile && profile.name ? t('home.pickArea', {name}) : t('home.pickAreaNoName');
  const newsLine = newIds.size > 0
    ? ' ' + (newIds.size === 1 ? t('home.newMatch1') : t('home.newMatches', {n: newIds.size}))
    : '';
  subline.innerHTML = `${pickLine}${newsLine} <a href="account.html" style="color:var(--ink);font-weight:700;text-decoration:underline;">${t('home.editProfile')}</a>`;

  let displayList = showingSavedOnly ? scored.filter(t => currentFavorites[t.id]) : scored;
  displayList = displayList.filter(t => t.region === activeRegion);
  if(activeValley !== 'all') displayList = displayList.filter(t => t.valley === activeValley);
  if(activeProvenance === 'verified') displayList = displayList.filter(t => t.curated !== false);
  if(activeProvenance === 'imported') displayList = displayList.filter(t => t.curated === false);

  countEl.textContent = showingSavedOnly
    ? (displayList.length === 1 ? t('home.nSaved1') : t('home.nSaved', {n: displayList.length}))
    : t('home.nTrails', {n: displayList.length});

  updateMapMarkers(displayList);

  // Reset to page 1 whenever the filters change; clamp if the list shrank.
  const filterKey = `${activeArea}|${showingSavedOnly}`;
  if (filterKey !== lastFilterKey){ currentPage = 1; lastFilterKey = filterKey; }
  const collapsed = !showFullList && !showingSavedOnly && displayList.length > TOP_MATCHES + 2;
  const totalPages = collapsed ? 1 : Math.max(1, Math.ceil(displayList.length / TRAILS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  const pageList = collapsed
    ? displayList.slice(0, TOP_MATCHES)
    : displayList.slice((currentPage - 1) * TRAILS_PER_PAGE, currentPage * TRAILS_PER_PAGE);
  if(collapsed) countEl.textContent = t('home.topOf', {a: Math.min(TOP_MATCHES, displayList.length), b: displayList.length});

  if(savedTrailsBtn){
    savedTrailsBtn.textContent = showingSavedOnly ? t('home.allTrailsBtn') : t('home.savedTrails');
    savedTrailsBtn.classList.toggle('active', showingSavedOnly);
  }

  if(displayList.length === 0){
    const label = activeValley !== 'all' ? activeValley : (activeRegion === 'savoy' ? t('region.savoy') : t('region.theDolomites'));
    const msg = showingSavedOnly && activeValley !== 'all'
      ? t('home.noSavedValley', {label})
      : showingSavedOnly
        ? t('home.noSaved')
        : t('home.noTrailsValley', {label});
    listEl.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--ink-soft);font-size:14px;">${msg}</div>`;
    return;
  }

  const adjustActive = !!adjustOverride;
  const fitCount = displayList.filter(x => x.score >= 60).length;
  const summaryBar = adjustActive
    ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:12px;background:var(--sage-dim);border-radius:12px;font-size:12.5px;font-weight:600;color:var(--ink);">${t('home.fitLine', {a: fitCount, b: displayList.length})}</div>`
    : '';

  listEl.innerHTML = summaryBar + pageList.map(t => {
    const isFav = !!currentFavorites[t.id];
    const isNew = newIds.has(t.id);
    const isEst = t.curated === false;
    const dim = adjustActive && t.score < 60;
    const thumb = t.imageIcon ? `<img src="${t.imageIcon}" alt="${t.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">` : pathThumbnailSvg(t.path);
    return `
    <div class="trail-card" id="trail-card-${t.id}" data-id="${t.id}"${dim ? ' style="opacity:.55;"' : ''}>
      <div class="photo" data-trail-id="${t.id}" style="${thumb ? 'cursor:pointer;' : ''}">${thumb || ''}</div>
      <div class="body">
        <div class="top-row">
          ${t.curated !== false ? `<span class="badge-pill badge-verified">${window.t('badge.verified')}</span>` : `<span class="badge-pill badge-imported">${window.t('badge.imported')}</span>`}
          ${isNew ? `<span class="badge-pill badge-new">${window.t('badge.new')}</span>` : ''}
          <div style="display:flex;align-items:center;gap:10px;margin-left:auto;">
            <button class="fav-btn save-btn ${isFav ? 'saved' : ''}" data-id="${t.id}" style="font-size:11.5px;padding:5px 14px;">${isFav ? window.t('card.saved') : window.t('card.save')}</button>
          </div>
        </div>
        <a href="trail.html?id=${t.id}" class="name" style="margin-top:6px;display:block;text-decoration:none;color:inherit;">${t.name}</a>
        <div class="meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><span style="width:9px;height:9px;border-radius:50%;background:${SAFETY_DOT[t.safetyLevel] || 'var(--ink-soft)'};flex:none;"></span>${safetyLabel(t.safetyLevel)} · ${t.ref ? window.t('card.trailRef', {ref: t.ref}) + ' · ' : ''}${t.area} · ${t.distance} km · ${t.elevation} m · ${t.hours} h</div>
        <span class="tag">${t.terrainType}</span>
        ${thumb && !t.imageIcon ? `<div style="font-size:10.5px;color:var(--ink-soft);margin-top:6px;">${window.t('card.routeShape')}</div>` : ''}
        <div style="display:flex;gap:16px;align-items:center;margin-top:10px;flex-wrap:wrap;">
          <a href="trail.html?id=${t.id}" style="font-size:12.5px;font-weight:700;color:var(--accent);text-decoration:none;">${window.t('card.details')}</a>
          <button type="button" class="locate-btn" data-id="${t.id}">${window.t('card.locate')}</button>
        </div>
      </div>
      <div class="match-col">
        <span class="match-num" style="color:${matchColor(t.score)};">${isEst ? '≈' : ''}${t.score}%</span>
        <span class="match-lbl">${window.t('card.matchWord')}</span>
        ${isEst ? `<span class="match-est">${window.t('card.estimated')}</span>` : ''}
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

  listEl.querySelectorAll('.locate-btn').forEach(btn => {
    btn.addEventListener('click', () => focusMapOnTrail(btn.dataset.id, displayList));
  });

  // Top-matches ↔ full-catalog toggle
  if(collapsed){
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'page-btn';
    more.style.cssText = 'display:block;margin:18px auto 0;';
    more.textContent = t('home.showAll', {n: displayList.length});
    more.addEventListener('click', () => { showFullList = true; currentPage = 1; renderReturningHomepage(profile); });
    listEl.appendChild(more);
  } else if(showFullList && !showingSavedOnly && displayList.length > TOP_MATCHES + 2){
    const less = document.createElement('button');
    less.type = 'button';
    less.style.cssText = 'display:block;margin:16px auto 0;background:none;border:none;color:var(--accent);font-size:12.5px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;';
    less.textContent = t('home.showTop');
    less.addEventListener('click', () => { showFullList = false; currentPage = 1; renderReturningHomepage(profile); listEl.scrollIntoView({behavior:'smooth', block:'start'}); });
    listEl.appendChild(less);
  }

  // Pagination controls
  if (!collapsed && totalPages > 1){
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:14px;margin-top:18px;';
    const mkBtn = (label, disabled, delta) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.disabled = disabled;
      b.className = 'page-btn';
      if (!disabled) b.addEventListener('click', () => {
        currentPage += delta;
        renderReturningHomepage(profile);
        listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return b;
    };
    nav.appendChild(mkBtn(t('page.prev'), currentPage === 1, -1));
    const info = document.createElement('span');
    info.className = 'page-info';
    info.textContent = t('page.of', {a: currentPage, b: totalPages});
    nav.appendChild(info);
    nav.appendChild(mkBtn(t('page.next'), currentPage === totalPages, 1));
    listEl.appendChild(nav);
  }
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
    adjustToggle.setAttribute('aria-expanded', 'true');
  });
}
if(adjustCloseBtn){
  adjustCloseBtn.addEventListener('click', () => {
    adjustPanel.hidden = true;
    adjustToggle.hidden = false;
    adjustToggle.setAttribute('aria-expanded', 'false');
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
      const base = currentProfileForAdjust ? effectiveOverrides(currentProfileForAdjust, null) : { terrain:'1', distance:'10', heatSensitive:false };
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
  if(browseNavLink){
    browseNavLink.href = user ? 'my-trails.html' : 'browse-trails.html';
    // UI: the label must match the destination — it used to say "Browse
    // our trails" while linking to My trails for logged-in users.
    const navSpan = browseNavLink.querySelector('span');
    if(navSpan) navSpan.textContent = user ? t('nav.myTrails') : t('nav.browse');
  }
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

    // Show the dog photo bubble (with uploaded photo or fallback paw)
    const dogBubble = document.getElementById('dogPhotoBubble');
    const dogBubbleImg = document.getElementById('dogBubbleImg');
    if(dogBubble){
      try {
        // Account photo wins (synced across devices); per-uid cache as
        // fallback; the old device-only key last, for pre-sync visitors.
        // Only values that are actually images are accepted — and if the
        // browser still can't decode one, fall back to the paw and purge
        // the bad copy so it never comes back.
        const isImage = v => typeof v === 'string' && v.startsWith('data:image/');
        const candidates = [
          (profile && profile.photo),
          localStorage.getItem('dolopaws-dog-photo-' + user.uid),
          localStorage.getItem('dolopaws-dog-photo'),
        ];
        const photo = candidates.find(isImage);
        candidates.forEach((v, i) => {
          if(v && !isImage(v) && i > 0){
            try { localStorage.removeItem(i === 1 ? 'dolopaws-dog-photo-' + user.uid : 'dolopaws-dog-photo'); } catch(e){}
          }
        });
        if(photo && dogBubbleImg){
          const fallback = dogBubble.querySelector('.dog-bubble-fallback');
          dogBubbleImg.onerror = () => {
            dogBubbleImg.hidden = true;
            if(fallback) fallback.style.display = '';
            try {
              localStorage.removeItem('dolopaws-dog-photo-' + user.uid);
              localStorage.removeItem('dolopaws-dog-photo');
            } catch(e){}
          };
          dogBubbleImg.src = photo;
          dogBubbleImg.hidden = false;
          if(fallback) fallback.style.display = 'none';
        }
      } catch(e){}
      dogBubble.hidden = false;
    }
  } else {
    newHome.hidden = false;
    returningHome.hidden = true;
    const dogBubble = document.getElementById('dogPhotoBubble');
    if(dogBubble) dogBubble.hidden = true;
    initGuestMap();
  }
});
/**
 * Water Sources Integration for DoloPaws
 * Adds 12,921 drinking water sources from Overpass API (OpenStreetMap)
 * 
 * Add this code to your script.js or trail.js
 */

// ============================================================
// WATER SOURCES LAYER
// ============================================================

/**
 * Initialize water sources layer on the map
 * Call this after map is loaded
 */
function initializeWaterSources(map) {
  // The map can already have this source/layer from initTrailMap().
  // Re-adding the same IDs throws and interrupts map-load setup.
  const hasSource = !!map.getSource('water-sources');
  if(!hasSource){
    // Fetch the combined GeoJSON data from all regions (Trentino, Veneto, Savoy)
    fetch('./water-sources-all-regions.geojson')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to load GeoJSON`);
        }
        return response.json();
      })
      .then(geojsonData => {
        console.log(`✅ Loaded ${geojsonData.features?.length || 0} water sources from Trentino, Veneto, and Savoy`);
        
        // Convert any Polygon features (OSM "way" fountains) to Point centroids,
        // since circle layers and clustering only render Point geometries.
        geojsonData.features = (geojsonData.features || []).map(f => {
          if (f.geometry && f.geometry.type === 'Polygon') {
            const ring = f.geometry.coordinates[0] || [];
            if (ring.length) {
              const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
              const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
              return { ...f, geometry: { type: 'Point', coordinates: [lng, lat] } };
            }
          }
          return f;
        }).filter(f => f.geometry && f.geometry.type === 'Point');

        map.addSource('water-sources', {
          type: 'geojson',
          data: geojsonData,
          cluster: true,
          clusterRadius: 50
        });
        
        console.log('✅ Water sources source added to map');
        
        // Add layers after source is ready
        addWaterSourcesLayers(map);
      })
      .catch(error => {
        console.error('❌ Error loading water sources GeoJSON:', error.message);
      });
    
    return; // Exit early since layers will be added in the fetch callback
  }
}

/**
 * Add all water sources layers to the map
 */
function addWaterSourcesLayers(map) {
  console.log('📍 Adding water sources layers...');
  const icons = window.DoloPawsIcons;
  const iconMinZoom = icons ? icons.ICON_MIN_ZOOM : 12;
  
  // Unclustered points layer
  if(!map.getLayer('water-sources-layer-lowzoom')){
    map.addLayer({
      id: 'water-sources-layer-lowzoom',
      type: 'circle',
      source: 'water-sources',
      filter: ['!', ['has', 'point_count']],
      maxzoom: iconMinZoom,
      layout: { visibility: 'none' },  // ← ADDED: Default hidden
      paint: {
        'circle-radius': 5,
        'circle-color': icons ? icons.getPoiCircleColorExpression('water') : '#5A5548',
        'circle-opacity': 0.75,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    });
  }

  if(!map.getLayer('water-sources-layer')){
    map.addLayer({
      id: 'water-sources-layer',
      type: 'symbol',
      source: 'water-sources',
      filter: ['!', ['has', 'point_count']],
      minzoom: iconMinZoom,
      layout: {
        visibility: 'none',
        'icon-image': icons ? icons.getPoiMapIconExpression('water') : '',
        'icon-size': 1,
      }
    });
  }

  // Clustered points layer
  if(!map.getLayer('water-sources-cluster')){
    map.addLayer({
      id: 'water-sources-cluster',
      type: 'circle',
      source: 'water-sources',
      filter: ['has', 'point_count'],
      layout: { visibility: 'none' },  // ← ADDED: Default hidden
      paint: {
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          5, 25,
          10, 30
        ],
        'circle-color': '#4E90A8',
        'circle-opacity': 0.7,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
  }

  // Cluster count labels
  if(!map.getLayer('water-sources-cluster-count')){
    map.addLayer({
      id: 'water-sources-cluster-count',
      type: 'symbol',
      source: 'water-sources',
      filter: ['has', 'point_count'],
      layout: {
        visibility: 'none',  // ← ADDED: Default hidden
        'text-field': ['get', 'point_count'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-color': '#fff'
      }
    });
  }

  // Interactive hover effect
  ['water-sources-layer', 'water-sources-layer-lowzoom'].forEach((layerId) => {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });

  // Click to show popup - remove old handler first to prevent duplicates
  ['water-sources-layer', 'water-sources-layer-lowzoom'].forEach((layerId) => map.off('click', layerId));
  ['water-sources-layer', 'water-sources-layer-lowzoom'].forEach((layerId) => map.on('click', layerId, (e) => {
    const feature = e.features[0];
    const props = feature.properties;
    
    // Determine water type
    let waterType = 'Water Source';
    if (props.amenity === 'drinking_water') waterType = '🚰 Drinking Fountain';
    else if (props.amenity === 'fountain') waterType = '⛲ Fountain';
    else if (props.natural === 'spring') waterType = '💧 Natural Spring';
    else if (props.man_made === 'water_tap') waterType = '🚪 Water Tap';
    else if (props.amenity === 'water_point') waterType = '💦 Water Point';

    // Build popup content
    let content = `<b>${waterType}</b>`;
    
    const pointLabel = props.name || props.label;
    const pointDistance = props.km !== undefined ? `Km ${props.km}` : '';
    if (pointLabel && pointDistance) {
      content += `<br>${pointLabel} <small>(${pointDistance})</small>`;
    } else if (pointLabel) {
      content += `<br>${pointLabel}`;
    } else if (pointDistance) {
      content += `<br><small>${pointDistance}</small>`;
    }
    
    if (props.check_date) {
      content += `<br><small>✓ Last verified: ${props.check_date}</small>`;
    }
    
    if (props.seasonal === 'yes') {
      content += `<br><small>⚠️ Seasonal water source</small>`;
    }

    new maplibregl.Popup({ offset: 25 })
      .setLngLat(e.lngLat)
      .setHTML(content)
      .addTo(map);
  }));

  // Click cluster to zoom in - remove old handler first to prevent duplicates
  map.off('click', 'water-sources-cluster');
  map.on('click', 'water-sources-cluster', (e) => {
    const features = map.querySourceFeatures('water-sources', {
      filter: ['!=', ['get', 'point_count'], null]
    });

    const clusterId = e.features[0].properties.cluster_id;
    const source = map.getSource('water-sources');

    source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({
        center: e.features[0].geometry.coordinates,
        zoom: zoom
      });
    }).catch(() => {});
  });
}

/**
 * Toggle water sources visibility
 */
function toggleWaterSources(map, show) {
  const layers = ['water-sources-layer-lowzoom', 'water-sources-layer', 'water-sources-cluster', 'water-sources-cluster-count'];
  layers.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', show ? 'visible' : 'none');
    }
  });
}

/**
 * Filter water sources by type
 */
function filterWaterSources(map, type) {
  let filter;
  
  switch(type) {
    case 'fountains':
      filter = ['==', ['get', 'amenity'], 'drinking_water'];
      break;
    case 'springs':
      filter = ['==', ['get', 'natural'], 'spring'];
      break;
    case 'taps':
      filter = ['==', ['get', 'man_made'], 'water_tap'];
      break;
    case 'all':
    default:
      filter = ['!', ['has', 'point_count']];
      break;
  }
  
  map.setFilter('water-sources-layer', filter);
  if(map.getLayer('water-sources-layer-lowzoom')) map.setFilter('water-sources-layer-lowzoom', filter);
}

// ============================================================
// USAGE - Add to your map initialization
// ============================================================

// After map loads:
// initializeWaterSources(trailMapInstance);

// To toggle visibility:
// toggleWaterSources(trailMapInstance, true);

// To filter by type:
// filterWaterSources(trailMapInstance, 'fountains');

/**
 * ============================================================
 * Huts & Bars Integration for DoloPaws
 * Adds mountain huts, bars, cafés and pubs from OpenStreetMap
 * (Trentino, Veneto, Savoy) — same pattern as water sources.
 * ============================================================
 */
function initializeHutsBars(map) {
  if(map.getSource('mountain-huts') || map.getSource('bars-cafes')) return;

  fetch('./huts-bars-all-regions.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load huts/bars GeoJSON`);
      }
      return response.json();
    })
    .then(geojsonData => {
      // Safety net: convert any Polygon/MultiPolygon features to Point centroids
      const features = (geojsonData.features || []).map(f => {
        const g = f.geometry;
        if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
          const ring = g.type === 'Polygon' ? (g.coordinates[0] || []) : ((g.coordinates[0] || [])[0] || []);
          if (ring.length) {
            const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
            const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
            return { ...f, geometry: { type: 'Point', coordinates: [lng, lat] } };
          }
        }
        return f;
      }).filter(f => f.geometry && f.geometry.type === 'Point');

      // Split into two datasets so each gets its OWN clustering:
      // mixing them in one clustered source would blend huts and bars
      // inside the same cluster bubbles.
      const isHut = p => p && (p.tourism === 'alpine_hut' || p.tourism === 'wilderness_hut' || p.amenity === 'shelter');
      const huts = features.filter(f => isHut(f.properties));
      const bars = features.filter(f => !isHut(f.properties));

      console.log(`✅ Loaded ${huts.length} mountain huts and ${bars.length} bars/cafés (Trentino, Veneto, Savoy)`);

      // Register with basemap-poi-click.js so clicks on the base map's own
      // icons can be enriched with these richer OSM tags (Tier 2).
      if (typeof registerPoiFeatures === 'function') registerPoiFeatures([...huts, ...bars]);

      // Keep the split sets accessible for the dog-friendly filter toggle.
      window._dolopawsHuts = huts;
      window._dolopawsBars = bars;

      map.addSource('mountain-huts', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: huts },
        cluster: true,
        clusterRadius: 50
      });

      map.addSource('bars-cafes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: bars },
        cluster: true,
        clusterRadius: 65  // slightly larger: consolidates the dense town blobs
      });

      addHutsBarsLayers(map);
    })
    .catch(error => {
      console.error('❌ Error loading huts/bars GeoJSON:', error.message);
    });
}

// Shared helper: adds the full POI layer set for one clustered source.
// `iconGroup` must be one of the shared icon registry groups ('water',
// 'huts', 'food') so the high-zoom symbol layer can reuse the same
// category SVGs and color mapping as the rest of the site.
function addPoiLayerSet(map, sourceId, prefix, circleColor, clusterColor, iconGroup) {
  const icons = window.DoloPawsIcons;
  const iconMinZoom = icons ? icons.ICON_MIN_ZOOM : 12;
  if(!map.getLayer(prefix + '-layer-lowzoom')){
    map.addLayer({
      id: prefix + '-layer-lowzoom',
      type: 'circle',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      maxzoom: iconMinZoom,
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 5,
        'circle-color': circleColor,
        'circle-opacity': 0.8,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    });
  }

  if(!map.getLayer(prefix + '-layer')){
    map.addLayer({
      id: prefix + '-layer',
      type: 'symbol',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      minzoom: iconMinZoom,
      layout: {
        visibility: 'none',
        'icon-image': icons ? icons.getPoiMapIconExpression(iconGroup) : '',
        'icon-size': 1,
      },
    });
  }

  if(!map.getLayer(prefix + '-cluster')){
    map.addLayer({
      id: prefix + '-cluster',
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 20, 5, 25, 10, 30],
        'circle-color': clusterColor,
        'circle-opacity': 0.7,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
  }

  if(!map.getLayer(prefix + '-cluster-count')){
    map.addLayer({
      id: prefix + '-cluster-count',
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        visibility: 'none',
        'text-field': ['get', 'point_count'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: { 'text-color': '#fff' }
    });
  }

  // Hover cursor
  [prefix + '-layer', prefix + '-layer-lowzoom'].forEach((layerId) => {
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
  });

  // Popup on click
  [prefix + '-layer', prefix + '-layer-lowzoom'].forEach((layerId) => map.off('click', layerId));
  [prefix + '-layer', prefix + '-layer-lowzoom'].forEach((layerId) => map.on('click', layerId, (e) => {
    const feature = e.features[0];
    const props = feature.properties;

    let placeType = 'Place';
    if (props.tourism === 'alpine_hut') placeType = '🏔️ Mountain Hut (Rifugio)';
    else if (props.tourism === 'wilderness_hut') placeType = '🛖 Wilderness Hut / Bivouac';
    else if (props.amenity === 'shelter') placeType = '⛺ Shelter';
    else if (props.amenity === 'bar') placeType = '🍺 Bar';
    else if (props.amenity === 'pub') placeType = '🍻 Pub';
    else if (props.amenity === 'cafe') placeType = '☕ Café';
    else if (props.amenity === 'restaurant') placeType = '🍽️ Restaurant';
    else if (props.amenity === 'fast_food') placeType = '🍔 Fast food';
    else if (props.amenity === 'ice_cream') placeType = '🍦 Ice cream';
    else if (props.amenity === 'biergarten') placeType = '🍺 Beer garden';

    let content = `<b>${placeType}</b>`;
    if (props.name) content += `<br><b>${props.name}</b>`;
    if (props.ele) content += `<br>⛰️ ${props.ele} m elevation`;
    if (props.cuisine) content += `<br>🍴 ${String(props.cuisine).split(';').join(', ').replace(/_/g, ' ')}`;
    if (props.opening_hours) content += `<br>🕐 ${props.opening_hours}`;
    if (props.phone || props['contact:phone']) content += `<br>📞 ${props.phone || props['contact:phone']}`;
    if (props.website || props['contact:website']) {
      const url = props.website || props['contact:website'];
      content += `<br>🔗 <a href="${url}" target="_blank" rel="noopener">Website</a>`;
    }
    if (props.dog === 'yes') content += `<br>🐕 Dogs welcome`;
    else if (props.dog === 'leashed') content += `<br>🦮 Dogs on leash`;
    else if (props.dog === 'no') content += `<br>🚫 No dogs`;
    if (props.outdoor_seating && props.outdoor_seating !== 'no') content += `<br>🪑 Outdoor seating`;
    // No dog tag yet? Let users add one — it lands in OSM and flows back
    // to DoloPaws on the next monthly POI refresh.
    if (!props.dog && props['@id']) {
      const idParts = String(props['@id']).split('/');
      if (idParts.length === 2) {
        content += `<br><span style="font-size:11px;color:#8b8578;">Know if dogs are welcome here? <a href="https://www.openstreetmap.org/edit?${idParts[0]}=${idParts[1]}" target="_blank" rel="noopener">Add it to OpenStreetMap ↗</a></span>`;
      }
    }

    new maplibregl.Popup({ offset: 10 })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(content)
      .addTo(map);
  }));

  // Zoom into cluster on click
  map.off('click', prefix + '-cluster');
  map.on('click', prefix + '-cluster', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: [prefix + '-cluster'] });
    if (!features.length) return;
    const clusterId = features[0].properties.cluster_id;
    const source = map.getSource(sourceId);
    source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    }).catch(() => {});
  });
}

function addHutsBarsLayers(map) {
  console.log('📍 Adding mountain huts + bars/cafés layers...');

  // Mountain huts: color by hut type, brown clusters
  addPoiLayerSet(
    map,
    'mountain-huts',
    'mountain-huts',
    window.DoloPawsIcons ? window.DoloPawsIcons.getPoiCircleColorExpression('huts') : '#5A5548',
    '#8A5A16',
    'huts'
  );

  // Bars & cafés: color by amenity, red clusters
  addPoiLayerSet(
    map,
    'bars-cafes',
    'bars-cafes',
    window.DoloPawsIcons ? window.DoloPawsIcons.getPoiCircleColorExpression('food') : '#5A5548',
    '#9C3A25',
    'food'
  );

  console.log('✅ Huts + bars/cafés layers added');
}

/**
 * Toggle helpers
 */
function toggleMountainHuts(map, show) {
  ['mountain-huts-layer-lowzoom', 'mountain-huts-layer', 'mountain-huts-cluster', 'mountain-huts-cluster-count'].forEach(layerId => {
    if(map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', show ? 'visible' : 'none');
  });
}

function toggleBarsCafes(map, show) {
  ['bars-cafes-layer-lowzoom', 'bars-cafes-layer', 'bars-cafes-cluster', 'bars-cafes-cluster-count'].forEach(layerId => {
    if(map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', show ? 'visible' : 'none');
  });
}

// ============================================================
// LEGEND ENTRY
// ============================================================

/*
Add this to your legend:

<span>💧 Drinking water (12,921 sources)</span>

Optional color legend:
<span><span style="width:12px;height:12px;background:#4E90A8;display:inline-block;border-radius:50%;margin-right:4px;"></span>Fountain</span>
<span><span style="width:12px;height:12px;background:#228B22;display:inline-block;border-radius:50%;margin-right:4px;"></span>Spring</span>
<span><span style="width:12px;height:12px;background:#0077BE;display:inline-block;border-radius:50%;margin-right:4px;"></span>Water tap</span>
*/
