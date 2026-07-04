
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

  if(t.terrainRank > terrain) score -= (t.terrainRank - terrain) * 30;
  if(overrides.heatSensitive && t.heatRisk === 'high') score -= 20;
  if(t.distance > maxDistance) score -= Math.min(35, (t.distance - maxDistance) * 5);
  if(t.exposure) score -= 30;

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

async function renderReturningHomepage(profile){
  const heading = document.getElementById('returningHeading');
  const subline = document.getElementById('returningSubline');
  const countEl = document.getElementById('returningCount');
  const listEl = document.getElementById('returningTrailList');
  if(!heading || typeof trails === 'undefined') return;

  const name = (profile && profile.name) ? profile.name : 'there';
  const overrides = profile ? effectiveOverrides(profile) : { terrain:'1', distance:'10', heatSensitive:false };

  const scored = trails.map(t => ({...t, score: scoreTrail(t, overrides)})).sort((a,b) => b.score - a.score);

  // Genuine new-match detection: compare today's strong matches against
  // what was stored on the account the last time they visited.
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
  countEl.textContent = `${scored.length} trails, ranked${profile && profile.name ? ' for ' + name : ''}`;

  listEl.innerHTML = scored.map(t => {
    const isFav = !!currentFavorites[t.id];
    const isNew = newIds.has(t.id);
    return `
    <div class="trail-card" data-id="${t.id}">
      <div class="photo"></div>
      <div class="body">
        <div class="top-row">
          <span class="safety-badge ${safetyClass(t.safetyLevel)}">${safetyLabel(t.safetyLevel)}</span>
          ${isNew ? `<span style="font-size:10px;font-weight:700;color:#fff;background:var(--accent);padding:3px 8px;border-radius:10px;">NEW MATCH</span>` : ''}
          <span style="font-weight:700;font-size:12px;color:var(--success);white-space:nowrap;">${t.score}% match</span>
        </div>
        <div class="name" style="margin-top:8px;">${t.name}</div>
        <div class="meta">${t.area} · ${t.distance} km · ${t.elevation} m gain · ${t.hours} h</div>
        <span class="tag">${t.terrainType}</span>
        <div style="margin-top:10px;">
          <button class="fav-btn save-btn" data-id="${t.id}" style="font-size:12px;padding:6px 16px;">${isFav ? 'Saved' : 'Save'}</button>
        </div>
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
