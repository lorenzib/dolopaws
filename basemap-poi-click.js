/**
 * basemap-poi-click.js
 * Makes the base map's own POI icons (drawn by the OpenFreeMap "liberty"
 * style) clickable, Google Maps-style. DoloPaws' own layers already have
 * click handlers — this handler detects those and stays out of their way.
 *
 * Popup tiers:
 *   1. Generic: name + human-readable type (from the vector tile's
 *      class/subclass properties), plus elevation for peaks.
 *   2. Enriched: if the same place exists in DoloPaws' own POI data
 *      (huts-bars-all-regions.geojson, registered via registerPoiFeatures),
 *      the popup upgrades to opening hours, phone, website, dogs-welcome.
 *   3. Escape hatch: every popup ends with a "more info" OpenStreetMap
 *      link, so no click ever dead-ends.
 *
 * Usage: makeBasemapPoisClickable(map) inside each map's 'load' handler.
 * Include this file in index.html and trail.html BEFORE script.js / trail.js.
 */

// Every DoloPaws layer that already has its own click handler.
// Layers that don't exist on a given map are filtered out at click time.
const DOLOPAWS_INTERACTIVE_LAYERS = [
  'water-sources-layer', 'water-sources-cluster',
  'mountain-huts-layer', 'mountain-huts-cluster',
  'bars-cafes-layer', 'bars-cafes-cluster',
  'guest-gondolas-line', 'trailmap-gondolas-line',
  'dog-routes-line',
];

// Base-style source layers whose features should be clickable. 'place'
// (town/village name labels) is deliberately excluded — popping up on every
// pan-click near a label would make the map feel broken, not richer.
const POI_SOURCE_LAYERS = ['poi', 'mountain_peak', 'poi_transit'];

// subclass (raw OSM value) → label. Falls back to prettified text for
// anything not listed, so unknown types still get a sensible popup.
const POI_LABELS = {
  restaurant: '🍽️ Restaurant', fast_food: '🍔 Fast food', cafe: '☕ Café',
  bar: '🍺 Bar', pub: '🍻 Pub', biergarten: '🍺 Beer garden',
  ice_cream: '🍦 Ice cream', bakery: '🥐 Bakery',
  alpine_hut: '🏔️ Mountain hut (rifugio)', wilderness_hut: '🛖 Bivouac',
  shelter: '⛺ Shelter', viewpoint: '👀 Viewpoint', attraction: '⭐ Attraction',
  hotel: '🏨 Hotel', guest_house: '🏡 Guest house', camp_site: '🏕️ Campsite',
  parking: '🅿️ Parking', bus_stop: '🚌 Bus stop', bus_station: '🚌 Bus station',
  station: '🚉 Station', drinking_water: '🚰 Drinking water',
  spring: '💧 Spring', peak: '⛰️ Peak', supermarket: '🛒 Supermarket',
  pharmacy: '💊 Pharmacy', hospital: '🏥 Hospital', bank: '🏦 Bank',
  museum: '🏛️ Museum', castle: '🏰 Castle', church: '⛪ Church',
  chapel: '⛪ Chapel', information: 'ℹ️ Information',
};

function poiLabel(props){
  const key = props.subclass || props.class || '';
  if (POI_LABELS[key]) return POI_LABELS[key];
  if (!key) return '📍 Place';
  const pretty = String(key).replace(/_/g, ' ');
  return '📍 ' + pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

// OSM data can contain anything — never inject it into popups as raw HTML.
function escHtml(s){
  return String(s).replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function makeBasemapPoisClickable(map){
  map.on('click', (e) => {
    // 1) If the click landed on a DoloPaws layer, its own handler owns it —
    //    without this bail-out, users would get two stacked popups.
    const ownLayers = DOLOPAWS_INTERACTIVE_LAYERS.filter(id => map.getLayer(id));
    if (ownLayers.length &&
        map.queryRenderedFeatures(e.point, { layers: ownLayers }).length) return;

    // 2) Query with a small tolerance box — bare-point hits miss small
    //    icons about half the time, especially on mobile.
    const box = [[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]];
    const hits = map.queryRenderedFeatures(box);

    // 3) Keep only named symbol features from POI-ish source layers.
    const poi = hits.find(f =>
      f.layer && f.layer.type === 'symbol' &&
      POI_SOURCE_LAYERS.includes(f.sourceLayer) &&
      (f.properties.name || f.properties['name:en'] || f.properties['name:it'])
    );
    if (!poi) return;

    const p = poi.properties;
    const name = p.name || p['name:en'] || p['name:it'];
    const coords = poi.geometry && poi.geometry.type === 'Point'
      ? poi.geometry.coordinates : [e.lngLat.lng, e.lngLat.lat];
    const lng = coords[0], lat = coords[1];

    let html = `<b>${escHtml(name)}</b><br>${poiLabel(p)}`;
    if (p.ele) html += `<br>⛰️ ${escHtml(p.ele)} m`;

    // Tier 2: enrich from DoloPaws' own loaded POI data.
    const match = findOwnPoiMatch(name, lng, lat);
    if (match) {
      if (match.opening_hours) html += `<br>🕐 ${escHtml(match.opening_hours)}`;
      const phone = match.phone || match['contact:phone'];
      if (phone) html += `<br>📞 ${escHtml(phone)}`;
      const site = match.website || match['contact:website'];
      if (site && /^https?:\/\//.test(site))
        html += `<br>🔗 <a href="${escHtml(site)}" target="_blank" rel="noopener">Website</a>`;
      if (match.dog === 'yes') html += `<br>🐕 Dogs welcome`;
    }

    // Tier 3: never dead-end — link out for anything we can't enrich.
    html += `<div style="margin-top:6px;font-size:11px;color:#8b8578;">`
          + `from OpenStreetMap · <a href="https://www.openstreetmap.org/search`
          + `?query=${encodeURIComponent(name)}#map=18/${lat.toFixed(5)}/${lng.toFixed(5)}"`
          + ` target="_blank" rel="noopener">more info ↗</a></div>`;

    new maplibregl.Popup({ offset: 10, closeOnClick: true, maxWidth: '260px' })
      .setLngLat(e.lngLat).setHTML(html).addTo(map);
  });

  // Pointer cursor over base-map POIs — throttled via requestAnimationFrame
  // so panning stays smooth (queryRenderedFeatures on every raw mousemove
  // event stutters on low-end phones).
  let rafPending = false;
  map.on('mousemove', (e) => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const hits = map.queryRenderedFeatures(
        [[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]]);
      const overPoi = hits.some(f => f.layer && f.layer.type === 'symbol' &&
        POI_SOURCE_LAYERS.includes(f.sourceLayer) && f.properties.name);
      // Only touch the cursor when a DoloPaws layer hasn't already set it.
      if (overPoi) {
        map.getCanvas().style.cursor = 'pointer';
      } else if (map.getCanvas().style.cursor === 'pointer' &&
                 !hits.some(f => f.layer && DOLOPAWS_INTERACTIVE_LAYERS.includes(f.layer.id))) {
        map.getCanvas().style.cursor = '';
      }
    });
  });
}

// ---- Tier 2 support: index of DoloPaws' own POI data ----------------------
// initializeHutsBars() (and optionally initializeWaterSources()) registers
// its loaded features here so base-map clicks can be enriched with the
// richer OSM tags DoloPaws already ships (hours, phone, website, dog=yes).
window._dolopawsPoiFeatures = window._dolopawsPoiFeatures || [];

function registerPoiFeatures(features){
  if (Array.isArray(features)) window._dolopawsPoiFeatures.push(...features);
}

function findOwnPoiMatch(name, lng, lat){
  const nameLc = String(name).toLowerCase();
  let best = null, bestDist = Infinity;
  for (const f of window._dolopawsPoiFeatures){
    if (!f.geometry || f.geometry.type !== 'Point') continue;
    const flng = f.geometry.coordinates[0], flat = f.geometry.coordinates[1];
    const dist = Math.hypot((flat - lat) * 111000,
                            (flng - lng) * 111000 * Math.cos(lat * Math.PI / 180));
    if (dist > 50) continue;                    // must be within ~50 m
    const fname = (f.properties && f.properties.name || '').toLowerCase();
    const nameOk = fname && (fname.includes(nameLc) || nameLc.includes(fname));
    if ((nameOk || dist < 15) && dist < bestDist){ best = f; bestDist = dist; }
  }
  return best ? best.properties : null;
}
