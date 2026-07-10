/**
 * hike-mode.js — "Start hike" companion for the trail detail page.
 *
 * Turns the trail map into an on-trail companion: live position snapped to
 * the route, progress readout (km walked, next water / rifugio ahead),
 * off-route warning, and a screen wake lock so the phone doesn't sleep
 * mid-hike.
 *
 * Everything works from data already on the trail object (path, distance,
 * rifugi, waterSources) — no network calls, so the safety features keep
 * working even when the signal drops in a valley. Only the map tiles need
 * connectivity, and GPS itself is satellite-based and works offline.
 *
 * Usage: initHikeMode(map, trail) inside trail.js's map 'load' handler,
 * after the route path has been added. Include this file in trail.html
 * BEFORE trail.js.
 */

function initHikeMode(map, trail){
  if (!('geolocation' in navigator)) return; // no GPS — don't show the button
  if (!Array.isArray(trail.path) || trail.path.length < 2) return;

  const container = map.getContainer();
  container.style.position = container.style.position || 'relative';

  // ---- Precompute cumulative distance along the path (meters) -------------
  const M_PER_DEG = 111000;
  function metersBetween(aLat, aLng, bLat, bLng){
    const dLat = (bLat - aLat) * M_PER_DEG;
    const dLng = (bLng - aLng) * M_PER_DEG * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
    return Math.hypot(dLat, dLng);
  }
  const cum = [0];
  for (let i = 1; i < trail.path.length; i++){
    cum.push(cum[i - 1] + metersBetween(
      trail.path[i - 1][0], trail.path[i - 1][1],
      trail.path[i][0], trail.path[i][1]));
  }
  const totalMeters = cum[cum.length - 1] || 1;
  // Display distances against the trail's stated length so the readout
  // matches the rest of the page (GPS path length can differ slightly).
  const statedKm = trail.distance || totalMeters / 1000;

  // ---- UI elements ---------------------------------------------------------
  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.textContent = window.t ? window.t('hike.start') : '🐾 Start hike';
  startBtn.style.cssText = 'position:absolute;top:10px;left:10px;z-index:6;padding:9px 18px;border-radius:14px;background:var(--ink);color:#fff;border:none;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);';
  container.appendChild(startBtn);

  const panel = document.createElement('div');
  panel.style.cssText = 'position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:6;max-width:92%;padding:10px 16px;border-radius:12px;background:rgba(46,64,52,.94);color:#fff;font-size:12.5px;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.35);display:none;text-align:center;line-height:1.5;';
  container.appendChild(panel);

  const banner = document.createElement('div');
  banner.textContent = window.t ? window.t('hike.offRoute') : '⚠️ Off route';
  banner.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:7;padding:9px 16px;border-radius:12px;background:#9C3A25;color:#fff;font-size:12.5px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,.35);display:none;white-space:nowrap;';
  container.appendChild(banner);

  // ---- State ---------------------------------------------------------------
  let active = false;
  let watchId = null;
  let lastTileError = 0;   // last failed tile/style fetch — signals the map may grey out
  let wakeLock = null;
  let lastIdx = 0;          // last snapped path index — used for monotonic bias
  let offRouteStreak = 0;   // consecutive fixes far from the route
  let firstFix = true;

  // Map tile fetches fail silently when the connection drops mid-hike —
  // navigator.onLine often stays true on a weak mountain signal, so track
  // actual failed fetches too.
  map.on('error', (e) => {
    const msg = e && e.error && (e.error.message || String(e.error));
    if (msg && /fetch|network|failed|abort/i.test(msg)) lastTileError = Date.now();
  });

  function offlineNote(){
    const offline = !navigator.onLine || (Date.now() - lastTileError < 30000);
    return offline
      ? `<br><span style="font-weight:400;opacity:.85;">${window.t('hike.offline')}</span>`
      : '';
  }

  // ---- Wake lock: keep the screen on while hiking --------------------------
  async function acquireWakeLock(){
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* not supported or denied — hike mode still works */ }
  }
  document.addEventListener('visibilitychange', () => {
    // The lock is auto-released when the app backgrounds; re-acquire on return.
    if (active && document.visibilityState === 'visible') acquireWakeLock();
  });

  // ---- Snap a GPS fix to the nearest point on the route --------------------
  // Monotonic bias: when several path points are similarly close (common on
  // out-and-back or tightly-folded loops), prefer the one nearest to where
  // we last were — stops the readout jumping between overlapping segments.
  function snapToPath(lat, lng){
    let minDist = Infinity;
    const dists = new Array(trail.path.length);
    for (let i = 0; i < trail.path.length; i++){
      const d = metersBetween(lat, lng, trail.path[i][0], trail.path[i][1]);
      dists[i] = d;
      if (d < minDist) minDist = d;
    }
    let bestIdx = 0, bestIdxGap = Infinity;
    for (let i = 0; i < dists.length; i++){
      if (dists[i] <= minDist + 25){       // all near-ties within 25 m
        const gap = Math.abs(i - lastIdx);
        if (gap < bestIdxGap){ bestIdxGap = gap; bestIdx = i; }
      }
    }
    return { idx: bestIdx, dist: dists[bestIdx], minDist };
  }

  // ---- Next POI ahead (from km-tagged rifugi / water sources) --------------
  function nextAhead(list, currentKm, labelKey){
    let best = null;
    for (const item of (list || [])){
      if (typeof item.km !== 'number') continue;
      const ahead = item.km - currentKm;
      if (ahead > 0.05 && (!best || ahead < best.ahead)){
        best = { ahead, label: item[labelKey] };
      }
    }
    return best;
  }

  // ---- Per-fix update -------------------------------------------------------
  function onFix(pos){
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;

    if (firstFix){
      firstFix = false;
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 800 });
    }

    const snap = snapToPath(lat, lng);
    lastIdx = snap.idx;
    const currentKm = (cum[snap.idx] / totalMeters) * statedKm;

    // Far from the trail entirely (driving there, wrong valley…)
    if (snap.minDist > 2000){
      panel.innerHTML = window.t('hike.far', {d: (snap.minDist / 1000).toFixed(1)}) + offlineNote();
      banner.style.display = 'none';
      offRouteStreak = 0;
      return;
    }

    // Off-route detection, debounced against normal GPS noise (10–30 m is
    // routine in forests and gorges; require 3 consecutive far fixes).
    if (snap.minDist > 60){
      offRouteStreak++;
      if (offRouteStreak >= 3) banner.style.display = 'block';
    } else if (snap.minDist < 40){
      offRouteStreak = 0;
      banner.style.display = 'none';
    }

    // Progress readout
    const parts = [window.t('hike.kmOf', {a: currentKm.toFixed(1), b: statedKm})];
    const water = nextAhead(trail.waterSources, currentKm, 'label');
    if (water) parts.push(window.t('hike.waterIn', {d: water.ahead.toFixed(1)}));
    const hut = nextAhead(trail.rifugi, currentKm, 'name');
    if (hut) parts.push(window.t('hike.hutIn', {name: hut.label, d: hut.ahead.toFixed(1)}));
    const decision = nextAhead(trail.decisionPoints, currentKm, 'instruction');
    if (decision && decision.ahead < 0.5) parts.push(window.t('hike.ahead', {what: decision.label}));
    panel.innerHTML = parts.join(' · ')
      + (accuracy > 40 ? `<br><span style="font-weight:400;opacity:.8;">${window.t('hike.gps', {m: Math.round(accuracy)})}</span>` : '')
      + offlineNote();

    // Drive the elevation-profile cursor from live position, if the page has one.
    if (typeof window._dolopawsElevHighlight === 'function'){
      try { window._dolopawsElevHighlight(Math.min(currentKm, statedKm)); } catch (e) {}
    }
  }

  function onError(err){
    if (err.code === 1){ // PERMISSION_DENIED
      panel.innerHTML = window.t('hike.permission');
      stopHike(true);
      panel.style.display = 'block';
    } else {
      panel.innerHTML = window.t('hike.waiting');
    }
  }

  // ---- Start / stop ---------------------------------------------------------
  function startHike(){
    active = true;
    firstFix = true;
    offRouteStreak = 0;
    startBtn.textContent = window.t('hike.end');
    startBtn.style.background = '#9C3A25';
    panel.style.display = 'block';
    panel.innerHTML = window.t('hike.getting');
    // Community v0: one anonymous count event per trail per device per day
    // (localStorage guard stops pause/resume from double-counting).
    try {
      const guardKey = `dolopaws-hiked-${trail.id}-${new Date().toISOString().slice(0, 10)}`;
      if (!localStorage.getItem(guardKey) && window.DoloPawsCommunity) {
        window.DoloPawsCommunity.recordHikeStart(trail.id).then(ok => {
          if (ok) localStorage.setItem(guardKey, '1');
        });
      }
    } catch (e) { /* private browsing etc. — skip silently */ }
    acquireWakeLock();
    watchId = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
    });
  }

  function stopHike(keepPanel){
    active = false;
    if (watchId !== null){ navigator.geolocation.clearWatch(watchId); watchId = null; }
    if (wakeLock){ try { wakeLock.release(); } catch (e) {} wakeLock = null; }
    startBtn.textContent = window.t('hike.start');
    startBtn.style.background = 'var(--ink)';
    if (!keepPanel) panel.style.display = 'none';
    banner.style.display = 'none';
  }

  startBtn.addEventListener('click', () => { active ? stopHike() : startHike(); });
}
