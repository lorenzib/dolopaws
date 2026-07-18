/**
 * trail-detail-ui.js — small UI glue for the redesigned (single-scroll,
 * Strava-style) trail detail page. Self-contained: it only reads state the
 * other modules already own and reflects it into the new markup. No data
 * layer of its own. Runs only on pages that use the `.td2` layout.
 *
 * Responsibilities:
 *   1. Hero "Start the hike" button proxies hike-mode.js's map button, and a
 *      live recording banner mirrors the hike state.
 *   2. "Active now" pill on the hazards card follows #trailFlagsList content.
 *   3. Sidebar dog card is filled from the real match teaser / saved profile.
 */
(function () {
  'use strict';
  if (!document.querySelector('.td2')) return;

  // ---- 1. Hero Start-the-hike proxy + live banner -------------------------
  const heroBtn = document.getElementById('heroStartHike');
  const liveBanner = document.getElementById('td2LiveBanner');
  const mapBox = document.getElementById('trailMapBox');

  function recording() {
    return !!(mapBox && mapBox.classList.contains('hike-status-visible'));
  }
  function syncHike() {
    const mapBtn = document.getElementById('mapStartHikeBtn');
    if (heroBtn) {
      heroBtn.hidden = !mapBtn; // hike-mode only injects the button when GPS exists
      const rec = recording();
      heroBtn.classList.toggle('recording', rec);
      heroBtn.innerHTML = rec
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> End hike'
        : '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg> Start the hike';
    }
    if (liveBanner) liveBanner.hidden = !recording();
  }
  if (heroBtn) {
    heroBtn.addEventListener('click', function () {
      const mapBtn = document.getElementById('mapStartHikeBtn');
      if (mapBtn) mapBtn.click();
    });
  }
  if (mapBox) {
    // hike-mode.js injects #mapStartHikeBtn and toggles .hike-status-visible.
    new MutationObserver(syncHike).observe(mapBox, {
      attributes: true, attributeFilter: ['class'], childList: true, subtree: true,
    });
  }
  // Poll briefly until hike-mode has injected its button, then let the
  // observer take over.
  let tries = 0;
  const iv = setInterval(function () {
    syncHike();
    if (document.getElementById('mapStartHikeBtn') || ++tries > 40) clearInterval(iv);
  }, 250);
  syncHike();

  // ---- 2. "Active now" hazard pill + section counts ----------------------
  const flags = document.getElementById('trailFlagsList');
  const hazardCard = document.getElementById('td2Hazards');
  const photos = document.getElementById('trailPhotosList');
  const reviews = document.getElementById('trailReviewsList');

  // Count real items in a list (children that aren't the empty-state block).
  function itemCount(list) {
    if (!list) return 0;
    if (list.querySelector('.empty-state')) return 0;
    return list.children.length;
  }
  function setCount(id, n) {
    const el = document.getElementById(id);
    if (el) el.textContent = n > 0 ? ' · ' + n : '';
  }
  function syncHazards() {
    if (!flags) return;
    const n = itemCount(flags);
    if (hazardCard) hazardCard.classList.toggle('has-active', n > 0);
    setCount('td2HazardCount', n);
  }
  function syncCounts() {
    setCount('td2PhotoCount', itemCount(photos));
    const rc = itemCount(reviews);
    setCount('td2ReviewCount', rc);
    // Average rating from the rendered review ratings (aria-label "X out of 5").
    const avgEl = document.getElementById('td2ReviewAvg');
    if (avgEl && reviews) {
      const rated = [].map.call(reviews.querySelectorAll('.community-review__rating[aria-label]'), function (r) {
        const m = (r.getAttribute('aria-label') || '').match(/([\d.]+)\s*out of\s*5/i);
        return m ? parseFloat(m[1]) : null;
      }).filter(function (v) { return v != null; });
      if (rated.length) {
        const avg = rated.reduce(function (a, b) { return a + b; }, 0) / rated.length;
        avgEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex:none;"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 18l-5.9 3.1 1.3-6.6L2.5 9.4l6.6-.8z"/></svg> ' + avg.toFixed(1);
        avgEl.hidden = false;
      } else { avgEl.hidden = true; }
    }
  }
  if (flags) { new MutationObserver(syncHazards).observe(flags, { childList: true, subtree: true }); syncHazards(); }
  if (photos) { new MutationObserver(syncCounts).observe(photos, { childList: true, subtree: true }); }
  if (reviews) { new MutationObserver(syncCounts).observe(reviews, { childList: true, subtree: true }); }
  syncCounts();

  // ---- 3. Sidebar dog card from the real profile / match teaser ----------
  const dogCard = document.getElementById('td2DogCard');
  const matchEl = document.getElementById('trailMatch');
  function syncDog() {
    if (!dogCard) return;
    let name = '';
    try {
      const s = JSON.parse(localStorage.getItem('dolopaws-profile-summary') || 'null');
      if (s && s.hasProfile) name = s.name || '';
    } catch (e) { /* private mode — no summary */ }

    // Personalise section headers with the dog's name where the design does.
    const safetyDog = document.getElementById('td2SafetyDog');
    if (safetyDog) safetyDog.textContent = name ? ' · ' + name : '';
    const nearbyTitle = document.getElementById('nearbyTitle');
    if (nearbyTitle && name) nearbyTitle.textContent = 'Nearby trails, ranked for ' + name;

    // #trailMatch reads e.g. "94% match for Rufus" for a logged-in profile.
    const txt = matchEl ? (matchEl.textContent || '') : '';
    const pctM = txt.match(/(\d+)%/);
    if (!name && !pctM) { dogCard.hidden = true; return; }

    dogCard.hidden = false;
    const nm = document.getElementById('td2DogName');
    const av = document.getElementById('td2DogAv');
    if (name) {
      if (nm) nm.textContent = name;
      if (av) av.textContent = name.charAt(0).toUpperCase();
    }
    const verdict = document.getElementById('td2DogVerdict');
    if (pctM && verdict) {
      const n = parseInt(pctM[1], 10);
      verdict.hidden = false;
      const pct = document.getElementById('td2DogPct');
      if (pct) pct.textContent = n + '%';
      const who = name || 'your dog';
      const word = document.getElementById('td2DogWord');
      if (word) {
        word.textContent = n >= 85 ? 'A great, safe walk for ' + who + ' today'
          : n >= 65 ? 'A good match for ' + who
          : 'Check the safety notes for ' + who;
      }
    }
  }
  if (matchEl) {
    new MutationObserver(syncDog).observe(matchEl, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'],
    });
  }
  window.addEventListener('dolopaws-auth-changed', syncDog);
  syncDog();
})();
