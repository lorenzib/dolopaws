(function(){
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
    if(t.distance > maxDistance) score -= Math.min(35, (t.distance - maxDistance) * 5);
    if(t.exposure) score -= 30;
    if(t.heatRisk === 'high') score -= overrides.heatSensitive ? 25 : 12;
    else if(t.heatRisk === 'moderate') score -= overrides.heatSensitive ? 10 : 4;
    if(t.shadeCoverage < 20) score -= 10;
    else if(t.shadeCoverage < 40) score -= 5;
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

  const loggedOutState = document.getElementById('loggedOutState');
  const loggedInState = document.getElementById('loggedInState');
  const pageSubline = document.getElementById('pageSubline');
  const areaFilterRow = document.getElementById('areaFilterRow');
  const filteredTrailsList = document.getElementById('filteredTrailsList');

  let currentProfile = null;
  let currentFavorites = {};
  let activeArea = 'all';

  function overridesFromProfile(profile){
    const defaults = FITNESS_DEFAULTS[profile && profile.fitness] || FITNESS_DEFAULTS.moderate;
    const breedIsHeatSensitive = (typeof HEAT_SENSITIVE_BREEDS !== 'undefined')
      && profile && HEAT_SENSITIVE_BREEDS.includes(profile.breed);
    return { terrain: defaults.terrain, distance: defaults.distance, heatSensitive: breedIsHeatSensitive };
  }

  function renderAreaFilters(){
    const areas = Array.from(new Set(trails.map(t => t.area))).sort();
    const pills = ['all', ...areas];
    areaFilterRow.innerHTML = pills.map(a => `
      <div class="area-pill ${a === activeArea ? 'active' : ''}" data-area="${a}">${a === 'all' ? 'All areas' : a}</div>
    `).join('');
    areaFilterRow.querySelectorAll('.area-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeArea = pill.dataset.area;
        renderAreaFilters();
        renderList();
      });
    });
  }

  function renderList(){
    const overrides = overridesFromProfile(currentProfile);
    const filtered = trails.filter(t => activeArea === 'all' || t.area === activeArea);
    const scored = filtered.map(t => ({...t, score: scoreTrail(t, overrides)})).sort((a,b) => b.score - a.score);

    filteredTrailsList.innerHTML = scored.map(t => {
      const isFav = !!currentFavorites[t.id];
      return `
      <div class="trail-card">
        <div class="photo"></div>
        <div class="body">
          <div class="top-row">
            <span class="safety-badge ${safetyClass(t.safetyLevel)}">${safetyLabel(t.safetyLevel)}</span>
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

    filteredTrailsList.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if(currentFavorites[id]) delete currentFavorites[id];
        else currentFavorites[id] = true;
        if(window.DoloPawsAuth) await window.DoloPawsAuth.setFavorites(currentFavorites);
        renderList();
      });
    });
  }

  function waitForAuth(cb){
    if(window.DoloPawsAuth){ cb(); return; }
    window.addEventListener('dolopaws-auth-ready', cb, { once: true });
  }

  waitForAuth(() => {
    window.DoloPawsAuth.onChange(async (user) => {
      if(!user){
        pageSubline.textContent = "You're not logged in.";
        loggedOutState.hidden = false;
        loggedInState.hidden = true;
        return;
      }

      loggedOutState.hidden = true;
      loggedInState.hidden = false;

      currentProfile = await window.DoloPawsAuth.getDogProfile();
      currentFavorites = await window.DoloPawsAuth.getFavorites();
      pageSubline.textContent = currentProfile && currentProfile.name
        ? `Filtered and scored for ${currentProfile.name}.`
        : `Add your dog's details in Edit profile to see real match scores.`;

      renderAreaFilters();
      renderList();
    });
  });
})();
