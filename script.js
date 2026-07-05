
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
      <div class="meta">${t.area} · ${t.distance} km</div>
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

let showingSavedOnly = false;
let activeArea = 'all';
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
    trailMapInstance.addSource('trail-paths', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    trailMapInstance.addLayer({
      id: 'trail-paths-line',
      type: 'line',
      source: 'trail-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#2E4034', 'line-width': 3 },
    });
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

function renderTrailDetailContent(t){
  const rifugi = Array.isArray(t.rifugi) ? t.rifugi : [];
  const water = Array.isArray(t.waterSources) ? t.waterSources : [];

  const rifugiHtml = rifugi.length > 0
    ? `<ul style="margin:0 0 12px;padding-left:18px;">${rifugi.map(r => `<li>Km ${r.km} — ${r.name}</li>`).join('')}</ul>`
    : `<p style="margin:0 0 12px;">No rifugi along this route.</p>`;

  const waterHtml = water.length > 0
    ? `<ul style="margin:0 0 12px;padding-left:18px;">${water.map(w => `<li>Km ${w.km} — ${w.label}</li>`).join('')}</ul>`
    : `<p style="margin:0 0 12px;">No drinking water sources recorded along this route — bring enough for your dog.</p>`;

  return `
    <div style="margin-bottom:12px;">
      <div style="font-weight:700;color:var(--ink);margin-bottom:4px;">🏔️ Rifugi on the way</div>
      ${rifugiHtml}
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-weight:700;color:var(--ink);margin-bottom:4px;">💧 Drinking water</div>
      ${waterHtml}
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-weight:700;color:var(--ink);margin-bottom:4px;">🪑 Resting stations</div>
      <p style="margin:0;font-style:italic;">Not tracked separately yet — rifugi above often double as rest stops.</p>
    </div>
    <div>
      <div style="font-weight:700;color:var(--ink);margin-bottom:4px;">📍 Other landmarks</div>
      <p style="margin:0;font-style:italic;">${t.desc ? t.desc : 'Not recorded yet for this trail.'}</p>
    </div>
  `;
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
    pendingPathList = list; // apply once the style finishes loading
    return;
  }
  const features = list
    .filter(t => Array.isArray(t.path) && t.path.length > 1)
    .map(t => ({
      type: 'Feature',
      properties: { id: t.id, name: t.name },
      // GeoJSON is [lng, lat] — our stored path is [lat, lng], so flip each point.
      geometry: { type: 'LineString', coordinates: t.path.map(([lat, lng]) => [lng, lat]) },
    }));
  trailMapInstance.getSource('trail-paths').setData({ type: 'FeatureCollection', features });
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
    const popup = new maplibregl.Popup({ offset: 20 }).setHTML(`<b>${t.name}</b><br>${t.score}% match`);
    const marker = new maplibregl.Marker({ color: '#D6A038' })
      .setLngLat([t.lng, t.lat])
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
    : profile && profile.name ? `Ranked for ${name}'s saved profile.` : 'Add your dog\u2019s details to personalize this list.';
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
        <div class="name" style="margin-top:6px;">${t.name}</div>
        <div class="meta">${t.area} · ${t.distance} km · ${t.elevation} m gain · ${t.hours} h</div>
        <span class="tag">${t.terrainType}</span>
        ${thumb ? `<div style="font-size:10.5px;color:var(--ink-soft);margin-top:6px;">↑ actual route shape, from real trail data</div>` : ''}
        <div class="details-toggle" data-id="${t.id}" style="margin-top:10px;font-size:12.5px;font-weight:700;color:var(--accent);cursor:pointer;user-select:none;">Trail details ▾</div>
        <div class="details-panel" id="details-${t.id}" hidden style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--paper-line);font-size:12.5px;color:var(--ink-soft);">
          ${renderTrailDetailContent(t)}
        </div>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.details-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const panel = document.getElementById(`details-${el.dataset.id}`);
      const nowHidden = !panel.hidden;
      panel.hidden = !panel.hidden;
      el.textContent = panel.hidden ? 'Trail details ▾' : 'Trail details ▴';
    });
  });

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
  }
});
