(function () {
  'use strict';

  const DATA_URL = './data/dolomites-trails.json';
  const MAX_LIST_ITEMS = 120;

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setStatus(message) {
    const el = document.getElementById('osmTrailsStatus');
    if (el) el.textContent = message;
  }

  function renderList(trails) {
    const list = document.getElementById('osmTrailsList');
    if (!list) return;

    if (!Array.isArray(trails) || trails.length === 0) {
      list.innerHTML = '<p class="osm-empty">No hiking trails available yet. Run <code>npm run fetch:dolomites-trails</code> to generate data.</p>';
      return;
    }

    list.innerHTML = trails.slice(0, MAX_LIST_ITEMS).map((trail) => {
      const title = escapeHtml(trail.name || trail.ref || trail.id);
      const ref = trail.ref ? ` · ${escapeHtml(trail.ref)}` : '';
      const difficulty = trail.difficulty ? ` · ${escapeHtml(trail.difficulty)}` : '';
      return `<li><strong>${title}</strong>${ref}${difficulty}</li>`;
    }).join('');
  }

  function renderMap(trails) {
    const mapEl = document.getElementById('osmTrailsMap');
    if (!mapEl || typeof maplibregl === 'undefined') return;
    if (!Array.isArray(trails) || trails.length === 0) return;

    const map = new maplibregl.Map({
      container: 'osmTrailsMap',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [12.1, 46.4],
      zoom: 7.7
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', function () {
      const features = trails
        .filter((trail) => Array.isArray(trail.geometry) && trail.geometry.length > 1)
        .map((trail) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: trail.geometry },
          properties: { title: trail.name || trail.ref || trail.id }
        }));

      if (features.length === 0) return;
      map.addSource('osm-dolomites-trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features }
      });
      map.addLayer({
        id: 'osm-dolomites-trails-line',
        type: 'line',
        source: 'osm-dolomites-trails',
        paint: {
          'line-color': '#2C5C34',
          'line-width': 2
        }
      });
    });
  }

  async function init() {
    try {
      setStatus('Loading OpenStreetMap trail data…');
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const trails = Array.isArray(payload.trails) ? payload.trails : [];
      renderList(trails);
      renderMap(trails);
      setStatus(`${trails.length} OSM trails loaded`);
    } catch (error) {
      renderList([]);
      setStatus('OSM trails are currently unavailable.');
      const mapEl = document.getElementById('osmTrailsMap');
      if (mapEl) mapEl.innerHTML = '<p class="osm-empty">Map unavailable. Please regenerate trail data.</p>';
      console.warn('[dolomites-trails]', error.message);
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})();
