
const state = {
  terrain:'0', shade:'high', stops:'frequent', distance:'10', exposure:'no',
  favorites:{},
  heatSensitiveDog:false,
  dogName:null,
  category:'All',
  showAll:false,
};

function setPillActive(group, value){
  const row = document.querySelector(`.pill-row[data-group="${group}"]`);
  if(!row) return;
  const btn = row.querySelector(`.pill[data-value="${value}"]`);
  if(!btn) return;
  row.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  state[group] = value;
}

const FITNESS_DEFAULTS = {
  low:      { terrain:'0', shade:'high', stops:'frequent',   distance:'5'  },
  moderate: { terrain:'1', shade:'some', stops:'occasional', distance:'10' },
  high:     { terrain:'2', shade:'any',  stops:'any',        distance:'99' },
};

function applyDogPersonalization(profile){
  const note = document.getElementById('personalizedNote');
  const heading = document.getElementById('finderHeading');
  const hint = document.getElementById('finderHint');

  if(!profile || !profile.name){
    state.heatSensitiveDog = false;
    state.dogName = null;
    heading.textContent = 'Tell me about your dog';
    hint.hidden = false;
    hint.textContent = 'Terrain, shade and water shape the match first — distance and exposure are secondary. Change anything anytime.';
    note.hidden = true;
    return;
  }

  const defaults = FITNESS_DEFAULTS[profile.fitness] || FITNESS_DEFAULTS.moderate;
  setPillActive('terrain', defaults.terrain);
  setPillActive('shade', defaults.shade);
  setPillActive('stops', defaults.stops);
  setPillActive('distance', defaults.distance);
  // exposure is never auto-enabled — that stays an explicit human choice

  const isHeatSensitive = (typeof HEAT_SENSITIVE_BREEDS !== 'undefined')
    && HEAT_SENSITIVE_BREEDS.includes(profile.breed);
  state.heatSensitiveDog = isHeatSensitive;
  state.dogName = profile.name;
  if(isHeatSensitive){
    setPillActive('shade', 'high');
  }

  heading.textContent = `Trails for ${profile.name}`;
  hint.hidden = true;
  note.hidden = false;
  note.innerHTML = isHeatSensitive
    ? `🐾 ${profile.breed}s run hot — we've prioritized shadier routes for ${profile.name}.`
    : `🐾 Matched to ${profile.name}'s fitness level. Edit this anytime in <a href="account.html" style="color:var(--pine);text-decoration:underline;">My account</a>.`;
}

function loadLocalFavorites(){
  try{
    const saved = localStorage.getItem('dolopaws-favorites');
    return saved ? JSON.parse(saved) : {};
  }catch(e){ return {}; }
}

state.favorites = loadLocalFavorites();

window.addEventListener('dolopaws-auth-changed', async (e) => {
  const user = e.detail.user;
  if(user && window.DoloPawsAuth){
    const cloudFavorites = await window.DoloPawsAuth.getFavorites();
    if(Object.keys(cloudFavorites).length === 0 && Object.keys(state.favorites).length > 0){
      await window.DoloPawsAuth.setFavorites(state.favorites);
    } else {
      state.favorites = cloudFavorites;
    }
    const profile = await window.DoloPawsAuth.getDogProfile();
    applyDogPersonalization(profile);
  } else {
    state.favorites = loadLocalFavorites();
    applyDogPersonalization(null);
  }
  render();
});

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

document.querySelectorAll('.pill-row').forEach(row=>{
  row.addEventListener('click', e=>{
    const btn = e.target.closest('.pill');
    if(!btn) return;
    const group = row.dataset.group;
    row.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    state[group] = btn.dataset.value;
    render();
  });
});

// Category tabs — a hard filter applied before scoring/ranking
document.querySelectorAll('.cat-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.cat-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    state.category = tab.dataset.category;
    state.showAll = false;
    render();
  });
});

const showMatchesBtn = document.getElementById('showMatchesBtn');
if(showMatchesBtn){
  showMatchesBtn.addEventListener('click', ()=>{
    document.getElementById('grid').scrollIntoView({behavior:'smooth', block:'start'});
  });
}

const ctaShowMatches = document.getElementById('ctaShowMatches');
if(ctaShowMatches){
  ctaShowMatches.addEventListener('click', ()=>{
    document.getElementById('finder').scrollIntoView({behavior:'smooth', block:'start'});
  });
}

document.querySelectorAll('[data-category-link]').forEach(link=>{
  link.addEventListener('click', (e)=>{
    e.preventDefault();
    const cat = link.dataset.categoryLink;
    const tab = document.querySelector(`.cat-tab[data-category="${cat}"]`);
    if(tab) tab.click();
    document.getElementById('grid').scrollIntoView({behavior:'smooth', block:'start'});
  });
});

function scoreTrail(t){
  let score = 100;

  const userTerrain = parseInt(state.terrain, 10);
  if(t.terrainRank > userTerrain) score -= (t.terrainRank - userTerrain) * 35;

  if(state.shade === 'high' && t.shadeCoverage < 50) score -= 25;
  if(state.shade === 'some' && t.shadeCoverage < 20) score -= 15;

  if(state.heatSensitiveDog && t.heatRisk === 'high') score -= 20;

  const stopsPerKm = (t.waterSources.length + t.rifugi.length) / t.distance;
  if(state.stops === 'frequent' && stopsPerKm < 0.5) score -= 22;
  if(state.stops === 'occasional' && stopsPerKm === 0) score -= 12;

  const maxD = parseFloat(state.distance);
  if(t.distance > maxD) score -= Math.min(35, (t.distance - maxD) * 5);

  if(t.exposure && state.exposure === 'no') score -= 35;

  return Math.max(2, Math.round(score));
}

// Exposed so the map can use the exact same scoring/ranking logic — no duplicated rules to drift out of sync
window.getScoredTrails = function(){
  const pool = state.category === 'All' ? trails : trails.filter(t => t.category === state.category);
  return pool.map(t=>({...t, score:scoreTrail(t)})).sort((a,b)=>b.score-a.score);
};

function safetyLabel(level){
  if(level === 'low-risk') return 'Low-risk terrain';
  if(level === 'moderate') return 'Moderate — some caution';
  return 'Caution — exposed sections';
}

function routeTimeline(t){
  const stops = [
    ...t.waterSources.map(s => ({...s, type:'water'})),
    ...t.rifugi.map(s => ({...s, type:'rifugio', label:s.name})),
  ].sort((a,b) => a.km - b.km);

  if(stops.length === 0){
    return `<p class="none">No reliable water or rifugi on this route — carry everything you need.</p>`;
  }

  return `<ol class="timeline">${stops.map(s => `
    <li data-type="${s.type}">
      <span class="dot"></span>
      <span class="km">km ${s.km}</span>${s.label} <span style="opacity:.65;">(${s.type === 'water' ? 'water' : 'rifugio'})</span>
    </li>`).join('')}
  </ol>`;
}

function render(){
  const grid = document.getElementById('grid');
  const scored = window.getScoredTrails();

  document.getElementById('resultsCount').textContent = `${scored.length} trails, ranked by fit`;

  const heroCount = document.getElementById('heroMatchCount');
  if(heroCount){
    heroCount.textContent = state.dogName
      ? `🐾 ${scored.length} trails match ${state.dogName}'s profile`
      : `🐾 ${scored.length} trails match your filters`;
  }

  const VISIBLE_LIMIT = 6;
  const toShow = state.showAll ? scored : scored.slice(0, VISIBLE_LIMIT);

  grid.innerHTML = toShow.map(t=>{
    const isFav = !!state.favorites[t.id];
    return `
    <div class="trail-card-v2" data-id="${t.id}">
      <div class="trail-photo">trail photo</div>
      <div class="body-pad">
        <span class="safety-badge safety-${t.safetyLevel === 'low-risk' ? 'low' : t.safetyLevel === 'moderate' ? 'moderate' : 'caution'}">
          ${safetyLabel(t.safetyLevel)}
        </span>
        <h4>${t.name}</h4>
        <div class="meta-line">${t.distance} km · ${t.elevation} m gain · ${t.area}</div>
        <div class="hazard-tags">
          ${t.surfaceHazards.length ? t.surfaceHazards.map(h=>`<span class="hazard-tag">${h}</span>`).join('') : `<span class="hazard-tag">No notable surface hazards</span>`}
        </div>
        <div class="card-foot">
          <span class="match-pct">${t.score}% match</span>
          <button class="save-pill ${isFav?'active':''}" data-fav="${t.id}">${isFav ? 'Saved' : 'Save'}</button>
        </div>
      </div>
      <div class="detail" id="detail-${t.id}">
        <div class="detail-grid">
          <div><b>Shade coverage:</b> ~${t.shadeCoverage}%</div>
          <div><b>Paid access:</b> ${t.paid ? 'Cable car or rifugio fee' : 'Free'}</div>
        </div>
        <div class="heat-row heat-${t.heatRisk}">
          <span class="heat-dot"></span> Heat risk: <b style="text-transform:capitalize;">${t.heatRisk}</b>
        </div>
        <h4 style="margin:16px 0 4px;font-size:13.5px;color:var(--pine);">Water &amp; rifugi along the route</h4>
        ${routeTimeline(t)}
        <div class="tip-line">${t.tips}</div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.trail-card-v2').forEach(card=>{
    card.addEventListener('click', e=>{
      if(e.target.closest('.save-pill')) return;
      const id = card.dataset.id;
      document.getElementById(`detail-${id}`).classList.toggle('open');
    });
  });

  grid.querySelectorAll('.save-pill').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      e.stopPropagation();
      const id = btn.dataset.fav;
      if(state.favorites[id]) delete state.favorites[id];
      else state.favorites[id] = true;

      const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
      if(user){
        await window.DoloPawsAuth.setFavorites(state.favorites);
      } else {
        try{ localStorage.setItem('dolopaws-favorites', JSON.stringify(state.favorites)); }catch(err){}
      }
      render();
    });
  });

  const seeAllBtn = document.getElementById('seeAllBtn');
  if(seeAllBtn){
    if(scored.length > VISIBLE_LIMIT && !state.showAll){
      seeAllBtn.hidden = false;
      seeAllBtn.textContent = `See all ${scored.length} matched trails →`;
    } else {
      seeAllBtn.hidden = true;
    }
  }

  if(window.updateMapMarkers) window.updateMapMarkers(scored);
}

const seeAllBtn = document.getElementById('seeAllBtn');
if(seeAllBtn){
  seeAllBtn.addEventListener('click', ()=>{
    state.showAll = true;
    render();
  });
}

render();
