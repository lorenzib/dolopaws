/**
 * detail-pois.js — real nearby POIs on the trail detail map.
 *
 * The homepage map loads the full OSM POI datasets (huts, bars & cafés,
 * drinking water); the trail detail map used to show only the few
 * hand-curated markers stored on the trail itself — so places visible on
 * the homepage "disappeared" when opening a trail. This file loads the
 * same two GeoJSON files, filters them to the trail's surroundings
 * (~2 km beyond the route's bounding box), and shows them by default —
 * on a single-trail page, "what's nearby" shouldn't hide behind a toggle.
 *
 * Also registers the filtered features with basemap-poi-click.js, so
 * clicking the base map's own icons gets the enriched popup here too.
 *
 * Usage: initDetailPois(map, trail) inside trail.js's map 'load' handler.
 * Include in trail.html BEFORE trail.js.
 */

function initDetailPois(map, trail){
  if (!trail || typeof trail.lat !== 'number' || typeof trail.lng !== 'number') return;

  // Bounding box of the route (or trailhead) plus ~2 km padding.
  let minLat = trail.lat, maxLat = trail.lat, minLng = trail.lng, maxLng = trail.lng;
  (trail.path || []).forEach(p => {
    if (p[0] < minLat) minLat = p[0];
    if (p[0] > maxLat) maxLat = p[0];
    if (p[1] < minLng) minLng = p[1];
    if (p[1] > maxLng) maxLng = p[1];
  });
  const PAD = 0.02;
  minLat -= PAD; maxLat += PAD; minLng -= PAD; maxLng += PAD;

  const inBox = f => {
    const g = f.geometry;
    if (!g || g.type !== 'Point') return false;
    const [lng, lat] = g.coordinates;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  };

  const esc = (typeof trEsc === 'function') ? trEsc
    : s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function poiPopupHtml(props){
    let placeType = '📍';
    if (props.tourism === 'alpine_hut') placeType = '🏔️ ' + (window.t ? window.t('legend.hut') : 'Mountain hut');
    else if (props.tourism === 'wilderness_hut') placeType = '🛖';
    else if (props.amenity === 'shelter') placeType = '⛺';
    else if (props.amenity === 'bar') placeType = '🍺 Bar';
    else if (props.amenity === 'pub') placeType = '🍻 Pub';
    else if (props.amenity === 'cafe') placeType = '☕ Café';
    else if (props.amenity === 'restaurant') placeType = '🍽️';
    else if (props.amenity === 'fast_food') placeType = '🍔';
    let html = `<b>${placeType}</b>`;
    if (props.name) html += `<br><b>${esc(props.name)}</b>`;
    if (props.ele) html += `<br>⛰️ ${esc(props.ele)} m`;
    if (props.opening_hours) html += `<br>🕐 ${esc(props.opening_hours)}`;
    const phone = props.phone || props['contact:phone'];
    if (phone) html += `<br>📞 ${esc(phone)}`;
    const site = props.website || props['contact:website'];
    if (site && /^https?:\/\//.test(site)) html += `<br>🔗 <a href="${esc(site)}" target="_blank" rel="noopener">Website</a>`;
    if (props.dog === 'yes') html += `<br>🐕 Dogs welcome`;
    else if (props.dog === 'leashed') html += `<br>🦮 Dogs on leash`;
    else if (props.dog === 'no') html += `<br>🚫 No dogs`;
    if (props.outdoor_seating && props.outdoor_seating !== 'no') html += `<br>🪑 Outdoor seating`;
    return html;
  }

  function addDotLayer(sourceId, features, colorExpr){
    if (!features.length || map.getSource(sourceId)) return;
    map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } });
    map.addLayer({
      id: sourceId + '-layer',
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 5.5,
        'circle-color': colorExpr,
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
      },
    });
    map.on('mouseenter', sourceId + '-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', sourceId + '-layer', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', sourceId + '-layer', (e) => {
      const f = e.features[0];
      new maplibregl.Popup({ offset: 10, maxWidth: '260px' })
        .setLngLat(f.geometry.coordinates)
        .setHTML(poiPopupHtml(f.properties))
        .addTo(map);
    });
  }

  // Huts + food & drink (same file the homepage uses; browser-cached)
  fetch('./huts-bars-all-regions.geojson')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      const near = (data.features || []).filter(inBox);
      if (!near.length) return;
      const isHut = p => p && (p.tourism === 'alpine_hut' || p.tourism === 'wilderness_hut' || p.amenity === 'shelter');
      const huts = near.filter(f => isHut(f.properties));
      const bars = near.filter(f => !isHut(f.properties));
      addDotLayer('detail-huts', huts, [
        'case',
        ['==', ['get', 'tourism'], 'alpine_hut'], '#8A5A16',
        ['==', ['get', 'tourism'], 'wilderness_hut'], '#B0741C',
        '#5A5548',
      ]);
      addDotLayer('detail-bars', bars, [
        'case',
        ['==', ['get', 'amenity'], 'bar'], '#9C3A25',
        ['==', ['get', 'amenity'], 'pub'], '#7a2818',
        ['==', ['get', 'amenity'], 'cafe'], '#D6A038',
        ['==', ['get', 'amenity'], 'restaurant'], '#C4652F',
        '#5A5548',
      ]);
      // Feed the base-map click enrichment on this page too.
      if (typeof registerPoiFeatures === 'function') registerPoiFeatures(near);
    })
    .catch(() => { /* nearby POIs are a bonus — never break the page */ });

  // Drinking water
  fetch('./water-sources-all-regions.geojson')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      const near = (data.features || []).filter(inBox);
      addDotLayer('detail-water', near, [
        'case',
        ['==', ['get', 'natural'], 'spring'], '#228B22',
        '#4E90A8',
      ]);
    })
    .catch(() => {});
}
