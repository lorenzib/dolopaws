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
  // The personalised match below now carries the decision context, so these
  // older answer cards stay out of the visual flow.
  if (strip) strip.hidden = true;

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
    const verdict = lowRisk && easyTerrain
      ? 'A gentle, low-risk choice for most dogs, with the usual checks for heat and crowds.'
      : t.safetyLevel === 'caution'
        ? 'A more demanding trail: check the hazards and your dog’s confidence before committing.'
        : 'A manageable trail for prepared dogs; review the terrain and conditions before setting off.';
    const heroVerdict = $('heroVerdict');
    if (heroVerdict) heroVerdict.textContent = verdict;

    const svg = (kind) => {
      const paths = {
        paw: '<circle cx="8" cy="8.2" r="1.6" fill="#5DCAA5"/><circle cx="12" cy="6.6" r="1.6" fill="#5DCAA5"/><circle cx="16" cy="8.2" r="1.6" fill="#5DCAA5"/><path d="M8.4 16.5c0-2.4 1.5-4.2 3.6-4.2s3.6 1.8 3.6 4.2c0 1.4-1.1 2.5-2.5 2.5-.7 0-1.1-.3-1.7-.7-.5.4-1 .7-1.7.7-1.3 0-2.3-1.1-2.3-2.5Z" fill="#1D9E75"/>',
        shade: '<path d="M12 5v14M7 19h10M6 12c0-3 2.7-6 6-6s6 3 6 6Z" fill="none" stroke="#4A7856" stroke-width="1.8"/><path d="m7 12-3 3M17 12l3 3" fill="none" stroke="#4A7856" stroke-width="1.8"/>',
        water: '<path d="M12 4c2.8 3.4 4.5 6 4.5 8.4a4.5 4.5 0 1 1-9 0C7.5 10 9.2 7.4 12 4Z" fill="#378ADD"/>',
        heat: '<circle cx="12" cy="12" r="4" fill="#D6A038"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" fill="none" stroke="#D6A038" stroke-width="1.8" stroke-linecap="round"/>',
        park: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5" fill="#fff" stroke="#4C87C6" stroke-width="1.6"/><path d="M10 16.2V7.8h3.1a2.6 2.6 0 0 1 0 5.2H10" fill="none" stroke="#4C87C6" stroke-width="1.9" stroke-linecap="round"/>',
        route: '<path d="M6 18c2-5 5.5-9 12-12" fill="none" stroke="#2C5C34" stroke-width="2" stroke-linecap="round"/><circle cx="7" cy="18" r="1.7" fill="#2C5C34"/><path d="M17.5 4.2l2.6 1-1 2.5-2.6-1z" fill="#E24B4A"/>',
        crowd: '<ellipse cx="5" cy="8" rx="2.5" ry="4.5" fill="#8B6F47" transform="rotate(-20 5 8)"/><ellipse cx="19" cy="8" rx="2.5" ry="4.5" fill="#8B6F47" transform="rotate(20 19 8)"/><circle cx="12" cy="14" r="7" fill="#8B6F47"/><ellipse cx="12" cy="16" rx="4" ry="3" fill="#A08060"/><circle cx="9.5" cy="12" r="1.2" fill="#3D2817"/><circle cx="9.8" cy="11.5" r="0.4" fill="#fff"/><circle cx="14.5" cy="12" r="1.2" fill="#3D2817"/><circle cx="14.8" cy="11.5" r="0.4" fill="#fff"/><circle cx="12" cy="16" r="1" fill="#3D2817"/><path d="M12 17 Q11 18 10 17.5" fill="none" stroke="#3D2817" stroke-width="0.8" stroke-linecap="round"/><path d="M12 17 Q13 18 14 17.5" fill="none" stroke="#3D2817" stroke-width="0.8" stroke-linecap="round"/>',
        mountain: '<path d="m4 18 6-10 3 5 2-3 5 8Z" fill="none" stroke="#BA7517" stroke-width="1.8" stroke-linejoin="round"/>',
        loop: '<path d="M18 8a7 7 0 1 0 1 7M18 4v4h-4" fill="none" stroke="#3E7A91" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'
      };
      return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
    };
    const signalEl = $('matchSignals');
    const isLoop = Array.isArray(t.path) && t.path.length > 1 && distMeters(t.path[0], t.path[t.path.length-1]) < 200;
    const maxAltitude = Math.max(...(t.elevationProfile || []).map(p => p.elev || 0));
    const signalData = [];
    signalData.push(['paw', 'Easy paws', easyTerrain ? 'Flat, packed surface' : (t.terrainType || 'Mixed trail')]);
    if (typeof t.shadeCoverage === 'number' && t.shadeCoverage > 0) {
      signalData.push(['shade', 'Good shade', `${Number(t.shadeCoverage)}% of the route`]);
    }
    signalData.push(['water', hasWater ? 'Water available' : 'Carry water', hasWater ? 'At the trailhead' : 'No source mapped']);
    signalData.push(['heat', `${t.heatRisk === 'low' ? 'Low' : t.heatRisk === 'high' ? 'High' : 'Moderate'} heat risk`, t.heatRisk === 'low' ? 'Start before midday' : 'Check the forecast']);
    if (isLoop) {
      signalData.push(['loop', 'Loop route', `${t.distance} km back to parking`]);
    }
    if (maxAltitude > 0) {
      signalData.push(['mountain', `${maxAltitude} m altitude`, 'Weather can change quickly']);
    }
    if (signalEl) {
      signalEl.innerHTML = signalData.map(([icon, title, sub]) =>
        `<div class="match-signal">${svg(icon)}<span><b>${esc(title)}</b><small>${esc(sub)}</small></span></div>`).join('');
    }

    // Assessment note ABOVE the box, below the heading
    const assessmentNote = $('assessmentNote');
    if (assessmentNote) {
      assessmentNote.innerHTML = `<strong style="color: var(--ink);">Our assessment of this trail, based on the DoloPaws method:</strong> we weigh verified terrain, water availability, elevation and shade against your dog's profile to produce the personalised match above.`;
    }

    const advice = $('matchAdvice');
    if (advice && t.tips) {
      const sentences = String(t.tips).replace(/^Tip:\s*/i, '').match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
      const cleaned = sentences.map(sentence => sentence.trim());
      const dogNotes = Array.from(new Set([
        /dog|leash|livestock|patou|swim/i,
        /water|fountain|drink/i,
        /heat|hot|shade|rain|road|traffic|crowd|slippery/i,
      ].map(pattern => cleaned.find(sentence => pattern.test(sentence))).filter(Boolean)));
      const notes = dogNotes.length ? dogNotes : sentences.slice(0, 2).map(sentence => sentence.trim());
      const concise = note => note.length > 155 ? `${note.slice(0, 152).trimEnd()}…` : note;
      advice.innerHTML = `${svg('crowd')}<span><b>Best advice for your dog</b><ul>${notes.map(note => `<li>${esc(concise(note))}</li>`).join('')}</ul></span>`;
      advice.hidden = false;
    }

    const sp = t.startPoint || {};
    const lat = typeof sp.lat === 'number' ? sp.lat : t.lat;
    const lng = typeof sp.lng === 'number' ? sp.lng : t.lng;
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const directionsUrl = isApple ? `https://maps.apple.com/?daddr=${lat},${lng}` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const startBtn = $('startNavigationBtn');
    if (startBtn) {
      startBtn.addEventListener('click', (event) => {
        const mapStart = $('mapStartHikeBtn');
        if (!mapStart) return;
        event.preventDefault();
        mapStart.click();
      });
    }
    const directionsBtn = $('getDirectionsBtn');
    if (directionsBtn && typeof lat === 'number') {
      directionsBtn.href = directionsUrl;
      directionsBtn.target = '_blank';
      directionsBtn.rel = 'noopener';
    }

    const aboutFacts = $('aboutFacts');
    if (false && aboutFacts) {
      const facts = [
        ['paw', 'Comfortable underpaw', easyTerrain ? 'Paved and packed-gravel surfaces' : (t.terrainType || 'Mixed trail')],
        ['water', hasWater ? 'Water at the trailhead' : 'Bring water', hasWater ? 'Fill up before joining the route' : 'No source is listed on this route'],
        ['loop', 'Loop route', Array.isArray(t.path) && t.path.length > 1 && distMeters(t.path[0], t.path[t.path.length-1]) < 200 ? `${t.distance} km — back to the same parking area` : 'Check your return transport'],
        ['mountain', `${Math.max(...(t.elevationProfile || [{ elev: 0 }]).map(p => p.elev))} m altitude`, 'Mountain weather can change quickly'],
      ];
      aboutFacts.innerHTML = facts.map(([icon, title, sub]) => `<div class="about-fact">${svg(icon)}<span><b>${esc(title)}</b><small>${esc(sub)}</small></span></div>`).join('');
      
      // Add loop callout if it's a loop
      const isLoop = Array.isArray(t.path) && t.path.length > 1 && distMeters(t.path[0], t.path[t.path.length-1]) < 200;
      if (isLoop && $('loopCallout')) {
        if ($('loopCallout')) {
        $('loopCallout').innerHTML = `<div class="loop-callout" style="display: flex; gap: 8px; align-items: center; padding: 8px 10px; background: var(--sage-dim); border-radius: 8px; margin-bottom: 16px; border-left: 3px solid var(--success); font-size: 11px;">
          <svg style="width: 14px; height: 14px; flex: none; color: var(--success);" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a7 7 0 1 0 1 7M18 4v4h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div style="color: var(--ink);"><b style="display: block; line-height: 1.2;">Loop</b><span style="color: var(--ink-soft); font-size: 10px;">${t.distance} km</span></div>
        </div>`;
      }
      }
    }

    const avatar = $('matchDogAvatar');
    const matchTitle = $('personalMatchTitle');
    const matchSummary = $('matchSummary');
    const personalScore = $('personalScore');
    const fallbackPaw = svg('paw');
    if (avatar) avatar.innerHTML = fallbackPaw;
    function paintPersonalMatch() {
      if (typeof scoreTrail !== 'function' || !window.DoloPawsAuth || !window.DoloPawsAuth.currentUser) return;
      window.DoloPawsAuth.getDogProfile().then(profile => {
        if (!profile) return;
        const name = profile.name || 'your dog';
        const score = scoreTrail(t, typeof effectiveOverrides === 'function' ? effectiveOverrides(profile, null) : profile);
        if (matchTitle) matchTitle.textContent = `A great match for ${name}`;
        if (matchSummary) matchSummary.textContent = `This ${t.distance} km trail suits ${name}'s profile, age and walking experience.`;
        if (personalScore) { personalScore.innerHTML = `<b>${t.curated === false ? '≈' : ''}${score}%</b><span>Excellent match</span>`; personalScore.hidden = false; }
        if (avatar && profile.photo) avatar.innerHTML = `<img src="${esc(profile.photo)}" alt="${esc(name)}">`;
      }).catch(() => {});
    }
    if (window.DoloPawsAuth) paintPersonalMatch();
    else window.addEventListener('dolopaws-auth-ready', paintPersonalMatch, { once: true });
    window.addEventListener('dolopaws-auth-changed', paintPersonalMatch);

    // Trail description inside the white box
    const descEl = $('matchDescription');
    if (descEl && t.desc) {
      descEl.textContent = String(t.desc).trim();
    }
    
    document.querySelectorAll('.trail-section-nav a').forEach(a => {
      a.addEventListener('click', () => {
        document.querySelectorAll('.trail-section-nav a').forEach(other => other.classList.remove('active'));
        a.classList.add('active');
      });
    });
  })();
})();
