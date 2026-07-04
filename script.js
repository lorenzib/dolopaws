
const state = {
  terrain:'0', shade:'high', stops:'frequent', distance:'10', exposure:'no',
  favorites:{},
  heatSensitiveDog:false,
  dogName:null,
  hasInteracted:false,
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

// Given the current pill state, find which fitness level it resembles most —
// used when saving a profile straight from the quiz, without asking again.
function deriveFitnessFromState(){
  let best = 'moderate', bestScore = -1;
  Object.keys(FITNESS_DEFAULTS).forEach(level => {
    const d = FITNESS_DEFAULTS[level];
    let score = 0;
    if(d.terrain === state.terrain) score++;
    if(d.shade === state.shade) score++;
    if(d.stops === state.stops) score++;
    if(d.distance === state.distance) score++;
    if(score > bestScore){ bestScore = score; best = level; }
  });
  return best;
}

function updateSavePrompt(){
  const prompt = document.getElementById('dogSavePrompt');
  if(!prompt) return;
  prompt.hidden = !(state.hasInteracted && !state.dogName);
}

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
    updateSavePrompt();
    return;
  }

  const defaults = FITNESS_DEFAULTS[profile.fitness] || FITNESS_DEFAULTS.moderate;
  setPillActive('terrain', defaults.terrain);
  setPillActive('shade', defaults.shade);
  setPillActive('stops', defaults.stops);
  setPillActive('distance', defaults.distance);
  // exposure is never auto-enabled — that stays an explicit human choice

  // An explicit answer to "how heat sensitive is your dog?" takes priority
  // over inferring it from breed alone.
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
  note.innerHTML = isHeatSensitive
    ? `🐾 ${breedIsHeatSensitive ? profile.breed + 's run hot' : profile.name + ' runs hot'} — we've prioritized shadier routes for ${profile.name}. <a href="account.html" style="color:var(--pine);text-decoration:underline;">Edit dog profile →</a>`
    : `🐾 Matched to ${profile.name}'s fitness level. <a href="account.html" style="color:var(--pine);text-decoration:underline;">Edit dog profile →</a>`;

  updateSavePrompt();
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
try{
  applyDogPersonalization(loadLocalDogProfile());
}catch(e){
  console.warn('Failed to apply local dog profile:', e);
}

window.addEventListener('dolopaws-auth-changed', async (e) => {
  try{
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
  }catch(err){
    state.favorites = loadLocalFavorites();
    try{
      applyDogPersonalization(loadLocalDogProfile());
    }catch(e){
      console.warn('Failed to apply local dog profile:', e);
    }
  }finally{
    render();
  }
});

// Only fires from the account page (editing an existing profile) —
// the homepage's own save flow is handled separately, below.
window.addEventListener('dolopaws-dog-profile-saved', async (e) => {
  try{
    const profile = e.detail.profile;
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(user){
      await window.DoloPawsAuth.setDogProfile(profile);
    } else {
      saveLocalDogProfile(profile);
    }
    applyDogPersonalization(profile);
  }catch(err){
    try{
      applyDogPersonalization(loadLocalDogProfile());
    }catch(e){
      console.warn('Failed to apply local dog profile:', e);
    }
  }finally{
    render();
  }
});

// ---------- Homepage "save this profile" flow ----------
// Clicking "Save profile" on the quiz either opens sign-up (if logged out)
// or, if already logged in with no dog saved yet, jumps straight to the
// name/breed follow-up.
let pendingProfileSave = false;

const saveProfileBtn = document.getElementById('saveProfileBtn');
if(saveProfileBtn){
  saveProfileBtn.addEventListener('click', () => {
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(user){
      openNameBreedModal();
    } else {
      pendingProfileSave = true;
      if(window.DoloPawsAuthUI) window.DoloPawsAuthUI.openSignup();
    }
  });
}

window.addEventListener('dolopaws-auth-success', () => {
  if(pendingProfileSave){
    pendingProfileSave = false;
    openNameBreedModal();
  }
});

function openNameBreedModal(){
  const modal = document.getElementById('nameBreedModal');
  const breedSelect = document.getElementById('nbBreed');
  const otherField = document.getElementById('nbBreedOtherField');
  if(!modal || !breedSelect) return;

  const OTHER_VALUE = '__other__';
  const list = (typeof DOG_BREEDS !== 'undefined') ? DOG_BREEDS : [];
  breedSelect.innerHTML = `<option value="">Select a breed…</option>` +
    list.map(b => `<option value="${b}">${b}</option>`).join('') +
    `<option value="${OTHER_VALUE}">Other (not listed)</option>`;
  breedSelect.onchange = () => {
    otherField.hidden = breedSelect.value !== OTHER_VALUE;
  };

  modal.hidden = false;
}

const nbCloseBtn = document.getElementById('nbClose');
if(nbCloseBtn){
  nbCloseBtn.addEventListener('click', () => {
    document.getElementById('nameBreedModal').hidden = true;
  });
}

const nameBreedForm = document.getElementById('nameBreedForm');
if(nameBreedForm){
  nameBreedForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const OTHER_VALUE = '__other__';
    const nameInput = document.getElementById('nbName');
    const breedSelect = document.getElementById('nbBreed');
    const breedOther = document.getElementById('nbBreedOther');
    const submitBtn = document.getElementById('nbSubmit');

    const profile = {
      name: nameInput.value.trim(),
      breed: breedSelect.value === OTHER_VALUE ? breedOther.value.trim() : breedSelect.value,
      heatSensitivity: state.shade,
      fitness: deriveFitnessFromState(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(user){
      await window.DoloPawsAuth.setDogProfile(profile);
    } else {
      saveLocalDogProfile(profile);
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Save profile';
    document.getElementById('nameBreedModal').hidden = true;
    nameBreedForm.reset();

    applyDogPersonalization(profile);
    render();
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
    state.hasInteracted = true;
    updateSavePrompt();
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

function ensureResultsNodes(){
  const results = document.getElementById('results');
  if(!results) return null;

  let count = document.getElementById('resultsCount');
  if(!count){
    count = document.createElement('div');
    count.id = 'resultsCount';
    count.className = 'hint';
    count.style.margin = '0 0 14px';
    results.prepend(count);
  }

  let grid = document.getElementById('grid');
  if(!grid){
    grid = document.createElement('div');
    grid.id = 'grid';
    results.appendChild(grid);
  }

  return { results, count, grid };
}

function renderFallbackMessage(message){
  const nodes = ensureResultsNodes();
  if(!nodes) return;
  nodes.count.textContent = '';
  nodes.grid.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'trail-card-v2';
  const head = document.createElement('div');
  head.className = 'card-head';
  const left = document.createElement('div');
  left.className = 'trail-left';
  const desc = document.createElement('p');
  desc.className = 'desc';
  desc.textContent = message;
  left.appendChild(desc);
  head.appendChild(left);
  card.appendChild(head);
  nodes.grid.appendChild(card);
  if(window.updateMapMarkers) window.updateMapMarkers([]);
}

// Number of trail cards shown to guests before the login CTA.
const GUEST_TRAIL_LIMIT = 5;

function render(){
  const nodes = ensureResultsNodes();
  if(!nodes){
    if(window.updateMapMarkers) window.updateMapMarkers([]);
    return;
  }

  let scored = [];
  try{
    if(!Array.isArray(trails)) throw new Error('trails data unavailable');
    scored = trails.map(t=>({...t, score:scoreTrail(t)}))
      .sort((a,b)=>b.score-a.score);
  }catch(err){
    renderFallbackMessage("We couldn't rank trails right now. Please refresh and try again.");
    return;
  }

  if(scored.length === 0){
    renderFallbackMessage('No matching trails right now. Try broadening your preferences.');
    return;
  }

  const loggedIn = !!(window.DoloPawsAuth && window.DoloPawsAuth.currentUser);
  const visible = loggedIn ? scored : scored.slice(0, GUEST_TRAIL_LIMIT);
  const hidden = loggedIn ? 0 : Math.max(0, scored.length - GUEST_TRAIL_LIMIT);

  nodes.count.textContent = loggedIn
    ? `${scored.length} trails, ranked by fit`
    : `${scored.length} trails found — showing top ${visible.length}`;

  nodes.grid.innerHTML = visible.map(t=>{
    const isFav = !!state.favorites[t.id];
    return `
    <div class="trail-card-v2" data-id="${t.id}">
      <div class="card-head card-top">
        <div class="trail-left">
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
          <div class="desc card-desc">${t.desc}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <button class="fav-btn ${isFav?'active':''}" data-fav="${t.id}">${isFav ? 'Saved' : 'Save'}</button>
          <div class="match-badge">
            <div class="match-num">${t.score}%</div>
            <div class="match-lbl">match</div>
          </div>
        </div>
      </div>
      <div class="detail-wrap" id="detail-${t.id}">
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

  // Append login CTA for guests after the visible subset.
  if(!loggedIn){
    const cta = document.createElement('div');
    cta.className = 'trail-teaser-cta';
    const hiddenMsg = hidden > 0
      ? `<strong>${hidden} more trail${hidden === 1 ? '' : 's'}</strong> scored for your dog's safety are waiting.`
      : `Log in to unlock personalised scores for your dog.`;
    cta.innerHTML = `
      <p class="trail-teaser-cta__msg">🐾 ${hiddenMsg}</p>
      <button class="btn-primary trail-teaser-cta__btn" id="teaserLoginBtn">Log in to see more →</button>
      <p class="trail-teaser-cta__sub">New here? <button class="trail-teaser-cta__link" id="teaserSignupBtn">Create a free dog profile</button> for personalised trail matching.</p>
    `;
    nodes.grid.appendChild(cta);

    const loginBtn = cta.querySelector('#teaserLoginBtn');
    if(loginBtn){
      loginBtn.addEventListener('click', () => {
        if(window.DoloPawsAuthUI) window.DoloPawsAuthUI.openLogin();
      });
    }
    const signupBtn = cta.querySelector('#teaserSignupBtn');
    if(signupBtn){
      signupBtn.addEventListener('click', () => {
        if(window.DoloPawsAuthUI) window.DoloPawsAuthUI.openSignup();
      });
    }
  }

  nodes.grid.querySelectorAll('.trail-card-v2[data-id]').forEach(card=>{
    card.addEventListener('click', e=>{
      if(e.target.closest('.fav-btn')) return;
      const id = card.dataset.id;
      document.getElementById(`detail-${id}`).classList.toggle('open');
    });
  });

  nodes.grid.querySelectorAll('.fav-btn').forEach(btn=>{
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

  if(window.updateMapMarkers) window.updateMapMarkers(scored);
}

window.getScoredTrails = function(){
  if(!Array.isArray(trails)) return [];
  try{
    return trails.map(t=>({...t, score:scoreTrail(t)})).sort((a,b)=>b.score-a.score);
  }catch(e){
    console.warn('Failed to score trails:', e);
    return [];
  }
};

render();
