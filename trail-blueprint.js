/**
 * trail-blueprint.js — the "answer-first" layer of the trail page.
 *
 * Fills the new blueprint sections WITHOUT touching trail.js logic:
 *   - Verified/Imported seal in the hero
 *   - Answer strip: "Right for your dog?" · "Today?" · "Getting there"
 *   - Nearby trails (same valley, via regions-config)
 *
 * Everything is derived from data that already exists (trail fields,
 * the live weather chip trail.js populates, the same scoreTrail() the
 * hero match uses). Nothing is invented. Load AFTER trail.js.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const trailId = params.get('id');
  const t = (typeof trails !== 'undefined') ? trails.find(x => x.id === trailId) : null;
  if (!t) return;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const tt = (key, vars, fallback) => {
    const out = (typeof window.t === 'function') ? window.t(key, vars) : null;
    return (out && out !== key) ? out : fallback;
  };

  /* ---- Verified / Imported seal in the hero ---------------------- */
  (function seal() {
    const el = $('verifiedSeal');
    if (!el) return;
    if (t.curated === false) {
      el.textContent = tt('badge.importedS', null, 'Imported');
      el.style.background = '#e0f2f1';
      el.style.color = '#00695c';
    } else {
      el.innerHTML = '🐾 ' + tt('trail.verifiedShort', null, 'Verified by DoloPaws');
    }
    el.hidden = false;
  })();

  /* ---- Answer strip ---------------------------------------------- */
  const strip = $('qaStrip');
  if (strip) strip.hidden = false;

  // Card 1 — Right for your dog? Three honest states.
  function paintDogCard() {
    const title = $('qaDogTitle'), sub = $('qaDogSub');
    if (!title || !sub) return;

    const factBits = [];
    if (t.safetyLevel) factBits.push(safetyLabel(t.safetyLevel).toLowerCase() + ' terrain');
    if (typeof t.distance === 'number') factBits.push(t.distance <= 6 ? 'easy distance' : `${t.distance} km`);
    if (typeof t.shadeCoverage === 'number') factBits.push(t.shadeCoverage >= 40 ? 'good shade' : 'little shade');
    const factLine = factBits.join(' · ');

    function guest() {
      title.textContent = tt('qa.dogGuest', null, 'Would this suit your dog?');
      sub.innerHTML = esc(factLine) + (factLine ? ' — ' : '') +
        '<a href="account.html">' + tt('qa.dogGuestCta', null, 'create a free profile to find out') + ' →</a>';
    }
    function noProfile() {
      title.textContent = tt('qa.dogNoProfile', null, 'Whose paws are we scoring?');
      sub.innerHTML = '<a href="account.html">' + tt('qa.dogNoProfileCta', null, 'Add your dog — 2 minutes') + ' →</a>';
    }
    function paint() {
      if (typeof scoreTrail !== 'function' || !window.DoloPawsAuth || !window.DoloPawsAuth.currentUser) { guest(); return; }
      window.DoloPawsAuth.getDogProfile().then(profile => {
        if (!profile) { noProfile(); return; }
        const n = scoreTrail(t, (typeof effectiveOverrides === 'function') ? effectiveOverrides(profile, null) : profile);
        const name = profile.name || tt('trail.yourDog', null, 'your dog');
        const approx = t.curated === false ? '≈' : '';
        title.textContent = tt('qa.dogScored', { n: approx + n, name },
          `Right for ${name}? ${approx}${n}%`);
        sub.textContent = factLine;
      }).catch(guest);
    }
    if (window.DoloPawsAuth) paint();
    else window.addEventListener('dolopaws-auth-ready', paint, { once: true });
    window.addEventListener('dolopaws-auth-changed', paint);
  }
  paintDogCard();

  // Card 2 — Today. Mirrors the weather chip trail.js fills (no second
  // API call); adds an early-start hint only when the data justifies it.
  (function paintTodayCard() {
    const card = $('qaToday'), title = $('qaTodayTitle'), sub = $('qaTodaySub');
    const chip = $('weatherChip');
    if (!card || !chip) return;
    function sync() {
      const txt = chip.textContent.trim();
      if (!txt) return;
      title.textContent = tt('qa.todayTitle', null, 'Today at the trailhead');
      let hint = '';
      if (t.heatRisk === 'high') hint = ' · ' + tt('qa.todayHeatHint', null, 'exposed route — start early');
      else if (t.heatRisk === 'moderate') hint = ' · ' + tt('qa.todayShadeHint', null, 'some exposed stretches');
      sub.textContent = txt + hint;
      card.hidden = false;
      chip.hidden = true; // the card replaces the floating chip
    }
    new MutationObserver(sync).observe(chip, { childList: true, characterData: true, subtree: true });
    if (chip.textContent.trim()) sync();
  })();

  // Card 3 — Getting there. Start point label + directions link.
  (function paintAccessCard() {
    const card = $('qaAccess'), title = $('qaAccessTitle'), sub = $('qaAccessSub');
    if (!card) return;
    const sp = t.startPoint || {};
    const lat = typeof sp.lat === 'number' ? sp.lat : t.lat;
    const lng = typeof sp.lng === 'number' ? sp.lng : t.lng;
    if (typeof lat !== 'number') return;
    title.textContent = tt('qa.accessTitle', null, 'Getting there');
    const label = sp.label ? esc(sp.label) : tt('trail.itinParkFallback', null, 'Trailhead');
    sub.innerHTML = label +
      ` — <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">` +
      tt('trail.openMaps', null, 'get directions') + ' →</a>';
    card.hidden = false;
  })();

  /* ---- Nearby trails (same valley first, then same region) ------- */
  (function nearby() {
    const wrapEl = $('nearbyTrails'), grid = $('nearbyGrid');
    if (!wrapEl || !grid || typeof trails === 'undefined') return;
    const pool = trails.filter(o => o.id !== t.id);
    const sameValley = pool.filter(o => o.valley && o.valley === t.valley);
    const sameRegion = pool.filter(o => o.region === t.region && o.valley !== t.valley);
    const picks = sameValley.slice(0, 4);
    for (const o of sameRegion) { if (picks.length >= 4) break; picks.push(o); }
    if (!picks.length) return;
    grid.innerHTML = picks.map(o => `
      <a class="near-card" href="trail.html?id=${encodeURIComponent(o.id)}">
        <b>${esc(o.name)}</b>
        <span><span class="safety-badge ${safetyClass(o.safetyLevel)}" style="font-size:10.5px;padding:1px 8px;">${safetyLabel(o.safetyLevel)}</span> ${o.distance} km${o.hours ? ' · ' + esc(o.hours) + ' h' : ''}</span>
      </a>`).join('');
    wrapEl.hidden = false;
  })();

  /* ---- Dog tips note (verified trails only) ----------------------- */
  (function tipsNote() {
    const note = $('dogTipsNote');
    if (note && t.curated !== false && t.tips) note.hidden = false;
  })();

  /* ---- Decision-first hero and safety dashboard ------------------ */
  (function decisionFlow() {
    const hero = document.querySelector('.trail-decision-hero');
    if (hero && t.imageIcon) hero.style.backgroundImage = `url("${String(t.imageIcon).replace(/["')]/g, '')}")`;

    const easyTerrain = Number(t.terrainRank) === 0;
    const goodShade = Number(t.shadeCoverage) >= 40;
    const hasWater = Array.isArray(t.waterSources) && t.waterSources.length > 0;
    const lowRisk = t.safetyLevel === 'low-risk';
    const duration = t.hours ? `${t.hours} h` : 'Not listed';
    const signals = [
      { icon:'↗', title:'Effort', value:`${t.distance} km · ${duration}`, good:Number(t.distance) <= 8 },
      { icon:'⌁', title:'Paw terrain', value:t.terrainType || 'Mixed trail', good:easyTerrain },
      { icon:'◒', title:'Shade', value:`${Number(t.shadeCoverage) || 0}% of the route`, good:goodShade },
      { icon:'♒', title:'Water', value:hasWater ? `${t.waterSources.length} source${t.waterSources.length === 1 ? '' : 's'} on route` : 'Carry all water', good:hasWater },
    ];
    const decisionEl = $('decisionSignals');
    if (decisionEl) decisionEl.innerHTML = signals.map(s => `
      <div class="decision-signal ${s.good ? 'good' : 'watch'}">
        <span class="signal-icon" aria-hidden="true">${s.icon}</span><b>${s.title}</b><span>${esc(s.value)}</span>
      </div>`).join('');

    const verdict = lowRisk && easyTerrain
      ? 'A gentle, low-risk choice for most dogs, with the usual checks for heat and crowds.'
      : t.safetyLevel === 'caution'
        ? 'A more demanding trail: check the hazards and your dog’s confidence before committing.'
        : 'A manageable trail for prepared dogs; review the terrain and conditions before setting off.';
    const heroVerdict = $('heroVerdict');
    const overviewSummary = $('trailOverviewSummary');
    if (heroVerdict) heroVerdict.textContent = verdict;
    if (overviewSummary) overviewSummary.textContent = lowRisk ? 'The essentials look positive — check today’s conditions below.' : 'Review the amber signals before deciding.';

    const safetyItems = [
      ['Paw risk', easyTerrain ? 'Low' : (Number(t.terrainRank) >= 2 ? 'High' : 'Moderate')],
      ['Heat risk', t.heatRisk ? t.heatRisk[0].toUpperCase() + t.heatRisk.slice(1) : 'Unknown'],
      ['Water', hasWater ? 'Available' : 'None listed'],
      ['Exposure', t.exposure ? 'Exposed sections' : 'Low'],
    ];
    const safetyEl = $('dogSafetySignals');
    if (safetyEl) safetyEl.innerHTML = safetyItems.map(([label,value]) =>
      `<div class="dog-safety-signal"><b>${esc(label)}</b><span>${esc(value)}</span></div>`).join('');
    const safetyVerdict = $('dogSafetyVerdict');
    if (safetyVerdict) safetyVerdict.textContent = safetyLabel(t.safetyLevel);
    const why = $('dogSafetyWhy');
    if (why) why.textContent = t.tips || (lowRisk ? 'Straightforward underpaw, with no major trail hazards listed.' : 'Match the terrain and distance to your dog’s experience.');

    document.querySelectorAll('.trail-section-nav a').forEach(a => {
      a.addEventListener('click', () => {
        document.querySelectorAll('.trail-section-nav a').forEach(other => other.classList.remove('active'));
        a.classList.add('active');
      });
    });
  })();
})();
