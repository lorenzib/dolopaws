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
  const trust = window.DoloPawsTrailTrust;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const dpIcon = (key, size = 14) => window.DoloPawsIcons
    ? window.DoloPawsIcons.renderIconSvg(key, { mode:'inline', color:'currentColor', size })
    : '';
  const tt = (key, vars, fallback) => {
    const out = (typeof window.t === 'function') ? window.t(key, vars) : null;
    return (out && out !== key) ? out : fallback;
  };

  /* ---- Verified / Imported seal in the hero ---------------------- */
  (function seal() {
    const el = $('verifiedSeal');
    if (!el) return;
    if (t.curated === false) {
      el.innerHTML = dpIcon('imported') + '<span>' + esc(trust ? trust.provenanceLabel(t) : tt('badge.importedS', null, 'Imported')) + '</span>';
      el.style.background = '#e0f2f1';
      el.style.color = '#00695c';
    } else {
      el.innerHTML = dpIcon('verified') + '<span>' + esc(trust ? trust.provenanceLabel(t) : tt('trail.verifiedShort', null, 'DoloPaws reviewed')) + '</span>';
    }
    el.classList.add('dp-inline-status');
    el.hidden = false;
  })();

  /* ---- Dated review record and route-specific sources ------------ */
  (function sourceRecord() {
    const meta = $('trailReviewMeta');
    const links = $('trailSourceLinks');
    if (!meta || !links) return;
    const graduation = trust && trust.graduationProgress ? trust.graduationProgress(t) : null;
    const progress = trust && trust.reviewProgress ? trust.reviewProgress(t) : null;
    if (graduation) {
      const date = trust.formatReviewDate(t.reviewedAt || (t.verified && t.verified.date));
      meta.textContent = `${graduation.verified ? 'Last verification review' : 'Verification in progress'}: ${date} · ${graduation.completed}/${graduation.total} graduation checks complete`;
    } else if (progress) {
      const date = trust.formatReviewDate(t.reviewedAt || (t.verified && t.verified.date));
      meta.textContent = `Last desk review: ${date} · ${t.reviewedBy || 'DoloPaws'} · ${progress.checked}/${progress.total} safety checks complete`;
    } else if (t.routeAudit && t.reviewedAt) {
      const date = trust ? trust.formatReviewDate(t.reviewedAt) : t.reviewedAt;
      meta.textContent = `Last route audit: ${date} · route line, map points, elevation and photo attribution checked`;
    } else {
      meta.textContent = t.curated === false
        ? 'No route-specific DoloPaws source review is recorded yet.'
        : 'A dated route-specific source review is not yet available.';
    }
    const sources = Array.isArray(t.sourceLinks) ? t.sourceLinks : [];
    if (!sources.length) {
      links.innerHTML = '<p class="trail-sources">General data: Waymarked Trails · OpenStreetMap · Open-Meteo</p>';
      return;
    }
    links.innerHTML = '<p class="trail-source-heading">Route-specific sources</p><ul>' + sources.map(source => {
      const support = Array.isArray(source.categories) && source.categories.length
        ? ` <small>Supports: ${source.categories.map(category => category.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}</small>`
        : '';
      return `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>${support}</li>`;
    }).join('') + '</ul>';
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
    if (t.safetyLevel) {
      const baseRisk = safetyLabel(t.safetyLevel);
      factBits.push((trust ? trust.riskLabel(t, baseRisk) : baseRisk).toLowerCase());
    }
    if (typeof t.distance === 'number') factBits.push(t.distance <= 6 ? 'easy distance' : `${t.distance} km`);
    if (typeof t.shadeCoverage === 'number') factBits.push(t.shadeCoverage >= 40 ? 'good shade' : 'little shade');
    const factLine = factBits.join(' · ');

    function guest() {
      title.textContent = tt('qa.dogGuest', null, 'Would this suit your dog?');
      const returnToTrail = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      sub.innerHTML = esc(factLine) + (factLine ? ' · ' : '') +
        '<a href="account.html?next=' + returnToTrail + '">' + tt('qa.dogGuestCta', null, 'create a free profile to find out') + ' →</a>';
    }
    function noProfile() {
      title.textContent = tt('qa.dogNoProfile', null, 'Whose paws are we scoring?');
      const returnToTrail = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      sub.innerHTML = '<a href="account.html?next=' + returnToTrail + '">' + tt('qa.dogNoProfileCta', null, 'Add your dog, 2 minutes') + ' →</a>';
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

  // Card 3 — Getting there. Start point label + directions link.
  (function paintAccessCard() {
    const card = $('qaAccess'), title = $('qaAccessTitle'), sub = $('qaAccessSub');
    if (!card) return;
    const sp = t.startPoint || {};
    const lat = typeof sp.lat === 'number' ? sp.lat : t.lat;
    const lng = typeof sp.lng === 'number' ? sp.lng : t.lng;
    if (typeof lat !== 'number') return;
    title.textContent = tt('qa.accessTitle', null, 'Getting there');
    const rawLabel = sp.label || tt('trail.itinParkFallback', null, 'Trailhead');
    const label = esc(trust ? trust.startPointLabel(t, rawLabel) : rawLabel);
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
    const picks = sameValley.slice(0, 3);
    for (const o of sameRegion) { if (picks.length >= 3) break; picks.push(o); }
    if (!picks.length) return;
    // Reference gallery card: photo, floating match % chip, serif name, meta.
    grid.innerHTML = picks.map(o => `
      <a class="near-card" href="trail.html?id=${encodeURIComponent(o.id)}" data-near-id="${esc(o.id)}">
        <div class="ph"${o.imageIcon ? ` style="background-image:url('${esc(o.imageIcon)}');"` : ''}><span class="pct near-pct" hidden></span></div>
        <div class="bd">
          <div class="nm">${esc(o.name)}</div>
          <div class="mt">${esc(o.valley || o.area || '')} · ${o.distance} km · ${esc(trust ? trust.riskLabel(o, safetyLabel(o.safetyLevel)) : safetyLabel(o.safetyLevel))}</div>
        </div>
      </a>`).join('');
    wrapEl.hidden = false;

    // Personalise: retitle the section and fill each pick's real match %
    // chip — same scoreTrail() as everywhere else.
    function personalise() {
      if (typeof scoreTrail !== 'function' || !window.DoloPawsAuth || !window.DoloPawsAuth.currentUser) return;
      window.DoloPawsAuth.getDogProfile().then(profile => {
        if (!profile) return;
        const heading = $('nearbyTitle');
        if (heading && profile.name) heading.textContent = 'Similar trails for ' + profile.name;
        const ov = (typeof effectiveOverrides === 'function') ? effectiveOverrides(profile, null) : profile;
        for (const o of picks) {
          const slot = grid.querySelector(`[data-near-id="${CSS.escape(o.id)}"] .near-pct`);
          if (!slot) continue;
          slot.textContent = (o.curated === false ? '≈' : '') + scoreTrail(o, ov) + '%';
          slot.hidden = false;
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
    // Hero photo behind the title (reference: dimmed photo + cream veil).
    const heroPhoto = $('tdHeroPhoto');
    if (heroPhoto && t.imageIcon) heroPhoto.style.backgroundImage = `url("${String(t.imageIcon).replace(/["')]/g, '')}")`;

    // Breadcrumb: "← Trails · {region} · {valley}"
    const crumb = $('tdBreadcrumb');
    if (crumb) {
      const regionName = t.region === 'savoy' ? 'Savoy' : 'Dolomites';
      crumb.textContent = '← Trails · ' + regionName + (t.valley ? ' · ' + t.valley : '');
    }

    // Risk dot line next to the verified seal.
    const riskLine = $('tdRiskLine');
    if (riskLine && t.safetyLevel) {
      const dotColors = { 'low-risk': '#4a7c59', 'moderate': '#c98a3e', 'caution': '#b2542e' };
      const labels = { 'low-risk': 'Low-risk terrain', 'moderate': 'Moderate terrain', 'caution': 'Caution terrain' };
      $('tdRiskDot').style.background = dotColors[t.safetyLevel] || '#8a8d80';
      const baseRisk = labels[t.safetyLevel] || '';
      $('tdRiskLabel').textContent = trust ? trust.riskLabel(t, baseRisk) : baseRisk;
      riskLine.hidden = false;
    }

    // Map overlay chip: "{km} km · loop/one way · {valley}"
    const mapChip = $('tdMapChip');
    if (mapChip) {
      const loop = Array.isArray(t.path) && t.path.length > 1 && distMeters(t.path[0], t.path[t.path.length - 1]) < 200;
      mapChip.textContent = `${t.distance} km · ${loop ? 'loop' : 'one way'}${t.valley ? ' · ' + t.valley : ''}`;
      mapChip.hidden = false;
    }

    // Elevation figures under the real chart; hide the block honestly
    // when the trail has no profile data.
    const prof = Array.isArray(t.elevationProfile) ? t.elevationProfile.map(p => Number(p.elev) || 0) : [];
    if (prof.length > 1) {
      const figs = $('tdElevFigs');
      if (figs) {
        $('tdElevStart').textContent = prof[0].toLocaleString() + ' m';
        $('tdElevHigh').textContent = Math.max(...prof).toLocaleString() + ' m';
        $('tdElevClimb').textContent = '+' + (t.elevation != null ? t.elevation : Math.max(...prof) - Math.min(...prof)) + ' m';
        figs.hidden = false;
      }
    } else {
      const h = $('tdElevH'), svg = $('elevProf');
      if (h) h.hidden = true;
      if (svg) svg.style.display = 'none';
    }

    const easyTerrain = Number(t.terrainRank) === 0;
    const lowRisk = t.safetyLevel === 'low-risk';
    const verdict = t.curated === false
      ? 'Automated estimate from mapped route data. Exposure, shade, livestock and current conditions are not field verified.'
      : lowRisk && easyTerrain
      ? 'A gentle, low-risk choice for most dogs.'
      : t.safetyLevel === 'caution'
        ? 'A more demanding trail: check the hazards and your dog’s confidence before committing.'
        : 'A manageable trail for prepared dogs; review the route constraints before committing.';
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
    const climb = Number(t.elevation) || 0;
    const signalData = [
      ['paw', easyTerrain ? (t.curated === false ? 'Mapped paw surface' : 'Gentle paw surface') : 'Mixed paw surface', easyTerrain ? (t.curated === false ? 'Mapped as flat or packed; not field reviewed' : 'Flat or packed underfoot') : (t.terrainType || 'Check pads at breaks')],
      ['route', 'Route effort', `${t.distance} km${climb ? ` · +${climb} m` : ''}`],
      ['loop', isLoop ? 'Loop route' : 'One-way route', isLoop ? 'Returns to the starting point' : 'Plan the return journey']
    ];
    if (signalEl) {
      signalEl.innerHTML = signalData.map(([icon, title, sub]) =>
        `<div class="match-signal"><span class="mark" aria-hidden="true">✦</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span></div>`).join('');
    }
    // "Why this fits {name}" heading follows the profile when one exists.
    function paintWhyTitle() {
      if (!window.DoloPawsAuth || !window.DoloPawsAuth.currentUser) return;
      window.DoloPawsAuth.getDogProfile().then(p => {
        if (p && p.name && $('tdWhyTitle')) $('tdWhyTitle').textContent = 'Why this fits ' + p.name;
      }).catch(() => {});
    }
    if (window.DoloPawsAuth) paintWhyTitle();
    else window.addEventListener('dolopaws-auth-ready', paintWhyTitle, { once: true });

    // Assessment note ABOVE the box, below the heading
    const assessmentNote = $('assessmentNote');
    if (assessmentNote) {
      assessmentNote.innerHTML = trust ? trust.assessmentNote(t) : `<strong style="color: var(--ink);">Our assessment of this trail:</strong> route facts are weighed against your dog's profile. Current conditions can still change.`;
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

    // Share popover (reference): Copy link with inline "✓ Link copied",
    // Message a walking buddy (sms:), Email this trail (mailto:).
    const shareBtn = $('detailShareBtn');
    const sharePop = $('tdSharePop');
    if (shareBtn && sharePop) {
      const smsLink = $('tdShareSms'), mailLink = $('tdShareMail');
      const shareDetails = () => {
        const url = new URL(location.pathname, location.href);
        url.searchParams.set('id', t.id);
        const activeTab = new URLSearchParams(location.search).get('tab');
        if (/^(?:safety|reviews)$/.test(activeTab || '')) url.searchParams.set('tab', activeTab);
        const shareUrl = url.href;
        return {
          url: shareUrl,
          text: t.name + ' on DoloPaws: ' + shareUrl
        };
      };
      const closeShare = () => {
        sharePop.hidden = true;
        shareBtn.setAttribute('aria-expanded', 'false');
      };
      const updateShareLinks = () => {
        const details = shareDetails();
        if (smsLink) smsLink.href = 'sms:?body=' + encodeURIComponent(details.text);
        if (mailLink) mailLink.href = 'mailto:?subject=' + encodeURIComponent(t.name + ' | DoloPaws') + '&body=' + encodeURIComponent(details.text);
      };
      shareBtn.addEventListener('click', () => {
        sharePop.hidden = !sharePop.hidden;
        shareBtn.setAttribute('aria-expanded', sharePop.hidden ? 'false' : 'true');
        if (!sharePop.hidden) updateShareLinks();
      });
      document.addEventListener('click', (e) => {
        if (!sharePop.hidden && !sharePop.contains(e.target) && e.target !== shareBtn && !shareBtn.contains(e.target)) {
          closeShare();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !sharePop.hidden) {
          closeShare();
          shareBtn.focus();
        }
      });
      const copyBtn = $('tdCopyLink');
      if (copyBtn) copyBtn.addEventListener('click', async () => {
        const shareUrl = shareDetails().url;
        try {
          await navigator.clipboard.writeText(shareUrl);
          copyBtn.textContent = '✓ Link copied';
          copyBtn.style.color = '#2f5138';
          setTimeout(() => {
            copyBtn.textContent = 'Copy link';
            copyBtn.style.color = '';
            closeShare();
          }, 1400);
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
      const trailReturn = encodeURIComponent('trail.html?id=' + t.id + '&tab=safety');
      const fromTrail = href => {
        const hashAt = href.indexOf('#');
        const page = hashAt >= 0 ? href.slice(0, hashAt) : href;
        const hash = hashAt >= 0 ? href.slice(hashAt) : '';
        return page + '?from=' + trailReturn + hash;
      };
      const text = `${t.tips || ''} ${t.desc || ''} ${(t.startPoint && t.startPoint.label) || ''} ${(t.surfaceHazards || []).join(' ')}`.toLowerCase();
      const maxAlt = Math.max(...(t.elevationProfile || []).map(p => Number(p.elev) || 0));
      const shade = typeof t.shadeCoverage === 'number' ? t.shadeCoverage : null;
      const hasWaterSrc = Array.isArray(t.waterSources) && t.waterSources.length > 0;
      const guides = [];

      // Livestock — alpage/pasture/herd/cattle/patou/guardian
      if (/livestock|patou|guardian|cattle|herd|pasture|alpage|graz/.test(text)) {
        guides.push(['warning', 'Meeting livestock and guardian dogs', 'guides/livestock-guard-dogs.html']);
      }
      // Cable car — gondola/lift/cable/cableway nearby or in text
      if (/gondola|cable car|cableway|lift station|chairlift|funicular/.test(text)) {
        guides.push(['lifts', 'Dogs on cable cars', 'guides/dogs-on-cable-cars.html']);
      }
      // Heat / exposure — exposed route OR high heat risk OR little shade
      if (t.exposure === true || t.heatRisk === 'high' || (shade !== null && shade < 25)) {
        guides.push(['heat', 'Heat and exposure with your dog', 'guides/heat-overheating.html']);
      }
      // Altitude — high trailhead/summit
      if (maxAlt >= 1800) {
        guides.push(['mountain', 'Hiking at altitude', 'guides/altitude-with-your-dog.html']);
      }
      // Water — none mapped, or long route
      if (!hasWaterSrc || Number(t.distance) >= 8) {
        guides.push(['water', 'Water for dogs on trail', 'guides/water-for-dogs-on-trail.html']);
      }
      // Rifugi — route passes huts
      if (Array.isArray(t.rifugi) && t.rifugi.length) {
        guides.push(['hut', 'Dogs at rifugi', 'guides/dogs-at-rifugi.html']);
      }

      if (!guides.length) return;
      box.innerHTML = `<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--paper-line);">
        <div style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Read before you go</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">${guides.slice(0,4).map(([icon,label,href]) =>
          `<a href="${fromTrail(href)}" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:var(--sage-dim);border:1px solid var(--paper-line);border-radius:999px;font-size:12px;font-weight:600;color:var(--ink);text-decoration:none;">${dpIcon(icon)}<span>${esc(label)}</span></a>`).join('')}</div>
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
        // Reference action card: 96px conic ring (#4a7c59 on #e6e0cf track),
        // "MATCH FOR {NAME}" kicker, breed line underneath.
        if (personalScore) {
          const ringColor = score >= 70 ? '#4a7c59' : score >= 50 ? '#c98a3e' : '#b2542e';
          personalScore.innerHTML =
            `<div class="td-ring" style="background:conic-gradient(${ringColor} ${Math.round((score / 100) * 360)}deg,#e6e0cf 0);">` +
            `<div class="td-ring-in">${t.curated === false ? '≈' : ''}${score}%</div></div>`;
          personalScore.hidden = false;
        }
        const label = $('tdMatchLabel');
        if (label) {
          $('tdMatchName').textContent = 'MATCH FOR ' + name.toUpperCase();
          $('tdMatchBreed').textContent = profile.breed || '';
          label.hidden = false;
        }
        if (matchTitle) matchTitle.textContent = `Match for ${name}`;
        if (matchSummary) matchSummary.textContent = '';
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
      const tabNames = {
        tabOverview: 'overview',
        tabSafety: 'safety',
        tabReviews: 'reviews'
      };
      const activateTab = (btn, historyMode) => {
        tabsNav.querySelectorAll('[data-tab]').forEach(b => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panelIds.forEach(id => {
          const panel = $(id);
          if (panel) panel.hidden = id !== btn.dataset.tab;
        });
        if (historyMode && window.history) {
          const url = new URL(window.location.href);
          const tabName = tabNames[btn.dataset.tab];
          if (tabName === 'overview') url.searchParams.delete('tab');
          else if (tabName) url.searchParams.set('tab', tabName);
          const target = url.pathname + url.search + url.hash;
          if (target !== window.location.pathname + window.location.search + window.location.hash) {
            if (historyMode === 'push') window.history.pushState({}, '', target);
            else window.history.replaceState({}, '', target);
          }
        }
      };

      tabsNav.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => activateTab(btn, 'push'));
      });

      const requestedTab = new URLSearchParams(window.location.search).get('tab');
      const requestedPanel = Object.keys(tabNames).find(id => tabNames[id] === requestedTab);
      const initialTab = requestedPanel
        ? tabsNav.querySelector('[data-tab="' + requestedPanel + '"]')
        : tabsNav.querySelector('[data-tab].active') || tabsNav.querySelector('[data-tab]');
      if (initialTab) activateTab(initialTab, false);
      window.addEventListener('popstate', () => {
        const tabName = new URLSearchParams(window.location.search).get('tab') || 'overview';
        const panelId = Object.keys(tabNames).find(id => tabNames[id] === tabName) || 'tabOverview';
        const tab = tabsNav.querySelector('[data-tab="' + panelId + '"]');
        if (tab) activateTab(tab, false);
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
    const addAssessment = item => {
      if (!item) return;
      (item.ok ? good : caution)(item.title, item.detail);
    };

    addAssessment(trust ? trust.waterAssessment(t) : (hasWater
      ? { ok: true, title: 'Water', detail: 'A water source is mapped on this route. Bring a bowl.' }
      : { ok: false, title: 'Water', detail: 'No water source is mapped. Carry enough for the dog.' }));
    addAssessment(trust ? trust.heatAssessment(t) : null);
    addAssessment(trust ? trust.surfaceAssessment(t) : (Number(t.terrainRank) !== 0
      ? { ok: false, title: 'Surface hazards', detail: (t.terrainType || 'Gravel and mixed rock') + '. Check pads at breaks; consider booties for tender paws.' }
      : null));
    addAssessment(trust ? trust.exposureAssessment(t) : (t.exposure
      ? { ok: false, title: 'Exposure', detail: 'Narrow ledges or unprotected drop-offs occur on parts of the route.' }
      : null));
    addAssessment(trust ? trust.livestockAssessment(t, text) : null);
    if (maxAlt >= 1800) caution('Season & altitude', `Tops out around ${maxAlt} m. Snow lingers into early summer and weather turns quickly.`);

    box.innerHTML = rows.map(r => `
      <div class="safety-row ${r.ok ? 'is-good' : 'is-caution'}">
        <span class="pill">${r.ok ? 'Good' : 'Caution'}</span>
        <span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span>
      </div>`).join('');
  })();

  /* ---- Sticky sidebar: today's conditions + walking forecast --------
     Reference markup, real Open-Meteo data at the trailhead. ---------- */
  (function sidebar() {
    const sp = t.startPoint || {};
    const lat = typeof sp.lat === 'number' ? sp.lat : t.lat;
    const lng = typeof sp.lng === 'number' ? sp.lng : t.lng;
    const fcCard = $('sideForecast'), fcToday = $('sideForecastToday'), fcDays = $('sideForecastDays');
    if (typeof lat !== 'number') return;

    const valleyEl = $('sideFcValley');
    if (valleyEl) valleyEl.textContent = t.valley || t.area || '';

    const WMO = (c) => c === 0 ? 'Clear' : c <= 2 ? 'Mostly clear' : c === 3 ? 'Overcast'
      : c <= 48 ? 'Fog' : c <= 57 ? 'Drizzle' : c <= 67 ? 'Rain' : c <= 77 ? 'Snow'
      : c <= 82 ? 'Showers' : c <= 86 ? 'Snow showers' : 'Thunderstorms';
    const heatColor = (v) => v < 15 ? '#5c8a52' : v < 22 ? '#c98a3e' : '#b2542e';

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,precipitation_probability_max&hourly=temperature_2m&forecast_days=5&timezone=auto`)
      .then(r => r.json())
      .then(d => {
        if (!d || !d.daily || !d.hourly) return;
        const hrs = d.hourly.time.map((iso, i) => ({ h: new Date(iso).getHours(), day: iso.slice(0, 10), temp: d.hourly.temperature_2m[i] }));
        const todayKey = d.daily.time[0];

        // Coolest 3-hour daylight window for a day, from the hourly series.
        const coolestWindow = (dayKey) => {
          const day = hrs.filter(x => x.day === dayKey && x.h >= 6 && x.h <= 20);
          if (day.length < 3) return null;
          let best = 0, bestAvg = Infinity;
          for (let i = 0; i + 2 < day.length; i++) {
            const avg = (day[i].temp + day[i + 1].temp + day[i + 2].temp) / 3;
            if (avg < bestAvg) { bestAvg = avg; best = i; }
          }
          return { from: day[best].h, to: day[best + 2].h + 1 };
        };

        // Current conditions and the recommended window sit in the same
        // forecast card, so the live decision is stated only once.
        if (d.current) {
          const cur = Math.round(d.current.temperature_2m);
          const sky = WMO(d.current.weathercode).toLowerCase();
          $('sideCondTitle').textContent = 'Today · ' + sky;
          $('sideCondTemp').textContent = cur + '°C';
          const win = coolestWindow(todayKey);
          $('sideCondWindow').innerHTML = win
            ? `Best walking window: <strong style="font-weight:600;">${win.from}:00–${win.to}:00</strong>, the coolest daylight stretch.`
            : 'Mountain weather turns quickly; recheck before you set off.';
        }

        // Today's hourly heat strip, 06:00 to 20:00.
        const strip = hrs.filter(x => x.day === todayKey && x.h >= 6 && x.h <= 20 && x.h % 2 === 0);
        if (fcToday && strip.length) {
          fcToday.innerHTML = '<div class="fc-strip">' + strip.map(x =>
            `<div class="col"><div class="bar" title="${x.h}:00 · ${Math.round(x.temp)}°C" style="background:${heatColor(x.temp)};height:${Math.max(14, Math.min(100, Math.round((x.temp / 30) * 100)))}%;"></div><span class="hl">${x.h < 12 ? x.h + 'a' : (x.h === 12 ? '12p' : (x.h - 12) + 'p')}</span></div>`).join('') +
            '</div>';
        }

        // 5-day outlook with per-day coolest-window pill.
        if (fcDays) {
          fcDays.innerHTML = d.daily.time.map((iso, i) => {
            const label = i === 0 ? 'Today' : new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
            const hi = Math.round(d.daily.temperature_2m_max[i]);
            const win = coolestWindow(iso);
            const pillBg = hi < 15 ? '#e5efe7' : hi < 22 ? '#f6ecdb' : '#f3e2d6';
            const pillFg = heatColor(hi);
            const rain = d.daily.precipitation_probability_max[i];
            return `<div class="fc-day">
              <span class="d">${label}</span>
              <span class="s">${WMO(d.daily.weathercode[i])}${rain >= 30 ? ' · ' + rain + '% rain' : ''}</span>
              <span class="hi">${hi}°</span>
              ${win ? `<span class="w" style="background:${pillBg};color:${pillFg};">${win.from}:00 to ${win.to}:00</span>` : ''}
            </div>`;
          }).join('');
        }
        if (fcCard) fcCard.hidden = false;
      })
      .catch(() => {});
  })();
})();
