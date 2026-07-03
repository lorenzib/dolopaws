
const state = {
  terrain:'0', shade:'high', stops:'frequent', distance:'10', exposure:'no',
  favorites:{},
  heatSensitiveDog:false,
  dogName:null,
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
  const banner = document.getElementById('dogPromptBanner');

  if(!profile || !profile.name){
    state.heatSensitiveDog = false;
    state.dogName = null;
    heading.textContent = 'Tell me about your dog';
    hint.hidden = false;
    hint.textContent = 'Terrain, shade and water shape the match first — distance and exposure are secondary. Change anything anytime.';
    note.hidden = true;
    if(banner) banner.hidden = false;
    return;
  }

  if(banner) banner.hidden = true;

  const defaults = FITNESS_DEFAULTS[profile.fitness] || FITNESS_DEFAULTS.moderate;
  setPillActive('terrain', defaults.terrain);
  setPillActive('shade', defaults.shade);
  setPillActive('stops', defaults.stops);
  setPillActive('distance', defaults.distance);
  // exposure is never auto-enabled — that stays an explicit human choice

  // An explicit answer to "how heat sensitive is your dog?" (from the wizard)
  // takes priority over inferring it from breed alone.
  const breedIsHeatSensitive = (typeof HEAT_SENSITIVE_BREEDS !== 'undefined')
    && HEAT_SENSITIVE_BREEDS.includes(profile.breed);
  const explicitHeatSensitive = profile.heatSensitivity === 'high';
  const isHeatSensitive = breedIsHeatSensitive || explicitHeatSensitive;
  state.heatSensitiveDog = isHeatSensitive;
  state.dogName = profile.name;
  if(isHeatSensitive){
    setPillActive('shade', 'high');
  } else if(profile.heatSensitivity === 'some'){
    setPillActive('shade', 'some');
  } else if(profile.heatSensitivity === 'any'){
    setPillActive('shade', 'any');
  }

  heading.textContent = `Trails for ${profile.name}`;
  hint.hidden = true;
  note.hidden = false;

  const initial = profile.name.trim().charAt(0).toUpperCase();
  const subtitleParts = [];
  if(profile.breed) subtitleParts.push(profile.breed);
  const fitnessLabels = { low:'Low fitness', moderate:'Moderate fitness', high:'High fitness' };
  subtitleParts.push(fitnessLabels[profile.fitness] || 'Fitness not set');
  if(isHeatSensitive) subtitleParts.push('shaded routes prioritized');

  note.innerHTML = `
    <div class="left">
      <div class="dog-avatar">${initial}</div>
      <div>
        <div class="title">Trails matched for ${profile.name}</div>
        <div class="subtitle">${subtitleParts.join(' · ')}</div>
      </div>
    </div>
    <a href="account.html" class="edit-btn">Edit</a>
  `;
}

function loadLocalFavorites(){
  try{
    const saved = localStorage.getItem('dolopaws-favorites');
    return saved ? JSON.parse(saved) : {};
  }catch(e){ return {}; }
}

function loadLocalDogProfile(){
  try{
    const saved = localStorage.getItem('dolopaws-dog-profile');
    return saved ? JSON.parse(saved) : null;
  }catch(e){ return null; }
}
function saveLocalDogProfile(profile){
  try{ localStorage.setItem('dolopaws-dog-profile', JSON.stringify(profile)); }catch(e){}
}

state.favorites = loadLocalFavorites();

// Apply any guest dog profile immediately, so a returning guest sees
// personalization right away without waiting on Firebase auth to resolve.
applyDogPersonalization(loadLocalDogProfile());

window.addEventListener('dolopaws-auth-changed', async (e) => {
  const user = e.detail.user;
  if(user && window.DoloPawsAuth){
    const cloudFavorites = await window.DoloPawsAuth.getFavorites();
    if(Object.keys(cloudFavorites).length === 0 && Object.keys(state.favorites).length > 0){
      await window.DoloPawsAuth.setFavorites(state.favorites);
    } else {
      state.favorites = cloudFavorites;
    }

    let profile = await window.DoloPawsAuth.getDogProfile();
    const localProfile = loadLocalDogProfile();
    if(!profile && localProfile){
      // first login on this device with a guest-filled dog profile — migrate it up
      await window.DoloPawsAuth.setDogProfile(localProfile);
      profile = localProfile;
    }
    applyDogPersonalization(profile);
  } else {
    state.favorites = loadLocalFavorites();
    applyDogPersonalization(loadLocalDogProfile());
  }
  render();
});

// Only fires from the homepage's "add a dog" banner (no profile yet) —
// once a profile exists, editing only happens on the account page.
window.addEventListener('dolopaws-dog-profile-saved', async (e) => {
  const profile = e.detail.profile;
  const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
  if(user){
    await window.DoloPawsAuth.setDogProfile(profile);
  } else {
    saveLocalDogProfile(profile);
  }
  applyDogPersonalization(profile);
  render();
});

const openWizardBtn = document.getElementById('openWizardBtn');
if(openWizardBtn){
  openWizardBtn.addEventListener('click', () => {
    if(window.DoloPawsWizard) window.DoloPawsWizard.open();
  });
}

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
  const scored = trails.map(t=>({...t, score:scoreTrail(t)}))
    .sort((a,b)=>b.score-a.score);

  document.getElementById('resultsCount').textContent = `${scored.length} trails, ranked by fit`;

  grid.innerHTML = scored.map(t=>{
    const isFav = !!state.favorites[t.id];
    return `
    <div class="card" data-id="${t.id}">
      <div class="card-top">
        <div>
          <div class="card-title-row">
            <span class="safety-badge safety-${t.safetyLevel === 'low-risk' ? 'low' : t.safetyLevel === 'moderate' ? 'moderate' : 'caution'}">
              ${safetyLabel(t.safetyLevel)}
            </span>
          </div>
          <h3 style="margin-top:8px;">${t.name}</h3>
          <span class="area-tag">${t.area}</span>
          <div class="stat-row">
            <span class="stat">${t.distance} km</span>
            <span class="stat">${t.elevation} m gain</span>
            <span class="stat">${t.hours} h</span>
            <span class="diff-badge-sm">${t.terrainType}</span>
          </div>
          <div class="hazard-tags">
            ${t.surfaceHazards.length ? t.surfaceHazards.map(h=>`<span class="hazard-tag">${h}</span>`).join('') : `<span class="hazard-tag">No notable surface hazards</span>`}
          </div>
          <div class="card-desc">${t.desc}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <button class="fav-btn ${isFav?'active':''}" data-fav="${t.id}">${isFav ? 'Saved' : 'Save'}</button>
          <div class="match-badge">
            <div class="match-num">${t.score}%</div>
            <div class="match-lbl">match</div>
          </div>
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

  grid.querySelectorAll('.card').forEach(card=>{
    card.addEventListener('click', e=>{
      if(e.target.closest('.fav-btn')) return;
      const id = card.dataset.id;
      document.getElementById(`detail-${id}`).classList.toggle('open');
    });
  });

  grid.querySelectorAll('.fav-btn').forEach(btn=>{
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
}

render();
