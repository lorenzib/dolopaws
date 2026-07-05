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

function addTerrainToMap(map, exaggeration){
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 15,
  });
  map.setTerrain({ source: 'terrain-dem', exaggeration: exaggeration || 1.4 });
  map.addLayer({
    id: 'hillshade-layer',
    type: 'hillshade',
    source: 'terrain-dem',
    paint: { 'hillshade-exaggeration': 0.5 },
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
  document.getElementById('trailDesc').textContent = t.desc || '';
  document.getElementById('trailTips').textContent = t.tips ? `Tip: ${t.tips}` : '';
  document.getElementById('trailDetailContent').innerHTML = renderTrailDetailContent(t);

  // Map
  if(typeof maplibregl !== 'undefined' && typeof t.lat === 'number' && typeof t.lng === 'number'){
    const map = new maplibregl.Map({
      container: 'trailDetailMap',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [t.lng, t.lat],
      zoom: 13,
      pitch: 45, // a bit of tilt so the terrain elevation actually reads
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      addTerrainToMap(map, 1.5);

      if(Array.isArray(t.path) && t.path.length > 1){
        map.addSource('single-trail-path', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: t.path.map(([lat, lng]) => [lng, lat]) },
          },
        });
        map.addLayer({
          id: 'single-trail-path-line',
          type: 'line',
          source: 'single-trail-path',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#D6A038', 'line-width': 4 },
        });
        const bounds = new maplibregl.LngLatBounds();
        t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, pitch: 45 });
      } else {
        new maplibregl.Marker({ color: '#D6A038' }).setLngLat([t.lng, t.lat]).addTo(map);
      }
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
