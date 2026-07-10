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
  const icons = window.DoloPawsIcons;
  const iconMinZoom = icons ? icons.ICON_MIN_ZOOM : 12;

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

  function addPoiLayer(sourceId, features, group){
    if (!features.length || map.getSource(sourceId)) return;
    const clusterColor = icons ? icons.getPoiClusterColor(group) : '#5A5548';
    const circleColor = icons ? icons.getPoiCircleColorExpression(group) : '#5A5548';
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
      cluster: true,
      clusterRadius: group === 'food' ? 65 : 50,
    });
    map.addLayer({
      id: sourceId + '-layer-lowzoom',
      type: 'circle',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      maxzoom: iconMinZoom,
      paint: {
        'circle-radius': 5.5,
        'circle-color': circleColor,
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: sourceId + '-layer',
      type: 'symbol',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      minzoom: iconMinZoom,
      layout: {
        'icon-image': icons ? icons.getPoiMapIconExpression(group) : '',
        'icon-size': 1,
      },
    });
    map.addLayer({
      id: sourceId + '-cluster',
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 20, 5, 25, 10, 30],
        'circle-color': clusterColor,
        'circle-opacity': 0.72,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
    map.addLayer({
      id: sourceId + '-cluster-count',
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
      paint: { 'text-color': '#fff' },
    });
    [sourceId + '-layer', sourceId + '-layer-lowzoom'].forEach((layerId) => {
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    });
    [sourceId + '-layer', sourceId + '-layer-lowzoom'].forEach((layerId) => map.on('click', layerId, (e) => {
      const f = e.features[0];
      new maplibregl.Popup({ offset: 10, maxWidth: '260px' })
        .setLngLat(f.geometry.coordinates)
        .setHTML(poiPopupHtml(f.properties))
        .addTo(map);
    }));
    map.on('click', sourceId + '-cluster', (e) => {
      const clusterId = e.features[0].properties.cluster_id;
      const source = map.getSource(sourceId);
      source.getClusterExpansionZoom(clusterId).then((zoom) => {
        map.easeTo({ center: e.features[0].geometry.coordinates, zoom });
      }).catch(() => {});
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
      addPoiLayer('detail-huts', huts, 'huts');
      addPoiLayer('detail-bars', bars, 'food');
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
      addPoiLayer('detail-water', near, 'water');
    })
    .catch(() => {});
}
