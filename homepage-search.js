/**
 * homepage-search.js — controller for the redesigned logged-out homepage
 * (search-first hero + live results + dog mini-wizard).
 *
 * Ported from the Alpenglow prototype but wired to REAL data + scoring:
 *   - `trails` (trails-data.js + osm-*.js)
 *   - `scoreTrail` / `effectiveOverrides` (scoring.js)
 *   - `pathThumbnailSvg`, `trailSafetyLabel`, `safetyClass` (script.js)
 * The redesign only owns the #newCustomerHomepage block; the returning-user
 * homepage, auth wiring and the full dog wizard are untouched.
 */
(function () {
  'use strict';

  var root = document.getElementById('newCustomerHomepage');
  if (!root) return;

  // Bail out gracefully if the scoring/data globals never loaded.
  function ready() {
    return typeof trails !== 'undefined' && Array.isArray(trails) &&
      typeof scoreTrail === 'function' && typeof effectiveOverrides === 'function';
  }

  // ---- Preset "preview as" dogs, expressed as REAL profile objects so
  //      scoreTrail/effectiveOverrides read them with zero translation. ----
  var PRESETS = {
    medium: { key: 'medium', name: 'Medium dog', sub: 'Guest default', emoji: '🐾', badge: '🐾',
              chipBg: 'var(--sage-dim)', chipColor: 'var(--ink)',
              profile: { name: 'Medium dog', breed: '', fitness: 'moderate', conditions: [], weightBand: '15-20' } },
    rufus:  { key: 'rufus', name: 'Rufus', sub: 'Large · heat-sensitive', emoji: '🐕', badge: 'R',
              chipBg: 'var(--accent)', chipColor: '#fff',
              profile: { name: 'Rufus', breed: '', fitness: 'moderate', conditions: ['heat'], weightBand: '30-40' } },
    bella:  { key: 'bella', name: 'Bella', sub: 'Small · takes it easy', emoji: '🐕', badge: 'B',
              chipBg: '#8A5A16', chipColor: '#fff',
              profile: { name: 'Bella', breed: '', fitness: 'low', conditions: [], weightBand: '5-10' } },
    milo:   { key: 'milo', name: 'Milo', sub: 'High energy', emoji: '🐕', badge: 'M',
              chipBg: 'var(--success)', chipColor: '#fff',
              profile: { name: 'Milo', breed: '', fitness: 'high', conditions: [], weightBand: '15-20' } },
  };

  var state = {
    query: '', dog: 'medium', dist: 99, shade: 'any', terrain: 'any',
    searched: false, menu: null, custom: null,
    wizOpen: false, wizStep: 0,
    wiz: { name: '', size: 'medium', energy: 'medium', terrainTol: 'gravel', heat: false },
  };

  var DIST_OPTS = [
    { label: 'Any distance', short: 'Any', v: 99 },
    { label: 'Up to 3 km', short: 'Up to 3 km', v: 3 },
    { label: 'Up to 6 km', short: 'Up to 6 km', v: 6 },
    { label: 'Up to 10 km', short: 'Up to 10 km', v: 10 },
  ];
  var SHADE_OPTS = [
    { label: 'Any shade', short: 'Any', v: 'any' },
    { label: 'Prefer shaded', short: 'Prefer shaded', v: 'shade' },
  ];
  var TERRAIN_OPTS = [
    { label: 'Any terrain', short: 'Any', v: 'any' },
    { label: 'Soft ground', short: 'Soft ground', v: 'soft' },
  ];
  var POPULAR = [
    { label: 'Lago di Braies', apply: function () { state.query = 'Braies'; state.searched = true; } },
    { label: 'Alpe di Siusi', apply: function () { state.query = 'Alpe di Siusi'; state.searched = true; } },
    { label: 'Shady & short', apply: function () { state.query = ''; state.shade = 'shade'; state.dist = 6; state.searched = true; } },
    { label: 'Near water', apply: function () { state.query = 'Carezza'; state.searched = true; } },
  ];

  // ---- element refs ----
  var el = {
    announceCount: document.getElementById('hpAnnounceCount'),
    search: document.getElementById('hpSearch'),
    dogPill: document.getElementById('hpDogPill'),
    dogLabel: document.getElementById('hpDogLabel'),
    dogEmoji: root.querySelector('.hp-dog-emoji'),
    dogMenu: document.getElementById('hpDogMenu'),
    dogOptions: document.getElementById('hpDogOptions'),
    distBtn: document.getElementById('hpDistBtn'), distLabel: document.getElementById('hpDistLabel'), distMenu: document.getElementById('hpDistMenu'),
    shadeBtn: document.getElementById('hpShadeBtn'), shadeLabel: document.getElementById('hpShadeLabel'), shadeMenu: document.getElementById('hpShadeMenu'),
    terrainBtn: document.getElementById('hpTerrainBtn'), terrainLabel: document.getElementById('hpTerrainLabel'), terrainMenu: document.getElementById('hpTerrainMenu'),
    searchBtn: document.getElementById('hpSearchBtn'),
    popular: document.getElementById('hpPopular'),
    guestTitle: document.getElementById('hpGuestTitle'),
    guestSub: document.getElementById('hpGuestSub'),
    guestCta: document.getElementById('hpGuestCta'),
    content: document.getElementById('hpContent'),
    wizard: document.getElementById('hpWizard'),
    wizBody: document.getElementById('hpWizBody'),
    wizStepLabel: document.getElementById('hpWizStepLabel'),
    wizTitle: document.getElementById('hpWizTitle'),
    wizBars: [document.getElementById('hpWizBar1'), document.getElementById('hpWizBar2'), document.getElementById('hpWizBar3')],
    wizBack: document.getElementById('hpWizBack'),
    wizNext: document.getElementById('hpWizNext'),
    wizClose: document.getElementById('hpWizClose'),
  };

  // ---- helpers ----
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  function activeProfile() {
    if (state.dog === 'custom' && state.custom) return state.custom.profile;
    return (PRESETS[state.dog] || PRESETS.medium).profile;
  }
  function dogMeta() {
    if (state.dog === 'custom' && state.custom) return state.custom.meta;
    return PRESETS[state.dog] || PRESETS.medium;
  }

  function scoreOf(t) {
    try { return scoreTrail(t, effectiveOverrides(activeProfile(), null)); }
    catch (e) { return 0; }
  }

  function tier(s) {
    if (s >= 85) return { bg: '#DCEBDD', color: '#2C5C34', label: 'Great match', pin: '#4A7856' };
    if (s >= 65) return { bg: '#F5E4C6', color: '#8A5A16', label: 'Good match', pin: '#C98A2E' };
    return { bg: '#F3D9D2', color: '#9C3A25', label: 'Check first', pin: '#9C3A25' };
  }

  function difficulty(t) {
    var gain = typeof t.elevation === 'number' ? t.elevation : 0;
    var rank = typeof t.terrainRank === 'number' ? t.terrainRank : 1;
    var d;
    if (gain >= 400 || (rank >= 2 && gain >= 250)) d = 'Hard';
    else if (gain >= 180 || t.distance >= 6 || rank >= 2) d = 'Moderate';
    else d = 'Easy';
    return { label: d, dot: { Easy: '#4A7856', Moderate: '#C98A2E', Hard: '#9C3A25' }[d] };
  }

  var TONE = { low: 'background:#DCEBDD;color:#2C5C34', mod: 'background:#F5E4C6;color:#8A5A16', caution: 'background:#F3D9D2;color:#9C3A25' };
  function badgesFor(t) {
    var out = [];
    var rank = typeof t.terrainRank === 'number' ? t.terrainRank : 1;
    if (rank <= 0) out.push({ label: 'Graded ground', tone: 'low' });
    else if (rank >= 2) out.push({ label: 'Rocky', tone: 'caution' });
    else out.push({ label: 'Mixed terrain', tone: 'mod' });
    var sc = typeof t.shadeCoverage === 'number' ? t.shadeCoverage : 0;
    if (sc >= 60) out.push({ label: 'Fully shaded', tone: 'low' });
    else if (sc >= 30) out.push({ label: 'Part shade', tone: 'mod' });
    else out.push({ label: 'Little shade', tone: 'mod' });
    if (Array.isArray(t.waterSources) && t.waterSources.length) out.push({ label: 'Water access', tone: 'low' });
    return out;
  }

  function thumb(t) {
    if (t.imageIcon) return '<img src="' + esc(t.imageIcon) + '" alt="" loading="lazy">';
    if (typeof pathThumbnailSvg === 'function') { var s = pathThumbnailSvg(t.path); if (s) return s; }
    return '';
  }
  function trailHref(t) { return 'trail.html?id=' + encodeURIComponent(t.id); }
  function valleyOf(t) { return t.valley || t.area || ''; }

  function isSearching() {
    return state.query.trim() !== '' || state.searched ||
      state.dist !== 99 || state.shade !== 'any' || state.terrain !== 'any';
  }

  function rankedList() {
    var q = state.query.trim().toLowerCase();
    return trails.filter(function (t) {
      if (q) {
        var hay = (t.name + ' ' + (t.area || '') + ' ' + (t.valley || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (state.dist !== 99 && t.distance > state.dist) return false;
      if (state.shade === 'shade' && (t.shadeCoverage || 0) < 30) return false;
      if (state.terrain === 'soft' && (t.terrainRank || 0) !== 0) return false;
      return true;
    }).map(function (t) {
      return { t: t, score: scoreOf(t) };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  function collection() {
    return trails.filter(function (t) {
      return (t.shadeCoverage || 0) >= 50 && Array.isArray(t.waterSources) && t.waterSources.length;
    }).map(function (t) { return { t: t, score: scoreOf(t) }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
  }

  // ---- renderers ----
  function renderDogPill() {
    var m = dogMeta();
    el.dogLabel.textContent = m.name;
    el.dogEmoji.textContent = m.emoji;
  }

  function renderDogMenu() {
    var keys = state.custom ? ['custom', 'medium', 'rufus', 'bella', 'milo'] : ['medium', 'rufus', 'bella', 'milo'];
    el.dogOptions.innerHTML = keys.map(function (k) {
      var m = k === 'custom' ? state.custom.meta : PRESETS[k];
      var check = k === state.dog ? '<span class="hp-menu-check">✓</span>' : '';
      return '<button type="button" class="hp-menu-item" data-dog="' + k + '">' +
        '<span class="hp-menu-avatar" style="background:' + m.chipBg + ';color:' + m.chipColor + '">' + esc(m.badge) + '</span>' +
        '<span style="flex:1"><span class="hp-mi-name">' + esc(m.name) + '</span><span class="hp-mi-sub">' + esc(m.sub) + '</span></span>' +
        check + '</button>';
    }).join('');
  }

  function renderFilterMenu(menuEl, opts, cur, kind) {
    menuEl.innerHTML = opts.map(function (o) {
      var check = cur === o.v ? '<span class="hp-menu-check">✓</span>' : '';
      return '<button type="button" class="hp-menu-item" data-kind="' + kind + '" data-val="' + o.v + '">' + esc(o.label) + check + '</button>';
    }).join('');
  }

  function labelFor(opts, v) { for (var i = 0; i < opts.length; i++) if (opts[i].v === v) return opts[i].short; return opts[0].short; }

  function renderFilters() {
    el.distLabel.textContent = labelFor(DIST_OPTS, state.dist);
    el.shadeLabel.textContent = labelFor(SHADE_OPTS, state.shade);
    el.terrainLabel.textContent = labelFor(TERRAIN_OPTS, state.terrain);
  }

  function renderGuestBar() {
    if (state.dog === 'custom' && state.custom) {
      el.guestTitle.textContent = 'Walking with ' + state.custom.meta.name + '.';
      el.guestSub.textContent = 'Trails are ranked just for them. Log in to save this profile across devices.';
      el.guestCta.textContent = 'Save profile →';
    } else if (state.dog === 'medium') {
      el.guestTitle.textContent = 'Browsing as a guest, ranked for a medium dog.';
      el.guestSub.textContent = 'No account needed. Add your dog any time to sharpen every score.';
      el.guestCta.textContent = "Create your dog's profile →";
    } else {
      el.guestTitle.textContent = 'Previewing as ' + dogMeta().name + '.';
      el.guestSub.textContent = 'Create your own dog to tune every score to them.';
      el.guestCta.textContent = "Create your dog's profile →";
    }
  }

  function rowHtml(entry) {
    var t = entry.t, s = entry.score, ti = tier(s), df = difficulty(t);
    var badges = '<span class="hp-badge hp-badge-diff"><span class="hp-badge-dot" style="background:' + df.dot + '"></span>' + df.label + '</span>' +
      badgesFor(t).map(function (b) { return '<span class="hp-badge" style="' + TONE[b.tone] + '">' + esc(b.label) + '</span>'; }).join('');
    return '<button type="button" class="hp-trailrow" data-href="' + esc(trailHref(t)) + '">' +
      '<span class="hp-trailrow-thumb">' + thumb(t) + '</span>' +
      '<span class="hp-trailrow-main">' +
        '<span class="hp-trailrow-name">' + esc(t.name) + '</span>' +
        '<span class="hp-trailrow-meta">' + esc(t.distance) + ' km · +' + esc(t.elevation || 0) + ' m · ' + esc(valleyOf(t)) + '</span>' +
        '<span class="hp-badges">' + badges + '</span>' +
      '</span>' +
      '<span class="hp-trailrow-match">' +
        '<span class="hp-match-pct" style="color:' + ti.color + '">' + s + '<span>%</span></span>' +
        '<span class="hp-tier" style="background:' + ti.bg + ';color:' + ti.color + '">' + ti.label + '</span>' +
      '</span>' +
    '</button>';
  }

  function ccardHtml(entry) {
    var t = entry.t, s = entry.score, ti = tier(s), df = difficulty(t);
    var sc = t.shadeCoverage || 0;
    var shadeTxt = sc >= 60 ? 'Fully shaded' : 'Part shade';
    return '<button type="button" class="hp-ccard" data-href="' + esc(trailHref(t)) + '">' +
      '<span class="hp-ccard-img">' + thumb(t) + '<span class="hp-ccard-pct" style="background:' + ti.pin + '">' + s + '%</span></span>' +
      '<span class="hp-ccard-body">' +
        '<span class="hp-ccard-name">' + esc(t.name) + '</span>' +
        '<span class="hp-ccard-tags"><span class="hp-badge hp-badge-diff"><span class="hp-badge-dot" style="background:' + df.dot + '"></span>' + df.label + '</span>' +
        '<span class="txt">' + esc(t.distance) + ' km · ' + shadeTxt + ' · Water</span></span>' +
      '</span>' +
    '</button>';
  }

  function renderContent() {
    if (isSearching()) {
      var list = rankedList();
      var q = state.query.trim();
      var title = q ? 'Trails matching “' + esc(q) + '”' : 'Filtered trails';
      var sub = list.length + ' ' + (list.length === 1 ? 'trail' : 'trails') + ' · ranked for ' + esc(dogMeta().name);
      var body;
      if (list.length) {
        body = '<div class="hp-list">' + list.map(rowHtml).join('') + '</div>';
      } else {
        body = '<div class="hp-empty"><h3>No trails match those filters</h3>' +
          '<p>Try widening your distance or clearing a filter.</p>' +
          '<button type="button" class="hp-search-btn" data-action="reset">Reset filters</button></div>';
      }
      el.content.innerHTML =
        '<div class="hp-results-head"><div><div class="hp-results-title">' + title + '</div>' +
        '<div class="hp-results-sub">' + sub + '</div></div>' +
        '<button type="button" class="hp-clear" data-action="clear">Clear search</button></div>' + body;
    } else {
      var coll = collection();
      var isGuest = state.dog === 'medium';
      var collSub = isGuest ? 'Ranked for a medium dog · add your dog to personalise'
        : 'Ranked for ' + esc(dogMeta().name) + ' · switch dogs any time';
      el.content.innerHTML =
        '<div class="hp-coll-head"><div><h2>🌳 Shady lake loops for hot days</h2>' +
        '<p class="hp-coll-sub">' + collSub + '</p></div>' +
        '<a href="browse-trails.html" class="hp-coll-all">All trails →</a></div>' +
        '<div class="hp-coll-grid">' + coll.map(ccardHtml).join('') + '</div>' +
        '<div class="hp-community"><div class="hp-community-kick">Fresh from dog-walkers this week</div>' +
        '<div class="hp-community-grid">' +
          '<div class="hp-community-item"><span class="hp-community-avatar" style="background:var(--accent)">M</span>' +
          '<div><div class="who"><b>Marta &amp; Bruno</b> · Lago di Braies · 2 days ago</div>' +
          '<div class="txt">“Streams still running, plenty of shade by 9am. Gravel section warm by noon, so go early.”</div></div></div>' +
          '<div class="hp-community-item"><span class="hp-community-avatar" style="background:#8A5A16">L</span>' +
          '<div><div class="who"><b>Luca &amp; Nala</b> · Alpe di Siusi · 4 days ago</div>' +
          '<div class="txt">“Cattle on the meadow loop, kept Nala leashed. Water trough near the rifugio is working.”</div></div></div>' +
        '</div></div>';
    }
  }

  function closeMenus() { state.menu = null; syncMenus(); }

  function syncMenus() {
    var map = { dog: el.dogMenu, dist: el.distMenu, shade: el.shadeMenu, terrain: el.terrainMenu };
    var btns = { dog: el.dogPill, dist: el.distBtn, shade: el.shadeBtn, terrain: el.terrainBtn };
    Object.keys(map).forEach(function (k) {
      var open = state.menu === k;
      map[k].hidden = !open;
      btns[k].setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var scrim = document.getElementById('hpMenuScrim');
    if (state.menu && !scrim) {
      scrim = document.createElement('div');
      scrim.id = 'hpMenuScrim';
      scrim.className = 'hp-menu-scrim';
      scrim.addEventListener('click', closeMenus);
      document.body.appendChild(scrim);
    } else if (!state.menu && scrim) {
      scrim.remove();
    }
  }

  function renderAll() {
    renderDogPill();
    renderDogMenu();
    renderFilters();
    renderGuestBar();
    renderContent();
  }

  // ---- static one-time setup ----
  function setupStatic() {
    if (el.announceCount) el.announceCount.textContent = trails.length + ' trails';
    renderFilterMenu(el.distMenu, DIST_OPTS, state.dist, 'dist');
    renderFilterMenu(el.shadeMenu, SHADE_OPTS, state.shade, 'shade');
    renderFilterMenu(el.terrainMenu, TERRAIN_OPTS, state.terrain, 'terrain');
    el.popular.innerHTML = POPULAR.map(function (p, i) {
      return '<button type="button" class="hp-chip" data-pop="' + i + '">' + esc(p.label) + '</button>';
    }).join('');
  }

  // ---- mini-wizard ----
  var SIZE_OPTS = [{ label: 'Small', v: 'small' }, { label: 'Medium', v: 'medium' }, { label: 'Large', v: 'large' }];
  var ENERGY_OPTS = [{ label: 'Low', v: 'low' }, { label: 'Medium', v: 'medium' }, { label: 'High', v: 'high' }];
  var TERRAINTOL_OPTS = [{ label: 'Soft ground only', v: 'soft' }, { label: 'Some gravel is fine', v: 'gravel' }, { label: 'Anything, including rock', v: 'any' }];
  var HEAT_OPTS = [{ label: 'Yes, gets hot easily', v: true }, { label: 'No, handles heat fine', v: false }];

  function optBtns(opts, cur, field, col) {
    return '<div class="hp-wiz-opts' + (col ? ' col' : '') + '">' + opts.map(function (o) {
      var sel = String(cur) === String(o.v) ? ' sel' : '';
      return '<button type="button" class="hp-wiz-opt' + sel + '" data-wfield="' + field + '" data-wval="' + o.v + '">' + esc(o.label) + '</button>';
    }).join('') + '</div>';
  }

  function renderWizard() {
    var w = state.wiz;
    el.wizStepLabel.textContent = 'Step ' + (state.wizStep + 1) + ' of 3';
    el.wizBars.forEach(function (b, i) { if (b) b.className = i <= state.wizStep ? 'on' : ''; });
    el.wizBack.textContent = state.wizStep === 0 ? 'Cancel' : '← Back';
    el.wizNext.textContent = state.wizStep === 2 ? 'See my trails →' : 'Next →';
    var body = '';
    if (state.wizStep === 0) {
      body = '<label class="hp-wiz-q" for="hpWizName">Your dog’s name</label>' +
        '<input class="hp-wiz-input" id="hpWizName" type="text" placeholder="e.g. Rufus" value="' + esc(w.name) + '">' +
        '<div class="hp-wiz-q">How big are they?</div>' + optBtns(SIZE_OPTS, w.size, 'size', false);
    } else if (state.wizStep === 1) {
      body = '<div class="hp-wiz-q">Energy level</div>' + optBtns(ENERGY_OPTS, w.energy, 'energy', false) +
        '<div class="hp-wiz-q">What can their paws handle?</div>' + optBtns(TERRAINTOL_OPTS, w.terrainTol, 'terrainTol', true);
    } else {
      body = '<div class="hp-wiz-q">Do they struggle in the heat?</div>' + optBtns(HEAT_OPTS, w.heat, 'heat', true) +
        '<div class="hp-wiz-summary"><div class="hp-wiz-summary-h">Profile summary</div>' +
        summaryRow('Name', (w.name || '').trim() || 'Your dog') +
        summaryRow('Size', cap(w.size)) +
        summaryRow('Energy', cap(w.energy) + ' energy') +
        summaryRow('Terrain', { soft: 'Soft ground only', gravel: 'Some gravel OK', any: 'Any terrain' }[w.terrainTol]) +
        summaryRow('Heat', w.heat ? 'Heat-sensitive' : 'Handles heat fine') +
        '</div>';
    }
    el.wizBody.innerHTML = body;
    var nameInput = document.getElementById('hpWizName');
    if (nameInput) nameInput.addEventListener('input', function (e) { state.wiz.name = e.target.value; });
  }
  function summaryRow(k, v) { return '<div class="hp-wiz-summary-row"><span>' + k + '</span><b>' + esc(v) + '</b></div>'; }

  function openWizard() { state.wizOpen = true; state.wizStep = 0; el.wizard.hidden = false; document.body.classList.add('auth-modal-open'); renderWizard(); }
  function closeWizard() { state.wizOpen = false; el.wizard.hidden = true; document.body.classList.remove('auth-modal-open'); }

  // Build the SAME profile shape dog-wizard.js:buildProfile() produces, so a
  // later login persists it with zero translation.
  var SIZE_WEIGHT = { small: '5-10', medium: '15-20', large: '30-40' };
  var ENERGY_FITNESS = { low: 'low', medium: 'moderate', high: 'high' };
  function buildCustomProfile() {
    var w = state.wiz;
    var conditions = w.heat ? ['heat'] : [];
    return {
      name: (w.name || '').trim() || 'Your dog',
      breed: '',
      fitness: ENERGY_FITNESS[w.energy] || 'moderate',
      dob: null, ageBand: null,
      weightBand: SIZE_WEIGHT[w.size] || '15-20',
      conditions: conditions,
      healthNotes: '',
      jointIssues: false,
      heatIssues: w.heat,
    };
  }

  function finishWizard() {
    var profile = buildCustomProfile();
    try { localStorage.setItem('dolopaws-pending-dog-profile', JSON.stringify(profile)); } catch (e) {}
    state.custom = {
      profile: profile,
      meta: {
        key: 'custom', name: profile.name, emoji: '⭐',
        sub: cap(state.wiz.size) + ' · ' + state.wiz.energy + ' energy' + (state.wiz.heat ? ' · heat-sensitive' : ''),
        badge: profile.name.charAt(0).toUpperCase(), chipBg: 'var(--ink)', chipColor: '#fff',
      },
    };
    state.dog = 'custom';
    // Reset the browse view to the personalised collection.
    state.searched = false; state.query = ''; state.dist = 99; state.shade = 'any'; state.terrain = 'any';
    if (el.search) el.search.value = '';
    closeWizard();
    renderAll();
  }

  // ---- events ----
  function bind() {
    el.search.addEventListener('input', function (e) { state.query = e.target.value; state.searched = true; renderContent(); });
    el.search.addEventListener('keydown', function (e) { if (e.key === 'Enter') { state.searched = true; closeMenus(); renderContent(); } });
    el.searchBtn.addEventListener('click', function () { state.searched = true; closeMenus(); renderContent(); });

    el.dogPill.addEventListener('click', function () { state.menu = state.menu === 'dog' ? null : 'dog'; syncMenus(); });
    el.distBtn.addEventListener('click', function () { state.menu = state.menu === 'dist' ? null : 'dist'; syncMenus(); });
    el.shadeBtn.addEventListener('click', function () { state.menu = state.menu === 'shade' ? null : 'shade'; syncMenus(); });
    el.terrainBtn.addEventListener('click', function () { state.menu = state.menu === 'terrain' ? null : 'terrain'; syncMenus(); });

    el.dogOptions.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dog]'); if (!b) return;
      state.dog = b.getAttribute('data-dog'); closeMenus(); renderAll();
    });

    [el.distMenu, el.shadeMenu, el.terrainMenu].forEach(function (menu) {
      menu.addEventListener('click', function (e) {
        var b = e.target.closest('[data-kind]'); if (!b) return;
        var kind = b.getAttribute('data-kind'), val = b.getAttribute('data-val');
        if (kind === 'dist') state.dist = parseInt(val, 10);
        else if (kind === 'shade') state.shade = val;
        else if (kind === 'terrain') state.terrain = val;
        state.searched = true; closeMenus();
        renderFilterMenu(el.distMenu, DIST_OPTS, state.dist, 'dist');
        renderFilterMenu(el.shadeMenu, SHADE_OPTS, state.shade, 'shade');
        renderFilterMenu(el.terrainMenu, TERRAIN_OPTS, state.terrain, 'terrain');
        renderFilters(); renderContent();
      });
    });

    el.popular.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pop]'); if (!b) return;
      POPULAR[parseInt(b.getAttribute('data-pop'), 10)].apply();
      if (el.search) el.search.value = state.query;
      closeMenus();
      renderFilterMenu(el.distMenu, DIST_OPTS, state.dist, 'dist');
      renderFilterMenu(el.shadeMenu, SHADE_OPTS, state.shade, 'shade');
      renderFilters(); renderContent();
    });

    el.content.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-href]');
      if (nav) { window.location.href = nav.getAttribute('data-href'); return; }
      var act = e.target.closest('[data-action]');
      if (!act) return;
      var a = act.getAttribute('data-action');
      if (a === 'clear') { state.query = ''; state.searched = false; state.dist = 99; state.shade = 'any'; state.terrain = 'any'; if (el.search) el.search.value = ''; }
      else if (a === 'reset') { state.dist = 99; state.shade = 'any'; state.terrain = 'any'; }
      renderFilterMenu(el.distMenu, DIST_OPTS, state.dist, 'dist');
      renderFilterMenu(el.shadeMenu, SHADE_OPTS, state.shade, 'shade');
      renderFilterMenu(el.terrainMenu, TERRAIN_OPTS, state.terrain, 'terrain');
      renderFilters(); renderContent();
    });

    el.guestCta.addEventListener('click', function () {
      if (state.dog === 'custom' && window.DoloPawsAuthUI) window.DoloPawsAuthUI.openSignup();
      else openWizard();
    });

    // Mini-wizard
    el.wizClose.addEventListener('click', closeWizard);
    el.wizard.addEventListener('click', function (e) { if (e.target === el.wizard) closeWizard(); });
    el.wizBack.addEventListener('click', function () { if (state.wizStep === 0) closeWizard(); else { state.wizStep--; renderWizard(); } });
    el.wizNext.addEventListener('click', function () { if (state.wizStep < 2) { state.wizStep++; renderWizard(); } else finishWizard(); });
    el.wizBody.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wfield]'); if (!b) return;
      var field = b.getAttribute('data-wfield'), val = b.getAttribute('data-wval');
      if (field === 'heat') state.wiz.heat = (val === 'true');
      else state.wiz[field] = val;
      renderWizard();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (state.wizOpen) closeWizard(); else if (state.menu) closeMenus(); }
    });
  }

  function init() {
    if (!ready()) return;
    setupStatic();
    bind();
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
