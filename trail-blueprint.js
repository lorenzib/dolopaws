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
      sub.innerHTML = esc(factLine) + (factLine ? ' · ' : '') +
        '<a href="account.html">' + tt('qa.dogGuestCta', null, 'create a free profile to find out') + ' →</a>';
    }
    function noProfile() {
      title.textContent = tt('qa.dogNoProfile', null, 'Whose paws are we scoring?');
      sub.innerHTML = '<a href="account.html">' + tt('qa.dogNoProfileCta', null, 'Add your dog, 2 minutes') + ' →</a>';
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
      if (t.heatRisk === 'high') hint = ' · ' + tt('qa.todayHeatHint', null, 'exposed route, start early');
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
      ` · <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">` +
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
      <a class="near-card" href="trail.html?id=${encodeURIComponent(o.id)}" data-near-id="${esc(o.id)}">
        <b>${esc(o.name)}</b>
        <span><span class="safety-badge ${safetyClass(o.safetyLevel)}" style="font-size:10.5px;padding:1px 8px;">${safetyLabel(o.safetyLevel)}</span> ${o.distance} km${o.hours ? ' · ' + esc(o.hours) + ' h' : ''}<span class="near-pct"></span></span>
      </a>`).join('');
    wrapEl.hidden = false;

    // Personalise: when a dog profile exists, retitle the section and add
    // each pick's real match % — same scoreTrail() as everywhere else.
    function personalise() {
      if (typeof scoreTrail !== 'function' || !window.DoloPawsAuth || !window.DoloPawsAuth.currentUser) return;
      window.DoloPawsAuth.getDogProfile().then(profile => {
        if (!profile) return;
        const heading = wrapEl.querySelector('h2');
        if (heading && profile.name) heading.textContent = tt('trail.similarFor', { name: profile.name }, 'Similar trails for ' + profile.name);
        const ov = (typeof effectiveOverrides === 'function') ? effectiveOverrides(profile, null) : profile;
        for (const o of picks) {
          const slot = grid.querySelector(`[data-near-id="${CSS.escape(o.id)}"] .near-pct`);
          if (!slot) continue;
          const n = scoreTrail(o, ov);
          slot.textContent = ' · ' + (o.curated === false ? '≈' : '') + n + '% match';
          slot.style.fontWeight = '700';
          slot.style.color = n >= 70 ? 'var(--success)' : 'var(--ink-soft)';
        }
      }).catch(() => {});
    }
    if (window.DoloPawsAuth) personalise();
    else window.addEventListener('dolopaws-auth-ready', personalise, { once: true });
    window.addEventListener('dolopaws-auth-changed', personalise);
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

    // Share: native share sheet where available, copy-link fallback with
    // an inline confirmation. No third-party share widgets.
    const shareBtn = $('detailShareBtn');
    if (shareBtn) {
      const shareUrl = location.origin + location.pathname + '?id=' + encodeURIComponent(t.id);
      shareBtn.addEventListener('click', async () => {
        if (navigator.share) {
          try { await navigator.share({ title: t.name + ' | DoloPaws', url: shareUrl }); return; }
          catch (e) { if (e && e.name === 'AbortError') return; }
        }
        try {
          await navigator.clipboard.writeText(shareUrl);
          const prev = shareBtn.textContent;
          shareBtn.textContent = '✓ Link copied';
          setTimeout(() => { shareBtn.textContent = prev; }, 1800);
        } catch (e) {
          window.prompt(tt('trail.copyLink', null, 'Copy this link'), shareUrl);
        }
      });
    }

    const aboutFacts = $('aboutFacts');
    if (false && aboutFacts) {
      const facts = [
        ['paw', 'Comfortable underpaw', easyTerrain ? 'Paved and packed-gravel surfaces' : (t.terrainType || 'Mixed trail')],
        ['water', hasWater ? 'Water at the trailhead' : 'Bring water', hasWater ? 'Fill up before joining the route' : 'No source is listed on this route'],
        ['loop', 'Loop route', Array.isArray(t.path) && t.path.length > 1 && distMeters(t.path[0], t.path[t.path.length-1]) < 200 ? `${t.distance} km, back to the same parking area` : 'Check your return transport'],
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

    // Contextual safety guides — shown ONLY when the trail data warrants it
    (function relevantGuides() {
      const box = $('trailGuideLinks');
      if (!box) return;
      const text = `${t.tips || ''} ${t.desc || ''} ${(t.startPoint && t.startPoint.label) || ''} ${(t.surfaceHazards || []).join(' ')}`.toLowerCase();
      const maxAlt = Math.max(...(t.elevationProfile || []).map(p => Number(p.elev) || 0));
      const shade = typeof t.shadeCoverage === 'number' ? t.shadeCoverage : null;
      const hasWaterSrc = Array.isArray(t.waterSources) && t.waterSources.length > 0;
      const guides = [];

      // Livestock — alpage/pasture/herd/cattle/patou/guardian
      if (/livestock|patou|guardian|cattle|herd|pasture|alpage|graz/.test(text)) {
        guides.push(['🐄', 'Meeting livestock and guardian dogs', 'guides/livestock-guard-dogs.html']);
      }
      // Cable car — gondola/lift/cable/cableway nearby or in text
      if (/gondola|cable car|cableway|lift station|chairlift|funicular/.test(text)) {
        guides.push(['🚠', 'Dogs on cable cars', 'guides/dogs-on-cable-cars.html']);
      }
      // Heat / exposure — exposed route OR high heat risk OR little shade
      if (t.exposure === true || t.heatRisk === 'high' || (shade !== null && shade < 25)) {
        guides.push(['☀️', 'Heat and exposure with your dog', 'safety-guide.html#heat']);
      }
      // Altitude — high trailhead/summit
      if (maxAlt >= 1800) {
        guides.push(['⛰️', 'Hiking at altitude', 'safety-guide.html#altitude']);
      }
      // Water — none mapped, or long route
      if (!hasWaterSrc || Number(t.distance) >= 8) {
        guides.push(['💧', 'Water for dogs on trail', 'guides/water-for-dogs-on-trail.html']);
      }
      // Rifugi — route passes huts
      if (Array.isArray(t.rifugi) && t.rifugi.length) {
        guides.push(['🏡', 'Dogs at rifugi', 'guides/dogs-at-rifugi.html']);
      }

      if (!guides.length) return;
      box.innerHTML = `<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--paper-line);">
        <div style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Read before you go</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">${guides.slice(0,4).map(([icon,label,href]) =>
          `<a href="${href}" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:var(--sage-dim);border:1px solid var(--paper-line);border-radius:999px;font-size:12px;font-weight:600;color:var(--ink);text-decoration:none;">${icon} ${esc(label)}</a>`).join('')}</div>
      </div>`;
      box.hidden = false;
    })();

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
        // Honest tiering: the headline and label follow the actual score
        // instead of calling everything a great match.
        const tier = score >= 85 ? ['A great match for', 'Excellent match']
          : score >= 70 ? ['A good match for', 'Good match']
          : score >= 50 ? ['A fair match for', 'Fair match']
          : ['A tough match for', 'Demanding today'];
        if (matchTitle) matchTitle.textContent = `${tier[0]} ${name}`;
        if (matchSummary) matchSummary.textContent = score >= 70
          ? `This ${t.distance} km trail suits ${name}'s profile, age and walking experience.`
          : `This ${t.distance} km trail asks more of ${name}'s profile. Check the notes below before committing.`;
        if (personalScore) {
          const ringColor = score >= 70 ? 'var(--success)' : score >= 50 ? '#8A5A16' : '#9C3A25';
          personalScore.innerHTML =
            `<div class="tc-ring" style="background:conic-gradient(${ringColor} ${Math.round((score / 100) * 360)}deg,var(--paper-line) 0);">` +
            `<div class="tc-ring-inner">${t.curated === false ? '≈' : ''}${score}%</div></div>` +
            `<span class="tc-ring-label">${esc(tier[1]).toUpperCase()}</span>`;
          personalScore.hidden = false;
        }
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
    
    // In-page tabs: Overview / Dog safety / Reviews & photos.
    const tabsNav = $('trailTabsNav');
    if (tabsNav) {
      const panelIds = ['tabOverview', 'tabSafety', 'tabReviews'];
      tabsNav.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          tabsNav.querySelectorAll('[data-tab]').forEach(b => {
            const on = b === btn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          panelIds.forEach(id => { const p = $(id); if (p) p.hidden = id !== btn.dataset.tab; });
        });
      });
    }
  })();

  /* ---- Dog safety tab: Good/Caution rows from real trail fields ---- */
  (function safetyRows() {
    const box = $('dogSafetyRows');
    if (!box) return;
    const text = `${t.tips || ''} ${t.desc || ''} ${(t.surfaceHazards || []).join(' ')}`.toLowerCase();
    const hasWater = Array.isArray(t.waterSources) && t.waterSources.length > 0;
    const shade = typeof t.shadeCoverage === 'number' ? t.shadeCoverage : null;
    const maxAlt = Math.max(0, ...(t.elevationProfile || []).map(p => Number(p.elev) || 0));
    const rows = [];
    const good = (title, sub) => rows.push({ ok: true, title, sub });
    const caution = (title, sub) => rows.push({ ok: false, title, sub });

    hasWater
      ? good('Water', 'A water source is mapped on this route. Bring a bowl.')
      : caution('Water', 'No water source is mapped. Carry enough for the dog, roughly 0.5 l per 10 kg on a warm day.');
    if (shade !== null) {
      shade >= 40
        ? good('Shade', `About ${shade}% of the route has meaningful shade.`)
        : caution('Shade', `Only about ${shade}% of the route is shaded. Start early on warm days.`);
    }
    if (t.heatRisk) {
      t.heatRisk === 'low'
        ? good('Heat', 'Low heat risk for the area and aspect.')
        : caution('Heat', t.heatRisk === 'high' ? 'High heat risk: exposed or south-facing. Early start strongly advised.' : 'Moderate heat risk: plan water and rest stops.');
    }
    Number(t.terrainRank) === 0
      ? good('Paw surface', 'Paved or packed surfaces, easy on pads.')
      : caution('Paw surface', (t.terrainType || 'Gravel and mixed rock') + '. Check pads at breaks; consider booties for tender paws.');
    if (t.exposure) caution('Exposure', 'Narrow ledges or unprotected drop-offs on parts of the route. Keep the dog leashed and on the inside.');
    if (/livestock|patou|guardian|cattle|herd|pasture|alpage|graz/.test(text)) {
      caution('Livestock & leash', 'Grazing animals (possibly with guardian dogs) reported on or near this route. Leash through pastures, give herds a wide berth.');
    } else {
      good('Leash', 'No livestock noted in our field data for this route. Local leash rules still apply.');
    }
    if (maxAlt >= 1800) caution('Season & altitude', `Tops out around ${maxAlt} m. Snow lingers into early summer and weather turns quickly.`);

    box.innerHTML = rows.map(r => `
      <div class="safety-row ${r.ok ? 'is-good' : 'is-caution'}">
        <span class="safety-row-mark" aria-hidden="true">${r.ok ? '✓' : '!'}</span>
        <span><b>${esc(r.title)}</b> · <span class="safety-row-state">${r.ok ? 'Good' : 'Caution'}</span><small>${esc(r.sub)}</small></span>
      </div>`).join('');
  })();

  /* ---- Sticky sidebar: today's conditions + walking forecast -------- */
  (function sidebar() {
    const sp = t.startPoint || {};
    const lat = typeof sp.lat === 'number' ? sp.lat : t.lat;
    const lng = typeof sp.lng === 'number' ? sp.lng : t.lng;

    // Today: mirror the live chip trail.js fills from Open-Meteo (no second
    // call for current conditions).
    const condCard = $('sideConditions'), condBody = $('sideConditionsBody');
    const chip = $('weatherChip');
    if (condCard && condBody && chip) {
      const sync = () => {
        const txt = chip.textContent.trim();
        if (!txt) return;
        let hint = '';
        if (t.heatRisk === 'high') hint = '<br><small style="color:var(--ink-soft);">Exposed route, start early.</small>';
        else if (t.heatRisk === 'moderate') hint = '<br><small style="color:var(--ink-soft);">Some exposed stretches.</small>';
        condBody.innerHTML = esc(txt) + hint;
        condCard.hidden = false;
      };
      new MutationObserver(sync).observe(chip, { childList: true, characterData: true, subtree: true });
      if (chip.textContent.trim()) sync();
    }

    // Walking forecast: real Open-Meteo 5-day forecast at the trailhead.
    // Coolest-window labels come from the same hourly series, not guesses.
    const fcCard = $('sideForecast'), fcToday = $('sideForecastToday'), fcDays = $('sideForecastDays');
    if (!fcCard || typeof lat !== 'number') return;
    const WMO = (c) => c === 0 ? 'Clear' : c <= 2 ? 'Mostly clear' : c === 3 ? 'Overcast'
      : c <= 48 ? 'Fog' : c <= 57 ? 'Drizzle' : c <= 67 ? 'Rain' : c <= 77 ? 'Snow'
      : c <= 82 ? 'Showers' : c <= 86 ? 'Snow showers' : 'Thunderstorms';
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,precipitation_probability_max&hourly=temperature_2m&forecast_days=5&timezone=auto`)
      .then(r => r.json())
      .then(d => {
        if (!d || !d.daily || !d.hourly) return;
        const hrs = d.hourly.time.map((iso, i) => ({ iso, h: new Date(iso).getHours(), day: iso.slice(0, 10), temp: d.hourly.temperature_2m[i] }));

        // Today's heat strip, 06:00 to 20:00.
        const todayKey = d.daily.time[0];
        const strip = hrs.filter(x => x.day === todayKey && x.h >= 6 && x.h <= 20);
        if (fcToday && strip.length) {
          const barColor = (v) => v < 15 ? 'var(--success)' : v < 22 ? '#C9A25E' : '#B2542E';
          fcToday.innerHTML = '<div class="fc-strip">' + strip.map(x =>
            `<span title="${x.h}:00 · ${Math.round(x.temp)}°C" style="background:${barColor(x.temp)};height:${Math.max(6, Math.min(30, Math.round(x.temp)))}px;"></span>`).join('') +
            '</div><div class="fc-strip-label"><span>06:00</span><span>today, hour by hour</span><span>20:00</span></div>';
        }

        // Coolest 3-hour daylight window per day, from the hourly series.
        const coolestWindow = (dayKey) => {
          const day = hrs.filter(x => x.day === dayKey && x.h >= 6 && x.h <= 20);
          if (day.length < 3) return null;
          let best = 0, bestAvg = Infinity;
          for (let i = 0; i + 2 < day.length; i++) {
            const avg = (day[i].temp + day[i + 1].temp + day[i + 2].temp) / 3;
            if (avg < bestAvg) { bestAvg = avg; best = i; }
          }
          const pad = (n) => String(n).padStart(2, '0');
          return `${pad(day[best].h)}:00–${pad(day[best + 2].h + 1)}:00`;
        };

        if (fcDays) {
          fcDays.innerHTML = d.daily.time.map((iso, i) => {
            const label = i === 0 ? 'Today' : new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
            const win = coolestWindow(iso);
            return `<div class="fc-day">
              <b>${label}</b>
              <span>${WMO(d.daily.weathercode[i])} · ${Math.round(d.daily.temperature_2m_max[i])}°C${d.daily.precipitation_probability_max[i] >= 30 ? ' · ' + d.daily.precipitation_probability_max[i] + '% rain' : ''}</span>
              ${win ? `<small>coolest ${win}</small>` : ''}
            </div>`;
          }).join('');
        }
        fcCard.hidden = false;
      })
      .catch(() => {});
  })();
})();
