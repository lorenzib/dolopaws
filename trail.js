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

function makeIconEl(emoji, bgColor){
  const el = document.createElement('div');
  el.style.cssText = `width:28px;height:28px;border-radius:50%;background:${bgColor};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:14px;`;
  el.textContent = emoji;
  return el;
}

function addTerrainToggle(map, containerId, exaggeration, defaultPitch){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.style.position = container.style.position || 'relative';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'View flat — easier to read names';
  btn.style.cssText = 'position:absolute;bottom:10px;left:10px;z-index:5;padding:8px 16px;border-radius:14px;background:var(--ink);color:#fff;border:none;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.25);';
  container.appendChild(btn);

  let is3D = true;
  btn.addEventListener('click', () => {
    if(is3D){
      map.setTerrain(null);
      map.easeTo({ pitch: 0, duration: 500 });
      btn.textContent = 'View 3D terrain';
    } else {
      map.setTerrain({ source: 'terrain-dem', exaggeration });
      map.easeTo({ pitch: defaultPitch || 0, duration: 500 });
      btn.textContent = 'View flat — easier to read names';
    }
    is3D = !is3D;
  });
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
    paint: { 'hillshade-exaggeration': 0.35 },
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
  document.getElementById('trailDetailContent').innerHTML = renderTrailDetailContent(t);

  // Map
  if(typeof maplibregl !== 'undefined' && typeof t.lat === 'number' && typeof t.lng === 'number'){
    const map = new maplibregl.Map({
      container: 'trailDetailMap',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [t.lng, t.lat],
      zoom: 14,
      pitch: 45, // a bit of tilt so the terrain elevation actually reads
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      addTerrainToMap(map, 1.5);
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
        paint: { 'raster-opacity': 0.6 },
      }, firstLabelLayer ? firstLabelLayer.id : undefined);

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
          paint: { 'line-color': safetyColor(t.safetyLevel), 'line-width': 4 },
        });
        const bounds = new maplibregl.LngLatBounds();
        t.path.forEach(([lat, lng]) => bounds.extend([lng, lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 17, pitch: 45 });

        // Rifugi and water-source icons — positioned using the REAL GPS
        // path, not guessed coordinates. Km markers were recorded against
        // the trail's stated distance, so we convert to a fraction of that
        // distance, then find the matching point on the real path.
        (t.rifugi || []).forEach(r => {
          let lat, lng;
          if(typeof r.lat === 'number' && typeof r.lng === 'number'){
            lat = r.lat; lng = r.lng; // verified real coordinates
          } else {
            const fraction = t.distance > 0 ? r.km / t.distance : 0;
            [lat, lng] = pointAtFraction(t.path, fraction); // approximate fallback
          }
          new maplibregl.Marker({ element: makeIconEl('🏠', '#2E4034') })
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
          new maplibregl.Marker({ element: makeIconEl('💧', '#4E90A8') })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(`<b>${w.label}</b><br>Km ${w.km}`))
            .addTo(map);
        });
      } else {
        new maplibregl.Marker({ color: '#D6A038' }).setLngLat([t.lng, t.lat]).addTo(map);
        const legend = document.getElementById('mapLegend');
        if(legend){
          legend.insertAdjacentHTML('beforeend',
            '<span style="font-style:italic;">— Rifugi/water map icons need this trail\'s real GPS route, not yet added. See the list below instead.</span>');
        }
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
