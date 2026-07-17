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
      heroBtn.innerHTML = rec ? '■ End hike' : '▶ Start the hike';
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

  // ---- 2. "Active now" hazard pill ---------------------------------------
  const flags = document.getElementById('trailFlagsList');
  const hazardCard = document.getElementById('td2Hazards');
  function syncHazards() {
    if (!flags || !hazardCard) return;
    const hasReports = !flags.querySelector('.empty-state') && flags.children.length > 0;
    hazardCard.classList.toggle('has-active', hasReports);
  }
  if (flags) {
    new MutationObserver(syncHazards).observe(flags, { childList: true, subtree: true });
    syncHazards();
  }

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
