
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
  subline.textContent = newIds.size > 0
    ? `${newIds.size} new match${newIds.size === 1 ? '' : 'es'} since your last visit.`
    : profile && profile.name ? `Ranked for ${name}'s saved profile.` : 'Add your dog\u2019s details in Edit profile to personalize this list.';

  let displayList = showingSavedOnly ? scored.filter(t => currentFavorites[t.id]) : scored;
  if(activeArea !== 'all') displayList = displayList.filter(t => t.area === activeArea);

  countEl.innerHTML = showingSavedOnly
    ? `<button id="backToAllBtn" style="padding:7px 16px;border-radius:14px;background:var(--accent);border:none;color:#fff;font-size:11.5px;font-weight:700;cursor:pointer;">← Back to all trails</button> <span style="margin-left:10px;color:var(--ink-soft);">${displayList.length} saved trail${displayList.length === 1 ? '' : 's'}</span>`
    : `${displayList.length} trails`;

  if(savedTrailsBtn){
    savedTrailsBtn.classList.toggle('saved', showingSavedOnly);
  }

  const backBtn = document.getElementById('backToAllBtn');
  if(backBtn){
    backBtn.addEventListener('click', () => {
      showingSavedOnly = false;
      renderReturningHomepage(profile);
    });
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
    return `
    <div class="trail-card" data-id="${t.id}">
      <div class="photo"></div>
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
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if(currentFavorites[id]) delete currentFavorites[id];
      else currentFavorites[id] = true;
      if(window.DoloPawsAuth) await window.DoloPawsAuth.setFavorites(currentFavorites);
      renderReturningHomepage(profile);
    });
  });
}

// Adjust-for-today panel wiring
const adjustToggle = document.getElementById('adjustToggle');
const adjustPanel = document.getElementById('adjustPanel');
const adjustCloseBtn = document.getElementById('adjustCloseBtn');
let currentProfileForAdjust = null;

const savedTrailsBtn = document.getElementById('savedTrailsBtn');
if(savedTrailsBtn){
  savedTrailsBtn.addEventListener('click', () => {
    showingSavedOnly = true;
    renderReturningHomepage(currentProfileForAdjust);
    document.getElementById('returningResults').scrollIntoView({ behavior: 'smooth' });
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

    const profile = await window.DoloPawsAuth.getDogProfile();
    currentProfileForAdjust = profile;
    currentFavorites = await window.DoloPawsAuth.getFavorites();
    renderReturningHomepage(profile);
  } else {
    newHome.hidden = false;
    returningHome.hidden = true;
  }
});
